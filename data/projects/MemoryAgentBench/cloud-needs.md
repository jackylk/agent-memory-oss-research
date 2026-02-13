# MemoryAgentBench 云计算需求分析文档

## 第一节：云基础设施需求概述

### 1.1 项目云化背景
MemoryAgentBench 作为 ICLR 2026 接收的研究基准测试框架，其大规模评估实验对计算资源有显著需求。项目涉及 15+ 种记忆方法、多个长文本数据集（最长 800K tokens）、以及基于 GPT-4o 的 LLM 判断器评估，需要弹性可扩展的云计算基础设施支持。

### 1.2 核心云服务需求分类
- **计算资源**：CPU 密集型评估、GPU 加速的嵌入计算
- **存储资源**：数据集存储、向量数据库、实验结果持久化
- **网络资源**：LLM API 调用、分布式组件通信
- **数据库服务**：关系型数据库（Letta）、向量数据库（FAISS/LanceDB）、图数据库（Cognee/HippoRAG）
- **容器编排**：Docker 容器化部署、批量任务调度
- **监控与日志**：性能监控、成本追踪、错误诊断

### 1.3 云部署的优势
1. **弹性扩展**：根据实验规模动态调整资源
2. **成本优化**：按需付费，避免硬件闲置
3. **并行加速**：多实例并行处理不同数据集/方法
4. **高可用性**：分布式架构保障实验连续性
5. **协作便利**：多研究者共享实验环境和结果

### 1.4 预估月度成本范围
基于中等规模使用场景（每月 50+ 实验运行）：
- **最小配置**（仅长上下文代理）：$150-300/月
- **标准配置**（包含 RAG 方法）：$500-1000/月
- **完整配置**（所有方法 + 大规模评估）：$2000-5000/月

主要成本构成：LLM API 调用（60-70%）、GPU 实例（20-30%）、存储和网络（5-10%）

## 第二节：计算资源需求详细分析

### 2.1 CPU 计算需求

#### 2.1.1 长上下文代理场景
**工作负载特征**：
- 纯 API 调用，本地计算开销小
- 主要消耗：数据预处理、结果后处理、序列化

**推荐配置**：
- **AWS**: t3.xlarge（4 vCPU，16 GB RAM）
- **Azure**: Standard_D4s_v3（4 vCPU，16 GB RAM）
- **GCP**: n2-standard-4（4 vCPU，16 GB RAM）

**成本估算**：约 $120-150/月（按需实例）

**优化建议**：
- 使用 Spot/Preemptible 实例节省 60-70% 成本
- 批量处理多个实验减少启动开销

#### 2.1.2 BM25 RAG 场景
**工作负载特征**：
- 词频统计和倒排索引构建
- 无需 GPU，CPU 和内存密集

**推荐配置**：
- **AWS**: c6i.2xlarge（8 vCPU，16 GB RAM）
- **Azure**: Standard_F8s_v2（8 vCPU，16 GB RAM）
- **GCP**: c2-standard-8（8 vCPU，32 GB RAM）

**成本估算**：约 $200-280/月

**并行加速**：
- 单实例处理 EventQA 64K：约 15 分钟
- 4 并行实例：完成 20 个数据集组合仅需 1-2 小时

#### 2.1.3 Letta/Mem0/Cognee 场景
**工作负载特征**：
- 知识提取和图构建（CPU 密集）
- 需要更大内存（32+ GB）存储图结构

**推荐配置**：
- **AWS**: m6i.2xlarge（8 vCPU，32 GB RAM）
- **Azure**: Standard_E8s_v3（8 vCPU，64 GB RAM）
- **GCP**: n2-highmem-8（8 vCPU，64 GB RAM）

**成本估算**：约 $300-420/月

**数据持久化**：
- Letta SQLite: 挂载 EBS/持久磁盘（10-50 GB）
- Cognee LanceDB: 挂载对象存储（S3/GCS）

### 2.2 GPU 计算需求

#### 2.2.1 密集嵌入生成（Contriever/Qwen3/NV-Embed）
**GPU 要求**：
- 模型大小：1-7B 参数
- 显存需求：8-16 GB（取决于批大小和序列长度）

**推荐配置**：
- **AWS**: g4dn.xlarge（1x NVIDIA T4，16 GB）
- **Azure**: Standard_NC4as_T4_v3（1x T4，16 GB）
- **GCP**: n1-standard-4 + 1x T4（16 GB）

**成本估算**：
- 按需实例：$0.526/小时（AWS g4dn.xlarge）
- 月度成本（每天 4 小时）：约 $252/月
- Spot 实例：可节省至 $75-100/月

**性能基准**：
- EventQA 64K 嵌入生成（Text-Embedding-3-Small via API）：约 30 秒
- 本地 Contriever 嵌入（GPU）：约 45 秒
- NV-Embed-v2（7B，GPU）：约 120 秒

**优化策略**：
- 缓存嵌入结果避免重复计算
- 批处理文档（batch_size=32-64）
- 使用混合精度（FP16）减少显存

#### 2.2.2 HippoRAG 知识图谱构建
**GPU 要求**：
- 实体识别和关系提取需要 LLM 推理
- 如果使用本地模型：24+ GB 显存

**推荐配置（本地 LLM）**：
- **AWS**: g5.xlarge（1x A10G，24 GB）或 g5.2xlarge（1x A10G，24 GB）
- **Azure**: Standard_NC6s_v3（1x V100，16 GB）或 NC12s_v3（2x V100，32 GB）
- **GCP**: a2-highgpu-1g（1x A100，40 GB）

**成本估算**：
- g5.xlarge: $1.006/小时 → $484/月（每天 16 小时）
- 使用 API 模式（推荐）：仅需 CPU 实例 + API 费用

**API vs 本地权衡**：
- **API 模式**（推荐）：
  - 成本：约 $0.50-2.00 per 上下文（依数据集大小）
  - 优势：无需 GPU，部署简单
- **本地模式**：
  - 成本：GPU 实例费用 + 长时间运行
  - 优势：完全控制，无 API 限流

#### 2.2.3 MemoRAG 专用记忆模型
**GPU 要求**：
- memorag-qwen2-7b-inst：需要 16-24 GB 显存
- bge-m3 检索器：约 2 GB 显存

**推荐配置**：
- **AWS**: g5.xlarge（1x A10G，24 GB）
- **Azure**: Standard_NC6s_v3（1x V100，16 GB）
- **GCP**: n1-standard-4 + 1x T4（16 GB，紧凑模式）

**成本估算**：约 $300-500/月（按使用时间）

**内存管理**：
- 使用 bitsandbytes 量化（8bit）减半显存
- 启用梯度检查点（仅推理无需）
- 分块处理超长上下文

### 2.3 并行与分布式策略

#### 2.3.1 数据并行
**场景**：多个独立数据集/方法组合
```bash
# 启动 4 个并行实例处理不同配置
aws ec2 run-instances --count 4 --user-data "
  python main.py --agent_config config1.yaml --dataset_config data1.yaml &
  python main.py --agent_config config2.yaml --dataset_config data2.yaml &
  python main.py --agent_config config3.yaml --dataset_config data3.yaml &
  python main.py --agent_config config4.yaml --dataset_config data4.yaml
"
```

**加速比**：理论 4x（实际 3.5-3.8x，考虑 API 限流）

#### 2.3.2 模型并行
**场景**：大规模嵌入生成
- 分片文档集到多 GPU
- 每个 GPU 处理部分嵌入
- 汇总结果到共享存储

**实现示例**（PyTorch DistributedDataParallel）：
```python
import torch.distributed as dist

dist.init_process_group(backend='nccl')
model = DistributedDataParallel(embedding_model)

# 每个 rank 处理不同的文档分片
local_docs = all_docs[rank::world_size]
embeddings = model(local_docs)
```

#### 2.3.3 任务调度器
**推荐工具**：
- **AWS Batch**：托管批处理服务
- **Kubernetes Jobs**：容器化任务编排
- **Airflow**：复杂工作流管理

**配置示例（AWS Batch）**：
```json
{
  "jobDefinition": "memory-agent-bench",
  "jobQueue": "eval-queue",
  "arrayProperties": {
    "size": 20  // 20 个并行任务
  },
  "containerOverrides": {
    "command": [
      "python", "main.py",
      "--agent_config", "Ref::agent_config",
      "--dataset_config", "Ref::dataset_config"
    ]
  }
}
```

## 第三节：存储资源需求

### 3.1 数据集存储

#### 3.1.1 原始数据集
**存储容量**：
- HuggingFace 数据集缓存：约 2-5 GB
- entity2id.json（推荐系统）：约 50 MB
- 自定义数据集：可变（通常 < 1 GB）

**推荐服务**：
- **AWS S3 Standard**：$0.023/GB/月
- **Azure Blob Storage (Hot)**：$0.0184/GB/月
- **GCP Cloud Storage (Standard)**：$0.020/GB/月

**成本估算**：约 $0.10-0.20/月（5 GB）

**优化建议**：
- 使用 S3 Intelligent-Tiering 自动迁移冷数据
- 启用数据压缩（gzip/zstd）节省 50-70% 空间
- 定期清理过时的实验数据

#### 3.1.2 数据访问模式
**读取密集型**：
- 实验启动时下载数据集
- 建议使用 S3 加速传输（Transfer Acceleration）
- 或使用 EFS/Cloud Filestore 挂载共享

**写入模式**：
- 实验结束后上传结果 JSON
- 使用分段上传（Multipart Upload）处理大文件

### 3.2 向量数据库存储

#### 3.2.1 FAISS 索引
**存储需求**：
- EventQA 64K（约 150 chunks）：~50 MB（Text-Embedding-3-Small，1536维）
- InfBench Sum（约 2000 chunks）：~800 MB
- 完整实验集（20 数据集）：约 5-10 GB

**持久化方案**：
- **本地磁盘**：EBS gp3（AWS）或 SSD 持久磁盘（GCP）
- **共享存储**：EFS（AWS）或 Filestore（GCP）
- **对象存储**：定期备份索引到 S3

**性能考虑**：
- IOPS 需求：低（仅启动时加载）
- 吞吐量需求：中等（100-500 MB/s）

**推荐配置（AWS EBS gp3）**：
- 容量：50 GB
- IOPS：3000（默认）
- 吞吐量：125 MB/s（默认）
- 成本：约 $4/月

#### 3.2.2 LanceDB（Cognee）
**存储需求**：
- 包含知识图谱和向量
- EventQA 64K：~200 MB
- 大规模数据集：1-3 GB per 数据集

**推荐配置**：
- **AWS**: S3（存储）+ EC2 本地缓存（快速访问）
- **Azure**: Blob Storage + Premium SSD 缓存
- **GCP**: Cloud Storage + Local SSD

**成本估算**：
- S3 存储（20 GB）：$0.46/月
- 本地 SSD 缓存（100 GB）：$10-15/月

#### 3.2.3 向量数据库服务
**托管服务选项**：
- **Pinecone**：$70/月起（100K 向量，1536 维）
- **Weaviate Cloud**：$25/月起（100K 向量）
- **Qdrant Cloud**：$95/月起（1M 向量）

**自建 vs 托管权衡**：
- **自建 FAISS**（推荐）：
  - 优势：完全免费（仅存储成本）、完全控制
  - 劣势：需自行管理、无托管特性（分布式、高可用）
- **托管服务**：
  - 优势：开箱即用、自动扩展、监控告警
  - 劣势：成本高、供应商锁定

### 3.3 数据库服务需求

#### 3.3.1 Letta SQLite 存储
**存储需求**：
- 每个代理状态：10-50 MB
- 100 个实验：1-5 GB

**推荐方案**：
- **开发环境**：本地 SQLite 文件
- **生产环境**：SQLite on EBS + S3 定期备份

**备份脚本**：
```bash
# 每小时备份到 S3
*/60 * * * * aws s3 cp ~/.letta/sqlite.db s3://bucket/backups/sqlite-$(date +\%Y\%m\%d-\%H\%M).db
```

#### 3.3.2 关系型数据库（可选升级）
**场景**：多用户协作、并发实验

**推荐服务**：
- **AWS RDS PostgreSQL**: db.t3.small（2 vCPU，2 GB）
- **Azure Database for PostgreSQL**: Basic B1ms（1 vCPU，2 GB）
- **GCP Cloud SQL**: db-f1-micro（共享 vCPU，0.6 GB）

**成本估算**：$15-30/月

**配置 Letta 使用 PostgreSQL**：
```python
from letta import create_client

client = create_client(
    base_url="postgresql://user:pass@host:5432/letta_db"
)
```

#### 3.3.3 图数据库（HippoRAG/Zep）
**托管服务选项**：
- **AWS Neptune**：db.r5.large 起，约 $200/月
- **Azure Cosmos DB (Gremlin API)**：400 RU/s 起，约 $24/月
- **Neo4j Aura**：$65/月起（8 GB 内存）

**自建方案**：
- 使用 igraph（Python 库）+ 本地存储（推荐）
- 成本：仅计算实例费用

**实际使用**：
- HippoRAG：igraph 本地图，序列化到磁盘
- Zep：通过 API 使用托管图服务

### 3.4 实验结果存储

#### 3.4.1 JSON 结果文件
**存储需求**：
- 单个实验结果：1-10 MB（含详细 metrics）
- 100 个实验：100 MB - 1 GB
- 一年实验累积：5-20 GB

**推荐方案**：
- **S3 Standard-IA**（不常访问）：$0.0125/GB/月
- 成本：$0.25-2.50/月

#### 3.4.2 检索上下文缓存
**存储位置**：`./outputs/rag_retrieved/`

**存储需求**：
- 每个查询：10-100 KB（检索的段落）
- 1000 个查询：10-100 MB
- 大规模评估（10K 查询）：100 MB - 1 GB

**清理策略**：
- 定期删除 30 天前的缓存
- 仅保留聚合结果，删除详细检索日志

#### 3.4.3 日志和监控数据
**存储需求**：
- 应用日志：约 10-50 MB/天
- API 调用日志：约 5-20 MB/天
- 系统指标（CloudWatch/Stackdriver）：约 1-5 GB/月

**推荐服务**：
- **AWS CloudWatch Logs**：$0.50/GB 摄取 + $0.03/GB 存储
- **GCP Cloud Logging**：前 50 GB/月免费
- **Elastic Stack (自建)**：需额外计算资源

**成本估算**：$10-30/月

## 第四节：网络与 API 成本

### 4.1 LLM API 调用成本

#### 4.1.1 OpenAI API
**定价（2026 年 1 月）**：
- **GPT-4o**：
  - Input: $2.50 / 1M tokens
  - Output: $10.00 / 1M tokens
- **GPT-4.1-mini**：
  - Input: $0.40 / 1M tokens
  - Output: $1.20 / 1M tokens
- **o4-mini**：
  - Input: $1.10 / 1M tokens
  - Output: $4.40 / 1M tokens
- **Text-Embedding-3-Small**：$0.02 / 1M tokens
- **Text-Embedding-3-Large**：$0.13 / 1M tokens

**典型实验成本（EventQA 64K，5 样本 x 10 查询）**：
- **GPT-4o 长上下文**：
  - Input: 50 queries x 65K tokens x $2.50/1M = $8.13
  - Output: 50 x 40 tokens x $10/1M = $0.02
  - 总计：~$8.15

- **GPT-4.1-mini RAG**：
  - Embedding: 150 chunks x 4096 tokens x $0.02/1M = $0.012
  - Input: 50 x (10 chunks x 4096 + 200) tokens x $0.40/1M = $0.82
  - Output: 50 x 40 tokens x $1.20/1M = $0.0024
  - 总计：~$0.83

**月度成本估算（20 数据集 x 5 方法）**：
- 仅长上下文方法：$500-800
- 混合 RAG 方法：$200-400
- 完整评估矩阵：$800-1500

**优化策略**：
1. **使用更小模型**：GPT-4.1-mini 替代 GPT-4o（节省 80%）
2. **批量请求**：使用 Batch API（节省 50%，但延迟增加 24 小时）
3. **缓存结果**：相同查询避免重复调用
4. **Azure OpenAI**：长期合同可获企业折扣（10-30%）

#### 4.1.2 Anthropic API
**定价**：
- **Claude 3.7 Sonnet**：
  - Input: $3.00 / 1M tokens
  - Output: $15.00 / 1M tokens

**成本对比**：
- 比 GPT-4o 贵 20%
- 优势：更长上下文窗口（200K vs 128K）、更好推理能力

**推荐使用场景**：
- 需要超长上下文（> 128K）
- 对准确性要求极高的关键实验

#### 4.1.3 Google Gemini API
**定价**：
- **Gemini 2.0 Flash**：
  - Input: $0.075 / 1M tokens（≤ 128K 上下文）
  - Input: $0.15 / 1M tokens（> 128K 上下文）
  - Output: $0.30 / 1M tokens

**成本优势**：
- 比 GPT-4o 便宜 97%（短上下文）
- 比 GPT-4o 便宜 94%（长上下文）

**性能权衡**：
- 准确性略低于 GPT-4o/Claude（约 5-10%）
- 适合成本敏感的大规模评估

#### 4.1.4 LLM 判断器成本
**GPT-4o Judge 评估**：
- LongmemEval: 约 $0.05-0.10 per 查询
- InfBench 摘要（五维度）：约 $0.20-0.40 per 查询

**总成本估算**：
- 100 个查询 LLM 评估：$5-40
- 1000 个查询：$50-400

**替代方案**：
- **GPT-4.1-mini Judge**：成本降低 80%，准确性轻微下降
- **本地 LLM Judge**（LLaMA 3 70B）：无 API 成本，需 GPU

### 4.2 嵌入 API 成本

#### 4.2.1 OpenAI Embeddings
**使用场景**：RAG 方法中的文档嵌入

**成本示例（EventQA 64K）**：
- 150 chunks x 4096 tokens = 614K tokens
- Text-Embedding-3-Small: $0.012
- Text-Embedding-3-Large: $0.080

**月度成本（20 数据集）**：
- Small: $0.24
- Large: $1.60

**策略建议**：
- 优先使用 Text-Embedding-3-Small（性价比高）
- 缓存嵌入结果避免重复计算（节省 > 90%）

#### 4.2.2 本地嵌入模型
**优势**：
- 无 API 成本
- 无网络延迟
- 无请求限流

**劣势**：
- 需要 GPU 实例（g4dn.xlarge: $252/月）
- 更长的嵌入时间（2-5 倍）

**成本平衡点**：
- 如果每月嵌入 token 数 > 10B，本地模型更经济
- 否则，API 模式更划算

### 4.3 网络传输成本

#### 4.3.1 跨区域传输
**AWS 定价**：
- Internet 出站：$0.09/GB（前 10 TB/月）
- 区域间（如 us-east-1 到 us-west-2）：$0.02/GB

**典型流量**：
- 下载数据集：5 GB（一次性）
- 上传结果：1-5 GB/月
- API 请求/响应：< 1 GB/月

**月度成本**：约 $0.50-1.00

#### 4.3.2 API 限流考虑
**OpenAI 限流（Tier 4，付费用户）**：
- GPT-4o: 10,000 RPM，30M TPM
- GPT-4.1-mini: 30,000 RPM，200M TPM

**实际影响**：
- 单实例运行：无限流问题
- 并行 10+ 实例：可能触发 TPM 限制

**解决方案**：
1. 请求队列和重试机制
2. 升级到更高 Tier（Tier 5: 80M TPM）
3. 使用 Azure OpenAI（独立限流配额）

#### 4.3.3 内网传输优化
**推荐架构**：
- 计算实例和存储在同一区域/可用区
- 使用 VPC 内网传输（免费）
- 避免跨区域数据同步

## 第五节：容器化与编排

### 5.1 Docker 容器化

#### 5.1.1 Dockerfile 设计
```dockerfile
# 多阶段构建减小镜像体积
FROM nvidia/cuda:12.1.0-cudnn8-runtime-ubuntu22.04 AS base

# 安装 Python 和系统依赖
RUN apt-get update && apt-get install -y \
    python3.10 python3-pip git wget \
    && rm -rf /var/lib/apt/lists/*

# 创建工作目录
WORKDIR /app

# 复制依赖文件并安装
COPY requirements.txt .
RUN pip install --no-cache-dir torch torchvision \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir "numpy<2"

# 复制应用代码
COPY . .

# 设置环境变量
ENV PYTHONUNBUFFERED=1

# 入口点
ENTRYPOINT ["python", "main.py"]
```

**镜像大小优化**：
- 基础镜像：~8 GB（CUDA runtime）
- 加 PyTorch：~12 GB
- 加所有依赖：~15 GB

**优化技巧**：
- 使用 `.dockerignore` 排除无关文件
- 多阶段构建分离构建和运行环境
- 使用轻量级基础镜像（alpine 不兼容 CUDA）

#### 5.1.2 镜像存储
**推荐服务**：
- **AWS ECR**：$0.10/GB/月（存储）+ 数据传输费用
- **Azure Container Registry**：Basic $5/月（10 GB 存储）
- **Docker Hub**：免费（公开仓库）或 $5/月（私有仓库）

**成本估算**：
- 单镜像（15 GB）：$1.50/月（ECR）
- 多版本（3 个版本）：$4.50/月

**镜像管理策略**：
- 标记版本（如 `v1.0`, `latest`）
- 定期清理旧版本（保留最近 3 个）
- 使用镜像扫描工具检测漏洞

### 5.2 Kubernetes 编排

#### 5.2.1 集群配置
**推荐服务**：
- **AWS EKS**：$0.10/小时（控制平面）+ 工作节点成本
- **Azure AKS**：免费控制平面 + 工作节点成本
- **GCP GKE**：$0.10/小时（控制平面）+ 工作节点成本

**小型集群配置**：
- 控制平面：1 节点（托管）
- CPU 工作节点：2x t3.xlarge（4 vCPU 各）
- GPU 工作节点：1x g4dn.xlarge（按需）

**月度成本**：
- 控制平面：$72（EKS/GKE）或 $0（AKS）
- 工作节点：$240（CPU）+ $250（GPU，按需使用）
- 总计：$312-562/月

#### 5.2.2 任务定义（Kubernetes Job）
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: memory-agent-bench-eventqa
spec:
  parallelism: 4  # 并行 4 个 pod
  completions: 20  # 总共 20 个任务
  template:
    spec:
      containers:
      - name: eval
        image: your-registry/memory-agent-bench:latest
        command:
          - python
          - main.py
          - --agent_config
          - /configs/rag_bm25.yaml
          - --dataset_config
          - /configs/eventqa_64k.yaml
        resources:
          requests:
            memory: "8Gi"
            cpu: "2"
          limits:
            memory: "16Gi"
            cpu: "4"
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-keys
              key: openai
      restartPolicy: OnFailure
```

#### 5.2.3 自动扩缩容
**Horizontal Pod Autoscaler (HPA)**：
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: eval-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: memory-agent-bench
  minReplicas: 1
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

**集群自动扩展（Cluster Autoscaler）**：
- 根据 pod 资源请求自动添加/移除节点
- 成本优化：空闲时缩减到最小节点数

### 5.3 AWS Batch 批处理

#### 5.3.1 批处理队列配置
**优势**：
- 无需管理 Kubernetes 集群
- 自动资源调度
- 更简单的配置

**配置示例**：
```json
{
  "computeEnvironment": {
    "type": "MANAGED",
    "computeResources": {
      "type": "EC2",
      "allocationStrategy": "BEST_FIT_PROGRESSIVE",
      "minvCpus": 0,
      "maxvCpus": 256,
      "desiredvCpus": 0,
      "instanceTypes": ["optimal"],
      "subnets": ["subnet-xxx"],
      "securityGroupIds": ["sg-xxx"],
      "instanceRole": "ecsInstanceRole"
    }
  },
  "jobQueue": {
    "priority": 1,
    "computeEnvironmentOrder": [
      {"order": 1, "computeEnvironment": "memory-agent-bench-ce"}
    ]
  }
}
```

#### 5.3.2 作业数组（Job Arrays）
```bash
aws batch submit-job \
  --job-name memory-agent-bench-eval \
  --job-queue eval-queue \
  --job-definition memory-agent-bench:1 \
  --array-properties size=20 \
  --container-overrides '{
    "command": [
      "python", "main.py",
      "--agent_config", "Ref::agent_config",
      "--dataset_config", "Ref::dataset_config"
    ],
    "environment": [
      {"name": "AWS_BATCH_JOB_ARRAY_INDEX", "value": "Ref::AWS_BATCH_JOB_ARRAY_INDEX"}
    ]
  }'
```

**成本优势**：
- 使用 Spot 实例（节省 70%）
- 自动选择最便宜的实例类型
- 空闲时无成本（minvCpus=0）

#### 5.3.3 Spot vs On-Demand 策略
**Spot 实例特点**：
- 成本节省：60-90%
- 中断风险：2-5% 的中断率
- 2 分钟提前通知

**推荐策略**：
- 短任务（< 30 分钟）：100% Spot
- 中等任务（30-120 分钟）：80% Spot + 20% On-Demand
- 长任务（> 2 小时）：50% Spot + 50% On-Demand

**中断处理**：
```python
import signal

def checkpoint_handler(signum, frame):
    """保存当前进度"""
    save_results_to_file(output_path, results, metrics)
    sys.exit(0)

signal.signal(signal.SIGTERM, checkpoint_handler)
```

## 第六节：监控与可观测性

### 6.1 应用性能监控（APM）

#### 6.1.1 关键指标
**实验级别**：
- 任务完成率（Completion Rate）
- 平均运行时间（Avg Runtime）
- 失败率和错误类型（Failure Rate & Errors）

**查询级别**：
- 查询延迟（Query Latency）：P50, P95, P99
- Token 使用量（Token Usage）
- 记忆构建时间（Memory Construction Time）

**系统级别**：
- CPU 利用率（CPU Utilization）
- 内存使用率（Memory Usage）
- GPU 利用率（GPU Utilization，如果适用）
- 磁盘 I/O（Disk I/O）

#### 6.1.2 监控工具选择
**云原生服务**：
- **AWS CloudWatch**：
  - 免费层：10 个指标，5 GB 日志
  - 成本：$0.30/指标/月 + $0.50/GB 日志摄取
  - 集成：Lambda, ECS, EC2 等

- **Azure Monitor**：
  - 免费层：前 5 GB 日志
  - 成本：$2.30/GB 日志（超出后）
  - 集成：Azure 全栈服务

- **GCP Cloud Monitoring**：
  - 免费层：前 150 MB 指标，50 GB 日志
  - 成本：$0.2580/MB 指标（超出后）
  - 集成：GKE, Compute Engine 等

**开源方案**：
- **Prometheus + Grafana**：
  - 成本：仅计算资源（约 $30-50/月小型部署）
  - 优势：灵活定制、社区丰富
  - 部署：自建 Kubernetes 或托管服务（Grafana Cloud）

**推荐方案**：
- **小规模（< 10 实例）**：CloudWatch/Azure Monitor（免费层足够）
- **中等规模（10-50 实例）**：Prometheus + Grafana
- **大规模（> 50 实例）**：Datadog/New Relic（托管 APM）

#### 6.1.3 自定义指标收集
```python
import boto3
import time

cloudwatch = boto3.client('cloudwatch')

def log_metric(metric_name, value, unit='None'):
    cloudwatch.put_metric_data(
        Namespace='MemoryAgentBench',
        MetricData=[
            {
                'MetricName': metric_name,
                'Value': value,
                'Unit': unit,
                'Timestamp': time.time()
            }
        ]
    )

# 在代码中使用
output = agent.send_message(query, memorizing=False)
log_metric('QueryLatency', output['query_time_len'], 'Seconds')
log_metric('InputTokens', output['input_len'], 'Count')
log_metric('OutputTokens', output['output_len'], 'Count')
```

### 6.2 成本追踪与优化

#### 6.2.1 成本分配标签（Tags）
**AWS 成本分配标签**：
```bash
aws ec2 create-tags \
  --resources i-1234567890abcdef0 \
  --tags Key=Project,Value=MemoryAgentBench \
         Key=Experiment,Value=EventQA-RAG \
         Key=CostCenter,Value=Research
```

**成本可视化**：
- AWS Cost Explorer：按标签筛选成本
- Azure Cost Management：成本趋势分析
- GCP Cost Table：按标签分组成本

#### 6.2.2 预算告警
**AWS Budgets 配置**：
```json
{
  "BudgetName": "MemoryAgentBench-Monthly",
  "BudgetLimit": {
    "Amount": "1000",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST",
  "CostFilters": {
    "TagKeyValue": ["user:Project$MemoryAgentBench"]
  },
  "Notifications": [
    {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80,
      "ThresholdType": "PERCENTAGE",
      "Subscribers": [
        {"SubscriptionType": "EMAIL", "Address": "team@example.com"}
      ]
    }
  ]
}
```

#### 6.2.3 成本优化建议
**自动化优化工具**：
- **AWS Cost Optimizer**：识别未使用资源
- **Azure Advisor**：提供成本节约建议
- **GCP Recommender**：推荐调整实例大小

**手动优化清单**：
- [ ] 删除未使用的 EBS 卷/持久磁盘
- [ ] 停止空闲的计算实例
- [ ] 使用 Reserved Instances（长期运行）
- [ ] 启用 Auto-Scaling（按需扩缩）
- [ ] 清理旧的容器镜像和快照
- [ ] 审查 S3/Blob 存储类别（迁移冷数据）

### 6.3 日志管理

#### 6.3.1 日志聚合架构
```
应用容器 → Fluentd/Fluent Bit → CloudWatch Logs / ELK Stack
                                    ↓
                          Grafana / Kibana 可视化
```

**配置示例（Fluentd）**：
```yaml
<source>
  @type tail
  path /var/log/memory-agent-bench/*.log
  pos_file /var/log/td-agent/memory-agent-bench.pos
  tag memory-agent-bench
  <parse>
    @type json
  </parse>
</source>

<match memory-agent-bench>
  @type cloudwatch_logs
  log_group_name /memory-agent-bench/app
  log_stream_name ${hostname}
  auto_create_stream true
</match>
```

#### 6.3.2 日志保留策略
**建议保留期**：
- **应用日志**：30 天（调试和审计）
- **API 调用日志**：90 天（成本分析）
- **错误日志**：180 天（问题追踪）
- **审计日志**：1 年（合规要求）

**自动清理**：
```bash
# AWS CloudWatch Logs 保留策略
aws logs put-retention-policy \
  --log-group-name /memory-agent-bench/app \
  --retention-in-days 30
```

**成本节省**：
- 30 天保留 vs 永久保留：节省约 60% 存储成本

#### 6.3.3 日志查询示例
**CloudWatch Insights 查询**：
```sql
-- 查找所有失败的实验
fields @timestamp, experiment_id, error_message
| filter status = "failed"
| sort @timestamp desc
| limit 20

-- 统计每个方法的平均查询时间
stats avg(query_time_len) by agent_name
| sort avg(query_time_len) desc

-- 识别 Token 使用最多的查询
fields @timestamp, query_id, input_len, output_len
| sort input_len desc
| limit 10
```

### 6.4 告警与事件响应

#### 6.4.1 关键告警规则
**高优先级告警**：
1. **实验失败率 > 20%**
   - 条件：最近 1 小时内失败次数 / 总次数 > 0.2
   - 通知：邮件 + Slack

2. **API 错误率激增**
   - 条件：5 分钟内 API 5xx 错误 > 10 次
   - 通知：邮件 + PagerDuty

3. **成本超预算**
   - 条件：当月累计成本 > 预算的 90%
   - 通知：邮件（财务团队）

**中优先级告警**：
1. **查询延迟 P95 > 10 秒**
2. **磁盘使用率 > 80%**
3. **GPU 利用率 < 20%**（资源浪费）

**配置示例（CloudWatch Alarm）**：
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name high-failure-rate \
  --alarm-description "实验失败率超过 20%" \
  --metric-name FailureRate \
  --namespace MemoryAgentBench \
  --statistic Average \
  --period 3600 \
  --threshold 20 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:123456789:alerts
```

#### 6.4.2 事件响应流程
**自动化响应**：
1. 告警触发 → Lambda 函数执行
2. 分析错误日志
3. 尝试自动修复（重启实例、清理磁盘）
4. 如果失败，升级到人工处理

**人工响应 Runbook**：
- **API 限流**：切换到备用 API 密钥或降低请求速率
- **OOM 错误**：增加实例内存或减少批大小
- **数据库锁定**：重启服务，检查并发配置

## 第七节：安全与合规

### 7.1 API 密钥管理

#### 7.1.1 密钥存储最佳实践
**不推荐**：
- ❌ 硬编码在代码中
- ❌ 提交到 Git 仓库
- ❌ 明文存储在配置文件

**推荐方案**：
- **AWS Secrets Manager**：
  - 成本：$0.40/密钥/月 + $0.05/10K API 调用
  - 自动轮换支持

- **Azure Key Vault**：
  - 成本：$0.03/10K 操作（标准层）
  - 与 Azure 服务集成

- **GCP Secret Manager**：
  - 成本：$0.06/10K 访问操作
  - 版本控制和审计

**代码示例（AWS Secrets Manager）**：
```python
import boto3
import json

def get_api_key(secret_name):
    client = boto3.client('secretsmanager', region_name='us-east-1')
    response = client.get_secret_value(SecretId=secret_name)
    secret = json.loads(response['SecretString'])
    return secret['OPENAI_API_KEY']

# 使用
api_key = get_api_key('memory-agent-bench/api-keys')
client = OpenAI(api_key=api_key)
```

#### 7.1.2 IAM 权限最小化
**原则**：仅授予必需权限

**示例 IAM 策略（AWS）**：
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::memory-agent-bench-data/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:123456789:secret:memory-agent-bench/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:us-east-1:123456789:log-group:/memory-agent-bench/*"
    }
  ]
}
```

### 7.2 数据安全

#### 7.2.1 传输加密
- **HTTPS/TLS**：所有 API 调用默认使用
- **VPC 内网**：敏感数据库通信限制在私有网络
- **VPN/PrivateLink**：生产环境访问控制

#### 7.2.2 存储加密
**S3 加密**：
- **SSE-S3**：AWS 管理密钥（免费）
- **SSE-KMS**：客户管理密钥（$1/月 + 使用费）

**EBS 加密**：
- 创建实例时启用：`--block-device-mappings "Encrypted=true"`
- 成本：无额外费用

#### 7.2.3 数据脱敏
**日志脱敏**：
```python
import re

def sanitize_log(log_message):
    # 移除 API 密钥
    log_message = re.sub(r'sk-[a-zA-Z0-9]{20,}', 'sk-***', log_message)
    # 移除邮箱
    log_message = re.sub(r'\b[\w\.-]+@[\w\.-]+\.\w+\b', '***@***', log_message)
    return log_message
```

### 7.3 合规考虑

#### 7.3.1 数据驻留
**GDPR（欧盟）**：
- 数据存储和处理在 EU 区域（如 eu-west-1）
- API 调用使用欧洲端点

**CCPA（加州）**：
- 提供数据删除机制
- 审计日志保留

#### 7.3.2 审计日志
**CloudTrail（AWS）启用**：
```bash
aws cloudtrail create-trail \
  --name memory-agent-bench-audit \
  --s3-bucket-name audit-logs-bucket
```

**记录内容**：
- 所有 API 调用（AWS/Azure/GCP）
- 数据访问记录
- 配置变更历史

## 第八节：成本优化高级策略

### 8.1 预留实例与节省计划

#### 8.1.1 预留实例（Reserved Instances）
**适用场景**：长期运行的基础设施（> 6 个月）

**成本节省**：
- 1 年承诺：节省 30-40%
- 3 年承诺：节省 50-60%

**推荐购买**：
- RDS 数据库实例（如果使用）
- 固定的 CPU 实例（如构建服务器）

**计算示例**：
- t3.xlarge 按需：$121.44/月
- 1 年预留（部分预付）：$78.84/月（节省 $42.60）
- 3 年预留（全额预付）：$51.84/月（节省 $69.60）

#### 8.1.2 Savings Plans（AWS）
**灵活性更高**：
- 不绑定特定实例类型
- 适用于 EC2、Lambda、Fargate

**推荐策略**：
- 购买覆盖基准负载（如 50% 使用量）
- 峰值使用按需实例

### 8.2 Spot 实例最佳实践

#### 8.2.1 Spot Fleet 配置
```json
{
  "SpotFleetRequestConfig": {
    "AllocationStrategy": "price-capacity-optimized",
    "TargetCapacity": 20,
    "SpotPrice": "0.50",
    "LaunchSpecifications": [
      {
        "InstanceType": "t3.xlarge",
        "SpotPrice": "0.036",
        "WeightedCapacity": 4
      },
      {
        "InstanceType": "t3a.xlarge",
        "SpotPrice": "0.032",
        "WeightedCapacity": 4
      },
      {
        "InstanceType": "t2.xlarge",
        "SpotPrice": "0.038",
        "WeightedCapacity": 4
      }
    ]
  }
}
```

**关键参数**：
- **AllocationStrategy**: `price-capacity-optimized`（最佳成本和可用性平衡）
- **多实例类型**：提高可用性
- **加权容量**：根据性能调整

#### 8.2.2 中断处理策略
**CloudWatch Events 监听**：
```json
{
  "source": ["aws.ec2"],
  "detail-type": ["EC2 Spot Instance Interruption Warning"],
  "detail": {
    "instance-id": ["i-1234567890abcdef0"]
  }
}
```

**Lambda 响应函数**：
1. 接收中断通知（提前 2 分钟）
2. 保存当前实验状态到 S3
3. 标记任务为"待恢复"
4. 在新实例上重启任务

### 8.3 无服务器架构优化

#### 8.3.1 Lambda 评估器
**场景**：轻量级评估任务（如指标计算）

**配置**：
```python
# lambda_function.py
import json
from utils.eval_other_utils import metrics_summarization

def lambda_handler(event, context):
    output = event['agent_output']
    query = event['query']
    answer = event['answer']

    metrics, results = metrics_summarization(output, query, answer, {}, {}, {}, 0)

    return {
        'statusCode': 200,
        'body': json.dumps({'metrics': metrics, 'results': results})
    }
```

**成本对比**：
- **EC2 t3.micro 24/7**：$7.50/月
- **Lambda（1M 调用，每次 512 MB-s）**：$0.83/月

**适用场景**：
- 短时间任务（< 15 分钟）
- 低频调用（< 100K/月）
- 无状态处理

#### 8.3.2 Fargate vs EC2
**Fargate 优势**：
- 无需管理服务器
- 按实际使用付费（秒级）
- 快速启动（< 1 分钟）

**成本对比（4 vCPU，8 GB 内存）**：
- **EC2 t3.xlarge**：$121.44/月（24/7）
- **Fargate**：$177.12/月（24/7）或 $5.90/天（8 小时/天）

**推荐使用**：
- 短时间实验（< 8 小时/天）：Fargate 更经济
- 长时间运行：EC2 更便宜

### 8.4 数据传输成本优化

#### 8.4.1 CloudFront CDN 缓存
**场景**：频繁下载的数据集

**成本节省**：
- 直接从 S3 下载：$0.09/GB
- 通过 CloudFront：$0.085/GB（10 TB 内）+ 边缘缓存减少源站流量

**适用条件**：
- 数据集 > 1 GB
- 访问频率 > 10 次/天
- 多地域访问

#### 8.4.2 S3 Transfer Acceleration
**场景**：跨国上传大文件

**成本**：额外 $0.04/GB（美国）或 $0.08/GB（欧洲/亚洲）

**加速效果**：50-500% 速度提升（取决于地理位置）

## 第九节：灾难恢复与业务连续性

### 9.1 备份策略

#### 9.1.1 数据备份
**关键数据**：
- 数据集（HuggingFace + 自定义）
- 实验结果 JSON
- 代理状态（Letta SQLite、向量索引）
- 配置文件

**备份频率**：
- 数据集：每周（变更少）
- 实验结果：每日（增量备份）
- 代理状态：每次实验后（自动）

**备份目标**：
- **主存储**：S3 Standard（日常访问）
- **备份存储**：S3 Glacier Deep Archive（$0.00099/GB/月）
- **跨区域复制**：S3 CRR 到其他区域（合规/灾备）

#### 9.1.2 自动备份脚本
```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d)
S3_BUCKET="s3://memory-agent-bench-backups"

# 备份实验结果
aws s3 sync ./outputs/ $S3_BUCKET/results/$DATE/ \
  --storage-class GLACIER_DEEP_ARCHIVE

# 备份代理状态
tar -czf agents-$DATE.tar.gz ./agents/
aws s3 cp agents-$DATE.tar.gz $S3_BUCKET/agents/

# 清理本地
find ./outputs/ -type f -mtime +30 -delete
rm agents-$DATE.tar.gz
```

**定时任务（Cron）**：
```cron
0 2 * * * /path/to/backup.sh
```

### 9.2 多区域部署

#### 9.2.1 主备架构
**主区域**（Active）：us-east-1
- 运行所有实验
- 存储主数据

**备区域**（Standby）：us-west-2
- 数据实时复制
- 故障时接管

**成本**：
- S3 跨区域复制：$0.02/GB
- 备区域保持最小实例（$10-20/月）

#### 9.2.2 故障切换流程
1. 检测主区域故障（HealthCheck 失败）
2. Route 53 自动切换 DNS 到备区域
3. 备区域实例自动扩展
4. 从 S3 恢复最新数据
5. 恢复实验执行

**RTO（恢复时间目标）**：< 15 分钟
**RPO（恢复点目标）**：< 1 小时

### 9.3 版本控制与回滚

#### 9.3.1 代码版本管理
**Git 分支策略**：
- `main`: 稳定生产版本
- `dev`: 开发分支
- `exp/*`: 实验性功能分支

**版本标签**：
```bash
git tag -a v1.0.0 -m "ICLR 2026 提交版本"
git push origin v1.0.0
```

#### 9.3.2 Docker 镜像版本
**语义化版本**：
- `v1.0.0`: 主版本（破坏性变更）
- `v1.1.0`: 次版本（新功能）
- `v1.1.1`: 补丁版本（bug 修复）

**回滚命令**：
```bash
# Kubernetes 回滚到上一版本
kubectl rollout undo deployment/memory-agent-bench

# 手动指定版本
kubectl set image deployment/memory-agent-bench \
  eval=your-registry/memory-agent-bench:v1.0.0
```

## 第十节：云成本总览与决策矩阵

### 10.1 配置方案对比

#### 10.1.1 最小可行配置（$150-300/月）
**适用场景**：
- 小规模实验（< 5 数据集）
- 仅使用长上下文代理
- 单人研究者

**资源配置**：
- 计算：1x t3.xlarge（按需，每天 8 小时）
- 存储：S3 Standard 10 GB + EBS 50 GB
- API：OpenAI GPT-4.1-mini（约 20M tokens/月）

**成本明细**：
- 计算：$60（EC2 Spot 折扣后）
- 存储：$2
- API：$100-150
- 网络：$5
- **总计：$167-217/月**

#### 10.1.2 标准研究配置（$500-1000/月）
**适用场景**：
- 中等规模评估（10-20 数据集）
- 包含 RAG 方法（BM25, 嵌入检索）
- 2-3 人团队协作

**资源配置**：
- 计算：2x t3.xlarge + 1x g4dn.xlarge（Spot）
- 存储：S3 Standard 50 GB + EBS 100 GB + EFS 50 GB
- API：OpenAI（50M tokens）+ Azure OpenAI（备用）
- 数据库：RDS PostgreSQL t3.small（可选）

**成本明细**：
- 计算：$180（CPU Spot）+ $80（GPU Spot）
- 存储：$5（S3）+ $10（EBS）+ $15（EFS）
- API：$350-500
- 数据库：$20
- 网络：$15
- **总计：$675-825/月**

#### 10.1.3 完整科研配置（$2000-5000/月）
**适用场景**：
- 大规模基准测试（50+ 数据集组合）
- 所有方法（包括 HippoRAG, Letta, Cognee）
- 发表论文需要完整实验矩阵

**资源配置**：
- 计算：EKS 集群（2-10 节点自动扩展）
- GPU：4x g5.xlarge（A10G，按需）
- 存储：S3 Standard 200 GB + S3 Glacier 1 TB（历史数据）
- API：OpenAI + Anthropic + Google（200M tokens）
- 数据库：RDS PostgreSQL m5.large + ElastiCache Redis
- 监控：Datadog Pro

**成本明细**：
- 计算：$400（EKS + CPU 节点）+ $600（GPU 实例）
- 存储：$20（S3 Standard）+ $10（S3 Glacier）+ $50（EBS/EFS）
- API：$2000-3000
- 数据库：$150（RDS）+ $50（Redis）
- 监控：$150（Datadog）
- 网络：$100
- **总计：$3530-4530/月**

### 10.2 决策树

```
开始评估云需求
    │
    ├─ 实验规模？
    │   ├─ 小（< 5 数据集）→ 最小配置（$150-300）
    │   ├─ 中（5-20 数据集）→ 标准配置（$500-1000）
    │   └─ 大（> 20 数据集）→ 完整配置（$2000-5000）
    │
    ├─ 使用方法？
    │   ├─ 仅长上下文 → 仅需 CPU + API（无 GPU）
    │   ├─ RAG（BM25/嵌入）→ CPU + GPU（Spot）
    │   └─ 知识图谱（HippoRAG/Cognee）→ 高配 GPU + 大内存
    │
    ├─ 运行频率？
    │   ├─ 偶尔（< 8h/天）→ Fargate/按需实例
    │   ├─ 常规（8-16h/天）→ 按需实例 + Spot 混合
    │   └─ 持续（24/7）→ 预留实例 + Spot
    │
    ├─ 成本敏感度？
    │   ├─ 高敏感 → 优先 Spot + 小模型（GPT-4.1-mini/Gemini）
    │   ├─ 中等 → 按需实例 + 混合模型
    │   └─ 低敏感 → 按需实例 + 最佳模型（GPT-4o/Claude）
    │
    └─ 团队规模？
        ├─ 单人 → 简单架构（单区域，最小监控）
        ├─ 小团队（2-5 人）→ 标准架构（共享存储，基础监控）
        └─ 大团队（> 5 人）→ 企业架构（K8s，完整监控，多区域）
```

### 10.3 长期成本预测

#### 10.3.1 成本增长模型
**假设**：
- 每月新增 3 个数据集
- 每季度新增 2 种记忆方法
- 实验重复次数：3 次（统计显著性）

**年度成本预测（标准配置起点）**：
- **Q1**：$6000-9000（基准）
- **Q2**：$8000-12000（+33% 数据集）
- **Q3**：$10000-15000（+67% 数据集 + 新方法）
- **Q4**：$12000-18000（+100% 数据集 + 论文冲刺）
- **年总计**：$36000-54000

#### 10.3.2 成本优化路线图
**0-3 个月**（初期）：
- 使用按需实例，灵活调整
- 关注功能实现，成本次要

**3-6 个月**（稳定期）：
- 购买预留实例（1 年期）
- 启用 Spot Fleet（节省 60%）
- 优化 API 调用（缓存、批量）

**6-12 个月**（优化期）：
- 考虑自建嵌入模型（如果月嵌入 token > 100M）
- 迁移冷数据到 Glacier（节省 90% 存储成本）
- 建立 cost-per-experiment 指标，持续优化

### 10.4 云服务提供商选择

#### 10.4.1 AWS 优势
- **生态完善**：SageMaker、Batch、Lambda 等丰富服务
- **Spot 市场**：最成熟的 Spot 实例市场
- **OpenAI 集成**：与 Azure OpenAI 无缝集成

**推荐场景**：首选平台，最适合本项目

#### 10.4.2 Azure 优势
- **Azure OpenAI**：独占 OpenAI 官方企业版，无公共 API 限流
- **混合云**：适合有本地基础设施的机构

**推荐场景**：OpenAI API 限流严重时的备选

#### 10.4.3 GCP 优势
- **价格竞争力**：某些服务比 AWS 便宜 10-30%
- **Preemptible VM**：类似 Spot，但更稳定（24 小时保证）
- **BigQuery**：强大的日志分析能力

**推荐场景**：成本优化优先，或已有 GCP 学术积分

#### 10.4.4 多云策略
**推荐配置**：
- **主平台（AWS）**：运行 80% 实验
- **备份平台（Azure）**：OpenAI API 限流时切换
- **成本优化（GCP）**：非关键、长时间运行任务

**管理工具**：
- Terraform：跨云基础设施即代码
- Kubernetes：跨云容器编排
- Prometheus：统一监控

---

**文档版本**：v1.0
**最后更新**：2026-02-12
**维护者**：MemoryAgentBench 云架构团队
**联系方式**：通过 GitHub Issues 提问

**参考资源**：
- AWS 定价计算器：https://calculator.aws/
- Azure 定价计算器：https://azure.microsoft.com/en-us/pricing/calculator/
- GCP 定价计算器：https://cloud.google.com/products/calculator
- OpenAI API 定价：https://openai.com/api/pricing/
