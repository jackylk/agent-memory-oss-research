# LangGraph-Redis 云部署需求分析

## 第一节：存储基础设施需求

### 1.1 Redis 服务器要求

**版本要求：**
- **最低版本**：Redis 7.0（需手动安装 RedisJSON 和 RediSearch 模块）
- **推荐版本**：Redis 8.0+（内置 RedisJSON 和 RediSearch）
- **最佳选择**：Redis Stack Server（包含所有必需模块）

**云服务选项：**

| 云服务商 | 产品名称 | 模块支持 | 推荐等级 |
|---------|---------|---------|---------|
| AWS | Amazon ElastiCache for Redis | 需 Redis 7.2+ 企业版 | ⭐⭐⭐⭐ |
| Azure | Azure Cache for Redis Enterprise | 内置支持 | ⭐⭐⭐⭐⭐ |
| Google Cloud | Memorystore for Redis | 需手动配置 | ⭐⭐⭐ |
| Redis Cloud | Redis Enterprise Cloud | 完整支持 | ⭐⭐⭐⭐⭐ |
| 自建 | Docker / K8s + Redis Stack | 完整控制 | ⭐⭐⭐⭐ |

**关键模块验证：**

```bash
# 连接到 Redis 后执行
redis-cli
> MODULE LIST
1) 1) "name"
   2) "search"
   3) "ver"
   4) 20812
2) 1) "name"
   2) "ReJSON"
   3) "ver"
   4) 20607
```

如果未看到 `search` 和 `ReJSON`，则该 Redis 实例不兼容。

### 1.2 存储容量规划

**检查点存储估算：**

单个检查点的大小取决于状态复杂度：

```python
# 简单状态检查点：~2-5 KB
checkpoint = {
    "v": 1,
    "channel_values": {"messages": [...], "status": "running"},
    "channel_versions": {...},
    "versions_seen": {...},
}

# 复杂状态检查点：~50-200 KB
checkpoint = {
    "channel_values": {
        "messages": [50个消息对象],
        "documents": [10个文档],
        "tool_results": [20个工具结果],
    },
    ...
}
```

**容量计算公式：**

```
总存储 = (平均检查点大小 × 每线程检查点数 × 并发线程数) × 冗余系数

示例：
- 平均检查点大小：50 KB
- 每线程保留 20 个检查点
- 1000 个并发线程
- 冗余系数：1.5（考虑索引、元数据）

总存储 = 50 KB × 20 × 1000 × 1.5 = 1.5 GB
```

**Store 存储估算：**

```
Store 存储 = (平均 Item 大小 × Item 数量) + (向量维度 × 4 bytes × Item 数量)

示例（启用向量搜索）：
- 平均 Item：10 KB
- Item 数量：10,000
- 向量维度：1536（OpenAI ada-002）

数据存储 = 10 KB × 10,000 = 100 MB
向量存储 = 1536 × 4 bytes × 10,000 = 61.4 MB
总计 = 161.4 MB
```

**中间件缓存估算：**

```
缓存存储 = (平均响应大小 × 缓存条目数) × 2（向量 + 数据）

示例（语义缓存）：
- 平均响应：2 KB
- 缓存 10,000 条 LLM 响应
- 向量：1536 × 4 bytes = 6 KB

单条存储 = (2 KB + 6 KB) = 8 KB
总存储 = 8 KB × 10,000 = 80 MB
```

**推荐配置（按规模）：**

| 应用规模 | 并发用户 | Redis 内存 | 实例类型 |
|---------|---------|-----------|---------|
| 开发/测试 | < 10 | 512 MB | 单实例 |
| 小型应用 | 10-100 | 2 GB | 单实例 + AOF |
| 中型应用 | 100-1000 | 8 GB | 主从复制 |
| 大型应用 | 1000-10000 | 32 GB | Redis Cluster (3 主 + 3 从) |
| 企业级 | > 10000 | 128 GB+ | Redis Cluster + 分片优化 |

### 1.3 持久化策略

**RDB（快照）配置：**

```conf
# 推荐生产配置
save 900 1      # 15分钟内至少1次写入则保存
save 300 10     # 5分钟内至少10次写入则保存
save 60 10000   # 1分钟内至少10000次写入则保存

rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /data
```

**AOF（追加文件）配置：**

```conf
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec  # 推荐：每秒同步一次（性能与安全平衡）

# 自动重写
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
```

**推荐组合：**
- **开发环境**：仅 RDB（快速恢复，可容忍数据丢失）
- **生产环境**：RDB + AOF（双重保障，最小化数据丢失）
- **高可用环境**：主从复制 + RDB + AOF（零数据丢失）

### 1.4 TTL 与内存淘汰

**TTL 配置建议：**

```python
# 短期会话（聊天机器人）
ttl_config = {
    "default_ttl": 60,  # 1小时
    "refresh_on_read": True,
}

# 中期会话（工作流）
ttl_config = {
    "default_ttl": 1440,  # 24小时
    "refresh_on_read": True,
}

# 长期存储（用户记忆）
ttl_config = None  # 不设置 TTL，永久存储
```

**内存淘汰策略：**

```conf
maxmemory 4gb
maxmemory-policy allkeys-lru  # 推荐：LRU 淘汰所有键

# 其他选项：
# volatile-lru: 仅淘汰设置了 TTL 的键（适合混合场景）
# allkeys-lfu: LFU 算法（适合热点数据明显的场景）
# noeviction: 不淘汰（适合有严格 TTL 管理的场景）
```

**监控指标：**

```python
def check_memory_usage(redis_client):
    info = redis_client.info("memory")
    used = info["used_memory"]
    max_mem = info["maxmemory"]

    if max_mem > 0:
        usage_percent = (used / max_mem) * 100
        if usage_percent > 80:
            logger.warning(f"Memory usage high: {usage_percent:.2f}%")
```

## 第二节：计算资源需求

### 2.1 应用服务器规格

**CPU 需求：**

LangGraph-Redis 本身是 I/O 密集型，但需考虑：
- 序列化/反序列化开销（orjson）
- 向量化计算（如果使用语义缓存）
- LangGraph 图执行逻辑

**推荐配置：**

| 负载类型 | vCPU | 内存 | 说明 |
|---------|------|------|------|
| 轻量级（无向量） | 2 | 4 GB | 简单检查点，无中间件 |
| 标准型（基础中间件） | 4 | 8 GB | 语义缓存 + 工具缓存 |
| 计算型（重度向量） | 8 | 16 GB | 大量向量搜索，复杂图 |
| 高性能型 | 16+ | 32 GB+ | 企业级，高并发 |

### 2.2 向量化服务

如果使用语义缓存或向量搜索，需要 Embedding 模型服务。

**选项 1：托管 API**

- **OpenAI Embeddings**：`text-embedding-ada-002`（1536 维）
- **Cohere Embeddings**：`embed-english-v3.0`
- **Azure OpenAI**：企业级 SLA

**成本估算：**

```python
# OpenAI 定价（截至 2024）
# text-embedding-ada-002: $0.0001 / 1K tokens

# 示例：每天 10,000 个查询，平均 100 tokens
daily_tokens = 10000 * 100  # 1M tokens
monthly_cost = (daily_tokens * 30 / 1000) * 0.0001
# = $3 / 月
```

**选项 2：自托管模型**

- **sentence-transformers/all-MiniLM-L6-v2**：轻量级（384 维）
- **BAAI/bge-large-en-v1.5**：高质量（1024 维）
- **本地 Ollama**：完全离线

**自托管资源需求：**

```yaml
# Kubernetes 部署示例
apiVersion: apps/v1
kind: Deployment
metadata:
  name: embedding-service
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: embeddings
        image: sentence-transformers/all-MiniLM-L6-v2
        resources:
          requests:
            cpu: "2"
            memory: "4Gi"
          limits:
            cpu: "4"
            memory: "8Gi"
```

**GPU 需求：**

- **不需要 GPU**：sentence-transformers 的小模型在 CPU 上即可高效运行
- **可选 GPU**：如果使用大型模型（如 bge-large）或需要极低延迟

### 2.3 并发与扩展

**连接池配置：**

```python
from redis.connection import BlockingConnectionPool

pool = BlockingConnectionPool(
    host="redis-host",
    port=6379,
    max_connections=50,  # 根据并发量调整
    timeout=20,
    socket_keepalive=True,
)

# 每个应用实例的推荐连接数
# 公式：max_connections = 预期并发请求数 × 1.5

# 示例：
# - 预期 QPS：100
# - 平均响应时间：0.2s
# - 并发请求 = 100 × 0.2 = 20
# - 推荐连接数 = 20 × 1.5 = 30
```

**水平扩展：**

LangGraph-Redis 应用天然支持水平扩展（无状态）：

```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: langgraph-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: langgraph-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### 2.4 网络延迟考虑

**同区域部署：**

```
应用服务器 <---> Redis 实例
    |               |
  us-west-2a    us-west-2a  ✅ 延迟 < 1ms
```

**跨区域部署（不推荐）：**

```
应用服务器 <---> Redis 实例
    |               |
  us-west-2      us-east-1   ❌ 延迟 > 50ms
```

**延迟影响：**

```python
# 延迟对检查点操作的影响
# 假设每次检查点保存需要 3 次 Redis 调用

# 同区域（1ms 延迟）
total_latency = 3 × 1ms = 3ms  ✅ 可接受

# 跨区域（50ms 延迟）
total_latency = 3 × 50ms = 150ms  ❌ 明显延迟
```

**优化建议：**
- 使用读写分离（主从复制）将读请求路由到最近的从节点
- 启用 Redis 连接复用（connection pooling）
- 批量操作减少往返次数

## 第三节：高可用架构

### 3.1 主从复制

**配置示例（Redis Sentinel）：**

```conf
# 主节点配置
bind 0.0.0.0
port 6379
requirepass your-strong-password

# 从节点配置
replicaof <master-ip> 6379
masterauth your-strong-password
replica-read-only yes
```

**Sentinel 配置：**

```conf
# sentinel.conf
port 26379
sentinel monitor mymaster <master-ip> 6379 2
sentinel auth-pass mymaster your-strong-password
sentinel down-after-milliseconds mymaster 5000
sentinel parallel-syncs mymaster 1
sentinel failover-timeout mymaster 10000
```

**应用端配置：**

```python
from redis.sentinel import Sentinel

sentinel = Sentinel(
    [("sentinel1", 26379), ("sentinel2", 26379), ("sentinel3", 26379)],
    socket_timeout=0.1
)

# 自动发现主节点
master = sentinel.master_for("mymaster", socket_timeout=0.1)
saver = RedisSaver(redis_client=master)
```

### 3.2 Redis Cluster

**集群拓扑：**

```
          Cluster
         /   |    \
       /     |      \
   Master1 Master2 Master3
   (slot   (slot    (slot
   0-5460) 5461-   10923-
           10922)   16383)
      |       |        |
   Replica1 Replica2 Replica3
```

**部署配置：**

```bash
# 创建集群
redis-cli --cluster create \
  master1:6379 master2:6379 master3:6379 \
  replica1:6379 replica2:6379 replica3:6379 \
  --cluster-replicas 1
```

**应用配置：**

```python
from redis.cluster import RedisCluster

startup_nodes = [
    {"host": "master1", "port": 6379},
    {"host": "master2", "port": 6379},
    {"host": "master3", "port": 6379},
]

client = RedisCluster(
    startup_nodes=startup_nodes,
    decode_responses=False,
    skip_full_coverage_check=True,
)

saver = RedisSaver(redis_client=client)
saver.setup()
```

**注意事项：**
- 确保所有键使用一致的 hash tag（如 `{thread_id}`）以避免 CROSSSLOT 错误
- RedisSaver 会自动检测集群模式并适配操作逻辑

### 3.3 备份与恢复

**自动化备份脚本：**

```bash
#!/bin/bash
# backup-redis.sh

REDIS_HOST="localhost"
REDIS_PORT=6379
BACKUP_DIR="/backups/redis"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 触发 BGSAVE
redis-cli -h $REDIS_HOST -p $REDIS_PORT BGSAVE

# 等待保存完成
while [ $(redis-cli -h $REDIS_HOST -p $REDIS_PORT LASTSAVE) -eq $LASTSAVE ]; do
  sleep 1
done

# 复制 dump.rdb
cp /data/dump.rdb $BACKUP_DIR/dump_$TIMESTAMP.rdb

# 压缩
gzip $BACKUP_DIR/dump_$TIMESTAMP.rdb

# 清理旧备份（保留7天）
find $BACKUP_DIR -name "dump_*.rdb.gz" -mtime +7 -delete
```

**定时任务：**

```cron
# 每天凌晨3点备份
0 3 * * * /scripts/backup-redis.sh
```

**恢复流程：**

```bash
# 1. 停止 Redis
systemctl stop redis

# 2. 解压备份
gunzip /backups/redis/dump_20240115_030000.rdb.gz

# 3. 替换数据文件
cp /backups/redis/dump_20240115_030000.rdb /data/dump.rdb

# 4. 启动 Redis
systemctl start redis

# 5. 验证数据
redis-cli DBSIZE
```

### 3.4 灾难恢复

**跨区域复制：**

```python
# 主区域（us-west-2）
primary_client = Redis.from_url("redis://primary-host:6379")
primary_saver = RedisSaver(redis_client=primary_client)

# 灾备区域（us-east-1）
dr_client = Redis.from_url("redis://dr-host:6379")
dr_saver = RedisSaver(redis_client=dr_client)

# 异步复制（后台任务）
async def replicate_checkpoints():
    async for checkpoint in primary_saver.alist(config):
        await dr_saver.aput(
            checkpoint.config,
            checkpoint.checkpoint,
            checkpoint.metadata,
            {}
        )
```

**RPO/RTO 目标：**

| 架构 | RPO（数据丢失） | RTO（恢复时间） | 成本 |
|------|----------------|----------------|------|
| 单实例 + RDB | 15 分钟 | 5 分钟 | 低 |
| 主从 + AOF | < 1 秒 | 1 分钟 | 中 |
| Redis Cluster | < 1 秒 | 30 秒 | 高 |
| 跨区域复制 | < 5 秒 | 10 分钟 | 很高 |

## 第四节：网络与安全

### 4.1 网络隔离

**VPC 架构：**

```
┌─────────────────────────────────────────┐
│              VPC (10.0.0.0/16)          │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │   Public Subnet (10.0.1.0/24)    │  │
│  │   - Load Balancer                │  │
│  └───────────────┬───────────────────┘  │
│                  │                      │
│  ┌───────────────┴───────────────────┐  │
│  │  Private Subnet (10.0.2.0/24)    │  │
│  │  - LangGraph App Instances       │  │
│  └───────────────┬───────────────────┘  │
│                  │                      │
│  ┌───────────────┴───────────────────┐  │
│  │  Private Subnet (10.0.3.0/24)    │  │
│  │  - Redis Cluster (no public IP)  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**安全组规则：**

```yaml
# Redis 安全组
SecurityGroup:
  Ingress:
    - Port: 6379
      Protocol: TCP
      Source: 10.0.2.0/24  # 仅允许应用子网访问
  Egress:
    - Port: 0-65535
      Protocol: TCP
      Destination: 0.0.0.0/0
```

### 4.2 认证与授权

**密码认证：**

```conf
# redis.conf
requirepass your-very-strong-password-here

# 最佳实践：
# - 至少 32 字符
# - 使用密钥管理服务（如 AWS Secrets Manager）
```

**应用配置：**

```python
import os
from redis import Redis

redis_password = os.environ["REDIS_PASSWORD"]  # 从环境变量读取

client = Redis(
    host="redis-host",
    port=6379,
    password=redis_password,
    decode_responses=False,
)
```

**ACL（Redis 6.0+）：**

```redis
# 创建专用用户
ACL SETUSER langgraph_app on >strong_password \
  ~checkpoint:* ~checkpoint_blob:* ~checkpoint_write:* ~store:* ~store_vectors:* \
  +@all -@dangerous

# 应用连接
redis-cli --user langgraph_app --pass strong_password
```

### 4.3 TLS/SSL 加密

**启用 TLS：**

```conf
# redis.conf
port 0  # 禁用非加密端口
tls-port 6380
tls-cert-file /path/to/redis.crt
tls-key-file /path/to/redis.key
tls-ca-cert-file /path/to/ca.crt
tls-auth-clients optional
```

**应用配置：**

```python
client = Redis(
    host="redis-host",
    port=6380,
    password=redis_password,
    ssl=True,
    ssl_certfile="/path/to/client.crt",
    ssl_keyfile="/path/to/client.key",
    ssl_ca_certs="/path/to/ca.crt",
    ssl_cert_reqs="required",
)
```

**Azure Redis TLS：**

```python
# Azure 强制 TLS
client = Redis(
    host="your-cache.redis.cache.windows.net",
    port=10000,  # 企业版 TLS 端口
    password=azure_access_key,
    ssl=True,
    ssl_cert_reqs="required",
    decode_responses=False,
)
```

### 4.4 监控与审计

**启用慢日志：**

```conf
# 记录超过 10ms 的查询
slowlog-log-slower-than 10000
slowlog-max-len 128
```

**查看慢日志：**

```python
def monitor_slow_queries(redis_client):
    slowlog = redis_client.slowlog_get(10)
    for entry in slowlog:
        logger.warning(
            f"Slow query: {entry['command']} "
            f"took {entry['duration']}μs"
        )
```

**审计日志集成：**

```python
import logging

class AuditRedisSaver(RedisSaver):
    def put(self, config, checkpoint, metadata, new_versions):
        thread_id = config["configurable"]["thread_id"]
        logger.info(
            f"Checkpoint saved: thread={thread_id}, "
            f"user={current_user_id()}, "
            f"timestamp={datetime.utcnow().isoformat()}"
        )
        return super().put(config, checkpoint, metadata, new_versions)
```

## 第五节：监控与可观测性

### 5.1 关键指标

**Redis 指标：**

```python
def collect_redis_metrics(redis_client):
    info = redis_client.info()

    metrics = {
        # 内存
        "used_memory_mb": info["used_memory"] / 1024 / 1024,
        "memory_fragmentation_ratio": info["mem_fragmentation_ratio"],

        # 性能
        "instantaneous_ops_per_sec": info["instantaneous_ops_per_sec"],
        "total_commands_processed": info["total_commands_processed"],

        # 连接
        "connected_clients": info["connected_clients"],
        "rejected_connections": info.get("rejected_connections", 0),

        # 持久化
        "rdb_last_save_time": info["rdb_last_save_time"],
        "aof_enabled": info.get("aof_enabled", 0),

        # 复制
        "role": info["role"],
        "connected_slaves": info.get("connected_slaves", 0),
    }

    return metrics
```

**应用指标：**

```python
from prometheus_client import Counter, Histogram

checkpoint_save_count = Counter(
    "langgraph_checkpoint_saves_total",
    "Total checkpoint saves",
    ["thread_id"]
)

checkpoint_save_duration = Histogram(
    "langgraph_checkpoint_save_duration_seconds",
    "Checkpoint save duration",
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 5.0]
)

cache_hit_rate = Counter(
    "langgraph_cache_hits_total",
    "Cache hits",
    ["cache_type"]
)

class MetricsRedisSaver(RedisSaver):
    def put(self, config, checkpoint, metadata, new_versions):
        thread_id = config["configurable"]["thread_id"]
        with checkpoint_save_duration.time():
            result = super().put(config, checkpoint, metadata, new_versions)
        checkpoint_save_count.labels(thread_id=thread_id).inc()
        return result
```

### 5.2 告警规则

**Prometheus 告警配置：**

```yaml
groups:
  - name: langgraph_redis
    rules:
      # 内存使用率高
      - alert: RedisHighMemoryUsage
        expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redis memory usage above 80%"

      # 连接数过高
      - alert: RedisHighConnections
        expr: redis_connected_clients > 1000
        for: 5m
        labels:
          severity: warning

      # 慢查询增加
      - alert: RedisSlowQueries
        expr: rate(redis_slowlog_length[5m]) > 10
        for: 5m
        labels:
          severity: warning

      # 检查点保存失败率高
      - alert: HighCheckpointFailureRate
        expr: rate(langgraph_checkpoint_errors_total[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
```

### 5.3 日志聚合

**结构化日志：**

```python
import structlog

logger = structlog.get_logger()

class LoggingRedisSaver(RedisSaver):
    def put(self, config, checkpoint, metadata, new_versions):
        thread_id = config["configurable"]["thread_id"]
        checkpoint_id = get_checkpoint_id(checkpoint)

        logger.info(
            "checkpoint_save_start",
            thread_id=thread_id,
            checkpoint_id=checkpoint_id,
            step=checkpoint.get("step", 0),
        )

        try:
            result = super().put(config, checkpoint, metadata, new_versions)
            logger.info(
                "checkpoint_save_success",
                thread_id=thread_id,
                checkpoint_id=checkpoint_id,
            )
            return result
        except Exception as e:
            logger.error(
                "checkpoint_save_failed",
                thread_id=thread_id,
                checkpoint_id=checkpoint_id,
                error=str(e),
                exc_info=True,
            )
            raise
```

**ELK/Loki 集成：**

```yaml
# Fluentd 配置
<source>
  @type tail
  path /var/log/langgraph/*.log
  pos_file /var/log/td-agent/langgraph.log.pos
  tag langgraph
  <parse>
    @type json
  </parse>
</source>

<match langgraph>
  @type elasticsearch
  host elasticsearch-host
  port 9200
  index_name langgraph
  <buffer>
    flush_interval 5s
  </buffer>
</match>
```

### 5.4 分布式追踪

**OpenTelemetry 集成：**

```python
from opentelemetry import trace
from opentelemetry.instrumentation.redis import RedisInstrumentor

# 自动为 Redis 操作添加追踪
RedisInstrumentor().instrument()

tracer = trace.get_tracer(__name__)

class TracedRedisSaver(RedisSaver):
    def put(self, config, checkpoint, metadata, new_versions):
        with tracer.start_as_current_span("checkpoint_save") as span:
            thread_id = config["configurable"]["thread_id"]
            span.set_attribute("thread_id", thread_id)
            span.set_attribute("checkpoint_step", checkpoint.get("step", 0))

            result = super().put(config, checkpoint, metadata, new_versions)

            span.set_attribute("checkpoint_id", result["configurable"]["checkpoint_id"])
            return result
```

## 第六节：成本优化

### 6.1 存储成本优化

**策略 1：合理设置 TTL**

```python
# 按用途分类设置 TTL
short_term_config = {"default_ttl": 60}      # 1小时（临时会话）
medium_term_config = {"default_ttl": 1440}   # 24小时（日常工作流）
long_term_config = None                       # 永久（重要数据）

# 动态 TTL（根据重要性）
def adaptive_ttl_saver(importance: str):
    ttl_map = {
        "ephemeral": 30,
        "standard": 1440,
        "important": 10080,  # 7天
        "critical": None,     # 永久
    }
    return RedisSaver.from_conn_string(
        redis_url,
        ttl={"default_ttl": ttl_map[importance]}
    )
```

**策略 2：浅层检查点**

```python
# 对于不需要历史回溯的应用，使用 ShallowRedisSaver
# 仅保留最新检查点，节省 ~90% 存储

from langgraph.checkpoint.redis.shallow import ShallowRedisSaver

saver = ShallowRedisSaver.from_conn_string(redis_url)
```

**策略 3：压缩**

```python
import zlib
import base64

class CompressedRedisSaver(RedisSaver):
    def put(self, config, checkpoint, metadata, new_versions):
        # 压缩大对象
        for key, value in checkpoint["channel_values"].items():
            if len(str(value)) > 10000:  # 仅压缩大于 10KB 的数据
                compressed = zlib.compress(str(value).encode())
                checkpoint["channel_values"][key] = {
                    "_compressed": True,
                    "data": base64.b64encode(compressed).decode()
                }

        return super().put(config, checkpoint, metadata, new_versions)
```

### 6.2 计算成本优化

**策略 1：语义缓存降低 LLM 调用**

```python
# 示例：每天 10,000 次查询，缓存命中率 30%

# 无缓存成本
total_calls = 10000
cost_per_call = 0.002  # GPT-4o-mini
daily_cost_no_cache = total_calls * cost_per_call  # $20

# 有缓存成本
cache_hits = 10000 * 0.3
actual_calls = 10000 - cache_hits
daily_cost_with_cache = actual_calls * cost_per_call  # $14

# 节省：$6/天 = $180/月
```

**策略 2：工具缓存避免重复 API 调用**

```python
# 示例：天气查询工具，每次调用 $0.001

# 无缓存
daily_tool_calls = 5000
daily_cost = 5000 * 0.001  # $5

# 有缓存（命中率 50%）
actual_tool_calls = 5000 * 0.5
daily_cost_with_cache = actual_tool_calls * 0.001  # $2.5

# 节省：$2.5/天 = $75/月
```

**策略 3：自托管 Embedding 模型**

```python
# OpenAI Embeddings 成本
# 每月 100M tokens，$0.0001/1K tokens = $10/月

# 自托管（sentence-transformers）
# EC2 c5.xlarge: $0.17/小时 = ~$125/月
# 盈亏平衡点：1.25B tokens/月

# 如果月向量化量 > 1.25B tokens，自托管更划算
```

### 6.3 实例规模调优

**按需扩展：**

```yaml
# Kubernetes HPA 配置
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: langgraph-app
spec:
  minReplicas: 2   # 最低 2 个实例（高可用）
  maxReplicas: 20  # 峰值扩展到 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60  # CPU 60% 触发扩展
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300  # 5分钟稳定期（避免频繁缩容）
```

### 6.4 成本监控

**月度成本报告：**

```python
def generate_cost_report(month: str):
    # Redis 成本
    redis_instance_cost = 150  # 假设托管 Redis
    redis_data_transfer = 20

    # 计算成本
    app_instances = 5
    instance_cost_per_month = 80
    compute_cost = app_instances * instance_cost_per_month

    # LLM 成本
    total_llm_calls = 1_000_000
    cache_hit_rate = 0.3
    actual_llm_calls = total_llm_calls * (1 - cache_hit_rate)
    llm_cost = actual_llm_calls * 0.002

    # Embedding 成本（如使用 OpenAI）
    embedding_cost = 30

    # 总成本
    total = redis_instance_cost + redis_data_transfer + compute_cost + llm_cost + embedding_cost

    report = f"""
    月度成本报告 - {month}
    ====================
    Redis:       ${redis_instance_cost + redis_data_transfer}
    计算实例:    ${compute_cost}
    LLM 调用:    ${llm_cost} (命中率 {cache_hit_rate*100}%)
    Embeddings:  ${embedding_cost}
    ---
    总计:        ${total}

    优化建议：
    - 缓存命中率提升 10% 可节省 ${total_llm_calls * 0.1 * 0.002:.2f}
    - 使用浅层检查点可减少 Redis 存储 ~40%
    """
    return report
```

## 第七节：部署模式

### 7.1 单体部署（适用于小型应用）

**架构：**

```
┌──────────────────┐      ┌──────────────┐
│  LangGraph App   │◄────►│    Redis     │
│  (Single Inst)   │      │  (单实例)     │
└──────────────────┘      └──────────────┘
```

**Docker Compose 示例：**

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

  app:
    build: .
    ports:
      - "8000:8000"
    depends_on:
      - redis
    environment:
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}

volumes:
  redis-data:
```

### 7.2 微服务部署（适用于中型应用）

**架构：**

```
                    ┌──────────────┐
                    │ Load Balancer│
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼──────┐  ┌────────▼─────┐  ┌────────▼─────┐
│ App Instance │  │ App Instance │  │ App Instance │
│      1       │  │      2       │  │      3       │
└───────┬──────┘  └────────┬─────┘  └────────┬─────┘
        └──────────────────┼──────────────────┘
                           │
                    ┌──────▼───────┐
                    │ Redis Cluster│
                    │  (3主 + 3从) │
                    └──────────────┘
```

**Kubernetes 部署：**

```yaml
# langgraph-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: langgraph-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: langgraph
  template:
    metadata:
      labels:
        app: langgraph
    spec:
      containers:
      - name: app
        image: your-registry/langgraph-app:latest
        ports:
        - containerPort: 8000
        env:
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: url
        resources:
          requests:
            cpu: "1"
            memory: "2Gi"
          limits:
            cpu: "2"
            memory: "4Gi"
---
apiVersion: v1
kind: Service
metadata:
  name: langgraph-service
spec:
  type: LoadBalancer
  selector:
    app: langgraph
  ports:
  - port: 80
    targetPort: 8000
```

### 7.3 无服务器部署（适用于间歇负载）

**架构（AWS Lambda + ElastiCache）：**

```python
# lambda_handler.py
import os
from langgraph.checkpoint.redis import RedisSaver
from langchain_openai import ChatOpenAI

# 全局初始化（Lambda 复用）
redis_url = os.environ["REDIS_URL"]
saver = RedisSaver.from_conn_string(redis_url)
saver.setup()

model = ChatOpenAI(model="gpt-4o-mini")

def lambda_handler(event, context):
    thread_id = event["thread_id"]
    user_message = event["message"]

    config = {"configurable": {"thread_id": thread_id}}

    # 加载检查点
    checkpoint = saver.get(config)

    # 执行图逻辑
    # ...

    # 保存检查点
    saver.put(config, new_checkpoint, metadata, {})

    return {"statusCode": 200, "body": result}
```

**注意事项：**
- Lambda 函数必须在 VPC 内访问 ElastiCache
- 考虑 Lambda 冷启动对连接池的影响
- 使用 Provisioned Concurrency 减少冷启动

### 7.4 边缘部署（适用于低延迟需求）

**架构（Cloudflare Workers + Upstash Redis）：**

```typescript
// worker.ts
import { Redis } from '@upstash/redis/cloudflare'

export default {
  async fetch(request: Request, env: Env) {
    const redis = new Redis({
      url: env.UPSTASH_REDIS_URL,
      token: env.UPSTASH_REDIS_TOKEN,
    })

    // 从边缘位置访问 Redis
    const checkpoint = await redis.get(`checkpoint:${threadId}`)

    // 处理请求...

    return new Response(result)
  }
}
```

**优势：**
- 全球边缘节点，极低延迟
- 无需管理基础设施
- 按请求计费

**限制：**
- 不支持完整的 Redis 模块（需适配）
- 执行时间限制（通常 < 30s）

## 第八节：合规与安全

### 8.1 数据主权

**区域隔离部署：**

```python
# 根据用户所在地选择 Redis 实例
REDIS_REGIONS = {
    "US": "redis://us-west-2.redis.example.com:6379",
    "EU": "redis://eu-central-1.redis.example.com:6379",
    "APAC": "redis://ap-southeast-1.redis.example.com:6379",
}

def get_saver_for_user(user_region: str):
    redis_url = REDIS_REGIONS.get(user_region, REDIS_REGIONS["US"])
    return RedisSaver.from_conn_string(redis_url)
```

### 8.2 数据加密

**静态加密（at-rest）：**

- **AWS ElastiCache**：启用默认加密
- **Azure Cache for Redis**：自动加密
- **自建 Redis**：使用加密卷（如 dm-crypt）

**传输加密（in-transit）：**

```python
# 强制 TLS
client = Redis(
    host="redis-host",
    port=6380,
    ssl=True,
    ssl_cert_reqs="required",
    ssl_ca_certs="/path/to/ca.pem",
)
```

### 8.3 数据保留与清理

**自动清理策略：**

```python
def cleanup_old_checkpoints(redis_client, days_to_keep=30):
    """删除超过 N 天的检查点"""
    cutoff_timestamp = time.time() - (days_to_keep * 86400)

    # 使用 RediSearch 查询旧检查点
    query = FilterQuery(
        filter_expression=Num("checkpoint_ts") < cutoff_timestamp,
        return_fields=["thread_id", "checkpoint_ns", "checkpoint_id"],
    )

    results = checkpoints_index.query(query)

    for result in results:
        checkpoint_key = f"checkpoint:{result['thread_id']}:{result['checkpoint_ns']}:{result['checkpoint_id']}"
        redis_client.delete(checkpoint_key)
        logger.info(f"Deleted old checkpoint: {checkpoint_key}")
```

**用户删除请求（GDPR）：**

```python
def delete_user_data(user_id: str, redis_client):
    """删除用户所有数据（符合 GDPR 要求）"""
    # 查找该用户的所有线程
    threads = get_user_threads(user_id)

    for thread_id in threads:
        # 删除检查点
        checkpoints = checkpoints_index.query(
            FilterQuery(filter_expression=Tag("thread_id") == thread_id)
        )
        for cp in checkpoints:
            redis_client.delete(cp["key"])

        # 删除 Store 数据
        store_items = store_index.query(
            FilterQuery(filter_expression=Tag("prefix") == f"user:{user_id}")
        )
        for item in store_items:
            redis_client.delete(item["key"])

    logger.info(f"Deleted all data for user: {user_id}")
```

### 8.4 审计与合规报告

**审计日志记录：**

```python
class AuditLogger:
    def log_data_access(self, user_id, thread_id, operation, result):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "thread_id": thread_id,
            "operation": operation,
            "result": result,
            "ip_address": get_client_ip(),
        }
        # 发送到合规日志系统
        compliance_logger.info(json.dumps(log_entry))
```

**合规报告生成：**

```python
def generate_compliance_report(start_date, end_date):
    report = {
        "period": f"{start_date} to {end_date}",
        "total_data_access": count_data_access(),
        "total_data_deletions": count_deletions(),
        "encryption_status": "TLS 1.3 enabled",
        "backup_frequency": "Daily",
        "data_retention_policy": "30 days for checkpoints",
    }
    return report
```

## 第九节：迁移与升级

### 9.1 从内存检查点迁移

**迁移脚本：**

```python
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.redis import RedisSaver

def migrate_to_redis(memory_saver: MemorySaver, redis_url: str):
    redis_saver = RedisSaver.from_conn_string(redis_url)
    redis_saver.setup()

    # 遍历内存中的所有检查点
    for thread_id in memory_saver._checkpoints.keys():
        config = {"configurable": {"thread_id": thread_id}}

        for checkpoint_tuple in memory_saver.list(config):
            redis_saver.put(
                checkpoint_tuple.config,
                checkpoint_tuple.checkpoint,
                checkpoint_tuple.metadata,
                {}
            )

    logger.info("Migration to Redis completed")
```

### 9.2 Redis 版本升级

**从 Redis 6 升级到 Redis 8：**

1. **备份数据**

```bash
redis-cli BGSAVE
cp /data/dump.rdb /backup/dump_pre_upgrade.rdb
```

2. **升级 Redis 二进制**

```bash
# 停止旧版本
systemctl stop redis

# 安装新版本
apt-get update
apt-get install redis-server=8.0.0

# 启动新版本
systemctl start redis
```

3. **验证模块**

```bash
redis-cli MODULE LIST
# 确保 RedisJSON 和 RediSearch 存在
```

4. **重建索引（如果需要）**

```python
saver = RedisSaver.from_conn_string(redis_url)
saver.setup()  # 重新创建索引
```

### 9.3 零停机迁移

**蓝绿部署：**

```
┌──────────────┐      ┌──────────────┐
│  旧集群 (蓝)  │      │  新集群 (绿)  │
│  Redis 6.x   │      │  Redis 8.x   │
└──────┬───────┘      └──────┬───────┘
       │                     │
       │ 实时同步             │
       │◄───────────────────►│
       │                     │
┌──────▼───────────────────┐ │
│    应用流量切换           │ │
│  (逐步迁移到绿集群)       │◄┘
└──────────────────────────┘
```

**同步脚本：**

```python
import asyncio
from redis import Redis

async def sync_redis_instances(source_url, target_url):
    source = Redis.from_url(source_url)
    target = Redis.from_url(target_url)

    # 获取所有检查点键
    checkpoint_keys = source.keys("checkpoint:*")

    for key in checkpoint_keys:
        value = source.json().get(key)
        target.json().set(key, "$", value)
        logger.info(f"Synced key: {key}")

    logger.info(f"Synced {len(checkpoint_keys)} keys")
```

### 9.4 数据验证

**迁移后验证：**

```python
def validate_migration(source_url, target_url):
    source = RedisSaver.from_conn_string(source_url)
    target = RedisSaver.from_conn_string(target_url)

    # 验证检查点数量
    source_count = len(source._redis.keys("checkpoint:*"))
    target_count = len(target._redis.keys("checkpoint:*"))

    assert source_count == target_count, f"Key count mismatch: {source_count} vs {target_count}"

    # 抽样验证数据一致性
    sample_keys = random.sample(list(source._redis.keys("checkpoint:*")), min(100, source_count))

    for key in sample_keys:
        source_data = source._redis.json().get(key)
        target_data = target._redis.json().get(key)
        assert source_data == target_data, f"Data mismatch for key: {key}"

    logger.info("Migration validation passed")
```

## 第十节：故障排查与运维

### 10.1 常见问题诊断

**问题 1：CROSSSLOT 错误**

```python
# 错误信息
redis.exceptions.ResponseError: CROSSSLOT Keys in request don't hash to the same slot

# 诊断
def diagnose_crossslot(redis_client):
    if isinstance(redis_client, RedisCluster):
        logger.info("Cluster mode detected")
        # 检查键的 slot 分布
        keys = ["checkpoint:thread1:ns:id1", "checkpoint:thread2:ns:id2"]
        for key in keys:
            slot = redis_client.keyslot(key)
            logger.info(f"Key {key} -> slot {slot}")

# 解决方案：使用 hash tag
# 正确：checkpoint:{thread1}:ns:id1
# 错误：checkpoint:thread1:ns:id1
```

**问题 2：内存溢出**

```python
# 诊断
def diagnose_memory(redis_client):
    info = redis_client.info("memory")
    used = info["used_memory"]
    max_mem = info["maxmemory"]

    if max_mem > 0 and used / max_mem > 0.9:
        logger.error(f"Memory usage critical: {used}/{max_mem}")

        # 检查最大键
        sample_keys = redis_client.scan_iter("checkpoint:*", count=1000)
        for key in list(sample_keys)[:10]:
            size = redis_client.memory_usage(key)
            logger.info(f"Key {key}: {size} bytes")

# 解决方案：
# 1. 启用淘汰策略：maxmemory-policy allkeys-lru
# 2. 设置 TTL
# 3. 使用 ShallowRedisSaver
```

**问题 3：慢查询**

```python
# 诊断
def diagnose_slow_queries(redis_client):
    slowlog = redis_client.slowlog_get(10)
    for entry in slowlog:
        logger.warning(
            f"Slow: {entry['command']} "
            f"({entry['duration']}μs) "
            f"at {entry['start_time']}"
        )

# 解决方案：
# 1. 优化索引（检查 FT.SEARCH 查询）
# 2. 使用键注册表减少搜索
# 3. 增加 Redis 资源
```

### 10.2 性能调优

**连接池调优：**

```python
from redis.connection import ConnectionPool

# 调优前
pool = ConnectionPool(max_connections=10)  # 可能不足

# 调优后（根据负载）
expected_qps = 500
avg_latency = 0.01  # 10ms
concurrent_requests = expected_qps * avg_latency
pool = ConnectionPool(
    max_connections=int(concurrent_requests * 1.5),
    socket_keepalive=True,
    socket_connect_timeout=5,
)
```

**批量操作优化：**

```python
# 优化前（逐个操作）
for key in keys:
    redis_client.get(key)

# 优化后（Pipeline）
pipe = redis_client.pipeline(transaction=False)
for key in keys:
    pipe.get(key)
results = pipe.execute()
```

### 10.3 运维清单

**日常检查（每天）：**

- [ ] 检查 Redis 内存使用率（< 80%）
- [ ] 检查慢查询日志
- [ ] 检查连接数（< 最大连接数的 80%）
- [ ] 验证主从复制状态

**周度检查（每周）：**

- [ ] 审查备份完整性（测试恢复）
- [ ] 检查 TTL 策略有效性
- [ ] 分析缓存命中率
- [ ] 检查存储增长趋势

**月度检查（每月）：**

- [ ] 生成成本报告
- [ ] 检查安全补丁
- [ ] 审查告警规则
- [ ] 容量规划评估

**运维脚本：**

```python
def daily_health_check(redis_client):
    checks = {
        "memory_usage": lambda: redis_client.info("memory")["used_memory_human"],
        "connected_clients": lambda: redis_client.info("clients")["connected_clients"],
        "slowlog_len": lambda: redis_client.slowlog_len(),
        "rdb_last_save": lambda: redis_client.info("persistence")["rdb_last_save_time"],
    }

    report = []
    for check_name, check_fn in checks.items():
        try:
            result = check_fn()
            report.append(f"✓ {check_name}: {result}")
        except Exception as e:
            report.append(f"✗ {check_name}: {e}")

    return "\n".join(report)
```

### 10.4 灾难恢复演练

**演练清单：**

1. **模拟 Redis 主节点故障**

```bash
# 停止主节点
redis-cli -p 6379 DEBUG SLEEP 30

# 观察 Sentinel 是否自动切换
redis-cli -p 26379 SENTINEL get-master-addr-by-name mymaster
```

2. **模拟数据损坏**

```bash
# 删除测试线程的检查点
redis-cli --scan --pattern "checkpoint:test:*" | xargs redis-cli del

# 从备份恢复
./restore-from-backup.sh /backups/redis/dump_20240115.rdb.gz
```

3. **模拟网络分区**

```bash
# 使用 iptables 模拟网络延迟
sudo tc qdisc add dev eth0 root netem delay 100ms

# 观察应用行为
# 恢复网络
sudo tc qdisc del dev eth0 root
```

**演练报告模板：**

```
灾难恢复演练报告
==================
日期：2024-01-15
演练类型：主节点故障

结果：
- 检测时间：5 秒
- 切换时间：30 秒
- 数据丢失：0 条检查点
- 服务中断时间：35 秒

改进建议：
- 优化 Sentinel 配置以减少切换时间
- 增加监控告警
```

---

## 总结

LangGraph-Redis 的云部署需要综合考虑存储、计算、网络、安全等多个维度。关键要点：

1. **存储选择**：优先选择内置 RedisJSON/RediSearch 的托管服务（如 Redis Cloud、Azure Cache for Redis Enterprise）
2. **容量规划**：根据并发用户、检查点保留策略和向量搜索需求估算存储
3. **高可用**：生产环境必须使用主从复制或 Redis Cluster
4. **成本优化**：通过 TTL、语义缓存、浅层检查点等策略降低成本
5. **监控告警**：建立完善的监控体系，关注内存、性能、慢查询等指标
6. **安全合规**：启用 TLS、ACL、审计日志，满足数据主权要求

通过合理的架构设计和运维实践，LangGraph-Redis 可以稳定支撑从小型应用到企业级生产环境的各种场景。
