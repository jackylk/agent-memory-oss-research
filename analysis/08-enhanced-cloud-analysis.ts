/**
 * 增强的云服务需求和昇腾NPU兼容性分析
 *
 * 分析内容：
 * 1. 详细的数据存储和处理服务需求
 * 2. 昇腾NPU兼容性判断
 * 3. 华为云适配性评估
 *
 * 试点项目：mem0, letta, hindsight
 */

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-5-20250929';
const DATA_DIR = path.join(process.cwd(), '..', 'data');
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');

// 试点分析的项目
const PILOT_PROJECTS = ['mem0', 'letta', 'hindsight'];

interface AnalysisResult {
  project_name: string;
  analysis: any;
  enhanced_cloud_needs: any;
}

async function analyzeProject(projectName: string): Promise<AnalysisResult> {
  console.log(`\n📊 开始分析项目: ${projectName}`);

  const projectPath = path.join(PROJECTS_DIR, projectName);
  const repoPath = path.join(projectPath, 'repo');
  const metaPath = path.join(projectPath, 'meta.json');

  // 读取现有meta.json
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

  // 收集代码文件信息
  const codeInfo = await collectCodeInfo(repoPath);

  // 构建分析提示词
  const prompt = `
你是一位云计算和AI基础设施专家。请深入分析以下Agent Memory项目的云服务需求、昇腾NPU兼容性和华为云适配性。

# 项目信息
- 名称: ${projectName}
- 描述: ${meta.description}
- 主要语言: ${meta.primary_language}
- Stars: ${meta.stars}

# 现有架构分析
${fs.readFileSync(path.join(projectPath, 'architecture.md'), 'utf-8')}

# 代码库信息
${JSON.stringify(codeInfo, null, 2)}

---

请提供以下维度的深度分析（以JSON格式输出）：

## 1. 详细的数据存储需求

### 向量存储
- 使用的方案（专用向量DB/PostgreSQL+pgvector/混合）
- 具体数据库和版本
- 向量维度（如果能从代码中找到）
- 索引类型（HNSW/IVF/Flat）
- 规模需求（百万级/千万级/亿级）

### 主数据库
- 数据库类型和最低版本要求
- 必需的扩展/插件（分析requirements.txt, package.json等）
- Schema隔离方式（单租户/多租户）
- 是否需要连接池

### 图数据库（如果使用）
- 类型和用途
- 是否必需
- 查询复杂度

### 缓存层
- 使用的缓存系统
- 版本要求
- 需要的模块（RedisJSON/RediSearch等）
- 持久化要求

### 对象存储
- 是否需要
- 使用场景

### 数据规模预估
- 预估总数据量
- 单用户平均数据量
- 增长速率

### 性能要求
- 向量检索延迟目标
- QPS目标
- P95延迟
- 并发连接数

## 2. 详细的计算处理需求

### CPU
- 最小和推荐vCPU数
- 工作负载类型（CPU密集/IO密集/均衡）
- 特殊指令集要求（AVX2/AVX-512用于向量计算）

### 内存
- 最小和推荐内存
- 内存密集型操作列表
- OOM风险评估

### GPU需求（重点分析）
- 是否必需GPU
- 是否推荐使用GPU
- 适合的GPU型号
- 使用场景（训练/推理/两者）
- 显存要求

**CUDA依赖深度分析**（通过分析代码）：
- 是否有直接CUDA调用（检查.cu文件、torch.cuda调用）
- CUDA版本要求
- 是否使用cuDNN
- 是否使用TensorRT
- 是否有自定义CUDA kernel
- 使用的GPU加速库（cupy, rapids, faiss-gpu等）

## 3. 🔥 昇腾NPU兼容性分析（核心重点）

基于代码分析，评估该项目迁移到华为昇腾NPU的可行性：

### 兼容性级别
从以下选项中选择：
- "完全兼容" - 无GPU依赖或使用PyTorch/TF且无特殊CUDA代码
- "容易适配" - 使用标准框架，仅需替换运行时
- "需要工作量" - 有一些CUDA特定代码但可替换
- "困难" - 大量自定义CUDA kernel或TensorRT依赖
- "不适用(无GPU需求)" - 项目不需要GPU

### 框架支持分析
- 项目使用的深度学习框架和版本
- CANN(昇腾异构计算架构)是否支持该框架版本
- 推荐的CANN版本

### 迁移工作量评估
- 工作量级别（低1-2天/中1-2周/高1-2月/极高需重构）
- 需要修改的代码类型
- 测试工作量

### 阻碍因素
列出技术阻碍，例如：
- 自定义CUDA kernel
- TensorRT推理引擎
- cuDNN特定算子
- GPU加速库依赖（cupy, rapids等）

### 性能预期
- 相比GPU的性能预期（相当/略低/未知）
- 可能的性能瓶颈

### 推荐方案
具体的迁移建议和实施路径

## 4. 弹性伸缩
- 是否支持水平扩展
- 是否无状态
- 会话保持需求
- 自动伸缩支持情况

## 5. Serverless适配性
- 是否适合serverless部署
- 冷启动时间容忍度
- 状态管理方式
- 适合或不适合的原因

## 6. 并发模型
- 同步/异步/混合
- 使用的异步框架
- 消息队列需求
- WebSocket/SSE/流式响应支持

## 7. 外部服务依赖
- LLM API提供商
- Embedding和LLM模型
- 本地模型支持
- 成本优化策略
- 对象存储需求
- 搜索服务需求

## 8. 部署配置
- Docker详情（镜像大小、多阶段构建）
- Kubernetes需求
- 配置复杂度
- 可观测性支持
- 升级策略

## 9. 🔥 华为云适配性（核心重点）

### 整体难度评估
容易/中等/困难

### 推荐的华为云服务映射
- 数据库服务（RDS/GaussDB）
- 向量存储方案
- 图数据库方案
- 缓存服务（DCS Redis）
- 对象存储（OBS）
- 计算服务（ECS/CCI）
- AI加速服务（ModelArts+昇腾NPU，如果需要GPU）
- 消息队列（DMS）

### 成本估算（人民币/月）
分别估算小规模、中等规模、大规模部署的成本，包括：
- 场景描述（用户数、QPS）
- 总成本范围
- 成本拆分（数据库/计算/存储/网络等）

### 特殊要求
列出需要注意的事项，例如：
- 需要申请pgvector插件
- 昇腾NPU适配工作量
- 特定地域可用性

### 架构建议
针对华为云的优化建议

---

**输出要求：**
1. 以结构化JSON格式输出
2. 每个分析都要有具体数据和依据
3. 昇腾NPU和华为云分析要特别详细
4. 如果某些信息无法从代码中确定，标注为"需要进一步确认"
5. 提供实际的配置示例和命令
`;

  console.log(`  💭 发送分析请求到Claude...`);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16000,
    temperature: 0.3,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  const analysis = response.content[0].type === 'text' ? response.content[0].text : '';
  console.log(`  ✅ 分析完成`);

  return {
    project_name: projectName,
    analysis: analysis,
    enhanced_cloud_needs: analysis // 后续需要从analysis中提取结构化数据
  };
}

async function collectCodeInfo(repoPath: string): Promise<any> {
  const info: any = {
    files_found: [],
    dependencies: {},
    docker_config: null,
    kubernetes_config: null,
    code_samples: {}
  };

  try {
    // 检查依赖文件
    const depFiles = [
      'requirements.txt',
      'pyproject.toml',
      'package.json',
      'Cargo.toml',
      'go.mod'
    ];

    for (const file of depFiles) {
      const filePath = path.join(repoPath, file);
      if (fs.existsSync(filePath)) {
        info.dependencies[file] = fs.readFileSync(filePath, 'utf-8');
        info.files_found.push(file);
      }
    }

    // 检查Docker配置
    const dockerFiles = ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'];
    for (const file of dockerFiles) {
      const filePath = path.join(repoPath, file);
      if (fs.existsSync(filePath)) {
        info.docker_config = fs.readFileSync(filePath, 'utf-8');
        info.files_found.push(file);
        break;
      }
    }

    // 检查K8s配置
    const k8sDir = path.join(repoPath, 'k8s');
    if (fs.existsSync(k8sDir)) {
      info.kubernetes_config = 'K8s配置目录存在';
      info.files_found.push('k8s/');
    }

    // 查找数据库配置文件
    const configFiles = [
      'config.py',
      'config.ts',
      'config.yaml',
      '.env.example',
      'settings.py'
    ];

    for (const file of configFiles) {
      const filePath = path.join(repoPath, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        info.code_samples[file] = content.slice(0, 2000); // 限制长度
        info.files_found.push(file);
      }
    }

  } catch (error) {
    console.error(`    ⚠️  收集代码信息时出错: ${error}`);
  }

  return info;
}

async function main() {
  console.log('🚀 开始增强云服务需求和昇腾NPU兼容性分析');
  console.log(`📦 试点项目: ${PILOT_PROJECTS.join(', ')}\n`);

  const results: AnalysisResult[] = [];

  for (const projectName of PILOT_PROJECTS) {
    try {
      const result = await analyzeProject(projectName);
      results.push(result);

      // 保存临时结果
      const outputPath = path.join(PROJECTS_DIR, projectName, 'enhanced-cloud-analysis.json');
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      console.log(`  💾 结果已保存到: ${outputPath}`);

      // 添加延迟避免API限流
      if (PILOT_PROJECTS.indexOf(projectName) < PILOT_PROJECTS.length - 1) {
        console.log(`  ⏳ 等待5秒后继续...\n`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

    } catch (error) {
      console.error(`  ❌ 分析 ${projectName} 时出错:`, error);
    }
  }

  console.log('\n✅ 试点分析完成！');
  console.log(`\n📊 分析了 ${results.length} 个项目`);
  console.log('\n下一步：');
  console.log('1. 审查试点项目的分析结果');
  console.log('2. 调整分析模板和数据结构');
  console.log('3. 对剩余22个项目执行批量分析');
  console.log('4. 更新对比页面增加新维度');
}

main().catch(console.error);
