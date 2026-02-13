# Graphiti 架构分析

> 基于实际代码库分析 (getzep/graphiti v0.27.0pre2)

## 1. 整体架构概述

Graphiti 是一个用于构建**时态感知知识图谱**的 Python 框架，专为在动态环境中运行的 AI 代理设计。它采用**双时态数据模型**（Bi-temporal），明确跟踪事件发生时间和数据摄入时间，支持实时增量更新而无需完整图重算。

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
        { "id": "A1", "label": "Graphiti SDK" },
        { "id": "A2", "label": "FastAPI" },
        { "id": "A3", "label": "MCP Server" }
      ]
    },
    {
      "title": "Core Graphiti Engine",
      "icon": "🧠",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "B1", "label": "Episode Ingestion" },
        { "id": "B2", "label": "Node/Edge Extract" },
        { "id": "B3", "label": "Community Detect" },
        { "id": "B4", "label": "Hybrid Search" }
      ]
    },
    {
      "title": "Graph Storage",
      "icon": "💾",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "C1", "label": "Neo4j (推荐)" },
        { "id": "C2", "label": "FalkorDB (内存图)" },
        { "id": "C3", "label": "Kuzu (嵌入式)" },
        { "id": "C4", "label": "OpenSearch" },
        { "id": "C5", "label": "Neptune" }
      ]
    },
    {
      "title": "Supporting Services",
      "icon": "🛠️",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "D1", "label": "LLM Client (5+ models)" },
        { "id": "D2", "label": "Embedder (6+ models)" },
        { "id": "D3", "label": "Cross-Encoder" }
      ]
    }
  ]
}
```

## 2. 核心模块详解

### 2.1 Graphiti 主类 (graphiti_core/graphiti.py)

**主要职责**：
- Episode（片段）的摄入和处理
- 实体和关系的提取
- 知识图谱的构建和维护
- 混合搜索的编排

**关键方法**：
```python
class Graphiti:
    async def add_episode(
        name: str,
        episode_body: str,
        source_description: str,
        reference_time: datetime,
        group_id: str | None = None
    ) -> AddEpisodeResults

    async def add_episode_bulk(
        episodes: list[RawEpisode]
    ) -> AddBulkEpisodeResults

    async def search(
        query: str,
        group_ids: list[str] | None = None,
        config: SearchConfig = COMBINED_HYBRID_SEARCH_CROSS_ENCODER,
        num_results: int = DEFAULT_SEARCH_LIMIT
    ) -> SearchResults

    async def build_indices_for_group(
        group_id: str,
        rerank: bool = True
    )

    async def build_communities(
        group_id: str,
        rerank: bool = True
    )
```

**Episode 处理流程**：
```
1. 接收 episode (事件片段)
      ↓
2. 使用 LLM 提取实体 (EntityNode) 和关系 (EntityEdge)
      ↓
3. 去重：与现有实体/关系合并
      ↓
4. 创建 EpisodicNode (时间戳记录)
      ↓
5. 建立 EpisodicEdge (连接实体和episode)
      ↓
6. 生成 embeddings (向量化)
      ↓
7. 存储到图数据库 (Neo4j/FalkorDB/Kuzu)
      ↓
8. 可选：构建社区 (CommunityNode)
```

### 2.2 图数据库驱动层 (graphiti_core/driver/)

**支持的图数据库**（5 种）：

| 数据库 | 类型 | 推荐场景 | 优势 |
|--------|------|----------|------|
| **Neo4j** | 企业级图数据库 | 生产环境（默认） | 成熟稳定，Cypher 查询强大 |
| **FalkorDB** | 内存图数据库 | 高性能场景 | 基于 Redis，极快查询 |
| **Kuzu** | 嵌入式图数据库 | 边缘/本地部署 | 无需服务器，易集成 |
| **Neptune** | AWS 托管图数据库 | AWS 生态 | 托管服务，与 OpenSearch 集成 |
| **OpenSearch** | 搜索引擎 | 混合搜索 | 配合 Neptune 使用 BM25 |

**关键文件**：
- `neo4j_driver.py` - Neo4j 5.26+ 支持
- `falkordb_driver.py` - FalkorDB 1.1.2+ 支持
- `kuzu_driver.py` - Kuzu 0.11.3+ 支持
- `neptune_driver.py` - AWS Neptune 集成

**图操作抽象**：
```python
class GraphDriver(ABC):
    @abstractmethod
    async def add_nodes(nodes: list[Node])

    @abstractmethod
    async def add_edges(edges: list[Edge])

    @abstractmethod
    async def search_nodes(
        query: str,
        limit: int = 10
    ) -> list[Node]

    @abstractmethod
    async def get_node_by_uuid(uuid: str) -> Node
```

### 2.3 节点类型 (graphiti_core/nodes.py)

**节点架构**：
```python
# 基础节点
class Node(BaseModel):
    uuid: str
    name: str
    created_at: datetime
    group_id: str

# 实体节点 (核心)
class EntityNode(Node):
    labels: list[str]              # 实体类型标签
    summary: str                   # 实体描述
    name_embedding: list[float]    # 名称向量
    summary_embedding: list[float] # 摘要向量

# Episode 节点 (时间戳)
class EpisodicNode(Node):
    source: str                    # 来源描述
    content: str | None            # 原始内容（可选）
    source_description: str
    valid_at: datetime             # 事件发生时间

# 社区节点 (聚类)
class CommunityNode(Node):
    members: list[str]             # 成员UUID列表
    summary: str                   # 社区摘要
    summary_embedding: list[float]

# Saga 节点 (长期主题)
class SagaNode(Node):
    episodes: list[str]            # 关联的 episodes
```

### 2.4 边类型 (graphiti_core/edges.py)

**边架构**：
```python
# 基础边
class Edge(BaseModel):
    uuid: str
    source_node_uuid: str
    target_node_uuid: str
    created_at: datetime
    group_id: str

# 实体边 (关系)
class EntityEdge(Edge):
    name: str                      # 关系名称
    fact: str                      # 关系描述
    fact_embedding: list[float]    # 关系向量
    episodes: list[str]            # 关联的 episodes
    expired_at: datetime | None    # 失效时间（时态）
    valid_at: datetime             # 生效时间（时态）

# Episode 边
class EpisodicEdge(Edge):
    pass  # 连接 EntityNode 和 EpisodicNode

# 社区边
class CommunityEdge(Edge):
    pass  # 连接节点到社区

# 其他边
class HasEpisodeEdge(Edge)        # 实体拥有 episode
class NextEpisodeEdge(Edge)       # episode 顺序链接
```

### 2.5 LLM 集成层 (graphiti_core/llm_client/)

**支持的 LLM**（5+ 种）：

| 提供商 | 客户端类 | 推荐模型 | 特性 |
|--------|----------|----------|------|
| **OpenAI** | OpenAIClient | gpt-4.1, gpt-4.1-mini | 结构化输出（推荐） |
| **Anthropic** | AnthropicClient | claude-sonnet-4-5 | 长上下文 |
| **Google** | GeminiClient | gemini-2.5-pro | 结构化输出支持 |
| **Groq** | GroqClient | llama3-70b | 快速推理 |
| **Azure OpenAI** | AzureOpenAIClient | gpt-4 | 企业合规 |

**LLM 在 Graphiti 中的角色**：
1. **实体提取**：从 episode 文本中提取结构化实体
2. **关系提取**：识别实体间的关系
3. **去重判断**：判断新实体是否与已有实体重复
4. **摘要生成**：为社区生成摘要

**配置示例**：
```python
from graphiti_core import Graphiti, OpenAIClient

llm_client = OpenAIClient(
    api_key="sk-xxx",
    model="gpt-4.1-mini",
    temperature=0.0
)

graphiti = Graphiti(
    uri="bolt://localhost:7687",
    user="neo4j",
    password="password",
    llm_client=llm_client
)
```

### 2.6 Embedding 层 (graphiti_core/embedder/)

**支持的 Embedder**（6+ 种）：

| 提供商 | 类名 | 模型示例 | 维度 |
|--------|------|----------|------|
| **OpenAI** | OpenAIEmbedder | text-embedding-3-small | 1536 |
| **VoyageAI** | VoyageAIEmbedder | voyage-3 | 1024 |
| **Sentence Transformers** | SentenceTransformerEmbedder | all-MiniLM-L6-v2 | 384 |
| **Azure OpenAI** | AzureOpenAIEmbedder | text-embedding-ada-002 | 1536 |
| **Google Vertex AI** | VertexAIEmbedder | text-embedding-004 | 768 |
| **AWS Bedrock** | BedrockEmbedder | amazon.titan-embed-text-v2 | 1024 |

**Embedding 使用场景**：
- **name_embedding**：实体名称向量（用于去重）
- **summary_embedding**：实体摘要向量（用于语义搜索）
- **fact_embedding**：关系事实向量（用于关系检索）

**配置示例**：
```python
from graphiti_core import OpenAIEmbedder

embedder = OpenAIEmbedder(
    api_key="sk-xxx",
    model="text-embedding-3-small"
)

graphiti = Graphiti(
    uri="bolt://localhost:7687",
    user="neo4j",
    password="password",
    embedder=embedder
)
```

### 2.7 混合搜索系统 (graphiti_core/search/)

**搜索策略**：

Graphiti 提供**三种混合搜索配置**（search_config_recipes.py）：

1. **COMBINED_HYBRID_SEARCH_CROSS_ENCODER**（默认，最准确）
   - 语义搜索（embeddings）
   - 关键词搜索（BM25）
   - 图遍历（邻居节点）
   - Cross-encoder 重排序

2. **EDGE_HYBRID_SEARCH_RRF**
   - 边搜索优先
   - 倒数排名融合（Reciprocal Rank Fusion）

3. **EDGE_HYBRID_SEARCH_NODE_DISTANCE**
   - 边搜索 + 节点距离加权

**搜索流程**：
```
1. 为查询生成 embedding
      ↓
2. 并行执行三种搜索：
   - 向量相似性搜索 (cosine similarity)
   - BM25 关键词搜索 (倒排索引)
   - 图遍历搜索 (邻居节点)
      ↓
3. 合并结果并去重
      ↓
4. 使用 Cross-encoder 重排序 (可选)
      ↓
5. 返回 top-k 结果
```

### 2.8 社区检测 (graphiti_core/utils/maintenance/community_operations.py)

**社区构建算法**：
- 基于图结构的聚类
- 为每个社区生成摘要（使用 LLM）
- 创建 CommunityNode 和 CommunityEdge

**用途**：
- 高层抽象：从单个实体到实体集群
- 提升检索效率：先搜索社区，再深入细节
- 知识组织：自动发现主题和关系群

### 2.9 时态模型 (Bi-temporal)

**双时态字段**：

| 字段 | 含义 | 应用 |
|------|------|------|
| **valid_at** | 事件发生时间 | "用户在 2025-01-15 喜欢披萨" |
| **created_at** | 数据摄入时间 | "这条数据在 2025-02-11 被记录" |
| **expired_at** | 失效时间（可选） | "用户不再喜欢披萨（2025-03-01）" |

**时态查询能力**：
- **Point-in-time 查询**：查询某个时间点的知识状态
- **历史追溯**：查看实体/关系的演变历史
- **过期管理**：自动标记过期的关系

## 3. FastAPI REST API (server/)

### API 端点设计

**Episode Ingestion**：
```python
POST /v1/episodes
{
  "group_id": "user_123",
  "name": "user_interaction",
  "episode_body": "User said they love Italian food",
  "source_description": "Chat conversation",
  "reference_time": "2025-02-11T10:00:00Z"
}
```

**Search**：
```python
POST /v1/search
{
  "query": "What food does the user like?",
  "group_ids": ["user_123"],
  "num_results": 10
}
```

**技术栈**：
- FastAPI 0.115.0
- Uvicorn (ASGI 服务器)
- Pydantic v2 数据验证
- Docker Compose 部署

## 4. MCP Server (mcp_server/)

### Model Context Protocol 集成

**功能**：
- 为 Claude、Cursor 等 AI 助手提供知识图谱记忆
- 支持自然语言查询和更新

**配置**（Claude Desktop）：
```json
{
  "mcpServers": {
    "graphiti": {
      "command": "docker",
      "args": ["compose", "up"],
      "cwd": "/path/to/graphiti/mcp_server"
    }
  }
}
```

**工具**：
- `add_memory` - 添加新记忆
- `search_memory` - 搜索现有记忆
- `get_entities` - 获取实体列表

## 5. 关键特性实现

### 5.1 实时增量更新

**传统 GraphRAG 问题**：
- 批处理：需要重新处理整个数据集
- 延迟高：无法实时反映新信息

**Graphiti 解决方案**：
```python
# 单个 episode 增量添加
await graphiti.add_episode(
    name="new_interaction",
    episode_body="User mentioned they are vegetarian now",
    source_description="chat",
    reference_time=datetime.utcnow()
)
# 立即可查询，无需重建图
```

### 5.2 自定义实体类型

**通过 Pydantic 模型定义**：
```python
from pydantic import BaseModel

class ProductEntity(BaseModel):
    name: str
    category: str
    price: float
    in_stock: bool

# 传递给 Graphiti
graphiti = Graphiti(
    uri="bolt://localhost:7687",
    custom_entity_types=[ProductEntity]
)
```

### 5.3 批量处理

**高效批量摄入**：
```python
episodes = [
    RawEpisode(
        name="interaction_1",
        episode_body="...",
        source_description="chat",
        reference_time=datetime(2025, 2, 11, 10, 0)
    ),
    # ... more episodes
]

results = await graphiti.add_episode_bulk(episodes)
```

**性能优化**：
- 并行处理（`max_coroutines` 配置）
- 批量图操作
- 去重缓存（DiskCache）

### 5.4 OpenTelemetry 追踪

**分布式追踪支持**：
```python
from graphiti_core import create_tracer

tracer = create_tracer("graphiti")

graphiti = Graphiti(
    uri="bolt://localhost:7687",
    tracer=tracer
)
```

**追踪点**：
- Episode 处理时间
- LLM API 调用延迟
- 数据库查询性能

## 6. 性能特性

### 6.1 查询延迟

**目标**：< 200ms (p95)

**优化措施**：
- 向量索引（HNSW, IVF）
- BM25 倒排索引
- Neo4j 查询优化
- 并行搜索策略

### 6.2 扩展性

**水平扩展**：
- Neo4j 集群（Enterprise）
- 并行 episode 处理
- 多 group_id 隔离

**数据规模**：
- 实体数：百万级
- 关系数：千万级
- Episode 数：百万级

### 6.3 内存优化

**DiskCache 使用**：
- 去重缓存：避免重复 LLM 调用
- 临时数据存储
- 减少内存占用

## 7. 工程实践

### 7.1 测试

**测试框架**：
- pytest + pytest-asyncio
- 单元测试 + 集成测试（`_int` 后缀）
- pytest-xdist 并行测试

**运行测试**：
```bash
# 所有测试
pytest

# 仅单元测试
pytest -k "not _int"

# 仅集成测试
pytest -k "_int"
```

### 7.2 代码质量

**工具**：
- Ruff - 格式化和 linting
- Pyright - 类型检查（basic mode）
- CI/CD - GitHub Actions

**配置**：
```toml
[tool.ruff]
line-length = 100
quote-style = "single"
```

### 7.3 依赖管理

**工具**：uv（推荐）或 pip

**安装**：
```bash
# 开发环境（完整依赖）
uv sync --extra dev

# 生产环境（核心依赖）
uv sync

# 可选功能（按需）
uv sync --extra anthropic --extra voyageai
```

## 8. 部署架构

### 开发环境
```
本地开发
├── Graphiti Library (Python)
├── Neo4j Desktop (图数据库)
├── DiskCache (本地缓存)
└── OpenAI API (LLM + Embeddings)
```

### 生产环境（Docker Compose）
```
Docker Stack
├── FastAPI Server (REST API)
├── Neo4j (图数据库)
├── Graphiti MCP Server (可选)
└── OpenTelemetry Collector (可选，追踪)
```

### 云原生部署
```
Kubernetes / Cloud Platform
├── Graphiti API Service (多副本)
├── Neo4j Aura / AWS Neptune (托管图数据库)
├── OpenSearch (AWS，BM25 搜索)
├── Embedding/LLM API (OpenAI, Azure, Vertex AI)
└── Monitoring (Prometheus, Grafana)
```

## 9. 与其他方案对比

### Graphiti vs. GraphRAG (Microsoft)

| 方面 | Graphiti | GraphRAG |
|------|----------|----------|
| **更新模式** | 实时增量 | 批处理 |
| **数据模型** | 双时态（事件时间 + 摄入时间） | 单时态 |
| **检索方式** | 混合搜索（语义+BM25+图） | 主要依赖 LLM 摘要 |
| **自定义实体** | 支持 Pydantic 模型 | 预定义模式 |
| **历史查询** | 支持 Point-in-time 查询 | 不支持 |
| **用途** | 动态环境（AI 代理） | 静态文档摘要 |

### Graphiti vs. Mem0

| 方面 | Graphiti | Mem0 |
|------|----------|------|
| **核心结构** | 知识图谱（节点+边） | 向量存储 + 可选图 |
| **关系建模** | 显式边，复杂关系 | 隐式，通过相似性 |
| **时态能力** | 双时态，精确历史 | 单时态 |
| **查询能力** | 图遍历 + 混合搜索 | 主要语义搜索 |
| **复杂度** | 高（图数据库） | 中（向量数据库） |
| **适用场景** | 复杂关系推理 | 简单记忆检索 |

## 10. 使用场景

**强烈推荐**：
- **AI 代理记忆**：长期上下文管理
- **动态知识库**：频繁更新的企业数据
- **关系推理**：复杂实体关系分析
- **时态查询**：需要历史追溯的场景

**不太适合**：
- 静态文档问答（传统 RAG 更简单）
- 极简场景（图数据库过重）
- 无关系场景（向量数据库足够）

## 11. 论文与基准

**论文**：
- [Zep: A Temporal Knowledge Graph Architecture for Agent Memory](https://arxiv.org/abs/2501.13956)

**性能基准**：
- LoCoMo-50 benchmark：State-of-the-art 表现
- Sub-200ms 检索延迟（生产环境）

**开源生态**：
- GitHub 12K+ stars
- Zep 商业平台基于 Graphiti 构建
- 活跃社区支持

## 12. 总结

Graphiti 的架构设计体现了以下核心思想：

1. **时态感知**：双时态模型，精确历史追溯
2. **实时性**：增量更新，无需批处理
3. **混合检索**：语义 + 关键词 + 图遍历
4. **灵活性**：支持多图数据库，自定义实体
5. **生产就绪**：完整 API、MCP 集成、可观测性

**适合场景**：需要构建**动态、时态感知知识图谱**的 AI 代理应用。

**技术栈推荐**：Neo4j + OpenAI（或 Gemini）+ OpenAI Embeddings
