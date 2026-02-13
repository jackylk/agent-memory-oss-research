# Memori 云服务需求分析

> 基于企业级 AI 记忆系统的生产部署需求

## 1. 计算资源需求

### 1.1 CPU/内存/并发配置

| 部署规模 | CPU | 内存 | 并发连接 | 吞吐量 |
|---------|-----|------|---------|--------|
| 开发环境 | 2-4核 | 2-4GB | 10-50 | 10-50 req/s |
| 小型部署(1K用户) | 4-8核 | 8GB | 100-200 | 100-200 req/s |
| 中型部署(10K用户) | 16-32核 | 32GB | 1000+ | 1000+ req/s |
| 大型部署(100K+用户) | 64+核 | 256+GB | 10000+ | 10000+ req/s |

### 1.2 计算资源用途

**核心功能**:
- LLM 请求转发和响应处理
- 向量嵌入计算(支持本地运行)
- 异步任务队列处理
- 会话管理和缓存
- 实时消息路由

**技术优势**:
- 容器原生支持,实现秒级启停
- 无状态架构设计便于水平扩展
- 支持异步处理降低响应延迟
- 自动负载均衡能力

## 2. 数据库需求

### 2.1 支持的数据库类型

| 数据库 | 连接方式 | 推荐用途 | 存储容量 |
|--------|---------|---------|--------|
| **PostgreSQL** | SQLAlchemy/psycopg | 生产标准配置 | 10-100GB |
| **MySQL/MariaDB** | SQLAlchemy/pymysql | 中等规模部署 | 10-50GB |
| **SQLite** | 原生/SQLAlchemy | 开发/本地测试 | 1-5GB |
| **MongoDB** | PyMongo | 灵活模式存储 | 10-100GB |
| **CockroachDB** | SQLAlchemy/psycopg | 分布式高可用 | 50-500GB |

### 2.2 数据库用途和特殊需求

**存储内容**:
- 对话消息和会话元数据
- 事实提取结果和语义三元组
- 实体-流程-会话三层追踪关系
- 知识图谱结构化数据

**备份恢复策略**:
- 每日全量备份
- 小时级增量备份
- 时间点恢复(PITR)能力
- 多区域容灾备份

**数据库 Schema 设计(9个核心表)**:
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

-- 知识图谱
memori_knowledge_graph (id, entity_id, subject_id, predicate_id, object_id)
```

### 2.3 扩展策略

**纵向扩展**:
- PostgreSQL 参数调优
- 索引优化和查询重写
- 连接池配置优化

**横向扩展**:
- CockroachDB 分布式部署
- 主从复制架构
- 读写分离策略

**数据归档**:
- 6个月以上数据归档到冷存储
- 自动清理策略
- 数据压缩优化

## 3. 存储需求

### 3.1 容量规划

| 部署阶段 | 热数据(数据库) | 温数据(对象存储) | 冷数据(归档存储) | 总容量 |
|---------|---------------|-----------------|-----------------|--------|
| 开发环境 | 100MB | 50MB | 10MB | 160MB |
| 1K用户 | 5GB | 2GB | 500MB | 7.5GB |
| 10K用户 | 50GB | 20GB | 5GB | 75GB |
| 100K用户 | 500GB | 200GB | 50GB | 750GB |

### 3.2 访问模式

**I/O 特征**:
- **顺序读写**: 对话日志、处理日志持久化
- **随机读取**: 向量嵌入查询、知识图遍历
- **高频读取**: 缓存命中和热数据访问
- **批量写入**: 事实提取结果批量存储

### 3.3 存储成本

- **S3 标准存储**: $0.023/GB/月
- **S3 低频访问**: $0.0125/GB/月
- **Glacier 深度归档**: $0.00099/GB/月

## 4. 向量数据库需求

### 4.1 FAISS 内存向量索引

**技术参数**:
- **向量模型**: all-MiniLM-L6-v2 (Sentence Transformers)
- **向量维度**: 768维
- **索引类型**: FAISS IndexFlatL2 (欧氏距离)
- **相似度阈值**: 0.1 (可配置)

### 4.2 性能基准

| 向量数量 | 查询延迟(FAISS) | QPS | 建议 |
|---------|----------------|-----|------|
| 10K | 1-2ms | 500-1000 | 性能良好 |
| 100K | 5-10ms | 100-200 | 性能良好 |
| 1M | 20-50ms | 20-50 | 考虑分片 |
| 10M | 100-200ms | 5-10 | 需要向量数据库 |

### 4.3 可选的外部向量数据库

| 解决方案 | 优势 | 成本模型 |
|---------|------|---------|
| **Pinecone** | 完全托管、易于扩展 | $0.04/1K 向量/月 |
| **Weaviate** | 开源、支持自托管 | 自托管免费 |
| **Milvus** | 开源、高性能 | 自托管免费 |
| **Qdrant** | 开源、生产就绪 | 自托管免费 |

## 5. AI 服务需求

### 5.1 嵌入模型服务

**当前实现**:
- 模型: all-MiniLM-L6-v2
- 维度: 768
- 部署: 本地运行
- 成本: $0 (无托管费用)

**可选的托管嵌入服务**:

| 服务提供商 | 定价 | 集成难度 |
|-----------|------|---------|
| **OpenAI Embeddings** | $0.02/1M tokens | 简单 |
| **Cohere Embed** | $2/M API调用 | 简单 |
| **HuggingFace Inference** | $0.06/M调用 | 中等 |

### 5.2 LLM 成本分析(月度)

| 使用场景 | LLM调用成本 | Advanced Augmentation | 月度总成本 |
|---------|------------|---------------------|-----------|
| 小型(1K用户) | $3-5 | $0 (免费额度) | $3-5 |
| 中型(10K用户) | $10-15 | $5-20 | $15-35 |
| 大型(100K用户) | $100-200 | $100-500 | $200-700 |

### 5.3 支持的 LLM 提供商

**集成的提供商**:
- OpenAI (gpt-4o, gpt-4o-mini)
- Anthropic (Claude 3.x 全系列)
- Google (Gemini)
- xAI (Grok)
- AWS Bedrock
- LangChain 框架
- Pydantic AI

**集成特点**:
- 完全 LLM 无关设计
- 支持同步/异步/流式调用
- 自动提供商检测
- 统一错误处理

## 6. 网络和 CDN 需求

### 6.1 全球节点部署

**地域分布**:
- 美国东部(主要)
- 欧洲中部
- 亚太区域

**性能目标**:
- 端到端延迟: <200ms
- 可用性: 99.9%
- 推荐服务: CloudFlare / AWS CloudFront

### 6.2 安全和协议

**DDoS 防护**: 通过云提供商 WAF 自动防护
**SSL/TLS**: 强制 HTTPS / TLS 1.3
**域名解析**: 多地域 DNS 解析

### 6.3 带宽需求

| 使用场景 | 月消息数 | 平均消息大小 | 月带宽消耗 |
|---------|---------|------------|-----------|
| 小型部署 | 10K | 1KB | 10MB |
| 中型部署 | 100K | 2KB | 200MB |
| 大型部署 | 1M | 5KB | 5GB |

## 7. 部署复杂度评估

| 维度 | 评分 (1-10) | 说明 |
|------|------------|------|
| **基础设施配置** | 3 | 最小配置即可运行,Docker 开箱即用 |
| **数据库管理** | 4 | 支持多种数据库,schema 自动迁移 |
| **CI/CD 复杂度** | 2 | PyPI 发布,简单依赖管理 |
| **监控和日志** | 5 | 支持环境变量配置日志级别 |
| **总体复杂度** | **4** | 中等 - 核心简单,生产运维有学习曲线 |

## 8. 成本估算

### 8.1 小规模部署(1000活跃用户)

| 服务项目 | 配置 | 月度成本 |
|---------|------|---------|
| 计算资源 | Heroku Standard-2x (2实例) | $100 |
| 数据库 | PostgreSQL 10GB | $15 |
| 备份存储 | 100GB | $2 |
| LLM 调用 | 基础使用 | $4 |
| **月度总计** | | **$126** |

### 8.2 中等规模部署(10000用户)

| 服务项目 | 配置 | 月度成本 |
|---------|------|---------|
| 计算资源 | AWS EC2 c5.xlarge (4实例) | $500 |
| 数据库 | RDS PostgreSQL (r6i.xlarge) | $730 |
| 备份存储 | 500GB | $48 |
| LLM 调用 | 标准使用 | $50 |
| Advanced Augmentation | 增强服务 | $200 |
| CDN | CloudFront (1TB) | $85 |
| **月度总计** | | **$1,826** |

### 8.3 大规模部署(100000+用户)

| 服务项目 | 配置 | 月度成本 |
|---------|------|---------|
| 计算资源 | Kubernetes (EKS, 100实例) | $7,200 |
| 数据库 | RDS Multi-AZ + 读副本 | $7,620 |
| 存储服务 | 5TB EBS + S3 | $600 |
| LLM 调用 | 高频使用 | $500 |
| Advanced Augmentation | 企业级增强 | $2,000 |
| 向量数据库 | 托管服务(可选) | $4,000 |
| CDN | CloudFront (50TB) | $4,250 |
| 监控服务 | APM + 日志 | $1,000 |
| **月度总计** | | **$28,070** |

## 9. 必需的云服务清单

### 9.1 必需服务 ✅

**核心基础设施**:
- 关系型数据库 (PostgreSQL/MySQL/MongoDB)
- 应用托管平台 (任何支持 Python 的环境)
- 密钥管理服务 (AWS Secrets Manager / Azure Key Vault)
- 日志管理系统 (CloudWatch / Stackdriver)
- 备份存储服务 (S3 / Google Cloud Storage)

### 9.2 推荐服务 ⚠️

**性能优化**:
- 向量搜索数据库 (超大规模 >1M 向量时)
- CDN 内容分发网络 (全球分布式访问)
- 消息队列服务 (异步任务处理优化)
- 缓存服务 (Redis 热数据缓存)
- APM 应用性能监控

### 9.3 可选服务 🔧

**扩展功能**:
- Document DB (MongoDB 替代方案)
- DynamoDB (NoSQL 存储选项)
- 图数据库 (知识图谱可视化)
- 全文搜索引擎 (Elasticsearch)
- WebSocket Gateway (实时更新支持)

## 10. 云服务推荐配置

### 10.1 按规模推荐

| 部署规模 | 推荐云服务配置 | 月度成本范围 |
|---------|--------------|-------------|
| **小型(1K用户)** | Heroku + Neon PostgreSQL | $50-150 |
| **中型(10K用户)** | AWS ECS + RDS PostgreSQL | $500-1,500 |
| **大型(100K+用户)** | Kubernetes + RDS Multi-AZ | $5,000-30,000 |

### 10.2 主流云平台配置建议

**AWS 配置**:
- 计算: ECS Fargate / EKS
- 数据库: RDS PostgreSQL Multi-AZ
- 存储: S3 + EBS
- 缓存: ElastiCache Redis
- 监控: CloudWatch + X-Ray

**Google Cloud 配置**:
- 计算: Cloud Run / GKE
- 数据库: Cloud SQL PostgreSQL
- 存储: Cloud Storage
- 缓存: Memorystore Redis
- 监控: Cloud Monitoring

**Azure 配置**:
- 计算: Container Apps / AKS
- 数据库: Azure Database for PostgreSQL
- 存储: Blob Storage
- 缓存: Azure Cache for Redis
- 监控: Application Insights

## 11. 独特技术特性与云需求

### 11.1 Advanced Augmentation 引擎

**技术特点**:
- 自动从对话中提取事实、偏好、技能、关系
- 通过命名实体识别(NER)生成语义三元组
- 异步后台处理,零延迟增强

**云需求影响**:
- 需要异步任务队列支持
- 推荐使用消息队列服务(SQS/Cloud Tasks)
- 需要足够的计算资源处理NLP任务

### 11.2 灵活归属系统

**架构设计**:
- Entity (用户/对象) → Process (代理/应用) → Session (对话)
- 三层追踪架构

**云需求影响**:
- 需要支持复杂关系查询的数据库
- PostgreSQL 的外键和索引性能至关重要
- 建议使用关系型数据库而非文档型

### 11.3 多数据库适配器模式

**支持范围**:
- 10+ 数据库类型
- SQLAlchemy / Django ORM / MongoDB
- 通过装饰器自动识别

**云需求影响**:
- 部署灵活性高,可使用现有数据库基础设施
- 无需额外中间件或专有数据库
- 降低迁移和集成成本

### 11.4 本地向量索引(FAISS)

**技术优势**:
- 768维向量,本地内存索引
- 无需外部向量数据库依赖
- 适合中小规模部署(<1M向量)

**云需求影响**:
- 降低向量数据库托管成本
- 需要足够内存支持向量索引
- 超大规模时可选择托管向量数据库

## 12. 性能优化建议

### 12.1 数据库优化

**索引策略**:
```sql
CREATE INDEX ON memori_entity_fact(entity_id);
CREATE INDEX ON memori_session(entity_id, process_id);
CREATE INDEX ON memori_conversation(session_id);
CREATE INDEX ON memori_knowledge_graph(entity_id);
```

**连接池配置**:
```python
engine = create_engine(
    db_url,
    pool_size=20,
    max_overflow=0,
    pool_pre_ping=True
)
```

### 12.2 缓存策略

**多层缓存**:
- L1: 应用内存缓存 (entity_id, process_id, session_id)
- L2: Redis 分布式缓存
- L3: 数据库查询结果缓存

### 12.3 向量搜索优化

**索引类型选择**:
- **IndexFlatL2**: 精确搜索,适合<100K向量
- **IndexIVFFlat**: 倒排索引,适合100K-10M向量
- **IndexHNSW**: 图索引,适合>10M向量

## 13. 安全和合规

### 13.1 数据加密

**传输层加密**:
- 强制 HTTPS / TLS 1.3
- API 密钥通过环境变量或 Secrets Manager 管理

**存储层加密**:
- 数据库原生加密支持
- S3 服务端加密(SSE-S3/SSE-KMS)

### 13.2 隐私保护

**PII 处理**:
- 应在应用层实现脱敏
- 支持 GDPR 数据导出和删除
- 数据驻留多区域选择

### 13.3 访问控制

**安全机制**:
- 通过 entity_id 实现数据隔离
- 应用层实现认证和授权
- 建议启用审计日志

## 14. 总结

### 14.1 云服务需求特点

**优势**:
1. **低基础设施依赖**: 利用现有数据库,无需专有中间件
2. **灵活部署选项**: 支持10+数据库,6+LLM提供商
3. **成本可控**: 本地向量索引降低托管成本
4. **渐进式扩展**: 从单实例到 Kubernetes 集群平滑升级

**适用场景**:
- 企业 AI 聊天机器人
- 多轮对话系统
- 多用户/多代理记忆管理
- 需要持久化记忆的 AI 应用

### 14.2 云平台选择建议

| 优先级 | 云平台 | 适用场景 |
|-------|--------|---------|
| ⭐⭐⭐ | AWS | 全面的托管服务,RDS PostgreSQL 性能优异 |
| ⭐⭐⭐ | Google Cloud | Kubernetes(GKE) 原生支持,Cloud SQL 易用 |
| ⭐⭐ | Azure | 企业集成友好,混合云支持 |
| ⭐⭐ | Heroku | 小型快速原型,简化部署 |

---

**文档版本**: v1.0
**更新日期**: 2025-02-12
**基于项目**: Memori - Enterprise AI Memory Fabric
