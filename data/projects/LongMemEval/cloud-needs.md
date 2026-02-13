# LongMemEval 云服务需求详细分析

## 1. 计算资源需求

### 1.1 CPU 计算需求

**BM25 稀疏检索**
- 推荐配置: 16-32 vCPUs
- 内存: 32-64 GB RAM
- 并发进程: 10
- 用途: 快速基线检索,无需 GPU
- 成本估算: $0.68/hr (AWS c5.4xlarge)

**数据预处理与评估**
- 推荐配置: 8-16 vCPUs
- 内存: 16-32 GB RAM
- 用途: JSON 解析、指标计算、结果聚合
- 成本估算: $0.34/hr (AWS c5.2xlarge)

### 1.2 GPU 计算需求

**Dense 检索器性能对比**

| 检索器 | 参数量 | VRAM 需求 | 推荐 GPU | 吞吐量 (docs/sec) | 成本/小时 (AWS) |
|--------|--------|-----------|----------|-------------------|-----------------|
| Contriever | 110M | 4 GB | 1x T4 | 2000 | $0.526 |
| Stella V5 | 1.5B | 12 GB | 1x V100 | 800 | $3.06 |
| GTE-Qwen2 | 7B | 28 GB | 1x A100 | 200 | $4.10 |

**LLM 推理需求**

| 模型 | 参数量 | VRAM (FP16) | Tensor Parallel | 推荐 GPU 配置 | 吞吐量 (tokens/sec) |
|------|--------|-------------|-----------------|--------------|---------------------|
| Llama 3.1 8B | 8B | 16 GB | 1 | 1x A100 40GB | 1500 |
| Llama 3.1 70B | 70B | 140 GB | 4 | 4x A100 40GB | 500 |
| Phi-3 Medium | 14B | 28 GB | 2 | 2x A100 40GB | 800 |
| Mistral 7B | 7B | 14 GB | 1 | 1x A100 40GB | 1800 |

**索引扩展 LLM 需求**
- Session Summarization: Llama 3.1 8B (1x A100)
- Keyphrase Extraction: Llama 3.1 8B (1x A100)
- User Fact Extraction: Llama 3.1 8B (1x A100)
- 批处理: 500 会话 * 5 轮次 = 2500 次调用
- 时间估算: ~2-4 小时 (使用 vLLM)

### 1.3 工作负载估算

**LongMemEval_S (500 questions, ~40 sessions each)**

```yaml
检索阶段:
- BM25: 500 questions * 40 sessions = 20,000 检索操作
  - 时间: ~30 分钟 (10 进程)
  - 资源: 16 vCPUs, 32 GB RAM

- Stella V5: 500 questions * 40 sessions
  - 时间: ~2 小时 (4x V100)
  - 资源: 4x V100 16GB

- GTE-Qwen2: 500 questions * 40 sessions
  - 时间: ~6 小时 (4x A100)
  - 资源: 4x A100 40GB

生成阶段 (Top-10 检索):
- Llama 3.1 70B: 500 questions
  - 平均输入: 115k tokens
  - 平均输出: 500 tokens
  - 时间: ~4 小时 (4x A100, vLLM)
  - 资源: 4x A100 40GB

评估阶段:
- GPT-4o API: 500 questions
  - 时间: ~1 小时 (并发 10)
  - 成本: ~$600

总计:
- 时间: 检索 (2-6h) + 生成 (4h) + 评估 (1h) = 7-11 小时
- GPU 小时: 28-44 A100-hours
- 成本: ~$115-180 (GPU) + $600 (评估) = $715-780
```

**LongMemEval_M (500 questions, ~500 sessions each)**

```yaml
检索阶段:
- BM25: 500 * 500 = 250,000 检索操作
  - 时间: ~4 小时 (20 进程)
  - 资源: 32 vCPUs, 64 GB RAM

- GTE-Qwen2: 500 * 500
  - 时间: ~48 小时 (8x A100)
  - 资源: 8x A100 40GB

生成阶段:
- 不适用 (超过 128k 上下文限制)
- 需要 RAG 方法

总计:
- 检索为主要瓶颈
- GPU 小时: ~384 A100-hours (GTE)
- 成本: ~$1,575 (GPU 仅)
```

## 2. 数据库需求

### 2.1 关系型数据库 (PostgreSQL)

**用途**: 存储实验配置、结果、指标

**Schema 设计**:
```sql
-- 实验表
CREATE TABLE experiments (
    experiment_id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    model_name VARCHAR(100),
    retriever_type VARCHAR(50),
    granularity VARCHAR(20),
    topk INT,
    history_format VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    config JSONB
);

-- QA 结果表
CREATE TABLE qa_results (
    result_id SERIAL PRIMARY KEY,
    experiment_id INT REFERENCES experiments(experiment_id),
    question_id VARCHAR(50) NOT NULL,
    question_type VARCHAR(50),
    question TEXT,
    answer TEXT,
    hypothesis TEXT,
    autoeval_label BOOLEAN,
    autoeval_model VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(experiment_id, question_id)
);

-- 检索结果表
CREATE TABLE retrieval_results (
    result_id SERIAL PRIMARY KEY,
    experiment_id INT REFERENCES experiments(experiment_id),
    question_id VARCHAR(50) NOT NULL,
    granularity VARCHAR(20),
    recall_any_k1 FLOAT,
    recall_any_k3 FLOAT,
    recall_any_k5 FLOAT,
    recall_any_k10 FLOAT,
    recall_all_k5 FLOAT,
    ndcg_any_k5 FLOAT,
    ndcg_any_k10 FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(experiment_id, question_id)
);

-- 索引
CREATE INDEX idx_qa_results_experiment ON qa_results(experiment_id);
CREATE INDEX idx_qa_results_type ON qa_results(question_type);
CREATE INDEX idx_retrieval_results_experiment ON retrieval_results(experiment_id);
```

**存储需求**:
- 每个实验: ~500 questions * 2 KB = 1 MB
- 100 个实验: ~100 MB
- 加上索引和日志: ~500 MB

**推荐配置**:
- AWS RDS PostgreSQL: db.t3.medium (2 vCPU, 4 GB RAM)
- GCP Cloud SQL: db-n1-standard-1 (1 vCPU, 3.75 GB RAM)
- Azure Database: GP_Gen5_2 (2 vCPU, 10 GB RAM)
- 存储: 20 GB SSD
- 成本: $50-100/月

### 2.2 NoSQL 数据库 (MongoDB/DynamoDB)

**用途**: 存储原始对话历史、检索日志 (JSONB 结构)

**数据模型**:
```javascript
// questions 集合
{
    "_id": ObjectId("..."),
    "question_id": "single_hop_001",
    "question_type": "single-session-user",
    "question": "What is my favorite food?",
    "answer": "Pizza",
    "question_date": "2023/05/25 (Thu) 18:30",
    "haystack_session_ids": ["answer_session_1", "session_2", ...],
    "haystack_dates": ["2023/05/20", "2023/05/21", ...],
    "haystack_sessions": [
        [{"role": "user", "content": "I love pizza"}],
        ...
    ],
    "answer_session_ids": ["answer_session_1"],
    "metadata": {
        "created_at": ISODate("2024-10-15T10:00:00Z"),
        "dataset": "longmemeval_s"
    }
}

// retrieval_logs 集合
{
    "_id": ObjectId("..."),
    "question_id": "single_hop_001",
    "retriever": "flat-stella",
    "granularity": "session",
    "query": "What is my favorite food?",
    "ranked_items": [
        {
            "corpus_id": "answer_session_1",
            "text": "I love pizza",
            "timestamp": "2023/05/20",
            "score": 0.92
        },
        ...
    ],
    "metrics": {
        "session": {
            "recall_any@5": 1.0,
            "recall_all@5": 1.0,
            "ndcg_any@10": 0.95
        }
    },
    "created_at": ISODate("2024-10-15T11:30:00Z")
}
```

**存储需求**:
- LongMemEval_S: 500 questions * 100 KB = 50 MB
- LongMemEval_M: 500 questions * 5 MB = 2.5 GB
- 检索日志: 500 questions * 200 KB = 100 MB
- 总计: ~3-5 GB

**推荐配置**:
- MongoDB Atlas: M10 (2 GB RAM, 10 GB 存储) - $57/月
- AWS DynamoDB: On-Demand 模式 - $1.25/月/GB (读) + $6.25/月/GB (写)
- GCP Firestore: Native mode - $0.18/GB (存储) + $0.06/100k (读)

## 3. 存储需求

### 3.1 对象存储 (S3/GCS/Azure Blob)

**存储层次结构**:
```
longmemeval-bucket/
├── datasets/                          # 50-500 MB
│   ├── longmemeval_s_cleaned.json     # 5 MB
│   ├── longmemeval_m_cleaned.json     # 50 MB
│   ├── longmemeval_oracle.json        # 3 MB
│   └── custom_history/                # 10-50 GB
│       ├── 1_attr_bg/                 # 100 MB
│       ├── 2_questions/               # 50 MB
│       ├── 5_filler_sess/             # 5 GB
│       └── 6_session_cache/           # 2 GB
│
├── model_cache/                       # 100-500 GB
│   ├── facebook_contriever/           # 1 GB
│   ├── dunzhang_stella_v5/            # 8 GB
│   ├── Alibaba_gte_qwen2_7b/          # 28 GB
│   ├── meta-llama_3.1-8B-instruct/    # 16 GB
│   ├── meta-llama_3.1-70B-instruct/   # 140 GB
│   └── vllm_cache/                    # 50 GB
│
├── retrieval_logs/                    # 5-20 GB
│   ├── flat-bm25/session/             # 500 MB
│   ├── flat-contriever/session/       # 1 GB
│   ├── flat-stella/session/           # 1 GB
│   └── flat-gte/session/              # 1 GB
│
├── generation_logs/                   # 2-10 GB
│   ├── llama-3.1-70b/                 # 2 GB
│   ├── gpt-4o/                        # 1 GB
│   └── phi-3-medium/                  # 1.5 GB
│
├── index_expansion_logs/              # 5-10 GB
│   ├── session-summ/                  # 2 GB
│   ├── session-keyphrase/             # 1 GB
│   ├── session-userfact/              # 2 GB
│   └── temporal-events/               # 1 GB
│
└── evaluation_results/                # 1-5 GB
    ├── qa_metrics/                    # 500 MB
    ├── retrieval_metrics/             # 500 MB
    └── plots/                         # 200 MB
```

**总存储需求**:
- 研究阶段: 150-200 GB
- 生产环境: 500-1000 GB (包含多个模型和实验)

**成本估算** (AWS S3 Standard):
```yaml
存储:
- 500 GB * $0.023/GB = $11.50/月

数据传输:
- 出站 (下载): 100 GB * $0.09/GB = $9/月
- 入站 (上传): 免费

请求:
- PUT/POST: 10,000 * $0.005/1000 = $0.05
- GET: 100,000 * $0.0004/1000 = $0.04

总计: ~$21/月
```

**生命周期策略**:
```yaml
规则:
- 实验日志 > 30 天: 迁移到 S3 Glacier ($0.004/GB)
- 旧模型缓存 > 90 天: 迁移到 Glacier Deep Archive ($0.00099/GB)
- 临时文件 > 7 天: 自动删除

节省: ~50-70% 存储成本
```

### 3.2 块存储 (EBS/Persistent Disk)

**用途**: GPU 实例本地存储,加速模型加载

**推荐配置**:
```yaml
开发环境:
- gp3 (SSD): 500 GB
- IOPS: 3000
- 吞吐量: 125 MB/s
- 成本: $40/月 (AWS)

生产环境:
- gp3 (SSD): 2 TB
- IOPS: 10000
- 吞吐量: 500 MB/s
- 成本: $200/月 (AWS)

或使用 io2 (高性能):
- 1 TB, 20000 IOPS
- 成本: ~$650/月
```

### 3.3 共享文件系统 (EFS/Filestore/Azure Files)

**用途**: 多 GPU 节点共享模型和数据

**推荐配置**:
```yaml
AWS EFS:
- 模式: Bursting (弹性吞吐)
- 存储: 500 GB
- 吞吐量: 50 MB/s (基准) + 100 MB/s (突发)
- 成本: $150/月

GCP Filestore:
- Tier: Basic HDD
- 容量: 1 TB (最小)
- 吞吐量: 100 MB/s
- 成本: $200/月

Azure Files:
- Tier: Premium (SSD)
- 容量: 1 TB
- 成本: $150/月
```

## 4. 向量数据库需求

### 4.1 为什么需要向量数据库

当前 LongMemEval 实现使用内存检索,但对于生产部署建议使用向量数据库:

**优势**:
- 持久化存储向量索引
- 高效的近似最近邻 (ANN) 搜索
- 水平扩展支持
- 元数据过滤
- 实时更新

### 4.2 向量规模估算

```python
# LongMemEval_S
sessions = 500 questions * 40 sessions = 20,000 sessions
turns_per_session = 5 (平均)
total_turns = 20,000 * 5 = 100,000 turns

# 向量存储需求
Contriever (768 维, FP32):
- Session-level: 20,000 * 768 * 4 bytes = 61 MB
- Turn-level: 100,000 * 768 * 4 bytes = 307 MB

Stella (1024 维, FP32):
- Session-level: 20,000 * 1024 * 4 bytes = 82 MB
- Turn-level: 100,000 * 1024 * 4 bytes = 410 MB

GTE-Qwen2 (4096 维, FP32):
- Session-level: 20,000 * 4096 * 4 bytes = 328 MB
- Turn-level: 100,000 * 4096 * 4 bytes = 1.64 GB

# LongMemEval_M
sessions = 500 * 500 = 250,000 sessions
total_turns = 250,000 * 5 = 1,250,000 turns

GTE-Qwen2 (4096 维, FP32):
- Session-level: 250,000 * 4096 * 4 bytes = 4.1 GB
- Turn-level: 1,250,000 * 4096 * 4 bytes = 20.5 GB
```

### 4.3 向量数据库选型

**Pinecone** (托管服务)
```yaml
配置:
- Pod Type: p1.x1 (768 维, 1M 向量)
- Replicas: 1
- 适用: Contriever, Stella

成本:
- p1.x1: $70/月/pod
- p1.x2 (1024 维): $140/月/pod

优势:
- 零运维
- 自动扩展
- 99.9% SLA

劣势:
- 不支持 > 2048 维 (GTE 不适用)
- 成本较高
```

**Weaviate** (开源, 可自托管)
```yaml
自托管配置:
- 实例: c5.2xlarge (8 vCPU, 16 GB RAM)
- 存储: 50 GB SSD
- 向量: 100k (Contriever)

成本:
- EC2: $0.34/hr * 730 = $248/月
- EBS: $4/月
- 总计: ~$252/月

托管 (Weaviate Cloud):
- Standard: 从 $25/月起
- 包含 1M 向量维护
```

**Milvus** (开源, 云原生)
```yaml
Kubernetes 部署:
- CPU: 8 cores
- 内存: 32 GB
- GPU: 可选 (加速索引构建)
- 存储: 100 GB SSD

成本 (AWS EKS):
- c5.2xlarge: $248/月
- EBS: $8/月
- EKS 控制平面: $73/月
- 总计: ~$329/月

Zilliz Cloud (托管 Milvus):
- 从 $0.15/小时起
- ~$110/月 (持续运行)
```

**Qdrant** (开源, 高性能)
```yaml
自托管:
- 实例: c5.xlarge (4 vCPU, 8 GB RAM)
- 存储: 30 GB SSD
- 向量: 100k

成本:
- EC2: $0.17/hr * 730 = $124/月
- EBS: $2.4/月
- 总计: ~$126/月

Qdrant Cloud:
- 从 $25/月起
- 包含 1M 向量
```

### 4.4 推荐方案

**研究阶段**: 内存检索 (当前实现)
- 成本: $0
- 优势: 简单, 快速原型
- 劣势: 不持久化, 需每次重新构建

**小规模生产**: Qdrant Cloud
- 成本: $25-50/月
- 优势: 易部署, 性能好, 成本低
- 适用: < 1M 向量

**大规模生产**: 自托管 Milvus (Kubernetes)
- 成本: $300-500/月
- 优势: 可扩展, 功能丰富, 云原生
- 适用: > 1M 向量, 多租户

## 5. AI/ML 服务需求

### 5.1 Embedding API 服务

**OpenAI Embeddings** (不推荐用于 LongMemEval)
```yaml
模型: text-embedding-3-large (3072 维)
成本: $0.13/1M tokens

LongMemEval_S (20,000 sessions):
- 平均 session 长度: 200 tokens
- 总 tokens: 20,000 * 200 = 4M tokens
- 成本: 4M * $0.13 / 1M = $0.52

劣势:
- 维度不匹配 (LongMemEval 使用专门检索器)
- 评估不公平
```

**Cohere Embed** (不推荐)
```yaml
模型: embed-english-v3.0 (1024 维)
成本: $0.10/1M tokens

与 OpenAI 类似问题
```

**推荐**: 自托管开源模型
- Contriever: 免费
- Stella V5: 免费
- GTE-Qwen2: 免费
- 成本仅为 GPU 时间

### 5.2 LLM 推理服务

**OpenAI API**
```yaml
GPT-4o (推荐用于评估):
- 输入: $2.50/1M tokens (批处理: $1.25)
- 输出: $10/1M tokens (批处理: $5)

LongMemEval_S 评估:
- 500 questions * 500 tokens = 250k tokens
- 成本: 250k * $2.50 / 1M = $0.625 (输入)
       + 250k * 10 * $10 / 1M = $2.50 (输出, 假设 10 tokens)
- 总计: ~$3.13

GPT-4o-mini (经济选择):
- 输入: $0.15/1M tokens
- 输出: $0.60/1M tokens
- LongMemEval_S 评估: ~$0.19

GPT-4o 用于生成 (LongMemEval_S):
- 500 questions * 120k tokens = 60M tokens (输入)
- 500 questions * 500 tokens = 250k tokens (输出)
- 成本: 60M * $2.50 / 1M + 250k * $10 / 1M = $150 + $2.5 = $152.50

不适用于 LongMemEval_M (超过 128k 上下文)
```

**Anthropic Claude**
```yaml
Claude 3.5 Sonnet:
- 输入: $3/1M tokens
- 输出: $15/1M tokens
- 上下文: 200k tokens

LongMemEval_S 评估: ~$3.75
LongMemEval_M: 部分支持 (需要 RAG)
```

**Google Gemini**
```yaml
Gemini 1.5 Pro:
- 输入: $1.25/1M tokens (< 128k)
        $2.50/1M tokens (> 128k)
- 输出: $5/1M tokens (< 128k)
         $10/1M tokens (> 128k)
- 上下文: 2M tokens (最大)

LongMemEval_S: ~$150
LongMemEval_M: 完全支持! ~$1,250 (500 * 500k tokens * $2.50/1M)
```

**vLLM (自托管, 推荐)**
```yaml
Llama 3.1 70B:
- GPU: 4x A100 40GB
- 成本: $4.10/hr * 4 = $16.40/hr
- LongMemEval_S 生成 (4 小时): $65.60

Llama 3.1 8B (评估):
- GPU: 1x A100 40GB
- 成本: $4.10/hr
- LongMemEval_S 评估 (1 小时): $4.10

总计: $65.60 + $4.10 = $69.70 (vs $152.50 OpenAI)
节省: 54%

对于重复实验:
- 10 次实验: $697 (自托管) vs $1,525 (OpenAI)
- 节省: $828
```

**Replicate / RunPod (托管推理)**
```yaml
Replicate (Llama 3.1 70B):
- 成本: $0.0005/秒
- 平均推理: 10 秒/请求
- LongMemEval_S (500 requests): 500 * 10 * $0.0005 = $2.50

RunPod (Llama 3.1 70B):
- 成本: 4x A100 Pod - $2.40/hr (Spot)
- LongMemEval_S (4 小时): $9.60

推荐: RunPod (Spot) 用于批处理工作
```

### 5.3 索引扩展 LLM

**会话摘要/关键短语/用户事实提取**
```yaml
工作负载:
- LongMemEval_S: 500 questions * 40 sessions = 20,000 sessions
- 平均输入: 200 tokens/session
- 平均输出: 100 tokens/summary
- 总 tokens: 20,000 * (200 + 100) = 6M tokens

OpenAI GPT-4o-mini:
- 成本: 6M * $0.15 / 1M = $0.90 (输入)
       + 2M * $0.60 / 1M = $1.20 (输出)
- 总计: $2.10

vLLM (Llama 3.1 8B):
- GPU: 1x A100 40GB
- 时间: ~2 小时 (批处理)
- 成本: $4.10 * 2 = $8.20

推荐: OpenAI GPT-4o-mini (更快, 成本相当)
```

## 6. 网络与 CDN 需求

### 6.1 带宽需求

**模型下载**
```yaml
一次性下载:
- Llama 3.1 70B: 140 GB
- GTE-Qwen2-7B: 28 GB
- Stella V5: 8 GB
- Contriever: 1 GB
- 总计: ~180 GB

带宽需求:
- 1 Gbps 连接: 180 GB / 125 MB/s = ~24 分钟
- 100 Mbps 连接: ~4 小时

推荐: 使用 AWS S3 Transfer Acceleration 或 Hugging Face 镜像
```

**运行时流量**
```yaml
检索阶段:
- 请求大小: ~10 KB (query + metadata)
- 响应大小: ~100 KB (top-10 results)
- 500 questions: 500 * 110 KB = 55 MB

生成阶段:
- 请求大小: ~120 KB (prompt)
- 响应大小: ~5 KB (answer)
- 500 questions: 500 * 125 KB = 62.5 MB

评估阶段:
- 请求大小: ~5 KB
- 响应大小: ~0.5 KB
- 500 questions: 500 * 5.5 KB = 2.75 MB

总流量: ~120 MB (可忽略不计)
```

### 6.2 CDN 配置

**用途**: 加速数据集和模型分发

**Cloudflare (推荐)**
```yaml
配置:
- 免费计划: 适用于数据集分发
- 缓存: longmemeval_s.json (5 MB)
- 节省: 90% 重复下载带宽

Pro 计划 ($20/月):
- 增强缓存
- 图像优化 (用于论文图表)
- 更快的 DNS
```

**AWS CloudFront**
```yaml
成本:
- 数据传输 (美国): $0.085/GB (前 10 TB)
- 请求: $0.0075/10,000

100 次数据集下载 (5 MB):
- 传输: 0.5 GB * $0.085 = $0.043
- 请求: 100 * $0.0075/10000 = $0.00008
- 总计: ~$0.05/月
```

## 7. 容器编排与部署需求

### 7.1 Docker 容器化

**镜像大小估算**
```yaml
基础镜像: nvidia/cuda:12.1-cudnn8-runtime-ubuntu22.04 (5 GB)
Python 依赖: 3 GB (transformers, torch, vllm, etc.)
应用代码: 100 MB
总计: ~8-10 GB

优化后 (多阶段构建):
- 最终镜像: ~6 GB
```

**Docker Registry**
```yaml
Docker Hub (免费):
- 1 个私有仓库
- 无限公共仓库
- 带宽: 无限

AWS ECR:
- 存储: $0.10/GB/月
- 传输: 免费 (同区域)
- 10 GB * $0.10 = $1/月

GCP Artifact Registry:
- 存储: $0.10/GB/月
- 同 ECR

推荐: ECR (AWS) 或 Artifact Registry (GCP) 以获得最佳性能
```

### 7.2 Kubernetes 集群

**开发/测试环境**
```yaml
GKE Autopilot (推荐):
- 无需管理节点
- 按 Pod 付费
- 2x n1-standard-4 (用于 BM25): $0.30/hr
- 控制平面: 免费
- 成本: ~$220/月

AWS EKS:
- 控制平面: $0.10/hr = $73/月
- 工作节点: 2x c5.2xlarge = $496/月
- 总计: ~$569/月

推荐: GKE Autopilot (更经济)
```

**生产环境 (GPU)**
```yaml
GKE (GPU 节点池):
- 控制平面: 免费 (Autopilot) 或 $73/月 (标准)
- GPU 节点: 2x n1-standard-8 + 2x A100
  - 按需: ~$6/hr * 2 = $12/hr
  - 抢占式: ~$2/hr * 2 = $4/hr
- 月度成本: $2,920 (按需) 或 $876 (抢占式)

AWS EKS (GPU):
- 控制平面: $73/月
- GPU 节点: 2x p3.2xlarge (1x V100 each)
  - 按需: $3.06/hr * 2 = $6.12/hr
  - Spot: ~$1.50/hr * 2 = $3/hr (平均)
- 月度成本: $4,541 (按需) 或 $2,263 (Spot)

推荐: GKE 抢占式 GPU 用于研究 (节省 70%)
```

**Kubernetes 资源预留**
```yaml
vLLM Deployment:
  requests:
    nvidia.com/gpu: 4
    memory: 200Gi
    cpu: 32
  limits:
    nvidia.com/gpu: 4
    memory: 256Gi
    cpu: 64

Retrieval Job:
  requests:
    nvidia.com/gpu: 2
    memory: 64Gi
    cpu: 16
  limits:
    nvidia.com/gpu: 2
    memory: 128Gi
    cpu: 32
```

### 7.3 Serverless / FaaS

**AWS Lambda** (不适用于 GPU 工作负载)
- 仅用于轻量级任务 (数据预处理, API 网关)

**Google Cloud Run** (不适用于 GPU)
- 仅用于 CPU 任务

**推荐**: Kubernetes + GPU 节点池 (更灵活)

## 8. 成本优化策略

### 8.1 计算成本优化

**使用 Spot/Preemptible Instances**
```yaml
节省: 60-90%

AWS EC2 Spot:
- p3.2xlarge: $3.06/hr (按需) → $0.92/hr (Spot, 70% 折扣)
- p4d.24xlarge: $32.77/hr (按需) → $9.83/hr (Spot, 70% 折扉)

GCP Preemptible GPUs:
- n1-standard-8 + 1x V100: $2.48/hr (按需) → $0.74/hr (抢占式, 70% 折扣)

注意事项:
- 可能被中断 (需容错机制)
- 使用 Kubernetes 自动重启
- 检查点 (checkpointing) 保存进度
```

**Reserved Instances / Committed Use Discounts**
```yaml
1 年承诺:
- AWS: 40% 折扣
- GCP: 37% 折扣
- Azure: 28% 折扣

3 年承诺:
- AWS: 60% 折扣
- GCP: 55% 折扣
- Azure: 52% 折扣

适用场景:
- 持续运行的服务 (vLLM API server)
- 可预测的工作负载

LongMemEval 不推荐 (间歇性工作负载)
```

**模型量化**
```yaml
INT8 量化:
- VRAM 减少: 50%
- 速度提升: 2x
- 精度损失: < 1%

INT4 量化:
- VRAM 减少: 75%
- 速度提升: 3-4x
- 精度损失: 2-3%

示例:
- Llama 3.1 70B (FP16): 4x A100 40GB
- Llama 3.1 70B (INT8): 2x A100 40GB (节省 50% GPU 成本)
- Llama 3.1 70B (INT4): 1x A100 40GB (节省 75% GPU 成本)
```

### 8.2 存储成本优化

**生命周期策略**
```yaml
S3 Intelligent-Tiering (自动):
- 频繁访问: $0.023/GB
- 不频繁访问 (30 天): $0.0125/GB
- 存档 (90 天): $0.004/GB
- 深度存档 (180 天): $0.00099/GB

节省: 30-95% (取决于访问模式)

LongMemEval 应用:
- 活跃数据集: Standard ($0.023/GB)
- 旧实验日志 (> 30 天): Glacier ($0.004/GB)
- 历史备份 (> 90 天): Deep Archive ($0.00099/GB)

500 GB 混合存储:
- 100 GB Standard: $2.30
- 200 GB Glacier: $0.80
- 200 GB Deep Archive: $0.20
- 总计: $3.30/月 (vs $11.50 全 Standard, 节省 71%)
```

**数据压缩**
```yaml
gzip 压缩:
- JSON 文件: 压缩率 70-90%
- 示例: longmemeval_s.json (5 MB) → 500 KB

longmemeval_m.json (50 MB) → 5 MB

节省: 存储和传输成本减少 90%
```

### 8.3 网络成本优化

**避免跨区域传输**
```yaml
AWS 区域间传输:
- 成本: $0.02/GB
- 500 GB: $10

同区域传输:
- 成本: 免费

策略:
- 数据、模型、计算在同一区域
- 使用 S3 Transfer Acceleration 仅用于初始上传
```

**CDN 缓存**
```yaml
CloudFront 缓存:
- 源站请求: $0.085/GB
- 缓存命中: 免费 (用户视角)

100 次数据集下载:
- 无缓存: 100 * 5 MB * $0.085 / 1024 MB = $0.042
- 缓存 (90% 命中率): $0.004

节省: 90%
```

### 8.4 混合云策略

**成本优化组合**
```yaml
计算:
- AWS Spot Instances (p3.2xlarge): $0.92/hr
- 或 GCP Preemptible (n1-standard-8 + V100): $0.74/hr

存储:
- Cloudflare R2 (S3 兼容): $0.015/GB (无出站费用!)
- vs AWS S3: $0.023/GB + $0.09/GB 出站

向量数据库:
- 自托管 Qdrant (c5.xlarge Spot): $0.05/hr (~$36/月)

LLM 推理:
- vLLM on RunPod (Spot): $2.40/hr (4x A100)
- 或 Replicate (按秒计费): $0.0005/秒

总计 (LongMemEval_S 单次实验):
- 计算: 10 hrs * $0.92 = $9.20
- 存储: 500 GB * $0.015 = $7.50/月 (按天: $0.25)
- 向量 DB: $36/月 (按天: $1.20)
- LLM 推理: 4 hrs * $2.40 = $9.60
- 总计: ~$20 (vs ~$150 全 AWS 按需)

节省: 87%
```

## 9. 安全与合规需求

### 9.1 数据加密

**静态加密**
```yaml
S3:
- AES-256 (SSE-S3): 免费
- KMS (SSE-KMS): $1/月/key + $0.03/10k 请求

RDS/Cloud SQL:
- 静态加密: 免费 (启用即可)

EBS/Persistent Disk:
- 加密: 免费

推荐: 所有存储启用加密
```

**传输加密**
```yaml
TLS 1.3:
- API 端点: 强制 HTTPS
- 内部通信: mTLS (mutual TLS)

成本: 免费 (性能开销 < 1%)
```

### 9.2 访问控制

**IAM / RBAC**
```yaml
AWS IAM:
- 角色: longmemeval-retrieval-role
- 策略: 最小权限 (S3 读, CloudWatch 写)

Kubernetes RBAC:
- ServiceAccount: longmemeval-sa
- 权限: Pod 创建, Secret 读取

成本: 免费
```

**密钥管理**
```yaml
AWS Secrets Manager:
- 成本: $0.40/月/secret + $0.05/10k API 调用

GCP Secret Manager:
- 成本: $0.06/月/secret + $0.03/10k 访问

存储密钥:
- OpenAI API Key
- Hugging Face Token
- 数据库密码

推荐: Secrets Manager (避免明文存储)
```

### 9.3 网络安全

**VPC / Private Network**
```yaml
AWS VPC:
- 成本: 免费 (基础)
- NAT Gateway: $0.045/hr = $32.85/月 + 数据处理费

GCP VPC:
- 成本: 免费
- Cloud NAT: $0.045/hr = $32.85/月

配置:
- 私有子网: GPU 实例
- 公共子网: API Gateway
- 安全组: 仅允许必要端口 (8001 vLLM, 443 HTTPS)
```

**DDoS 防护**
```yaml
AWS Shield Standard:
- 成本: 免费
- 防护: L3/L4 攻击

Cloudflare (推荐):
- 免费计划: 无限 DDoS 防护
- 包括 WAF (Web Application Firewall)
```

### 9.4 监控与审计

**日志记录**
```yaml
AWS CloudWatch Logs:
- 成本: $0.50/GB (摄取) + $0.03/GB/月 (存储)
- 保留: 30 天
- 10 GB 日志: $5 (摄取) + $0.30 (存储) = $5.30/月

GCP Cloud Logging:
- 成本: $0.50/GB (前 50 GB 免费)
- 保留: 30 天

推荐: 集成 ELK Stack (自托管) 用于长期存储
- Elasticsearch: c5.2xlarge ($248/月)
- Kibana: 包含在 ES 中
- 日志保留: 1 年
```

**审计跟踪**
```yaml
AWS CloudTrail:
- 成本: $2/100k 事件
- 记录所有 API 调用

GCP Cloud Audit Logs:
- 成本: 免费 (管理活动)
- 数据访问: $0.50/GB

用途:
- 追踪数据访问
- 合规审计
- 安全事件调查
```

## 10. 云服务选型总结

### 10.1 按预算推荐

**预算 < $500/月 (研究原型)**
```yaml
计算:
- GCP Preemptible GPU: n1-standard-8 + 1x V100
  - $0.74/hr * 100 hrs = $74/月

存储:
- Cloudflare R2: 500 GB * $0.015 = $7.50/月

数据库:
- AWS RDS PostgreSQL (db.t3.micro): $15/月

LLM 推理:
- Replicate (按需): ~$50/月

总计: ~$146.50/月
```

**预算 $500-$2000/月 (小规模生产)**
```yaml
计算:
- AWS EC2 Spot (p3.2xlarge): $0.92/hr * 200 hrs = $184/月
- 或 GCP Preemptible: $148/月

存储:
- AWS S3 (1 TB, Intelligent-Tiering): $20/月
- EBS (500 GB gp3): $40/月

数据库:
- AWS RDS PostgreSQL (db.t3.medium): $60/月
- Qdrant Cloud: $50/月

LLM 推理:
- vLLM on RunPod (100 hrs): $240/月
- OpenAI API (评估): $100/月

网络:
- CloudFront: $10/月

总计: ~$654/月
```

**预算 > $2000/月 (大规模生产)**
```yaml
计算:
- AWS EKS + Spot Instances (p3.8xlarge): $1,500/月
- 或 GCP GKE + Preemptible GPUs: $1,200/月

存储:
- AWS S3 (5 TB): $115/月
- EFS (2 TB): $600/月

数据库:
- AWS RDS PostgreSQL (db.r5.xlarge): $350/月
- Pinecone (p1.x2): $140/月

LLM 推理:
- 自托管 vLLM (4x A100, 730 hrs): $12,000/月
- 或 Reserved Instances: $4,800/月 (60% 折扣)

网络:
- CloudFront + WAF: $150/月

监控:
- Datadog: $300/月

总计: ~$7,655/月 (Spot) 或 ~$6,455/月 (Reserved)
```

### 10.2 按场景推荐

**学术研究 (间歇性使用)**
```yaml
推荐: GCP + Colab Pro+ (混合)

- Colab Pro+: $50/月
  - 100 compute units
  - A100 访问
  - 适用: 小规模实验, 原型开发

- GCP Preemptible (大规模实验):
  - n1-standard-8 + 2x V100: $1.48/hr
  - 按需使用

存储:
- Google Drive (2 TB): $10/月
- 或 Google Cloud Storage: $20/月

总成本: $60-200/月 (取决于使用量)
```

**企业应用 (24/7 服务)**
```yaml
推荐: AWS + Reserved Instances

计算:
- EKS 控制平面: $73/月
- p4d.24xlarge (RI, 3 年): $10,000/月
  - vs 按需 $23,922/月 (节省 58%)

存储:
- S3 (10 TB): $230/月
- EFS (5 TB): $1,500/月

数据库:
- RDS PostgreSQL (db.r5.2xlarge, RI): $700/月
- ElastiCache Redis: $200/月

网络:
- CloudFront + Shield Advanced: $3,000/月
  - 包含 DDoS 防护和 WAF

监控:
- CloudWatch + X-Ray: $500/月

总成本: ~$16,203/月

SLA: 99.95% (Multi-AZ)
```

**初创公司 (成本优先, 快速迭代)**
```yaml
推荐: 多云混合 (成本优化)

计算:
- RunPod (Spot, 4x A100): $2.40/hr * 100 hrs = $240/月

存储:
- Cloudflare R2 (5 TB): $75/月 (无出站费用)

数据库:
- Supabase (PostgreSQL): $25/月
- Qdrant Cloud: $50/月

LLM 推理:
- Replicate (Llama 3.1 70B): $100/月
- OpenAI API (备用): $50/月

监控:
- Sentry (免费计划): $0

总成本: ~$540/月

优势:
- 无需承诺
- 按需扩展
- 最小化出站费用
```

### 10.3 最终推荐

**综合最佳方案 (性价比)**
```yaml
主要云服务商: GCP
- 原因: Preemptible GPU 成本最低, GKE Autopilot 易用

计算:
- GKE Autopilot + Preemptible GPU 节点
- n1-standard-8 + 2x V100: $1.48/hr (按需使用)

存储:
- Cloudflare R2: 主存储 (无出站费用)
- GCS: 备份 (区域冗余)

数据库:
- Cloud SQL PostgreSQL: db-n1-standard-2 ($100/月)
- 自托管 Qdrant (c2-standard-4): $80/月

LLM 推理:
- 自托管 vLLM (GKE): 按需启动
- Replicate (备用): 峰值负载

CDN:
- Cloudflare (免费): 数据集分发

监控:
- Cloud Monitoring + Cloud Logging (部分免费)

估算成本 (月度, 中等使用):
- 计算: $300 (200 hrs)
- 存储: $100
- 数据库: $180
- LLM: $200
- 网络: $20
- 总计: ~$800/月

扩展性:
- 可扩展至 > 10x (Kubernetes)
- 成本随使用线性增长
```

---

**注意事项**:
1. 所有成本为 2024 年估算,实际价格可能变化
2. 不包含数据传输税和区域差异
3. Spot/Preemptible 价格波动,以 70% 折扣计算
4. 建议使用云成本管理工具 (AWS Cost Explorer, GCP Cost Management) 实时监控
