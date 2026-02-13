# 云服务需求重新分析总结

## 更新日期
2026-02-13

## 分析范围
对25个Agent Memory开源项目进行了全面的云服务需求重新分析，特别关注：
- 图数据库需求
- 对象存储需求（S3/OBS）
- GPU加速需求
- 其他云服务依赖

## 关键发现

### 1. 图数据库需求（6个项目）

| 项目 | 图数据库类型 | 是否必需 |
|------|------------|---------|
| **graphiti** | Neo4j/FalkorDB/Kuzu/Neptune | 必需 |
| **cognee** | Kuzu/Neo4j/Neptune | 必需 |
| **easymemory** | NetworkX+Neo4j | 必需 |
| **MemOS** | Neo4j/NebulaGraph/PolarDB/PostgreSQL | 必需 |
| **Memary** | Neo4j/FalkorDB | 必需 |
| **MemoryAgentBench** | igraph（内存图引擎） | 必需 |

**其他19个项目**：通过向量搜索、关系型数据库或Redis实现关系管理，不需要专用图数据库。

### 2. 对象存储需求

#### 必需对象存储（3个项目）
- **general-agentic-memory**: 数据集存储（HotpotQA等基准测试数据）
- **supermemory**: 文档存储核心功能（Cloudflare R2/华为OBS）
- **SimpleMem**: PDF存储、原始记忆备份

#### 推荐对象存储（11个项目）
- **mem0**: S3备份归档
- **cognee**: 文件存储（文档/图片/音频）+ 备份
- **MemOS**: 阿里云OSS/华为OBS用于静态文件和备份
- **LightMem**: 模型文件 + Qdrant备份（68-518GB）
- **locomo**: 检索模型 + 本地LLM（13-143GB）
- **LongMemEval**: LLM模型 + 数据集（150-1000GB，使用分层存储策略）
- **MemoryAgentBench**: 数据集 + 嵌入模型（70-220GB）
- **Memori**: 历史数据归档
- **memU**: 多模态资源存储
- **easymemory**: 可选备份
- **hindsight**: 可选备份

#### 可选对象存储（5个项目）
- **langgraph-redis**: 大型Checkpoint Blob外部存储
- **memory-agent**: 对话历史归档
- **ReMe**: 工作记忆的大型工具输出
- **beads**: 不需要（所有数据在Git）
- 其他项目：不需要

### 3. GPU需求

#### 必需GPU（3个项目）
- **LongMemEval**: 4-8x A100 40/80GB（Llama 70B推理）
- **LightMem**: T4/V100 16-24GB（vLLM + LLMlingua-2压缩）
- **MemoryAgentBench**: 2-4x A100（15+种记忆方法并行测试）

#### 推荐GPU（6个项目）
- **locomo**: GPU加速Contriever/BLIP推理（如使用API模型则不需要）
- **MemOS**: 可选NLI模型和本地嵌入加速
- **langgraph-redis**: 3-5倍向量化速度提升
- **general-agentic-memory**: BAAI/bge-m3 embedding推理加速
- **memU**: Embedding推理加速（Rust核心已优化CPU）
- **SimpleMem**: PyTorch推理加速

#### 不需要GPU（16个项目）
包括：graphiti, mem0, cognee, letta, Memary, hindsight, memtrace, supermemory, claude-mem, memory-agent, easymemory, beads, Memori, ReMe, A-MEM, Backboard-Locomo

### 4. 其他关键云服务

#### 强制云服务依赖
- **beads**: Git托管（GitHub/GitLab/Gitea/华为CodeArts Repo）
- **hindsight**: PostgreSQL + pgvector扩展
- **memtrace**: Arc时序数据库（可用华为GaussDB for Influx替代）
- **supermemory**:
  - Serverless计算（Cloudflare Workers/华为FunctionGraph）
  - Embedding API（Cloudflare Workers AI/华为ModelArts）
  - KV存储（Cloudflare KV/华为DCS Redis）
- **claude-mem**: Anthropic Claude Agent SDK

## 更新的项目（17个）

### 新增对象存储需求
1. mem0
2. cognee
3. MemOS
4. LightMem
5. locomo
6. LongMemEval
7. MemoryAgentBench
8. general-agentic-memory
9. SimpleMem

### 更新GPU需求
1. LightMem（更新为必需）
2. locomo（更新为推荐）
3. LongMemEval（确认必需）
4. MemoryAgentBench（确认必需）
5. MemOS（更新为可选）

### 新增其他云服务
1. beads（Git托管）
2. hindsight（PostgreSQL+pgvector）
3. memtrace（Arc时序数据库）
4. supermemory（5个强制云服务）
5. claude-mem（Claude Agent SDK）
6. MemoryAgentBench（igraph图引擎）

## 华为云部署影响

### 图数据库挑战
- 华为云无托管Neo4j服务，需自建Neo4j on ECS或使用GaussDB/GES替代
- 推荐方案：自建Neo4j on ECS (Docker Compose) 或使用PolarDB适配器
- 月成本增加：¥600-1200（自建Neo4j ECS实例）

### 对象存储方案
- 使用华为云OBS（S3兼容API）
- 大多数项目已有S3集成，仅需更改endpoint配置
- 月成本：¥0.12/GB（标准存储）

### GPU/NPU适配
- 大部分项目无GPU需求或GPU为可选
- 3个必需GPU的项目可使用华为云GPU实例或昇腾NPU实例
- NPU迁移工作量：1-2周（替换CUDA依赖为torch-npu）

### 成本估算
- **小规模部署**：对象存储和图数据库增加10-20%成本
- **大规模部署**：规模经济效应，增加5-10%成本
- **对象存储分层策略**：使用冷存储可节省70%存储成本

## 数据完整性验证

所有25个项目的meta.json文件已更新，包含：
- ✅ storage_detail.graph_database（图数据库需求）
- ✅ storage_detail.object_storage（对象存储需求）
- ✅ compute_detail.gpu（GPU需求详情）
- ✅ external_services（外部服务依赖）
- ✅ huawei_cloud.recommended_services（华为云服务推荐）
- ✅ huawei_cloud.cost_estimation（成本估算）

## 后续行动

1. ✅ 所有meta.json已更新
2. 📝 需要重新生成aggregated数据（云服务汇总统计）
3. 🌐 网站可能需要更新以展示新的云服务需求信息
4. 📊 可考虑添加云服务需求筛选功能到网站
