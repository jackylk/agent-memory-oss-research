# Mem0 架构分析

> 基于实际代码库分析 (mem0ai/mem0 v1.0.3)

## 1. 整体架构概述

Mem0 是一个为 AI 代理提供长期记忆能力的智能记忆层系统。其架构采用**三层存储设计**：向量存储、图数据库和历史数据库，通过可插拔的组件设计支持多种后端实现。

### 核心架构组件

```architecture
{
  "layers": [
    {
      "title": "Client Layer",
      "icon": "🔌",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "A1", "label": "MemoryClient" },
        { "id": "A2", "label": "AsyncMemoryClient" },
        { "id": "A3", "label": "FastAPI Server" }
      ]
    },
    {
      "title": "Core Memory Layer",
      "icon": "🧠",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "B1", "label": "Multi-level Filtering" },
        { "id": "B2", "label": "Memory Extraction" },
        { "id": "B3", "label": "Fact Retrieval" }
      ]
    },
    {
      "title": "Storage Layer",
      "icon": "💾",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "C1", "label": "Vector Store (26+ impl)" },
        { "id": "C2", "label": "Graph Store (Neo4j)" },
        { "id": "C3", "label": "History DB (SQLite)" }
      ]
    },
    {
      "title": "Supporting Services",
      "icon": "⚙️",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "D1", "label": "LLM Provider (15+ models)" },
        { "id": "D2", "label": "Embeddings (10+ models)" },
        { "id": "D3", "label": "Reranker (5 methods)" }
      ]
    }
  ]
}
```

## 2. 核心模块详解

### 2.1 Memory 核心类 (mem0/memory/main.py)

**主要职责**：
- 记忆的提取、存储、检索和更新
- 多层级会话管理（user_id, agent_id, run_id）
- Actor-based 记忆隔离
- 智能去重和版本管理

**关键方法**：
```python
class Memory(MemoryBase):
    def add(messages, user_id=None, agent_id=None, run_id=None, metadata=None)
    def get(memory_id, user_id=None, agent_id=None, run_id=None)
    def get_all(user_id=None, agent_id=None, run_id=None, filters=None)
    def search(query, user_id=None, agent_id=None, run_id=None, limit=100)
    def update(memory_id, data)
    def delete(memory_id)
    def delete_all(user_id=None, agent_id=None, run_id=None)
    def reset()
```

**记忆处理流程**：
1. **输入解析** → 提取 messages 中的事实信息（使用 LLM）
2. **向量化** → 通过 Embedder 生成向量表示
3. **检索相关记忆** → 在向量存储中搜索相似记忆
4. **去重与合并** → 识别重复记忆并合并更新
5. **存储** → 保存到向量存储、图存储和历史数据库
6. **Reranking** → 可选的重排序提升检索质量

### 2.2 向量存储层 (mem0/vector_stores/)

**支持的 26+ 向量数据库**（从代码中实际统计）：
- **Qdrant** (默认) - 开源高性能向量数据库
- **Pinecone** - 托管向量数据库
- **Weaviate** - GraphQL 向量搜索引擎
- **Chroma** - 开源嵌入式数据库
- **Milvus** - 云原生向量数据库
- **Elasticsearch** - 企业级搜索引擎
- **OpenSearch** - AWS 开源搜索
- **PGVector** - PostgreSQL 扩展
- **Redis** - 内存数据库
- **MongoDB** - 文档数据库（支持向量搜索）
- **Cassandra** - 分布式 NoSQL
- **FAISS** - Facebook AI 相似性搜索
- **Azure AI Search** - 微软云搜索服务
- **Azure MySQL** - Azure 托管 MySQL
- **Databricks** - 数据湖平台
- **Neptune Analytics** - AWS 图数据库分析
- **Supabase** - 开源 Firebase 替代品
- **Upstash Vector** - 无服务器向量数据库
- **Baidu** - 百度向量数据库
- **Valkey** - Redis 分支
- **S3 Vectors** - AWS S3 存储向量
- **Langchain** - 通过 Langchain 集成
- 更多...

**配置示例** (pgvector):
```python
vector_store_config = {
    "provider": "pgvector",
    "config": {
        "host": "localhost",
        "port": 5432,
        "dbname": "mem0_db",
        "user": "postgres",
        "password": "password",
        "collection_name": "memories"
    }
}
```

### 2.3 图存储层 (mem0/graphs/)

**支持的图数据库**：
- **Neo4j** - 企业级图数据库（推荐）
- **Memgraph** - 高性能内存图数据库
- **Neptune** - AWS 托管图数据库

**图存储的作用**：
- 存储实体之间的关系（如用户偏好、事件关联）
- 支持复杂的关系查询
- 构建知识图谱以增强记忆检索

**配置示例** (Neo4j):
```python
graph_store_config = {
    "provider": "neo4j",
    "config": {
        "url": "bolt://localhost:7687",
        "username": "neo4j",
        "password": "password"
    }
}
```

### 2.4 LLM 集成层 (mem0/llms/)

**支持的 LLM 提供商**（15+）：
- **OpenAI** (默认: gpt-4.1-nano-2025-04-14)
- **Anthropic** (Claude)
- **Groq** - 快速推理
- **Together AI** - 开源模型托管
- **Ollama** - 本地模型运行
- **Google Gemini** / **VertexAI**
- **LiteLLM** - 统一 LLM API
- **Azure OpenAI**
- 更多...

**LLM 在 Mem0 中的角色**：
1. **记忆提取**：从对话中提取结构化事实
2. **记忆更新**：判断如何合并或更新现有记忆
3. **查询理解**：理解用户查询意图

### 2.5 嵌入模型层 (mem0/embeddings/)

**支持的 Embedder**（10+）：
- **OpenAI** (text-embedding-3-small/large)
- **HuggingFace** - 开源嵌入模型
- **Ollama** - 本地嵌入模型
- **Vertex AI**
- **Google Generative AI**
- **Azure OpenAI**
- **FastEmbed** - 快速嵌入
- **Sentence Transformers**
- 更多...

**配置示例**：
```python
embedder_config = {
    "provider": "openai",
    "config": {
        "api_key": "sk-xxx",
        "model": "text-embedding-3-small"
    }
}
```

### 2.6 重排序层 (mem0/reranker/)

**支持的 Reranker**（5 种方法）：
- **Cohere Reranker** - Cohere 托管重排序
- **HuggingFace Reranker** - 开源模型
- **LLM Reranker** - 使用 LLM 进行重排序
- **Sentence Transformer Reranker** - 基于句子嵌入
- **Zero Entropy Reranker** - 零熵重排序算法

**作用**：在检索结果后进一步提升相关性排序

### 2.7 历史数据库 (mem0/memory/storage.py)

**SQLiteManager**：
- 使用 SQLite 存储完整的对话历史
- 记录每次 add/update/delete 操作
- 支持历史回溯和审计
- 默认路径：`~/.mem0/history.db`

## 3. API Server 架构 (server/main.py)

### FastAPI REST API

**端点设计**：
```python
POST   /memories              # 创建新记忆
GET    /memories              # 获取所有记忆
GET    /memories/{memory_id} # 获取特定记忆
PUT    /memories/{memory_id} # 更新记忆
DELETE /memories/{memory_id} # 删除记忆
POST   /search                # 搜索记忆
POST   /configure             # 配置 Mem0
```

**默认技术栈**：
- FastAPI (异步 Web 框架)
- PGVector (PostgreSQL 向量扩展)
- Neo4j (图数据库)
- OpenAI (LLM + Embeddings)

**Docker 部署**：
- 提供 `docker-compose.yaml` 一键启动
- 包含 Postgres、Neo4j、Mem0 Server

## 4. 配置系统 (mem0/configs/)

### MemoryConfig 数据模型

```python
@dataclass
class MemoryConfig:
    vector_store: VectorStoreConfig      # 向量存储配置
    llm: LlmConfig                       # LLM 配置
    embedder: EmbedderConfig             # 嵌入模型配置
    graph_store: GraphStoreConfig        # 图存储配置
    reranker: Optional[RerankerConfig]   # 重排序配置（可选）
    history_db_path: str                 # 历史数据库路径
    version: str = "v1.1"                # API 版本
```

### 版本支持

- **v1.1**（当前）：Multi-actor memory, enhanced graph support
- **v1.0**：Base memory system

## 5. 关键特性实现

### 5.1 多层级会话管理

Mem0 支持三层会话隔离：
- **user_id**：用户级记忆（跨所有对话）
- **agent_id**：代理级记忆（特定 AI 代理）
- **run_id**：运行级记忆（单次会话）

可以组合使用实现灵活的记忆隔离：
```python
memory.add(
    messages=[{"role": "user", "content": "I love pizza"}],
    user_id="alice",
    agent_id="support_bot",
    run_id="session_123"
)
```

### 5.2 智能去重

通过计算记忆哈希（hash）避免重复存储：
```python
memory_hash = hashlib.md5(memory_text.encode()).hexdigest()
```

如果检测到相同哈希，系统会选择更新而非新增。

### 5.3 记忆合并与版本管理

当检索到相似记忆时，LLM 会判断：
- **新增**：完全不同的新信息
- **更新**：信息的更新或修正
- **忽略**：重复信息

### 5.4 Telemetry 和分析

集成 PostHog 进行使用分析（可选关闭）。

## 6. 工作流程示例

### 添加记忆完整流程

```
1. Client 调用 memory.add(messages, user_id="alice")
      ↓
2. 解析 messages，提取用户/助手消息
      ↓
3. 使用 LLM 提取事实信息（fact extraction）
      ↓
4. 为每个事实生成 embedding
      ↓
5. 在向量存储中搜索相似记忆（semantic search）
      ↓
6. 使用 LLM 判断是否需要更新现有记忆
      ↓
7. 计算记忆哈希，检查去重
      ↓
8. 保存到向量存储 + 图存储（如启用）
      ↓
9. 记录到 SQLite 历史数据库
      ↓
10. 返回新增/更新的记忆 ID
```

### 搜索记忆完整流程

```
1. Client 调用 memory.search(query, user_id="alice", limit=10)
      ↓
2. 为查询生成 embedding
      ↓
3. 在向量存储中执行相似性搜索
      ↓
4. 应用 user_id/agent_id/run_id 过滤器
      ↓
5. 如果配置了 reranker，重排序结果
      ↓
6. 返回 top-k 相关记忆
```

## 7. 技术亮点

### 7.1 可插拔架构

通过工厂模式（Factory Pattern）实现组件解耦：
- `VectorStoreFactory`
- `LlmFactory`
- `EmbedderFactory`
- `GraphStoreFactory`
- `RerankerFactory`

轻松切换不同的后端实现，无需修改核心代码。

### 7.2 异步支持

提供完整的 async/await 接口：
- `AsyncMemory` 类
- `AsyncMemoryClient` 类
- 适配高并发场景

### 7.3 类型安全

使用 Pydantic 进行严格的数据验证：
- 所有配置都有类型定义
- 运行时自动验证
- 清晰的错误提示

### 7.4 多语言 SDK

- **Python SDK**：完整功能（主仓库）
- **TypeScript SDK**：mem0-ts/ 目录
- **REST API**：任意语言可通过 HTTP 访问

## 8. 性能优化

### 8.1 向量索引

支持的向量数据库都提供高效的 ANN（近似最近邻）算法：
- HNSW (Qdrant, Weaviate)
- IVF (FAISS, Milvus)
- LSH (某些实现)

### 8.2 批量处理

支持批量添加记忆以减少 API 调用。

### 8.3 缓存策略

- LRU 缓存 embedding 结果
- 向量存储本身的缓存机制

## 9. 安全与隐私

### 9.1 数据隔离

通过 user_id/agent_id/run_id 实现强隔离。

### 9.2 敏感信息保护

配置深拷贝时自动过滤敏感字段（auth, token, password 等）。

### 9.3 自托管选项

完全支持私有部署，数据不离开用户环境。

## 10. 部署架构

### 开发环境
```
本地开发
├── Mem0 Library (Python)
├── SQLite (历史数据库)
└── 可选外部服务（向量DB/LLM API）
```

### 生产环境（Docker Compose）
```
Docker Stack
├── Mem0 Server (FastAPI)
├── PostgreSQL + PGVector
├── Neo4j (图数据库)
└── OpenAI API (或自托管 LLM)
```

### 云原生部署
```
Kubernetes / Cloud Platform
├── Mem0 Service (多副本)
├── 托管 PostgreSQL (AWS RDS, GCP CloudSQL)
├── 托管 Neo4j (Neo4j Aura, AWS Neptune)
└── Embedding/LLM API (OpenAI, Azure, Vertex AI)
```

## 11. 代码质量与工程实践

- **测试**：pytest 单元测试 + 集成测试
- **代码风格**：Ruff linter + formatter
- **依赖管理**：Poetry (poetry.lock)
- **CI/CD**：GitHub Actions (.github/workflows/)
- **文档**：Markdown docs + 代码注释
- **版本控制**：语义化版本 (v1.0.3)

## 12. 扩展性与生态

### 12.1 Embedchain 集成

项目包含 `embedchain/` 目录，提供 RAG（检索增强生成）能力。

### 12.2 OpenMemory

`openmemory/` 目录包含开放记忆规范和工具。

### 12.3 评估框架

`evaluation/` 目录提供 LOCOMO benchmark 评估工具。

## 13. 总结

Mem0 的架构设计体现了以下核心思想：

1. **模块化**：每个组件都可独立替换
2. **可扩展**：支持 26+ 向量数据库，15+ LLM，10+ embedder
3. **灵活性**：自托管或托管服务两种模式
4. **性能**：基准测试显示比 OpenAI Memory 快 91%，准确率提升 26%
5. **易用性**：简洁的 API，丰富的 SDK 支持

这种架构使得 Mem0 可以适应从个人开发者到企业级应用的各种场景需求。
