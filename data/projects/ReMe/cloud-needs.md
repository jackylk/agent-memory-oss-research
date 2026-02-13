# ReMe 云服务需求分析文档

## 目录
1. [计算资源需求](#1-计算资源需求)
2. [关系型数据库需求](#2-关系型数据库需求)
3. [向量数据库需求](#3-向量数据库需求)
4. [对象存储需求](#4-对象存储需求)
5. [AI/ML 服务集成](#5-aiml-服务集成)
6. [网络与负载均衡](#6-网络与负载均衡)
7. [监控告警与日志](#7-监控告警与日志)
8. [成本估算与优化](#8-成本估算与优化)
9. [部署架构建议](#9-部署架构建议)
10. [最佳实践与安全](#10-最佳实践与安全)

---

## 1. 计算资源需求

### 1.1 API 服务器配置

ReMe 提供 HTTP、MCP 和 Python 直接导入三种接口，需要计算资源来运行核心服务。

#### 不同规模的 CPU/内存配置：

**小规模部署（≤100 用户）**
- **CPU**: 2 核心（t3.medium/t2.small 或阿里云 ecs.c6.large）
- **内存**: 4GB RAM
- **磁盘**: 50GB SSD（存储本地向量索引和 SQLite 数据库）
- **推荐实例**:
  - AWS: t3.medium ($30/月)
  - 阿里云: ecs.c6.large ($15/月)
  - GCP: e2-medium ($25/月)

**中等规模部署（100-1000 用户）**
- **CPU**: 4 核心（t3.large 或阿里云 ecs.c7.xlarge）
- **内存**: 8GB RAM
- **磁盘**: 100GB SSD
- **推荐实例**:
  - AWS: t3.large ($50/月)
  - 阿里云: ecs.c7.xlarge ($40/月)
  - GCP: n2-standard-2 ($60/月)

**大规模部署（>1000 用户）**
- **CPU**: 8 核心或更多（c5.2xlarge 或阿里云 ecs.c7.2xlarge）
- **内存**: 16GB RAM
- **磁盘**: 200GB+ SSD
- **集群配置**: 3+ 节点负载均衡
- **推荐实例**:
  - AWS: c5.2xlarge x 3 ($360/月)
  - 阿里云: ecs.c7.2xlarge x 3 ($300/月)
  - GCP: n2-standard-8 x 3 ($450/月)

#### 内存使用分析：

ReMe 的内存消耗主要来自：

1. **Python 运行时**: ~200-300MB
2. **向量模型加载** (可选本地模型): ~2-4GB
3. **嵌入缓存**: ~100MB-1GB（取决于记忆量）
4. **向量索引**:
   - memory 模式: ~500MB-2GB（内存向量存储）
   - local 模式: ~100MB（SQLite）
5. **并发连接缓存**: ~50-100MB（并发 64 个连接）

#### 计算负载特性：

- **CPU 密集**: LLM API 调用处理（异步，不占用 CPU）
- **IO 密集**: 向量搜索、数据库查询
- **内存密集**: 向量索引、嵌入缓存
- **推荐**：异步处理，充分利用 IO 等待时间

#### 可选计算加速：

```yaml
# 如果使用本地嵌入模型（可选）
embedding_model:
  default:
    backend: openai_compatible
    # 或使用本地模型
    # backend: huggingface
    # model_name: "BAAI/bge-m3"
    # device: "cuda"  # 需要 GPU
    params:
      dimensions: 1024
```

**GPU 需求**：
- 仅在使用本地向量化模型时需要 GPU（可选）
- 推荐：NVIDIA A100/H100 或 T4（按需）
- 成本：GPU 实例额外 $50-200/月

---

## 2. 关系型数据库需求

### 2.1 SQLite 内置数据库

ReMe **默认使用 SQLite** 作为记忆索引存储，无需外部数据库。

#### SQLite 数据库结构：

```
$REME_WORKING_DIR/.reme/memory.db
├── files_{store_name}          # 文件元数据表
│   ├── path (TEXT PRIMARY KEY)
│   ├── source (TEXT)
│   ├── hash (TEXT)
│   ├── mtime (REAL)
│   └── size (INTEGER)
│
├── chunks_{store_name}         # 记忆块表
│   ├── id (TEXT PRIMARY KEY)
│   ├── path (TEXT)
│   ├── source (TEXT)
│   ├── start_line (INTEGER)
│   ├── end_line (INTEGER)
│   ├── hash (TEXT)
│   ├── text (TEXT)
│   ├── embedding (TEXT)
│   └── updated_at (INTEGER)
│
├── chunks_vec_{store_name}     # 向量索引表 (sqlite-vec)
│   ├── id (TEXT PRIMARY KEY)
│   └── embedding (FLOAT[1024])
│
└── chunks_fts_{store_name}     # 全文搜索表 (FTS5)
    ├── text (TEXT)
    ├── id (UNINDEXED)
    ├── path (UNINDEXED)
    └── tokenize='trigram'
```

#### SQLite 版本要求：

- **最低版本**: SQLite 3.31.0 (2020-02-17)
  - 支持 Common Table Expressions (CTE)
  - 支持 JSON1 扩展
- **推荐版本**: SQLite 3.44.0+ (最新稳定版)
  - sqlite-vec 向量搜索扩展
  - FTS5 全文搜索模块

#### 数据库大小估算：

| 记忆量 | 数据库大小 | 说明 |
|------|---------|------|
| 1000 条记忆 | 10MB | 小规模个人记忆 |
| 10000 条记忆 | 100MB | 中等规模任务记忆 |
| 100000 条记忆 | 1GB | 大规模企业应用 |
| 1000000 条记忆 | 10GB | 超大规模多用户系统 |

**公式**: 每条记忆 ≈ 10-50KB（取决于文本长度）

#### SQLite 优化配置：

```yaml
# reme_ai/config/default.yaml
database:
  # SQLite PRAGMA 优化
  journal_mode: "WAL"              # Write-Ahead Logging 提升并发性能
  synchronous: "NORMAL"             # 平衡性能与可靠性
  cache_size: -64000                # 64MB 页面缓存
  temp_store: "MEMORY"              # 临时表存储在内存

  # 向量索引优化
  vector_index:
    metric: "cosine"                # 余弦相似度
    dimension: 1024                 # 向量维度

  # FTS5 优化
  fts5:
    tokenize: "trigram"             # 三元组分词
    prefix_indexes: [2, 3]          # 前缀索引加速
```

### 2.2 可选：PostgreSQL 升级方案

对于大规模部署（>10GB 数据），可升级至 PostgreSQL。

#### PostgreSQL + pgvector 配置：

```yaml
# reme_ai/config/cloud.yaml
vector_store:
  default:
    backend: pgvector
    params:
      connection_string: "postgresql://user:password@db.example.com:5432/reme_db"
      min_pool_size: 5
      max_pool_size: 20

# pgvector 表结构
CREATE TABLE chunks (
    id TEXT PRIMARY KEY,
    path TEXT,
    source TEXT,
    text TEXT,
    embedding vector(1024),  -- pgvector 向量类型
    updated_at BIGINT,
    CONSTRAINT chunks_unique_id UNIQUE(id)
);

-- 创建向量索引
CREATE INDEX chunks_embedding_idx ON chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- 创建全文搜索索引
CREATE INDEX chunks_fts_idx ON chunks USING GIN (to_tsvector('english', text));
```

#### PostgreSQL 云服务选项：

| 服务商 | 产品 | 推荐配置 | 月成本 |
|------|------|--------|------|
| AWS | RDS PostgreSQL | db.r6i.large (8GB) | $200-300 |
| 阿里云 | RDS PostgreSQL | rds.pg.c6.xlarge | $150-200 |
| Azure | PostgreSQL Flexible | 标准版 B2s (2vCPU, 4GB) | $150 |
| 腾讯云 | CynosDB PostgreSQL | 1vCPU, 2GB | $100-150 |

#### PostgreSQL 优势：

✅ 支持多用户隔离（不同 workspace_id）
✅ 内置事务支持，数据一致性强
✅ pgvector 向量搜索性能优于 SQLite
✅ 支持备份恢复、主从复制
✅ 支持自动扩展（分片）

#### PostgreSQL 劣势：

❌ 额外运维成本
❌ 不适合单机小规模部署
❌ 需要网络往返（延迟增加）

---

## 3. 向量数据库需求

### 3.1 向量数据库选型矩阵

ReMe 支持 5 种向量数据库后端，选择应基于规模和功能需求。

#### 向量数据库对比表：

| 特性 | Local (SQLite) | Elasticsearch | ChromaDB | Qdrant | PostgreSQL |
|-----|---|---|---|---|---|
| **部署方式** | 内置 | 自建/云服务 | 开源/云服务 | 开源/云服务 | RDS 服务 |
| **设置难度** | 最简单 | 中等 | 简单 | 简单 | 简单 |
| **存储容量** | ≤100GB | 无限 | 无限 | 无限 | 无限 |
| **并发支持** | 低 (<10) | 高 (>100) | 中 (20-50) | 高 (>100) | 高 (>100) |
| **向量维度** | 256-3072 | 256-4096 | 可配置 | 可配置 | 可配置 |
| **搜索延迟** | <10ms | 50-200ms | 20-100ms | 20-100ms | 50-200ms |
| **成本** | $0 | $100-500/月 | $0-200/月 | $0-300/月 | $200-500/月 |
| **云服务** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **多租户** | ❌ | ✓ | ❌ | ✓ | ✓ |
| **备份恢复** | ❌ | ✓ | ✓ | ✓ | ✓ |
| **集群支持** | ❌ | ✓ | ❌ | ✓ | ✓ |
| **内存占用** | 中 | 高 | 中 | 低 | 低 |

### 3.2 向量数据库选择指南

#### 小规模（<100 用户，<100GB 数据）
**推荐**: Local (SQLite) + 可选升级到 Qdrant

```yaml
# 最简单配置 - 零成本
vector_store:
  default:
    backend: local  # 基于 sqlite-vec
    params:
      store_dir: ".reme/vector_store"
      embedding_dim: 1024
```

**优势**:
- 零成本，开箱即用
- 无需额外基础设施
- 嵌入式部署，延迟最低
- 适合个人和小团队

#### 中等规模（100-1000 用户，100GB-1TB 数据）
**推荐**: Qdrant 或 Elasticsearch

```yaml
# Qdrant 配置（推荐）
vector_store:
  default:
    backend: qdrant
    params:
      host: "qdrant.example.com"
      port: 6333
      api_key: "${QDRANT_API_KEY}"
      prefer_grpc: true  # gRPC 更高效
      timeout: 30
      collection_name: "reme_memory"
```

```yaml
# Elasticsearch 配置（备选）
vector_store:
  default:
    backend: elasticsearch
    params:
      hosts: ["https://es.example.com:9200"]
      api_key: "${ES_API_KEY}"
      number_of_shards: 3
      number_of_replicas: 1
      refresh_interval: "30s"
      max_result_window: 50000
```

**Qdrant 优势**:
- 向量专用数据库，性能最优
- 低内存占用
- 支持多种相似度指标（余弦、欧几里得、曼哈顿）
- 完善的云服务（Qdrant Cloud）

**Elasticsearch 优势**:
- 混合搜索（向量 + 关键词）
- 更强大的过滤和聚合能力
- 更好的可观测性和监控

#### 大规模（>1000 用户，>1TB 数据）
**推荐**: Qdrant Cloud 或 Elasticsearch Cloud

```yaml
# Qdrant Cloud（推荐）
vector_store:
  default:
    backend: qdrant
    params:
      url: "https://xxxx-qdrant.ts.zillizcloud.com"
      api_key: "${QDRANT_API_KEY}"
      collection_name: "reme_memory_prod"
```

**云服务成本对比**:

| 服务 | 配置 | 月成本 | 存储容量 |
|-----|------|------|--------|
| Qdrant 免费版 | 自建，1GB | $0 | 1GB |
| Qdrant 标准版 | 托管，10GB | $50-100 | 10GB |
| Qdrant 企业版 | 托管集群 | $500+ | 无限 |
| Elasticsearch Serverless | 按量计费 | $50-200 | 无限 |
| Elasticsearch Dedicated | 专用集群 | $200-500 | 无限 |

### 3.3 向量嵌入配置

ReMe 支持多种嵌入模型，向量维度影响存储和性能。

#### 嵌入模型选择：

```yaml
embedding_model:
  default:
    backend: openai_compatible

    # 选项 1: OpenAI
    model_name: text-embedding-3-small  # 512-dim
    # 或
    model_name: text-embedding-3-large  # 3072-dim

    # 选项 2: 阿里通义
    model_name: text-embedding-v3
    params:
      api_base: https://dashscope.aliyuncs.com/api/v1

    # 选项 3: 其他兼容 API
    base_url: "https://api.example.com/v1"
    api_key: "${EMBEDDING_API_KEY}"

    params:
      dimensions: 1024  # 可配置维度
      encoding_format: "float"
```

#### 向量维度与性能：

| 维度 | 存储/向量 | 搜索速度 | 精度 | API 成本 | 适用场景 |
|-----|---------|-------|------|--------|--------|
| 256 | 1KB | 最快 | 低 | $0.02/M | 快速检索，低精度 |
| 512 | 2KB | 快 | 中 | $0.04/M | 平衡方案 |
| 768 | 3KB | 中 | 中高 | $0.05/M | 推荐（通用） |
| 1024 | 4KB | 中 | 高 | $0.08/M | 精准搜索 |
| 3072 | 12KB | 慢 | 最高 | $0.13/M | 超精准，成本高 |

**推荐**: 使用 768 或 1024 维度，平衡精度和成本。

### 3.4 向量数据库性能调优

```yaml
# Qdrant 优化配置
vector_store:
  default:
    backend: qdrant
    params:
      # 搜索参数
      search_params:
        hnsw_config:
          m: 16              # HNSW M 参数（索引复杂度）
          ef_construct: 200  # 构建效率因子
          ef: 256            # 搜索效率因子

      # 内存优化
      quantization:
        enabled: true       # 启用量化压缩
        scalar_type: float32  # 32-bit 浮点数

      # 批量操作
      batch_size: 1000    # 批量上传向量大小
```

---

## 4. 对象存储需求

### 4.1 存储场景分析

ReMe 使用对象存储主要用于：

1. **工作记忆外部化** - 长文本工具输出存储
2. **用户配置文件** - 个人偏好数据存储
3. **模型检查点** - 本地嵌入模型权重（可选）

### 4.2 存储需求估算

#### 小规模场景（<100 用户）
```
工作记忆输出: 1GB/月
用户配置: 100MB
总计: ~5GB 存储，月度成本 $0.1-0.5
推荐: 本地文件系统或免费 OSS 层
```

#### 中等规模（100-1000 用户）
```
工作记忆输出: 50GB/月
用户配置: 10GB
备份副本: 1 份
总计: ~100GB 存储，月度成本 $1-5
推荐: 云 OSS 服务（如 AWS S3）
```

#### 大规模（>1000 用户）
```
工作记忆输出: 500GB+/月
用户配置: 100GB+
备份副本: 3+ 份（跨区域）
总计: 1TB+ 存储，月度成本 $50-200
推荐: 多区域 OSS 或 CDN 存储
```

### 4.3 对象存储服务对比

| 服务 | API | 存储成本 | 流量成本 | 推荐场景 |
|-----|-----|--------|--------|--------|
| AWS S3 | REST/SDK | $0.023/GB | $0.09/GB | 大规模，多功能 |
| 阿里云 OSS | REST/SDK | $0.0117/GB | $0.084/GB | 中国用户，成本优 |
| 腾讯云 COS | REST/SDK | $0.01/GB | $0.08/GB | 中国用户，可靠性 |
| Azure Blob | REST/SDK | $0.018/GB | $0.12/GB | 企业级 |
| MinIO | S3 兼容 | $0（自建） | $0 | 私有部署 |

### 4.4 部署配置示例

#### 本地文件系统（默认）
```yaml
# reme_ai/config/default.yaml
storage:
  type: local
  base_path: ".reme/storage"
  max_file_size: 104857600  # 100MB
```

#### AWS S3 集成
```yaml
storage:
  type: s3
  params:
    bucket: "reme-working-memory"
    region: "us-east-1"
    access_key: "${AWS_ACCESS_KEY_ID}"
    secret_key: "${AWS_SECRET_ACCESS_KEY}"
    prefix: "production/"
```

#### 阿里云 OSS 集成
```yaml
storage:
  type: oss
  params:
    bucket: "reme-memory"
    region: "oss-cn-beijing"
    access_key_id: "${ALIBABA_ACCESS_KEY_ID}"
    access_key_secret: "${ALIBABA_ACCESS_KEY_SECRET}"
    prefix: "prod/"
```

### 4.5 工作记忆压缩策略

为了最小化存储成本，ReMe 提供自动压缩：

```yaml
working_memory:
  # 自动压缩长上下文
  auto_compression: true
  compression_ratio: 0.75  # 压缩比例
  max_messages: 1000      # 最多保留消息数

  # 归档策略
  archive_policy:
    enabled: true
    archive_after_days: 30    # 30 天后归档到 OSS
    delete_after_days: 90     # 90 天后删除

  # 存储分级
  storage_tier:
    hot: 7        # 7 天热存储（内存/本地）
    warm: 30      # 30 天温存储（SSD）
    cold: 365     # 365 天冷存储（OSS）
```

---

## 5. AI/ML 服务集成

### 5.1 LLM API 配置

ReMe **必须配置外部 LLM 服务**来进行记忆提取、总结和检索。

#### 支持的 LLM 提供商：

1. **OpenAI API**
```yaml
llm:
  default:
    backend: openai_compatible
    model_name: gpt-4o-mini  # 或 gpt-4, gpt-3.5-turbo
    params:
      api_key: "${OPENAI_API_KEY}"
      api_base: "https://api.openai.com/v1"
      temperature: 0.6
      max_tokens: 4096
      timeout: 30
```

2. **阿里通义千问**
```yaml
llm:
  default:
    backend: openai_compatible
    model_name: qwen3-30b-a3b-instruct-2507
    params:
      api_key: "${DASHSCOPE_API_KEY}"
      api_base: "https://dashscope.aliyuncs.com/api/v1"
      temperature: 0.6
```

3. **Anthropic Claude（通过 OpenAI 兼容 API）**
```yaml
llm:
  default:
    backend: openai_compatible
    model_name: claude-opus-4.6
    params:
      api_key: "${ANTHROPIC_API_KEY}"
      api_base: "https://api.anthropic.com/v1"
```

4. **其他兼容 OpenAI 的服务**
```yaml
llm:
  default:
    backend: openai_compatible
    model_name: "custom-model"
    params:
      api_base: "https://your-llm-api.com/v1"
      api_key: "${CUSTOM_API_KEY}"
```

### 5.2 Token 消耗分析

ReMe 中不同操作的 Token 消耗：

#### Token 消耗表：

| 操作 | 输入 Token | 输出 Token | 每次成本（Qwen3） | 月均调用 |
|-----|---------|---------|------------|--------|
| 个人记忆总结 | 500-1000 | 200-500 | $0.001-0.003 | 1000x |
| 任务记忆提取 | 1000-3000 | 500-1000 | $0.003-0.008 | 500x |
| 工具记忆生成 | 300-800 | 200-500 | $0.001-0.002 | 2000x |
| 记忆检索 (重排序) | 200-600 | 100-300 | $0.0005-0.002 | 5000x |
| 工作记忆压缩 | 2000-5000 | 500-1500 | $0.005-0.012 | 100x |

#### 月度成本估算（使用 Qwen3-30B）：

```
每月 Token 消耗 = (个人记忆总结 × 1000 × 1500 tokens)
                 + (任务记忆提取 × 500 × 4000 tokens)
                 + (工具记忆生成 × 2000 × 1000 tokens)
                 + (记忆检索 × 5000 × 400 tokens)
                 + (工作记忆压缩 × 100 × 7500 tokens)

小规模 (100 用户): 50M tokens/月 ≈ $25/月
中规模 (1000 用户): 500M tokens/月 ≈ $250/月
大规模 (10000 用户): 5B tokens/月 ≈ $2500/月
```

### 5.3 嵌入模型配置

用于生成向量嵌入，是向量搜索的基础。

#### 嵌入 API 提供商对比：

| 提供商 | 模型 | 维度 | 成本 | 推荐 |
|------|------|------|------|------|
| OpenAI | text-embedding-3-small | 512 | $0.02/M | ✓ |
| OpenAI | text-embedding-3-large | 3072 | $0.13/M | 精准搜索 |
| 阿里通义 | text-embedding-v3 | 1024 | $0.05/M | ✓ 国内 |
| Cohere | embed-v3 | 1024 | $0.10/M | 高精度 |
| HuggingFace | bge-m3 (本地) | 1024 | $0 | 自建 |
| Jina | jina-embeddings | 768 | $0.08/M | 多语言 |

### 5.4 成本优化策略

#### 1. 嵌入缓存
```python
# 避免重复嵌入
embedding_cache = {}

async def get_embedding(text: str):
    cache_key = hashlib.sha256(text.encode()).hexdigest()
    if cache_key not in embedding_cache:
        embedding_cache[cache_key] = await embedding_api.embed(text)
    return embedding_cache[cache_key]
```

#### 2. 批量处理
```yaml
# 批量生成嵌入，减少 API 调用次数
batch_size: 100  # 每批 100 条文本
max_tokens_per_batch: 10000
```

#### 3. 模型选择
- 使用性价比最高的模型（Qwen3 vs GPT-4）
- 对于实时性要求不高的任务，使用更便宜的模型（如 GPT-3.5）
- 为不同任务配置不同模型

```yaml
llm:
  summarizer:  # 总结任务用便宜模型
    model_name: gpt-3.5-turbo
  ranker:      # 重排任务用精准模型
    model_name: gpt-4o-mini
  retriever:   # 检索用快速模型
    model_name: qwen3-8b-instruct
```

---

## 6. 网络与负载均衡

### 6.1 网络架构

ReMe 提供多种接口，需要合理配置网络。

#### 部署拓扑图：

```
┌─────────────┐
│   客户端    │
├─────────────┤
│ HTTP/gRPC   │
└──────┬──────┘
       │
   ┌───▼──────────────────────┐
   │   负载均衡 (ALB/NLB)     │
   └───┬──────────────────────┘
       │
   ┌───┴─────────┬──────────┬──────────┐
   │             │          │          │
┌──▼──┐  ┌──────▼──┐  ┌───▼──┐  ┌───▼──┐
│ReMe │  │  ReMe   │  │ReMe  │  │ReMe  │
│ #1  │  │  #2     │  │  #3  │  │  #N  │
└──┬──┘  └──┬──────┘  └───┬──┘  └───┬──┘
   │        │             │        │
   └────┬───┴──────┬──────┴───┬────┘
        │          │          │
    ┌───▼──┐  ┌──▼──┐   ┌──▼───┐
    │Redis │  │ES   │   │Qdrant│
    │缓存  │  │向量 │   │向量  │
    └──────┘  └─────┘   └──────┘
```

### 6.2 负载均衡配置

#### AWS ALB 配置示例：

```yaml
# 健康检查
health_check:
  path: /health
  interval: 30
  timeout: 5
  healthy_threshold: 2
  unhealthy_threshold: 3

# 监听器
listeners:
  - protocol: HTTPS
    port: 443
    target_group: reme-prod
    certificates:
      - arn:aws:acm:...

# 目标组
target_groups:
  - name: reme-prod
    protocol: HTTP
    port: 8002
    health_check:
      path: /health
      matcher: "200"
    stickiness: # 会话粘性
      enabled: true
      duration: 86400
```

#### Kubernetes Ingress 配置：

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: reme-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.reme.example.com
      secretName: reme-tls
  rules:
    - host: api.reme.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: reme-service
                port:
                  number: 8002
```

### 6.3 多可用区部署

为了高可用性，推荐跨多个可用区部署：

```yaml
# Terraform 配置示例
resource "aws_ecs_service" "reme" {
  name            = "reme-service"
  cluster         = aws_ecs_cluster.prod.id
  task_definition = aws_ecs_task_definition.reme.arn
  desired_count   = 3  # 3 个副本

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 100  # 滚动更新
  }

  network_configuration {
    subnets          = [aws_subnet.az1.id, aws_subnet.az2.id, aws_subnet.az3.id]
    security_groups  = [aws_security_group.reme.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.reme.arn
    container_name   = "reme"
    container_port   = 8002
  }
}
```

### 6.4 地理分布式部署

对于全球用户，推荐使用 CDN 和区域节点：

```yaml
# 主区域（欧美）
regions:
  us-east-1:
    replicas: 3
    llm_provider: openai
    embedding_provider: openai
    vector_db: qdrant-cloud-us

  eu-west-1:
    replicas: 3
    llm_provider: openai
    embedding_provider: openai
    vector_db: qdrant-cloud-eu

# 亚太区域
  ap-southeast-1:  # 新加坡
    replicas: 2
    llm_provider: qwen  # 阿里通义
    embedding_provider: aliyun
    vector_db: qdrant-cloud-sg

  ap-northeast-1:  # 日本
    replicas: 2
    llm_provider: openai
    embedding_provider: openai
    vector_db: qdrant-cloud-jp

# 中国区域
  cn-beijing:
    replicas: 3
    llm_provider: qwen
    embedding_provider: aliyun
    vector_db: aliyun-oss
    is_isolated: true  # 符合法规要求
```

---

## 7. 监控告警与日志

### 7.1 关键监控指标

#### 应用层指标：

```yaml
metrics:
  # API 性能
  api_request_latency:
    - endpoint: /retrieve
      p50: 100ms
      p95: 500ms
      p99: 1000ms
    - endpoint: /summary
      p50: 200ms
      p95: 800ms
      p99: 2000ms

  api_request_count:
    total: counter
    by_endpoint: by_operation
    by_status_code: histogram

  api_error_rate:
    threshold: 0.01  # 1% 告警
    track_by: endpoint, status_code

  # 缓存统计
  cache_hit_rate:
    embedding_cache: >80%
    query_cache: >70%

  # Token 消耗
  token_consumption:
    total_per_day: metric
    by_operation: breakdown
    cost_per_day: calculated
```

#### 存储层指标：

```yaml
storage_metrics:
  # 向量数据库
  vector_db_latency:
    search_p95: 100ms
    insert_p95: 50ms
    delete_p95: 30ms

  vector_db_throughput:
    queries_per_second: metric
    inserts_per_second: metric

  # SQLite 数据库
  sqlite_performance:
    query_latency_p95: 10ms
    write_latency_p95: 5ms
    database_size: gauge

  # 对象存储
  s3_operations:
    upload_latency_p95: 500ms
    download_latency_p95: 200ms
    storage_usage_gb: gauge
```

#### 系统资源指标：

```yaml
system_metrics:
  cpu:
    usage_percent: gauge
    cores_available: gauge

  memory:
    usage_percent: gauge
    available_gb: gauge
    vector_cache_mb: gauge

  disk:
    usage_percent: gauge
    iops: counter
    throughput_mb_s: gauge

  network:
    inbound_mbps: gauge
    outbound_mbps: gauge
    error_rate: gauge
```

### 7.2 告警规则配置

```yaml
# Prometheus 告警规则
groups:
  - name: reme_alerts
    interval: 30s
    rules:
      # API 性能告警
      - alert: HighAPILatency
        expr: histogram_quantile(0.95, api_request_latency) > 1000
        for: 5m
        annotations:
          summary: "API 响应延迟高"
          description: "p95 延迟 {{ $value }}ms，阈值 1000ms"

      # 错误率告警
      - alert: HighErrorRate
        expr: rate(api_errors[5m]) > 0.01
        for: 5m
        annotations:
          summary: "API 错误率高"

      # Token 消耗告警
      - alert: HighTokenConsumption
        expr: increase(token_consumption_total[1h]) > 1000000
        for: 10m
        annotations:
          summary: "Token 消耗异常高"
          description: "1 小时消耗 {{ $value }} tokens"

      # 资源告警
      - alert: HighMemoryUsage
        expr: memory_usage_percent > 90
        for: 5m
        annotations:
          summary: "内存使用率过高"

      - alert: HighCPUUsage
        expr: cpu_usage_percent > 90
        for: 10m
        annotations:
          summary: "CPU 使用率过高"

      # 存储容量告警
      - alert: DiskSpaceRunningOut
        expr: disk_usage_percent > 85
        for: 1h
        annotations:
          summary: "磁盘容量即将满"

      # 向量数据库告警
      - alert: VectorDBHighLatency
        expr: vector_db_search_latency_p95 > 500
        for: 5m
        annotations:
          summary: "向量数据库查询延迟高"
```

### 7.3 日志聚合配置

#### 使用 ELK Stack（自建）：

```yaml
# Filebeat 配置
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /var/log/reme/*.log
    json.message_key: message
    json.keys_under_root: true
    json.add_error_key: true

output.elasticsearch:
  hosts: ["elasticsearch.example.com:9200"]
  index: "reme-%{+yyyy.MM.dd}"

  # 日志保留策略
  ilm.enabled: true
  ilm.policy_name: "reme-logs"
  ilm.rollover_alias: "reme-logs"
  ilm.pattern: "{now/d}-000001"
```

```yaml
# Elasticsearch ILM 策略
PUT _ilm/policy/reme-logs
{
  "policy": "reme-logs",
  "phases": {
    "hot": {
      "min_age": "0d",
      "actions": {
        "rollover": {
          "max_size": "50GB",
          "max_age": "1d"
        }
      }
    },
    "warm": {
      "min_age": "7d",
      "actions": {
        "set_priority": {
          "priority": 50
        }
      }
    },
    "cold": {
      "min_age": "30d",
      "actions": {
        "set_priority": {
          "priority": 0
        }
      }
    },
    "delete": {
      "min_age": "90d",
      "actions": {
        "delete": {}
      }
    }
  }
}
```

#### 使用云日志服务：

```yaml
# 阿里云日志服务（SLS）配置
logging:
  provider: aliyun_sls
  project: reme-prod
  logstore: reme-app-logs
  region: cn-beijing

  # 日志上传配置
  batch_size: 1000
  flush_interval_seconds: 5

  # 日志采样
  sample_rate: 0.1  # 采样 10%

  # 日志脱敏
  fields_to_mask:
    - api_key
    - password
    - user_email
    - credit_card
```

#### 日志格式规范：

```json
{
  "timestamp": "2026-02-12T10:30:45Z",
  "level": "INFO",
  "logger": "reme.retrieve",
  "message": "Memory retrieved successfully",
  "operation": "retrieve_task_memory",
  "workspace_id": "ws_123",
  "duration_ms": 245,
  "token_consumed": 450,
  "vector_db": "qdrant",
  "status": "success",
  "trace_id": "trace_abc123"
}
```

### 7.4 仪表板配置

#### Grafana 仪表板示例：

```json
{
  "dashboard": {
    "title": "ReMe Production Dashboard",
    "panels": [
      {
        "title": "API 请求速率",
        "targets": [
          {
            "expr": "rate(api_requests_total[5m])"
          }
        ],
        "unit": "reqps"
      },
      {
        "title": "API 延迟分布",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, api_latency)"
          }
        ],
        "thresholds": [100, 500, 1000]
      },
      {
        "title": "错误率",
        "targets": [
          {
            "expr": "rate(api_errors[5m])"
          }
        ],
        "alertThreshold": 0.01
      },
      {
        "title": "Token 消耗",
        "targets": [
          {
            "expr": "increase(token_consumption[1h])"
          }
        ],
        "unit": "short"
      },
      {
        "title": "资源使用率",
        "targets": [
          {"expr": "cpu_usage_percent", "alias": "CPU"},
          {"expr": "memory_usage_percent", "alias": "Memory"},
          {"expr": "disk_usage_percent", "alias": "Disk"}
        ]
      }
    ]
  }
}
```

---

## 8. 成本估算与优化

### 8.1 成本分解

#### 小规模部署（≤100 用户）

```
┌─────────────────────────────────────┐
│         月度成本分解 ($41)           │
├─────────────────────────────────────┤
│ 计算资源（ECS）      : $15   (37%)  │
│ LLM API (Qwen3)      : $25   (61%)  │
│ 嵌入 API             : $1    (2%)   │
│ 向量数据库（本地）   : $0    (0%)   │
│ 存储（本地）         : $0    (0%)   │
└─────────────────────────────────────┘

详细成本项：
1. 计算: 1x ecs.c6.large @ $15/月
2. LLM: 50M tokens/月 @ $0.0005/token
3. 嵌入: 10M tokens/月 @ $0.0001/token
4. 存储: 本地 SSD，无额外成本
```

#### 中等规模部署（100-1000 用户）

```
┌──────────────────────────────────────┐
│        月度成本分解 ($430)            │
├──────────────────────────────────────┤
│ 计算资源（ECS）      : $40   (9%)   │
│ LLM API (Qwen3)      : $250  (58%)  │
│ 嵌入 API             : $10   (2%)   │
│ 向量数据库（Qdrant） : $100  (23%)  │
│ 对象存储（OSS）      : $10   (2%)   │
│ 网络/负载均衡        : $20   (5%)   │
└──────────────────────────────────────┘

详细成本项：
1. 计算: 1x ecs.c7.xlarge @ $40/月
2. LLM: 500M tokens/月 @ $0.0005/token
3. 嵌入: 100M tokens/月 @ $0.0001/token
4. 向量DB: Qdrant 标准版 @ $100/月（10GB）
5. 存储: OSS 100GB @ $0.01/GB = $10/月
6. 网络: ALB @ $20/月
```

#### 大规模部署（>1000 用户）

```
┌──────────────────────────────────────┐
│       月度成本分解 ($3700)            │
├──────────────────────────────────────┤
│ 计算资源（ECS）      : $360  (10%)  │
│ LLM API (Qwen3)      : $2500 (68%)  │
│ 嵌入 API             : $100  (3%)   │
│ 向量数据库（Qdrant） : $500  (13%)  │
│ 对象存储（OSS）      : $100  (3%)   │
│ 网络/CDN             : $80   (2%)   │
│ 监控/日志            : $60   (1%)   │
└──────────────────────────────────────┘

详细成本项：
1. 计算: 3x ecs.c7.2xlarge @ $120/月 x 3
2. LLM: 5B tokens/月 @ $0.0005/token
3. 嵌入: 1B tokens/月 @ $0.0001/token
4. 向量DB: Qdrant Cloud 企业版 @ $500/月
5. 存储: OSS 1TB @ $0.10/GB = $100/月
6. 网络: CDN + 负载均衡 @ $80/月
7. 监控: Datadog @ $60/月
```

### 8.2 成本优化策略

#### 策略 1: 使用国内 LLM 提供商

```yaml
# 成本对比（处理 1M tokens）
OpenAI GPT-4o: $3 (最贵)
OpenAI GPT-3.5: $0.2
Qwen3-30B-Instruct: $0.2  ✓ 推荐
Claude 3.5 Sonnet: $3
Llama2 (HF): 自建成本

推荐配置：使用 Qwen3 + 备用 GPT-3.5
可节省: 30-50% LLM 成本
```

#### 策略 2: 缓存优化

```python
# 嵌入缓存可减少 API 调用 30-50%
embedding_cache_size = 100000
average_cache_hit_rate = 0.40  # 40% 缓存命中

# 优化前: 1M 嵌入调用 / 月
# 优化后: 600K 嵌入调用 / 月（节省 400K calls）
# 成本节省: $40/月（10M tokens）
```

#### 策略 3: 批量处理

```yaml
# 按批次处理，减少 API 调用次数
batch_embedding: true
batch_size: 100
embedding_batch_cost: 50  # 每批 50K tokens

# 优化前: 1000 次调用，每次 100 条
# 优化后: 10 次批量调用
# 吞吐量提升: 10x
# 成本提升: 0（总 token 不变，但效率更高）
```

#### 策略 4: 模型分级

```yaml
# 不同任务使用不同模型
llm_config:
  # 实时任务：用高质量模型
  retrieval:
    model: gpt-4o-mini         # 高精度
    cost_per_1m_tokens: 0.15

  # 后台任务：用低成本模型
  summarization:
    model: qwen3-8b            # 快速便宜
    cost_per_1m_tokens: 0.0001

  # 检查任务：用超低成本
  validation:
    model: gpt-3.5-turbo       # 成本优
    cost_per_1m_tokens: 0.0005

# 成本节省: 50-70%
```

#### 策略 5: 向量数据库优化

```yaml
# 本地 vs 云服务成本对比
small_scale:
  local_sqlite: $0/月 ✓ 推荐
  qdrant_cloud: $50/月 (100GB)

medium_scale:
  local_sqlite: $0/月 (维护难度高)
  qdrant_cloud: $100/月 ✓ 推荐
  elasticsearch: $150/月

large_scale:
  qdrant_enterprise: $500/月 ✓ 推荐
  elasticsearch_cloud: $400/月
  self_hosted_qdrant: $200/月 (含运维)
```

#### 策略 6: 数据压缩与分级存储

```yaml
storage_optimization:
  # 热数据保留在快速存储
  hot_storage: 30 days        # EBS/SSD
  warm_storage: 30-90 days    # S3/OSS
  cold_storage: 90+ days      # Glacier/Archive

  # 成本对比
  hot: $0.10/GB/月 (SSD)
  warm: $0.025/GB/月 (S3)
  cold: $0.004/GB/月 (Glacier)

  # 典型 100GB 数据成本
  all_hot: $10/月
  分级: $2.5 + $2.5 + $0.5 = $5.5/月

  节省: 45%
```

### 8.3 成本监控与告警

```yaml
# 成本监控配置
cost_monitoring:
  # 按服务分类统计成本
  breakdown_by:
    - service: llm_api
      budget: $3000/月
      alert_threshold: 90%

    - service: embedding_api
      budget: $150/月
      alert_threshold: 90%

    - service: vector_database
      budget: $500/月
      alert_threshold: 90%

    - service: compute
      budget: $500/月
      alert_threshold: 85%

    - service: storage
      budget: $100/月
      alert_threshold: 80%

  # 异常检测
  daily_cost_analysis:
    enable: true
    check_interval: daily
    anomaly_threshold: 150%  # 超过昨天成本 50% 则告警

  # 月度成本预测
  monthly_forecast:
    enable: true
    method: exponential_smoothing
    alert_if_exceeds_budget: true
```

---

## 9. 部署架构建议

### 9.1 参考部署架构

#### 架构 A: 小规模单机部署（推荐 <100 用户）

```
┌────────────────────────────────────────┐
│         ReMe 单机部署架构              │
├────────────────────────────────────────┤
│  ECS t3.medium (2vCPU, 4GB)            │
│  ├─ ReMe Server (HTTP/MCP)             │
│  ├─ SQLite 本地数据库                  │
│  ├─ sqlite-vec 向量索引                │
│  └─ 本地文件存储                       │
│                                        │
│  外部依赖:                             │
│  ├─ OpenAI/Qwen LLM API               │
│  └─ OpenAI/Qwen Embedding API         │
└────────────────────────────────────────┘

成本: ~$41/月
优势: 最简单，零维护
劣势: 单点故障，不可扩展
适用: 个人项目，小团队
```

#### 架构 B: 中等规模高可用部署（推荐 100-1000 用户）

```
┌─────────────────────────────────────────────────────────────┐
│                   中等规模高可用架构                          │
├─────────────────────────────────────────────────────────────┤
│                      用户请求                               │
│                          │                                   │
│  ┌─────────────────────────────────────────┐               │
│  │       ALB 负载均衡（Multi-AZ）          │               │
│  └──────────┬──────────────┬──────────────┘               │
│             │              │                               │
│     ┌───────▼──┐   ┌──────▼──────┐                        │
│     │ ReMe #1  │   │  ReMe #2    │                        │
│     │ ECS      │   │  ECS        │  (高可用副本)          │
│     │ c6.large │   │  c6.large   │                        │
│     └───────┬──┘   └──────┬──────┘                        │
│             │              │                               │
│  ┌──────────▼──────────────▼──────────────┐               │
│  │  服务层 (共享资源)                     │               │
│  ├──────────────────────────────────────┤               │
│  │ ├─ Qdrant 向量数据库 (1 主 1 副本)  │               │
│  │ ├─ PostgreSQL 记忆索引 (1 主 1 从)  │               │
│  │ ├─ Redis 缓存集群                   │               │
│  │ └─ 阿里云 OSS 对象存储               │               │
│  └──────────────────────────────────────┘               │
│                                                          │
│  外部 API:                                              │
│  ├─ OpenAI/Qwen LLM (限速 1000 req/min)               │
│  └─ OpenAI/Qwen Embedding (限速 500 req/min)         │
└─────────────────────────────────────────────────────────────┘

成本: ~$430/月
优势: 高可用，可扩展，支持 100-1000 并发用户
劣势: 运维复杂度增加
适用: 企业应用，中等规模
```

#### 架构 C: 大规模分布式部署（推荐 >1000 用户）

```
┌──────────────────────────────────────────────────────────────┐
│                  大规模分布式架构                              │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │             全球 CDN + 智能路由                          │ │
│  └───┬─────────────────┬──────────────────┬───────────────┘ │
│      │                 │                  │                  │
│      ▼                 ▼                  ▼                  │
│  ┌────────┐       ┌────────┐        ┌────────┐            │
│  │美国西部 │       │欧洲    │        │亚太    │            │
│  │AWS    │       │AWS    │        │阿里云  │            │
│  │N=3    │       │N=2    │        │N=3    │            │
│  └───┬───┘       └───┬───┘        └───┬───┘            │
│      │               │               │                   │
│  ┌───▼────────────────▼───────────────▼─────────────┐   │
│  │        跨地域数据同步 (CRDT)                      │   │
│  ├─────────────────────────────────────────────────┤   │
│  │  ├─ Qdrant Cloud (多地域副本)                   │   │
│  │  ├─ PostgreSQL (全球主从)                       │   │
│  │  ├─ 缓存同步 (Redis Sentinel)                  │   │
│  │  └─ OSS (多区域冗余)                            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  监控告警:                                             │
│  ├─ Datadog/Prometheus (中央监控)                    │
│  ├─ 区域级告警 (区域可用性监控)                       │
│  ├─ 成本告警 (云账单监控)                             │
│  └─ 异常检测 (自动故障转移)                           │
└──────────────────────────────────────────────────────────────┘

成本: ~$3700/月
优势: 全球分布，低延迟，高可用，自动扩展
劣势: 运维复杂，管理成本高
适用: SaaS 产品，全球服务
```

### 9.2 部署清单

```yaml
部署前检查清单:

□ 基础设施
  □ 云账户配置（AWS/阿里云/GCP）
  □ VPC 和子网规划
  □ 安全组/防火墙规则
  □ SSL 证书申请（Let's Encrypt）

□ API 密钥配置
  □ LLM API 密钥（OpenAI/Qwen）
  □ 嵌入 API 密钥
  □ 向量数据库 API 密钥
  □ 对象存储 Access Key

□ 数据库配置
  □ SQLite 初始化（自动）
  □ PostgreSQL 用户和数据库创建（可选）
  □ 向量数据库初始化
  □ 备份策略配置

□ 应用配置
  □ Docker 镜像构建和推送
  □ Kubernetes 清单准备（如使用 K8s）
  □ 环境变量配置
  □ 日志聚合配置

□ 监控告警
  □ Prometheus scrape 配置
  □ Grafana 仪表板导入
  □ 告警规则配置
  □ 日志采集规则

□ 上线前测试
  □ 负载测试 (Artillery/K6)
  □ 故障转移测试
  □ 备份恢复测试
  □ 灾难恢复演练
```

### 9.3 滚动更新策略

```yaml
# 蓝绿部署 (Blue-Green Deployment)
deployment_strategy: blue_green

blue:  # 当前生产版本
  instances: 3
  version: v1.0.0
  status: active

green:  # 新版本（待上线）
  instances: 3
  version: v1.1.0
  status: staging

promotion:
  # 健康检查通过后切换
  health_check_duration: 5m
  traffic_switch_method: instant  # 或 canary（金丝雀发布）
  rollback_strategy: auto  # 问题自动回滚
```

---

## 10. 最佳实践与安全

### 10.1 安全加固

#### API 认证

```yaml
# 推荐方案 1: API Key 认证
authentication:
  type: api_key
  header: X-API-Key
  key_format: "rk_[0-9a-f]{32}"

  # 密钥轮换
  key_rotation:
    enabled: true
    rotation_interval: 90days
    overlap_period: 7days  # 新旧密钥并行期

# 推荐方案 2: OAuth2/OIDC
authentication:
  type: oauth2
  provider: "https://auth.example.com"
  scope: "reme:read reme:write"

  # Token 配置
  token_expiry: 3600  # 1 小时
  refresh_token_expiry: 604800  # 7 天
```

#### 数据加密

```yaml
# 传输层加密
transport:
  protocol: https
  tls_version: "1.3"
  cipher_suites:
    - TLS_AES_256_GCM_SHA384
    - TLS_CHACHA20_POLY1305_SHA256

# 存储层加密
storage:
  encryption_at_rest: true
  encryption_algorithm: "AES-256-GCM"
  key_management:
    provider: "AWS KMS"  # 或 Azure Key Vault
    key_rotation: 90days

# 向量加密（可选）
vector_encryption:
  enabled: true  # 高安全场景
  method: "homomorphic_encryption"  # 同态加密允许加密数据搜索
```

#### 访问控制

```yaml
# RBAC (Role-Based Access Control)
rbac:
  enabled: true

  roles:
    admin:
      permissions:
        - "*"  # 所有权限

    user:
      permissions:
        - memory:read
        - memory:write
        - memory:delete

    reader:
      permissions:
        - memory:read

    service_account:
      permissions:
        - memory:read
        - memory:write

# 资源级别访问控制
resource_access:
  # 用户只能访问自己的 workspace
  workspace_isolation: true
  cross_workspace_access: false
```

### 10.2 数据隐私与合规

#### GDPR 合规

```yaml
# 个人数据管理
gdpr_compliance:
  # 数据最小化
  collect_only_necessary: true
  data_retention:
    personal_memory: 365  # 天
    task_memory: 180
    tool_memory: 90
    working_memory: 30

  # 被遗忘权 (Right to be Forgotten)
  deletion_support:
    instant_deletion: false
    soft_delete: true  # 标记删除，定期硬删除
    hard_delete_after_days: 30

  # 数据可访问性
  export_format: "json"  # 用户可导出自己的数据
  export_interval_days: 30  # 30 天内可再次导出

# 数据处理协议 (DPA)
dpa:
  required_for_eu_users: true
  processor_agreement: true
```

#### 中国法规合规

```yaml
# 数据本地化要求
china_compliance:
  # 个人信息不出国
  personal_data_location: "cn-beijing"
  vector_db_location: "cn-beijing"
  object_storage_location: "cn-beijing"

  # 内容安全审核
  content_moderation:
    enabled: true
    provider: "alibaba_green"  # 阿里云内容安全
    check_interval: realtime

  # 访问日志保留
  access_logs:
    retention_days: 365
    immutable_storage: true
```

### 10.3 监控与审计

#### 审计日志

```yaml
audit_logging:
  # 审计日志配置
  enabled: true
  provider: "elasticsearch"

  # 审计事件
  events_to_log:
    - memory_created
    - memory_updated
    - memory_deleted
    - memory_retrieved
    - user_created
    - user_deleted
    - permission_changed
    - api_key_rotated
    - backup_completed

  # 审计日志不可篡改
  immutability:
    enabled: true
    storage: "WORM"  # Write Once, Read Many
    retention: 7years

# 审计日志格式
audit_log_format:
  timestamp: "ISO8601"
  event_type: "string"
  actor: "user_id"
  action: "created|updated|deleted|read"
  resource: "memory_id"
  result: "success|failure"
  details: "object"
```

#### 入侵检测

```yaml
# 异常行为检测
intrusion_detection:
  enabled: true

  rules:
    - name: "bulk_delete_attempt"
      condition: "delete_count > 1000 AND time_window < 60"
      action: "block_and_alert"

    - name: "unauthorized_access"
      condition: "failed_auth_attempts > 5 AND time_window < 300"
      action: "block_and_notify_admin"

    - name: "data_exfiltration"
      condition: "export_size > 10GB AND frequency > 3/day"
      action: "block_and_investigate"

    - name: "malicious_query"
      condition: "query_contains_injection_pattern"
      action: "log_and_block"
```

### 10.4 灾难恢复

#### 备份策略

```yaml
backup:
  # 备份频率
  schedule:
    hot_backups: every_hour       # 热备份（关键数据）
    daily_backup: "02:00"         # 每日完整备份
    weekly_backup: "sunday 03:00" # 周备份
    monthly_archive: "1st day"    # 月度归档

  # 备份目标
  destinations:
    - type: s3
      bucket: "reme-backup-prod"
      region: "us-east-1"
      retention: 90days

    - type: glacier
      vault: "reme-disaster-recovery"
      retention: 7years  # 长期保留

    - type: local
      path: "/backup/reme"
      retention: 7days

# 恢复测试
disaster_recovery:
  # 定期 RTO/RPO 测试
  monthly_drill: true
  rto_target: 1hour   # 恢复时间目标
  rpo_target: 1hour   # 恢复点目标

  # 自动故障转移
  auto_failover:
    enabled: true
    detection_threshold: 30seconds
    failover_timeout: 60seconds
```

#### 高可用配置

```yaml
# 主-备故障转移
replication:
  mode: "synchronous"  # 同步复制

  primary:
    region: "us-east-1"
    instances: 3

  replica:
    region: "us-west-2"
    instances: 3
    promotion_threshold: 5failures_in_5min

  # 数据一致性检查
  consistency_check:
    interval: 1hour
    repair_automatic: true

# 心跳检测
health_check:
  interval: 10seconds
  timeout: 5seconds
  failure_threshold: 3
  action_on_failure: "automatic_failover"
```

### 10.5 生产环境检查清单

```yaml
生产环境上线前检查:

□ 安全性检查
  □ API 认证已启用
  □ HTTPS 证书有效期 >30 天
  □ 默认密码已修改
  □ 敏感信息不在配置文件中
  □ 日志脱敏规则已配置
  □ WAF 规则已配置

□ 性能检查
  □ 负载测试通过 (100+ 并发)
  □ API 响应延迟 <1000ms (p95)
  □ 数据库查询延迟 <100ms (p95)
  □ 向量搜索延迟 <200ms (p95)
  □ CPU 峰值 <80%
  □ 内存峰值 <80%

□ 可靠性检查
  □ 故障转移测试通过
  □ 备份恢复测试通过
  □ 数据库一致性检查通过
  □ 备份策略已实施

□ 合规检查
  □ 审计日志已启用
  □ 数据加密已启用
  □ 访问控制已配置
  □ GDPR/合规文档已准备
  □ 用户协议已发布

□ 监控告警
  □ 监控仪表板已创建
  □ 告警规则已配置
  □ 告警通知已测试
  □ 日志聚合已验证
  □ 成本告警已设置

□ 文档准备
  □ 操作手册已编写
  □ 故障排查指南已准备
  □ API 文档已发布
  □ 架构文档已备份
```

---

## 总结

ReMe 作为模块化的 AI Agent 记忆管理框架，其云服务需求相对独立，主要取决于：

1. **用户规模** - 决定计算和存储容量
2. **记忆规模** - 决定向量数据库选择
3. **可用性需求** - 决定部署架构复杂度
4. **地理分布** - 决定是否需要多区域部署
5. **合规要求** - 决定数据加密和隐私措施

### 快速选择指南：

| 场景 | 推荐方案 | 月成本 | 难度 |
|-----|--------|------|------|
| 个人项目 | 单机 + SQLite | $41 | ⭐ |
| 小团队 | 单机 + Qdrant | $150 | ⭐ |
| 中等企业 | 高可用 + Qdrant | $430 | ⭐⭐⭐ |
| 大型平台 | 分布式 + Qdrant Cloud | $3700 | ⭐⭐⭐⭐⭐ |

**下一步建议**:
1. 评估用户规模和记忆量
2. 根据成本预算选择部署架构
3. 按照部署清单逐项配置
4. 执行生产环境检查清单
5. 定期监控成本和性能指标

---

**文档版本**: v1.0
**生成时间**: 2026-02-12
**审核人**: ReMe 社区维护者
**最后更新**: 2026-02-12
