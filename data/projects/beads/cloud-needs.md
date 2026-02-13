# Beads 云服务需求分析

> 针对分布式 Git 支持的图形问题追踪系统的全面云架构规划
> 版本: 1.0 | 日期: 2025-02-12 | 基础版本: Beads v0.49.6+

## 目录

1. [计算资源需求](#1-计算资源需求)
2. [数据库架构](#2-数据库架构)
3. [向量数据库需求](#3-向量数据库需求)
4. [存储解决方案](#4-存储解决方案)
5. [AI/ML 服务集成](#5-aiml-服务集成)
6. [网络与连接](#6-网络与连接)
7. [监控、日志与可观测性](#7-监控日志与可观测性)
8. [成本汇总与优化](#8-成本汇总与优化)
9. [部署建议](#9-部署建议)
10. [最佳实践](#10-最佳实践)

---

## 1. 计算资源需求

### 1.1 架构特点

Beads 是一个**本地优先** (local-first) 的 CLI 工具,核心特性包括:
- Dolt 版本控制数据库嵌入式引擎
- Git 原生集成用于分布式同步
- 支持多智能体并发工作流
- 零中央服务器依赖(在本地 CLI 使用场景中)

### 1.2 计算规模分层

#### **小规模部署 (≤1,000 期)**
- **目标用户**: 个人开发者、小型团队(1-5人)
- **CPU**: 2 核心
- **内存**: 4GB RAM
- **存储**: 本地 SSD 50MB+
- **部署模式**: CLI 本地使用,无服务器成本

#### **中等规模部署 (1,000-10,000 期)**
- **目标用户**: 中等团队(5-50人)
- **CPU**: 4-6 核心
- **内存**: 8-12GB RAM
- **存储**: 本地 SSD 500MB+
- **部署模式**: Dolt 服务器模式 (可选) 用于多用户协作
- **QPS 能力**: ~100-300 并发请求/秒

#### **大规模部署 (10,000-100,000 期)**
- **目标用户**: 大型组织、AI 编码智能体网络
- **CPU**: 8-16 核心
- **内存**: 16-32GB RAM
- **存储**: 本地 SSD 5GB+
- **部署模式**: Dolt 服务器集群,Redis 缓存层
- **QPS 能力**: ~300-500 并发请求/秒
- **扩展**: 分片或多区域 Dolt 实例

### 1.3 工作负载特征

**CPU 密集操作**:
- Dolt 事务处理 (读/写)
- 哈希碰撞检测与验证
- JSONL 序列化/反序列化
- Git 同步与合并冲突解决

**内存使用模式**:
- 内存中 Issue 缓存 (0.1-1MB per 1000 issues)
- 依赖图遍历 (O(E) 其中 E = 边数)
- FlushManager 缓冲区 (防抖 5秒,可配置)

**I/O 特性**:
- 频繁的磁盘写入 (JSONL 同步)
- 顺序读取 (Git 拉取时导入)
- 随机访问 (Issue 查询)

### 1.4 云计算选项

| 服务提供商 | 实例类型 | 配置 | 月度成本 | 适用场景 |
|---------|--------|------|--------|--------|
| AWS EC2 | t3.medium | 2vCPU, 4GB RAM | $30 | 小规模开发 |
| AWS EC2 | t3.large | 2vCPU, 8GB RAM | $61 | 中等团队 |
| AWS EC2 | m5.xlarge | 4vCPU, 16GB RAM | $155 | 大规模生产 |
| Google Cloud | e2-medium | 2vCPU, 8GB RAM | $32 | 中等规模 |
| Azure VM | B2s | 2vCPU, 4GB RAM | $35 | 中等规模 |
| DigitalOcean | Standard | 2vCPU, 4GB RAM | $20 | 小规模开发 |
| 自托管 Kubernetes | 容器化 | 可变 | $100+ | 高可用部署 |

### 1.5 建议配置

- **开发/测试**: DigitalOcean $20/月 或 AWS t3.medium $30/月
- **生产(中等)**: AWS t3.large $61/月 + 自动备份
- **生产(大规模)**: AWS m5.xlarge $155/月 + Redis 缓存 + 负载均衡

---

## 2. 数据库架构

### 2.1 主数据库: Dolt

#### **数据库类型**
- **Dolt**: 版本控制 SQL (MySQL 兼容语法)
- **版本化**: 每个提交都是一个版本,支持时间旅行查询
- **分布式**: 支持 Git 风格的分支和合并
- **ACID**: 完整的事务支持
- **部署模式**: 嵌入式引擎或独立服务器

#### **存储容量规划**

| 规模 | 期数 | Dolt 存储 | JSONL 文件 | 备注 |
|-----|------|---------|-----------|------|
| 小 | 1K | 50MB | 1-5MB | 开发/测试 |
| 中 | 10K | 500MB | 10-50MB | 中等团队 |
| 大 | 100K | 5GB | 100-500MB | 企业级 |
| 超大 | 1M | 50GB | 1-5GB | 分片必需 |

#### **核心表结构**

```sql
-- 期表
CREATE TABLE issues (
    id VARCHAR(32) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('open', 'in_progress', 'blocked', 'closed'),
    priority INT,
    issue_type VARCHAR(50),
    assignee VARCHAR(255),
    compaction_level INT DEFAULT 0,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL,
    INDEX idx_status (status),
    INDEX idx_assignee (assignee),
    FULLTEXT INDEX idx_title (title)
);

-- 依赖表
CREATE TABLE dependencies (
    from_id VARCHAR(32) NOT NULL,
    to_id VARCHAR(32) NOT NULL,
    dep_type ENUM('blocks', 'related', 'parent_child', 'discovered_from'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (from_id, to_id, dep_type),
    FOREIGN KEY (from_id) REFERENCES issues(id),
    FOREIGN KEY (to_id) REFERENCES issues(id)
);

-- 标签表
CREATE TABLE labels (
    issue_id VARCHAR(32) NOT NULL,
    label VARCHAR(100) NOT NULL,
    PRIMARY KEY (issue_id, label),
    FOREIGN KEY (issue_id) REFERENCES issues(id)
);

-- 评论表
CREATE TABLE comments (
    id VARCHAR(32) PRIMARY KEY,
    issue_id VARCHAR(32) NOT NULL,
    author VARCHAR(255),
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (issue_id) REFERENCES issues(id),
    INDEX idx_issue_id (issue_id)
);

-- 事件审计表
CREATE TABLE events (
    id VARCHAR(32) PRIMARY KEY,
    issue_id VARCHAR(32),
    event_type VARCHAR(50),
    actor VARCHAR(255),
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_issue_id (issue_id),
    INDEX idx_actor (actor),
    INDEX idx_created_at (created_at)
);
```

#### **性能优化**

**索引策略**:
```sql
-- 频繁查询的索引
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_assignee ON issues(assignee);
CREATE INDEX idx_dependencies_from ON dependencies(from_id);
CREATE FULLTEXT INDEX idx_issues_title ON issues(title);

-- 排序优化
CREATE INDEX idx_issues_created ON issues(created_at DESC);
CREATE INDEX idx_dependencies_created ON dependencies(created_at);
```

**缓存策略**:
- 已完成期缓存 (读多写少)
- 热点依赖图缓存 (10KB-100KB)
- 标签枚举值缓存

**分区策略** (仅用于 1M+ 期):
```sql
-- 按状态分区
CREATE TABLE issues_open PARTITION OF issues
    FOR VALUES IN ('open', 'in_progress', 'blocked');
CREATE TABLE issues_closed PARTITION OF issues
    FOR VALUES IN ('closed');
```

### 2.2 备用数据库选项

#### **PostgreSQL**
- **优势**: 高级 JSON 支持,强大的全文搜索,可扩展
- **劣势**: 失去版本控制原生支持
- **用于**: 需要复杂查询和高并发的大型部署
- **成本**: AWS RDS PostgreSQL $15-100/月 (按规模)

#### **MongoDB**
- **优势**: 灵活的 schema,JSON 原生支持
- **劣势**: 事务支持有限 (Beads 需要 ACID)
- **不推荐**: 缺乏版本历史和分支支持

#### **SQLite** (遗留)
- **已支持但不推荐**: 单进程限制,多用户场景有限
- **仅用于**: 开发/测试环境

### 2.3 备份和灾难恢复

**备份策略**:
1. **自动备份**: Dolt 原生提交历史 (通过 Git)
2. **增量备份**: JSONL 文件增量导出 (每日)
3. **完全备份**: 月度完整数据库转储

**恢复时间**:
- 单个期恢复: < 100ms (Dolt 时间旅行)
- 完全数据库恢复: 1-5 分钟 (取决于规模)

**数据保留**:
- 活跃期: 无限期保留在 Dolt 版本历史
- 压缩期: 30-90 天后使用摘要替换
- 审计日志: 2 年保留

---

## 3. 向量数据库需求

### 3.1 语义搜索能力

向量数据库在 Beads 中是**可选但推荐**的,用于:
- AI 智能体的相似期检测
- 语义搜索超越全文匹配
- 自动依赖发现
- 智能补全和建议

### 3.2 向量化策略

**嵌入的文本内容**:
- 期标题 (100 字符)
- 期描述 (1KB 内容)
- 标签 (50 字符聚合)
- 评论摘要 (通过压缩生成)

**向量生成**:

```python
# 伪代码: 向量化流程
def embed_issue(issue):
    text = f"{issue.title}\n{issue.description}"

    # 使用 OpenAI Embeddings
    embedding = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )

    # 存储向量和元数据
    vector_store.upsert(
        id=issue.id,
        vector=embedding,
        metadata={
            'status': issue.status,
            'assignee': issue.assignee,
            'labels': issue.labels,
            'created_at': issue.created_at
        }
    )
```

**向量维度**: 1536 (text-embedding-3-small) 或 3072 (text-embedding-3-large)

### 3.3 向量数据库选项

| 服务 | 部署 | 成本 | 向量数 | 延迟 | 推荐 |
|-----|------|------|--------|------|------|
| Pinecone | 云托管 | $70-280/月 | 1M+ | <100ms | ⭐⭐⭐ |
| Weaviate | 自托管 | $100+/月 (基础设施) | 1M+ | <100ms | ⭐⭐ |
| Qdrant | 自托管 | $50+/月 (基础设施) | 1M+ | <100ms | ⭐⭐⭐ |
| Milvus | 自托管 | 免费+基础设施 | 1B+ | <100ms | ⭐ |
| 本地嵌入 | 本地 | $0 | 100K | <50ms | ⭐ |

### 3.4 集成架构

```plaintext
┌─────────────────┐
│  Beads CLI      │
└────────┬────────┘
         │ 创建/更新期
         ▼
┌─────────────────┐
│  Dolt Database  │
└────────┬────────┘
         │ FlushManager
         ▼
┌─────────────────────────────────┐
│  向量化服务 (可选)               │
│  • OpenAI Embeddings API         │
│  • 或本地 embedding 模型         │
└────────┬────────────────────────┘
         │ 批处理 (1K issues/批)
         ▼
┌──────────────────────────────────┐
│  向量数据库                       │
│  • Pinecone (推荐)                │
│  • Weaviate 或 Qdrant (自托管)   │
└──────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  AI 智能体                        │
│  • 相似期推荐                      │
│  • 自动依赖发现                    │
│  • 语义补全                        │
└──────────────────────────────────┘
```

### 3.5 成本优化

**小规模** (< 10K issues):
- 使用本地嵌入或免费 Hugging Face API
- 成本: $0-10/月

**中等规模** (10K-100K issues):
- Pinecone Starter ($70/月) 或自托管 Qdrant
- OpenAI Embeddings ($0.02/1M tokens ≈ $2-5/月)
- 总计: $72-105/月

**大规模** (> 100K issues):
- Pinecone Standard ($200/月) 或多区域 Weaviate
- OpenAI Embeddings ($10-30/月)
- 总计: $210-300/月

---

## 4. 存储解决方案

### 4.1 存储类型和用途

#### **本地文件系统存储**
- **位置**: `.beads/` 目录
- **包含**: Dolt 数据库文件、JSONL 导出、配置
- **容量**: 50MB-5GB (取决于期数)
- **成本**: $0 (本地磁盘)

#### **Git 托管存储** (必需)
- **用于**: JSONL 文件版本控制、分布式同步
- **文件大小**: 1KB-500MB (按期数)
- **更新频率**: 每 5 秒 (防抖防刷新)
- **推荐提供商**:
  - GitHub (Free/Pro/Enterprise)
  - GitLab (Self-hosted/Cloud)
  - Gitea (Self-hosted)

#### **对象存储** (可选)
- **用于**: 大规模期的增量备份、归档
- **提供商**:
  - AWS S3 ($0.023/GB/月)
  - Google Cloud Storage ($0.020/GB/月)
  - Azure Blob Storage ($0.018/GB/月)
- **适用场景**: > 100K 期且需要地理冗余

### 4.2 JSONL 文件格式

**文件结构**:
```jsonl
{"id":"bd-a1b2","title":"Implement feature X","status":"open","priority":1}
{"id":"bd-c3d4","title":"Fix bug Y","status":"closed","priority":2}
{"id":"bd-e5f6","title":"Refactor module Z","status":"in_progress","priority":0}
```

**文件大小估计**:
- 每条期: 200-500 字节 (取决于描述长度)
- 1,000 期: 200KB-500KB
- 10,000 期: 2-5MB
- 100,000 期: 20-50MB
- 1,000,000 期: 200-500MB

**同步频率**:
- **防抖间隔**: 5 秒 (默认)
- **QPS**: 平均 < 10 操作/秒
- **峰值**: ~ 100 操作/秒 (批处理导入)

### 4.3 分布式存储架构

```plaintext
┌────────────────────────────────────────┐
│         多个开发者/AI 智能体            │
│  (不同机器,不同地理位置)               │
└────────┬───────────────────────┬────────┘
         │ git push              │ git pull
         ▼                        ▼
┌──────────────────────────────────────────┐
│      Git 托管 (GitHub/GitLab/Gitea)     │
│      ├─ issues.jsonl (主要数据)         │
│      ├─ dependencies.jsonl (关系)       │
│      ├─ .beads/dolt/ (版本历史)        │
│      └─ [Git 分支用于隔离工作]         │
└──────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│   可选: S3/GCS 备份 (月度)              │
│   └─ 完整数据库快照                     │
└──────────────────────────────────────────┘
```

### 4.4 存储成本计算

| 规模 | Git 存储 | S3 备份 (可选) | 月度总成本 |
|-----|---------|----------------|----------|
| 10K issues | GitHub Free | - | $0 |
| 100K issues | GitHub Pro $4/月 | S3 $1 | $5 |
| 1M issues | GitHub Team $21/月 | S3 $10 | $31 |
| 10M issues | GitHub Enterprise | S3 $100 | $200+ |

---

## 5. AI/ML 服务集成

### 5.1 AI 服务需求分析

Beads 的 AI 集成主要用于两个方面:

#### **内存压缩** (紧密集成)
- 使用 LLM 为关闭的旧期生成摘要
- 保留重要上下文同时减少存储
- 频率: 按需或定期 (周/月)

#### **智能代理协作** (可选集成)
- 自动依赖发现
- 期相似度计算
- 任务分解建议
- 风险检测

### 5.2 嵌入服务

**文本嵌入模型选项**:

| 模型 | 维度 | 成本 | 延迟 | 用途 |
|-----|------|------|------|------|
| OpenAI text-embedding-3-small | 1536 | $0.02/1M | <100ms | ⭐⭐⭐ 推荐 |
| OpenAI text-embedding-3-large | 3072 | $0.15/1M | 100-200ms | 高精度 |
| Hugging Face BGE-small | 384 | 免费 | 500ms+ | 预算型 |
| Cohere Embed | 4096 | $0.10/1K | <100ms | 多语言 |
| 本地 MiniLM | 384 | $0 | <50ms | 离线 |

**推荐配置**:
- **开发/测试**: 本地 MiniLM (免费,离线)
- **生产(中等)**: OpenAI text-embedding-3-small ($2-5/月)
- **生产(大规模)**: Cohere Embed 或本地部署

### 5.3 LLM 服务 - 内存压缩

**压缩管道**:

```python
# 伪代码: 内存压缩流程
def compress_old_issues(issues: List[Issue], days_threshold: int = 30):
    """
    使用 LLM 将旧关闭的期压缩为摘要
    """
    old_issues = [i for i in issues
                  if (now - i.closed_at).days > days_threshold
                  and i.status == 'closed']

    for issue in old_issues:
        # 生成压缩摘要
        summary = llm.generate(
            prompt=f"""
            将这个已关闭的工作项压缩为 2-3 句摘要,保留关键决策和结果:

            标题: {issue.title}
            描述: {issue.description}
            评论摘要: {summarize_comments(issue.comments)}
            """,
            max_tokens=100,
            model="claude-haiku"  # 推荐: Haiku 快速、廉价
        )

        # 保存压缩数据
        issue.compaction_level += 1
        issue.compressed_summary = summary
        issue.original_size = len(issue.description)
        save_issue(issue)
```

**成本估算**:
- Haiku 3.5: $0.80/1M 输入 token
- 平均期: 500 token → $0.0004/期
- 1,000 期压缩: ~ $0.40/月
- 10,000 期压缩: ~ $4/月

### 5.4 LLM 服务 - AI 智能体集成

**可选功能**:
1. **自动依赖发现**: 分析期描述,建议可能的依赖
2. **相似期检测**: 识别重复或相关期
3. **任务分解**: 将大期拆分为子期
4. **风险分析**: 检测被阻止的高优先级期

**LLM 选项对比**:

| 服务 | 推荐模型 | 成本 (per 1M tokens) | 速度 | 推荐用途 |
|-----|---------|-------------------|------|--------|
| Anthropic | Claude 3.5 Haiku | $0.80 输入 | 快 | ⭐⭐⭐ 压缩 |
| Anthropic | Claude 3.5 Sonnet | $3.00 输入 | 中 | ⭐⭐ 智能体任务 |
| OpenAI | GPT-4 mini | $0.15 输入 | 快 | ⭐ 高精度 |
| OpenAI | GPT-4 Turbo | $10.00 输入 | 慢 | 复杂推理 |
| Google | Gemini 1.5 Flash | $0.075 输入 | 快 | 成本优化 |

**推荐配置**:
- **压缩**: Claude Haiku ($0.80/1M tokens)
- **AI 智能体功能**: Claude Sonnet 或 GPT-4 mini
- **批处理频率**: 每周或按需

### 5.5 AI 服务集成成本

| 规模 | 压缩 | 嵌入 | 智能体 | 月度总成本 |
|-----|------|------|--------|----------|
| 小 (< 1K issues) | $1 | $2 | $0 | $3 |
| 中 (1K-10K) | $5 | $5 | $10 | $20 |
| 大 (10K-100K) | $50 | $30 | $50 | $130 |
| 超大 (> 100K) | $500 | $100 | $200 | $800 |

---

## 6. 网络与连接

### 6.1 网络拓扑

**分布式协作模式**:

```plaintext
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  开发者A         │     │  开发者B         │     │  AI 智能体       │
│  (macOS)         │     │  (Linux)         │     │  (云环境)       │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  SSH/HTTPS            │  SSH/HTTPS            │  HTTPS
         │  (git push/pull)       │  (git push/pull)      │  (git push/pull)
         ▼                       ▼                       ▼
┌──────────────────────────────────────────────────────────────┐
│  Git 托管 (GitHub/GitLab/Gitea)                             │
│  └─ 自动冲突解决 (JSONL 行级合并)                            │
└──────────────────────────────────────────────────────────────┘
         │
         │  (可选) Dolt 服务器模式
         │
         ▼
┌──────────────────────────────────┐
│  Dolt 服务器 (中央数据库)        │
│  ├─ Unix Domain Socket (本地)    │
│  ├─ TCP/TLS (团队)               │
│  └─ 只读副本 (分析)              │
└──────────────────────────────────┘
```

### 6.2 Git 连接配置

**SSH 认证** (推荐):
```bash
# 生成密钥对
ssh-keygen -t ed25519 -f ~/.ssh/beads_key

# 配置 Git
git config core.sshCommand "ssh -i ~/.ssh/beads_key"
git remote add origin git@github.com:user/beads-data.git
```

**HTTPS + PAT** (替代方案):
```bash
git config credential.helper store
git remote add origin https://github.com/user/beads-data.git
# 使用 Personal Access Token 作为密码
```

**Dolt 服务器连接**:
```bash
# TCP 连接 (生产)
dolt config --global user.name "team"
dolt config --global user.email "team@example.com"

# 连接到远程 Dolt 服务器
dolt remote add origin server://dolt-server.example.com:3306/beads_data
dolt push
```

### 6.3 网络需求

**带宽需求**:
- **本地使用**: 0 Mbps (完全离线工作)
- **团队协作**: 1-10 Mbps (Git 同步 5秒间隔)
  - 平均同步: 50KB-500KB per push
  - 峰值: 可达 5-10 MB (大批导入)
- **AI 智能体**: 10-100 Mbps (并发操作)

**网络延迟容限**:
- Git push/pull: < 5 秒 (用户可接受)
- Dolt 服务器查询: < 100ms (95th percentile)
- AI 服务调用: < 1 秒 (异步,可接受延迟)

### 6.4 CDN 和边缘网络

**CDN 不需要** - Beads 不托管静态内容或 Web UI

**可选: 地理分布式 Dolt 副本**
```plaintext
┌─────────────────────────────────────┐
│  主 Dolt 服务器 (AWS us-east-1)    │
└─────────────────┬───────────────────┘
                  │ 复制
          ┌───────┴──────────┐
          ▼                  ▼
┌───────────────────┐  ┌───────────────────┐
│ 副本 (eu-west-1) │  │ 副本 (ap-south-1) │
│ 只读 + 缓存       │  │ 只读 + 缓存       │
└───────────────────┘  └───────────────────┘
```

### 6.5 安全和 VPN

**端到端加密**:
- Git 仓库: SSH 密钥或 HTTPS
- Dolt 服务器: TLS 1.3
- API 调用: HTTPS

**VPN (可选)**:
```yaml
# 适用场景: 企业私有网络
use_vpn: true
vpn_provider: "WireGuard / Tailscale"
estimated_cost: "$10-20/月 (Tailscale)"
benefits:
  - 私有网络隔离
  - 自动 mTLS
  - 地理约束
```

---

## 7. 监控、日志与可观测性

### 7.1 监控指标

**核心性能指标** (KPIs):

| 指标 | 目标 | 告警阈值 | 工具 |
|-----|------|--------|------|
| 期创建延迟 | < 100ms | > 500ms | Prometheus |
| 依赖查询延迟 | < 50ms | > 200ms | Prometheus |
| Git 同步时间 | < 5s | > 10s | CloudWatch |
| Dolt 存储大小 | 监控增长 | > 80% 磁盘 | 自定义脚本 |
| 向量嵌入耗时 | < 100ms | > 500ms | 应用日志 |
| API 错误率 | < 0.1% | > 1% | Datadog |

**数据库健康指标**:

```sql
-- 监控查询
SELECT
    COUNT(*) as total_issues,
    COUNT(CASE WHEN status = 'open' THEN 1 END) as open_count,
    COUNT(CASE WHEN compaction_level > 0 THEN 1 END) as compressed_count,
    AVG(compaction_level) as avg_compression,
    MAX(updated_at) as last_update
FROM issues;

-- 依赖图复杂度
SELECT
    COUNT(DISTINCT from_id) as nodes,
    COUNT(*) as edges,
    MAX(depth) as max_depth
FROM dependencies;
```

### 7.2 日志策略

**日志级别**:
```yaml
development:
  level: DEBUG
  format: text
  output: stdout

production:
  level: INFO
  format: json
  output:
    - file:///var/log/beads/app.log
    - cloud://cloudwatch/beads-logs
    - cloud://datadog/beads-logs
  retention: 30 days
  rotation: daily
```

**关键日志事件**:
- 期创建/更新/删除
- 依赖变更
- Git 同步成功/失败
- Dolt 事务成功/失败
- AI 服务调用 (耗时, token 使用)
- 错误和异常堆栈跟踪

**日志聚合工具**:

| 工具 | 成本 | 容量 | 推荐 |
|-----|------|------|------|
| CloudWatch | $0.50/GB 摄入 | 无限 | AWS 用户 ⭐⭐⭐ |
| Datadog | $15-150/月 | 15-30GB/月 | 综合监控 ⭐⭐⭐ |
| Grafana Loki | 自托管 + $50-150 | 按存储 | 成本优化 ⭐⭐ |
| ELK Stack | 自托管 + $200+ | 按 ES 容量 | 完全控制 |
| Splunk | $600+/月 | 按索引量 | 企业级 |

### 7.3 告警和通知

**告警规则示例** (Prometheus/AlertManager):

```yaml
groups:
  - name: beads_alerts
    interval: 30s
    rules:
      # 期创建延迟告警
      - alert: IssueCreationLatencyHigh
        expr: histogram_quantile(0.95, create_issue_duration_ms) > 500
        for: 5m
        annotations:
          summary: "期创建延迟过高"

      # Dolt 同步失败
      - alert: DoltSyncFailure
        expr: increase(dolt_sync_errors_total[5m]) > 5
        annotations:
          summary: "Dolt 同步失败率高"

      # 磁盘空间告警
      - alert: DiskSpaceWarning
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes) < 0.2
        annotations:
          summary: "磁盘空间剩余不足 20%"

      # AI API 错误率告警
      - alert: AIServiceErrorRate
        expr: (rate(ai_api_errors_total[5m]) / rate(ai_api_requests_total[5m])) > 0.05
        annotations:
          summary: "AI 服务错误率超过 5%"
```

**通知渠道**:
- Slack: 实时告警通知
- Email: 高优先级问题
- PagerDuty: 关键服务中断
- Webhook: 自定义集成

### 7.4 追踪和调试

**分布式追踪** (可选):

```yaml
# Jaeger 或 Datadog APM 集成
tracing:
  enabled: true
  sampler:
    type: probabilistic
    param: 0.1  # 采样 10% 请求
  exporters:
    - jaeger_agent://localhost:6831
    - datadog://agent:8126

spans:
  - create_issue (数据库写入)
  - git_sync (Git 操作)
  - embedding (向量化)
  - dolt_query (数据库查询)
```

### 7.5 可观测性成本估算

| 规模 | CloudWatch | Datadog | Grafana | 总计 |
|-----|----------|---------|---------|------|
| 小 | $2-5 | $15 | $0 | $15-20 |
| 中 | $10-20 | $50 | $50 | $60-120 |
| 大 | $50-100 | $150 | $150 | $300-400 |

---

## 8. 成本汇总与优化

### 8.1 分层成本模型

#### **小规模部署 (≤10K issues, 1-5 用户)**

```yaml
compute: $20-30/月        # DigitalOcean/AWS t3.medium
database: $0/月            # Dolt 嵌入式
storage: $0/月             # 本地 + GitHub Free
ai_services: $0-10/月      # 可选压缩
monitoring: $0/月          # 免费工具
cdn: $0/月                 # 不需要
network: $0/月             # SSH/HTTPS 免费

总计: $20-40/月
```

#### **中等规模部署 (10K-100K issues, 5-50 用户)**

```yaml
compute: $100-200/月       # AWS t3.large/m5.large
database: $50-100/月       # RDS PostgreSQL (可选)
storage: $5-20/月          # GitHub Pro/GitLab + S3
ai_services: $50-150/月    # 压缩 + 向量嵌入
vector_db: $0-70/月        # 可选 Pinecone
monitoring: $50-100/月     # CloudWatch/Datadog
network: $20/月            # VPN (可选)

总计: $275-640/月
```

#### **大规模部署 (100K-1M issues, 50-500 用户)**

```yaml
compute: $300-500/月       # AWS m5.2xlarge + 负载均衡
database: $200-300/月      # RDS Multi-AZ PostgreSQL
storage: $50-100/月        # GitHub Enterprise + S3 备份
ai_services: $300-500/月   # 频繁压缩 + 智能体功能
vector_db: $200-300/月     # Pinecone Standard
monitoring: $200-300/月    # Datadog Enterprise
network: $100-150/月       # CDN (可选) + VPN
backup: $50-100/月         # 地理冗余备份

总计: $1,400-2,450/月
```

### 8.2 成本优化策略

**1. 计算优化**:
- 使用 spot/preemptible 实例 (节省 60-70%)
- 自动扩展 (按需增减资源)
- 容器化 (Kubernetes 与 bin packing)
- 推荐: DigitalOcean 或 Linode (比 AWS 便宜 40%)

**2. 存储优化**:
- 定期清理已压缩期 (删除原始描述)
- JSONL 压缩 (gzip 减少 70%)
- 增量备份 (仅备份变化)
- 分层存储 (热/冷数据分离)

**3. 向量数据库优化**:
- 批处理嵌入 (减少 API 调用)
- 缓存热向量 (内存)
- 重用嵌入 (相同内容)
- 自托管 Qdrant (节省 30-50% vs Pinecone)

**4. AI 服务优化**:
- 使用便宜模型 (Haiku vs Sonnet)
- 批处理和缓存响应
- 仅在需要时调用 (而非每次操作)
- 自托管开源 LLM (Llama 2) 用于成熟功能

**5. 监控优化**:
- 只监控关键指标
- 降低日志采样率
- 使用开源工具 (Prometheus + Grafana)
- 本地日志保留 (仅云端保留关键日志)

### 8.3 成本对标

| 服务 | Beads | GitHub Issues | Linear | Jira | Notion |
|-----|-------|---------------|--------|------|--------|
| 小规模 (< 1K issues) | $20-40 | $0 (Free) | $0-10 | $0 (Cloud Free) | $0-10 |
| 中等规模 | $275-640 | $21 (Team) | $100/月 | $10/用户 | $100-200 |
| 大规模 | $1,400+ | $210 (Enterprise) | $500+/月 | $50+/用户 | $1,000+ |
| **核心优势** | **Git 原生** | 中央平台 | 现代 UX | 企业功能 | 知识库 |

---

## 9. 部署建议

### 9.1 快速开始 (开发环境)

**本地开发 (推荐)**:

```bash
# 1. 克隆和构建
git clone https://github.com/steveyegge/beads.git
cd beads
go build -o bd ./cmd/bd

# 2. 初始化项目
cd your-project
../beads init --prefix myapp

# 3. 创建期
../beads create "First task" -p 0
../beads list

# 4. Git 同步
git add .beads/issues.jsonl
git commit -m "Initial issues"
git push
```

**成本**: $0/月 (本地开发)

### 9.2 小团队部署 (≤ 5 人)

**推荐架构**:

```plaintext
┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│  开发者 1      │   │  开发者 2      │   │  开发者 3      │
│  (local Dolt)  │   │  (local Dolt)  │   │  (local Dolt)  │
└────────┬───────┘   └────────┬───────┘   └────────┬───────┘
         │ git push          │ git push          │ git push
         ▼────────────────────▼────────────────────▼
         │
         ▼
    ┌────────────────────┐
    │  GitHub (Free)     │
    │  issues.jsonl      │
    │  (Git 同步)        │
    └────────────────────┘

成本: $0/月
```

**部署步骤**:
1. 创建 GitHub 仓库 (public 或 private)
2. 各开发者克隆并初始化 `.beads/`
3. 配置 Git 自动同步 (git hooks)
4. 使用 `bd sync` 拉取同步

**可选**: 添加 AI 压缩功能
```bash
# 配置 Claude API
export ANTHROPIC_API_KEY=sk-...
bd config set ai_provider anthropic
bd config set ai_model claude-3-5-haiku-20241022

# 定期压缩旧期
bd compact --older-than 30 --model haiku
```

### 9.3 中等团队部署 (5-50 人)

**推荐架构**:

```plaintext
┌─────────────────────────────────────────────────────────┐
│  多个开发者 + CI/CD 系统                                │
└────────────────────┬────────────────────────────────────┘
                     │ git push/pull
                     ▼
            ┌────────────────────┐
            │  GitHub Pro/Teams  │
            │  issues.jsonl      │
            │  dolt remotes      │
            └─────────┬──────────┘
                      │
                ┌─────┴─────┐
                ▼           ▼
         ┌──────────┐  ┌──────────────┐
         │ Dolt 服务│  │ AI 服务       │
         │ 器集群   │  │ (可选)        │
         │ (EC2)   │  │ Claude API   │
         └──────────┘  └──────────────┘

成本: $275-640/月
```

**部署步骤**:
1. 启动 Dolt 服务器 (AWS t3.large)
2. 配置团队 Git 仓库 (GitHub Teams)
3. 配置 Dolt 远程仓库指向服务器
4. 启用自动同步和压缩 (cron 任务)
5. 添加监控和日志 (CloudWatch)

**关键配置**:
```bash
# Dolt 服务器启动
dolt sql-server --port 3306 --host 0.0.0.0

# 客户端连接
dolt remote add origin server://dolt-server.example.com:3306/beads_data
dolt push

# 自动压缩 (每周)
0 2 * * 0 bd compact --older-than 30 --batch-size 1000
```

### 9.4 大规模部署 (50-500+ 人)

**推荐架构**:

```plaintext
┌─────────────────────────────────────────────────────────────┐
│  跨地域开发者 + 多个智能体 + 企业系统                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
    ┌────────┐   ┌────────┐   ┌────────┐
    │ GitHub │   │Gitlab  │   │ Gitea  │
    │ (主)   │   │(镜像)  │   │(内网)  │
    └─────┬──┘   └──┬─────┘   └──┬─────┘
          │         │             │
          └─────────┼─────────────┘
                    ▼
        ┌──────────────────────────┐
        │ Dolt 主从集群 (3 个节点)│
        │ - Primary (写入)         │
        │ - Replica 1 (只读)       │
        │ - Replica 2 (只读)       │
        └──────────┬───────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
    ┌────────┐ ┌────────┐ ┌────────┐
    │Pinecone│ │Redis   │ │Datadog │
    │向量 DB │ │缓存层  │ │监控    │
    └────────┘ └────────┘ └────────┘

成本: $1,400-2,450+/月
```

**部署步骤**:
1. Kubernetes 集群 (EKS/GKE/AKS)
2. Dolt 有状态集 (StatefulSet)
3. 负载均衡器 (ALB/NLB)
4. 自动扩展和故障转移
5. 跨区域复制 (灾难恢复)
6. 完整监控和告警

**关键 Kubernetes YAML**:
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: dolt-server
spec:
  serviceName: dolt
  replicas: 3
  selector:
    matchLabels:
      app: dolt
  template:
    metadata:
      labels:
        app: dolt
    spec:
      containers:
      - name: dolt
        image: dolthub/dolt-sql-server:latest
        ports:
        - containerPort: 3306
        volumeMounts:
        - name: dolt-data
          mountPath: /var/lib/dolt
  volumeClaimTemplates:
  - metadata:
      name: dolt-data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 100Gi
```

### 9.5 部署检查清单

**上线前**:
- [ ] Dolt 数据库初始化和迁移
- [ ] Git 仓库配置和权限
- [ ] AI API 密钥配置
- [ ] 向量数据库连接测试
- [ ] 备份和恢复测试
- [ ] 网络和安全配置 (VPN/防火墙)
- [ ] 监控和告警规则
- [ ] 文档和用户培训

**上线后**:
- [ ] 周期性备份验证
- [ ] 性能基准测试
- [ ] 安全审计
- [ ] 用户反馈收集
- [ ] 持续优化和改进

---

## 10. 最佳实践

### 10.1 架构最佳实践

#### **1. 分布式优先设计**
```yaml
优先级: 1
原则: "始终支持离线工作和分布式合并"

实现:
  - 所有数据都在 Git 中版本化
  - 哈希基 ID 防止碰撞
  - JSONL 格式用于可读性和 Git 友好
  - Dolt 提供版本历史和分支
```

#### **2. 本地数据缓存**
```yaml
策略: "对热数据使用本地缓存,减少网络往返"

缓存层次:
  - L1: 内存 (当前会话期)
  - L2: Dolt 本地数据库 (完整历史)
  - L3: Git 仓库 (版本化存档)
  - L4: 远程存储 (S3 备份)
```

#### **3. 异步处理**
```yaml
模式: "使用队列和防抖减少阻塞操作"

示例:
  - FlushManager: 防抖 5秒 后批量写入
  - 向量嵌入: 批处理 1000 条期
  - 压缩任务: 使用 cron 后台执行
  - AI 调用: 异步队列处理
```

### 10.2 性能最佳实践

#### **查询优化**
```sql
-- 好的: 使用索引
SELECT * FROM issues WHERE status = 'open' AND assignee = 'alice';
-- 创建以下索引:
CREATE INDEX idx_issues_status_assignee ON issues(status, assignee);

-- 不好: 全表扫描
SELECT * FROM issues WHERE YEAR(created_at) = 2025;
```

#### **批处理操作**
```go
// 不好: 逐个创建期
for _, title := range titles {
    createIssue(title)  // N 次往返
}

// 好的: 批量创建
createIssuesBatch(titles, batchSize=1000)  // 1 次往返
```

#### **缓存热点数据**
```go
// 缓存已阻止期列表 (读多写少)
blockedIssues := cache.Get("blocked_issues")
if blockedIssues == nil {
    blockedIssues = db.Query("status = 'blocked'")
    cache.Set("blocked_issues", blockedIssues, ttl=5min)
}
```

### 10.3 安全最佳实践

#### **访问控制**
```yaml
文件级权限:
  .beads/dolt/: 0700 (所有者仅)
  .beads/issues.jsonl: 0644 (可读)

Git 访问:
  - SSH 密钥优于密码
  - 使用 deploy keys 用于 CI/CD
  - 启用分支保护

API 密钥:
  - 使用环境变量 (不要硬编码)
  - 定期轮换
  - 使用最小权限原则
```

#### **数据加密**
```bash
# 传输中: 使用 SSH/HTTPS
git remote set-url origin git@github.com:user/repo.git

# 静态: 使用 git-crypt (可选)
git-crypt init
echo ".beads/secrets/**" > .gitattributes
git-crypt add-gpg-user alice@example.com
```

#### **审计追踪**
```sql
-- 查询所有更改记录
SELECT * FROM events
WHERE issue_id = 'bd-1234'
ORDER BY created_at DESC;

-- 访问日志
SELECT actor, event_type, COUNT(*)
FROM events
WHERE created_at > NOW() - INTERVAL 1 DAY
GROUP BY actor, event_type;
```

### 10.4 运维最佳实践

#### **日志记录标准**

```go
// 结构化日志 (JSON)
log.WithFields(map[string]interface{}{
    "issue_id": issue.ID,
    "status": issue.Status,
    "duration_ms": duration,
    "user": username,
}).Info("Issue updated successfully")
```

#### **备份策略**
```bash
# 自动日备份到 S3
0 2 * * * pg_dump beads | gzip | aws s3 cp - s3://backup-bucket/daily-$(date +%Y%m%d).sql.gz

# 月度完整备份到异地
0 3 1 * * bd export --full > /tmp/beads-full-$(date +%Y%m%d).jsonl && aws s3 cp /tmp/beads-full-*.jsonl s3://backup-bucket/monthly/
```

#### **版本管理**
```bash
# 标记发布版本
git tag -a v1.0.0 -m "Stable release"
git push origin v1.0.0

# 使用语义化版本控制
# 主版本 (1.x.x): 破坏性变更
# 次版本 (x.1.x): 新功能
# 修订版 (x.x.1): bug 修复
```

### 10.5 成本控制最佳实践

#### **资源使用监控**
```yaml
每周检查:
  - 计算成本趋势 (AWS Cost Explorer)
  - 存储增长 (磁盘使用率)
  - API 使用量 (Claude, OpenAI token)
  - 带宽成本 (如适用)

每月检查:
  - 成本与预算对标
  - 资源优化机会
  - 竞争对手价格对比
  - 长期承诺折扣 (RI, Savings Plans)
```

#### **自动成本优化**
```yaml
策略:
  - Reserved Instances (提前 1 年购买, 节省 25-40%)
  - Spot Instances (临时工作负载, 节省 60-70%)
  - 按需付费 (固定工作负载, 简单)
  - 自动缩放 (根据 CPU 使用率)
  - 标签成本分配 (按团队/项目计费)
```

### 10.6 团队协作最佳实践

#### **工作流规范**
```yaml
1. 本地开发:
   - 创建功能分支: git checkout -b feature/new-task-type
   - 编辑期和依赖
   - 提交: git commit -m "feat: add new task type"

2. 同步:
   - 推送变更: git push origin feature/...
   - 拉取同步: git pull && bd sync
   - 解决冲突: 使用 Dolt 合并工具

3. 代码审查:
   - 创建 PR (GitHub/GitLab)
   - 审查期变更和依赖
   - 批准并合并

4. 部署:
   - 自动化 CI/CD 验证
   - 标签稳定版本
   - 生成发布说明
```

#### **沟通规范**
```yaml
期标题:
  格式: "[TYPE] Brief description"
  示例: "[FEATURE] Add priority levels to issues"

期描述:
  内容:
    - 背景和动机
    - 建议的实现
    - 相关期 ID
    - 测试计划

评论:
  - 使用 @mention 通知成员
  - 保持讨论技术和建设性
  - 保存决策和原因
```

### 10.7 可扩展性最佳实践

#### **水平扩展**
```yaml
阶段 1 (< 10K issues):
  - 单个 Dolt 实例
  - 本地/单个服务器
  - 成本: $20-40/月

阶段 2 (10K-100K issues):
  - Dolt 主从配置
  - 只读副本用于查询
  - Redis 缓存层
  - 成本: $300-600/月

阶段 3 (> 100K issues):
  - Dolt 集群 (sharding)
  - Kubernetes 编排
  - 多地域部署
  - 成本: $1,500+/月
```

#### **数据库优化**
```sql
-- 分区历史数据
CREATE TABLE issues_archive PARTITION OF issues
FOR VALUES FROM (MINVALUE) TO ('2024-01-01');

CREATE TABLE issues_current PARTITION OF issues
FOR VALUES FROM ('2024-01-01') TO (MAXVALUE);

-- 物化视图用于报告
CREATE MATERIALIZED VIEW open_issues_by_assignee AS
SELECT assignee, COUNT(*) as count, AVG(priority) as avg_priority
FROM issues
WHERE status != 'closed'
GROUP BY assignee;

REFRESH MATERIALIZED VIEW CONCURRENTLY open_issues_by_assignee;
```

---

## 附录: 参考资源

### 相关服务官方文档
- [Dolt 文档](https://www.dolthub.com/docs/)
- [GitHub API](https://docs.github.com/en/rest)
- [AWS 成本优化](https://aws.amazon.com/solutions/cost-optimization/)
- [Claude API 文档](https://docs.anthropic.com/)

### 推荐工具
- **监控**: Prometheus + Grafana
- **日志**: ELK Stack 或 Datadog
- **IC/CD**: GitHub Actions
- **IaC**: Terraform 或 CloudFormation

### 深阅读
- "Designing Data-Intensive Applications" - Martin Kleppmann
- "Release It!" - Michael Nygard (稳定性和可靠性)

---

**文档维护**: Beads 社区
**最后更新**: 2025-02-12
**版本**: 1.0
**许可**: CC-BY-4.0
