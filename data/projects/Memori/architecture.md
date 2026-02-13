# Memori 架构分析

> 基于实际代码库分析 (Memori - Enterprise AI Memory Fabric)

## 1. 整体架构概述

**Memori** 是一个开源的 AI 代理记忆系统,为企业级 AI 应用提供持久化、结构化的记忆层。它自动捕获对话、提取事实、支持语义搜索,是一个 **LLM 无关、数据库无关、框架无关** 的通用解决方案。

### 项目定位

- **应用领域**:企业 AI 聊天机器人、多轮对话系统、AI 代理记忆管理
- **核心价值**:零集成成本 + 无延迟增强 + 多源支持 + SQL 原生 + 语义智能
- **关键创新**:Advanced Augmentation 引擎、灵活归属系统、适配器模式、流式处理支持

### 核心价值主张

- **零集成成本**:单行代码集成 (`Memori(conn=db).llm.register(client)`)
- **无延迟增强**:Advanced Augmentation 后台异步运行
- **多源支持**:支持 6+ LLM 提供商、10+ 数据库、多个 AI 框架
- **SQL 原生**:使用企业现有基础设施,无需新增中间件
- **语义智能**:向量嵌入 + FAISS 语义搜索,提供上下文感知的事实召回

### 关键创新点

1. **Advanced Augmentation Engine**:自动从对话中提取事实、偏好、技能、关系,通过命名实体识别(NER)生成语义三元组
2. **灵活的归属系统**:支持 Entity(用户/对象) → Process(代理/应用) → Session(对话) 三层追踪
3. **适配器模式**:通过装饰器注册制自动识别数据库和 LLM 提供商,极大简化扩展
4. **流式处理支持**:完整支持同步、异步、流式、非流式四种 LLM 调用模式

### 与其他项目的差异

| 维度 | Memori | Mem0 | Graphiti | Letta |
|------|--------|------|----------|-------|
| **核心概念** | 企业记忆层 | 个人记忆 | 时态知识图谱 | 虚拟上下文 |
| **集成方式** | 单行代码注册 | SDK 集成 + 编排 | 图数据库特定 | 完整框架替代 |
| **数据库支持** | 10+ SQL/NoSQL | 主要向量DB | Neo4j 专有 | 内置 SQLite |
| **LLM 无关** | ✅ 完全 | ✅ 完全 | ✅ 完全 | ❌ 框架绑定 |
| **无延迟设计** | ✅ 异步后台 | ❌ 同步处理 | ✅ 图遍历高效 | ❌ 需要调用 |
| **语义搜索** | ✅ FAISS + 向量 | ✅ 向量原生 | ✅ 图查询 | ⚠️ 基础 |

---

## 2. 核心架构组件

### 架构分层图

```architecture
{
  "layers": [
    {
      "title": "应用层",
      "icon": "🚀",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "APP1", "label": "用户应用代码" },
        { "id": "APP2", "label": "LLM 客户端" },
        { "id": "APP3", "label": "AI 框架集成" }
      ]
    },
    {
      "title": "Memori 核心层",
      "icon": "⚙️",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "CORE1", "label": "LLM 提供商适配器" },
        { "id": "CORE2", "label": "归属系统" },
        { "id": "CORE3", "label": "Advanced Augmentation 引擎" },
        { "id": "CORE4", "label": "Recall API" },
        { "id": "CORE5", "label": "会话管理器" }
      ]
    },
    {
      "title": "记忆处理层",
      "icon": "🧠",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "MEM1", "label": "事实提取器(NER)" },
        { "id": "MEM2", "label": "嵌入生成" },
        { "id": "MEM3", "label": "向量索引(FAISS)" },
        { "id": "MEM4", "label": "知识图构建" },
        { "id": "MEM5", "label": "文本分块器" }
      ]
    },
    {
      "title": "存储适配层",
      "icon": "🔌",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "ADAPT1", "label": "SQLAlchemy 适配器" },
        { "id": "ADAPT2", "label": "Django ORM 适配器" },
        { "id": "ADAPT3", "label": "MongoDB 适配器" },
        { "id": "ADAPT4", "label": "DB API 2.0 适配器" }
      ]
    },
    {
      "title": "数据库驱动层",
      "icon": "🗄️",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "DRV1", "label": "PostgreSQL" },
        { "id": "DRV2", "label": "MySQL/MariaDB" },
        { "id": "DRV3", "label": "SQLite" },
        { "id": "DRV4", "label": "MongoDB" },
        { "id": "DRV5", "label": "Oracle/OceanBase" }
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
| 开发 | 2-4核 | 2-4GB | 10-50 | 10-50 req/s |
| 小型(1K用户) | 4-8核 | 8GB | 100-200 | 100-200 req/s |
| 中型(10K用户) | 16-32核 | 32GB | 1000+ | 1000+ req/s |
| 大型(100K+用户) | 64+核 | 256+GB | 10000+ | 10000+ req/s |

**用途和成本优势**:
- LLM 请求转发和响应处理
- 向量嵌入计算(可选本地)
- 异步任务排队和处理
- 会话管理和缓存
- 容器原生支持,秒级启停
- 无状态设计便于水平扩展

### 3.2 数据库需求

**类型和配置**

| 数据库 | 连接方式 | 推荐用途 | 存储容量 |
|--------|---------|---------|--------|
| **PostgreSQL** | SQLAlchemy/psycopg | 生产标准 | 10-100GB |
| **MySQL/MariaDB** | SQLAlchemy/pymysql | 中等规模 | 10-50GB |
| **SQLite** | 原生/SQLAlchemy | 开发/本地 | 1-5GB |
| **MongoDB** | PyMongo | 灵活模式 | 10-100GB |
| **CockroachDB** | SQLAlchemy/psycopg | 分布式HA | 50-500GB |

**用途和特殊需求**:
- 存储对话消息、事实、会话元数据
- 知识图谱存储(语义三元组)
- 实体-流程-会话三层追踪
- 备份:每日全量 + 小时增量
- 恢复:时间点恢复(PITR)能力

**扩展策略**:
- 纵向:PostgreSQL 参数调优,索引优化,连接池
- 横向:CockroachDB 分布式,主从复制 + 读写分离
- 归档:6 个月数据归档到冷存储

### 3.3 存储需求

**容量和用途**

| 阶段 | 热数据(DB) | 温数据(S3) | 冷数据(Glacier) | 总计 |
|------|-----------|-----------|----------------|------|
| 开发 | 100MB | 50MB | 10MB | 160MB |
| 1K用户 | 5GB | 2GB | 500MB | 7.5GB |
| 10K用户 | 50GB | 20GB | 5GB | 75GB |
| 100K用户 | 500GB | 200GB | 50GB | 750GB |

**访问模式**:
- **顺序读写**:对话日志、处理日志
- **随机读**:embedding查询、知识图遍历
- **高频读**:缓存命中

**成本**:$0.023/GB/月 (S3 Standard)

### 3.4 向量数据库需求

**索引和性能**

Memori 使用 **FAISS 内存向量索引**:
- **向量模型**:all-MiniLM-L6-v2 (Sentence Transformers)
- **维度**:768
- **索引类型**:FAISS IndexFlatL2 (欧氏距离)
- **相似度阈值**:0.1 (可配置)

| 向量数量 | 查询时间(FAISS) | QPS | 建议 |
|--------|-----------------|-----|------|
| 10K | 1-2ms | 500-1000 | OK |
| 100K | 5-10ms | 100-200 | OK |
| 1M | 20-50ms | 20-50 | 考虑分片 |
| 10M | 100-200ms | 5-10 | 需向量DB |

**可选的外部向量数据库**:

| 方案 | 优势 | 成本 |
|------|------|------|
| **Pinecone** | 完全托管、易扩展 | $0.04/1K 向量/月 |
| **Weaviate** | 开源、自托管 | 自托管免费 |
| **Milvus** | 开源、高性能 | 自托管免费 |
| **Qdrant** | 开源、生产就绪 | 自托管免费 |

### 3.5 AI 服务需求

**嵌入模型**:
- 当前实现:all-MiniLM-L6-v2 (本地)
- 维度:768
- 成本:$0 (本地运行)

**可选的托管嵌入服务**:

| 服务 | 成本 | 集成难度 |
|------|------|---------|
| **OpenAI Embeddings** | $0.02/1M tokens | 简单 |
| **Cohere Embed** | $2/M APIs | 简单 |
| **HuggingFace Inference** | $0.06/M | 中等 |

**LLM 成本分析(月度)**:

| 场景 | LLM成本 | Advanced Augmentation | 总成本 |
|------|--------|---------------------|--------|
| 小型(1K用户) | $3-5 | $0 (免费额度) | $3-5 |
| 中型(10K用户) | $10-15 | $5-20 | $15-35 |
| 大型(100K用户) | $100-200 | $100-500 | $200-700 |

**支持的 LLM 提供商**:
- OpenAI (gpt-4o, gpt-4o-mini)
- Anthropic (Claude 3.x)
- Google (Gemini)
- xAI (Grok)
- Bedrock
- LangChain
- Pydantic AI

### 3.6 网络和 CDN

**全球节点**:
- 地域:美国东部、欧洲、亚太区
- 延迟目标:<200ms 端到端
- 推荐:CloudFlare/AWS CloudFront

**DDoS 防护**:自动,通过云提供商 WAF
**SSL/TLS**:强制 HTTPS/TLS 1.3
**带宽**:

| 场景 | 月消息数 | 平均消息大小 | 月带宽 |
|------|---------|----------|--------|
| 小型 | 10K | 1KB | 10MB |
| 中型 | 100K | 2KB | 200MB |
| 大型 | 1M | 5KB | 5GB |

### 3.7 部署复杂度评估

| 维度 | 评分 (1-10) | 说明 |
|------|-------------|------|
| **基础设施配置** | 3 | 最小配置即可运行,Docker 开箱即用 |
| **数据库管理** | 4 | 支持多种数据库,schema 自动迁移 |
| **CI/CD 复杂度** | 2 | PyPI 发布,简单依赖管理 |
| **监控和日志** | 5 | 支持环境变量配置日志 |
| **总体复杂度** | **4** | 中等 - 核心简单,生产运维有学习曲线 |

### 3.8 成本估算(月度)

**小规模部署(1000活跃用户)**
- 计算:Heroku Standard-2x (2实例) = $100
- 数据库:PostgreSQL 10GB = $15
- 备份存储:100GB = $2
- LLM 调用:$4
- **总计:$126/月**

**中等规模(10000用户)**
- 计算:AWS EC2 c5.xlarge (4实例) = $500
- 数据库:RDS PostgreSQL (r6i.xlarge) = $730
- 备份:500GB = $48
- LLM 调用:$50
- Advanced Augmentation:$200
- 网络:CloudFront (1TB) = $85
- **总计:$1,826/月**

**大规模(100000+用户)**
- 计算:Kubernetes (EKS,100实例) = $7,200
- 数据库:RDS Multi-AZ + 读副本 = $7,620
- 存储:5TB EBS + S3 = $600
- LLM 调用:$500
- Advanced Augmentation:$2,000
- 向量DB(可选):$4,000
- 网络:CloudFront (50TB) = $4,250
- 监控:$1,000
- **总计:$28,070/月**

### 3.9 必需的云服务清单

✅ **必需**:
- 数据库 (PostgreSQL/MySQL/MongoDB)
- 应用托管 (任何 Python 环境)
- 密钥管理 (AWS Secrets Manager/Azure Vault)
- 日志管理 (CloudWatch/Stackdriver)
- 备份存储 (S3/GCS)

⚠️ **推荐**:
- 向量搜索DB (超大规模 >1M 向量)
- CDN (全球分布)
- 消息队列 (异步任务处理)
- 缓存 (Redis 热数据缓存)
- APM (应用性能监控)

🔧 **可选**:
- Document DB (MongoDB 替代)
- DynamoDB (NoSQL 存储)
- 图数据库 (知识图可视化)
- Full-Text Search (Elasticsearch)
- WebSocket Gateway (实时更新)

---

## 4. 核心模块详解

### 4.1 LLM 适配层

**位置**:`/memori/llm/`

**支持的提供商**:
- OpenAI:Chat Completions + Responses API
- Anthropic:Claude 全系列
- Google Gemini:完整支持
- xAI (Grok):完整支持
- Bedrock:通过 LangChain 集成
- LangChain:原生框架支持
- Pydantic AI:所有提供商支持

**核心流程**:
```
1. 用户创建 LLM 客户端
2. 调用 mem.llm.register(client)
3. Memori 包装客户端方法
4. 拦截调用:捕获 messages, model, parameters
5. 转发至真实 LLM
6. 捕获响应
7. 异步发送至存储和 Advanced Augmentation
8. 返回原始响应
```

### 4.2 存储管理层

**位置**:`/memori/storage/`

**Schema (9个主表)**:
```sql
-- 用户/对象追踪
memori_entity (entity_id, external_id, created_at)
memori_process (process_id, external_id, created_at)

-- 会话管理
memori_session (session_id, entity_id, process_id, uuid, created_at)
memori_conversation (id, session_id, summary, created_at)

-- 对话记录
memori_conversation_message (id, conversation_id, role, type, content)

-- 事实存储
memori_entity_fact (id, entity_id, fact, fact_embedding, mention_count)

-- 知识图
memori_knowledge_graph (id, entity_id, subject_id, predicate_id, object_id)
```

### 4.3 记忆增强层

**位置**:`/memori/memory/`

**Augmentation Manager**:
- 处理 hosted vs self-hosted 模式
- 重试逻辑(指数退避)
- 本地缓存持久化

**Recall**:
- 语义搜索接口
- FAISS 向量索引
- 相似度排序

### 4.4 嵌入和搜索层

**位置**:`/memori/embeddings/`, `/memori/search/`

**嵌入生成**:
- 模型:all-MiniLM-L6-v2
- 维度:768
- 分块:可配置
- 异步支持

**搜索实现**:
- IndexFlatL2 欧氏距离
- 相似度阈值过滤
- 批量向量操作

---

## 5. 技术栈

### 5.1 后端

- **语言**:Python 3.10+
- **打包**:setuptools/wheel
- **异步**:asyncio/ThreadPoolExecutor

### 5.2 数据库

- **ORM**:SQLAlchemy 2.0+
- **驱动**:psycopg (PostgreSQL), PyMySQL (MySQL), sqlite3, pymongo (MongoDB)

### 5.3 AI 服务

- **嵌入**:sentence-transformers 3.0+
- **向量搜索**:faiss-cpu 1.7+
- **数值计算**:numpy 1.24+

### 5.4 LLM 集成

- OpenAI:openai 2.6+
- Anthropic:anthropic 0.71+
- Google:google-genai 1.46+
- xAI:xai-sdk 1.3+

### 5.5 框架集成

- Django:django (ORM 集成)
- LangChain:langchain-core
- Pydantic AI:pydantic-ai

### 5.6 开发工具

- **测试**:pytest 8.4+, pytest-cov 6.0+
- **Linting**:ruff 0.8+
- **安全**:bandit 1.8+
- **Git钩子**:pre-commit 4.0+

---

## 6. 部署架构

### 6.1 开发环境

```bash
# 克隆项目
git clone https://github.com/MemoriLabs/Memori
cd Memori

# 启动 Docker
make dev-up
make dev-shell

# 运行测试
make run-unit

# 格式化
make format
```

**Docker Compose**:
- dev:Python 3.12 容器
- postgres:PostgreSQL 16
- mongodb:MongoDB 7.0
- mysql:MySQL 8

### 6.2 生产环境

**Kubernetes 部署**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: memori-api
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: memori
        image: memori:latest
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
```

**Heroku 部署**:
```bash
heroku config:set DATABASE_URL=postgresql://...
heroku config:set MEMORI_API_KEY=...
```

---

## 7. 工程实践

### 7.1 代码质量

```bash
make lint  # Ruff 检查
make format  # 自动格式化
uvx ty check  # 类型检查
make security  # 安全审计
```

### 7.2 测试

```bash
make run-unit  # 单元测试
make run-integration  # 集成测试
make run-integration-provider P=openai  # 提供商测试
```

**覆盖率目标**:>80%

### 7.3 CI/CD

**GitHub Actions**:
1. Lint Job:Ruff 格式检查
2. Security Job:Bandit + pip-audit
3. Type Check:ty 类型检查
4. Test Job:Python 3.10/3.11/3.12
5. Coverage:Codecov 上传

---

## 8. 安全和隐私

### 8.1 数据加密

- **传输层**:HTTPS/TLS 1.3
- **存储层**:数据库原生加密
- **API 密钥**:环境变量/Secrets Manager

### 8.2 隐私保护

- **PII 处理**:应在应用层实现脱敏
- **数据驻地**:支持多区域部署
- **数据导出**:支持 GDPR 导出和删除

### 8.3 访问控制

- **认证**:由应用层实现
- **授权**:通过 entity_id 隔离
- **审计日志**:建议在应用层实现

---

## 9. 性能优化

### 9.1 缓存

```python
# 自动缓存 entity_id, process_id, session_id
# SQLAlchemy 连接池
engine = create_engine(
    db_url,
    pool_size=20,
    max_overflow=0,
    pool_pre_ping=True
)
```

### 9.2 索引

```sql
CREATE INDEX ON memori_entity_fact(entity_id);
CREATE INDEX ON memori_session(entity_id, process_id);
CREATE INDEX ON memori_conversation(session_id);
CREATE INDEX ON memori_knowledge_graph(entity_id);
```

### 9.3 向量搜索

- 维度:768 (固定)
- 索引类型:IndexFlatL2 (线性搜索,精确)
- 可选:IndexIVFFlat (倒排索引,更快)

### 9.4 异步处理

```python
# 异步 LLM 调用
response = await client.chat.completions.create(...)

# 后台任务
mem.augmentation.wait()  # 等待完成
```

---

## 10. 总结

Memori 的架构设计体现了以下核心原则:

1. **无侵入式集成** - 单行代码注册,无需修改业务逻辑
2. **灵活的后端支持** - 10+ 数据库、6+ LLM 提供商
3. **性能优先** - 异步 Advanced Augmentation,本地向量索引
4. **扩展性强** - 适配器模式便于添加新数据库/LLM
5. **生产就绪** - 完整的错误处理、监控、测试覆盖

**适用场景**:
- 需要记忆的 AI 聊天机器人
- 多轮对话中的用户偏好学习
- 企业内 AI 代理(客服、分析)
- 多用户/多代理系统

**云服务推荐**:

| 规模 | 推荐配置 | 成本 |
|------|--------|------|
| 小型(1K) | Heroku + Neon PostgreSQL | $50-150/月 |
| 中型(10K) | AWS ECS + RDS | $500-1500/月 |
| 大型(100K+) | Kubernetes + RDS Multi-AZ | $5K-30K/月 |

---

**文档版本**:v1.0
**更新日期**:2025-02-12
**基础版本**:Memori - Enterprise AI Memory Fabric
