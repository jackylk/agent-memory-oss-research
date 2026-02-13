# memU 架构分析

> 基于实际代码库分析 (memU v1.4.0)

## 1. 整体架构概述

**memU** 是一个为 **24/7 长期运行的 AI 代理** 设计的内存管理框架,核心使命是在生产环境中实现 **持续学习、自动记忆、主动智能** 的代理系统。

### 项目定位

- **应用领域**:长期运行的 AI 代理、个人助手、多轮对话系统
- **核心价值**:文件系统式分层记忆 + 成本优化 + 实时可用 + 主动学习
- **关键创新**:双模态检索、工作流系统、零延迟处理、多提供商兼容

### 核心价值主张

- **文件系统隐喻**:将记忆组织为分层目录结构,支持交叉引用和符号链接
- **双模态检索**:RAG(快速嵌入搜索) + LLM(深度推理)的混合检索策略
- **主动学习管道**:持续监控用户交互,自动提取知识、技能、行为模式
- **零延迟处理**:记忆立即可用,支持实时上下文注入
- **多提供商兼容**:OpenAI、Grok、Qwen、Doubao、OpenRouter 等 LLM 无缝切换

### 与其他项目的差异

| 维度 | memU | Mem0 | Graphiti | Letta |
|------|------|------|----------|-------|
| **核心概念** | 文件系统式分层记忆 | 扁平化向量存储 | 知识图谱型 | 对话历史型 |
| **架构设计** | 分层目录结构 | 向量为主 | 图谱为主 | 历史为主 |
| **主动性** | ✅ 24/7 主动监控 | ⚠️ 被动响应 | ✅ 图谱推理 | ⚠️ 反应式 |
| **成本优化** | ✅ 核心设计目标 | ⚠️ 优化有限 | ⚠️ 图遍历开销大 | ⚠️ 完整历史加载 |
| **多模态** | ✅ 文本/视频/音频/图像 | ✅ 基础支持 | ⚠️ 主要文本 | ⚠️ 主要对话 |
| **扩展性** | ✅ 工作流可定制 | ✅ 模块化但有限 | ⚠️ 图谱固定 | ⚠️ 框架固定 |

---

## 2. 核心架构组件

### 架构分层图

```architecture
{
  "layers": [
    {
      "title": "应用层",
      "icon": "📱",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "A1", "label": "MemoryService 核心接口" },
        { "id": "A2", "label": "MemorizeMixin (存储)" },
        { "id": "A3", "label": "RetrieveMixin (检索)" },
        { "id": "A4", "label": "CRUDMixin (管理)" }
      ]
    },
    {
      "title": "工作流层",
      "icon": "⚙️",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "B1", "label": "WorkflowRunner (执行器)" },
        { "id": "B2", "label": "PipelineManager (管道)" },
        { "id": "B3", "label": "WorkflowStep (步骤)" },
        { "id": "B4", "label": "WorkflowInterceptor (拦截器)" }
      ]
    },
    {
      "title": "智能处理层",
      "icon": "🧠",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "C1", "label": "LLM 处理" },
        { "id": "C2", "label": "嵌入处理" },
        { "id": "C3", "label": "多模态处理" },
        { "id": "C4", "label": "提示工程" }
      ]
    },
    {
      "title": "存储层",
      "icon": "💾",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "D1", "label": "元数据存储" },
        { "id": "D2", "label": "向量索引" },
        { "id": "D3", "label": "资源存储" },
        { "id": "D4", "label": "仓库接口" }
      ]
    },
    {
      "title": "数据模型层",
      "icon": "📊",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "E1", "label": "Resource (资源)" },
        { "id": "E2", "label": "MemoryItem (记忆项)" },
        { "id": "E3", "label": "MemoryCategory (分类)" },
        { "id": "E4", "label": "CategoryItem (关系)" }
      ]
    }
  ]
}
```

## 3. 云服务需求详细分析

### 3.1 计算资源需求

**小规模部署(1,000活跃用户)**
- CPU:2-4 vCPU
- 内存:4-8GB
- 并发:10-20 并发推理请求
- 推荐:共享主机或小型 VPS

**中等规模(10,000用户)**
- CPU:8-16 vCPU
- 内存:16-32GB
- 并发:100-200 请求/秒
- 推荐:Kubernetes 集群(3 Master + 5 Worker)

**大规模(100,000+用户)**
- CPU:64+ vCPU(分布式)
- 内存:256+ GB
- 并发:1000+ 请求/秒
- 推荐:大规模 Kubernetes 集群

**用途和成本优势**:
- LLM 请求转发和响应处理
- 向量嵌入计算
- 异步任务排队
- 会话管理和缓存

### 3.2 数据库需求

**元数据存储**

| 规模 | 活跃用户 | 记忆项 | 存储容量 | 推荐配置 |
|------|---------|--------|--------|---------|
| 小型 | 1K | ~50K | 500MB | SQLite |
| 中型 | 10K | ~500K | 5GB | PostgreSQL |
| 大型 | 100K+ | ~5M+ | 50GB+ | PostgreSQL Citus |

**用途和特殊需求**:
- 存储对话消息、事实、会话元数据
- 知识图谱存储(语义三元组)
- 实体-流程-会话三层追踪
- 备份:每日全量 + 小时增量
- 恢复:时间点恢复(PITR)能力

**扩展策略**:
- SQLite → PostgreSQL(10K+ 用户)
- PostgreSQL 单机 → Citus 集群(100K+ 用户)
- 按 user_id 分片

### 3.3 存储需求

**资源存储**

| 类型 | 大小 | 用途 |
|------|------|------|
| 对话 JSON | 5-50KB | 会话历史 |
| 文档 | 100KB-10MB | PDF/Markdown |
| 图像 | 500KB-5MB | 截图/上传 |
| 视频 | 10-500MB | 录制/讲座 |

**容量需求**:
- 小规模:5GB(本地文件系统)
- 中等规模:50GB(本地 NAS 或 S3)
- 大规模:500GB+(分布式存储)

**成本**:
- 本地存储:免费
- S3 Standard:$0.023/GB/月
- S3 + CloudFront:$0.085/GB 出站流量

### 3.4 向量数据库需求

**索引类型和性能**

| 方案 | 优点 | 缺点 | 推荐场景 |
|------|------|------|---------|
| **pgvector(HNSW)** | 与 PostgreSQL 集成、免费 | 查询 ~500ms(大规模) | <1M 向量 |
| **Milvus** | 向量专用、超快、分布式 | 需另外部署 | >1M 向量 |
| **Pinecone** | 完全托管、自动扩展 | 按向量计费 | 快速上线 |
| **内存向量** | 零延迟 | 数据丢失风险 | 开发/测试 |

**向量配置**:
- 维度:1536(OpenAI text-embedding-3-small)
- 索引类型:HNSW
- 相似度度量:余弦相似度

**成本**:
- pgvector:免费
- Milvus:自托管免费
- Pinecone:$0.25-1/M 向量/月

### 3.5 AI 服务需求

**LLM 成本估算(月度)**

| 模型 | 输入价格 | 输出价格 | 月成本(10K用户) |
|------|---------|---------|----------------|
| GPT-4o-mini | $0.00015/1K | $0.0006/1K | ~$300 |
| GPT-4o | $0.005/1K | $0.015/1K | ~$10,000 |
| Claude 3.5 Sonnet | $0.003/1K | $0.015/1K | ~$6,000 |
| Grok-2 | $0.00002/1K | $0.0001/1K | ~$25 |

**嵌入成本**:
- OpenAI:$0.00002/1K tokens
- Voyage AI:$0.0001/1K tokens
- 本地 BGE-Large:免费

**月成本分解(10K用户)**:
- LLM(记忆提取):$300
- 嵌入(向量化):$50
- **总 AI 成本:~$350/月**

**支持的提供商**:
- OpenAI(gpt-4o, gpt-4o-mini)
- Anthropic(Claude 3.x)
- Google(Gemini)
- xAI(Grok)
- OpenRouter(任何支持的模型)

### 3.6 网络和 CDN

**带宽需求**:

| 场景 | 数据量 | 频率 | 月度 |
|------|--------|------|------|
| 资源上传 | 500KB-5MB | 10/用户/周 | 50GB |
| 记忆检索 | 10-50KB | 5/用户/天 | 5GB |
| API 响应 | 1-10KB | 每秒数百 | 50-100GB |

**推荐架构**:
- CloudFlare/AWS CloudFront(CDN)
- API 网关(负载均衡)
- 应用服务器 × N

**SSL/TLS**:免费(Let's Encrypt)

### 3.7 部署复杂度评估

| 维度 | 评分 (1-10) | 说明 |
|------|-------------|------|
| **基础设施配置** | 6 | 需要配置 PostgreSQL、Redis、LLM API 密钥 |
| **数据库管理** | 7 | pgvector 配置、向量索引维护、分片管理 |
| **CI/CD 复杂度** | 5 | Python uv 包管理,但 Rust 扩展编译有复杂性 |
| **监控和日志** | 6 | 需追踪 LLM 调用、工作流执行、向量搜索性能 |
| **总体复杂度** | **6** | 中等复杂度,关键是 LLM 集成和向量搜索调优 |

### 3.8 成本估算(月度)

**小规模部署(1,000活跃用户)**
- 计算:2vCPU, 4GB = $10-20
- 数据库:SQLite(本地) = 免费
- 存储:5GB 本地 = 免费
- 向量索引:pgvector = 免费
- LLM API:GPT-4o-mini = $300
- 嵌入 API:text-embedding-3-small = $50
- **总计:~$360/月**

**中等规模(10,000用户)**
- 计算:Kubernetes(3M+5W) = $1,000
- 数据库:PostgreSQL db.r5.xlarge = $800
- 存储:AWS S3 50GB = $1.25
- Redis:r5.large = $200
- LLM API:GPT-4o-mini = $3,000
- 嵌入 API:$500
- 网络:CloudFlare Pro = $200
- 监控:DataDog = $300
- **总计:~$6,000/月**

**大规模(100,000+用户)**
- 计算:Kubernetes(50+ nodes) = $10,000
- 数据库:PostgreSQL Citus(10分片) = $5,000
- 存储:S3 500GB + CloudFront = $500
- Milvus 集群:$2,000
- Redis 集群:$1,000
- LLM API(混合本地模型):$30,000
- 网络:企业 CDN = $2,000
- 监控:ELK Stack = $2,000
- **总计:~$52,500/月**

### 3.9 必需的云服务清单

✅ **必需**:
- LLM API(OpenAI/Grok/OpenRouter)
- 嵌入 API(OpenAI/Voyage/本地)
- 元数据数据库(PostgreSQL/SQLite)
- 应用服务器(虚拟主机/Kubernetes)

⚠️ **推荐**:
- 向量索引(pgvector/Milvus)
- 对象存储(S3/MinIO)
- CDN(CloudFlare/AWS CloudFront)
- 缓存(Redis)
- APM(DataDog/New Relic)

🔧 **可选**:
- 消息队列(RabbitMQ/Kafka)
- 图数据库(Neo4j)
- Full-Text Search(Elasticsearch)
- WebSocket Gateway

---

## 4. 核心模块详解

### 4.1 MemoryService

**位置**:`/src/memu/app/service.py`

统一服务入口,整合记忆存储、检索、管理功能。

**主要职责**:
- 初始化 LLM、数据库、文件系统客户端
- 管理工作流管道(memorize, retrieve_rag, retrieve_llm)
- 提供拦截器注册机制
- 延迟初始化避免网络开销

### 4.2 记忆类型系统

**位置**:`/src/memu/prompts/memory_type/`

6 种核心记忆类型:
- **profile**:用户个人信息(年龄、职业、兴趣)
- **event**:重要事件和发生过的事情
- **knowledge**:学到的知识和事实
- **behavior**:行为模式和习惯
- **skill**:掌握的技能和专长
- **tool**:工具使用经验和最佳实践

### 4.3 自动分类系统

**位置**:`/src/memu/app/settings.py`

10 个预定义分类:
- personal_info(个人信息)
- preferences(偏好设置)
- relationships(人际关系)
- activities(活动和兴趣)
- goals(目标和志向)
- experiences(经历和事件)
- knowledge(知识和学习)
- opinions(观点和见解)
- habits(习惯和模式)
- work_life(工作和职业)

### 4.4 数据模型

**位置**:`/src/memu/database/models.py`

```python
class Resource(BaseRecord):
    """原始输入资源"""
    url: str
    modality: str  # conversation/document/image/video/audio
    local_path: str
    embedding: list[float]

class MemoryItem(BaseRecord):
    """具体的记忆事实"""
    resource_id: str
    memory_type: str  # profile|event|knowledge|behavior|skill|tool
    summary: str
    embedding: list[float]
    happened_at: datetime
    extra: dict

class MemoryCategory(BaseRecord):
    """10个预定义分类"""
    name: str
    description: str
    embedding: list[float]
    summary: str

class CategoryItem(BaseRecord):
    """多对多关系"""
    item_id: str
    category_id: str
```

### 4.5 工作流引擎

**位置**:`/src/memu/workflow/step.py`

工作流管道定义:
- 记忆存储管道(memorize)
- RAG 检索管道(retrieve_rag)
- LLM 检索管道(retrieve_llm)
- CRUD 操作管道

**关键特性**:
- 步骤间数据流管理(requires/produces)
- 拦截器支持(before/after/on_error)
- 支持顺序和 DAG 执行

### 4.6 LLM 多提供商支持

**位置**:`/src/memu/llm/`

支持的提供商:
- OpenAI(gpt-4o, gpt-4o-mini)
- Grok(grok-2-latest)
- Qwen(qwen3-max)
- Doubao(via LazyLLM)
- OpenRouter(任何支持的模型)

**客户端后端**:
- sdk:官方 OpenAI SDK
- httpx:通用 HTTP 客户端
- lazyllm_backend:LazyLLM 框架

---

## 5. 技术栈

### 5.1 后端

- **语言**:Python 3.13+
- **异步框架**:asyncio, httpx 0.28.1+
- **ORM**:SQLModel 0.0.27+, Alembic 1.14.0+
- **数据验证**:Pydantic 2.12.4+

### 5.2 数据库

- **关系型**:SQLite, PostgreSQL
- **向量索引**:pgvector 0.3.4+
- **可选**:Milvus, Pinecone

### 5.3 AI 服务

- **LLM**:openai 2.8.0+
- **嵌入**:sentence-transformers
- **工作流**:自定义引擎(无外部依赖)

### 5.4 开发工具

- **包管理**:uv(最新)
- **Linting**:ruff 0.14.3+, mypy 1.18.2+
- **测试**:pytest 8.4.2+, pytest-asyncio 0.24.0+
- **构建**:maturin 1.0+, pyo3 0.27.1+(Rust 扩展)

---

## 6. 部署架构

### 6.1 开发环境

```bash
git clone https://github.com/NevaMind-AI/memU.git
cd memU
make install  # 使用 uv 安装
export OPENAI_API_KEY=sk-proj-xxx
python tests/test_inmemory.py
```

### 6.2 生产环境

**Docker Compose**:
```yaml
version: '3.8'
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: memu
      POSTGRES_USER: memu
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  memu-api:
    build: .
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      DATABASE_URL: postgresql://memu:${DB_PASSWORD}@postgres:5432/memu
    ports:
      - "8000:8000"
```

### 6.3 Kubernetes 部署

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: memu-api
spec:
  replicas: 5
  template:
    spec:
      containers:
      - name: memu
        image: ghcr.io/nevamind-ai/memu:latest
        resources:
          requests:
            memory: "4Gi"
            cpu: "2"
          limits:
            memory: "8Gi"
            cpu: "4"
```

---

## 7. 工程实践

### 7.1 代码质量

```bash
make check  # Ruff + mypy + deptry
uv run ruff check src/
uv run mypy src/
```

### 7.2 测试

```bash
make test  # 生成覆盖率报告
tests/test_inmemory.py
tests/test_postgres.py
```

### 7.3 CI/CD

GitHub Actions 自动化:
- Lint Job:Ruff 格式检查
- Security Job:Bandit + pip-audit
- Type Check:mypy
- Test Job:Python 3.10/3.11/3.12/3.13
- Coverage:Codecov 上传

---

## 8. 安全和隐私

### 8.1 数据加密

- 传输中:HTTPS/TLS 1.3
- 存储:PostgreSQL EBS 加密或 LUKS
- API 密钥:环境变量(不硬编码)

### 8.2 数据隔离

```python
class User(BaseModel):
    user_id: str
    workspace_id: str  # 多租户

# 查询自动过滤
where_filters = {"user_id": current_user_id}
```

### 8.3 合规性

- GDPR:用户删除权、数据导出
- 审计日志:所有 API 调用记录
- 保留期:90 天

---

## 9. 性能优化

### 9.1 缓存策略

```python
@lru_cache(maxsize=1000)
async def get_categories(user_id: str):
    return await db.memory_category_repo.list(...)
```

### 9.2 向量搜索优化

```sql
CREATE INDEX ON memory_items USING hnsw (
    embedding vector_cosine_ops
) WITH (m = 16, ef_construction = 200);

SET hnsw.ef_search = 100;
```

### 9.3 流式处理

```python
async def process_large_file(path: str):
    chunk_size = 4096
    async with open(path) as f:
        while chunk := await f.read(chunk_size):
            yield await embed(chunk)
```

### 9.4 异步处理

```python
async def memorize_with_background_tasks(resource_url):
    result = await store_memory(resource_url)
    asyncio.create_task(update_category_summaries())
    return result
```

---

## 10. 总结

memU 的架构设计体现了以下核心原则:

1. **分层记忆架构** - 文件系统隐喻使记忆组织直观易用
2. **成本优先** - 双模态检索平衡成本和精度
3. **实时可用** - 零延迟处理,新记忆立即可查询
4. **灵活可扩展** - 工作流系统支持深度定制
5. **生产就绪** - 严格类型检查、完整测试、企业级安全

**适用场景**:
- 24/7 长期运行的 AI 代理
- 需要理解用户意图的个人助手
- 多轮复杂对话的上下文管理
- 需要成本优化的大规模部署

**云服务推荐**:

| 规模 | 推荐配置 | 成本 |
|------|--------|------|
| 小型(1K) | SQLite + 本地 + OpenAI API | ~$360/月 |
| 中型(10K) | PostgreSQL + Kubernetes + OpenAI | ~$6K/月 |
| 大型(100K+) | Citus 集群 + Milvus + 混合模型 | ~$52K/月 |

---

**文档版本**:v1.0
**更新日期**:2025-02-12
**基础版本**:memU v1.4.0
**Python 版本**:3.13+
