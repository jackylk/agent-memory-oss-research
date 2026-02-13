# Hindsight 云服务需求分析

## 1. 计算资源

### 1.1 API 服务器配置

#### 最小配置
- **vCPU**: 2 核
- **内存**: 4 GB
- **用途**: 处理 HTTP 请求、LLM API 调用

#### 推荐配置
- **vCPU**: 4-8 核
- **内存**: 8-16 GB
- **用途**: 并发处理 Retain/Recall 操作

#### 本地模型配置
使用本地嵌入和重排序模型时:
- **vCPU**: 8-16 核
- **内存**: 16-32 GB
- **GPU**: 可选 (NVIDIA T4 或更高,加速推理)

### 1.2 后台任务处理
- 异步整合任务 (Consolidation)
- 心智模型刷新 (Mental Model Refresh)
- 建议使用独立 Worker 进程

#### 实际实现
- 支持 Celery/RQ 式后台任务队列
- 文件位置: `hindsight-api/hindsight_api/worker/main.py`

### 1.3 实际使用的计算服务
- **容器编排**: Docker / Docker Compose / Kubernetes
- **进程管理**: Uvicorn (ASGI 服务器)
- **并发控制**: asyncio + asyncpg (异步 I/O)

## 2. 数据库服务

### 2.1 主数据库类型和用途

**PostgreSQL 18** (推荐) 或 14+

#### 必需扩展
```sql
CREATE EXTENSION IF NOT EXISTS vector;  -- pgvector
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- 模糊匹配
```

#### 实际使用
- **嵌入式数据库**: `pg0-embedded` (Python 包,用于开发)
- **生产部署**: 外部 PostgreSQL 实例

#### 环境变量
```bash
HINDSIGHT_API_DATABASE_URL=postgresql://user:pass@host:5432/db
HINDSIGHT_API_DATABASE_SCHEMA=public  # 多租户 Schema 隔离
```

### 2.2 Schema 设计

#### 核心表数量: 12 个
- **banks** (记忆库)
- **memory_units** (记忆单元)
- **memory_links** (记忆链接)
- **entities** (实体)
- **entity_links** (实体关系)
- **entity_cooccurrences** (实体共现)
- **documents** (文档)
- **chunks** (分块)
- **mental_models** (心智模型)
- **learnings** (学习成果)
- **directives** (指令)
- **async_operations** (异步操作)

#### 核心表结构
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

### 2.3 索引优化
- **pgvector 向量索引**: HNSW 或 IVFFlat
- **全文搜索索引**: GIN on tsvector
- **实体名称索引**: LOWER(canonical_name)
- **复合索引**: bank_id + link_type

### 2.4 性能要求
- **连接池**: 推荐 20-50 连接 (asyncpg)
- **索引类型**: HNSW (向量), GIN (全文), B-tree (标量)
- **存储估算**: 每 1 万条记忆约 500 MB (含向量)

## 3. 对象存储

### 3.1 文件存储需求

**当前版本**: 无对象存储依赖

所有数据存储在 PostgreSQL:
- **文本内容**: TEXT 列
- **元数据**: JSONB 列
- **向量**: VECTOR(384) 列

### 3.2 潜在扩展
- 大文件附件存储 (如 PDF、图片)
- 建议使用: S3 / MinIO / Azure Blob

### 3.3 实际使用的存储方案
- **本地开发**: SQLite (pg0-embedded)
- **生产环境**: PostgreSQL 本地存储 + 可选备份到对象存储

## 4. 向量数据库

### 4.1 向量存储方案

使用 **pgvector** (PostgreSQL 扩展),而非独立向量数据库

#### 优势
- 统一数据管理 (无需同步)
- 事务一致性
- 降低运维复杂度

### 4.2 实际使用的向量数据库

**pgvector** (官方镜像: `pgvector/pgvector:pg18`)

#### Docker Compose 配置
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

### 4.3 嵌入维度和配置
- **默认模型**: `BAAI/bge-small-en-v1.5`
- **向量维度**: 384
- **距离度量**: 余弦相似度 (Cosine)
- **索引算法**: HNSW (默认) 或 IVFFlat

#### 配置选项
```python
# hindsight-api/hindsight_api/config.py
ENV_EMBEDDINGS_PROVIDER = "HINDSIGHT_API_EMBEDDINGS_PROVIDER"  # local 或 tei
ENV_EMBEDDINGS_LOCAL_MODEL = "BAAI/bge-small-en-v1.5"
```

## 5. AI 服务集成

### 5.1 LLM 提供商

支持的 API:
1. **OpenAI**: GPT-4, o3-mini (推荐用于事实提取)
2. **Anthropic**: Claude Sonnet 4.5, Opus (推荐用于反思)
3. **Google Gemini**: Gemini 2.0 Flash
4. **Groq**: 高速推理 (LLaMA, Mixtral)
5. **Ollama**: 本地部署 (Qwen 2.5, DeepSeek)
6. **LM Studio**: 本地推理服务器
7. **Vertex AI**: Google Cloud 托管

#### 环境变量
```bash
HINDSIGHT_API_LLM_PROVIDER=openai
HINDSIGHT_API_LLM_API_KEY=sk-xxx
HINDSIGHT_API_LLM_MODEL=o3-mini
```

### 5.2 Token 消耗估算

#### Retain 操作 (每 1000 字符内容)
- **输入 Token**: ~1,500 (内容 + 提示词)
- **输出 Token**: ~500 (提取的事实)
- **总成本**: ~$0.001 (使用 o3-mini)

#### Recall 操作 (每次查询)
- **Token 消耗**: 0 (仅使用本地嵌入)
- **重排序**: 无 LLM 调用

#### Reflect 操作 (每次反思)
- **输入 Token**: ~3,000 (查询 + 检索结果 + 提示词)
- **输出 Token**: ~1,000 (深度分析)
- **总成本**: ~$0.003 (使用 Claude Sonnet)

### 5.3 月度估算 (中等规模)
- **1 万次 Retain**: $10
- **10 万次 Recall**: $0 (本地嵌入)
- **1 万次 Reflect**: $30
- **总计**: ~$40/月 (仅 LLM 成本)

## 6. 网络与 CDN

### 6.1 网络架构
- **API 端口**: 8888 (HTTP)
- **管理界面端口**: 9999 (HTTP)
- **协议**: HTTP/1.1, WebSocket (MCP 服务器)

### 6.2 CDN 需求

**无 CDN 依赖**

#### 原因
- 主要为后端 API 服务
- 管理界面为内部工具 (不需要全球分发)

#### 可选优化
- 使用反向代理 (Nginx / Traefik)
- TLS 终止 (Caddy / Let's Encrypt)

## 7. 部署复杂度

### 7.1 部署方式

#### 1. Docker 单机部署 (最简单)
```bash
docker run -p 8888:8888 -p 9999:9999 \
  -e HINDSIGHT_API_LLM_API_KEY=$OPENAI_API_KEY \
  ghcr.io/vectorize-io/hindsight:latest
```

**特点**:
- 内置嵌入式 PostgreSQL (pg0)
- 预加载 ML 模型
- 适合开发/测试环境

#### 2. Docker Compose 部署 (推荐生产)
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

**特点**:
- 独立 PostgreSQL 实例
- 可持久化数据
- 适合生产环境

#### 3. Kubernetes 部署
提供 Helm Chart:
```bash
helm install hindsight ./helm/hindsight \
  --set postgresql.enabled=true \
  --set llm.provider=openai
```

### 7.2 容器化方案

#### 多阶段 Dockerfile (402 行)

**构建参数**:
```dockerfile
ARG INCLUDE_API=true
ARG INCLUDE_CP=true
ARG INCLUDE_LOCAL_MODELS=true  # 是否包含本地 ML 模型
ARG PRELOAD_ML_MODELS=true     # 是否预下载模型
```

#### 镜像大小
- **完整镜像** (含 ML 模型): ~3.5 GB
- **精简镜像** (仅外部 API): ~800 MB
- **仅 API**: ~600 MB
- **仅控制台**: ~200 MB

### 7.3 CI/CD 流程

GitHub Actions 工作流:
- 自动化测试 (pytest, 并行执行)
- 多架构构建 (amd64, arm64)
- 推送到 GitHub Container Registry

## 8. 成本估算

### 8.1 小规模 (<100 用户)

#### 计算资源
- **云 VM**: 2 vCPU, 4 GB RAM
- **服务**: DigitalOcean Droplet / AWS t3.medium
- **成本**: **$24/月**

#### 数据库
- **托管 PostgreSQL**: 1 vCPU, 2 GB RAM, 20 GB 存储
- **服务**: DigitalOcean Managed Database
- **成本**: **$15/月**

#### LLM API
- **OpenAI o3-mini**
- **使用量**: 5,000 次 Retain + 1,000 次 Reflect
- **成本**: **$10/月**

**总计**: **$49/月**

### 8.2 中等规模 (100-1,000 用户)

#### 计算资源
- **云 VM**: 4 vCPU, 16 GB RAM
- **服务**: AWS c6i.xlarge / GCP n2-standard-4
- **成本**: **$120/月**

#### 数据库
- **托管 PostgreSQL**: 4 vCPU, 16 GB RAM, 500 GB 存储
- **服务**: AWS RDS / Google Cloud SQL
- **成本**: **$200/月**

#### LLM API
- **OpenAI + Anthropic** (混合使用)
- **使用量**: 50,000 次 Retain + 10,000 次 Reflect
- **成本**: **$100/月**

#### 负载均衡
- **Application Load Balancer**
- **成本**: **$20/月**

**总计**: **$440/月**

### 8.3 大规模 (>1,000 用户)

#### 计算资源 (Kubernetes 集群)
- **节点**: 3 个 c6i.2xlarge (8 vCPU, 16 GB RAM 每个)
- **服务**: AWS EKS / GKE
- **成本**: **$480/月**

#### 数据库
- **RDS Multi-AZ**: 8 vCPU, 32 GB RAM, 2 TB 存储
- **备份和快照**: 500 GB
- **成本**: **$600/月**

#### LLM API
- **企业级使用** (混合多个提供商)
- **使用量**: 500,000 次 Retain + 100,000 次 Reflect
- **成本**: **$1,000/月**

#### 网络和存储
- **数据传输**: 500 GB/月
- **备份存储 (S3)**: 1 TB
- **成本**: **$100/月**

#### 监控和日志
- **Prometheus + Grafana Cloud**
- **OpenTelemetry 跟踪**
- **成本**: **$50/月**

**总计**: **$2,230/月**

## 9. 云服务清单

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

### 9.1 最小必需服务组合
1. 云 VM (2 vCPU, 4 GB RAM)
2. PostgreSQL 18+ (可用嵌入式 pg0 替代)
3. OpenAI API (或任何兼容的 LLM 服务)

**总成本**: $24-49/月 (小规模)

## 10. 部署建议

### 10.1 开发环境
- 使用 Docker 单机部署
- 内置嵌入式数据库
- 本地 ML 模型
- **成本**: 免费 (仅需开发机器)

### 10.2 小规模生产
- Docker Compose 部署
- 托管 PostgreSQL
- OpenAI API
- **成本**: $49/月

### 10.3 中大规模生产
- Kubernetes 集群
- AWS RDS Multi-AZ
- 混合 LLM 提供商
- 负载均衡 + 监控
- **成本**: $440-2,230/月

### 10.4 成本优化建议
1. **使用本地模型**: Ollama + Qwen 2.5 可节省 LLM 成本
2. **缓存优化**: 实现 LLM 响应缓存减少 API 调用
3. **异步处理**: Retain 操作后台执行,降低实时资源压力
4. **读写分离**: PostgreSQL 主从复制分担查询负载
5. **按需扩展**: 使用 Kubernetes HPA 根据流量自动伸缩
