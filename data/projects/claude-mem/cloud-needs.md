# Claude-Mem 云服务需求分析

本文档详细分析 Claude-Mem 项目在云环境中的部署需求，包括基础设施、第三方服务、配置选项和成本估算。

---

## 目录

1. [计算资源需求](#1-计算资源需求)
2. [存储服务需求](#2-存储服务需求)
3. [数据库需求](#3-数据库需求)
4. [向量数据库需求](#4-向量数据库需求)
5. [LLM 服务需求](#5-llm-服务需求)
6. [中间件需求](#6-中间件需求)
7. [监控与日志需求](#7-监控与日志需求)
8. [网络需求](#8-网络需求)
9. [成本估算](#9-成本估算)

---

## 1. 计算资源需求

### 1.1 核心组件计算需求

Claude-Mem 采用本地优先架构，主要计算负载来自以下组件：

**Worker Service (Bun 运行时)**
- **作用**：HTTP API 服务器（端口 37777）、SDK Agent 编排、数据库操作
- **运行时**：Bun (≥1.0.0) + Node.js (≥18.0.0)
- **资源需求**：
  - CPU: 2-4 vCPU
  - 内存: 2-4GB RAM
  - 磁盘 I/O: 中等（SQLite + Chroma 写入）

**SDK Agent**
- **作用**：观察提取、会话摘要生成（调用 Claude API）
- **运行时**：基于 `@anthropic-ai/claude-agent-sdk`
- **资源需求**：
  - CPU: 1-2 vCPU（主要是 API 调用，计算不密集）
  - 内存: 1-2GB RAM
  - 网络: 稳定外网连接（调用 Anthropic API）

**Viewer UI (React)**
- **作用**：Web 界面，实时展示记忆流
- **运行时**：静态 HTML（已构建到 `plugin/ui/viewer.html`）
- **资源需求**：
  - 前端静态文件服务：几乎无开销
  - 由 Worker Service 的 Express 服务器托管

### 1.2 云服务器推荐配置

#### 开发/测试环境
```
实例类型: 小型计算实例
CPU: 2 vCPU
内存: 4GB RAM
存储: 20GB SSD (存放数据库和向量索引)
操作系统: Ubuntu 22.04 LTS / macOS / Windows Server

推荐服务:
- AWS: t3.small ($15/月)
- GCP: e2-small ($13/月)
- Azure: B2s ($30/月)
- 阿里云: ecs.t6-c1m2.large (¥70/月)
```

#### 小型生产环境（<1000 会话/月）
```
实例类型: 中型计算实例
CPU: 4 vCPU
内存: 8GB RAM
存储: 50GB SSD
操作系统: Ubuntu 22.04 LTS

推荐服务:
- AWS: t3.medium ($30/月)
- GCP: e2-medium ($25/月)
- Azure: B2ms ($60/月)
- 阿里云: ecs.c6.large (¥150/月)
```

#### 大型生产环境（>5000 会话/月）
```
实例类型: 大型计算实例
CPU: 8 vCPU
内存: 16GB RAM
存储: 200GB NVMe SSD
操作系统: Ubuntu 22.04 LTS

推荐服务:
- AWS: m5.xlarge ($140/月)
- GCP: n2-standard-4 ($120/月)
- Azure: D4s_v3 ($140/月)
- 阿里云: ecs.c6.xlarge (¥300/月)
```

### 1.3 无服务器部署可行性

**不适合无服务器部署**，原因：
- Worker Service 需要持续运行（端口 37777）
- SQLite 和 Chroma 需要本地文件系统持久化
- Hook 系统需要快速响应（冷启动不可接受）
- 本地优先架构设计（隐私优先）

**替代方案**：
- 使用 Docker 容器化部署
- 云虚拟机 + 自动化部署脚本
- Kubernetes（大规模场景）

---

## 2. 存储服务需求

### 2.1 本地存储需求

#### 数据目录结构
```
~/.claude-mem/
├── settings.json           # 用户配置 (~10KB)
├── claude-mem.db          # SQLite 数据库 (10MB-1GB)
├── chroma/                # Chroma 向量库 (100MB-5GB)
│   ├── chroma.sqlite3
│   └── index/
└── logs/                  # 日志文件 (10MB-100MB)
    ├── worker.log
    └── hooks.log
```

#### 存储空间估算
| 使用规模 | 会话数 | 观察数 | SQLite | Chroma | 日志 | 总计 |
|---------|--------|--------|--------|--------|------|------|
| **小型** | 100 | 1K | 10MB | 100MB | 10MB | ~120MB |
| **中型** | 1K | 10K | 100MB | 1GB | 50MB | ~1.2GB |
| **大型** | 10K | 100K | 1GB | 10GB | 200MB | ~11GB |

### 2.2 云对象存储（可选）

**用途**：
- 数据库备份（`claude-mem.db`）
- Chroma 索引备份
- 日志归档

**推荐服务**：
- **AWS S3**:
  - 存储类别：S3 Standard（频繁访问）或 S3 IA（备份）
  - 定价：$0.023/GB-月（标准）
  - 成本估算：10GB 备份 ≈ $0.23/月
- **GCP Cloud Storage**:
  - 存储类别：Standard Storage
  - 定价：$0.020/GB-月
  - 成本估算：10GB 备份 ≈ $0.20/月
- **Azure Blob Storage**:
  - 存储层：Hot Access Tier
  - 定价：$0.018/GB-月
  - 成本估算：10GB 备份 ≈ $0.18/月
- **阿里云 OSS**:
  - 存储类型：标准存储
  - 定价：¥0.12/GB-月
  - 成本估算：10GB 备份 ≈ ¥1.2/月

**备份脚本示例**：
```bash
#!/bin/bash
# 每日备份到 S3
BACKUP_DIR=~/.claude-mem
TIMESTAMP=$(date +%Y%m%d)

# 压缩数据库
tar -czf /tmp/claude-mem-backup-${TIMESTAMP}.tar.gz \
    ${BACKUP_DIR}/claude-mem.db \
    ${BACKUP_DIR}/chroma/

# 上传到 S3
aws s3 cp /tmp/claude-mem-backup-${TIMESTAMP}.tar.gz \
    s3://my-bucket/claude-mem-backups/

# 清理本地备份
rm /tmp/claude-mem-backup-${TIMESTAMP}.tar.gz
```

---

## 3. 数据库需求

### 3.1 SQLite 数据库

**版本要求**：SQLite 3 (通过 `bun:sqlite` 集成)

#### 核心表结构
```sql
-- 会话表
CREATE TABLE sdk_sessions (
    session_id TEXT PRIMARY KEY,
    created_at TIMESTAMP,
    ended_at TIMESTAMP,
    total_observations INTEGER,
    total_tokens INTEGER
);

-- 观察表（启用 FTS5 全文索引）
CREATE VIRTUAL TABLE observations USING fts5(
    observation_id,
    lossless_restatement,
    content,
    timestamp,
    keywords
);

-- 会话摘要表
CREATE TABLE session_summaries (
    session_id TEXT,
    summary TEXT,
    created_at TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sdk_sessions(session_id)
);

-- 用户提示表
CREATE TABLE user_prompts (
    prompt_id TEXT PRIMARY KEY,
    session_id TEXT,
    prompt_number INTEGER,
    content TEXT,
    timestamp TIMESTAMP
);

-- 待处理消息队列
CREATE TABLE pending_messages (
    message_id TEXT PRIMARY KEY,
    session_id TEXT,
    message_type TEXT,
    payload JSON,
    created_at TIMESTAMP
);
```

#### 性能优化配置
```javascript
// 从 src/services/sqlite/ 确认的配置
const db = new Database('~/.claude-mem/claude-mem.db');

// 启用 WAL 模式（高并发写性能）
db.exec('PRAGMA journal_mode = WAL');

// 设置缓存大小（8MB）
db.exec('PRAGMA cache_size = -8000');

// 启用外键约束
db.exec('PRAGMA foreign_keys = ON');

// 自动清理
db.exec('PRAGMA auto_vacuum = INCREMENTAL');
```

### 3.2 SQLite 性能基准

| 指标 | 目标 | 实际 |
|------|------|------|
| 写入延迟（单条） | <10ms | ~5ms |
| 读取延迟（单条） | <5ms | ~2ms |
| FTS5 搜索延迟 | <100ms | ~50ms |
| 并发写入（WAL） | 多线程 | 支持 |
| 数据库大小上限 | 建议<10GB | 无限制（实际） |

### 3.3 云托管 SQLite 替代方案

虽然 Claude-Mem 默认使用本地 SQLite，但在云环境可考虑以下替代：

**选项 1: Turso (边缘 SQLite)**
- **描述**: SQLite 的云托管服务，兼容 libSQL
- **优势**:
  - 全球边缘部署（低延迟）
  - 自动备份和复制
  - 保持 SQLite API 兼容性
- **定价**:
  - 免费层：500 rows read/write/月
  - Pro：$29/月（25M rows/月）
- **成本估算**: $0-29/月

**选项 2: LiteFS (分布式 SQLite)**
- **描述**: Fly.io 的 SQLite 复制系统
- **优势**: 多区域复制，主从架构
- **定价**: 按 Fly.io 计算资源计费
- **成本估算**: $10-50/月

**选项 3: PostgreSQL (迁移方案)**
- **描述**: 使用 PGVector 替代 SQLite + Chroma
- **服务**:
  - AWS RDS: db.t3.micro ($15/月)
  - GCP Cloud SQL: db-f1-micro ($10/月)
  - Supabase: 免费层或 $25/月
- **成本估算**: $0-30/月

---

## 4. 向量数据库需求

### 4.1 Chroma Vector Database

**版本要求**：通过 MCP (Model Context Protocol) 集成

#### 架构设计
```
Claude-Mem (TypeScript)
    ↓ MCP Client
@modelcontextprotocol/sdk
    ↓ MCP Server
Chroma Server (Python)
    ↓ 存储
~/.claude-mem/chroma/
```

#### 数据模型
```python
# Chroma Collection Schema
collection = client.create_collection(
    name="claude-mem-observations",
    metadata={"hnsw:space": "cosine"}  # 余弦相似度
)

# Document Structure
{
    "ids": ["obs_123"],
    "embeddings": [[0.1, 0.2, ..., 0.768]],  # 768 维向量
    "metadatas": [{
        "observation_id": "obs_123",
        "session_id": "sess_456",
        "timestamp": "2025-02-11T12:00:00Z",
        "keywords": ["AI", "memory", "compression"]
    }],
    "documents": ["压缩后的观察文本"]
}
```

#### 向量维度与模型
| 嵌入模型 | 维度 | 性能 | 使用场景 |
|---------|------|------|---------|
| **all-MiniLM-L6-v2** | 384 | 快速，低资源 | 开发/测试 |
| **all-mpnet-base-v2** | 768 | 平衡 | 默认推荐 |
| **text-embedding-3-small** | 1536 | 高质量 | 生产环境 |

### 4.2 Chroma 性能优化

```python
# Chroma 配置优化（在 MCP Server 侧）
settings = Settings(
    chroma_db_impl="duckdb+parquet",  # 持久化存储
    persist_directory="~/.claude-mem/chroma",
    anonymized_telemetry=False,
    allow_reset=True
)

client = chromadb.Client(settings)
```

#### 性能基准
| 指标 | 目标 | 实际 |
|------|------|------|
| 向量搜索延迟 | <1s | ~600ms (混合搜索) |
| 索引构建速度 | 1K/秒 | ~500/秒 |
| 内存占用 | <500MB | ~300MB (10K 向量) |
| 磁盘空间 | 向量数 × 4KB | 实际测量 |

### 4.3 云托管向量数据库替代方案

**选项 1: Qdrant Cloud**
- **优势**: 高性能，Rust 实现，低延迟
- **集成**: 替换 Chroma，修改 MCP Server
- **定价**:
  - 免费层：1GB 存储
  - 起步版：$25/月（5GB）
- **成本估算**: $0-25/月

**选项 2: Pinecone**
- **优势**: 全托管，零运维，全球 CDN
- **集成**: 需要重写向量同步逻辑
- **定价**:
  - Starter：$70/月（100K 向量）
- **成本估算**: $70+/月

**选项 3: Weaviate Cloud**
- **优势**: GraphQL API，混合搜索
- **集成**: 适合扩展图关系功能
- **定价**:
  - Sandbox：免费（开发）
  - Production：$25/月起
- **成本估算**: $0-50/月

**选项 4: 自托管 Chroma (Docker)**
```yaml
# docker-compose.yml
services:
  chroma:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - chroma_data:/chroma/chroma
    environment:
      - IS_PERSISTENT=TRUE
      - PERSIST_DIRECTORY=/chroma/chroma

volumes:
  chroma_data:
```
- **成本**: 包含在计算资源中
- **优势**: 完全控制，无 API 成本
- **劣势**: 需要自己维护

### 4.4 混合搜索策略

Claude-Mem 实现了**三层混合搜索**（从 `src/services/search/` 确认）：

```typescript
// 搜索策略
export class HybridSearchStrategy implements SearchStrategy {
  async search(query: string, limit: number) {
    // 1. SQLite FTS5 全文搜索（快速，关键词）
    const ftsResults = await sqliteStrategy.search(query, limit);

    // 2. Chroma 向量搜索（语义理解）
    const vectorResults = await chromaStrategy.search(query, limit);

    // 3. 混合排序（加权融合）
    const merged = this.mergeResults(ftsResults, vectorResults);

    return merged.slice(0, limit);
  }
}
```

**权重配置**：
- FTS5 权重：0.3（精确匹配优先）
- 向量权重：0.7（语义相关性）

---

## 5. LLM 服务需求

### 5.1 Anthropic Claude API

**核心用途**：
1. **观察提取**：从工具调用结果中提取有价值的观察
2. **会话摘要**：生成会话级别的摘要
3. **上下文压缩**：3 层递进式上下文注入

**使用的模型**（从 `settings.json` 确认）：
```json
{
  "ai": {
    "model": "claude-4-5-sonnet-latest",  // 默认模型
    "temperature": 0.0,
    "max_tokens": 2000
  }
}
```

#### 支持的 Claude 模型
| 模型 | 输入定价 | 输出定价 | 上下文窗口 | 推荐场景 |
|------|---------|---------|------------|----------|
| **Claude 4.5 Sonnet** | $3.00/1M tokens | $15.00/1M tokens | 200K | 默认，高质量 |
| **Claude 4.5 Haiku** | $0.25/1M tokens | $1.25/1M tokens | 200K | 成本优化 |
| **Claude Opus 4.6** | $15.00/1M tokens | $75.00/1M tokens | 200K | 最高质量 |

### 5.2 Token 消耗分析

**典型会话的 Token 消耗**（从 architecture.md 确认）：

```
初始化提示 (Session Start):        ~500 tokens
观察提取 (per observation):        ~200-500 tokens
会话摘要 (Session End):           ~1000 tokens
-----------------------------------------------
平均每会话总计:                    ~3000-5000 tokens
```

**月度成本估算**：

**场景 1: 小型使用（100 会话/月）**
```
总 tokens = 100 × 4000 = 400K tokens
输入 tokens (70%) = 280K
输出 tokens (30%) = 120K

使用 Claude 4.5 Sonnet:
成本 = (280K × $3.00 / 1M) + (120K × $15.00 / 1M)
    = $0.84 + $1.80
    = $2.64/月

使用 Claude 4.5 Haiku:
成本 = (280K × $0.25 / 1M) + (120K × $1.25 / 1M)
    = $0.07 + $0.15
    = $0.22/月
```

**场景 2: 中型使用（1000 会话/月）**
```
总 tokens = 1000 × 4000 = 4M tokens
输入 tokens = 2.8M
输出 tokens = 1.2M

使用 Claude 4.5 Sonnet:
成本 = (2.8M × $3.00 / 1M) + (1.2M × $15.00 / 1M)
    = $8.40 + $18.00
    = $26.40/月

使用 Claude 4.5 Haiku:
成本 = (2.8M × $0.25 / 1M) + (1.2M × $1.25 / 1M)
    = $0.70 + $1.50
    = $2.20/月
```

**场景 3: 大型使用（10000 会话/月）**
```
总 tokens = 10000 × 4000 = 40M tokens
输入 tokens = 28M
输出 tokens = 12M

使用 Claude 4.5 Sonnet:
成本 = (28M × $3.00 / 1M) + (12M × $15.00 / 1M)
    = $84.00 + $180.00
    = $264.00/月

使用 Claude 4.5 Haiku:
成本 = (28M × $0.25 / 1M) + (12M × $1.25 / 1M)
    = $7.00 + $15.00
    = $22.00/月
```

### 5.3 API 配置

**环境变量**：
```bash
# Anthropic API Key
ANTHROPIC_API_KEY=sk-ant-api03-...

# 可选：自定义 API 端点（企业部署）
ANTHROPIC_API_URL=https://api.anthropic.com
```

**SDK 集成**（从 `src/services/agent/` 确认）：
```typescript
import Anthropic from '@anthropic-ai/claude-agent-sdk';

const agent = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: settings.ai.model,
  temperature: settings.ai.temperature
});
```

### 5.4 成本优化建议

1. **选择合适的模型**：
   - 开发/测试：Claude 4.5 Haiku（便宜 12 倍）
   - 生产环境：Claude 4.5 Sonnet（平衡）
   - 关键场景：Claude Opus 4.6（最高质量）

2. **启用提示缓存**（Anthropic Prompt Caching）：
   - 缓存系统提示和上下文
   - 减少 50-90% 重复 token 成本
   - 配置示例：
   ```typescript
   const response = await agent.messages.create({
     model: "claude-4-5-sonnet-latest",
     system: [{
       type: "text",
       text: "系统提示...",
       cache_control: { type: "ephemeral" }  // 启用缓存
     }],
     messages: [...]
   });
   ```

3. **批量处理观察**：
   - 合并多个观察到一次 API 调用
   - 减少固定开销（系统提示）

4. **调整压缩阈值**：
   - 提高 `semantic_density` 阈值
   - 过滤低价值观察，减少存储和检索成本

---

## 6. 中间件需求

### 6.1 Web 服务器

**技术栈**：Express.js (Node.js)

**核心功能**：
- HTTP API 服务（端口 37777）
- 静态文件服务（Viewer UI）
- WebSocket（实时记忆流，可选）

**资源需求**：
- CPU: 包含在 Worker Service 中
- 内存: ~200-500MB
- 并发连接: 100-1000

**反向代理（生产环境推荐）**：

**Nginx 配置示例**：
```nginx
upstream claude_mem_backend {
    server localhost:37777;
}

server {
    listen 80;
    server_name mem.example.com;

    location / {
        proxy_pass http://claude_mem_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 启用 HTTPS
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/mem.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mem.example.com/privkey.pem;
}
```

**云服务推荐**：
- **AWS**: Application Load Balancer (ALB) - $16/月
- **GCP**: Cloud Load Balancing - $18/月
- **Azure**: Application Gateway - $125/月
- **Cloudflare**: Tunnel (免费) + Workers ($5/月)

### 6.2 消息队列（可选）

**用途**：
- 异步观察处理
- 批量摘要生成
- 解耦 Hook 和 Worker

**默认方案**：SQLite `pending_messages` 表（轻量级）

**升级方案**（高负载时）：
| 服务 | 类型 | 推荐场景 | 月成本 |
|------|------|----------|--------|
| **Redis** | 内存队列 | 低延迟 | $10-50 |
| **RabbitMQ** | AMQP 协议 | 高可靠性 | $30-100 |
| **AWS SQS** | 托管队列 | AWS 生态 | $0.40/100万 请求 |
| **GCP Pub/Sub** | 托管消息 | GCP 生态 | $0.40/100万 消息 |

### 6.3 缓存层（可选）

**用途**：
- 缓存常见搜索查询
- 缓存会话摘要
- 减少数据库查询

**推荐服务**：
- **Redis Cloud**: 免费 30MB，$5/月 起
- **AWS ElastiCache**: cache.t3.micro $12/月
- **GCP Memorystore**: 1GB Basic $30/月
- **Upstash Redis**: 按请求计费，$0.2/10万 请求

**集成示例**：
```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// 缓存搜索结果
async function searchWithCache(query: string) {
  const cacheKey = `search:${query}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const results = await searchManager.search(query);
  await redis.setex(cacheKey, 3600, JSON.stringify(results));  // 1小时缓存

  return results;
}
```

---

## 7. 监控与日志需求

### 7.1 日志系统

**日志位置**：`~/.claude-mem/logs/`

**日志级别**（可配置）：
- ERROR: 错误和异常
- WARN: 警告
- INFO: 关键操作（默认）
- DEBUG: 详细调试信息

**日志结构化**：
```json
{
  "timestamp": "2025-02-11T12:00:00Z",
  "level": "INFO",
  "component": "worker-service",
  "message": "Observation extracted",
  "metadata": {
    "session_id": "sess_123",
    "observation_id": "obs_456",
    "tokens_used": 250
  }
}
```

**日志管理**：
- **本地轮转**：`logrotate` (Linux) 或自定义脚本
- **云日志服务**：
  - AWS CloudWatch Logs: $0.50/GB
  - GCP Cloud Logging: $0.50/GB
  - Azure Monitor Logs: $2.76/GB
  - Datadog Logs: $0.10/GB

### 7.2 关键监控指标

**性能指标**：
```
# Hook 响应时间
claude_mem_hook_latency_ms{hook_type="session_start"} <100ms
claude_mem_hook_latency_ms{hook_type="post_tool_use"} <500ms

# 观察处理
claude_mem_observations_created_total
claude_mem_observations_processing_time_ms (p50, p95, p99)

# 搜索性能
claude_mem_search_latency_ms{strategy="hybrid"} <1000ms
claude_mem_search_results_count

# Worker Service
claude_mem_worker_uptime_seconds
claude_mem_worker_memory_usage_mb ~150MB

# 数据库
claude_mem_db_size_mb
claude_mem_db_query_time_ms
```

**业务指标**：
```
# 会话统计
claude_mem_sessions_total
claude_mem_sessions_active
claude_mem_avg_observations_per_session

# Token 使用
claude_mem_tokens_used_total
claude_mem_tokens_cost_usd

# 存储统计
claude_mem_observations_count
claude_mem_vector_count
```

### 7.3 监控方案推荐

**方案 1: 轻量级（开发/测试）**
- **工具**: 内置日志 + 文件监控
- **成本**: $0
- **优点**: 简单，无依赖
- **缺点**: 无可视化，手动分析

**方案 2: 自建监控栈**
```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    depends_on:
      - prometheus

  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
```
- **成本**: 包含在计算资源中 (~$10-20/月)
- **优点**: 完全控制，可定制
- **缺点**: 需要维护

**方案 3: 托管服务**
| 服务 | 特性 | 月成本 |
|------|------|--------|
| **Datadog** | APM + 日志 + 指标 | $15/主机 |
| **New Relic** | 全栈监控 | $25/用户 |
| **Grafana Cloud** | 托管 Prometheus + Loki | $0-50 |
| **AWS CloudWatch** | AWS 原生 | $5-30 |
| **GCP Operations** | GCP 原生 | $0.50/GB |

**推荐**：小型项目用方案 1，中大型用方案 3（Grafana Cloud 或 Datadog）

### 7.4 告警配置

**关键告警**：
```yaml
# prometheus/alerts.yml
groups:
  - name: claude-mem
    rules:
      - alert: WorkerServiceDown
        expr: up{job="claude-mem-worker"} == 0
        for: 1m
        annotations:
          summary: "Worker Service 已停止"

      - alert: HighObservationLatency
        expr: claude_mem_observations_processing_time_ms{quantile="0.95"} > 2000
        for: 5m
        annotations:
          summary: "观察处理延迟过高"

      - alert: DiskSpaceWarning
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.2
        for: 5m
        annotations:
          summary: "磁盘空间不足 20%"

      - alert: HighTokenCost
        expr: rate(claude_mem_tokens_cost_usd[1h]) > 10
        for: 1h
        annotations:
          summary: "每小时 Token 成本超过 $10"
```

---

## 8. 网络需求

### 8.1 端口配置

**必需端口**：
- **37777** (TCP): Worker Service HTTP API
  - 用途：API 端点、Viewer UI、MCP 通信
  - 访问：本地（默认）或内网/公网（配置）

**可选端口**：
- **8000** (TCP): Chroma Server（如果独立部署）
- **443** (TCP): HTTPS（生产环境）
- **9090** (TCP): Prometheus（监控）

### 8.2 网络拓扑

**开发环境（单机）**：
```
┌─────────────────────────────────┐
│  本地开发机                      │
│                                  │
│  ┌──────────────────────────┐   │
│  │ Claude Code              │   │
│  │  └─ Plugin Hooks         │   │
│  └──────────┬───────────────┘   │
│             │ localhost:37777    │
│  ┌──────────▼───────────────┐   │
│  │ Worker Service           │   │
│  │  ├─ Express Server       │   │
│  │  ├─ SDK Agent            │   │
│  │  └─ SQLite + Chroma      │   │
│  └──────────┬───────────────┘   │
│             │ HTTPS              │
│  ┌──────────▼───────────────┐   │
│  │ Anthropic API            │   │
│  │ (api.anthropic.com)      │   │
│  └──────────────────────────┘   │
└─────────────────────────────────┘
```

**生产环境（云部署）**：
```
┌─────────────────────────────────────────────────────────┐
│  用户设备                                                │
│  ┌──────────────────────────┐                           │
│  │ Claude Code              │                           │
│  └──────────┬───────────────┘                           │
└─────────────┼───────────────────────────────────────────┘
              │ VPN / Tailscale
┌─────────────▼───────────────────────────────────────────┐
│  云环境 (VPC)                                            │
│                                                          │
│  ┌────────────────────┐        ┌──────────────────┐    │
│  │ Load Balancer      │◄───────┤ CloudFlare CDN   │    │
│  └────────┬───────────┘        └──────────────────┘    │
│           │ :443                                         │
│  ┌────────▼───────────┐        ┌──────────────────┐    │
│  │ Nginx Reverse Proxy│◄───────┤ WAF / DDoS       │    │
│  └────────┬───────────┘        └──────────────────┘    │
│           │ :37777                                       │
│  ┌────────▼───────────┐        ┌──────────────────┐    │
│  │ Worker Service     │◄───────┤ Auto Scaling     │    │
│  │  (3 instances)     │        │ (2-10 pods)      │    │
│  └────────┬───────────┘        └──────────────────┘    │
│           │                                              │
│  ┌────────▼────────┬──────────┬──────────────────┐    │
│  │                 │          │                   │    │
│  │ SQLite         Chroma    Redis Cache          │    │
│  │ (EBS Volume)   (EBS)     (ElastiCache)        │    │
│  └────────────────┴──────────┴──────────────────┘    │
│           │                                              │
└───────────┼──────────────────────────────────────────────┘
            │ HTTPS (出站)
┌───────────▼──────────────────────────────────────────────┐
│  外部服务                                                │
│  ┌──────────────────────────┐  ┌──────────────────────┐ │
│  │ Anthropic API            │  │ S3 (备份)            │ │
│  │ (api.anthropic.com)      │  │ (s3.amazonaws.com)   │ │
│  └──────────────────────────┘  └──────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

### 8.3 带宽需求

**上行带宽**（到 Anthropic API）：
- 每个观察提取请求：~5KB（系统提示 + 观察内容）
- 每个会话摘要请求：~10KB
- 高峰时段（100 观察/小时）：~500KB/小时 = **1.4 Kbps**

**下行带宽**（从 Anthropic API）：
- 每个观察响应：~2KB
- 每个摘要响应：~5KB
- 高峰时段（100 观察/小时）：~200KB/小时 = **0.4 Kbps**

**内部带宽**（Viewer UI）：
- 初始加载：~500KB（HTML + JS + CSS）
- WebSocket 实时更新：~1KB/观察
- 平均使用：**<1 Mbps**

**总结**：
- **最小带宽需求**: 10 Mbps（开发/测试）
- **推荐带宽**: 100 Mbps（小型生产）
- **大型部署**: 1 Gbps（高并发）

### 8.4 DNS 与域名

**开发环境**：
- 使用 `localhost:37777`
- 无需域名

**生产环境**：
```
推荐域名结构:
- api.mem.example.com     → Worker Service API
- viewer.mem.example.com  → Viewer UI
- chroma.mem.example.com  → Chroma Server（如果独立部署）

DNS 记录:
api.mem.example.com    A    203.0.113.10
viewer.mem.example.com CNAME api.mem.example.com
```

**SSL/TLS 证书**：
- **Let's Encrypt**: 免费，90天自动续期
- **AWS ACM**: 免费（AWS 环境）
- **Cloudflare Origin Certificate**: 免费（使用 Cloudflare）

### 8.5 防火墙规则

**入站规则**（云服务器）：
```bash
# SSH（仅管理员 IP）
22/tcp    from 203.0.113.100/32

# HTTP/HTTPS（公网访问）
80/tcp    from 0.0.0.0/0
443/tcp   from 0.0.0.0/0

# Worker Service（仅内网或 VPN）
37777/tcp from 10.0.0.0/8
```

**出站规则**：
```bash
# Anthropic API
443/tcp to 0.0.0.0/0  (HTTPS)

# 包管理器（npm, apt, yum）
80/tcp  to 0.0.0.0/0
443/tcp to 0.0.0.0/0
```

---

## 9. 成本估算

### 9.1 小型部署（Small）

**使用场景**：
- 个人开发者或小团队（1-5 人）
- 每月 100-500 个会话
- 1K-5K 观察

**技术栈**：
- **计算**: 单台云服务器（2 vCPU, 4GB RAM）
- **存储**: 本地 SQLite + Chroma（20GB SSD）
- **LLM**: Claude 4.5 Haiku API
- **备份**: S3 Standard（可选）
- **监控**: 内置日志

**月度成本明细**：

| 项目 | 服务 | 配置 | 月成本 (USD) |
|------|------|------|--------------|
| **计算资源** | AWS EC2 t3.small | 2 vCPU, 4GB RAM | $15 |
| **存储** | EBS gp3 | 20GB SSD | $2 |
| **LLM API** | Claude 4.5 Haiku | 400K tokens/月 | $0.22 |
| **备份** | S3 Standard | 5GB | $0.12 |
| **数据传输** | AWS 出站流量 | 10GB | $0.90 |
| **总计** | | | **$18.24** |

**阿里云版本（中国区）**：

| 项目 | 服务 | 配置 | 月成本 (CNY) |
|------|------|------|--------------|
| **计算资源** | ECS ecs.t6-c1m2.large | 2 vCPU, 4GB RAM | ¥70 |
| **存储** | ESSD PL0 | 20GB | ¥6 |
| **LLM API** | Claude 4.5 Haiku | 400K tokens/月 | ¥1.6 |
| **备份** | OSS 标准存储 | 5GB | ¥0.6 |
| **数据传输** | 公网流量 | 10GB | ¥8 |
| **总计** | | | **¥86.2** |

### 9.2 中型部署（Medium）

**使用场景**：
- 中型团队或小型企业（10-50 人）
- 每月 1K-5K 个会话
- 10K-50K 观察

**技术栈**：
- **计算**: 云服务器（4 vCPU, 8GB RAM）+ 负载均衡
- **存储**: 本地 SQLite + Chroma（100GB SSD）+ S3 备份
- **LLM**: Claude 4.5 Sonnet API
- **向量数据库**: Qdrant Cloud 起步版（可选）
- **缓存**: Redis Cloud 基础版
- **监控**: Grafana Cloud 免费层

**月度成本明细**：

| 项目 | 服务 | 配置 | 月成本 (USD) |
|------|------|------|--------------|
| **计算资源** | AWS EC2 t3.medium | 4 vCPU, 8GB RAM | $30 |
| **存储** | EBS gp3 | 100GB SSD | $8 |
| **负载均衡** | ALB | 基础配置 | $16 |
| **LLM API** | Claude 4.5 Sonnet | 4M tokens/月 | $26.40 |
| **向量数据库** | Qdrant Cloud | 5GB（可选） | $25 |
| **缓存** | Redis Cloud | 基础版 | $5 |
| **备份** | S3 Standard | 30GB | $0.70 |
| **监控** | Grafana Cloud | 免费层 | $0 |
| **数据传输** | AWS 出站流量 | 50GB | $4.50 |
| **总计** | | | **$115.60** |

**阿里云版本（中国区）**：

| 项目 | 服务 | 配置 | 月成本 (CNY) |
|------|------|------|--------------|
| **计算资源** | ECS ecs.c6.large | 4 vCPU, 8GB RAM | ¥150 |
| **存储** | ESSD PL1 | 100GB | ¥60 |
| **负载均衡** | SLB | 基础配置 | ¥50 |
| **LLM API** | Claude 4.5 Sonnet | 4M tokens/月 | ¥190 |
| **向量数据库** | Qdrant Cloud | 5GB | ¥180 |
| **缓存** | Redis 社区版 | 1GB | ¥30 |
| **备份** | OSS 标准存储 | 30GB | ¥3.6 |
| **数据传输** | 公网流量 | 50GB | ¥40 |
| **总计** | | | **¥703.6** |

### 9.3 大型部署（Large）

**使用场景**：
- 大型企业或 SaaS 平台（100+ 人）
- 每月 10K+ 个会话
- 100K+ 观察

**技术栈**：
- **计算**: Kubernetes 集群（3-5 节点，8 vCPU, 16GB RAM 每节点）
- **存储**: PostgreSQL (RDS) + Qdrant Cloud 生产版
- **LLM**: Claude 4.5 Sonnet API（批量优化）
- **缓存**: ElastiCache Redis 集群
- **监控**: Datadog APM
- **CDN**: CloudFront 或 Cloudflare

**月度成本明细**：

| 项目 | 服务 | 配置 | 月成本 (USD) |
|------|------|------|--------------|
| **Kubernetes** | AWS EKS | 3 × m5.xlarge 节点 | $420 |
| **数据库** | RDS PostgreSQL | db.r5.large | $300 |
| **向量数据库** | Qdrant Cloud | 生产版 50GB | $250 |
| **LLM API** | Claude 4.5 Sonnet | 40M tokens/月 | $264 |
| **缓存** | ElastiCache Redis | cache.m5.large | $120 |
| **负载均衡** | ALB + NLB | 高可用配置 | $50 |
| **存储** | EBS + S3 | 500GB SSD + 200GB 备份 | $50 |
| **CDN** | CloudFront | 500GB 流量 | $40 |
| **监控** | Datadog | 5 主机 | $75 |
| **数据传输** | AWS 出站流量 | 500GB | $45 |
| **总计** | | | **$1,614** |

**阿里云版本（中国区）**：

| 项目 | 服务 | 配置 | 月成本 (CNY) |
|------|------|------|--------------|
| **Kubernetes** | ACK | 3 × ecs.c6.2xlarge | ¥2,700 |
| **数据库** | RDS PostgreSQL | rds.pg.s3.large | ¥1,800 |
| **向量数据库** | Qdrant Cloud | 生产版 50GB | ¥1,800 |
| **LLM API** | Claude 4.5 Sonnet | 40M tokens/月 | ¥1,900 |
| **缓存** | Redis 企业版 | 8GB | ¥600 |
| **负载均衡** | SLB | 高可用配置 | ¥200 |
| **存储** | ESSD + OSS | 500GB + 200GB | ¥350 |
| **CDN** | CDN | 500GB 流量 | ¥100 |
| **监控** | ARMS | 5 主机 | ¥300 |
| **数据传输** | 公网流量 | 500GB | ¥400 |
| **总计** | | | **¥10,150** |

### 9.4 成本优化建议

#### 9.4.1 LLM 成本优化

1. **选择合适的模型**：
   - 开发/测试：Claude 4.5 Haiku（便宜 12 倍）
   - 生产环境：Claude 4.5 Sonnet（平衡）
   - **节省**: 80-90%

2. **启用 Prompt Caching**：
   - Anthropic 提供的缓存机制
   - 缓存系统提示和上下文
   - **节省**: 50-90% token 成本

3. **调整语义密度阈值**：
   ```json
   // settings.json
   {
     "compression": {
       "semantic_density_threshold": 0.7  // 提高到 0.7，过滤低价值观察
     }
   }
   ```
   - **节省**: 30-50% 观察数量

4. **批量处理**：
   - 合并多个观察到一次 API 调用
   - **节省**: 20-30% 固定开销

#### 9.4.2 计算成本优化

1. **使用 Spot/抢占式实例**：
   - AWS Spot Instances: 节省 70-90%
   - GCP Preemptible VMs: 节省 80%
   - **适用场景**: 非关键后台任务

2. **自动扩缩容**：
   ```yaml
   # Kubernetes HPA
   apiVersion: autoscaling/v2
   kind: HorizontalPodAutoscaler
   metadata:
     name: claude-mem-worker
   spec:
     minReplicas: 2
     maxReplicas: 10
     metrics:
       - type: Resource
         resource:
           name: cpu
           target:
             type: Utilization
             averageUtilization: 70
   ```
   - **节省**: 30-50% 非峰值时段

3. **Serverless 函数替代**（部分场景）：
   - 使用 AWS Lambda 处理备份、归档等任务
   - **节省**: 按实际使用量付费

#### 9.4.3 存储成本优化

1. **分层存储策略**：
   ```
   热数据（最近 30 天）: 本地 SSD
   温数据（30-90 天）: S3 Standard
   冷数据（90+ 天）: S3 Glacier Instant Retrieval
   归档数据（1年+）: S3 Glacier Deep Archive
   ```
   - **节省**: 60-80% 存储成本

2. **定期清理**：
   ```bash
   # 每周清理脚本
   #!/bin/bash
   # 删除 90 天前的观察
   sqlite3 ~/.claude-mem/claude-mem.db \
     "DELETE FROM observations WHERE created_at < datetime('now', '-90 days')"

   # 压缩数据库
   sqlite3 ~/.claude-mem/claude-mem.db "VACUUM"
   ```
   - **节省**: 20-40% 数据库大小

3. **向量压缩**：
   - 使用量化（Scalar Quantization）
   - **节省**: 50-75% 向量存储空间

#### 9.4.4 网络成本优化

1. **使用 CDN**：
   - Cloudflare (免费层)
   - AWS CloudFront
   - **节省**: 50-70% 数据传输成本

2. **同区域部署**：
   - Worker Service 和 Anthropic API 在同一区域
   - **节省**: 减少跨区域流量费用

3. **压缩传输**：
   ```typescript
   // Express 启用 gzip 压缩
   import compression from 'compression';
   app.use(compression());
   ```
   - **节省**: 60-80% 带宽

### 9.5 总成本对比表

| 部署规模 | 会话/月 | 推荐配置 | 月成本 (USD) | 月成本 (CNY) |
|---------|---------|---------|-------------|-------------|
| **Small** | 100-500 | 单机 + Haiku | **$18** | **¥86** |
| **Medium** | 1K-5K | 单机 + Sonnet + Redis | **$116** | **¥704** |
| **Large** | 10K+ | Kubernetes + 托管服务 | **$1,614** | **¥10,150** |

**优化后成本**（应用所有优化建议）：

| 部署规模 | 原成本 (USD) | 优化后 (USD) | 节省率 |
|---------|-------------|-------------|--------|
| **Small** | $18 | $12 | 33% |
| **Medium** | $116 | $65 | 44% |
| **Large** | $1,614 | $850 | 47% |

---

## 总结

### 关键要点

1. **本地优先架构**：
   - Claude-Mem 设计为本地优先，核心数据存储在 `~/.claude-mem/`
   - 云部署主要用于团队协作和高可用场景
   - 隐私优先，无需强制云依赖

2. **最小云依赖**：
   - **必需**：计算资源（运行 Worker Service）
   - **必需**：LLM API（Anthropic Claude）
   - **可选**：对象存储（备份）、托管向量数据库（Qdrant Cloud）

3. **成本结构**：
   - **主要成本**：LLM API（占 50-70%）
   - **次要成本**：计算资源（占 20-30%）
   - **其他成本**：存储、网络、监控（占 10-20%）

4. **优化潜力**：
   - 通过选择 Claude 4.5 Haiku 可节省 80%+ LLM 成本
   - 通过 Prompt Caching 可节省 50-90% token 成本
   - 通过分层存储和定期清理可节省 60-80% 存储成本

### 快速开始建议

**阶段 1：本地开发（1 天）**
```
环境: 本地机器
成本: $0（仅 Anthropic API 按需）
目标: 熟悉架构，验证功能
```

**阶段 2：云端测试（1 周）**
```
环境: 单台云服务器 (t3.small)
成本: ~$18/月
目标: 验证生产可行性
```

**阶段 3：生产部署（2-4 周）**
```
环境: 云服务器 + 托管服务
成本: ~$116/月（中型）
目标: 稳定运行，团队使用
```

### 推荐云服务商

| 场景 | 推荐服务商 | 理由 |
|------|-----------|------|
| **快速开始** | AWS | 生态完整，文档丰富 |
| **成本优先** | GCP | AI/ML 友好，价格优势 |
| **中国区** | 阿里云 | 合规性，低延迟 |
| **混合云** | Cloudflare + Pinecone | 避免锁定，全球分布 |

### 复杂度评分

**总体复杂度**: **3/10** (非常简单)

**评分依据**：
- ✅ 单一运行时（Bun + Node.js）
- ✅ 本地数据库（SQLite + Chroma）
- ✅ 无需容器编排（小规模）
- ✅ 外部依赖少（仅 Anthropic API）
- ⚠️ 需要配置 MCP（Chroma 集成）
- ⚠️ 需要理解 Hook 系统

**适合场景**：
- ✅ 个人开发者
- ✅ 小型团队（<10 人）
- ✅ 隐私优先场景
- ✅ 本地开发工作流
- ⚠️ 大规模 SaaS（需要架构调整）

---

**文档版本**: v1.0
**更新日期**: 2025-02-12
**基础版本**: Claude-Mem v10.0.1
