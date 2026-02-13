# Hindsight 项目架构文档

## 1. 项目概述

### 一句话描述
Hindsight 是一个仿生记忆系统,专为 AI Agent 设计,通过模拟人类记忆机制实现智能体的长期学习能力,而非简单的对话历史存储。

### 核心功能
- **仿生记忆架构**: 模拟人类记忆系统,区分世界事实、经验事实和心智模型三种记忆类型
- **学习型记忆**: 通过 Retain(存储)、Recall(检索)、Reflect(反思) 三大核心操作实现智能体学习
- **多策略检索**: 并行执行语义、关键词、图谱、时序四种检索策略,使用交叉编码器重排序
- **实体图谱**: 自动提取实体关系,构建知识图谱支持复杂推理
- **时序记忆**: 支持时间感知的记忆存储和检索

### 技术特点
- **性能卓越**: LongMemEval 基准测试中达到业界最高准确率,经弗吉尼亚理工大学和华盛顿邮报独立验证
- **生产就绪**: 已在财富 500 强企业和多家 AI 初创公司生产环境部署
- **灵活部署**: 支持 Docker 单机部署、Docker Compose 分布式部署、Python 嵌入式部署
- **多 LLM 支持**: 支持 OpenAI、Anthropic、Gemini、Groq、Ollama、LM Studio 等多种 LLM 提供商
- **本地优先**: 默认使用本地嵌入模型和重排序模型,可选外部服务

### GitHub 信息
- **Stars**: 1,400+
- **主要语言**: Python
- **开源协议**: MIT
- **代码规模**: 326 个 Python 文件,核心引擎 5,771 行代码

## 2. 架构组件

### 架构图

```json
{
  "nodes": [
    {"id": "client", "label": "客户端 SDK", "type": "interface"},
    {"id": "http_api", "label": "HTTP API (FastAPI)", "type": "api"},
    {"id": "mcp", "label": "MCP 服务器", "type": "api"},
    {"id": "memory_engine", "label": "记忆引擎", "type": "core"},
    {"id": "retain", "label": "Retain 管道", "type": "pipeline"},
    {"id": "recall", "label": "Recall 检索", "type": "pipeline"},
    {"id": "reflect", "label": "Reflect 反思", "type": "pipeline"},
    {"id": "llm_wrapper", "label": "LLM 包装器", "type": "service"},
    {"id": "embeddings", "label": "嵌入模型", "type": "service"},
    {"id": "reranker", "label": "重排序器", "type": "service"},
    {"id": "entity_resolver", "label": "实体解析器", "type": "service"},
    {"id": "postgres", "label": "PostgreSQL + pgvector", "type": "storage"},
    {"id": "control_plane", "label": "管理控制台 (Next.js)", "type": "ui"}
  ],
  "edges": [
    {"from": "client", "to": "http_api", "label": "REST API"},
    {"from": "client", "to": "mcp", "label": "MCP 协议"},
    {"from": "http_api", "to": "memory_engine", "label": "调用"},
    {"from": "mcp", "to": "memory_engine", "label": "调用"},
    {"from": "memory_engine", "to": "retain", "label": "存储操作"},
    {"from": "memory_engine", "to": "recall", "label": "检索操作"},
    {"from": "memory_engine", "to": "reflect", "label": "反思操作"},
    {"from": "retain", "to": "llm_wrapper", "label": "事实提取"},
    {"from": "retain", "to": "entity_resolver", "label": "实体规范化"},
    {"from": "retain", "to": "embeddings", "label": "生成嵌入"},
    {"from": "recall", "to": "embeddings", "label": "查询嵌入"},
    {"from": "recall", "to": "reranker", "label": "结果重排序"},
    {"from": "reflect", "to": "llm_wrapper", "label": "深度分析"},
    {"from": "retain", "to": "postgres", "label": "写入"},
    {"from": "recall", "to": "postgres", "label": "查询"},
    {"from": "reflect", "to": "postgres", "label": "查询"},
    {"from": "control_plane", "to": "http_api", "label": "管理界面"}
  ],
  "styles": {
    "primaryColor": "#eff6ff",
    "borderColor": "#2563eb",
    "textColor": "#1e40af"
  }
}
```

### 核心组件说明

#### 1. HTTP API 层 (FastAPI)
**文件路径**: `/hindsight-api/hindsight_api/api/http.py` (3,429 行)

核心职责:
- 提供 RESTful API 接口
- 请求验证和参数解析
- 异步操作管理

关键端点:
```python
# 存储记忆
POST /v1/{tenant}/banks/{bank_id}/memories/retain

# 检索记忆
POST /v1/{tenant}/banks/{bank_id}/memories/recall

# 反思分析
POST /v1/{tenant}/banks/{bank_id}/reflect
```

#### 2. 记忆引擎 (Memory Engine)
**文件路径**: `/hindsight-api/hindsight_api/engine/memory_engine.py` (5,771 行)

核心特性:
- 仿生记忆架构实现
- 多租户 Schema 隔离
- 时序链接、语义链接、实体链接管理
- 扩散激活搜索算法

代码示例:
```python
# Schema 隔离机制
_current_schema: contextvars.ContextVar[str | None] = contextvars.ContextVar("current_schema", default=None)

def fq_table(table_name: str) -> str:
    """获取带 Schema 前缀的表名"""
    return f"{get_current_schema()}.{table_name}"
```

#### 3. Retain 管道
**文件路径**: `/hindsight-api/hindsight_api/engine/retain/orchestrator.py` (23,322 行)

子模块:
- `fact_extraction.py` (64,749 字节): LLM 驱动的事实提取
- `entity_processing.py`: 实体识别和规范化
- `link_creation.py`: 实体链接创建
- `embedding_processing.py`: 嵌入向量生成
- `fact_storage.py`: 事实持久化

工作流程:
1. 内容分块 (LangChain TextSplitter)
2. LLM 提取事实、实体、关系
3. 实体规范化和去重
4. 生成嵌入向量
5. 创建时序/语义/实体链接
6. 存储到 PostgreSQL

#### 4. Recall 检索系统
**文件路径**: `/hindsight-api/hindsight_api/engine/search/retrieval.py` (51,572 字节)

四路并行检索:
```python
# 1. 语义检索 (向量相似度)
semantic_results = await retrieve_semantic(conn, query_emb, bank_id, limit)

# 2. BM25 检索 (全文搜索)
bm25_results = await retrieve_bm25(conn, query, bank_id, limit)

# 3. 图谱检索 (实体关系遍历)
graph_results = await graph_retriever.retrieve(conn, query, bank_id, limit)

# 4. 时序检索 (时间范围过滤)
temporal_results = await retrieve_temporal(conn, query, bank_id, time_range)
```

检索策略:
- **MPFP (Multi-Path Fact Propagation)**: `/search/mpfp_retrieval.py` (24,461 字节)
- **BFS Graph Retrieval**: `/search/graph_retrieval.py` (10,161 字节)
- **Link Expansion**: `/search/link_expansion_retrieval.py` (16,497 字节)

融合与重排序:
- 使用交叉编码器 (cross-encoder/ms-marco-MiniLM-L-6-v2)
- 倒数排名融合 (Reciprocal Rank Fusion)

#### 5. Reflect 反思模块
**文件路径**: `/hindsight-api/hindsight_api/engine/reflect/agent.py`

功能:
- 基于记忆的深度推理
- 支持工具调用 (Tool Calling)
- 气质感知响应 (Disposition-aware)
- 心智模型构建

#### 6. LLM 包装器
**文件路径**: `/hindsight-api/hindsight_api/engine/llm_wrapper.py` (22,662 字节)

支持的提供商:
- OpenAI (GPT-4, GPT-3.5, o3-mini)
- Anthropic (Claude Sonnet/Opus)
- Google Gemini
- Groq
- Ollama (本地部署)
- LM Studio (本地部署)
- Vertex AI

特性:
- 自动重试和指数退避
- 并发控制和速率限制
- Token 使用跟踪

#### 7. 数据库层 (PostgreSQL + pgvector)
**Schema 文件**: `/hindsight-api/hindsight_api/alembic/versions/5a366d414dce_initial_schema.py`

核心表结构:
```sql
-- 记忆库
CREATE TABLE banks (
    bank_id TEXT PRIMARY KEY,
    personality JSONB DEFAULT '{}'::jsonb,
    background TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 记忆单元
CREATE TABLE memory_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id TEXT NOT NULL,
    text TEXT NOT NULL,
    embedding VECTOR(384),
    fact_type TEXT DEFAULT 'world',
    event_date TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 实体
CREATE TABLE entities (
    id UUID PRIMARY KEY,
    canonical_name TEXT NOT NULL,
    bank_id TEXT NOT NULL,
    metadata JSONB
);

-- 实体链接
CREATE TABLE entity_links (
    from_entity_id UUID,
    to_entity_id UUID,
    link_type TEXT,
    strength FLOAT
);

-- 记忆链接
CREATE TABLE memory_links (
    from_unit_id UUID,
    to_unit_id UUID,
    link_type TEXT,
    weight FLOAT
);
```

索引优化:
- pgvector 向量索引 (HNSW 或 IVFFlat)
- 全文搜索索引 (GIN on tsvector)
- 实体名称索引 (LOWER(canonical_name))
- 复合索引 (bank_id + link_type)

## 3. 云服务需求分析

### 3.1 计算资源

#### API 服务器配置
**最小配置**:
- vCPU: 2 核
- 内存: 4 GB
- 用途: 处理 HTTP 请求、LLM API 调用

**推荐配置**:
- vCPU: 4-8 核
- 内存: 8-16 GB
- 用途: 并发处理 Retain/Recall 操作

**本地模型配置** (使用本地嵌入和重排序):
- vCPU: 8-16 核
- 内存: 16-32 GB
- GPU: 可选 (NVIDIA T4 或更高,加速推理)

#### 后台任务处理
- 异步整合任务 (Consolidation)
- 心智模型刷新 (Mental Model Refresh)
- 建议使用独立 Worker 进程

实际实现:
```python
# hindsight-api/hindsight_api/worker/main.py
# 支持 Celery/RQ 式后台任务队列
```

#### 实际使用的计算服务
- **容器编排**: Docker / Docker Compose / Kubernetes
- **进程管理**: Uvicorn (ASGI 服务器)
- **并发控制**: asyncio + asyncpg (异步 I/O)

### 3.2 数据库服务

#### 主数据库类型和用途
**PostgreSQL 18** (推荐) 或 14+

必需扩展:
```sql
CREATE EXTENSION IF NOT EXISTS vector;  -- pgvector
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- 模糊匹配
```

实际使用的文件:
- 嵌入式数据库: `pg0-embedded` (Python 包,用于开发)
- 生产部署: 外部 PostgreSQL 实例

环境变量:
```bash
HINDSIGHT_API_DATABASE_URL=postgresql://user:pass@host:5432/db
HINDSIGHT_API_DATABASE_SCHEMA=public  # 多租户 Schema 隔离
```

#### Schema 设计

核心表数量: 12 个
- banks (记忆库)
- memory_units (记忆单元)
- memory_links (记忆链接)
- entities (实体)
- entity_links (实体关系)
- entity_cooccurrences (实体共现)
- documents (文档)
- chunks (分块)
- mental_models (心智模型)
- learnings (学习成果)
- directives (指令)
- async_operations (异步操作)

#### 性能要求
- **连接池**: 推荐 20-50 连接 (asyncpg)
- **索引类型**: HNSW (向量), GIN (全文), B-tree (标量)
- **存储估算**: 每 1 万条记忆约 500 MB (含向量)

### 3.3 对象存储

#### 文件存储需求
当前版本: **无对象存储依赖**

所有数据存储在 PostgreSQL:
- 文本内容: TEXT 列
- 元数据: JSONB 列
- 向量: VECTOR(384) 列

潜在扩展:
- 大文件附件存储 (如 PDF、图片)
- 建议使用: S3 / MinIO / Azure Blob

#### 实际使用的存储方案
- **本地开发**: SQLite (pg0-embedded)
- **生产环境**: PostgreSQL 本地存储 + 可选备份到对象存储

### 3.4 向量数据库

#### 向量存储方案
使用 **pgvector** (PostgreSQL 扩展),而非独立向量数据库

优势:
- 统一数据管理 (无需同步)
- 事务一致性
- 降低运维复杂度

#### 实际使用的向量数据库
**pgvector** (官方镜像: `pgvector/pgvector:pg18`)

Docker Compose 配置:
```yaml
services:
  db:
    image: pgvector/pgvector:pg18
    environment:
      POSTGRES_USER: hindsight_user
      POSTGRES_PASSWORD: ${HINDSIGHT_DB_PASSWORD}
    volumes:
      - pg_data:/var/lib/postgresql/18/docker
```

#### 嵌入维度和配置
- **默认模型**: `BAAI/bge-small-en-v1.5`
- **向量维度**: 384
- **距离度量**: 余弦相似度 (Cosine)
- **索引算法**: HNSW (默认) 或 IVFFlat

配置选项:
```python
# hindsight-api/hindsight_api/config.py
ENV_EMBEDDINGS_PROVIDER = "HINDSIGHT_API_EMBEDDINGS_PROVIDER"  # local 或 tei
ENV_EMBEDDINGS_LOCAL_MODEL = "BAAI/bge-small-en-v1.5"
```

### 3.5 AI 服务集成

#### LLM 提供商
支持的 API:
1. **OpenAI**: GPT-4, o3-mini (推荐用于事实提取)
2. **Anthropic**: Claude Sonnet 4.5, Opus (推荐用于反思)
3. **Google Gemini**: Gemini 2.0 Flash
4. **Groq**: 高速推理 (LLaMA, Mixtral)
5. **Ollama**: 本地部署 (Qwen 2.5, DeepSeek)
6. **LM Studio**: 本地推理服务器
7. **Vertex AI**: Google Cloud 托管

实际使用的 API:
```python
# hindsight-api/hindsight_api/engine/llm_wrapper.py
class LLMWrapper:
    def __init__(self, provider: str, api_key: str, model: str):
        if provider == "openai":
            self.client = OpenAI(api_key=api_key)
        elif provider == "anthropic":
            self.client = Anthropic(api_key=api_key)
        # ...
```

环境变量:
```bash
HINDSIGHT_API_LLM_PROVIDER=openai
HINDSIGHT_API_LLM_API_KEY=sk-xxx
HINDSIGHT_API_LLM_MODEL=o3-mini
```

#### Token 消耗估算

**Retain 操作** (每 1000 字符内容):
- 输入 Token: ~1,500 (内容 + 提示词)
- 输出 Token: ~500 (提取的事实)
- 总成本: ~$0.001 (使用 o3-mini)

**Recall 操作** (每次查询):
- Token 消耗: 0 (仅使用本地嵌入)
- 重排序: 无 LLM 调用

**Reflect 操作** (每次反思):
- 输入 Token: ~3,000 (查询 + 检索结果 + 提示词)
- 输出 Token: ~1,000 (深度分析)
- 总成本: ~$0.003 (使用 Claude Sonnet)

**月度估算** (中等规模):
- 1 万次 Retain: $10
- 10 万次 Recall: $0 (本地嵌入)
- 1 万次 Reflect: $30
- **总计**: ~$40/月 (仅 LLM 成本)

### 3.6 网络与 CDN

#### 网络架构
- **API 端口**: 8888 (HTTP)
- **管理界面端口**: 9999 (HTTP)
- **协议**: HTTP/1.1, WebSocket (MCP 服务器)

#### CDN 需求
**无 CDN 依赖**

原因:
- 主要为后端 API 服务
- 管理界面为内部工具 (不需要全球分发)

可选优化:
- 使用反向代理 (Nginx / Traefik)
- TLS 终止 (Caddy / Let's Encrypt)

### 3.7 部署复杂度

#### 部署方式

**1. Docker 单机部署** (最简单)
```bash
docker run -p 8888:8888 -p 9999:9999 \
  -e HINDSIGHT_API_LLM_API_KEY=$OPENAI_API_KEY \
  ghcr.io/vectorize-io/hindsight:latest
```

特点:
- 内置嵌入式 PostgreSQL (pg0)
- 预加载 ML 模型
- 适合开发/测试环境

**2. Docker Compose 部署** (推荐生产)
```yaml
services:
  db:
    image: pgvector/pgvector:pg18
  hindsight:
    image: ghcr.io/vectorize-io/hindsight:latest
    depends_on:
      - db
    environment:
      - HINDSIGHT_API_DATABASE_URL=postgresql://...
```

特点:
- 独立 PostgreSQL 实例
- 可持久化数据
- 适合生产环境

**3. Kubernetes 部署**
提供 Helm Chart:
```bash
helm install hindsight ./helm/hindsight \
  --set postgresql.enabled=true \
  --set llm.provider=openai
```

#### 容器化方案
**多阶段 Dockerfile** (402 行)

构建参数:
```dockerfile
ARG INCLUDE_API=true
ARG INCLUDE_CP=true
ARG INCLUDE_LOCAL_MODELS=true  # 是否包含本地 ML 模型
ARG PRELOAD_ML_MODELS=true     # 是否预下载模型
```

镜像大小:
- 完整镜像 (含 ML 模型): ~3.5 GB
- 精简镜像 (仅外部 API): ~800 MB
- 仅 API: ~600 MB
- 仅控制台: ~200 MB

#### CI/CD 流程
GitHub Actions 工作流:
```yaml
.github/workflows/release.yml
- 自动化测试 (pytest, 并行执行)
- 多架构构建 (amd64, arm64)
- 推送到 GitHub Container Registry
```

### 3.8 成本估算

#### 小规模 (<100 用户)

**计算资源**:
- 云 VM: 2 vCPU, 4 GB RAM
- 服务: DigitalOcean Droplet / AWS t3.medium
- 成本: **$24/月**

**数据库**:
- 托管 PostgreSQL: 1 vCPU, 2 GB RAM, 20 GB 存储
- 服务: DigitalOcean Managed Database
- 成本: **$15/月**

**LLM API**:
- OpenAI o3-mini
- 使用量: 5,000 次 Retain + 1,000 次 Reflect
- 成本: **$10/月**

**总计**: **$49/月**

#### 中等规模 (100-1,000 用户)

**计算资源**:
- 云 VM: 4 vCPU, 16 GB RAM
- 服务: AWS c6i.xlarge / GCP n2-standard-4
- 成本: **$120/月**

**数据库**:
- 托管 PostgreSQL: 4 vCPU, 16 GB RAM, 500 GB 存储
- 服务: AWS RDS / Google Cloud SQL
- 成本: **$200/月**

**LLM API**:
- OpenAI + Anthropic (混合使用)
- 使用量: 50,000 次 Retain + 10,000 次 Reflect
- 成本: **$100/月**

**负载均衡**:
- Application Load Balancer
- 成本: **$20/月**

**总计**: **$440/月**

#### 大规模 (>1,000 用户)

**计算资源** (Kubernetes 集群):
- 节点: 3 个 c6i.2xlarge (8 vCPU, 16 GB RAM 每个)
- 服务: AWS EKS / GKE
- 成本: **$480/月**

**数据库**:
- RDS Multi-AZ: 8 vCPU, 32 GB RAM, 2 TB 存储
- 备份和快照: 500 GB
- 成本: **$600/月**

**LLM API**:
- 企业级使用 (混合多个提供商)
- 使用量: 500,000 次 Retain + 100,000 次 Reflect
- 成本: **$1,000/月**

**网络和存储**:
- 数据传输: 500 GB/月
- 备份存储 (S3): 1 TB
- 成本: **$100/月**

**监控和日志**:
- Prometheus + Grafana Cloud
- OpenTelemetry 跟踪
- 成本: **$50/月**

**总计**: **$2,230/月**

### 3.9 云服务清单

| 服务类型 | 具体服务 | 是否必需 | 用途 |
|---------|---------|---------|------|
| **计算服务** | AWS EC2 / GCP Compute Engine | 是 | 运行 Hindsight API 服务器 |
| | AWS EKS / GKE | 否 | Kubernetes 编排 (大规模部署) |
| **数据库服务** | PostgreSQL 18+ (带 pgvector) | 是 | 记忆存储、向量检索 |
| | AWS RDS for PostgreSQL | 否 | 托管数据库服务 |
| | Google Cloud SQL | 否 | 托管数据库服务 |
| **容器服务** | Docker | 是 | 容器化部署 |
| | GitHub Container Registry | 否 | 镜像托管 |
| | AWS ECR / GCR | 否 | 私有镜像仓库 |
| **负载均衡** | AWS ALB / GCP Load Balancer | 否 | 流量分发 (中大规模) |
| **对象存储** | AWS S3 / GCS | 否 | 数据库备份、日志归档 |
| **AI 服务** | OpenAI API | 半必需 | LLM 推理 (可用其他提供商替代) |
| | Anthropic API | 否 | Claude 模型 (可选) |
| | Google Vertex AI | 否 | Gemini 模型 (可选) |
| | Ollama (自托管) | 否 | 本地 LLM 部署 |
| **嵌入服务** | HuggingFace TEI | 否 | 外部嵌入服务 (可用本地替代) |
| | Cohere Embed API | 否 | 商业嵌入服务 |
| **监控服务** | Prometheus | 否 | 指标收集 |
| | Grafana Cloud | 否 | 可视化和告警 |
| | OpenTelemetry Collector | 否 | 分布式追踪 |
| **网络服务** | Cloudflare / CloudFront | 否 | CDN (仅管理界面需要) |
| | Let's Encrypt | 否 | TLS 证书 |
| **版本控制** | GitHub | 否 | 代码仓库、CI/CD |

**最小必需服务组合**:
1. 云 VM (2 vCPU, 4 GB RAM)
2. PostgreSQL 18+ (可用嵌入式 pg0 替代)
3. OpenAI API (或任何兼容的 LLM 服务)

**总成本**: $24-49/月 (小规模)

## 4. 核心模块

### 模块列表

| 模块名称 | 文件路径 | 行数/大小 | 功能描述 |
|---------|---------|----------|---------|
| **记忆引擎** | `/hindsight-api/hindsight_api/engine/memory_engine.py` | 5,771 行 | 核心编排器,管理记忆的生命周期 |
| **HTTP API** | `/hindsight-api/hindsight_api/api/http.py` | 3,429 行 | FastAPI 路由和请求处理 |
| **Retain 编排器** | `/hindsight-api/hindsight_api/engine/retain/orchestrator.py` | 23,322 字节 | 记忆存储管道编排 |
| **事实提取** | `/hindsight-api/hindsight_api/engine/retain/fact_extraction.py` | 64,749 字节 | LLM 驱动的事实提取 |
| **检索引擎** | `/hindsight-api/hindsight_api/engine/search/retrieval.py` | 51,572 字节 | 四路并行检索实现 |
| **MPFP 检索** | `/hindsight-api/hindsight_api/engine/search/mpfp_retrieval.py` | 24,461 字节 | 多路径事实传播图检索 |
| **链接工具** | `/hindsight-api/hindsight_api/engine/retain/link_utils.py` | 33,078 字节 | 实体和记忆链接管理 |
| **LLM 包装器** | `/hindsight-api/hindsight_api/engine/llm_wrapper.py` | 22,662 字节 | 多提供商 LLM 抽象层 |
| **嵌入模型** | `/hindsight-api/hindsight_api/engine/embeddings.py` | 27,713 字节 | 向量嵌入生成 |
| **实体解析器** | `/hindsight-api/hindsight_api/engine/entity_resolver.py` | 23,794 字节 | 实体识别和规范化 |
| **重排序器** | `/hindsight-api/hindsight_api/engine/cross_encoder.py` | 32,994 字节 | 交叉编码器重排序 |
| **查询分析器** | `/hindsight-api/hindsight_api/engine/query_analyzer.py` | 19,741 字节 | 查询意图理解 |
| **反思代理** | `/hindsight-api/hindsight_api/engine/reflect/agent.py` | - | 基于工具调用的反思推理 |
| **配置管理** | `/hindsight-api/hindsight_api/config.py` | 38,978 字节 | 统一配置管理 |
| **MCP 服务器** | `/hindsight-api/hindsight_api/mcp_tools.py` | 45,479 字节 | Model Context Protocol 实现 |

### 模块间依赖关系

```
HTTP API
  ├─> Memory Engine
  │     ├─> Retain Pipeline
  │     │     ├─> Fact Extraction (LLM)
  │     │     ├─> Entity Resolver
  │     │     ├─> Embeddings Model
  │     │     └─> Link Utils
  │     ├─> Recall Pipeline
  │     │     ├─> Retrieval (4-way)
  │     │     │     ├─> Semantic (Vector)
  │     │     │     ├─> BM25 (Full-text)
  │     │     │     ├─> MPFP (Graph)
  │     │     │     └─> Temporal
  │     │     ├─> Fusion
  │     │     └─> Cross Encoder (Reranking)
  │     └─> Reflect Pipeline
  │           ├─> Query Analyzer
  │           ├─> Recall (复用)
  │           └─> LLM Wrapper
  └─> Database Pool (asyncpg)

Control Plane (Next.js)
  └─> HTTP API (代理所有请求)
```

## 5. 技术栈

### 编程语言及版本
- **Python**: 3.11+ (核心 API 和引擎)
- **TypeScript**: 5.9+ (客户端 SDK 和管理界面)
- **Rust**: 1.75+ (CLI 工具)
- **JavaScript**: ES2022 (Next.js 控制台)

### 核心框架

#### 后端框架
- **FastAPI**: 0.120.3+ (异步 HTTP 框架)
- **Uvicorn**: 0.38.0+ (ASGI 服务器)
- **asyncpg**: 0.29.0+ (异步 PostgreSQL 驱动)
- **SQLAlchemy**: 2.0.44+ (ORM 和查询构建器)
- **Alembic**: 1.17.1+ (数据库迁移)
- **Pydantic**: 2.0+ (数据验证)

#### 前端框架
- **Next.js**: 16.1.6 (React 框架,App Router)
- **React**: 19.2.0
- **Tailwind CSS**: 4.1.17 (样式框架)
- **shadcn/ui**: 最新 (组件库)

#### CLI 工具
- **Typer**: 0.9.0+ (Python CLI 框架)
- **Rust Clap**: 最新 (Rust CLI 解析)

### 主要依赖库

#### Python 依赖 (从 `hindsight-api/pyproject.toml` 提取)

**LLM 和 AI 服务**:
```toml
openai = ">=1.0.0"
anthropic = ">=0.40.0"
google-genai = ">=1.0.0"
cohere = ">=5.0.0"
```

**机器学习模型**:
```toml
sentence-transformers = ">=3.3.0"  # 嵌入模型
transformers = ">=4.53.0"          # HuggingFace 模型
torch = ">=2.6.0"                  # PyTorch 后端
flashrank = ">=0.2.0"              # 重排序
```

**数据库和向量**:
```toml
asyncpg = ">=0.29.0"               # 异步 PostgreSQL
pgvector = ">=0.4.1"               # 向量扩展
psycopg2-binary = ">=2.9.11"       # 同步驱动 (迁移用)
pg0-embedded = ">=0.11.0"          # 嵌入式数据库
```

**文本处理**:
```toml
langchain-text-splitters = ">=0.3.0"  # 文本分块
tiktoken = ">=0.12.0"                  # Token 计数
dateparser = ">=1.2.2"                 # 日期解析
```

**可观测性**:
```toml
opentelemetry-api = ">=1.20.0"
opentelemetry-sdk = ">=1.20.0"
opentelemetry-instrumentation-fastapi = ">=0.41b0"
opentelemetry-exporter-prometheus = ">=0.41b0"
```

**测试**:
```toml
pytest = ">=7.0.0"
pytest-asyncio = ">=0.21.0"
pytest-xdist = ">=3.0.0"  # 并行测试
pytest-timeout = ">=2.4.0"
```

**代码质量**:
```toml
ruff = ">=0.8.0"       # Linter + Formatter
ty = ">=0.0.1"         # 类型检查器 (Astral 出品)
```

#### TypeScript/Node.js 依赖 (从 `hindsight-control-plane/package.json` 提取)

**UI 组件**:
```json
"@radix-ui/react-dialog": "^1.1.15",
"@radix-ui/react-dropdown-menu": "^2.1.16",
"@radix-ui/react-select": "^2.2.6",
"lucide-react": "^0.553.0"
```

**可视化**:
```json
"cytoscape": "^3.33.1",         // 图谱可视化
"cytoscape-fcose": "^2.2.0",    // 力导向布局
"recharts": "^3.5.1",           // 图表
"react-chrono": "^2.9.1"        // 时间线
```

**内容展示**:
```json
"react-markdown": "^10.1.0",
"react18-json-view": "^0.2.9"
```

## 6. 部署架构

### 支持的部署方式

#### 1. Docker 单机部署 (Standalone)
**适用场景**: 开发、测试、小规模生产

特点:
- 单容器包含 API + 管理界面
- 内置嵌入式 PostgreSQL (pg0)
- 预加载 ML 模型
- 零配置启动

启动命令:
```bash
docker run --rm -it -p 8888:8888 -p 9999:9999 \
  -e HINDSIGHT_API_LLM_API_KEY=$OPENAI_API_KEY \
  -v $HOME/.hindsight-docker:/home/hindsight/.pg0 \
  ghcr.io/vectorize-io/hindsight:latest
```

#### 2. Docker Compose 部署 (推荐生产)
**适用场景**: 生产环境、持久化数据

配置文件: `/docker/docker-compose/docker-compose.yaml`

```yaml
services:
  db:
    image: pgvector/pgvector:pg18
    volumes:
      - pg_data:/var/lib/postgresql/18/docker

  hindsight:
    image: ghcr.io/vectorize-io/hindsight:latest
    environment:
      - HINDSIGHT_API_DATABASE_URL=postgresql://...
      - HINDSIGHT_API_LLM_API_KEY=${OPENAI_API_KEY}
    ports:
      - "8888:8888"
      - "9999:9999"
    depends_on:
      - db
```

特点:
- 独立 PostgreSQL 容器
- 数据持久化到 Docker Volume
- 支持水平扩展 (多 API 实例)

#### 3. Kubernetes 部署 (企业级)
**适用场景**: 大规模生产、高可用

Helm Chart 位置: `/helm/hindsight/`

安装命令:
```bash
helm install hindsight ./helm/hindsight \
  --set postgresql.enabled=true \
  --set postgresql.primary.persistence.size=100Gi \
  --set replicaCount=3 \
  --set resources.limits.memory=16Gi
```

特点:
- 自动伸缩 (HPA)
- 滚动更新
- 健康检查和自愈
- 服务发现

#### 4. Python 嵌入式部署 (无服务器)
**适用场景**: 库集成、测试

安装:
```bash
pip install hindsight-all -U
```

代码示例:
```python
from hindsight import HindsightServer, HindsightClient

with HindsightServer(
    llm_provider="openai",
    llm_model="gpt-4-turbo",
    llm_api_key=os.environ["OPENAI_API_KEY"]
) as server:
    client = HindsightClient(base_url=server.url)
    client.retain(bank_id="my-bank", content="...")
```

特点:
- 自动启动/停止服务器
- 适合单元测试
- 内存数据库 (默认)

### Docker 配置

#### 多阶段构建
**文件**: `/docker/standalone/Dockerfile` (402 行)

构建阶段:
1. **api-builder**: 编译 Python 依赖,创建虚拟环境
2. **sdk-builder**: 构建 TypeScript SDK
3. **cp-builder**: 构建 Next.js 控制台
4. **standalone**: 最终镜像 (API + 控制台)

构建参数:
```dockerfile
ARG INCLUDE_API=true              # 是否包含 API
ARG INCLUDE_CP=true               # 是否包含控制台
ARG INCLUDE_LOCAL_MODELS=true    # 是否包含本地 ML 模型
ARG PRELOAD_ML_MODELS=true       # 是否预下载模型
```

镜像优化:
- 多阶段构建减少镜像大小
- 预下载 ML 模型避免运行时下载
- 使用 `.dockerignore` 排除测试文件

#### 启动脚本
**文件**: `/docker/standalone/start-all.sh`

功能:
- 条件启动 API 或控制台
- 等待 PostgreSQL 就绪
- 自动运行数据库迁移
- 健康检查

### 环境变量

#### 必需变量
```bash
# LLM 配置
HINDSIGHT_API_LLM_PROVIDER=openai
HINDSIGHT_API_LLM_API_KEY=sk-xxx
HINDSIGHT_API_LLM_MODEL=o3-mini
```

#### 可选变量

**数据库**:
```bash
HINDSIGHT_API_DATABASE_URL=postgresql://user:pass@host:5432/db
HINDSIGHT_API_DATABASE_SCHEMA=public
```

**嵌入模型**:
```bash
HINDSIGHT_API_EMBEDDINGS_PROVIDER=local  # 或 tei, openai, cohere
HINDSIGHT_API_EMBEDDINGS_LOCAL_MODEL=BAAI/bge-small-en-v1.5
HINDSIGHT_API_EMBEDDINGS_TEI_URL=http://localhost:8080
```

**重排序器**:
```bash
HINDSIGHT_API_RERANKER_PROVIDER=local  # 或 tei, cohere, flashrank
HINDSIGHT_API_RERANKER_LOCAL_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2
```

**性能调优**:
```bash
HINDSIGHT_API_LLM_MAX_CONCURRENT=10     # LLM 并发数
HINDSIGHT_API_RECALL_MAX_CONCURRENT=4   # 检索并发数
HINDSIGHT_API_WORKERS=4                 # Uvicorn worker 数
```

**可观测性**:
```bash
HINDSIGHT_API_OTEL_TRACES_ENABLED=true
HINDSIGHT_API_OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
HINDSIGHT_API_LOG_LEVEL=info  # debug, info, warning, error
```

## 7. 工程实践

### 代码组织

#### 单体仓库 (Monorepo) 结构
```
hindsight/
├── hindsight-api/          # 核心 API 服务 (Python)
│   ├── hindsight_api/
│   │   ├── engine/         # 记忆引擎
│   │   │   ├── retain/     # 存储管道
│   │   │   ├── search/     # 检索系统
│   │   │   ├── reflect/    # 反思模块
│   │   │   └── providers/  # LLM 提供商
│   │   ├── api/            # HTTP/MCP 接口
│   │   ├── alembic/        # 数据库迁移
│   │   └── worker/         # 后台任务
│   └── tests/              # 测试
├── hindsight-control-plane/ # 管理界面 (Next.js)
├── hindsight-clients/      # SDK 客户端
│   ├── python/             # Python SDK
│   ├── typescript/         # TypeScript SDK
│   └── rust/               # Rust SDK
├── hindsight-cli/          # CLI 工具 (Rust)
├── hindsight-docs/         # 文档站点 (Docusaurus)
├── hindsight-embed/        # 嵌入式部署包
├── hindsight-integrations/ # 框架集成
│   ├── litellm/
│   ├── ai-sdk/
│   └── openclaw/
├── docker/                 # 容器配置
├── helm/                   # Kubernetes Helm Chart
└── scripts/                # 开发脚本
```

#### 模块化设计
- **关注点分离**: Engine (核心逻辑) 与 API (接口) 分离
- **依赖注入**: 通过参数传递 LLM、嵌入模型等依赖
- **插件化**: 支持自定义 GraphRetriever、Embeddings Provider

### 测试策略

#### 单元测试
**框架**: pytest + pytest-asyncio

配置 (`pyproject.toml`):
```toml
[tool.pytest.ini_options]
addopts = "--timeout 120 -n 8 --dist loadgroup --durations=10 -v"
asyncio_mode = "auto"
```

特点:
- 并行测试 (`pytest-xdist`, 8 个 worker)
- 超时保护 (120 秒)
- 异步测试支持

测试覆盖:
```
hindsight-api/tests/
├── test_retain.py              # Retain 管道测试
├── test_recall.py              # Recall 检索测试
├── test_http_api_integration.py # API 集成测试
├── test_entity_resolver.py     # 实体解析测试
└── fixtures/                   # 测试数据
```

#### 集成测试
**位置**: `/hindsight-integration-tests/`

测试场景:
- 端到端记忆存储和检索
- 多租户隔离验证
- 并发请求处理

#### 性能测试
**基准测试脚本**:
```bash
./scripts/benchmarks/run-longmemeval.sh  # LongMemEval 基准
./scripts/benchmarks/run-locomo.sh       # LoCoMo 基准
```

### 文档质量

#### 文档类型
1. **用户文档** (Docusaurus):
   - 快速开始指南
   - API 参考
   - 概念解释
   - 示例代码 (Cookbook)

2. **开发者文档**:
   - `CLAUDE.md`: Claude Code 开发指南
   - `CONTRIBUTING.md`: 贡献指南
   - 内联代码注释 (Docstring)

3. **API 文档**:
   - 自动生成 OpenAPI 规范
   - 交互式 API 浏览器 (Swagger UI)

#### 代码注释
Python Docstring 示例:
```python
async def retrieve_semantic(
    conn,
    query_emb_str: str,
    bank_id: str,
    fact_type: str,
    limit: int,
    tags: list[str] | None = None,
) -> list[RetrievalResult]:
    """
    语义检索通过向量相似度。

    Args:
        conn: 数据库连接
        query_emb_str: 查询向量 (PostgreSQL 格式字符串)
        bank_id: 记忆库 ID
        fact_type: 事实类型 (world, experience)
        limit: 返回结果数量
        tags: 可选标签过滤

    Returns:
        检索结果列表,按相似度排序
    """
```

#### 文档生成
```bash
# 生成 OpenAPI 规范
./scripts/generate-openapi.sh

# 生成客户端 SDK (基于 OpenAPI)
./scripts/generate-clients.sh
```

## 8. 安全机制

### 认证方式

#### JWT 认证 (可选)
**依赖**: `PyJWT[crypto]>=2.8.0`

实现位置: `/hindsight-api/hindsight_api/api/http.py`

认证流程:
1. 客户端携带 JWT Token (Bearer)
2. 服务器验证签名和过期时间
3. 提取租户信息 (tenant_id)

环境变量:
```bash
HINDSIGHT_API_JWT_SECRET=your-secret-key
HINDSIGHT_API_JWT_ALGORITHM=HS256
```

#### API Key 认证 (推荐简单场景)
**Header**: `X-API-Key: your-api-key`

实现:
```python
from fastapi import Security, HTTPException
from fastapi.security import APIKeyHeader

api_key_header = APIKeyHeader(name="X-API-Key")

async def verify_api_key(api_key: str = Security(api_key_header)):
    if api_key != os.environ["HINDSIGHT_API_KEY"]:
        raise HTTPException(status_code=403, detail="Invalid API Key")
```

#### 无认证模式 (开发/内网)
默认配置,适用于:
- 本地开发
- 内网部署 (VPC 隔离)
- 反向代理已处理认证

### 数据加密

#### 传输加密
**TLS/HTTPS**: 建议通过反向代理配置

Nginx 示例:
```nginx
server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8888;
    }
}
```

#### 静态加密
**数据库级别**: PostgreSQL 支持透明数据加密 (TDE)

AWS RDS 配置:
```bash
aws rds create-db-instance \
  --db-instance-identifier hindsight-db \
  --storage-encrypted \
  --kms-key-id your-kms-key
```

#### 敏感数据脱敏
API Key 日志脱敏:
```python
# hindsight-api/hindsight_api/utils.py
def mask_network_location(url: str) -> str:
    """脱敏 URL 中的凭证"""
    # postgresql://user:MASKED@host:5432/db
```

### API 安全

#### 速率限制
**未内置** (建议通过反向代理实现)

Nginx 配置:
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location /v1/ {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://localhost:8888;
}
```

#### CORS 配置
FastAPI 中间件:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```

#### SQL 注入防护
**参数化查询**: 所有数据库操作使用 asyncpg 参数绑定

安全示例:
```python
# 安全 (参数化)
await conn.fetch(
    "SELECT * FROM memory_units WHERE bank_id = $1",
    bank_id
)

# 不安全 (禁止)
await conn.fetch(f"SELECT * FROM memory_units WHERE bank_id = '{bank_id}'")
```

#### 多租户隔离
**PostgreSQL Schema 隔离**:

```python
# hindsight-api/hindsight_api/engine/memory_engine.py
_current_schema: contextvars.ContextVar[str | None] = contextvars.ContextVar("current_schema")

def fq_table(table_name: str) -> str:
    """强制表名带 Schema 前缀"""
    return f"{get_current_schema()}.{table_name}"

# 运行时验证
def validate_sql_schema(sql: str) -> None:
    """检查 SQL 是否包含无 Schema 表名"""
    if "FROM memory_units" in sql.upper():
        raise UnqualifiedTableError("Must use fq_table()")
```

保证:
- 不同租户数据物理隔离
- 防止跨租户数据泄露
- 每个连接绑定单一 Schema

## 9. 性能优化

### 缓存策略

#### 嵌入缓存
**无内存缓存** (数据库即缓存)

原理:
- 所有嵌入向量存储在 PostgreSQL
- pgvector 索引提供高效检索
- 避免内存和数据库不一致

#### LLM 响应缓存
**未实现** (建议通过外部工具)

可选方案:
- Redis 缓存相同查询的 LLM 响应
- LiteLLM 的缓存功能
- Semantic Cache (Couchbase, GPTCache)

#### 实体解析缓存
**会话级缓存**:

```python
# hindsight-api/hindsight_api/engine/entity_resolver.py
class EntityResolver:
    def __init__(self):
        self._entity_cache = {}  # canonical_name -> entity_id

    async def resolve(self, name: str, bank_id: str):
        cache_key = f"{bank_id}:{name.lower()}"
        if cache_key in self._entity_cache:
            return self._entity_cache[cache_key]
        # ...数据库查询...
        self._entity_cache[cache_key] = entity_id
```

生命周期: 单次请求内有效

### 并发处理

#### 异步 I/O
**asyncio + asyncpg**: 全栈异步

性能优势:
- 单线程处理 1000+ 并发请求
- 数据库连接池复用
- 非阻塞 LLM API 调用

代码示例:
```python
# 并行执行 4 种检索策略
results = await asyncio.gather(
    retrieve_semantic(conn, query, bank_id),
    retrieve_bm25(conn, query, bank_id),
    retrieve_graph(conn, query, bank_id),
    retrieve_temporal(conn, query, bank_id),
)
```

#### 连接池配置
**asyncpg 连接池**:

```python
# hindsight-api/hindsight_api/main.py
pool = await asyncpg.create_pool(
    database_url,
    min_size=5,      # 最小连接数
    max_size=20,     # 最大连接数
    command_timeout=60,
)
```

优化策略:
- 连接复用避免频繁建立
- 超时设置防止连接泄露
- 按需扩展到最大值

#### LLM 并发控制
**Semaphore 限流**:

```python
# hindsight-api/hindsight_api/config.py
ENV_LLM_MAX_CONCURRENT = "HINDSIGHT_API_LLM_MAX_CONCURRENT"  # 默认 10

# hindsight-api/hindsight_api/engine/llm_wrapper.py
class LLMWrapper:
    def __init__(self, max_concurrent: int):
        self._semaphore = asyncio.Semaphore(max_concurrent)

    async def generate(self, prompt: str):
        async with self._semaphore:
            return await self._client.generate(prompt)
```

目的:
- 避免 API 速率限制
- 控制成本
- 防止雪崩

### 资源优化

#### 本地模型优化
**CPU 推理优化**:

```python
# hindsight-api/hindsight_api/engine/embeddings.py
from sentence_transformers import SentenceTransformer

model = SentenceTransformer(
    "BAAI/bge-small-en-v1.5",
    device="cpu"  # 或 "cuda"
)

# 批量处理
embeddings = model.encode(
    texts,
    batch_size=32,
    show_progress_bar=False,
    normalize_embeddings=True
)
```

**GPU 加速** (可选):
```bash
docker run --gpus all \
  -e HINDSIGHT_API_EMBEDDINGS_LOCAL_FORCE_CPU=false \
  ghcr.io/vectorize-io/hindsight:latest
```

#### 向量索引优化
**pgvector 索引类型**:

```sql
-- HNSW 索引 (推荐,查询速度快)
CREATE INDEX ON memory_units
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- IVFFlat 索引 (数据量 < 100 万)
CREATE INDEX ON memory_units
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

配置权衡:
- HNSW: 查询快,构建慢,内存占用高
- IVFFlat: 查询稍慢,构建快,内存占用低

#### 数据库查询优化
**批量操作**:

```python
# 批量插入事实
await conn.executemany(
    """INSERT INTO memory_units (bank_id, text, embedding)
       VALUES ($1, $2, $3)""",
    [(bank_id, text, emb) for text, emb in facts]
)
```

**索引提示**:
```sql
-- 复合索引覆盖常见查询
CREATE INDEX idx_memory_units_bank_fact_type
ON memory_units(bank_id, fact_type);
```

#### 内存管理
**流式处理大文档**:

```python
# hindsight-api/hindsight_api/engine/retain/orchestrator.py
# 文档分块避免内存溢出
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=2000,
    chunk_overlap=200
)
chunks = splitter.split_text(large_document)
```

**连接预算控制**:
```python
# hindsight-api/hindsight_api/engine/db_budget.py
@budgeted_operation(max_wait=5.0)
async def recall_operation(conn):
    """限制数据库连接等待时间"""
```

## 10. 总结

### 架构优势

#### 1. 仿生设计的独特性
- **模拟人类记忆**: 区分世界事实、经验事实、心智模型,远超传统 RAG
- **学习能力**: 通过 Reflect 操作形成新洞察,而非简单存储检索
- **时序感知**: 天然支持时间旅行查询和记忆衰减

#### 2. 技术架构优势
- **多策略融合**: 语义 + BM25 + 图谱 + 时序并行检索,准确率业界领先
- **模块化设计**: 插件化 LLM、嵌入模型、检索策略,易于扩展
- **生产级代码**: 异步 I/O、连接池、重试机制、可观测性完备

#### 3. 部署灵活性
- **零配置启动**: Docker 单容器即可运行,内置数据库和 ML 模型
- **渐进式扩展**: 从单机部署到 Kubernetes 集群,无需重构
- **本地优先**: 默认使用本地模型,可离线运行,降低云成本

#### 4. 开发者友好
- **多语言 SDK**: Python、TypeScript、Rust 客户端
- **嵌入式部署**: `hindsight-all` 包支持库集成
- **完善文档**: 代码注释、API 文档、Cookbook 示例齐全

### 适用场景

#### 理想场景
1. **AI 员工系统**:
   - 需要跨会话学习用户偏好
   - 需要记住过往任务执行经验
   - 例: AI 项目经理、AI 销售代表

2. **个性化 AI 助手**:
   - 每个用户独立记忆库 (Memory Bank)
   - 学习用户习惯和上下文
   - 例: 个人助理、教育辅导

3. **长期推理 Agent**:
   - 需要从历史数据中提取模式
   - 需要时序推理能力
   - 例: 金融分析、医疗诊断

4. **多模态 AI 应用**:
   - 结合文本、图像、事件记忆
   - 需要实体关系图谱
   - 例: 智能家居、机器人

#### 不适合场景
1. **纯对话历史存储**: 如果只需要检索聊天记录,使用简单向量数据库更高效
2. **静态知识库**: 内容不变的文档检索,RAG 方案更简单
3. **极低延迟要求**: Reflect 操作涉及 LLM 调用,延迟 1-3 秒,不适合实时场景
4. **超小规模应用**: < 100 条记忆的场景,Hindsight 可能过度设计

### 局限性

#### 1. 成本考量
- **LLM 依赖**: Retain 和 Reflect 操作依赖 LLM API,高频使用成本显著
- **本地模型**: 使用 Ollama/LM Studio 可降低成本,但推理速度较慢
- **建议**: 小规模用本地模型,中大规模用云 API + 缓存优化

#### 2. 性能限制
- **写入延迟**: Retain 操作需要事实提取、实体解析、嵌入生成,平均 2-5 秒
- **扩展瓶颈**: 单数据库实例支持约 1000 并发用户,超出需要分片
- **建议**: 异步 Retain (后台处理) + 读写分离

#### 3. 复杂度
- **学习曲线**: 理解 Retain/Recall/Reflect 三操作范式需要时间
- **调试难度**: 记忆形成过程涉及 LLM,不确定性高,难以复现问题
- **建议**: 使用管理界面可视化记忆图谱,启用 OpenTelemetry 追踪

#### 4. 数据隐私
- **LLM 数据泄露风险**: 发送到 OpenAI/Anthropic 的内容可能用于训练
- **建议**: 敏感场景使用自托管 LLM (Ollama + Qwen 2.5)

#### 5. 向量数据库限制
- **pgvector 性能**: 1000 万向量以上性能下降,不如专用向量数据库 (Pinecone, Qdrant)
- **建议**: 超大规模场景考虑外部向量库 + PostgreSQL 混合架构

### 未来演进方向
- **多模态记忆**: 支持图像、音频嵌入
- **联邦学习**: 多 Agent 间共享记忆
- **自适应遗忘**: 智能清理低价值记忆
- **分布式图谱**: 跨实例实体解析

---

**文档版本**: 1.0
**生成时间**: 2026-02-12
**项目版本**: 0.4.10
**GitHub**: https://github.com/vectorize-io/hindsight