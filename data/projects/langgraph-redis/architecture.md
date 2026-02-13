# LangGraph-Redis 架构文档

## 第一章：系统概述

### 1.1 项目定位

LangGraph-Redis 是一个为 LangGraph 框架提供的生产级 Redis 持久化解决方案，专注于 Agent 状态管理和记忆存储。该项目通过深度集成 Redis 的原生能力（RedisJSON、RediSearch），为 LangGraph 应用提供高性能、可扩展的状态检查点和长期记忆存储。

**核心价值：**
- 将 LangGraph 的瞬态状态转化为持久化可恢复的检查点
- 通过语义缓存大幅降低 LLM 调用成本和延迟
- 支持跨会话、跨线程的状态共享和检索
- 提供工具调用结果缓存，避免重复的外部 API 调用

### 1.2 技术栈

**Redis 模块依赖：**
- RedisJSON：原生 JSON 数据存储，支持复杂对象的高效序列化
- RediSearch：全文索引和向量搜索，支持语义检索
- Redis 8.0+：自带 RedisJSON 和 RediSearch，无需额外安装

**Python 核心依赖：**
- `redis>=5.2.1`：Redis 客户端，支持 Cluster 模式
- `redisvl>=0.5.1`：Redis 向量搜索库，封装 RediSearch 操作
- `langgraph-checkpoint>=2.0.24`：LangGraph 检查点协议
- `orjson`：高性能 JSON 序列化
- `ulid`：唯一 ID 生成（排序友好）

### 1.3 架构分层

```
┌─────────────────────────────────────────────┐
│        LangGraph Application Layer          │
│    (Agents, Tools, Workflows, Graphs)       │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────┴───────────────────────────┐
│      LangGraph-Redis Integration Layer      │
├─────────────────┬───────────────────────────┤
│  Checkpointers  │  Stores  │  Middleware    │
│  (State Save)   │  (K-V)   │  (Cache/Memory)│
└─────────────────┴───────────┬───────────────┘
                                │
┌───────────────────────────────┴───────────────┐
│         Redis Infrastructure Layer            │
│  RedisJSON + RediSearch + Native Features     │
└───────────────────────────────────────────────┘
```

## 第二章：检查点系统（Checkpointers）

### 2.1 设计哲学

检查点系统负责将 LangGraph 图的执行状态持久化到 Redis，实现中断恢复、状态回溯和跨会话共享。核心设计遵循以下原则：

1. **双实现策略**：每个组件都提供同步和异步版本，共享基类逻辑
2. **索引驱动查询**：通过 RediSearch 索引快速定位检查点，避免全量扫描
3. **原子化操作**：在非集群模式下使用 Redis Pipeline 保证多键操作的原子性

### 2.2 核心类层次

**基类：BaseRedisSaver**

定义了所有检查点保存器的共享逻辑，使用泛型支持不同的 Redis 客户端类型：

```python
class BaseRedisSaver(BaseCheckpointSaver[str], Generic[RedisClientType, IndexType]):
    # 状态存储
    _redis: RedisClientType                    # Redis 客户端（可能是 Redis 或 RedisCluster）
    _key_registry: Optional[Any]               # 写入键注册表（优化查询性能）

    # 索引定义
    checkpoints_index: IndexType               # 检查点主索引
    checkpoint_blobs_index: IndexType          # 大对象（blobs）索引
    checkpoint_writes_index: IndexType         # 待写入操作索引

    # 配置
    ttl_config: Optional[Dict[str, Any]]       # TTL 配置（过期管理）
    _checkpoint_prefix: str = "checkpoint"     # 可自定义键前缀
```

**具体实现类：**

1. **RedisSaver**：标准同步实现，支持完整历史记录
2. **AsyncRedisSaver**：异步实现，适用于高并发场景
3. **ShallowRedisSaver**：浅层实现，仅保留最新检查点（节省存储）
4. **AsyncShallowRedisSaver**：浅层异步实现

### 2.3 关键数据结构

**检查点键模式：**

```
checkpoint:{thread_id}:{checkpoint_ns}:{checkpoint_id}
```

- `thread_id`：会话线程 ID（如用户会话）
- `checkpoint_ns`：命名空间（支持子图隔离）
- `checkpoint_id`：ULID 格式的唯一检查点 ID

**检查点索引字段：**

```python
checkpoints_schema = {
    "fields": [
        {"name": "thread_id", "type": "tag"},           # 线程标识
        {"name": "checkpoint_ns", "type": "tag"},       # 命名空间
        {"name": "checkpoint_id", "type": "tag"},       # 检查点 ID
        {"name": "parent_checkpoint_id", "type": "tag"},# 父检查点（回溯链）
        {"name": "checkpoint_ts", "type": "numeric"},   # 时间戳（排序）
        {"name": "step", "type": "numeric"},            # 执行步数
        {"name": "has_writes", "type": "tag"},          # 是否有待写入
    ]
}
```

### 2.4 操作流程

**保存检查点（put）：**

```python
def put(config: RunnableConfig, checkpoint: Checkpoint, metadata: dict, new_versions: dict):
    # 1. 生成检查点 ID 和键
    checkpoint_id = get_checkpoint_id(checkpoint)
    checkpoint_key = f"checkpoint:{thread_id}:{namespace}:{checkpoint_id}"

    # 2. 序列化检查点数据（使用 JsonPlusRedisSerializer）
    serialized = self.serde.dumps_typed(checkpoint)

    # 3. 保存到 Redis（使用 JSON.SET）
    self._redis.json().set(checkpoint_key, "$", serialized)

    # 4. 保存 blobs（大对象，如通道值）
    for channel, value in checkpoint["channel_values"].items():
        blob_key = f"checkpoint_blob:{thread_id}:{namespace}:{channel}:{version}"
        self._redis.json().set(blob_key, "$", value)

    # 5. 注册写入键到 sorted set（加速查询）
    self._key_registry.register_write_key(thread_id, namespace, checkpoint_id, write_key)

    # 6. 应用 TTL（如果配置）
    if ttl_config:
        self._apply_ttl_to_keys(checkpoint_key, related_keys, ttl_minutes)
```

**检索检查点（get）：**

```python
def get(config: RunnableConfig) -> CheckpointTuple:
    # 1. 构建查询过滤器
    filters = [
        Tag("thread_id") == thread_id,
        Tag("checkpoint_ns") == namespace,
    ]

    # 2. 使用 RediSearch 查询最新检查点
    query = FilterQuery(
        filter_expression=filters,
        num_results=1,
        sort_by="checkpoint_ts",
        sort_order="DESC"
    )
    results = self.checkpoints_index.query(query)

    # 3. 反序列化检查点数据
    checkpoint = self.serde.loads_typed(result["checkpoint"])

    # 4. 加载 blobs（按需）
    for channel in checkpoint["channel_values"]:
        blob_key = f"checkpoint_blob:{thread_id}:{namespace}:{channel}:{version}"
        checkpoint["channel_values"][channel] = self._redis.json().get(blob_key)

    # 5. 刷新 TTL（如果配置了 refresh_on_read）
    if ttl_config.get("refresh_on_read"):
        self._apply_ttl_to_keys(checkpoint_key)
```

### 2.5 集群模式支持

项目通过 `cluster_mode` 属性自动检测 Redis 部署类型，适配操作策略：

**检测逻辑：**

```python
def _detect_cluster_mode(self) -> bool:
    if isinstance(self._redis, RedisCluster):
        return True
    try:
        cluster_info = self._redis.cluster("info")
        return "cluster_enabled:1" in cluster_info
    except:
        return False
```

**集群模式适配：**

- **单机模式**：使用 `pipeline(transaction=True)` 执行原子化多键操作
- **集群模式**：避免跨 slot 的 Pipeline，逐个执行键操作或使用 hash tag 强制同 slot

**Azure Redis / Redis Enterprise 特殊处理：**

Azure 和 Redis Enterprise 使用代理层隐藏集群细节，必须使用标准 `Redis` 客户端而非 `RedisCluster`：

```python
client = Redis(
    host="your-cache.redis.cache.windows.net",
    port=10000,  # Azure 企业版 TLS 端口
    password="your-access-key",
    ssl=True,
    ssl_cert_reqs="required",
    decode_responses=False
)
```

### 2.6 键注册表优化

通过 `SyncCheckpointKeyRegistry` 使用 Redis Sorted Set 缓存写入键，减少 RediSearch 查询：

```python
class SyncCheckpointKeyRegistry:
    def register_write_key(thread_id, checkpoint_ns, checkpoint_id, write_key):
        zset_key = f"write_keys_zset:{thread_id}:{checkpoint_ns}:{checkpoint_id}"
        self._redis.zadd(zset_key, {write_key: timestamp()})

    def get_write_keys(thread_id, checkpoint_ns, checkpoint_id) -> List[str]:
        zset_key = f"write_keys_zset:{thread_id}:{checkpoint_ns}:{checkpoint_id}"
        return self._redis.zrange(zset_key, 0, -1)
```

**优势：**
- 避免 `FT.SEARCH` 查询开销（O(log N) vs O(N)）
- 保证键的插入顺序（sorted set 天然排序）
- 支持批量注册（`register_write_keys_batch`）

## 第三章：云服务需求分析

### 3.1 计算服务需求分析

**核心计算场景：**

LangGraph-Redis 应用的计算需求主要集中在以下几个方面：

1. **Agent 运行时计算**
   - LLM 推理调用（通过 API 或自托管）
   - 工具函数执行（数据处理、API 调用）
   - 状态转换逻辑计算

2. **序列化/反序列化**
   - JSON 编码解码（使用 orjson 优化）
   - LangChain 对象转换
   - Base64 编码处理

3. **向量化计算**
   - 文本 Embedding 生成（如使用 OpenAI ada-002）
   - 向量相似度计算（余弦距离、欧氏距离）

**计算资源推荐：**

| 规模 | 并发会话 | CPU 配置 | 内存配置 | 适用场景 |
|------|----------|----------|----------|----------|
| 小型 | < 100 | 2-4 vCPU | 4-8 GB | 开发测试、小型应用 |
| 中型 | 100-1000 | 8-16 vCPU | 16-32 GB | 生产环境、中等负载 |
| 大型 | > 1000 | 32+ vCPU | 64+ GB | 高并发、大规模部署 |

**云服务选型：**

- **AWS**: EC2 (t3.xlarge / c6i.4xlarge), Lambda (事件驱动场景)
- **Azure**: VM (D4s v5 / F16s v2), Container Instances
- **GCP**: Compute Engine (n2-standard-8 / c2-standard-16), Cloud Run

**容器化部署推荐：**

```dockerfile
FROM python:3.11-slim

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 应用代码
COPY . /app
WORKDIR /app

# 资源限制（示例）
# Docker: --memory=4g --cpus=2
CMD ["python", "main.py"]
```

### 3.2 数据库服务分析（Redis 核心）

**Redis 部署架构选择：**

1. **单机模式 (Standalone)**
   - 适用场景：开发测试、小规模应用（< 1000 会话）
   - 优势：配置简单、成本低、支持完整的 Pipeline 事务
   - 劣势：无高可用、受限于单机内存

2. **主从复制 (Master-Replica)**
   - 适用场景：读多写少、需要数据冗余
   - 优势：读扩展、数据备份、故障切换基础
   - 劣势：手动故障转移、写入仍是单点

3. **哨兵模式 (Sentinel)**
   - 适用场景：生产环境、需要自动故障转移（< 10000 会话）
   - 优势：自动故障转移、监控告警、配置中心
   - 配置：至少 3 个 Sentinel 节点（奇数个）

4. **集群模式 (Cluster)**
   - 适用场景：大规模高并发（> 10000 会话）、需要水平扩展
   - 优势：数据分片、写入扩展、高可用
   - 注意：需要处理 CROSSSLOT 问题（LangGraph-Redis 已内置支持）

**Redis 模块依赖：**

LangGraph-Redis 严格依赖以下模块，必须确保云服务支持：

| 模块 | 版本要求 | 用途 | 关键功能 |
|------|----------|------|----------|
| **RedisJSON** | 2.6+ | 检查点存储 | JSON.SET, JSON.GET, 复杂对象存储 |
| **RediSearch** | 2.8+ | 索引查询 | FT.CREATE, FT.SEARCH, 向量搜索 |
| Redis Core | 8.0+ | 基础能力 | 包含上述模块，无需单独安装 |

**云托管 Redis 服务对比：**

| 云服务商 | 产品名 | RedisJSON | RediSearch | 集群支持 | 最大内存 | HA 方式 |
|----------|--------|-----------|------------|----------|----------|---------|
| **AWS** | ElastiCache (Redis 8) | ✅ | ✅ | ✅ | 6.1 TB | Multi-AZ, Auto-Failover |
| **Azure** | Azure Cache for Redis (Enterprise) | ✅ | ✅ | ✅ | 1.5 TB | Zone-Redundant, Geo-Replication |
| **GCP** | Memorystore for Redis (v8) | ✅ | ✅ | ⚠️ (Beta) | 300 GB | Standard (Replica), HA (Auto-failover) |
| **Upstash** | Serverless Redis | ✅ | ✅ | ❌ | 按需 | Multi-Region Replication |
| **Redis Cloud** | Redis Enterprise Cloud | ✅ | ✅ | ✅ | 无限 | Active-Active Geo-Distribution |

**内存规划计算：**

```python
# 单个检查点内存估算
checkpoint_size = (
    1 KB   # 元数据 (thread_id, checkpoint_id, timestamp)
    + 5 KB   # LLM 响应 (平均 1000 tokens)
    + 2 KB   # 工具调用结果
    + 1 KB   # 索引数据 (RediSearch)
) = 9 KB

# 每个会话保留 10 个检查点
per_thread_memory = 9 KB * 10 = 90 KB

# 1000 个活跃会话
total_checkpoints = 90 KB * 1000 = 90 MB

# 语义缓存 (向量索引)
cache_entry = 1.5 KB (embedding) + 5 KB (response) = 6.5 KB
total_cache = 6.5 KB * 5000 (缓存条目) = 32.5 MB

# 总内存需求 (含 30% 缓冲)
recommended_memory = (90 + 32.5) MB * 1.3 ≈ 160 MB
```

**生产环境推荐配置（AWS ElastiCache 示例）：**

```python
# 中型部署（1000-5000 会话）
instance_type = "cache.r7g.large"  # 16.88 GB 内存
node_count = 2  # 主节点 + 1 副本
shards = 1  # 单分片足够

# 大型部署（> 10000 会话）
instance_type = "cache.r7g.xlarge"  # 33.76 GB 内存
node_count = 6  # 3 分片，每分片 1 主 1 从
shards = 3
```

### 3.3 存储服务分析（Redis 持久化与备份）

**Redis 持久化策略：**

1. **RDB (快照)**
   - 原理：定期将内存数据保存到磁盘
   - 配置：
     ```conf
     save 900 1      # 900 秒内至少 1 次写入
     save 300 10     # 300 秒内至少 10 次写入
     save 60 10000   # 60 秒内至少 10000 次写入
     ```
   - 优势：紧凑、恢复快、性能影响小
   - 劣势：可能丢失最后几分钟数据

2. **AOF (追加日志)**
   - 原理：记录每个写操作到日志文件
   - 配置：
     ```conf
     appendonly yes
     appendfsync everysec  # 每秒同步（折中方案）
     ```
   - 优势：数据安全性高（最多丢失 1 秒）
   - 劣势：文件大、恢复慢

3. **混合持久化（推荐）**
   - 配置：
     ```conf
     aof-use-rdb-preamble yes  # AOF 重写时使用 RDB 格式
     ```
   - 优势：兼具 RDB 的快速恢复和 AOF 的数据安全

**云存储备份方案：**

| 云服务商 | 备份存储 | 自动备份 | 时间点恢复 | 跨区域复制 |
|----------|----------|----------|------------|------------|
| AWS | S3 | ✅ (每日) | ✅ (35 天) | ✅ (Cross-Region) |
| Azure | Azure Storage | ✅ (可配置) | ✅ (30 天) | ✅ (Geo-Replication) |
| GCP | Cloud Storage | ✅ (每日) | ⚠️ (手动) | ✅ (Multi-Region) |

**备份策略推荐：**

```python
# 生产环境备份配置
backup_config = {
    "frequency": "daily",           # 每天备份
    "retention": 7,                 # 保留 7 天
    "snapshot_window": "03:00-05:00",  # 低峰期执行
    "cross_region": True,           # 异地灾备
}

# AWS ElastiCache 自动备份示例
response = elasticache.create_cache_cluster(
    CacheClusterId='langgraph-redis-prod',
    Engine='redis',
    EngineVersion='8.0',
    SnapshotRetentionLimit=7,        # 保留 7 天快照
    SnapshotWindow='03:00-05:00',    # 备份时间窗口
    PreferredMaintenanceWindow='sun:05:00-sun:06:00',
)
```

**灾难恢复方案：**

1. **主区域故障（RPO < 5 分钟）**
   - 自动故障转移到副本节点
   - 使用最新 AOF 日志恢复

2. **区域级灾难（RPO < 1 小时）**
   - 从跨区域备份恢复
   - 使用最近的 S3/Azure Storage 快照

3. **数据损坏（人为误操作）**
   - 时间点恢复到事故前状态
   - 使用保留的历史快照

### 3.4 向量数据库分析（RedisStore 向量搜索）

**向量搜索架构：**

LangGraph-Redis 使用 RediSearch 的向量索引功能，无需单独部署向量数据库。

**索引配置：**

```python
# 向量索引配置
vector_index_config = {
    "name": "semantic_memory",
    "prefix": "store_vectors:",
    "fields": [
        {
            "name": "embedding",
            "type": "vector",
            "attrs": {
                "dims": 1536,              # OpenAI ada-002 维度
                "distance_metric": "COSINE",
                "algorithm": "HNSW",       # 高效近似最近邻
                "m": 16,                   # HNSW 参数（连接数）
                "ef_construction": 200,    # 索引构建精度
            }
        },
        {"name": "text", "type": "text"},   # 全文索引
        {"name": "namespace", "type": "tag"},
        {"name": "timestamp", "type": "numeric"},
    ]
}
```

**内存开销估算：**

```python
# 向量索引内存计算
vector_dim = 1536
bytes_per_vector = vector_dim * 4  # float32
hnsw_overhead = bytes_per_vector * 1.5  # HNSW 图结构开销

memory_per_doc = (
    bytes_per_vector  # 6144 字节
    + hnsw_overhead    # 9216 字节
    + 512              # 元数据
) = 15.8 KB

# 10 万条向量记忆
total_vectors_memory = 15.8 KB * 100000 = 1.58 GB
```

**与专用向量数据库对比：**

| 特性 | RediSearch 向量 | Pinecone | Weaviate | Qdrant |
|------|----------------|----------|----------|---------|
| **延迟** | < 10ms (本地) | 50-100ms | 20-50ms | 10-30ms |
| **成本** | 包含在 Redis | 额外付费 | 自托管/付费 | 自托管/付费 |
| **集成复杂度** | 低 (同一 Redis) | 中 (额外服务) | 中 | 中 |
| **扩展性** | 受 Redis 限制 | 高 (Serverless) | 高 | 高 |
| **适用场景** | < 100 万向量 | > 100 万向量 | 复杂图查询 | 高吞吐搜索 |

**推荐策略：**

- **使用 RediSearch**：向量数量 < 100 万，需要低延迟，预算有限
- **使用专用向量库**：向量数量 > 100 万，需要高级过滤，多租户隔离

### 3.5 AI/ML 服务分析（LangGraph LLM 集成）

**LLM 调用架构：**

LangGraph-Redis 作为持久化层，LLM 调用通过 LangChain 集成：

1. **云 API 服务**
   - OpenAI (GPT-4o, GPT-4o-mini)
   - Anthropic Claude (Claude 4.5 Sonnet)
   - Google Vertex AI (Gemini Pro)
   - Azure OpenAI Service

2. **自托管模型**
   - AWS SageMaker (Llama 3, Mixtral)
   - Azure ML (自定义模型)
   - GCP Vertex AI Prediction (自定义端点)

**成本优化策略：**

语义缓存可显著降低 LLM 调用成本：

```python
# 成本计算示例（GPT-4o-mini）
input_cost_per_1k = 0.150 / 1000  # $0.150 per 1M tokens
output_cost_per_1k = 0.600 / 1000

# 无缓存场景
monthly_requests = 100000
avg_input_tokens = 500
avg_output_tokens = 200

no_cache_cost = monthly_requests * (
    (avg_input_tokens / 1000) * input_cost_per_1k +
    (avg_output_tokens / 1000) * output_cost_per_1k
) = $19.50 / 月

# 有缓存场景（60% 缓存命中率）
cache_hit_rate = 0.6
with_cache_cost = no_cache_cost * (1 - cache_hit_rate) = $7.80 / 月

# 节省：$11.70 / 月（60% 成本降低）
```

**Embedding 服务选择：**

| 服务 | 模型 | 维度 | 成本 (每 1M tokens) | 延迟 |
|------|------|------|---------------------|------|
| OpenAI | text-embedding-3-small | 1536 | $0.02 | 50-100ms |
| OpenAI | text-embedding-3-large | 3072 | $0.13 | 100-200ms |
| Azure OpenAI | ada-002 | 1536 | $0.10 | 100-200ms |
| Vertex AI | textembedding-gecko | 768 | $0.025 | 50-100ms |
| AWS Bedrock | Titan Embeddings | 1536 | $0.10 | 50-100ms |

**推荐：** text-embedding-3-small（性价比高，足够多数场景）

**LLM 调用优化配置：**

```python
from langgraph.checkpoint.redis import AsyncRedisSaver
from langchain_openai import ChatOpenAI

# 1. 使用语义缓存降低成本
semantic_cache = SemanticCacheMiddleware(
    SemanticCacheConfig(
        redis_url=redis_url,
        distance_threshold=0.1,     # 严格匹配
        ttl_seconds=7200,           # 2 小时缓存
    )
)

# 2. 使用较小模型处理简单任务
model = ChatOpenAI(
    model="gpt-4o-mini",            # 比 GPT-4 便宜 20 倍
    temperature=0.7,
    max_tokens=500,                 # 限制输出长度
    request_timeout=30,             # 超时控制
)

# 3. 批量调用（减少 API overhead）
async def process_batch(queries: List[str]):
    tasks = [model.ainvoke(q) for q in queries]
    return await asyncio.gather(*tasks)
```

### 3.6 网络与 CDN 分析

**网络架构：**

```
┌───────────────────────────────────────────────┐
│           用户/应用层                          │
│  (LangGraph Application, API Gateway)         │
└──────────────┬────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│         负载均衡 (ALB/NLB/Cloud LB)           │
│  (SSL 终止, 健康检查, 流量分发)                │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│         应用服务器集群                        │
│  (LangGraph-Redis Client, 计算实例)           │
└──────────────┬───────────────────────────────┘
               │
               ▼ (VPC Private Subnet)
┌──────────────────────────────────────────────┐
│         Redis 集群                            │
│  (ElastiCache/Azure Cache/Memorystore)        │
└──────────────────────────────────────────────┘
```

**关键网络配置：**

1. **VPC 隔离**
   - Redis 部署在私有子网
   - 应用通过 VPC 内网访问 Redis（低延迟、高安全）
   - 禁止 Redis 公网暴露

2. **安全组/防火墙规则**
   ```python
   # AWS 安全组示例
   ingress_rules = [
       {
           "protocol": "tcp",
           "port": 6379,
           "source": "10.0.0.0/16",  # 仅允许 VPC 内部访问
           "description": "Redis from App Servers"
       }
   ]
   ```

3. **延迟优化**
   - 应用和 Redis 部署在同一可用区（< 1ms 延迟）
   - 使用连接池复用（减少 TLS 握手开销）
   - 启用 TCP Keep-Alive

**CDN 需求（可选）：**

如果 LangGraph 应用提供 Web 接口或 API：

| 场景 | CDN 作用 | 推荐服务 |
|------|----------|----------|
| 静态资源 | 缓存前端资源 | CloudFront, Azure CDN |
| API 响应缓存 | 缓存只读 API | Cloudflare, Fastly |
| 全球分发 | 降低跨区域延迟 | CloudFront + Global Accelerator |

**带宽估算：**

```python
# 单次 LangGraph 交互
request_size = 2 KB  # 用户输入
response_size = 5 KB  # LLM 响应
redis_traffic = 9 KB  # 检查点读写

total_per_request = (2 + 5 + 9) KB = 16 KB

# 1000 TPS（每秒交互数）
bandwidth_required = 16 KB * 1000 = 16 MB/s ≈ 128 Mbps

# 月流量（假设 50% 时间峰值）
monthly_traffic = 128 Mbps * 0.5 * 30 天 * 24 小时 * 3600 秒
                = 约 15 TB / 月
```

### 3.7 部署与编排服务分析（Redis Cluster, HA）

**高可用架构设计：**

**1. AWS ElastiCache 多可用区部署**

```python
# Terraform 配置示例
resource "aws_elasticache_replication_group" "langgraph_redis" {
  replication_group_id       = "langgraph-redis-prod"
  description                = "LangGraph Redis Cluster"
  engine                     = "redis"
  engine_version             = "8.0"
  node_type                  = "cache.r7g.large"

  # 高可用配置
  num_cache_clusters         = 3  # 1 主 + 2 副本
  automatic_failover_enabled = true
  multi_az_enabled           = true

  # 备份配置
  snapshot_retention_limit   = 7
  snapshot_window            = "03:00-05:00"

  # 维护窗口
  maintenance_window         = "sun:05:00-sun:07:00"

  # 安全配置
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_password

  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis.id]

  # 参数组
  parameter_group_name       = aws_elasticache_parameter_group.redis8.name
}

# 参数组配置
resource "aws_elasticache_parameter_group" "redis8" {
  name   = "langgraph-redis-params"
  family = "redis8"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"  # LRU 淘汰策略
  }

  parameter {
    name  = "timeout"
    value = "300"  # 5 分钟空闲超时
  }
}
```

**2. Azure Redis Enterprise 高可用**

```python
# Azure CLI 配置
az redis create \
  --name langgraph-redis-prod \
  --resource-group langgraph-rg \
  --location eastus \
  --sku Enterprise_E10 \
  --capacity 10 \
  --zones 1 2 3 \  # 3 个可用区
  --redis-version 8 \
  --modules RediSearch RedisJSON \
  --minimum-tls-version 1.2 \
  --enable-non-ssl-port false \
  --replicas-per-primary 2  # 每个主节点 2 个副本
```

**3. Kubernetes 自托管 Redis（高级场景）**

```yaml
# Redis Operator 部署
apiVersion: redis.redis.opstreelabs.in/v1beta1
kind: RedisCluster
metadata:
  name: langgraph-redis
spec:
  clusterSize: 6  # 3 主 3 从
  kubernetesConfig:
    image: redis/redis-stack-server:latest
    imagePullPolicy: IfNotPresent
  redisExporter:
    enabled: true  # Prometheus 监控
  storage:
    volumeClaimTemplate:
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 50Gi
        storageClassName: fast-ssd
  # HA 配置
  redisConfig:
    maxmemory: "4gb"
    maxmemory-policy: "allkeys-lru"
    save: "900 1 300 10"
    appendonly: "yes"
```

**容器编排服务选择：**

| 服务 | 适用场景 | 优势 | 劣势 |
|------|----------|------|------|
| **Kubernetes (EKS/AKS/GKE)** | 复杂应用、多服务 | 灵活、可移植、生态丰富 | 学习曲线陡、运维复杂 |
| **AWS ECS/Fargate** | AWS 生态、无服务器 | 简单、托管式、按需付费 | 供应商锁定 |
| **Azure Container Apps** | 事件驱动、微服务 | Serverless、自动扩展 | 功能限制 |
| **Cloud Run (GCP)** | 无状态 API 服务 | 完全托管、按请求付费 | 不适合长连接 |

**应用部署最佳实践：**

```dockerfile
# 多阶段构建优化镜像大小
FROM python:3.11-slim as builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.11-slim

# 只复制必要文件
COPY --from=builder /root/.local /root/.local
COPY . /app
WORKDIR /app

# 非 root 用户运行
RUN useradd -m appuser
USER appuser

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD python -c "import redis; redis.Redis.from_url('${REDIS_URL}').ping()"

ENV PATH=/root/.local/bin:$PATH
CMD ["python", "main.py"]
```

**自动扩展配置（Kubernetes HPA）：**

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: langgraph-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: langgraph-app
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 3.8 成本估算（三种规模）

**小型部署（< 100 并发会话，开发/测试）**

| 服务 | 配置 | 月成本 (USD) |
|------|------|--------------|
| **计算** | AWS t3.medium (2 vCPU, 4 GB) | $30 |
| **Redis** | ElastiCache cache.t4g.micro (0.5 GB) | $12 |
| **存储** | EBS 20 GB (备份) | $2 |
| **网络** | 100 GB 出站流量 | $9 |
| **LLM** | GPT-4o-mini (10K 请求/月, 缓存 40%) | $5 |
| **监控** | CloudWatch 基础指标 | $5 |
| **总计** | - | **$63 / 月** |

**中型部署（1000-5000 并发会话，生产环境）**

| 服务 | 配置 | 月成本 (USD) |
|------|------|--------------|
| **计算** | 2x AWS c6i.2xlarge (8 vCPU, 16 GB) | $460 |
| **Redis** | ElastiCache r7g.large (16 GB, 1 主 1 从) | $340 |
| **存储** | S3 备份 100 GB + EBS 100 GB | $15 |
| **网络** | 2 TB 出站流量 | $180 |
| **负载均衡** | ALB (1000 LCU) | $40 |
| **LLM** | GPT-4o-mini (500K 请求/月, 缓存 60%) | $120 |
| **监控** | CloudWatch + X-Ray | $50 |
| **总计** | - | **$1,205 / 月** |

**大型部署（> 10000 并发会话，高并发场景）**

| 服务 | 配置 | 月成本 (USD) |
|------|------|--------------|
| **计算** | 5x AWS c6i.4xlarge (16 vCPU, 32 GB) | $2,300 |
| **Redis** | ElastiCache Cluster (3 分片, r7g.xlarge, 100 GB) | $2,040 |
| **存储** | S3 备份 1 TB + EBS 500 GB | $100 |
| **网络** | 10 TB 出站流量 + VPC PrivateLink | $920 |
| **负载均衡** | ALB (5000 LCU) | $200 |
| **LLM** | GPT-4o-mini (3M 请求/月, 缓存 70%) | $350 |
| **监控** | CloudWatch + X-Ray + 第三方 APM | $200 |
| **备份/DR** | 跨区域复制 + 灾备环境 | $500 |
| **总计** | - | **$6,610 / 月** |

**成本优化建议：**

1. **使用 Reserved Instances / Savings Plans**
   - 1 年期：节省 30-40%
   - 3 年期：节省 60-70%

2. **启用语义缓存**
   - 减少 50-70% LLM 调用成本

3. **使用 Spot Instances（非生产）**
   - 节省 70-90% 计算成本

4. **合理配置 TTL**
   - 自动清理过期数据，降低 Redis 内存成本

5. **选择合适的 LLM 模型**
   - 简单任务使用 GPT-4o-mini（比 GPT-4 便宜 20 倍）
   - 复杂推理使用 GPT-4o（按需切换）

### 3.9 云服务选型清单

**推荐方案对比（按优先级）**

**方案 A：AWS 全栈方案（推荐）**

| 组件 | 服务 | 理由 |
|------|------|------|
| 计算 | ECS Fargate / EKS | 容器化、自动扩展、托管式 |
| Redis | ElastiCache for Redis 8 | 原生支持 RedisJSON/RediSearch、Multi-AZ、自动故障转移 |
| 存储 | S3 (备份) + EBS (持久化) | 11 个 9 的持久性、跨区域复制 |
| 网络 | VPC + ALB + PrivateLink | 安全隔离、低延迟、企业级网络 |
| LLM | AWS Bedrock / OpenAI API | 多模型选择、按需付费 |
| 监控 | CloudWatch + X-Ray | 深度集成、分布式追踪 |
| **总成本** | 中型部署 | **$1,205 / 月** |
| **优势** | - 生态完整、服务成熟<br>- Redis 8 原生支持所有模块<br>- 企业级 SLA (99.99%) | |
| **劣势** | - 学习曲线<br>- 供应商锁定 | |

**方案 B：Azure 企业方案**

| 组件 | 服务 | 理由 |
|------|------|------|
| 计算 | AKS / Container Apps | Kubernetes 托管、Serverless 选项 |
| Redis | Azure Cache for Redis (Enterprise) | RedisJSON/RediSearch 支持、Zone-Redundant |
| 存储 | Azure Blob Storage | 跨区域复制、成本较低 |
| 网络 | VNet + Application Gateway | 企业级防火墙、WAF 集成 |
| LLM | Azure OpenAI Service | 企业合规、数据隐私保证 |
| 监控 | Azure Monitor + Application Insights | 统一监控平台 |
| **总成本** | 中型部署 | **$1,350 / 月** |
| **优势** | - 企业级合规（HIPAA, SOC2）<br>- Azure OpenAI 数据不出境<br>- 与 Microsoft 生态集成 | |
| **劣势** | - Redis Enterprise 价格较高<br>- 部分功能区域可用性差 | |

**方案 C：GCP 高性价比方案**

| 组件 | 服务 | 理由 |
|------|------|------|
| 计算 | GKE Autopilot / Cloud Run | 自动优化、按需付费 |
| Redis | Memorystore for Redis (v8 Beta) | 价格较低、托管式 |
| 存储 | Cloud Storage (Nearline) | 备份成本低 |
| 网络 | VPC + Cloud Load Balancing | 全球负载均衡、低延迟 |
| LLM | Vertex AI (Gemini) | 成本较低、多模态 |
| 监控 | Cloud Monitoring + Trace | 统一可观测性 |
| **总成本** | 中型部署 | **$980 / 月** |
| **优势** | - 成本最低（比 AWS 低 15-20%）<br>- 网络性能优秀<br>- Gemini 性价比高 | |
| **劣势** | - Redis 8 仍为 Beta<br>- 服务成熟度不如 AWS<br>- 中国区域无服务 | |

**方案 D：多云混合方案（高级场景）**

| 组件 | 服务 | 理由 |
|------|------|------|
| 计算 | AWS ECS (主) + GCP Cloud Run (备) | 灾备、成本优化 |
| Redis | Redis Cloud (Enterprise) | 跨云部署、Active-Active 复制 |
| 存储 | S3 + GCS 跨云备份 | 防止供应商锁定 |
| 网络 | Cloudflare (全球 CDN + DDoS 防护) | 统一入口、安全防护 |
| LLM | OpenAI API (主) + Anthropic (备) | 模型冗余、成本优化 |
| 监控 | Datadog / New Relic | 跨云统一监控 |
| **总成本** | 中型部署 | **$2,100 / 月** |
| **优势** | - 无供应商锁定<br>- 最高可用性<br>- 灵活迁移能力 | |
| **劣势** | - 成本高（+75%）<br>- 运维复杂度高<br>- 需要专业团队 | |

**选型决策树：**

```
是否需要企业级合规（HIPAA, SOC2）？
├── 是 → Azure (方案 B)
└── 否 → 是否预算敏感？
    ├── 是 → GCP (方案 C)
    └── 否 → 是否需要最成熟生态？
        ├── 是 → AWS (方案 A)
        └── 否 → 是否需要多云灾备？
            ├── 是 → 多云混合 (方案 D)
            └── 否 → AWS (方案 A，默认推荐)
```

**特殊场景推荐：**

1. **初创公司 / MVP 阶段**
   - 使用 Upstash Serverless Redis（免费额度 + 按需付费）
   - Cloud Run / Vercel（Serverless 计算）
   - 总成本：< $50 / 月

2. **AI SaaS 产品**
   - Azure OpenAI Service（数据隐私）
   - Azure Cache for Redis Enterprise
   - Azure Container Apps

3. **跨国部署**
   - Redis Cloud Active-Active（多区域写入）
   - Cloudflare（全球加速）
   - AWS Global Accelerator

4. **高合规行业（金融、医疗）**
   - AWS GovCloud / Azure Government
   - 专用主机 + 加密存储
   - 审计日志完整保留

**快速启动模板（AWS）：**

```bash
# 1. 部署 Redis 集群
aws cloudformation create-stack \
  --stack-name langgraph-redis \
  --template-url https://s3.amazonaws.com/quickstart/redis-cluster.yaml \
  --parameters \
    ParameterKey=RedisVersion,ParameterValue=8.0 \
    ParameterKey=CacheNodeType,ParameterValue=cache.r7g.large \
    ParameterKey=NumCacheClusters,ParameterValue=3

# 2. 部署应用（ECS Fargate）
aws ecs create-service \
  --cluster langgraph-cluster \
  --service-name langgraph-app \
  --task-definition langgraph:1 \
  --desired-count 3 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx]}"

# 3. 配置环境变量
aws ssm put-parameter \
  --name /langgraph/redis-url \
  --type SecureString \
  --value "rediss://master.xxx.cache.amazonaws.com:6379"
```

## 第四章：存储系统（Stores）

### 4.1 存储抽象

Redis Stores 提供了一个通用的键值存储接口，支持可选的向量搜索能力，用于长期记忆和跨会话数据共享。

**设计特点：**
- 符合 LangGraph 的 `BaseStore` 协议
- 支持命名空间隔离（namespace-based partitioning）
- 可选向量索引（支持语义搜索）
- 集成 TTL 管理（自动过期）

### 4.2 核心类结构

**基类：BaseRedisStore**

```python
class BaseRedisStore(Generic[RedisClientType, IndexType]):
    _redis: RedisClientType          # Redis 客户端
    store_index: IndexType           # 主存储索引
    vector_index: IndexType          # 向量索引（可选）
    _serde: JsonPlusRedisSerializer  # 序列化器

    # TTL 管理
    ttl_config: Optional[TTLConfig]
    supports_ttl: bool = True
```

**具体实现：**
- **RedisStore**：同步存储
- **AsyncRedisStore**：异步存储

### 4.3 存储模式

**键结构：**

```
store:{uuid}                # 主文档
store_vectors:{uuid}        # 向量数据（如果启用向量搜索）
```

每个存储项是一个 `Item` 对象：

```python
class Item(TypedDict):
    namespace: Sequence[str]    # 命名空间路径（如 ["user", "123", "memories"]）
    key: str                     # 项的唯一键
    value: Dict[str, Any]        # 任意 JSON 数据
    created_at: str              # 创建时间
    updated_at: str              # 更新时间
```

### 4.4 向量搜索配置

**索引配置示例：**

```python
index_config = {
    "dims": 1536,                  # 向量维度（如 OpenAI ada-002）
    "distance_type": "cosine",     # 距离度量（cosine/l2/ip）
    "fields": ["text", "summary"], # 要向量化的字段
}

store = RedisStore.from_conn_string(
    "redis://localhost:6379",
    index=index_config
)
store.setup()
```

**向量索引字段：**

```python
vector_schema = {
    "fields": [
        {"name": "embedding", "type": "vector",
         "attrs": {
             "dims": 1536,
             "distance_metric": "COSINE",
             "algorithm": "HNSW"  # 高效近似最近邻
         }
        },
        {"name": "field_name", "type": "tag"},  # 区分不同字段的向量
    ]
}
```

### 4.5 批量操作

Store 支持批量操作以提高性能：

```python
async def abatch(self, ops: Iterable[Op]) -> list:
    """批量执行多个操作"""
    results = []
    for op in ops:
        if isinstance(op, PutOp):
            result = await self.aput(op.namespace, op.key, op.value)
        elif isinstance(op, GetOp):
            result = await self.aget(op.namespace, op.key)
        elif isinstance(op, SearchOp):
            result = await self.asearch(op.namespace_prefix, query=op.query)
        results.append(result)
    return results
```

### 4.6 语义搜索

通过向量索引实现语义搜索：

```python
async def asearch(
    self,
    namespace_prefix: Sequence[str],
    query: Optional[str] = None,
    limit: int = 10,
    filter: Optional[dict] = None,
) -> List[SearchItem]:
    # 1. 将查询向量化
    query_vector = self._vectorizer.embed(query)

    # 2. 构建 RediSearch 向量查询
    vector_query = VectorQuery(
        vector=query_vector,
        vector_field_name="embedding",
        num_results=limit,
        filter_expression=Tag("prefix") == namespace_prefix[0]
    )

    # 3. 执行查询并返回结果
    results = await self.vector_index.query(vector_query)
    return [self._to_search_item(r) for r in results]
```

## 第五章：中间件系统（Middleware）

### 5.1 中间件架构

LangGraph-Redis 提供了一套与 LangChain Agent 深度集成的中间件，用于缓存和记忆管理。中间件遵循 LangChain 的 `AgentMiddleware` 协议，可以无缝集成到 `create_agent()` 工作流中。

**核心中间件：**
1. **SemanticCacheMiddleware**：语义缓存 LLM 响应
2. **ToolResultCacheMiddleware**：缓存工具调用结果
3. **ConversationMemoryMiddleware**：会话记忆管理
4. **SemanticRouterMiddleware**：语义路由

### 5.2 语义缓存中间件

**工作原理：**

利用 `redisvl.extensions.cache.llm.SemanticCache` 实现基于向量相似度的缓存匹配：

```python
class SemanticCacheMiddleware(AsyncRedisMiddleware):
    _cache: SemanticCache

    async def awrap_model_call(
        self,
        request: ModelRequest,
        next: Callable[..., Awaitable[ModelCallResult]]
    ) -> ModelCallResult:
        # 1. 提取用户消息
        prompt = self._extract_prompt(request.messages)

        # 2. 检查语义缓存
        cached = self._cache.check(prompt=prompt)
        if cached:
            logger.info(f"Cache hit for prompt: {prompt[:50]}...")
            return self._deserialize_response(cached)

        # 3. 缓存未命中，调用模型
        result = await next(request)

        # 4. 判断是否应该缓存（考虑工具调用）
        if self._should_cache(request, result):
            serialized = self._serialize_response(result.response)
            self._cache.store(prompt=prompt, response=serialized)

        return result
```

**缓存策略：**

- **距离阈值**：通过 `distance_threshold` 控制相似度（默认 0.15）
- **确定性工具列表**：只缓存调用确定性工具后的响应（避免缓存时间敏感数据）
- **TTL 管理**：自动过期陈旧缓存

**配置示例：**

```python
config = SemanticCacheConfig(
    redis_url="redis://localhost:6379",
    name="llm_cache",
    distance_threshold=0.15,
    ttl_seconds=3600,
    deterministic_tools=["calculate", "web_search"],  # 只缓存这些工具后的响应
)
middleware = SemanticCacheMiddleware(config)
```

### 5.3 工具缓存中间件

**工作原理：**

缓存昂贵的工具调用结果（如 API 调用、数据库查询）：

```python
class ToolResultCacheMiddleware(AsyncRedisMiddleware):
    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        next: Callable[..., Awaitable[Command]]
    ) -> Command:
        # 1. 检查工具是否可缓存
        if not self._is_tool_cacheable(request):
            return await next(request)

        # 2. 构建缓存键（基于工具名和参数）
        cache_key = f"{request.name}:{json.dumps(request.args, sort_keys=True)}"

        # 3. 检查语义缓存
        cached = self._cache.check(prompt=cache_key)
        if cached:
            return self._deserialize_tool_result(cached)

        # 4. 执行工具并缓存结果
        result = await next(request)
        self._cache.store(prompt=cache_key, response=self._serialize_result(result))
        return result
```

**可缓存性控制：**

通过 LangChain 的 `tool.metadata` 标准控制：

```python
@tool
def calculate(expression: str) -> str:
    """评估数学表达式"""
    return str(eval(expression))

calculate.metadata = {"cacheable": True}  # 确定性工具，可缓存

@tool
def get_stock_price(symbol: str) -> str:
    """获取股票价格"""
    return fetch_price(symbol)

get_stock_price.metadata = {"cacheable": False}  # 时间敏感，不缓存
```

**配置选项：**

```python
config = ToolCacheConfig(
    redis_url="redis://localhost:6379",
    name="tool_cache",
    ttl_seconds=1800,
    cacheable_tools=["search", "calculate"],  # 白名单模式
    excluded_tools=["get_time"],              # 黑名单模式
)
```

### 5.4 会话记忆中间件

**工作原理：**

通过向量检索注入历史相关消息到上下文：

```python
class ConversationMemoryMiddleware(AsyncRedisMiddleware):
    async def awrap_model_call(
        self,
        request: ModelRequest,
        next: Callable[..., Awaitable[ModelCallResult]]
    ) -> ModelCallResult:
        # 1. 提取当前查询
        current_query = request.messages[-1].content

        # 2. 语义检索相关历史
        relevant_history = await self._search_relevant_messages(
            query=current_query,
            limit=self._config.max_context_messages
        )

        # 3. 注入到上下文
        augmented_messages = relevant_history + request.messages
        request.messages = augmented_messages

        # 4. 调用模型
        result = await next(request)

        # 5. 保存新消息到记忆
        await self._store_message(request.messages[-1])
        await self._store_message(result.response.result[-1])

        return result
```

### 5.5 中间件组合

支持通过 `MiddlewareStack` 或 `from_configs` 组合多个中间件：

```python
# 方式 1：直接组合
stack = MiddlewareStack([
    SemanticCacheMiddleware(SemanticCacheConfig(...)),
    ToolResultCacheMiddleware(ToolCacheConfig(...)),
])

# 方式 2：共享连接
stack = from_configs(
    configs=[
        SemanticCacheConfig(name="llm_cache", ttl_seconds=3600),
        ToolCacheConfig(name="tool_cache", ttl_seconds=1800),
    ],
    redis_url="redis://localhost:6379",  # 共享连接
)

agent = create_agent(
    model="gpt-4o-mini",
    tools=[calculate, search],
    middleware=[stack]
)
```

**与检查点集成：**

```python
checkpointer = AsyncRedisSaver(redis_url="redis://localhost:6379")
await checkpointer.asetup()

middleware = IntegratedRedisMiddleware.from_saver(
    checkpointer,
    configs=[
        SemanticCacheConfig(name="llm_cache"),
        ToolCacheConfig(name="tool_cache"),
    ],
)

agent = create_agent(
    model="gpt-4o-mini",
    tools=tools,
    checkpointer=checkpointer,  # 共享 Redis 连接
    middleware=[middleware],
)
```

## 第六章：序列化系统

### 6.1 JsonPlusRedisSerializer

项目使用自定义的 `JsonPlusRedisSerializer` 处理 LangChain 对象的序列化和反序列化。

**核心功能：**
1. 支持 LangChain 消息类型（HumanMessage、AIMessage、ToolMessage 等）
2. 处理复杂嵌套对象（如 Pydantic 模型）
3. 支持自定义类型处理器
4. 与 Redis JSON 无缝集成

**序列化流程：**

```python
class JsonPlusRedisSerializer(SerializerProtocol):
    def dumps_typed(self, obj: Any) -> Dict[str, Any]:
        # 1. 处理 LangChain 对象
        if hasattr(obj, "to_json"):
            return obj.to_json()

        # 2. 处理 Pydantic 模型
        if hasattr(obj, "model_dump"):
            return obj.model_dump()

        # 3. 处理字典和列表
        if isinstance(obj, dict):
            return {k: self.dumps_typed(v) for k, v in obj.items()}

        # 4. 处理基本类型
        return obj

    def loads_typed(self, data: Dict[str, Any]) -> Any:
        # 1. 检查 LangChain 标记
        if data.get("lc") in (1, 2) and data.get("type") == "constructor":
            return self._revive_if_needed(data)

        # 2. 递归恢复嵌套对象
        if isinstance(data, dict):
            return {k: self.loads_typed(v) for k, v in data.items()}

        return data
```

**LangChain 对象恢复：**

```python
def _revive_if_needed(self, data: dict) -> Any:
    """恢复 LangChain 序列化对象"""
    if data.get("id") and "langchain" in data.get("id", []):
        # 使用 LangChain 的 loads 函数恢复
        from langchain_core.load import loads
        return loads(json.dumps(data))
    return data
```

### 6.2 存储安全 ID 转换

为了兼容 RediSearch 的标签查询，项目使用哨兵值处理空字符串：

```python
EMPTY_ID_SENTINEL = "__empty__"

def to_storage_safe_id(id_str: str) -> str:
    """将空字符串转换为哨兵值"""
    return EMPTY_ID_SENTINEL if id_str == "" else id_str

def from_storage_safe_id(safe_str: str) -> str:
    """将哨兵值转换回空字符串"""
    return "" if safe_str == EMPTY_ID_SENTINEL else safe_str
```

**背景：**

RediSearch 的 `Tag` 索引不支持空字符串查询，会导致查询失败。通过哨兵值替换，确保查询的一致性。

### 6.3 Base64 编码处理

大对象（blobs）使用 Base64 编码存储：

```python
def encode_blob(data: bytes) -> str:
    return base64.b64encode(data).decode("utf-8")

def decode_blob(encoded: str) -> bytes:
    try:
        return base64.b64decode(encoded)
    except binascii.Error as e:
        logger.error(f"Failed to decode base64: {e}")
        raise ValueError("Invalid base64 data in blob")
```

## 第七章：TTL 管理

### 7.1 原生 TTL 支持

LangGraph-Redis 使用 Redis 的原生 TTL 机制，而非自定义扫描：

**优势：**
- 自动过期，无需后台线程扫描
- 精确到秒级
- 支持原子化 TTL 刷新

### 7.2 TTL 配置

```python
ttl_config = {
    "default_ttl": 60,          # 默认 60 分钟过期
    "refresh_on_read": True,    # 读取时刷新 TTL
}

saver = RedisSaver.from_conn_string(
    "redis://localhost:6379",
    ttl=ttl_config
)
```

### 7.3 TTL 应用

**多键 TTL 同步：**

```python
def _apply_ttl_to_keys(
    self,
    main_key: str,
    related_keys: Optional[List[str]] = None,
    ttl_minutes: Optional[float] = None,
) -> None:
    if ttl_minutes is None and self.ttl_config:
        ttl_minutes = self.ttl_config.get("default_ttl")

    if ttl_minutes is not None:
        ttl_seconds = int(ttl_minutes * 60)

        if self.cluster_mode:
            # 集群模式：逐个设置
            self._redis.expire(main_key, ttl_seconds)
            for key in related_keys or []:
                self._redis.expire(key, ttl_seconds)
        else:
            # 单机模式：使用 Pipeline
            pipe = self._redis.pipeline(transaction=True)
            pipe.expire(main_key, ttl_seconds)
            for key in related_keys or []:
                pipe.expire(key, ttl_seconds)
            pipe.execute()
```

### 7.4 移除 TTL（固定线程）

通过 `PERSIST` 命令移除 TTL，实现线程固定：

```python
def pin_thread(thread_id: str, checkpoint_id: str):
    checkpoint_key = f"checkpoint:{thread_id}:__empty__:{checkpoint_id}"
    saver._apply_ttl_to_keys(checkpoint_key, ttl_minutes=-1)
```

**实现：**

```python
if ttl_minutes == -1:
    # 移除 TTL，使键永久存在
    self._redis.persist(main_key)
    for key in related_keys or []:
        self._redis.persist(key)
```

## 第八章：集群与高可用

### 8.1 集群模式检测

项目自动检测 Redis 部署模式：

```python
def _detect_cluster_mode(self) -> bool:
    # 1. 检查客户端类型
    if isinstance(self._redis, RedisCluster):
        return True

    # 2. 检查 Redis 配置
    try:
        cluster_info = self._redis.cluster("info")
        return "cluster_enabled:1" in cluster_info
    except:
        return False
```

### 8.2 跨 Slot 操作优化

在 Redis Cluster 中，不同键可能分布在不同 slot，导致某些操作失败。

**问题：**

```python
# 这会失败（跨 slot）
pipe = redis_cluster.pipeline()
pipe.set("checkpoint:thread1:ns:id1", value1)
pipe.set("checkpoint:thread2:ns:id2", value2)
pipe.execute()  # CROSSSLOT error
```

**解决方案 1：Hash Tag**

强制键到同一 slot：

```python
key1 = "checkpoint:{thread1}:ns:id1"  # {thread1} 是 hash tag
key2 = "checkpoint:{thread1}:ns:id2"  # 同样使用 {thread1}
```

**解决方案 2：单键操作**

在集群模式下避免 Pipeline：

```python
if self.cluster_mode:
    # 逐个操作
    self._redis.expire(main_key, ttl_seconds)
    for key in related_keys:
        self._redis.expire(key, ttl_seconds)
else:
    # 使用 Pipeline
    pipe = self._redis.pipeline(transaction=True)
    pipe.expire(main_key, ttl_seconds)
    for key in related_keys:
        pipe.expire(key, ttl_seconds)
    pipe.execute()
```

### 8.3 连接池管理

项目支持自定义连接池配置：

```python
from redis.connection import ConnectionPool

pool = ConnectionPool(
    host="localhost",
    port=6379,
    max_connections=50,
    socket_keepalive=True,
    socket_keepalive_options={
        socket.TCP_KEEPIDLE: 60,
        socket.TCP_KEEPINTVL: 10,
        socket.TCP_KEEPCNT: 3,
    }
)

client = Redis(connection_pool=pool)
saver = RedisSaver(redis_client=client)
```

## 第九章：异步实现

### 9.1 异步架构

所有核心组件都提供异步版本，使用 `redis.asyncio`：

```python
from redis.asyncio import Redis as AsyncRedis
from langgraph.checkpoint.redis.aio import AsyncRedisSaver

async def main():
    async with AsyncRedisSaver.from_conn_string("redis://localhost:6379") as saver:
        await saver.asetup()
        await saver.aput(config, checkpoint, metadata, {})
```

### 9.2 异步中间件

中间件默认为异步优先（async-first），因为 LangChain 的 Agent 运行时是异步的：

```python
class AsyncRedisMiddleware(ABC):
    async def _setup_async(self) -> None:
        """异步初始化"""
        pass

    async def _ensure_initialized_async(self) -> None:
        """确保初始化（异步）"""
        if not self._initialized:
            async with self._init_lock:
                if not self._initialized:
                    await self._setup_async()
                    self._initialized = True
```

### 9.3 并发控制

使用 `asyncio.Semaphore` 限制并发：

```python
class AsyncRedisSaver:
    _write_semaphore: asyncio.Semaphore

    def __init__(self, max_concurrent_writes: int = 10):
        self._write_semaphore = asyncio.Semaphore(max_concurrent_writes)

    async def aput(self, ...):
        async with self._write_semaphore:
            # 限制并发写入
            await self._redis.json().set(key, "$", value)
```

### 9.4 异步迭代器

检查点列表支持异步迭代：

```python
async def alist(self, config: RunnableConfig) -> AsyncIterator[CheckpointTuple]:
    query = FilterQuery(...)
    results = await self.checkpoints_index.query(query)

    for result in results:
        checkpoint = self.serde.loads_typed(result["checkpoint"])
        yield CheckpointTuple(
            config=config,
            checkpoint=checkpoint,
            metadata=result["metadata"],
            parent_config=parent_config,
        )

# 使用
async for checkpoint in saver.alist(config):
    print(checkpoint.checkpoint["step"])
```

## 第十章：测试与质量保证

### 10.1 测试策略

项目遵循"集成测试优先"策略：

**测试类型：**
1. **集成测试**：使用真实 Redis 实例（通过 TestContainers）
2. **单元测试**：仅用于纯逻辑函数（如键解析、序列化）
3. **端到端测试**：完整的 LangGraph 工作流测试

### 10.2 TestContainers 使用

所有测试使用 TestContainers 自动管理 Redis 生命周期：

```python
import pytest
from testcontainers.redis import RedisContainer

@pytest.fixture(scope="module")
def redis_url():
    container = RedisContainer("redis:8")  # Redis 8 包含所有模块
    container.start()
    url = f"redis://{container.get_container_host_ip()}:{container.get_exposed_port(6379)}"
    yield url
    container.stop()
```

**禁止手动 Docker 操作：**

```python
# ❌ 错误：手动启动 Docker
subprocess.run(["docker", "run", "-d", "redis"])

# ✅ 正确：使用 TestContainers
container = RedisContainer("redis:8")
container.start()
```

### 10.3 覆盖率要求

项目使用严格的覆盖率标准：

```bash
make test-coverage       # 生成覆盖率报告
make coverage-html       # HTML 格式覆盖率
```

**覆盖率配置（pyproject.toml）：**

```toml
[tool.coverage.run]
source = ["langgraph"]
omit = ["*/tests/*", "*/examples/*"]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "if TYPE_CHECKING:",
]
```

### 10.4 测试文件组织

```
tests/
├── test_sync.py                        # 同步检查点测试
├── test_async.py                       # 异步检查点测试
├── test_cluster_mode.py                # 集群模式测试
├── test_checkpoint_ttl.py              # TTL 功能测试
├── test_store.py                       # Store 测试
├── test_middleware_semantic_cache.py   # 语义缓存中间件测试
├── test_middleware_tool_cache.py       # 工具缓存中间件测试
├── integration/
│   ├── test_middleware_end_to_end.py   # 端到端测试
│   └── test_notebook_exact_replica.py  # Notebook 场景复现
└── conftest.py                         # 共享 fixture
```

### 10.5 关键测试用例

**1. 跨 Slot 操作测试：**

```python
def test_cluster_cross_slot_handling(redis_cluster_url):
    saver = RedisSaver.from_conn_string(redis_cluster_url)
    saver.setup()

    # 不同线程的检查点（不同 slot）
    config1 = {"configurable": {"thread_id": "thread1"}}
    config2 = {"configurable": {"thread_id": "thread2"}}

    saver.put(config1, checkpoint1, {}, {})
    saver.put(config2, checkpoint2, {}, {})

    # 验证都能正确检索
    assert saver.get(config1) is not None
    assert saver.get(config2) is not None
```

**2. TTL 刷新测试：**

```python
def test_ttl_refresh_on_read(redis_url):
    ttl_config = {"default_ttl": 1, "refresh_on_read": True}
    saver = RedisSaver.from_conn_string(redis_url, ttl=ttl_config)
    saver.setup()

    config = {"configurable": {"thread_id": "test"}}
    saver.put(config, checkpoint, {}, {})

    time.sleep(30)  # 等待半个 TTL
    saver.get(config)  # 刷新 TTL

    time.sleep(40)  # 又等待 40 秒（总共 70 秒）
    # 由于刷新，检查点仍应存在
    assert saver.get(config) is not None
```

**3. 序列化往返测试：**

```python
def test_langchain_message_serialization(redis_url):
    from langchain_core.messages import AIMessage, ToolCall

    message = AIMessage(
        content="Hello",
        tool_calls=[
            ToolCall(id="1", name="search", args={"query": "test"})
        ]
    )

    saver = RedisSaver.from_conn_string(redis_url)
    serialized = saver.serde.dumps_typed(message)
    deserialized = saver.serde.loads_typed(serialized)

    assert deserialized.content == message.content
    assert deserialized.tool_calls[0].name == "search"
```

## 第十一章：部署与最佳实践

### 11.1 生产部署建议

**Redis 配置：**

```conf
# redis.conf
maxmemory 4gb
maxmemory-policy allkeys-lru  # LRU 淘汰（配合 TTL）

# 持久化
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec

# 连接
maxclients 10000
timeout 300
tcp-keepalive 60
```

**检查点配置推荐：**

```python
# 生产环境
saver = RedisSaver.from_conn_string(
    redis_url,
    ttl={"default_ttl": 1440, "refresh_on_read": True},  # 24 小时 TTL
    connection_args={
        "socket_keepalive": True,
        "socket_connect_timeout": 5,
        "socket_timeout": 5,
        "retry_on_timeout": True,
        "max_connections": 50,
    }
)
```

**中间件配置推荐：**

```python
semantic_cache = SemanticCacheMiddleware(
    SemanticCacheConfig(
        redis_url=redis_url,
        name="production_llm_cache",
        distance_threshold=0.1,       # 更严格的匹配
        ttl_seconds=7200,             # 2 小时缓存
        deterministic_tools=[...],
    )
)

tool_cache = ToolResultCacheMiddleware(
    ToolCacheConfig(
        redis_url=redis_url,
        name="production_tool_cache",
        ttl_seconds=3600,             # 1 小时缓存
    )
)
```

### 11.2 监控与日志

**启用 Redis 慢日志：**

```python
client.config_set("slowlog-log-slower-than", 10000)  # 10ms
client.config_set("slowlog-max-len", 128)

# 定期检查慢日志
slowlog = client.slowlog_get(10)
for entry in slowlog:
    logger.warning(f"Slow query: {entry}")
```

**性能指标监控：**

```python
import time

class MetricsRedisSaver(RedisSaver):
    def put(self, config, checkpoint, metadata, new_versions):
        start = time.time()
        result = super().put(config, checkpoint, metadata, new_versions)
        duration = time.time() - start

        metrics.histogram("checkpoint.put.duration", duration)
        metrics.incr("checkpoint.put.count")

        return result
```

### 11.3 容错与降级

**优雅降级示例：**

```python
class GracefulRedisSaver(RedisSaver):
    def get(self, config: RunnableConfig) -> Optional[CheckpointTuple]:
        try:
            return super().get(config)
        except redis.exceptions.RedisError as e:
            logger.error(f"Redis error in get: {e}")
            # 降级到内存检查点
            return self._memory_fallback.get(config)
        except Exception as e:
            logger.exception(f"Unexpected error in get: {e}")
            return None
```

**中间件降级：**

```python
config = SemanticCacheConfig(
    redis_url=redis_url,
    graceful_degradation=True,  # 启用优雅降级
)

middleware = SemanticCacheMiddleware(config)

# Redis 失败时自动跳过缓存，直接调用模型
```

### 11.4 性能优化

**1. 批量操作：**

```python
# 批量保存检查点
configs = [...]
checkpoints = [...]

with saver._redis.pipeline(transaction=False) as pipe:
    for config, checkpoint in zip(configs, checkpoints):
        key = saver._make_checkpoint_key(config)
        pipe.json().set(key, "$", checkpoint)
    pipe.execute()
```

**2. 键缓存：**

```python
# RedisSaver 内置键缓存
saver._key_cache_max_size = 10000  # 增加缓存大小
```

**3. 连接池调优：**

```python
from redis.connection import BlockingConnectionPool

pool = BlockingConnectionPool(
    host="localhost",
    port=6379,
    max_connections=100,
    timeout=20,  # 等待连接的最大时间
    socket_keepalive=True,
)
```

### 11.5 故障排查

**常见问题：**

1. **CROSSSLOT 错误：**
   - 原因：在 Redis Cluster 上使用了 Pipeline 的跨 slot 操作
   - 解决：确保 `cluster_mode` 检测正确，或使用 hash tag

2. **序列化失败：**
   - 原因：自定义对象未注册到 `JsonPlusRedisSerializer`
   - 解决：实现 `to_json()` 方法或注册自定义处理器

3. **TTL 未生效：**
   - 原因：TTL 配置未传递或 Redis 版本过旧
   - 解决：检查 `ttl_config` 参数，确保 Redis 2.6+

4. **内存溢出：**
   - 原因：TTL 配置不当或未启用淘汰策略
   - 解决：设置 `maxmemory-policy` 和合理的 TTL

**诊断工具：**

```python
# 检查 Redis 内存使用
info = client.info("memory")
print(f"Used memory: {info['used_memory_human']}")
print(f"Max memory: {info['maxmemory_human']}")

# 检查索引状态
index_info = client.ft("checkpoint").info()
print(f"Index docs: {index_info['num_docs']}")

# 检查键数量
checkpoint_keys = client.keys("checkpoint:*")
print(f"Total checkpoint keys: {len(checkpoint_keys)}")
```

### 11.6 Azure Redis 部署

**配置示例：**

```python
from redis import Redis

client = Redis(
    host="your-cache.redis.cache.windows.net",
    port=10000,  # Azure 企业版使用 10000
    password=os.environ["AZURE_REDIS_PASSWORD"],
    ssl=True,
    ssl_cert_reqs="required",
    decode_responses=False,
)

saver = RedisSaver(redis_client=client)
saver.setup()
```

**注意事项：**
- 必须使用标准 `Redis` 客户端（不是 `RedisCluster`）
- Azure 代理层隐藏了集群细节
- 确保在创建时选择了 RedisJSON 和 RediSearch 模块
- 使用 TLS/SSL 连接（端口 10000）

### 11.7 Docker Compose 部署

**docker-compose.yml：**

```yaml
version: '3.8'

services:
  redis:
    image: redis/redis-stack-server:latest
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    environment:
      - REDIS_ARGS=--save 60 1 --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  app:
    build: .
    depends_on:
      redis:
        condition: service_healthy
    environment:
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./app:/app

volumes:
  redis-data:
```

**应用启动：**

```python
import os
from langgraph.checkpoint.redis import RedisSaver

redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
saver = RedisSaver.from_conn_string(redis_url)
saver.setup()
```

---

## 总结

LangGraph-Redis 通过深度集成 Redis 的原生能力，为 LangGraph 提供了生产级的状态持久化和记忆管理解决方案。其核心优势包括：

1. **双实现策略**：同步/异步完整支持，适应不同场景
2. **索引驱动查询**：利用 RediSearch 实现高效的检查点检索
3. **语义缓存**：通过向量相似度匹配大幅降低 LLM 成本
4. **集群支持**：自动适配单机和集群模式，兼容云托管服务
5. **优雅降级**：Redis 失败时不影响核心功能

项目的架构设计充分考虑了生产环境的各种需求，包括性能、可靠性、可扩展性和可维护性，是 LangGraph 应用的理想持久化后端。
