# Memary 架构分析

> 基于实际代码库分析 (Memary 项目)

## 1. 整体架构概述

**Memary** 是一个为自主智能代理设计的长期记忆管理系统,核心使命是模仿人脑记忆机制,通过"宽度"和"深度"两个维度管理智能体的记忆。

### 项目定位

- **应用领域**:自主智能代理、长期对话系统、知识图谱应用
- **核心价值**:人类记忆仿真 + 零代码集成 + 多维度内存管理 + 知识图谱检索
- **关键创新**:二层记忆流、递归实体检索、多跳推理、同义词扩展

### 核心价值主张

- **人类记忆仿真**:通过"宽度"(广泛知识接触)和"深度"(频繁使用的概念)两个维度管理记忆
- **零代码集成**:最小化开发者实现成本,自动生成记忆无需手动配置
- **多维度内存管理**:整合记忆流(Memory Stream)和实体知识存储(Entity Knowledge Store)
- **知识图谱检索**:基于递归和多跳推理的上下文增强生成(RAG)

### 与其他项目的差异

| 维度 | Memary | Mem0 | Graphiti | Letta |
|------|--------|------|----------|-------|
| **核心概念** | 二层记忆流 + 知识图谱 | 通用记忆平台 | 时态知识图谱 | 虚拟上下文 |
| **记忆结构** | Memory Stream + Entity Store | 统一记忆 | 图结构 | 嵌入向量 |
| **存储后端** | Neo4j/FalkorDB | 多后端 | Neo4j | PostgreSQL |
| **推理方式** | 多跳+递归 | 相似度匹配 | 图遍历 | 向量相似度 |
| **部署复杂度** | 中 | 低 | 中 | 高 |

---

## 2. 核心架构组件

### 架构分层图

```architecture
{
  "layers": [
    {
      "title": "应用层",
      "icon": "🎯",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "A1", "label": "Streamlit 仪表板" },
        { "id": "A2", "label": "ChatAgent API" },
        { "id": "A3", "label": "自定义工具集成" }
      ]
    },
    {
      "title": "代理层",
      "icon": "🤖",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "B1", "label": "ReAct 路由代理" },
        { "id": "B2", "label": "工具执行引擎" },
        { "id": "B3", "label": "搜索工具" },
        { "id": "B4", "label": "视觉工具" },
        { "id": "B5", "label": "位置工具" },
        { "id": "B6", "label": "股票工具" }
      ]
    },
    {
      "title": "记忆层",
      "icon": "🧠",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "C1", "label": "Memory Stream" },
        { "id": "C2", "label": "Entity Knowledge Store" },
        { "id": "C3", "label": "Context Window 管理" },
        { "id": "C4", "label": "Token 蒸馏" }
      ]
    },
    {
      "title": "知识层",
      "icon": "📚",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "D1", "label": "KG RAG 检索器" },
        { "id": "D2", "label": "递归实体检索" },
        { "id": "D3", "label": "多跳推理" },
        { "id": "D4", "label": "同义词扩展" }
      ]
    },
    {
      "title": "LLM 层",
      "icon": "🧬",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "E1", "label": "本地 Ollama (Llama3/LLaVA)" },
        { "id": "E2", "label": "OpenAI (GPT-3.5/GPT-4V)" },
        { "id": "E3", "label": "Perplexity 外部查询" }
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
        { "id": "F1", "label": "Neo4j 图数据库" },
        { "id": "F2", "label": "FalkorDB 图数据库" },
        { "id": "F3", "label": "JSON 本地存储" }
      ]
    }
  ]
}
```

## 3. 云服务需求详细分析

### 3.1 计算资源需求

**CPU/内存/并发需求**

| 规模 | CPU | 内存 | 并发 | 用途 |
|------|-----|------|------|------|
| 开发 | 2核 | 4GB | 1 | 本地开发 |
| 小规模 | 4核 | 8GB | 5-10 | <1000 用户 |
| 中等规模 | 8核 | 16GB | 20-50 | 1-10K 用户 |
| 大规模 | 16+核 | 32GB+ | 100+ | 10K+ 用户 |

**用途和成本优势**:
- 可本地运行 Ollama(零云成本)
- ReAct 代理推理通常 <2 秒
- 内存管理轻量(JSON 存储)

### 3.2 数据库需求

**类型和配置**

| 数据库 | 配置 | 存储容量 | 扩展性 |
|--------|------|---------|--------|
| **Neo4j** | 4.5-5.x | 100GB-1TB | 水平扩展困难 |
| **FalkorDB** | 最新 | 10GB-100GB | 多图隔离 |

**用途和特殊需求**:
- 存储知识图谱三元组关系
- 实体-关系-实体结构
- 多跳推理查询
- 备份:每日全量备份

**推荐配置**:
- 小规模:单节点 FalkorDB(1GB-10GB)
- 中等:Neo4j 企业集群(3 节点)
- 大规模:分布式 Neo4j 集群

### 3.3 存储需求

**容量和用途**

| 类型 | 容量 | 用途 | 访问模式 |
|------|------|------|---------|
| JSON 记忆 | 1MB/用户/年 | 聊天历史 + 记忆流 | 读写频繁 |
| 图数据库 | 10-100MB/用户 | 知识图谱 | 检索密集 |
| 缓存 | 1GB-10GB | 查询缓存 | 热读 |

**成本**:
- 本地存储:免费
- S3 Standard:$0.023/GB/月
- 备份成本:$0.01/GB/月

### 3.4 向量数据库需求

**当前状态**:Memary 不直接使用向量数据库,而是用图数据库存储三元组关系。

**可选集成**:
- Pinecone(托管):$0.01-0.05/百万向量查询
- Weaviate(开源/托管):自托管免费
- Milvus(开源):自托管免费
- Qdrant(开源/托管):自托管免费

**向量配置**(如果集成):
- 维度:1536 (OpenAI) 或 384 (开源)
- 索引类型:HNSW
- 查询性能:<100ms (99th percentile)

### 3.5 AI 服务需求

**LLM 成本估算**

| 服务 | 模型 | 用途 | 成本 |
|------|------|------|------|
| **LLM** | Llama3 8B(本地) | 代理推理 | 零成本 |
| | gpt-3.5-turbo | 云端备用 | ¥0.002/K tokens |
| **Vision** | LLaVA(本地) | 图像分析 | 零成本 |
| | gpt-4-vision | 云端备用 | ¥0.03/image |
| **外部查询** | Perplexity mistral-7b | 网络搜索 | ¥0.0007/K tokens |
| **嵌入** | LLM 原生 | 实体编码 | 零成本 |

**成本优化**:
- 使用本地 Ollama 可降低 70-80% 成本
- 混合方案:本地 + 云端(降级时)

**月成本分解(10K用户)**:
- LLM(本地为主):$50-100
- 外部 API(Perplexity):$50-100
- **总 AI 成本:~$100-200/月**

### 3.6 网络和 CDN

**带宽需求**:
- 估计 10-50 Mbps @ 1K 并发
- API 响应:1-10KB/请求
- 月度:50-100GB

**推荐架构**:
- CloudFlare/AWS CloudFront(CDN)
- API 网关(负载均衡)
- DDoS 保护 + WAF

**SSL/TLS**:免费(Let's Encrypt)

### 3.7 部署复杂度评估

| 维度 | 评分 (1-10) | 说明 |
|------|-------------|------|
| **基础设施配置** | 6 | 需要配置 LLM (Ollama) + 图数据库 |
| **数据库管理** | 7 | Neo4j/FalkorDB 集群维护、备份、性能调优 |
| **CI/CD 复杂度** | 5 | Python 应用简单,但需要 LLM 资源管理 |
| **监控和日志** | 6 | 需要 GPU 监控(本地)或 API 配额监控 |
| **安全配置** | 7 | API 密钥管理、图数据库认证、隔离 |
| **总体复杂度** | **6.2** | 中等难度,关键瓶颈是 LLM 和图数据库 |

### 3.8 成本估算(月度)

**小规模部署(1000活跃用户)**
- 计算:t3.large = $30-50
- 图数据库:FalkorDB 自托管 = $20-30
- LLM 推理:本地 Ollama = $0
- 外部 API:Perplexity = $5-10
- Google Maps:基础配额 = $0-10
- 存储:S3 10GB = $0.50
- **总计:~$55-100/月**

**中等规模(10000用户)**
- 计算:r5.2xlarge x 2 = $400-600
- 图数据库:Neo4j 企业 = $500-800
- LLM 推理:Ollama GPU 实例 = $100-200
- 外部 API:Perplexity = $50-100
- Google Maps:标准配额 = $50-100
- 存储 + 备份:RDS + S3 = $100
- 监控:DataDog = $100
- **总计:~$1,300-2,000/月**

**大规模(100000+用户)**
- 计算:Kubernetes 集群 = $5,000+
- 图数据库:Neo4j 分布式 = $2,000+
- LLM 推理:混合本地+云 = $1,000+
- 外部 API:$500+
- 网络:CDN + API Gateway = $500+
- 监控和日志:$500+
- **总计:~$10,000+/月**

### 3.9 必需的云服务清单

✅ **必需**:
- LLM 提供商(Ollama 本地或 OpenAI/Perplexity API)
- 图数据库(Neo4j 或 FalkorDB)
- Web 框架(Streamlit)

⚠️ **推荐**:
- Web 服务器(Gunicorn + Nginx)
- 容器化(Docker + Docker Compose)
- 编排(Kubernetes/Docker Swarm)
- 监控(Prometheus + Grafana)
- 日志(ELK Stack/Loki)

🔧 **可选**:
- 消息队列(Redis/RabbitMQ)
- 向量 DB(Pinecone/Weaviate)
- 缓存(Redis)
- API Gateway(Kong/AWS Gateway)

---

## 4. 核心模块详解

### 4.1 Agent 模块

**位置**:`/src/memary/agent/`

- **BaseAgent** (`base_agent.py` - 494 行):核心代理类,管理 LLM 模型、图数据库连接、知识图谱检索引擎
- **ChatAgent** (`chat_agent.py`):继承 BaseAgent,提供聊天接口、内存管理、消息存储
- **数据类型** (`data_types.py`):Context、Message 数据类

### 4.2 Memory 模块

**位置**:`/src/memary/memory/`

- **BaseMemory** (`base_memory.py`):抽象基类,定义 add_memory、save_memory、remove_old_memory 接口
- **MemoryStream** (`memory_stream.py`):捕获所有实体及其时间戳,反映"广度"
- **EntityKnowledgeStore** (`entity_knowledge_store.py`):跟踪实体频率和最近使用时间,反映"深度"

### 4.3 知识图谱管理

**关键工作流**:
1. 查询执行:KG RAG 检索 → 外部查询降级
2. 回写机制:外部响应 → 写入知识图谱
3. 递归检索:确定关键实体 → 构建最大深度 2 的子图
4. 多跳推理:多个关键实体 → 合并多个子图

### 4.4 Context Window 管理

**Token 管理参数**:
```python
CONTEXT_LENGTH = 4096
EVICTION_RATE = 0.7
NONEVICTION_LENGTH = 5
TOP_ENTITIES = 20
MAX_ENTITIES_FROM_KG = 5
```

### 4.5 工具系统

**默认工具集**:
- `search`:KG RAG 检索器 + 外部 Web 搜索
- `locate`:Geocoder + Google Maps
- `vision`:OllamaMultiModal/OpenAI
- `stocks`:Alpha Vantage API

---

## 5. 技术栈

### 5.1 前端

- **Framework**:Streamlit 1.38.0

### 5.2 后端

- **Agent 框架**:LlamaIndex 0.11.4
- **ReAct Agent**:via llama-index
- **数据处理**:Pandas, NumPy

### 5.3 LLM 服务

- **本地**:Ollama (Llama3, LLaVA)
- **云端**:OpenAI (gpt-3.5-turbo, gpt-4-vision)
- **外部查询**:Perplexity (mistral-7b-instruct)

### 5.4 数据库

- **图数据库**:Neo4j 5.17.0, FalkorDB 1.0.8
- **检索器**:KnowledgeGraphRAGRetriever

### 5.5 其他服务

- **地理服务**:Google Maps API, Geocoder
- **可视化**:PyVis 0.3.2
- **配置管理**:python-dotenv 1.0.1

---

## 6. 部署架构

### 6.1 开发环境

```bash
# 创建虚拟环境
python -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
# .env 文件
OPENAI_API_KEY="xxx"
FALKORDB_URL="falkor://[user]:[pw]@[host]:port"
NEO4J_URL="neo4j://xxxx"
NEO4J_PW="xxx"
PERPLEXITY_API_KEY="xxx"
GOOGLEMAPS_API_KEY="xxx"

# 启动 Ollama
ollama run llama3
ollama run llava

# 运行应用
cd streamlit_app
streamlit run app.py
```

### 6.2 生产环境

**Docker Compose**:
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "8501:8501"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - NEO4J_URL=neo4j://neo4j:7687
    depends_on:
      - neo4j

  neo4j:
    image: neo4j:5.17.0
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      - NEO4J_AUTH=neo4j/password
```

---

## 7. 工程实践

### 7.1 代码质量

- **Linting**:未配置(建议 flake8/pylint)
- **Type Checking**:部分使用(@dataclass)
- **Testing**:未见测试文件(建议 pytest)

### 7.2 项目结构

```
Memary/
├── src/memary/
│   ├── agent/              # 代理核心
│   ├── memory/             # 记忆模块
│   └── synonym_expand/     # 同义词扩展
├── streamlit_app/          # Web UI
├── dev/                   # 研发目录
└── diagrams/              # 架构图
```

---

## 8. 安全和隐私

### 8.1 数据加密

- **传输中**:TLS/SSL(需配置)
- **存储**:Neo4j/FalkorDB TLS
- **API 密钥**:.env 文件(建议 Secret Manager)

### 8.2 数据隔离

- **用户隔离**:user_id 多图隔离
- **RBAC**:建议增强
- **日志脱敏**:需实现

### 8.3 合规性

- **审计**:需添加操作审计日志
- **GDPR**:用户数据删除权
- **数据导出**:JSON 备份支持

---

## 9. 性能优化

### 9.1 缓存策略

```python
# 建议启用 Redis
# 查询缓存
# 聊天历史缓存(内存中,有 Token 限制)
```

### 9.2 索引优化

```cypher
# Neo4j 索引
CREATE INDEX ON :Entity(id);
CREATE INDEX ON :Relationship(type);
```

### 9.3 流式处理

- Streamlit 原生支持流式输出

### 9.4 异步队列

- 建议集成 Celery (Redis) 处理耗时操作

---

## 10. 总结

Memary 的架构设计体现了以下核心原则:

1. **两层记忆架构** - Memory Stream(宽度) + Entity Knowledge Store(深度)
2. **多层检索** - 递归 + 多跳推理实现精准上下文
3. **混合 LLM** - 本地(零成本) + 云端(高可用)
4. **知识持久化** - 图数据库 + JSON 混合存储
5. **可扩展工具系统** - 内置 + 自定义工具简单集成

**适用场景**:
- 长期对话机器人
- 个人助理系统
- 专业知识库系统
- 多代理协作平台

**云服务推荐**:

| 规模 | 推荐配置 | 成本 |
|------|--------|------|
| 小型(1K) | FalkorDB + 本地 Ollama | ~$55-100/月 |
| 中型(10K) | Neo4j 企业 + Ollama GPU | ~$1.3K-2K/月 |
| 大型(100K+) | Neo4j 分布式 + 混合模型 | ~$10K+/月 |

---

**文档版本**:v1.0
**更新日期**:2025-02-12
**基础版本**:Memary 项目
**Python 版本**:≤3.11.9
