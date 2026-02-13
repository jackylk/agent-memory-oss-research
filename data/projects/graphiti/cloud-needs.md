# Graphiti 云服务需求分析

本文档详细分析 Graphiti 项目在云环境中的部署需求，包括基础设施、第三方服务、配置选项和成本估算。

---

## 目录

1. [核心依赖概述](#1-核心依赖概述)
2. [图数据库存储方案](#2-图数据库存储方案)
3. [LLM 服务提供商](#3-llm-服务提供商)
4. [嵌入模型服务](#4-嵌入模型服务)
5. [搜索与索引服务](#5-搜索与索引服务)
6. [缓存与性能优化](#6-缓存与性能优化)
7. [可观测性与追踪](#7-可观测性与追踪)
8. [容器化与编排](#8-容器化与编排)
9. [云部署架构方案](#9-云部署架构方案)
10. [成本估算](#10-成本估算)

---

## 1. 核心依赖概述

### 1.1 必需依赖

```toml
[project.dependencies]
pydantic>=2.11.5          # 数据验证和序列化
neo4j>=5.26.0             # 图数据库（主要存储）
diskcache>=5.6.3          # 本地磁盘缓存
openai>=1.91.0            # LLM API 客户端（默认）
tenacity>=9.0.0           # 重试逻辑
numpy>=1.0.0              # 数值计算
python-dotenv>=1.0.1      # 环境变量管理
posthog>=3.0.0            # 产品分析（可选禁用）
```

### 1.2 可选依赖组

Graphiti 采用模块化设计，支持多种云服务组合：

| 依赖组 | 用途 | 云服务需求 |
|--------|------|------------|
| `anthropic` | Claude LLM 支持 | Anthropic API |
| `groq` | Groq LLM 支持 | Groq API |
| `google-genai` | Gemini LLM 支持 | Google Cloud Vertex AI |
| `kuzu` | Kuzu 图数据库 | 自托管/本地 |
| `falkordb` | FalkorDB 图数据库 | 自托管 Redis 兼容 |
| `neptune` | AWS Neptune 图数据库 | AWS Neptune + OpenSearch |
| `voyageai` | Voyage 嵌入模型 | Voyage AI API |
| `sentence-transformers` | 本地嵌入模型 | GPU 计算资源 |
| `neo4j-opensearch` | Neo4j + OpenSearch | Neo4j + AWS OpenSearch |
| `tracing` | OpenTelemetry 追踪 | 追踪后端（Jaeger/Zipkin） |

---

## 2. 图数据库存储方案

Graphiti 的核心是**双时态知识图谱**，需要强大的图数据库支持。

### 2.1 Neo4j（推荐）

**版本要求**: `>=5.26.0`

#### 云服务选项

**选项 1: Neo4j AuraDB（托管服务）**
- **部署**: 完全托管，零运维
- **定价**:
  - 免费层：无限期使用（200K 节点 + 400K 关系）
  - 专业版：$65/月起（5GB 存储）
  - 企业版：$3000/月起（100GB 存储 + 高可用）
- **特性**:
  - 自动备份和恢复
  - 全球多区域部署
  - 支持并行运行时（企业版）
  - 内置监控和告警
- **适用场景**: 生产环境、需要高可用性

**选项 2: 自托管 Neo4j（容器化）**
```yaml
# Docker Compose 示例
version: '3.8'
services:
  neo4j:
    image: neo4j:5.26-community  # 或 enterprise
    ports:
      - "7474:7474"  # HTTP
      - "7687:7687"  # Bolt
    environment:
      - NEO4J_AUTH=neo4j/password
      - NEO4J_PLUGINS=["apoc", "graph-data-science"]
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 2G
```

- **云服务器需求**:
  - **最小配置**: 2 vCPU, 4GB RAM, 20GB SSD
  - **推荐配置**: 4 vCPU, 8GB RAM, 100GB SSD
  - **高负载配置**: 8 vCPU, 16GB RAM, 500GB NVMe SSD
- **云平台选择**:
  - AWS: EC2 (t3.large 或 m5.xlarge)
  - GCP: Compute Engine (n2-standard-4)
  - Azure: Virtual Machines (Standard_D4s_v3)
- **估算成本**: $50-300/月（按配置）

#### Neo4j 配置优化

```python
# Graphiti 配置
from graphiti_core import Graphiti
from graphiti_core.driver.neo4j import Neo4jDriver

driver = Neo4jDriver(
    uri="bolt://localhost:7687",
    user="neo4j",
    password="password",
    database="graphiti"  # 默认 "neo4j"
)

graphiti = Graphiti(
    driver=driver,
    llm_client=llm,
    embedder=embedder,
    use_parallel_runtime=True  # 企业版特性，需设置环境变量
)
```

**环境变量**:
```bash
NEO4J_URI=bolt://neo4j.example.com:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=secure_password
NEO4J_DATABASE=graphiti
USE_PARALLEL_RUNTIME=true  # 仅企业版
```

### 2.2 FalkorDB（Redis 生态）

**版本要求**: `>=1.1.2, <2.0.0`

#### 云服务选项

**选项 1: Redis Cloud 托管**
- **部署**: 利用 Redis Enterprise Cloud + FalkorDB 模块
- **定价**:
  - 按需计费：$0.000139/GB-小时
  - 固定计划：$25/月起（5GB 内存）
- **特性**:
  - 支持 Redis 所有特性（持久化、复制、集群）
  - FalkorDB 模块集成图查询
  - 亚毫秒级延迟
- **适用场景**: 需要高性能图查询 + Redis 缓存

**选项 2: 自托管 FalkorDB**
```dockerfile
# Dockerfile 示例
FROM falkordb/falkordb:latest
EXPOSE 6379
CMD ["falkordb-server", "--protected-mode", "no"]
```

- **云服务器需求**:
  - **最小配置**: 2 vCPU, 4GB RAM
  - **推荐配置**: 4 vCPU, 8GB RAM
- **估算成本**: $30-100/月

#### 使用示例

```python
from graphiti_core.driver.falkor import FalkorDriver

driver = FalkorDriver(
    host="localhost",
    port=6379,
    database="default_db"  # 默认数据库名
)
```

### 2.3 AWS Neptune（托管图数据库）

**依赖**: `langchain-aws>=0.2.29`, `opensearch-py>=3.0.0`, `boto3>=1.39.16`

#### 云服务特性

- **部署**: AWS 完全托管
- **定价**:
  - db.r5.large: $0.348/小时（$252/月，2 vCPU, 16GB）
  - db.r5.xlarge: $0.696/小时（$504/月，4 vCPU, 32GB）
  - 存储：$0.10/GB-月（前 1TB）
  - I/O 请求：$0.20/百万请求
- **特性**:
  - 自动故障转移（多 AZ 部署）
  - 15 个只读副本
  - 时间点恢复
  - OpenSearch 全文搜索集成
- **适用场景**: AWS 生态、需要企业级高可用

#### 配置示例

```python
from graphiti_core.driver.neptune import NeptuneDriver

driver = NeptuneDriver(
    neptune_endpoint="https://your-cluster.cluster-xxx.us-east-1.neptune.amazonaws.com",
    opensearch_endpoint="https://search-xxx.us-east-1.es.amazonaws.com",
    aws_region="us-east-1",
    aws_access_key_id="YOUR_ACCESS_KEY",
    aws_secret_access_key="YOUR_SECRET_KEY"
)
```

### 2.4 Kuzu（嵌入式图数据库）

**版本要求**: `>=0.11.3`

#### 特性

- **部署**: 无需独立服务器，嵌入式数据库
- **存储**: 本地文件系统（适合开发/测试）
- **成本**: $0（仅需应用服务器存储）
- **限制**: 不支持分布式部署
- **适用场景**: 开发环境、边缘计算、单机部署

```python
from graphiti_core.driver.kuzu import KuzuDriver

driver = KuzuDriver(
    database_path="./kuzu_db"  # 本地路径
)
```

### 2.5 图数据库选型建议

| 场景 | 推荐方案 | 估算成本/月 | 理由 |
|------|---------|-------------|------|
| **开发测试** | Kuzu 本地 / Neo4j 免费层 | $0 | 零成本，快速迭代 |
| **小型生产** | Neo4j AuraDB 专业版 | $65 | 托管服务，运维简单 |
| **中型生产** | 自托管 Neo4j（AWS EC2） | $150 | 成本可控，性能可调 |
| **大型生产** | Neo4j AuraDB 企业版 | $3000+ | 高可用，全球多区域 |
| **AWS 生态** | AWS Neptune | $252+ | 深度集成 AWS 服务 |
| **高性能图+缓存** | FalkorDB（Redis Cloud） | $50 | Redis 性能 + 图查询 |

---

## 3. LLM 服务提供商

Graphiti 使用 LLM 进行**实体提取**、**边创建**、**实体去重**和**社区总结**。

### 3.1 OpenAI（默认）

**版本要求**: `>=1.91.0`

#### API 定价（2025 年）

| 模型 | 输入定价 | 输出定价 | 上下文窗口 |
|------|---------|---------|------------|
| **GPT-4.1** | $2.50/1M tokens | $10.00/1M tokens | 128K |
| **GPT-4.1-mini** | $0.15/1M tokens | $0.60/1M tokens | 128K |
| **GPT-5-mini** | $1.00/1M tokens | $4.00/1M tokens | 256K |
| **GPT-4o** | $2.50/1M tokens | $10.00/1M tokens | 128K |
| **text-embedding-3-small** | $0.02/1M tokens | - | 8K |
| **text-embedding-3-large** | $0.13/1M tokens | - | 8K |

#### 月度成本估算

假设场景：
- **输入**: 100万 tokens/月（实体提取 + 去重）
- **输出**: 20万 tokens/月（生成总结 + 新实体）
- **嵌入**: 500万 tokens/月（向量搜索）

**使用 GPT-4.1-mini + text-embedding-3-small**:
```
LLM 成本 = (1M × $0.15) + (0.2M × $0.60) = $0.27/月
嵌入成本 = 5M × $0.02 / 1M = $0.10/月
总计 = $0.37/月
```

**使用 GPT-4.1 + text-embedding-3-large**:
```
LLM 成本 = (1M × $2.50) + (0.2M × $10.00) = $4.50/月
嵌入成本 = 5M × $0.13 / 1M = $0.65/月
总计 = $5.15/月
```

#### 配置示例

```python
from graphiti_core.llm_client import OpenAIClient
from graphiti_core.embedder import OpenAIEmbedder

llm = OpenAIClient(
    api_key="sk-...",
    model="gpt-4.1-mini",  # 或 gpt-4.1
    temperature=0.0
)

embedder = OpenAIEmbedder(
    api_key="sk-...",
    model="text-embedding-3-small"  # 或 text-embedding-3-large
)
```

**环境变量**:
```bash
OPENAI_API_KEY=sk-proj-...
OPENAI_LLM_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### 3.2 Anthropic Claude

**版本要求**: `>=0.49.0`

#### API 定价（2025 年）

| 模型 | 输入定价 | 输出定价 | 上下文窗口 |
|------|---------|---------|------------|
| **Claude 4.5 Sonnet** | $3.00/1M tokens | $15.00/1M tokens | 200K |
| **Claude 4.5 Haiku** | $0.25/1M tokens | $1.25/1M tokens | 200K |
| **Claude 3.7 Sonnet** | $3.00/1M tokens | $15.00/1M tokens | 200K |

#### 月度成本估算

**使用 Claude 4.5 Haiku**（推荐用于 Graphiti）:
```
LLM 成本 = (1M × $0.25) + (0.2M × $1.25) = $0.50/月
```

**使用 Claude 4.5 Sonnet**:
```
LLM 成本 = (1M × $3.00) + (0.2M × $15.00) = $6.00/月
```

#### 配置示例

```python
from graphiti_core.llm_client import AnthropicClient

llm = AnthropicClient(
    api_key="sk-ant-...",
    model="claude-4-5-haiku-latest",  # 或 claude-4-5-sonnet-latest
    temperature=0.0
)
```

**环境变量**:
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-4-5-haiku-latest
```

### 3.3 Groq（高速推理）

**版本要求**: `>=0.2.0`

#### API 定价

| 模型 | 输入定价 | 输出定价 | 速度 |
|------|---------|---------|------|
| **llama-3.3-70b-versatile** | $0.59/1M tokens | $0.79/1M tokens | ~500 tokens/s |
| **mixtral-8x7b** | $0.24/1M tokens | $0.24/1M tokens | ~1000 tokens/s |

#### 特性

- **极速推理**: 比 OpenAI/Anthropic 快 5-10 倍
- **免费额度**: 每天 14,400 次请求
- **限制**: 无法使用嵌入模型（需配合其他服务）

#### 月度成本估算

**使用 mixtral-8x7b**:
```
LLM 成本 = (1M × $0.24) + (0.2M × $0.24) = $0.29/月
```

#### 配置示例

```python
from graphiti_core.llm_client import GroqClient

llm = GroqClient(
    api_key="gsk_...",
    model="mixtral-8x7b-32768"
)
```

### 3.4 Google Gemini

**版本要求**: `>=1.62.0`

#### API 定价

| 模型 | 输入定价 | 输出定价 | 上下文窗口 |
|------|---------|---------|------------|
| **Gemini 2.5 Pro** | $1.25/1M tokens | $5.00/1M tokens | 1M |
| **Gemini 2.5 Flash** | $0.075/1M tokens | $0.30/1M tokens | 1M |
| **text-embedding-004** | $0.0001/1K tokens | - | 2K |

#### 月度成本估算

**使用 Gemini 2.5 Flash + text-embedding-004**:
```
LLM 成本 = (1M × $0.075) + (0.2M × $0.30) = $0.14/月
嵌入成本 = 5M × $0.0001 / 1K = $0.50/月
总计 = $0.64/月
```

#### 配置示例

```python
from graphiti_core.llm_client import GoogleGenAIClient
from graphiti_core.embedder import GoogleGenAIEmbedder

llm = GoogleGenAIClient(
    api_key="AIza...",
    model="gemini-2.5-flash"
)

embedder = GoogleGenAIEmbedder(
    api_key="AIza...",
    model="text-embedding-004"
)
```

### 3.5 LLM 服务选型建议

| 需求 | 推荐方案 | 月度成本估算 | 理由 |
|------|---------|-------------|------|
| **最低成本** | Gemini 2.5 Flash | $0.64 | 最便宜的高质量模型 |
| **性价比** | GPT-4.1-mini | $0.37 | OpenAI 生态成熟 |
| **最高速度** | Groq Mixtral | $0.29 | 推理速度最快 |
| **最佳质量** | Claude 4.5 Sonnet | $6.00 | 最强推理能力 |
| **开源替代** | 本地 Llama 3.3 | $50-200（服务器） | 无 API 成本，需 GPU |

---

## 4. 嵌入模型服务

Graphiti 使用嵌入模型进行**向量相似度搜索**（查找相关实体和边）。

### 4.1 OpenAI Embeddings（默认）

已在第 3.1 节介绍，成本：
- **text-embedding-3-small**: $0.02/1M tokens（推荐）
- **text-embedding-3-large**: $0.13/1M tokens

### 4.2 Voyage AI

**版本要求**: `>=0.2.3`

#### API 定价

| 模型 | 定价 | 维度 | 特性 |
|------|------|------|------|
| **voyage-3** | $0.06/1M tokens | 1024 | 最新模型，MTEB 排行榜前列 |
| **voyage-3-lite** | $0.02/1M tokens | 512 | 轻量版，速度快 |
| **voyage-code-3** | $0.06/1M tokens | 1024 | 代码搜索优化 |

#### 月度成本估算

**使用 voyage-3-lite**:
```
嵌入成本 = 5M × $0.02 / 1M = $0.10/月
```

#### 配置示例

```python
from graphiti_core.embedder import VoyageAIEmbedder

embedder = VoyageAIEmbedder(
    api_key="pa-...",
    model="voyage-3-lite"
)
```

**环境变量**:
```bash
VOYAGE_API_KEY=pa-...
VOYAGE_MODEL=voyage-3-lite
```

### 4.3 Sentence Transformers（本地模型）

**版本要求**: `>=3.2.1`

#### 部署方式

**选项 1: CPU 运行（慢）**
```python
from graphiti_core.embedder import SentenceTransformerEmbedder

embedder = SentenceTransformerEmbedder(
    model_name="all-MiniLM-L6-v2",  # 384 维
    device="cpu"
)
```

- **服务器需求**: 2 vCPU, 4GB RAM
- **推理速度**: ~50 tokens/s
- **成本**: $20-50/月（云服务器）

**选项 2: GPU 加速（推荐）**
```python
embedder = SentenceTransformerEmbedder(
    model_name="all-mpnet-base-v2",  # 768 维
    device="cuda"
)
```

- **云 GPU 选项**:
  - AWS: p3.2xlarge（V100 16GB）$3.06/小时 = $2,200/月
  - GCP: n1-standard-4 + T4 GPU $0.45/小时 = $325/月
  - Lambda Labs: RTX 4090 $0.99/小时 = $713/月（按需）
- **推理速度**: ~500 tokens/s
- **月度成本**: $325+ （适合大规模本地部署）

#### 常用模型

| 模型 | 维度 | 性能 | 大小 |
|------|------|------|------|
| `all-MiniLM-L6-v2` | 384 | MTEB 58.8 | 80MB |
| `all-mpnet-base-v2` | 768 | MTEB 63.3 | 420MB |
| `multilingual-e5-large` | 1024 | MTEB 64.5（多语言） | 2.2GB |

### 4.4 嵌入服务选型建议

| 场景 | 推荐方案 | 月度成本 | 理由 |
|------|---------|---------|------|
| **小规模生产** | OpenAI text-embedding-3-small | $0.10 | API 简单，质量高 |
| **成本优化** | Voyage AI voyage-3-lite | $0.10 | 价格同 OpenAI，性能更好 |
| **隐私优先** | Sentence Transformers (CPU) | $30 | 本地部署，无数据外传 |
| **大规模部署** | Sentence Transformers (GPU) | $325+ | 无 API 调用限制 |

---

## 5. 搜索与索引服务

### 5.1 Neo4j + OpenSearch（混合搜索）

**依赖**: `neo4j-opensearch` 扩展（需 `boto3>=1.39.16`, `opensearch-py>=3.0.0`）

#### AWS OpenSearch 定价

| 实例类型 | vCPU | 内存 | 定价/小时 | 月度成本 |
|---------|------|------|----------|---------|
| t3.small.search | 2 | 2GB | $0.036 | $26 |
| t3.medium.search | 2 | 4GB | $0.073 | $53 |
| m6g.large.search | 2 | 8GB | $0.122 | $88 |
| r6g.xlarge.search | 4 | 32GB | $0.293 | $212 |

**存储成本**: $0.135/GB-月（EBS gp3）

#### 功能

- **全文搜索**: OpenSearch 提供高级文本搜索（BM25、TF-IDF）
- **向量搜索**: OpenSearch 2.x+ 支持 k-NN 向量搜索
- **混合查询**: 结合 Neo4j 图遍历 + OpenSearch 文本/向量搜索

#### 配置示例

```python
from graphiti_core.search.neo4j_opensearch import Neo4jOpenSearchHybrid

search = Neo4jOpenSearchHybrid(
    neo4j_driver=neo4j_driver,
    opensearch_endpoint="https://search-xxx.us-east-1.es.amazonaws.com",
    aws_region="us-east-1"
)

results = await search.hybrid_search(
    query="AI agent memory systems",
    limit=10,
    vector_weight=0.7,  # 70% 向量相似度 + 30% BM25
    text_weight=0.3
)
```

### 5.2 Neptune + OpenSearch

已在第 2.3 节介绍，成本：
- **Neptune**: $252/月起（db.r5.large）
- **OpenSearch**: $53/月起（t3.medium.search）
- **总计**: ~$305/月

---

## 6. 缓存与性能优化

### 6.1 diskcache（本地缓存）

**版本要求**: `>=5.6.3`

#### 功能

- **LRU 缓存**: 缓存 LLM 响应、嵌入结果
- **持久化**: 磁盘存储，重启后保留
- **零成本**: 无需额外云服务

#### 配置示例

```python
from diskcache import Cache

cache = Cache("/var/cache/graphiti")

# Graphiti 自动使用 diskcache 缓存 LLM 调用
graphiti = Graphiti(
    driver=driver,
    llm_client=llm,
    embedder=embedder,
    cache_dir="/var/cache/graphiti"
)
```

#### 存储需求

- **磁盘空间**: 建议预留 10-50GB（视缓存策略）
- **I/O 性能**: SSD 推荐（提升缓存命中性能）

### 6.2 Redis（分布式缓存）

虽然 Graphiti 默认使用 diskcache，但可以集成 Redis 实现：

```python
import redis
from functools import lru_cache

redis_client = redis.Redis(host="redis.example.com", port=6379, db=0)

@lru_cache(maxsize=1000)
def cached_llm_call(prompt):
    key = f"llm:{hash(prompt)}"
    cached = redis_client.get(key)
    if cached:
        return cached.decode()
    result = llm.generate(prompt)
    redis_client.setex(key, 3600, result)  # 1小时过期
    return result
```

#### Redis 云服务成本

- **Redis Cloud 免费层**: 30MB（开发测试）
- **固定计划**: $5/月（100MB）- $25/月（5GB）
- **AWS ElastiCache**: cache.t4g.micro $0.0168/小时（$12/月）

---

## 7. 可观测性与追踪

### 7.1 OpenTelemetry 集成

**依赖**: `opentelemetry-api>=1.20.0`, `opentelemetry-sdk>=1.20.0`

#### 配置示例

```python
from graphiti_core import Graphiti
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.jaeger.thrift import JaegerExporter

# 设置追踪
trace.set_tracer_provider(TracerProvider())
jaeger_exporter = JaegerExporter(
    agent_host_name="jaeger.example.com",
    agent_port=6831,
)
trace.get_tracer_provider().add_span_processor(
    BatchSpanProcessor(jaeger_exporter)
)

# Graphiti 自动发送追踪数据
graphiti = Graphiti(
    driver=driver,
    llm_client=llm,
    embedder=embedder,
    enable_tracing=True  # 启用 OpenTelemetry
)
```

#### 追踪后端选项

**选项 1: Jaeger（自托管）**
```yaml
# Docker Compose
version: '3.8'
services:
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "6831:6831/udp"  # Agent
      - "16686:16686"    # UI
    environment:
      - COLLECTOR_ZIPKIN_HOST_PORT=:9411
```

- **成本**: $20-50/月（云服务器）

**选项 2: Honeycomb（SaaS）**
- **免费层**: 每月 20GB 事件
- **付费版**: $0.30/GB（超出部分）
- **特性**: 高级查询、告警

**选项 3: Datadog APM**
- **定价**: $0.012/span（按需）
- **免费额度**: 每月 150GB
- **特性**: 全栈监控、日志关联

### 7.2 PostHog 分析（可选）

**依赖**: `posthog>=3.0.0`

#### 功能

- **产品分析**: 追踪用户行为（API 调用频率、功能使用）
- **错误追踪**: 捕获异常和崩溃
- **A/B 测试**: 功能实验

#### 云服务成本

- **PostHog Cloud 免费层**: 每月 100万 events
- **付费版**: $0.00012/event（超出部分）
- **自托管**: $50-100/月（云服务器）

#### 禁用方式

如不需要产品分析，可禁用 PostHog：

```python
import os
os.environ["POSTHOG_DISABLED"] = "1"
```

---

## 8. 容器化与编排

### 8.1 Docker 部署

#### Dockerfile 示例

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 安装 Graphiti
RUN pip install graphiti-core[anthropic,voyageai,tracing]

# 复制应用代码
COPY . .

# 环境变量
ENV PYTHONUNBUFFERED=1
ENV NEO4J_URI=bolt://neo4j:7687
ENV OPENAI_API_KEY=sk-...

# 启动应用
CMD ["python", "app.py"]
```

#### requirements.txt

```txt
graphiti-core[anthropic,voyageai,tracing]>=0.27.0
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
```

### 8.2 Docker Compose 完整栈

```yaml
version: '3.8'

services:
  neo4j:
    image: neo4j:5.26-community
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      NEO4J_AUTH: neo4j/password
      NEO4J_PLUGINS: '["apoc"]'
    volumes:
      - neo4j_data:/data

  graphiti_app:
    build: .
    ports:
      - "8000:8000"
    environment:
      NEO4J_URI: bolt://neo4j:7687
      NEO4J_USER: neo4j
      NEO4J_PASSWORD: password
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on:
      - neo4j
    volumes:
      - cache_data:/var/cache/graphiti

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"
      - "6831:6831/udp"

volumes:
  neo4j_data:
  cache_data:
```

启动命令：
```bash
docker-compose up -d
```

### 8.3 Kubernetes 部署

#### Helm Chart 示例

```yaml
# values.yaml
replicaCount: 3

image:
  repository: your-registry/graphiti-app
  tag: latest

neo4j:
  enabled: true
  uri: bolt://neo4j:7687
  auth:
    user: neo4j
    password: password

llm:
  provider: openai
  apiKey: sk-...

embedder:
  provider: voyageai
  apiKey: pa-...

resources:
  limits:
    cpu: 2000m
    memory: 4Gi
  requests:
    cpu: 500m
    memory: 1Gi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
```

部署命令：
```bash
helm install graphiti ./graphiti-chart -f values.yaml
```

---

## 9. 云部署架构方案

### 9.1 方案 1：最小化成本（开发/测试）

**技术栈**:
- **图数据库**: Kuzu（本地嵌入式）
- **LLM**: Gemini 2.5 Flash
- **嵌入**: Google text-embedding-004
- **部署**: 单机 Docker Compose

**成本分解**:
```
云服务器（2 vCPU, 4GB RAM）: $20/月
Gemini API: $0.64/月
总计: ~$21/月
```

**适用场景**: 个人项目、原型开发

---

### 9.2 方案 2：性价比方案（小型生产）

**技术栈**:
- **图数据库**: 自托管 Neo4j Community（EC2 t3.large）
- **LLM**: GPT-4.1-mini
- **嵌入**: OpenAI text-embedding-3-small
- **缓存**: diskcache（本地）
- **部署**: Docker Compose

**成本分解**:
```
EC2 t3.large（2 vCPU, 8GB, 100GB SSD）: $60/月
OpenAI API（1M input + 200K output + 5M embedding）: $0.37/月
总计: ~$61/月
```

**适用场景**: 初创公司、MVP 产品

---

### 9.3 方案 3：托管服务方案（中型生产）

**技术栈**:
- **图数据库**: Neo4j AuraDB 专业版
- **LLM**: Claude 4.5 Haiku
- **嵌入**: Voyage AI voyage-3-lite
- **缓存**: Redis Cloud（1GB）
- **追踪**: Honeycomb 免费层
- **部署**: Kubernetes（3 副本）

**成本分解**:
```
Neo4j AuraDB 专业版（5GB）: $65/月
Claude API（1M input + 200K output）: $0.50/月
Voyage AI（5M tokens）: $0.10/月
Redis Cloud（1GB）: $15/月
Kubernetes 节点（3 × t3.medium）: $90/月
总计: ~$171/月
```

**适用场景**: 成长型公司、SaaS 产品

---

### 9.4 方案 4：企业级高可用方案

**技术栈**:
- **图数据库**: Neo4j AuraDB 企业版（多区域）
- **搜索**: AWS OpenSearch（m6g.large + 100GB）
- **LLM**: GPT-4.1（高质量）
- **嵌入**: OpenAI text-embedding-3-large
- **缓存**: AWS ElastiCache Redis（cache.r6g.large）
- **追踪**: Datadog APM
- **部署**: EKS（多 AZ，自动扩展）

**成本分解**:
```
Neo4j AuraDB 企业版（100GB，多区域）: $3,000/月
AWS OpenSearch（m6g.large + 100GB）: $88 + $13.5 = $101.5/月
OpenAI API（10M input + 2M output + 50M embedding）: $46.50/月
ElastiCache Redis（cache.r6g.large 13GB）: $0.285/h × 730h = $208/月
Datadog APM（100K spans/月）: $1.20/月
EKS 控制平面: $73/月
EKS 工作节点（3 × m5.xlarge）: $438/月
ALB + 数据传输: $50/月
总计: ~$3,918/月
```

**适用场景**: 大型企业、金融/医疗等合规行业

---

### 9.5 方案 5：AWS 原生方案

**技术栈**:
- **图数据库**: AWS Neptune（db.r5.large）
- **搜索**: AWS OpenSearch（t3.medium）
- **LLM**: Claude 4.5 Haiku（通过 AWS Bedrock）
- **嵌入**: Amazon Titan Embeddings
- **缓存**: ElastiCache Redis（cache.t4g.small）
- **追踪**: AWS X-Ray
- **部署**: ECS Fargate

**成本分解**:
```
Neptune（db.r5.large + 100GB 存储）: $252 + $10 = $262/月
OpenSearch（t3.medium + 50GB）: $53 + $6.75 = $59.75/月
AWS Bedrock Claude（1M input + 200K output）: $0.50/月
Amazon Titan Embeddings（5M tokens）: $0.05/月
ElastiCache（cache.t4g.small 1.5GB）: $0.034/h × 730h = $25/月
ECS Fargate（2 vCPU, 4GB × 2 任务）: $60/月
X-Ray（免费层足够）: $0/月
总计: ~$407/月
```

**适用场景**: AWS 深度用户、需要 AWS 原生集成

---

## 10. 成本估算

### 10.1 按负载级别估算

| 负载级别 | 每月 Episodes | 总 Tokens | 推荐方案 | 月度成本 |
|---------|--------------|-----------|---------|---------|
| **开发测试** | <1K | <100K | 方案 1（Kuzu + Gemini） | **$21** |
| **小型应用** | 1K-10K | 100K-1M | 方案 2（自托管 Neo4j + GPT-4.1-mini） | **$61** |
| **中型应用** | 10K-100K | 1M-10M | 方案 3（AuraDB + Claude Haiku） | **$171** |
| **大型应用** | 100K-1M | 10M-100M | 方案 4（企业级高可用） | **$3,918** |
| **AWS 生态** | 任意 | 任意 | 方案 5（AWS 原生） | **$407+** |

### 10.2 成本优化建议

#### 10.2.1 LLM 成本优化

1. **使用更小的模型**: GPT-4.1-mini 或 Claude 4.5 Haiku（成本降低 80%）
2. **启用缓存**: diskcache 缓存 LLM 响应（避免重复调用）
3. **批量处理**: 使用 `add_episode_bulk()` 减少 API 调用
4. **Prompt 压缩**: 精简提示词，减少输入 token

#### 10.2.2 图数据库成本优化

1. **选择合适规模**: 小型应用使用自托管 Neo4j 而非 AuraDB
2. **开发测试用 Kuzu**: 零成本嵌入式数据库
3. **垂直扩展优先**: 先升级单节点配置，再考虑水平扩展
4. **定期清理**: 删除过期的 Episode 和 Entity 节点

#### 10.2.3 云服务器成本优化

1. **使用 Spot 实例**: AWS Spot 可节省 70%（适合非关键任务）
2. **预留实例**: 1 年期预留可节省 40%
3. **自动扩缩容**: 根据负载动态调整实例数量
4. **选择合适的云区域**: 美国东部（us-east-1）通常最便宜

---

## 总结

Graphiti 的云部署具有高度灵活性，可根据需求选择不同的技术栈和云服务组合。关键决策点：

1. **图数据库**:
   - 开发测试 → Kuzu（$0）
   - 小型生产 → 自托管 Neo4j（$60/月）
   - 中大型生产 → Neo4j AuraDB（$65-3000/月）
   - AWS 生态 → Neptune（$252/月）

2. **LLM 服务**:
   - 最低成本 → Gemini 2.5 Flash（$0.14/月）
   - 性价比 → GPT-4.1-mini（$0.27/月）
   - 最高质量 → Claude 4.5 Sonnet（$6/月）

3. **嵌入模型**:
   - API 服务 → OpenAI / Voyage AI（$0.10/月）
   - 本地部署 → Sentence Transformers（$30-325/月）

4. **部署方式**:
   - 简单应用 → Docker Compose
   - 生产环境 → Kubernetes / ECS
   - 托管服务 → 云平台 PaaS

**推荐起点**: 方案 2（性价比方案，$61/月），随业务增长逐步升级到方案 3 或方案 4。
