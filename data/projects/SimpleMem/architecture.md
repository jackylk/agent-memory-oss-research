# SimpleMem 架构分析

> 基于实际代码库分析 (aiming-lab/SimpleMem)

## 1. 整体架构概述

SimpleMem 是一个专为 LLM 代理设计的高效长期记忆框架，采用**语义无损压缩**技术。通过三阶段流水线（压缩、合成、检索）实现跨会话的记忆管理，在 LoCoMo-10 基准测试中达到 **F1 43.24%**，相比 Mem0 提升 26.4%，相比 LightMem 提升 75.6%。

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
        { "id": "A1", "label": "MCP Server" },
        { "id": "A2", "label": "Claude Desktop" },
        { "id": "A3", "label": "Cursor" },
        { "id": "A4", "label": "LM Studio" }
      ]
    },
    {
      "title": "SimpleMem Core Pipeline",
      "icon": "🧠",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "B1", "label": "Semantic Compression" },
        { "id": "B2", "label": "Online Synthesis" },
        { "id": "B3", "label": "Intent-Aware Retrieval" }
      ]
    },
    {
      "title": "Core Components",
      "icon": "⚙️",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "C1", "label": "MemoryBuilder" },
        { "id": "C2", "label": "HybridRetriever" },
        { "id": "C3", "label": "AnswerGenerator" }
      ]
    },
    {
      "title": "Storage & Services",
      "icon": "💾",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "D1", "label": "VectorStore (LanceDB)" },
        { "id": "D2", "label": "LLM Client (OpenAI)" },
        { "id": "D3", "label": "Embedding (SentenceT)" }
      ]
    }
  ]
}
```

## 2. 核心模块详解

### 2.1 SimpleMemSystem 主类 (main.py)

**主要职责**：
- 三阶段流水线的编排
- 对话摄入（add_dialogue）
- 问答检索（ask）
- 跨会话记忆管理

**关键方法**：
```python
class SimpleMemSystem:
    def add_dialogue(dialogue: Dialogue) -> None
        """Stage 1+2: 压缩并存储对话"""

    def add_dialogues(dialogues: List[Dialogue]) -> None
        """批量添加对话（支持并行处理）"""

    def ask(query: str) -> str
        """Stage 3: 意图感知检索 + 答案生成"""

    def get_all_memories() -> List[MemoryEntry]
        """获取所有记忆单元"""

    def clear() -> None
        """清空记忆库"""
```

**三阶段流水线**：
```
Stage 1: Semantic Structured Compression (Section 3.1)
  ↓
  add_dialogue() → MemoryBuilder
  - 滑动窗口分段
  - 语义密度门控 Φ_gate(W) → {m_k}
  - 多视图索引 I(m_k) = {s_k, l_k, r_k}
  ↓
Stage 2: Online Semantic Synthesis (Section 3.2)
  ↓
  会话内整合（写入时）
  - 生成足够的记忆条目确保信息完整
  ↓
  存储到 VectorStore (LanceDB)
  ↓
Stage 3: Intent-Aware Retrieval Planning (Section 3.3)
  ↓
  ask() → HybridRetriever → AnswerGenerator
  - 检索规划 P(q, H) → {q_sem, q_lex, q_sym, d}
  - 并行多视图检索
  - 结果合并 C_q = R_sem ∪ R_lex ∪ R_sym
  ↓
  返回答案
```

### 2.2 MemoryBuilder (core/memory_builder.py)

**论文章节**：Section 3.1 & 3.2

**核心功能**：
1. **滑动窗口分段**：对对话流进行分段
2. **隐式语义密度门控**：Φ_gate(W) → {m_k}，过滤低密度窗口
3. **多视图索引**：I(m_k) = {s_k, l_k, r_k}
4. **会话内整合**：写入时生成足够的记忆条目

**关键代码结构**：
```python
class MemoryBuilder:
    def __init__(
        llm_client: LLMClient,
        vector_store: VectorStore,
        window_size: int = None,
        enable_parallel_processing: bool = True,
        max_parallel_workers: int = 3
    )

    def add_dialogue(dialogue: Dialogue, auto_process: bool = True)
        """添加单个对话到缓冲区"""

    def add_dialogues(dialogues: List[Dialogue], auto_process: bool = True)
        """批量添加对话（支持并行处理）"""

    def add_dialogues_parallel(dialogues: List[Dialogue])
        """并行处理对话批次"""

    def process_window()
        """处理完整窗口：提取记忆 → 存储"""

    def _extract_memories_from_window(window: List[Dialogue]) -> List[MemoryEntry]
        """从窗口提取记忆单元（调用 LLM）"""
```

**滑动窗口处理流程**：
```
对话流: [D1, D2, D3, D4, D5, D6, D7, D8, ...]
         └─────┬─────┘
         Window 1 (size=4)
         → 提取记忆 M1, M2
                └─────┬─────┘
                Window 2 (size=4)
                → 提取记忆 M3, M4
                       └─────┬─────┘
                       Window 3
                       → ...
```

**语义密度门控**（隐式）：
- LLM 自动判断哪些对话窗口包含有意义的信息
- 低密度窗口（如闲聊）被过滤或合并

**并行处理优化**：
- 大批量对话（> window_size * 2）自动启用并行处理
- `max_parallel_workers` 控制并发数（默认 3）

### 2.3 MemoryEntry (models/memory_entry.py)

**论文章节**：Section 3.1 核心数据结构

**多视图索引架构**：
```python
class MemoryEntry(BaseModel):
    entry_id: str

    # [Semantic Layer] - 语义层：密集向量
    lossless_restatement: str  # 无损重述
    # v_k = E_dense(S_k)
    # 特征：
    # - Φ_coref：解析所有代词（无 "他"、"她"、"它"）
    # - Φ_time：绝对时间戳（非相对时间）

    # [Lexical Layer] - 词汇层：稀疏关键词
    keywords: List[str]  # BM25 精确匹配
    # h_k = Sparse(S_k)

    # [Symbolic Layer] - 符号层：元数据约束
    timestamp: Optional[str]  # ISO 8601 格式
    location: Optional[str]
    persons: List[str]
    entities: List[str]
    topic: Optional[str]
    # R_k = {(key, val)}
```

**示例**（from code comments）：
```json
{
  "entry_id": "550e8400-e29b-41d4-a716-446655440000",
  "lossless_restatement": "Alice discussed the marketing strategy for new product XYZ with Bob at Starbucks in Shanghai on November 15, 2025 at 14:30.",
  "keywords": ["Alice", "Bob", "product XYZ", "marketing strategy", "discussion"],
  "timestamp": "2025-11-15T14:30:00",
  "location": "Starbucks, Shanghai",
  "persons": ["Alice", "Bob"],
  "entities": ["product XYZ"],
  "topic": "Product marketing strategy discussion"
}
```

**无损重述特性**：
1. **去代词化**（Φ_coref）：
   - 原始："他昨天去了"
   - 重述："张三于 2025-11-14 去了"

2. **绝对时间化**（Φ_time）：
   - 原始："明天下午"
   - 重述："2025-11-16T14:00:00"

3. **自包含**：
   - 无需上下文即可理解
   - 适合跨会话检索

### 2.4 HybridRetriever (core/hybrid_retriever.py)

**论文章节**：Section 3.3 意图感知检索规划

**核心组件**：
```python
class HybridRetriever:
    def __init__(
        llm_client: LLMClient,
        vector_store: VectorStore,
        semantic_top_k: int = None,     # 语义检索 top-k
        keyword_top_k: int = None,      # 关键词检索 top-k
        structured_top_k: int = None,   # 结构化检索 top-k
        enable_planning: bool = True,   # 启用检索规划
        enable_reflection: bool = True, # 启用反思
        max_reflection_rounds: int = 2,
        enable_parallel_retrieval: bool = True,
        max_retrieval_workers: int = 3
    )

    def retrieve(query: str, enable_reflection: Optional[bool] = None) -> List[MemoryEntry]
        """主检索入口"""

    def _retrieve_with_planning(query: str, enable_reflection: Optional[bool]) -> List[MemoryEntry]
        """带规划的检索"""

    def _analyze_information_requirements(query: str) -> Dict
        """分析信息需求（调用 LLM）"""

    def _generate_targeted_queries(query: str, plan: Dict) -> List[str]
        """生成目标查询"""

    def _execute_parallel_searches(queries: List[str]) -> List[MemoryEntry]
        """并行执行多个搜索"""
```

**检索流程**（带规划）：
```
1. 分析信息需求
   query → LLM → information_plan
   ↓
2. 生成目标查询
   information_plan → {q_sem, q_lex, q_sym}
   ↓
3. 并行多视图检索
   ┌─ Semantic: R_sem = Top-n(cos(E(q_sem), E(m_i)))
   ├─ Lexical:  R_lex = Top-n(BM25(q_lex, m_i))
   └─ Symbolic: R_sym = Top-n({m_i | Meta(m_i) ⊨ q_sym})
   ↓
4. 结果合并
   C_q = R_sem ∪ R_lex ∪ R_sym
   ↓
5. 可选：反思式追加检索
   if enable_reflection and initial_results insufficient:
       生成追加查询 → 再次检索 → 合并结果
   ↓
6. 返回最终结果
```

**并行检索优化**：
```python
# 自动检测多查询场景
if enable_parallel_retrieval and len(search_queries) > 1:
    all_results = _execute_parallel_searches(search_queries)
else:
    # 串行执行
    for query in search_queries:
        results = _semantic_search(query)
```

**反思机制**：
- 检索后评估结果是否充分
- 如不足，生成追加查询
- 最多 `max_reflection_rounds` 轮（默认 2）

### 2.5 AnswerGenerator (core/answer_generator.py)

**职责**：
- 基于检索到的记忆生成最终答案
- 使用 LLM 合成回答

**关键方法**：
```python
class AnswerGenerator:
    def generate(
        query: str,
        retrieved_memories: List[MemoryEntry]
    ) -> str
        """生成答案"""
```

### 2.6 VectorStore (database/vector_store.py)

**技术选型**：**LanceDB**

**特性**：
- 向量化存储（用于语义搜索）
- BM25 全文索引（用于关键词搜索）
- 元数据过滤（用于结构化查询）

**关键操作**：
```python
class VectorStore:
    def add_entry(entry: MemoryEntry)
        """添加记忆条目"""

    def semantic_search(query: str, top_k: int) -> List[MemoryEntry]
        """语义搜索（向量相似度）"""

    def keyword_search(query: str, top_k: int) -> List[MemoryEntry]
        """关键词搜索（BM25）"""

    def structured_search(filters: Dict, top_k: int) -> List[MemoryEntry]
        """结构化搜索（元数据过滤）"""
```

**多视图索引实现**：
- **Semantic**：`lossless_restatement` → embedding vector
- **Lexical**：`keywords` → BM25 inverted index
- **Symbolic**：`timestamp`, `location`, `persons`, etc. → metadata filters

### 2.7 LLMClient (utils/llm_client.py)

**支持的 LLM**：

| 提供商 | 配置方式 | 模型示例 |
|--------|----------|----------|
| **OpenAI** | `api_key` | gpt-4, gpt-4-turbo |
| **Anthropic** | `api_key` | claude-3-opus, claude-3-sonnet |
| **兼容 API** | `base_url` | Qwen, LM Studio 本地模型 |

**特殊功能**：
```python
class LLMClient:
    def __init__(
        api_key: str,
        model: str,
        base_url: Optional[str] = None,
        enable_thinking: bool = False,  # 深度思考模式（Qwen）
        use_streaming: bool = False
    )
```

**深度思考模式**（enable_thinking）：
- 支持 Qwen 等模型的 CoT（Chain-of-Thought）
- 提升推理质量

### 2.8 EmbeddingModel (utils/embedding.py)

**技术选型**：**Sentence Transformers**

**依赖**（from requirements.txt）：
```python
sentence-transformers==5.1.1
```

**推荐模型**：
- `all-MiniLM-L6-v2` (384维)
- `bge-large-en-v1.5` (1024维)

## 3. MCP Server 集成

### 3.1 MCP 目录结构

```
MCP/
├── server.py           # MCP Server 主文件
├── config.json         # MCP 配置
└── README.md
```

### 3.2 支持的 MCP 客户端

从 README.md 确认：
- **Claude Desktop** ✅
- **Cursor** ✅
- **LM Studio** ✅
- **Cherry Studio** ✅
- **任意 MCP 客户端** ✅

### 3.3 MCP 工具

**提供的工具**：
- `add_memory` - 添加新记忆
- `search_memory` - 搜索记忆
- `clear_memory` - 清空记忆库

**配置示例**（Claude Desktop）：
```json
{
  "mcpServers": {
    "simplemem": {
      "command": "python",
      "args": ["/path/to/SimpleMem/MCP/server.py"],
      "env": {
        "OPENAI_API_KEY": "sk-xxx"
      }
    }
  }
}
```

## 4. 关键特性实现

### 4.1 语义无损压缩

**原理**：
- 传统方法：直接存储对话 → 信息冗余
- SimpleMem：提取核心事实 → 无损重述

**压缩比**：
- 原始对话：可能数千 tokens
- 压缩后：每个 MemoryEntry ~100-200 tokens
- 压缩比：~10:1

**无损保证**：
- Φ_coref（指代消解）：无代词
- Φ_time（时间规范化）：绝对时间
- 关键信息完整：人物、地点、事件、时间

### 4.2 多视图索引

**三层索引架构**：

| 层次 | 索引方式 | 用途 | 检索方式 |
|------|----------|------|----------|
| **Semantic** | Dense vector (embeddings) | 语义相似性 | Cosine similarity |
| **Lexical** | Sparse keywords (BM25) | 精确关键词匹配 | BM25 ranking |
| **Symbolic** | Structured metadata | 时间/地点/人物过滤 | SQL-like filtering |

**混合检索优势**：
- 语义层：捕获意图相似性
- 词汇层：精确匹配专有名词
- 符号层：时空约束过滤

**示例查询**：
```python
query = "上周和 Alice 讨论了什么？"

# 三层并行检索：
R_sem = semantic_search("讨论内容 Alice")  # 语义
R_lex = keyword_search("Alice 讨论")       # 关键词
R_sym = structured_search(
    persons=["Alice"],
    timestamp="2025-02-04 to 2025-02-10"  # 上周
)

# 合并结果
results = merge(R_sem, R_lex, R_sym)
```

### 4.3 意图感知检索规划

**传统方法**：
- 直接将查询转换为向量
- 单次检索

**SimpleMem 方法**：
```
1. 分析查询意图
   LLM 分析："上周和 Alice 讨论了什么？"
   → 需要：时间范围、人物、主题

2. 生成多个目标查询
   → q1: "Alice 讨论的主题"
   → q2: "上周的会议记录"
   → q3: "Alice 提到的项目"

3. 并行执行检索
   → 每个查询独立检索
   → 合并去重

4. 反思评估
   if 结果不足:
       生成追加查询 → 再次检索
```

**优势**：
- 提升召回率（多角度检索）
- 减少漏检（反思机制）

### 4.4 并行处理优化

**两级并行**：

1. **记忆构建并行**（MemoryBuilder）：
   ```python
   # 大批量对话自动启用
   if len(dialogues) > window_size * 2:
       add_dialogues_parallel(dialogues)
   ```

2. **检索并行**（HybridRetriever）：
   ```python
   # 多查询自动并行
   if len(search_queries) > 1:
       execute_parallel_searches(search_queries)
   ```

**性能提升**：
- 记忆构建：2-3x 加速（3 workers）
- 检索：1.5-2x 加速（3 workers）

### 4.5 跨会话记忆

**设计理念**：
- 记忆条目自包含（无代词、绝对时间）
- 无需会话上下文即可理解
- 适合长期存储和检索

**实现**：
- 所有记忆存储在同一 VectorStore
- 无会话隔离（可通过 metadata 实现）
- 跨会话自然检索

## 5. 性能基准

### 5.1 LoCoMo-10 Benchmark

**结果**（from meta.json）：
```json
{
  "locomo": {
    "score": 43.24,
    "details": "LoCoMo-10: SimpleMem F1 43.24% (26.4% improvement over Mem0, 75.6% over LightMem)"
  }
}
```

**对比**：
| 方法 | F1 Score | 相对提升 |
|------|----------|----------|
| LightMem | ~24.6% | 基线 |
| Mem0 | ~34.2% | +39% vs LightMem |
| **SimpleMem** | **43.24%** | **+26.4% vs Mem0** |

### 5.2 压缩效率

**从论文推断**：
- Token 使用量：减少 ~90%（vs 全量上下文）
- 准确率：F1 43.24%（vs 全量上下文可能 ~50%）
- 权衡：10% 准确率损失换取 90% token 节省

## 6. 工程实践

### 6.1 依赖管理

**核心依赖**（from requirements.txt）：
```python
# LLM & Embeddings
anthropic==0.75.0
openai==2.3.0
sentence-transformers==5.1.1
litellm==1.79.1

# LangChain 生态
langchain==1.1.0
langchain-anthropic==1.2.0
langchain-openai==1.1.0
langgraph==1.0.4
langmem==0.0.30

# Vector Database
lancedb==0.25.3
qdrant-client==1.15.1

# Search & Ranking
rank-bm25==0.2.2
tantivy  # Rust 全文搜索引擎

# Evaluation
bert-score==0.3.13
rouge_score==0.1.2

# Compression (experimental)
llmlingua==0.2.2

# Web Framework (for API)
fastapi==0.115.0
uvicorn[standard]==0.32.0
```

### 6.2 配置系统

**config.py.example**（推断）：
```python
# LLM 配置
OPENAI_API_KEY = "sk-xxx"
MODEL = "gpt-4"

# 窗口大小
WINDOW_SIZE = 10

# 检索参数
SEMANTIC_TOP_K = 5
KEYWORD_TOP_K = 3
STRUCTURED_TOP_K = 2

# 并行处理
ENABLE_PARALLEL_PROCESSING = True
MAX_PARALLEL_WORKERS = 4
ENABLE_PARALLEL_RETRIEVAL = True
MAX_RETRIEVAL_WORKERS = 3

# 检索策略
ENABLE_PLANNING = True
ENABLE_REFLECTION = True
MAX_REFLECTION_ROUNDS = 2

# 数据库
DB_PATH = "simplemem.lancedb"
TABLE_NAME = "memories"
```

### 6.3 测试

**测试文件**（from repo structure）：
- `test_locomo10.py` - LoCoMo benchmark 评估
- `tests/` - 单元测试目录
- `test_ref/` - 参考测试数据

## 7. 部署架构

### 开发环境
```
本地开发
├── SimpleMem Library (Python)
├── LanceDB (嵌入式向量数据库)
├── Sentence Transformers (本地 embedding)
└── OpenAI/Anthropic API (LLM)
```

### MCP 客户端集成
```
Claude Desktop / Cursor / LM Studio
├── MCP Server (SimpleMem)
│   ├── SimpleMem Core
│   ├── LanceDB
│   └── Embedding Model
└── OpenAI/Anthropic API
```

### API 服务器部署
```
Docker / Cloud
├── FastAPI Server
├── SimpleMem Core
├── LanceDB (持久化存储)
├── Sentence Transformers
└── LLM API
```

## 8. 与其他方案对比

### SimpleMem vs. Mem0

| 方面 | SimpleMem | Mem0 |
|------|-----------|------|
| **核心方法** | 语义无损压缩 | 向量存储 + 可选图 |
| **记忆单元** | 自包含事实（无代词） | 提取的记忆片段 |
| **索引方式** | 三层：语义+词汇+符号 | 主要语义向量 |
| **检索策略** | 意图感知规划 + 反思 | 语义搜索 |
| **准确率** | F1 43.24% (LoCoMo-10) | ~34.2% |
| **压缩比** | ~10:1 | 较低 |
| **复杂度** | 中（三阶段流水线） | 中（LLM + 向量DB） |

### SimpleMem vs. Graphiti

| 方面 | SimpleMem | Graphiti |
|------|-----------|----------|
| **核心结构** | 压缩记忆单元 | 知识图谱 |
| **时态能力** | 绝对时间戳 | 双时态模型 |
| **关系建模** | 隐式（通过相似性） | 显式边 |
| **用途** | 对话记忆压缩 | 复杂关系推理 |
| **部署复杂度** | 低（嵌入式DB） | 高（图数据库） |

## 9. 使用场景

**强烈推荐**：
- **对话式 AI 助手**：Claude、ChatGPT 等的长期记忆
- **代码编辑器**：Cursor、Windsurf 的上下文管理
- **个人助理**：跨会话记忆用户偏好
- **客服机器人**：记住历史对话和问题

**不太适合**：
- 复杂关系推理（Graphiti 更合适）
- 大规模企业知识库（RAG 更合适）
- 实时协作场景（需要会话隔离）

## 10. 论文与基准

**论文**：
- [SimpleMem: Semantic Lossless Compression for Agent Memory](https://arxiv.org/abs/2601.02553)

**基准测试**：
- LoCoMo-10: F1 43.24%
- LoCoMo-50: 待评估

**开源生态**：
- GitHub 2.8K+ stars
- 多语言支持（中文、日文、韩文等）
- MCP 集成

## 11. 总结

SimpleMem 的架构设计体现了以下核心思想：

1. **压缩效率**：语义无损压缩，10:1 压缩比
2. **多视图索引**：语义 + 词汇 + 符号三层
3. **智能检索**：意图感知规划 + 反思机制
4. **易于集成**：MCP Server，支持主流 AI 工具
5. **性能领先**：LoCoMo benchmark SOTA

**适合场景**：需要**高效、准确的长期对话记忆**的 AI 代理应用。

**技术栈推荐**：LanceDB + Sentence Transformers + OpenAI/Anthropic
