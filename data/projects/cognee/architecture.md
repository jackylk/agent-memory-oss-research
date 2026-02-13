# Cognee 架构分析

> 基于实际代码库分析 (Cognee v0.5.2)

## 1. 整体架构概述

**Cognee** 是一个开源AI记忆引擎,将原始数据转换为持久化、动态的知识图谱。它通过结合向量搜索、图数据库和LLM驱动的实体提取,为AI代理提供智能记忆系统。相比传统的RAG(检索增强生成)方法,Cognee提供了更智能的ECL(提取、认知化、加载)处理流程。

### 项目定位

- **应用领域**:知识管理、AI代理记忆、增强型RAG、研究论文分析
- **核心价值**:数据互联 + 混合检索 + 成本优化 + 本地优先
- **关键创新**:知识图谱+向量混合架构、多租户隔离、灵活LLM集成、ECL流程

### 核心价值主张

- 将任何数据类型互联(文本、对话、文件、图片、音频)
- 用图和向量替代传统数据库查询
- 降低开发者成本和基础设施成本
- 支持30+数据源的Pythonic数据管道
- 通过自定义任务和模块化管道实现高度定制性

### 与其他项目的差异

| 维度 | Cognee | Mem0 | Graphiti | Letta |
|------|--------|------|----------|-------|
| **核心概念** | 知识图谱+向量混合 | 结构化记忆 | 时态知识图谱 | 虚拟上下文 |
| **数据结构** | 图+向量 | 向量+关系 | 图+向量 | 关系+向量 |
| **本地支持** | ✅ 完全支持 | ⚠️ 部分支持 | ✅ 支持 | ⚠️ 限制 |
| **多LLM** | ✅ 10+ 提供商 | ✅ 支持 | ⚠️ 基础 | ✅ 支持 |
| **图数据库** | Kuzu/Neo4j/Neptune | 无 | 专有 | Neo4j |
| **向量库** | 8+ 选项 | 内置/集成 | 集成 | 3+ 选项 |
| **部署复杂度** | 低 | 中 | 中 | 高 |
| **适用场景** | 知识管理、RAG增强 | 个人AI记忆 | 知识建模 | 代理框架 |

---

## 2. 核心架构组件

### 架构分层图

```architecture
{
  "layers": [
    {
      "title": "API 层",
      "icon": "🔌",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "A1", "label": "FastAPI 应用入口" },
        { "id": "A2", "label": "路由器 (add/cognify/search/memify)" },
        { "id": "A3", "label": "认证和授权中间件" },
        { "id": "A4", "label": "异常处理器" }
      ]
    },
    {
      "title": "核心流程层",
      "icon": "⚙️",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "B1", "label": "add() - 数据摄入" },
        { "id": "B2", "label": "cognify() - 知识图谱生成" },
        { "id": "B3", "label": "search() - 查询和检索" },
        { "id": "B4", "label": "memify() - 图丰富化" },
        { "id": "B5", "label": "delete() - 数据删除" }
      ]
    },
    {
      "title": "管道执行层",
      "icon": "🔗",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "C1", "label": "任务编排引擎" },
        { "id": "C2", "label": "Pipeline 运行器" },
        { "id": "C3", "label": "批处理管理器" },
        { "id": "C4", "label": "缓存管理" }
      ]
    },
    {
      "title": "任务执行层",
      "icon": "📦",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "D1", "label": "数据分类任务" },
        { "id": "D2", "label": "文档分块任务" },
        { "id": "D3", "label": "图提取任务" },
        { "id": "D4", "label": "摘要任务" },
        { "id": "D5", "label": "数据存储任务" }
      ]
    },
    {
      "title": "领域模块层",
      "icon": "📚",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "E1", "label": "数据摄入模块" },
        { "id": "E2", "label": "文档处理模块" },
        { "id": "E3", "label": "分块/分割模块" },
        { "id": "E4", "label": "图模块" },
        { "id": "E5", "label": "检索模块" },
        { "id": "E6", "label": "搜索模块" }
      ]
    },
    {
      "title": "基础设施适配器层",
      "icon": "🔌",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "F1", "label": "关系数据库适配器" },
        { "id": "F2", "label": "图数据库适配器" },
        { "id": "F3", "label": "向量数据库适配器" },
        { "id": "F4", "label": "LLM 网关" },
        { "id": "F5", "label": "缓存适配器" },
        { "id": "F6", "label": "文件存储适配器" }
      ]
    },
    {
      "title": "外部服务",
      "icon": "🌐",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "G1", "label": "OpenAI/Claude/Gemini API" },
        { "id": "G2", "label": "Kuzu/Neo4j/Neptune" },
        { "id": "G3", "label": "LanceDB/ChromaDB/Pgvector" },
        { "id": "G4", "label": "S3/本地存储" }
      ]
    }
  ]
}
```

## 3. 云服务需求详细分析

### 3.1 计算资源需求

**CPU/内存/并发需求**

| 部署规模 | CPU | 内存 | 并发连接 | 吞吐量 |
|---------|-----|------|---------|--------|
| 开发 | 2核 | 4GB | 10 | 1-5 req/s |
| 小型(1K用户) | 4核 | 8GB | 50 | 10-20 req/s |
| 中型(10K用户) | 8核 | 16GB | 200 | 50-100 req/s |
| 大型(100K用户) | 16核+ | 32GB+ | 1000+ | 500+ req/s |

**用途和成本优势**:
- LLM 推理调用:需要稳定网络,计算开销由外部LLM API承担
- 文档处理:并行处理多个文档,提取文本和嵌入
- 图遍历:内存集约型,需要快速序列化/反序列化
- 向量操作:浮点计算密集,可利用GPU加速(可选)

**推荐配置**:
- 开发:本地开发机器
- 生产小型:云虚拟机(AWS t3.large/GCP e2-standard-4)
- 生产中型:容器化(ECS/GKE) + Auto Scaling
- 生产大型:Kubernetes集群 + 水平伸缩

### 3.2 数据库需求

**类型和配置**

| 数据库类型 | 默认选项 | 备选方案 | 存储容量 | 特殊需求 |
|-----------|--------|--------|--------|----------|
| 关系型 | SQLite | PostgreSQL | <50GB → 100GB+ | 事务支持、索引 |
| 图数据库 | Kuzu | Neo4j, Neptune | <10M节点 | 高效图遍历 |
| 向量库 | LanceDB | ChromaDB, Pgvector, Qdrant | 基于维度和数量 | HNSW索引 |

**用途和特殊需求**:
- **关系数据库**:存储元数据、用户信息、权限、数据集、处理状态
- **图数据库**:存储知识图谱、实体、关系、链接
- **向量数据库**:存储嵌入向量、文本块、支持语义搜索

**扩展策略**:
- SQLite → PostgreSQL (10K+ 用户)
- LanceDB → Qdrant/Weaviate (10M+ 向量)
- Kuzu → Neo4j Aura (1B+ 节点)

### 3.3 存储需求

**容量和用途**

| 阶段 | 原始数据 | 处理后数据 | 缓存 | 总计 |
|------|---------|----------|------|------|
| 开发 | 1GB | 500MB | 200MB | 2GB |
| 1K用户 | 50GB | 30GB | 10GB | 90GB |
| 10K用户 | 500GB | 300GB | 100GB | 900GB |
| 100K用户 | 5TB | 3TB | 1TB | 9TB |

**访问模式**:
- **顺序读写**:文档上传、处理日志
- **随机读**:embedding查询、图遍历
- **高频读**:缓存命中

**成本**:$0.023/GB/月 (S3 Standard)

### 3.4 向量数据库需求

**索引和性能**

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| 向量维度 | 1536 (OpenAI) / 384 (fastembed) | 基于embedding模型 |
| 索引类型 | HNSW | 快速近邻搜索 |
| 查询性能 | <100ms (top-10) | P99延迟 |
| 批量插入 | 10K向量/秒 | 单节点性能 |

**成本分析(月度)**

| 提供商 | 存储成本 | 查询成本 | 总月成本 |
|--------|--------|--------|---------|
| LanceDB(本地) | $0 | $0 | $0 |
| Qdrant Cloud | $50-500 | 按查询 | $100-1000 |
| Weaviate Cloud | $60-600 | 按查询 | $150-1200 |
| Pinecone | $70-500 | 按查询 | $200-1500 |

**可选方案**:
- LanceDB:轻量级、无需部署
- Qdrant:高性能、自托管或云端
- Weaviate:企业功能、社区支持良好
- Pgvector:与PostgreSQL集成
- Milvus:自托管、高可用

### 3.5 AI 服务需求

**LLM提供商对比**

| 提供商 | 模型 | 成本(1M tokens) | 延迟 |
|--------|------|----------------|------|
| OpenAI | GPT-4o, GPT-4o-mini | $3-15 | 500-2000ms |
| Anthropic | Claude 3.x | $3-20 | 800-3000ms |
| Google | Gemini | $0.075-6 | 1000-4000ms |
| Ollama | 本地开源 | $0 | 2000-10000ms |
| Groq | Mixtral等 | $0.27-0.4 | <100ms |

**Embedding模型**

| 提供商 | 模型 | 维度 | 成本 |
|--------|------|------|------|
| OpenAI | text-embedding-3-large | 3072 | $0.02/1M tokens |
| OpenAI | text-embedding-3-small | 1536 | $0.02/1M tokens |
| HuggingFace | bge-base-en-v1.5 | 768 | $0 (自托管) |

**成本估算(月度)**

| 场景 | LLM成本 | Embedding成本 | 总成本 |
|------|--------|-------------|--------|
| 小型(1K用户,10GB) | $100 | $50 | $150 |
| 中型(10K用户,100GB) | $1,000 | $500 | $1,500 |
| 大型(100K用户,1TB) | $10,000 | $5,000 | $15,000 |

**外部服务选项**:
- OpenAI (ChatGPT, Embeddings)
- Anthropic (Claude)
- Google Gemini
- Mistral
- Ollama (本地)
- Groq (超低延迟)

### 3.6 网络和 CDN

**全球节点**:
- 多地域部署(美国、欧洲、亚洲)
- CDN加速静态资源和API响应
- 低延迟LLM调用(选择最近节点)

**DDoS 防护**:自动,通过云提供商WAF
**SSL/TLS**:自动证书,所有连接加密
**带宽**:

| 场景 | 平均请求大小 | QPS | 月带宽 |
|------|-----------|-----|--------|
| 开发 | 10KB | 1 | 2.6GB |
| 小型 | 50KB | 10 | 130GB |
| 中型 | 100KB | 50 | 1.3TB |
| 大型 | 500KB | 200 | 26TB |

### 3.7 部署复杂度评估

| 维度 | 评分 (1-10) | 说明 |
|------|-------------|------|
| **基础设施配置** | 3 | 默认支持本地开发,云部署需配置 |
| **数据库管理** | 5 | 多个数据库选项,需适配器切换 |
| **LLM集成** | 2 | 自动支持多提供商,配置简单 |
| **CI/CD 复杂度** | 4 | Docker支持,GHA工作流存在 |
| **监控和日志** | 6 | structlog + 可选Sentry/Langfuse |
| **权限和多租户** | 7 | 需要启用ENABLE_BACKEND_ACCESS_CONTROL |
| **扩展性** | 4 | 模块化任务系统,易于定制 |
| **总体复杂度** | **4** | 中等难度,本地简单,云复杂 |

### 3.8 成本估算(月度)

**小规模部署(1000活跃用户)**
- 计算:AWS t3.medium (2核4GB) = $30
- 数据库:PostgreSQL managed = $40
- 向量DB:Qdrant Cloud starter = $50
- LLM调用:$100 (100M tokens)
- 存储:100GB S3 = $2.3
- CDN:10GB outbound = $0.85
- **总计:$223/月**

**中等规模(10000用户)**
- 计算:ECS cluster (4x t3.large) = $240
- 数据库:RDS PostgreSQL = $120
- 向量DB:Qdrant Cloud professional = $300
- LLM调用:$1,000 (1B tokens)
- 存储:1TB S3 = $23
- CDN:500GB outbound = $42.50
- 监控:Sentry/Langfuse = $100
- **总计:$1,826/月**

**大规模(100000用户)**
- 计算:EKS cluster (20 nodes) = $3,000
- 数据库:RDS PostgreSQL (r6i.2xlarge) = $2,500
- 向量DB:自托管Qdrant (3 node) = $1,500
- LLM调用:$10,000 (10B tokens)
- 存储:10TB S3 = $230
- CDN:5TB outbound = $425
- 监控和日志:$500
- **总计:$18,155/月**

### 3.9 必需的云服务清单

✅ **必需**:
- LLM API (OpenAI/Anthropic/Azure等)
- 关系数据库 (SQLite/PostgreSQL)
- 向量数据库 (LanceDB/Qdrant/Weaviate)
- 图数据库 (Kuzu/Neo4j)

⚠️ **推荐**:
- 对象存储 (S3/GCS/Azure Blob)
- CDN (CloudFront/Cloudflare)
- 监控和日志 (CloudWatch/Datadog/Sentry)
- 缓存 (Redis)

🔧 **可选**:
- GPU计算 (本地LLM推理)
- 消息队列 (RabbitMQ/Kafka)
- 容器注册表 (ECR/GCR)
- 配置管理 (AWS Secrets Manager)

---

## 4. 核心模块详解

### 4.1 API 层

**位置**:`cognee/api/v1/`

**核心端点**:
- `POST /add` - 数据摄入(支持文件、文本、URL)
- `POST /cognify` - 知识图谱生成
- `POST /search` - 查询和检索(支持多种搜索类型)
- `POST /memify` - 图丰富化和规则应用
- `DELETE /delete` - 数据删除
- `GET /datasets` - 数据集管理
- `POST /users` - 用户认证和管理

### 4.2 数据摄入模块

**位置**:`cognee/modules/ingestion/`

**任务流程**:
1. `resolve_data_directories()` - 递归解析文件路径和URL
2. `ingest_data()` - 调用文档加载器,提取内容
3. 支持的数据源:本地文件、S3路径、HTTP/HTTPS URL、文本字符串

**关键文件**:`cognee/tasks/ingestion/ingest_data.py`

### 4.3 文档处理模块

**位置**:`cognee/infrastructure/loaders/`

**支持的加载器**:
- PDFLoader - PDF文档
- DOCXLoader - Word文档
- CSVLoader - CSV文件
- ImageLoader - OCR图片
- AudioLoader - 音频转录
- CodeLoader - 代码树形解析

### 4.4 Cognify 管道

**位置**:`cognee/api/v1/cognify/cognify.py`

**任务序列**:
```python
1. classify_documents - 文档分类
2. extract_chunks_from_documents - 文本分块
3. extract_graph_from_data - 图提取(LLM)
4. summarize_text - 摘要生成
5. add_data_points - 持久化到数据库
```

### 4.5 搜索和检索模块

**位置**:`cognee/modules/retrieval/`

**支持的搜索类型**:
- `GRAPH_COMPLETION` - 图遍历+LLM补全
- `RAG_COMPLETION` - 传统RAG
- `CHUNKS` - 向量相似度搜索
- `SUMMARIES` - 摘要检索
- `TRIPLET_COMPLETION` - 三元组搜索
- `CYPHER` - 原始Cypher查询
- `FEELING_LUCKY` - 自动选择搜索类型
- `TEMPORAL` - 时间感知搜索

### 4.6 图数据库抽象

**位置**:`cognee/infrastructure/databases/graph/`

**接口**:
```python
class GraphDBInterface:
    async def add_node(node: DataPoint)
    async def add_edge(edge: Edge)
    async def get_node(node_id: str) -> DataPoint
    async def query_graph(query: str) -> List[Result]
```

**支持的后端**:Kuzu (默认)、Neo4j、Neptune

### 4.7 向量数据库抽象

**位置**:`cognee/infrastructure/databases/vector/`

**接口**:
```python
async def add_embeddings(vectors, metadata)
async def search(query_vector, top_k) -> List[SearchResult]
async def delete_embeddings(ids)
```

**支持的后端**:LanceDB、ChromaDB、Pgvector、Qdrant、Weaviate、Milvus

### 4.8 LLM 网关

**位置**:`cognee/infrastructure/llm/`

**使用示例**:
```python
from cognee.infrastructure.llm.get_llm_client import get_llm_client

llm_client = get_llm_client()
response = await llm_client.acreate_structured_output(
    text_input="Your prompt",
    system_prompt="System instructions",
    response_model=YourPydanticModel
)
```

**支持的提供商**:OpenAI、Azure OpenAI、Anthropic、Google Gemini、Ollama、Mistral、Groq、AWS Bedrock

---

## 5. 技术栈

### 5.1 前端

- **框架**:Next.js (React)
- **语言**:TypeScript
- **样式**:TailwindCSS
- **可视化**:Plotly

### 5.2 后端

- **语言**:Python 3.10-3.13
- **框架**:FastAPI
- **ORM**:SQLAlchemy
- **验证**:Pydantic
- **迁移**:Alembic

### 5.3 数据库

- **关系型**:SQLite (默认)、PostgreSQL
- **图数据库**:Kuzu (默认)、Neo4j、Neptune
- **向量库**:LanceDB (默认)、ChromaDB、Qdrant、Weaviate

### 5.4 存储

- **本地**:文件系统
- **云**:AWS S3 (s3fs+boto3)

### 5.5 AI 服务

- **OpenAI**:ChatGPT、Embeddings
- **Anthropic**:Claude
- **Google**:Gemini
- **其他**:Mistral、Ollama、Groq
- **统一调用**:litellm、Instructor、BAML

### 5.6 认证

- **框架**:FastAPI-users
- **Token**:API Bearer Token
- **默认**:认证禁用(可配置)

### 5.7 监控

- **日志**:structlog
- **错误追踪**:Sentry (可选)
- **LLM观测**:Langfuse (可选)
- **分析**:PostHog (可选)

### 5.8 DevOps

- **容器**:Docker + Docker Compose
- **编排**:Kubernetes (Helm)
- **CI/CD**:GitHub Actions
- **代码质量**:Pre-commit hooks

### 5.9 质量工具

- **测试**:pytest
- **类型检查**:mypy
- **Linter**:ruff
- **格式化**:ruff

---

## 6. 部署架构

### 6.1 开发环境

**本地设置**:
```bash
# 创建虚拟环境
uv venv
source .venv/bin/activate

# 安装依赖
uv pip install -e ".[dev,postgres,neo4j]"

# 配置环境变量
cp .env.template .env
# 编辑 .env,设置 LLM_API_KEY

# 启动开发
python examples/python/simple_example.py

# 或使用 CLI
cognee-cli add "Your text"
cognee-cli cognify
cognee-cli search "Your query"

# 启动 UI
cognee-cli -ui
```

**默认数据库配置**(零配置):
- 关系DB:SQLite
- 图DB:Kuzu
- 向量DB:LanceDB

### 6.2 生产环境

**Docker Compose**:
```bash
# 启动核心服务
docker-compose up cognee

# 带 UI 和 Neo4j
docker-compose --profile ui --profile neo4j up

# 所有服务
docker-compose --profile neo4j --profile chromadb --profile postgres --profile redis up
```

**Kubernetes (Helm)**:
```bash
helm install cognee ./deployment/helm/
helm install cognee ./deployment/helm/ -f custom-values.yaml
```

**关键环境变量**:
```bash
# LLM配置(必需)
LLM_API_KEY="your_key"
LLM_MODEL="openai/gpt-4o-mini"

# 数据库选择
DB_PROVIDER="postgres"
GRAPH_DATABASE_PROVIDER="neo4j"
VECTOR_DB_PROVIDER="chromadb"

# 存储后端
STORAGE_BACKEND="s3"
STORAGE_BUCKET_NAME="my-bucket"

# 安全性
REQUIRE_AUTHENTICATION=True
ENABLE_BACKEND_ACCESS_CONTROL=True
```

---

## 7. 工程实践

### 7.1 代码质量

```bash
# Linting
ruff check .

# Formatting
ruff format .

# Type Checking
mypy cognee/

# Pre-commit
pre-commit run --all-files
```

**代码风格**:
- 行长:100字符
- 字符串:双引号
- 导入:自动排序

### 7.2 测试

```bash
# 运行所有测试
pytest

# 带覆盖率
pytest --cov=cognee --cov-report=html

# 特定类型
pytest cognee/tests/unit/
pytest cognee/tests/integration/
```

**测试结构**:
```
cognee/tests/
├── unit/              # 单元测试
├── integration/       # 集成测试
├── cli_tests/         # CLI测试
└── test_data/         # 测试数据
```

### 7.3 CI/CD

**GitHub Actions**:
1. 代码检查:ruff lint + mypy
2. 单元测试:pytest
3. 集成测试:完整流程
4. 镜像构建:Docker
5. 部署:自动部署(可选)

**分支策略**:
- `main` - 生产发布
- `dev` - 主开发分支
- `feature/*` - 特性分支
- `bugfix/*` - 修复分支

---

## 8. 安全和隐私

### 8.1 加密

- **TLS/SSL**:所有API通信
- **密钥存储**:环境变量或密钥管理
- **数据库连接**:可配置SSL模式

### 8.2 访问控制

- **多租户隔离**:每个用户+数据集独立
- **权限系统**:基于角色的访问控制(RBAC)
- **行级安全**:数据库级权限

**权限配置**:
```bash
ENABLE_BACKEND_ACCESS_CONTROL=True
# 权限类型:read, write, delete, share
```

### 8.3 合规性

- **数据最小化**:只收集必要信息
- **删除功能**:支持完全删除
- **审计日志**:structlog记录所有操作
- **GDPR友好**:数据导出和删除

**安全环境变量**:
```bash
ACCEPT_LOCAL_FILE_PATH=False  # 生产建议
ALLOW_HTTP_REQUESTS=False
ALLOW_CYPHER_QUERY=False
REQUIRE_AUTHENTICATION=True
```

---

## 9. 性能优化

### 9.1 缓存

| 缓存层 | 技术 | TTL | 用途 |
|--------|------|-----|------|
| L1 | Python内存 | 5分钟 | 管道中间结果 |
| L2 | Redis | 1小时 | 会话、图遍历 |
| L3 | 数据库索引 | 持久 | 频繁查询 |

### 9.2 索引

```python
# 向量数据库:HNSW索引
# 图数据库:边类型索引、属性索引
# 关系数据库:复合索引(user_id, dataset_id)
```

### 9.3 流式处理

```python
# 大文件处理
async for chunk in process_large_file(file_path):
    await process_chunk(chunk)

# 流式搜索
async for result in search_iterator(query):
    yield result
```

### 9.4 异步队列

```python
# 后台处理
await cognee.cognify(run_in_background=True)

# 批处理
data_per_batch=20
chunks_per_batch=100
```

**性能瓶颈**:
1. **LLM延迟**:最大瓶颈(500-3000ms/call)
2. **向量搜索**:次要瓶颈(100-500ms)
3. **图遍历**:内存密集
4. **数据库IO**:I/O密集

**优化建议**:
```python
LLM_PROVIDER="groq"  # 使用低延迟LLM
use_pipeline_cache=True  # 启用缓存
top_k=10  # 限制搜索范围
run_in_background=True  # 异步处理
```

---

## 10. 总结

Cognee 的架构设计体现了以下核心原则:

1. **本地优先** - 默认支持零配置本地开发
2. **灵活适配** - 支持多数据库后端,易于切换
3. **模块化设计** - 任务和管道高度可组合
4. **多LLM支持** - 不绑定单一提供商
5. **生产就绪** - 内置多租户、权限、监控

**适用场景**:
- 企业知识管理系统
- AI代理记忆系统
- 增强型RAG应用
- 代码理解和搜索
- 研究论文分析
- 客户支持知识库

**云服务推荐**:

| 规模 | 推荐配置 | 成本 |
|------|--------|------|
| 开发 | 本地 + OpenAI API | $100-200/月 |
| 小型(1K) | 单VM + RDS + Qdrant Cloud | $300-500/月 |
| 中型(10K) | ECS/GKE + RDS + Qdrant | $2K-3K/月 |
| 大型(100K+) | K8s + 自托管数据库 | $15K+/月 |

**迁移路径**:
```
SQLite + LanceDB + Kuzu (开发)
            ↓
PostgreSQL + Qdrant Cloud + Neo4j Aura (中等)
            ↓
RDS PostgreSQL + 自托管Qdrant + Neo4j Enterprise (大型)
```

---

**文档版本**:v1.0
**更新日期**:2025-02-12
**基础版本**:Cognee v0.5.2
