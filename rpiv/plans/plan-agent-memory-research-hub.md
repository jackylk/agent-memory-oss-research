---
description: "功能实施计划: Agent Memory Research Hub - 完整8周实施计划"
status: in-progress
created_at: 2026-02-11T10:30:00
updated_at: 2026-02-11T16:52:00
archived_at: null
related_files:
  - rpiv/requirements/prd-agent-memory-research-hub.md
---

# 功能实施计划: Agent Memory Research Hub

以下计划基于已有的25个项目数据和完整的PRD文档，提供从自动化分析到网站上线的完整实施路径。

## 功能描述

Agent Memory Research Hub 是一个专为云服务提供商设计的权威研究平台。通过自动化的代码分析、学术论文研究和用户反馈挖掘，将25个开源agent memory项目的分散信息整合为结构化的知识库，以Next.js静态网站形式呈现，帮助云服务商精准识别市场需求和产品机会。

**核心能力：**
- 自动化分析25个项目的代码架构、学术论文、云服务需求、用户痛点
- 生成结构化数据（JSON）和分析报告（Markdown）
- 汇总生成分类、云需求、趋势等全局洞察
- Next.js静态网站展示，部署到Railway

## 用户故事

**作为云服务产品经理**
我想要在5分钟内了解agent memory市场的全貌（Top项目、技术方案、云服务机会）
以便快速判断是否值得投入资源研究这个领域

**作为云服务技术架构师**
我想要深入了解某个项目（如graphiti）的技术细节、论文创新和云服务需求
以便评估我们的云服务能否支持它，以及如何设计相关产品

**作为云服务创业公司创始人**
我想要发现当前生态中未被满足的需求
以便找到差异化的市场切入点

## 问题陈述

云服务提供商面临agent memory市场的信息不对称：
1. **项目爆发式增长**：25+主流项目，技术方案多样（知识图谱、向量检索、压缩优化等）
2. **信息分散**：需要逐个阅读GitHub、论文、Issues才能理解
3. **缺乏洞察**：不清楚哪些技术栈有市场潜力，开发者的真实痛点是什么
4. **决策困难**：无法快速识别云服务产品机会和优先级

## 解决方案陈述

构建自动化的分析流程和展示平台：
1. **Agent驱动的深度分析**：自动clone项目、下载论文、提取痛点，生成结构化报告
2. **多维度数据汇总**：按技术方案分类、云需求聚合、趋势识别
3. **现代化网站呈现**：Next.js SSG静态网站，快速加载、易于导航
4. **持续更新机制**：每周手动触发更新，保持内容新鲜度

## 功能元数据

**功能类型**：新功能（全新产品）
**估计复杂度**：高
**主要受影响的系统**：
- 数据分析层（Claude Agent脚本）
- 数据存储层（JSON + Markdown）
- 展示层（Next.js网站）
- 部署层（Railway + GitHub Actions）

**依赖项**：
- Anthropic Claude API（分析Agent）
- GitHub API（数据采集）
- Next.js 15+、React 19+、TypeScript 5+
- TailwindCSS 4+、shadcn/ui
- Railway（部署）

---

## 上下文参考

### 已有数据文件（必读！）

- `/data/raw/agent-memory-projects.json` (28KB, 664行)
  - 原因：包含25个项目的完整基础数据
  - 结构：name, repository_url, stars, language, description, key_features, benchmark_mentions, innovation_highlights

- `/data/raw/benchmarks.json` (34KB, 949行)
  - 原因：13个benchmark的详细信息
  - 用途：验证项目的性能声明

- `/data/raw/analysis-summary.md` (6.4KB)
  - 原因：已完成的研究洞察
  - 包含：市场领导者、技术分类、2026年趋势

- `/rpiv/requirements/prd-agent-memory-research-hub.md` (45KB, 1354行)
  - 原因：完整的产品需求文档
  - 关键章节：用户故事、MVP范围、技术栈、数据结构规范

### 待创建的核心文件结构

```
agent-memory-oss-research/
├── data/
│   ├── projects/                      # 每个项目的深度分析
│   │   ├── mem0/
│   │   │   ├── meta.json              # 结构化元数据
│   │   │   ├── architecture.md        # 技术架构分析
│   │   │   ├── paper-analysis.md      # 论文深度研究（如有）
│   │   │   ├── cloud-needs.md         # 云服务需求
│   │   │   ├── user-pain-points.md    # 用户痛点
│   │   │   ├── paper.pdf              # 论文PDF（如有）
│   │   │   └── README.md              # 项目原始README
│   │   └── [其他24个项目]
│   ├── aggregated/                    # 汇总数据
│   │   ├── categories.json            # 分类数据
│   │   ├── cloud-needs.json           # 云需求汇总
│   │   ├── trends.json                # 趋势分析
│   │   └── papers-summary.json        # 论文汇总
│   └── raw/                           # 原始数据（已有）
├── analysis/                          # 分析脚本
│   ├── lib/                           # 共享工具库
│   │   ├── github-api.ts              # GitHub API封装
│   │   ├── claude-agent.ts            # Claude Agent封装
│   │   ├── pdf-downloader.ts          # 论文下载
│   │   ├── data-loader.ts             # 数据加载器
│   │   └── types.ts                   # TypeScript类型定义
│   ├── 01-clone-projects.ts           # 步骤1: Clone项目
│   ├── 02-download-papers.ts          # 步骤2: 下载论文
│   ├── 03-analyze-architecture.ts     # 步骤3: 架构分析
│   ├── 04-analyze-papers.ts           # 步骤4: 论文分析
│   ├── 05-extract-cloud-needs.ts      # 步骤5: 云需求提取
│   ├── 06-extract-pain-points.ts      # 步骤6: 痛点提取
│   ├── 07-generate-aggregations.ts    # 步骤7: 数据汇总
│   └── run-all.ts                     # 完整流程编排
├── website/                           # Next.js网站
│   ├── app/                           # App Router
│   │   ├── page.tsx                   # 首页（数据看板）
│   │   ├── layout.tsx                 # 全局布局
│   │   ├── projects/                  # 项目列表和详情
│   │   │   ├── page.tsx               # 项目列表页
│   │   │   └── [slug]/
│   │   │       └── page.tsx           # 项目详情页
│   │   ├── cloud-needs/
│   │   │   └── page.tsx               # 云需求汇总页
│   │   ├── trends/
│   │   │   └── page.tsx               # 趋势分析页
│   │   └── categories/
│   │       └── [category]/
│   │           └── page.tsx           # 分类页
│   ├── components/                    # React组件
│   │   ├── dashboard/
│   │   │   ├── StatsCards.tsx         # 统计卡片
│   │   │   ├── TrendChart.tsx         # 趋势图表
│   │   │   └── TopProjects.tsx        # Top项目列表
│   │   ├── projects/
│   │   │   ├── ProjectCard.tsx        # 项目卡片
│   │   │   ├── ProjectGrid.tsx        # 项目网格
│   │   │   ├── FilterSidebar.tsx      # 筛选侧边栏
│   │   │   └── SearchBar.tsx          # 搜索框
│   │   ├── ui/                        # shadcn/ui基础组件
│   │   └── Navigation.tsx             # 全局导航
│   ├── lib/
│   │   ├── data.ts                    # 数据加载逻辑
│   │   ├── markdown.ts                # Markdown解析
│   │   └── utils.ts                   # 工具函数
│   ├── public/                        # 静态资源
│   ├── styles/
│   │   └── globals.css                # 全局样式
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── next.config.mjs
└── scripts/
    └── deploy.sh                      # 部署脚本
```

### 相关文档（实施前必读！）

**Next.js文档：**
- [Next.js App Router](https://nextjs.org/docs/app)
  - 特定章节：Static Site Generation (SSG)
  - 原因：了解如何生成静态页面
- [Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
  - 特定章节：Server Components, generateStaticParams
  - 原因：理解如何在构建时加载数据生成静态页面

**Anthropic Claude API：**
- [Claude API Documentation](https://docs.anthropic.com/en/docs/intro-to-claude)
  - 特定章节：Messages API, Streaming
  - 原因：用于自动化分析项目代码和论文
- [Prompt Engineering Guide](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview)
  - 特定章节：Chain-of-thought, Examples
  - 原因：优化分析Agent的prompt设计

**GitHub API：**
- [Octokit.js](https://octokit.github.io/rest.js/)
  - 特定章节：Repos, Issues
  - 原因：获取项目数据和Issues

**TailwindCSS & shadcn/ui：**
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
  - 原因：快速构建现代UI组件

### 要遵循的模式

**数据结构模式：**（基于PRD第9章）

```typescript
// meta.json 结构
interface ProjectMeta {
  name: string;
  repository_url: string;
  stars: number;
  primary_language: string;
  description: string;
  last_updated: string;
  paper?: {
    exists: boolean;
    title: string;
    venue: string;
    year: number;
    url: string;
  };
  benchmarks: {
    locomo?: { score: number; details: string; };
    longmemeval?: { score: number; details: string; };
  };
  tech_stack: {
    storage: string[];
    frameworks: string[];
  };
  cloud_needs: {
    storage: { types: string[]; requirements: string[]; };
    compute: { embedding: boolean; gpu_needed: boolean; };
    deployment: { complexity: number; containerized: boolean; };
  };
  categories: {
    tech_approach: string[];
    use_case: string[];
  };
}
```

**命名约定：**
- 文件：kebab-case（agent-memory-projects.json）
- TypeScript：camelCase for variables, PascalCase for types
- React组件：PascalCase（ProjectCard.tsx）
- 脚本：数字前缀（01-clone-projects.ts）

**错误处理模式：**
```typescript
// 分析脚本统一错误处理
try {
  const result = await analyzeProject(project);
  await saveResult(result);
} catch (error) {
  console.error(`Failed to analyze ${project.name}:`, error);
  // 记录失败但继续处理其他项目
  failures.push({ project: project.name, error: error.message });
}
```

**日志记录模式：**
```typescript
// 使用console.log with prefix
console.log(`[${timestamp}] [ANALYZE] Processing ${project.name}...`);
console.log(`[${timestamp}] [SUCCESS] Generated architecture.md for ${project.name}`);
console.error(`[${timestamp}] [ERROR] Failed to download paper: ${error}`);
```

---

## 实施计划

### 阶段 1：环境搭建和工具库 (Week 1, Days 1-3)

**描述：** 搭建开发环境，创建共享工具库，为后续自动化分析做准备

**任务：**
1. 初始化TypeScript项目配置（/analysis目录）
2. 安装依赖：@anthropic-ai/sdk, @octokit/rest, pdf-parse, zod等
3. 创建共享工具库（github-api.ts, claude-agent.ts, pdf-downloader.ts）
4. 创建类型定义文件（types.ts）
5. 编写数据加载器（data-loader.ts）

**验证：**
- TypeScript编译无错误
- 能成功调用GitHub API获取仓库信息
- 能成功调用Claude API进行测试对话

---

### 阶段 2：项目Clone和论文采集 (Week 1, Days 4-7)

**描述：** Clone 25个GitHub项目到本地，下载论文PDF

**任务：**
1. 实现01-clone-projects.ts：从agent-memory-projects.json读取项目列表，批量clone
2. 实现02-download-papers.ts：
   - 从README提取论文链接（arXiv、ACL、ICLR等）
   - 下载PDF文件到data/projects/{name}/paper.pdf
   - 提取论文元数据（标题、作者、会议、年份）
3. 处理错误情况（clone失败、论文下载失败）
4. 生成进度报告

**输出：**
- data/projects/{name}/README.md（原始README）
- data/projects/{name}/paper.pdf（如有论文）
- data/projects/{name}/paper-metadata.json（如有）

**验证：**
- 25个项目成功clone
- 至少15个项目的论文PDF下载成功
- 论文元数据准确提取

---

### 阶段 3：自动化架构分析 (Week 2)

**描述：** 使用Claude Agent分析每个项目的代码架构

**任务：**
1. 实现03-analyze-architecture.ts：
   - 读取项目代码和README
   - 调用Claude API分析：
     - 依赖项（package.json, requirements.txt等）
     - 存储方案（数据库配置文件）
     - 核心架构（目录结构、模块设计）
     - 扩展性评估
   - 生成architecture.md
2. 优化prompt确保分析质量
3. 实现重试机制（API失败）
4. 人工审核前5个项目的分析结果，迭代prompt

**输出：**
- data/projects/{name}/architecture.md（每个项目）
- 包含章节：技术栈、存储方案、核心架构、扩展性

**验证：**
- 25个项目都生成architecture.md
- 架构分析包含关键信息（存储方案、技术栈）
- 人工抽查5个项目准确率>80%

---

### 阶段 4：论文深度分析 (Week 3, Days 1-4)

**描述：** 使用Claude Agent深度分析学术论文

**任务：**
1. 实现04-analyze-papers.ts：
   - 使用pdf-parse提取PDF文本
   - 调用Claude API分析：
     - 核心创新点
     - 相比baseline的提升（从实验章节提取）
     - 对用户的实际价值
     - 学术影响力
   - 生成paper-analysis.md
2. 处理论文不存在的情况（跳过）
3. 特殊处理表格数据（benchmark结果）

**输出：**
- data/projects/{name}/paper-analysis.md（如有论文的项目）
- 包含章节：论文信息、核心创新、性能评估、用户价值

**验证：**
- 至少15个项目生成paper-analysis.md
- 论文分析准确提取核心贡献
- Benchmark数据正确提取

---

### 阶段 5：云需求和痛点提取 (Week 3, Days 5-7)

**描述：** 提取云服务需求和用户痛点

**任务：**
1. 实现05-extract-cloud-needs.ts：
   - 基于architecture.md推断存储需求
   - 基于依赖项推断计算需求
   - 评估部署复杂度
   - 生成cloud-needs.md
   - 更新meta.json的cloud_needs字段

2. 实现06-extract-pain-points.ts：
   - 调用GitHub API获取Issues（最近100条）
   - 使用Claude分析Issues提取痛点
   - 分类痛点（部署、性能、功能、集成）
   - 生成user-pain-points.md

**输出：**
- data/projects/{name}/cloud-needs.md
- data/projects/{name}/user-pain-points.md
- data/projects/{name}/meta.json（完整版）

**验证：**
- 所有项目都有cloud-needs.md
- 云需求包含3个维度（存储、计算、部署）
- 痛点提取至少5个高频问题

---

### 阶段 6：数据汇总生成 (Week 4)

**描述：** 汇总25个项目的数据生成全局洞察

**任务：**
1. 实现07-generate-aggregations.ts：
   - 读取所有项目的meta.json
   - 生成categories.json（按技术方案、语言分类）
   - 生成cloud-needs.json（汇总云需求，计算频次）
   - 生成trends.json（流行度趋势、技术趋势）
   - 生成papers-summary.json（论文汇总、学术趋势）
2. 计算统计数据（项目数、stars分布等）
3. 识别Top机会（云服务需求优先级）

**输出：**
- data/aggregated/categories.json
- data/aggregated/cloud-needs.json
- data/aggregated/trends.json
- data/aggregated/papers-summary.json

**验证：**
- 分类数据正确（项目数统计准确）
- 云需求频次正确
- 趋势分析有洞察价值

---

### 阶段 7：Next.js项目初始化 (Week 5, Days 1-2)

**描述：** 创建Next.js项目和基础配置

**任务：**
1. 初始化Next.js 15项目（App Router）
2. 安装依赖：React 19, TypeScript, TailwindCSS, shadcn/ui
3. 配置tailwind.config.ts
4. 配置next.config.mjs（静态导出）
5. 创建全局布局（layout.tsx）
6. 创建导航组件（Navigation.tsx）
7. 安装Markdown解析库（unified, remark, rehype）

**输出：**
- website/目录初始化
- package.json, tsconfig.json, tailwind.config.ts
- 基础布局和导航

**验证：**
- `npm run dev`启动成功
- 访问localhost:3000显示基础页面
- TailwindCSS样式生效

---

### 阶段 8：核心页面开发 (Week 5-6, Days 3-7 & Days 1-3)

**描述：** 开发首页、项目列表、项目详情等核心页面

**任务：**

**8.1 数据加载层（Day 3）**
- 实现lib/data.ts：
  - loadProjects(): 读取所有meta.json
  - loadProject(slug): 读取单个项目完整数据
  - loadAggregations(): 读取汇总数据
  - parseMarkdown(): Markdown to HTML

**8.2 首页 - 数据看板（Days 4-5）**
- 实现app/page.tsx
- 创建components/dashboard/：
  - StatsCards.tsx（项目总数、技术流派、更新时间）
  - TopProjects.tsx（Top 10项目列表）
  - TrendChart.tsx（可视化趋势图，使用recharts）
  - QuickLinks.tsx（快速入口）

**8.3 项目列表页（Day 6）**
- 实现app/projects/page.tsx
- 创建components/projects/：
  - ProjectCard.tsx（项目卡片，显示名称、stars、语言、描述）
  - ProjectGrid.tsx（卡片网格布局）
  - FilterSidebar.tsx（分类筛选）
  - SearchBar.tsx（搜索框）

**8.4 项目详情页（Days 7 & Week 6 Days 1-2）**
- 实现app/projects/[slug]/page.tsx
- 使用generateStaticParams生成所有项目的静态页面
- 渲染Markdown内容（architecture.md, paper-analysis.md等）
- 创建详情页组件：
  - ProjectHeader.tsx（项目名、GitHub链接、stars）
  - PaperSection.tsx（论文分析章节）
  - ArchitectureSection.tsx（架构分析）
  - CloudNeedsSection.tsx（云需求）
  - PainPointsSection.tsx（用户痛点）

**8.5 云需求汇总页（Day 3）**
- 实现app/cloud-needs/page.tsx
- 按需求类型Tab展示（存储、计算、部署、运维）
- 需求频次排序
- 相关项目链接

**输出：**
- 完整的Next.js网站代码
- 所有核心页面可访问

**验证：**
- 首页正确显示数据看板
- 项目列表显示25个项目
- 筛选和搜索功能正常
- 项目详情页完整展示所有章节
- Markdown正确渲染

---

### 阶段 9：UI优化和响应式 (Week 6, Days 4-7)

**描述：** 优化用户体验和移动端适配

**任务：**
1. 样式优化（TailwindCSS）
2. 移动端响应式设计
3. 添加加载动画和骨架屏
4. 优化图表可视化
5. 添加面包屑导航
6. SEO优化（metadata, sitemap）
7. 性能优化（图片优化、代码分割）

**验证：**
- 移动端体验良好
- Lighthouse Performance > 90
- 所有链接可访问

---

### 阶段 10：部署和CI/CD (Week 7)

**描述：** 部署到Railway，设置自动化流程

**任务：**
1. 配置next.config.mjs for static export
2. 测试本地构建（npm run build && npm run export）
3. 创建Railway项目
4. 配置Railway部署（Dockerfile或Buildpacks）
5. 设置GitHub Actions：
   - 触发条件：main分支push
   - 步骤：build → test → deploy to Railway
6. 编写更新流程文档（docs/update-workflow.md）
7. 测试端到端更新流程

**输出：**
- Railway部署成功
- 公开URL可访问
- CI/CD流程运行正常

**验证：**
- 网站可通过公开URL访问
- GitHub push自动触发部署
- 更新流程可复现

---

### 阶段 11：测试和完善 (Week 8)

**描述：** 全面测试和内容完善

**任务：**
1. 内容审核：
   - 检查25个项目的分析准确性
   - 修正错误和遗漏
2. 功能测试：
   - 测试所有页面链接
   - 测试搜索和筛选
   - 测试移动端
3. 性能测试：
   - Lighthouse审计
   - 加载速度优化
4. 创建README.md和文档：
   - 项目说明
   - 本地开发指南
   - 更新流程文档
5. 收集反馈并迭代

**验证：**
- 所有验收标准满足
- 文档完整
- 准备好交付

---

## 逐步任务

重要：按顺序从上到下执行每个任务。每个任务都是原子的且可独立测试。

### 任务 1：CREATE analysis/package.json

- **IMPLEMENT**：初始化分析脚本的TypeScript项目
- **DEPENDENCIES**：
  ```json
  {
    "@anthropic-ai/sdk": "^0.27.0",
    "@octokit/rest": "^20.0.0",
    "pdf-parse": "^1.1.1",
    "zod": "^3.22.0",
    "dotenv": "^16.3.0"
  }
  ```
- **DEV_DEPENDENCIES**：typescript, @types/node, tsx
- **VALIDATE**：`cd analysis && npm install`

---

### 任务 2：CREATE analysis/lib/types.ts

- **IMPLEMENT**：定义TypeScript类型
- **PATTERN**：参考PRD第9章的数据结构规范
- **TYPES**：
  ```typescript
  export interface ProjectMeta {
    name: string;
    repository_url: string;
    stars: number;
    primary_language: string;
    description: string;
    last_updated: string;
    paper?: PaperInfo;
    benchmarks: BenchmarkResults;
    tech_stack: TechStack;
    cloud_needs: CloudNeeds;
    categories: Categories;
  }

  export interface PaperInfo {
    exists: boolean;
    title: string;
    venue: string;
    year: number;
    url: string;
  }

  // ... 其他类型定义
  ```
- **VALIDATE**：`tsc --noEmit`

---

### 任务 3：CREATE analysis/lib/github-api.ts

- **IMPLEMENT**：GitHub API封装
- **PATTERN**：使用Octokit
- **FUNCTIONS**：
  - `getRepository(owner, repo)`: 获取仓库信息
  - `getIssues(owner, repo, count)`: 获取Issues
  - `getReadme(owner, repo)`: 获取README
- **GOTCHA**：需要设置GITHUB_TOKEN环境变量避免rate limit
- **VALIDATE**：手动测试获取一个仓库信息

---

### 任务 4：CREATE analysis/lib/claude-agent.ts

- **IMPLEMENT**：Claude API封装
- **PATTERN**：使用Anthropic SDK
- **FUNCTIONS**：
  - `analyzeArchitecture(code, readme)`: 分析架构
  - `analyzePaper(pdfText)`: 分析论文
  - `extractPainPoints(issues)`: 提取痛点
- **GOTCHA**：需要设置ANTHROPIC_API_KEY
- **VALIDATE**：手动测试分析一个简单文本

---

### 任务 5：CREATE analysis/lib/pdf-downloader.ts

- **IMPLEMENT**：论文下载工具
- **FUNCTIONS**：
  - `extractPaperLinks(readme)`: 从README提取论文链接
  - `downloadPaper(url, savePath)`: 下载PDF
  - `extractPaperMetadata(pdfText)`: 提取元数据
- **GOTCHA**：不同平台（arXiv、ACL等）下载方式不同
- **VALIDATE**：测试下载一篇arXiv论文

---

### 任务 6：CREATE analysis/lib/data-loader.ts

- **IMPLEMENT**：数据加载工具
- **FUNCTIONS**：
  - `loadRawProjects()`: 读取agent-memory-projects.json
  - `saveProjectData(name, data)`: 保存项目数据
  - `loadProjectMeta(name)`: 读取meta.json
- **VALIDATE**：测试读取和保存数据

---

### 任务 7：CREATE analysis/01-clone-projects.ts

- **IMPLEMENT**：Clone 25个GitHub项目
- **LOGIC**：
  1. 读取data/raw/agent-memory-projects.json
  2. 遍历每个项目
  3. git clone到data/projects/{name}/
  4. 复制README.md
  5. 记录成功/失败
- **GOTCHA**：某些项目可能已存在，需要检查并跳过
- **VALIDATE**：`npm run clone-projects`，检查data/projects/目录

---

### 任务 8：CREATE analysis/02-download-papers.ts

- **IMPLEMENT**：下载论文PDF
- **LOGIC**：
  1. 遍历每个项目的README
  2. 提取论文链接（正则匹配arXiv、ACL等）
  3. 下载PDF到data/projects/{name}/paper.pdf
  4. 提取元数据保存到paper-metadata.json
- **VALIDATE**：`npm run download-papers`，检查paper.pdf文件数量

---

### 任务 9：CREATE analysis/03-analyze-architecture.ts

- **IMPLEMENT**：架构分析
- **LOGIC**：
  1. 读取项目代码和README
  2. 调用claude-agent.analyzeArchitecture()
  3. 生成architecture.md（Markdown格式）
  4. 更新meta.json的tech_stack字段
- **PROMPT_TEMPLATE**：
  ```
  分析以下项目的技术架构：

  项目名称：{name}
  README内容：{readme}
  主要文件列表：{files}

  请提供以下分析：
  1. 技术栈概述
  2. 存储方案（数据库类型、向量存储等）
  3. 核心架构设计
  4. 扩展性评估

  以Markdown格式输出，包含章节标题。
  ```
- **VALIDATE**：人工检查前5个项目的architecture.md

---

### 任务 10：CREATE analysis/04-analyze-papers.ts

- **IMPLEMENT**：论文分析
- **LOGIC**：
  1. 检查是否存在paper.pdf
  2. 使用pdf-parse提取文本
  3. 调用claude-agent.analyzePaper()
  4. 生成paper-analysis.md
- **PROMPT_TEMPLATE**：
  ```
  深度分析以下学术论文：

  论文内容：{pdfText}

  请提供：
  1. 核心创新点（3-5点）
  2. 相比已有工作的提升（从实验结果章节提取具体数字）
  3. 对用户的实际价值
  4. 学术影响力（会议级别、引用等）

  以Markdown格式输出。
  ```
- **VALIDATE**：检查至少15个paper-analysis.md

---

### 任务 11：CREATE analysis/05-extract-cloud-needs.ts

- **IMPLEMENT**：云需求提取
- **LOGIC**：
  1. 读取architecture.md
  2. 基于存储方案、依赖项推断云需求
  3. 生成cloud-needs.md
  4. 更新meta.json的cloud_needs字段
- **VALIDATE**：检查所有项目的cloud-needs.md

---

### 任务 12：CREATE analysis/06-extract-pain-points.ts

- **IMPLEMENT**：痛点提取
- **LOGIC**：
  1. 调用GitHub API获取Issues
  2. 使用Claude分析Issues
  3. 分类痛点（部署、性能、功能等）
  4. 生成user-pain-points.md
- **VALIDATE**：检查痛点分类合理性

---

### 任务 13：CREATE analysis/07-generate-aggregations.ts

- **IMPLEMENT**：数据汇总
- **LOGIC**：
  1. 读取所有meta.json
  2. 按技术方案、语言分类
  3. 汇总云需求频次
  4. 生成categories.json, cloud-needs.json等
- **VALIDATE**：检查汇总数据统计准确

---

### 任务 14：CREATE analysis/run-all.ts

- **IMPLEMENT**：完整流程编排
- **LOGIC**：依次执行步骤1-7
- **VALIDATE**：`npm run analyze-all`，完整流程无错误

---

### 任务 15：CREATE website/package.json

- **IMPLEMENT**：初始化Next.js项目
- **COMMAND**：`npx create-next-app@latest website --typescript --tailwind --app`
- **DEPENDENCIES**：react, next, typescript, tailwindcss, shadcn/ui, recharts, unified, remark, rehype
- **VALIDATE**：`cd website && npm install && npm run dev`

---

### 任务 16：UPDATE website/next.config.mjs

- **IMPLEMENT**：配置静态导出
- **CONFIG**：
  ```javascript
  /** @type {import('next').NextConfig} */
  const nextConfig = {
    output: 'export',
    images: {
      unoptimized: true,
    },
  };
  export default nextConfig;
  ```
- **VALIDATE**：`npm run build`成功

---

### 任务 17：CREATE website/lib/data.ts

- **IMPLEMENT**：数据加载逻辑
- **FUNCTIONS**：
  - `loadAllProjects()`: 读取所有meta.json
  - `loadProject(slug)`: 读取单个项目完整数据
  - `loadAggregations()`: 读取汇总数据
- **PATTERN**：使用fs读取文件，相对路径从项目根目录
- **VALIDATE**：测试能正确加载数据

---

### 任务 18：CREATE website/lib/markdown.ts

- **IMPLEMENT**：Markdown解析
- **DEPENDENCIES**：unified, remark-parse, remark-gfm, remark-rehype, rehype-stringify, rehype-highlight
- **FUNCTION**：`parseMarkdown(content: string): Promise<string>`
- **VALIDATE**：测试解析Markdown生成HTML

---

### 任务 19：CREATE website/app/layout.tsx

- **IMPLEMENT**：全局布局
- **COMPONENTS**：Navigation, Footer
- **PATTERN**：App Router layout模式
- **VALIDATE**：访问页面显示导航栏

---

### 任务 20：CREATE website/components/Navigation.tsx

- **IMPLEMENT**：全局导航组件
- **LINKS**：首页、项目列表、云需求、趋势分析
- **PATTERN**：使用Next.js Link组件
- **VALIDATE**：导航链接可点击

---

### 任务 21：CREATE website/app/page.tsx

- **IMPLEMENT**：首页数据看板
- **COMPONENTS**：使用StatsCards, TopProjects, TrendChart
- **DATA**：调用loadAllProjects(), loadAggregations()
- **VALIDATE**：首页显示正确数据

---

### 任务 22：CREATE website/components/dashboard/StatsCards.tsx

- **IMPLEMENT**：统计卡片组件
- **DATA**：项目总数、技术流派数、最新更新时间
- **PATTERN**：使用shadcn/ui Card组件
- **VALIDATE**：卡片正确显示

---

### 任务 23：CREATE website/components/dashboard/TopProjects.tsx

- **IMPLEMENT**：Top 10项目列表
- **DATA**：按stars排序取前10
- **VALIDATE**：列表正确显示

---

### 任务 24：CREATE website/components/dashboard/TrendChart.tsx

- **IMPLEMENT**：趋势图表
- **LIBRARY**：使用recharts绘制柱状图或折线图
- **DATA**：从trends.json读取
- **VALIDATE**：图表正确渲染

---

### 任务 25：CREATE website/app/projects/page.tsx

- **IMPLEMENT**：项目列表页
- **COMPONENTS**：ProjectGrid, FilterSidebar, SearchBar
- **DATA**：loadAllProjects()
- **VALIDATE**：显示25个项目卡片

---

### 任务 26：CREATE website/components/projects/ProjectCard.tsx

- **IMPLEMENT**：项目卡片组件
- **DATA**：名称、stars、语言、描述、技术标签
- **PATTERN**：shadcn/ui Card + Badge
- **VALIDATE**：卡片样式符合设计

---

### 任务 27：CREATE website/components/projects/FilterSidebar.tsx

- **IMPLEMENT**：筛选侧边栏
- **FILTERS**：技术方案、语言、stars范围
- **PATTERN**：使用shadcn/ui Checkbox, Slider
- **VALIDATE**：筛选功能正常

---

### 任务 28：CREATE website/app/projects/[slug]/page.tsx

- **IMPLEMENT**：项目详情页
- **PATTERN**：
  - 使用generateStaticParams生成所有项目路径
  - Server Component读取项目数据
  - 渲染Markdown内容
- **SECTIONS**：概览、论文、架构、云需求、痛点
- **VALIDATE**：每个项目详情页可访问

---

### 任务 29：CREATE website/app/cloud-needs/page.tsx

- **IMPLEMENT**：云需求汇总页
- **DATA**：读取cloud-needs.json
- **LAYOUT**：Tab切换（存储、计算、部署、运维）
- **VALIDATE**：数据正确显示

---

### 任务 30：UPDATE website/tailwind.config.ts

- **IMPLEMENT**：优化TailwindCSS配置
- **THEME**：定义项目色彩、字体、间距
- **PATTERN**：现代简洁风格（类似Linear、Vercel）
- **VALIDATE**：样式应用生效

---

### 任务 31：OPTIMIZE 移动端响应式

- **IMPLEMENT**：所有页面适配移动端
- **BREAKPOINTS**：sm, md, lg, xl
- **VALIDATE**：手机浏览器测试

---

### 任务 32：ADD SEO优化

- **IMPLEMENT**：
  - metadata in layout.tsx和page.tsx
  - 生成sitemap.xml
  - robots.txt
- **VALIDATE**：检查页面title和description

---

### 任务 33：CREATE scripts/deploy.sh

- **IMPLEMENT**：部署脚本
- **STEPS**：
  1. cd analysis && npm run analyze-all
  2. cd ../website && npm run build
  3. Deploy to Railway
- **VALIDATE**：手动执行脚本成功

---

### 任务 34：CREATE .github/workflows/deploy.yml

- **IMPLEMENT**：GitHub Actions CI/CD
- **TRIGGER**：push to main
- **STEPS**：install, build, test, deploy
- **VALIDATE**：push代码触发自动部署

---

### 任务 35：CREATE docs/update-workflow.md

- **IMPLEMENT**：更新流程文档
- **CONTENT**：
  - 如何手动触发更新
  - 如何添加新项目
  - 如何审核分析结果
  - 如何部署
- **VALIDATE**：文档清晰易懂

---

### 任务 36：REVIEW 内容审核

- **IMPLEMENT**：人工审核25个项目的分析
- **CHECK**：
  - 架构分析准确性
  - 论文分析质量
  - 云需求合理性
  - 数据一致性
- **VALIDATE**：准确率>80%

---

### 任务 37：CREATE README.md

- **IMPLEMENT**：项目主README
- **SECTIONS**：
  - 项目介绍
  - 功能特性
  - 本地开发
  - 部署指南
  - 贡献指南
- **VALIDATE**：README完整

---

## 测试策略

### 单元测试

**范围：** 分析脚本的工具函数

**框架：** Jest或Vitest

**测试用例：**
- github-api.ts: 测试API调用和错误处理
- pdf-downloader.ts: 测试链接提取和下载逻辑
- data-loader.ts: 测试文件读写

**执行：** `npm test` in /analysis

### 集成测试

**范围：** 完整的分析流程

**测试用例：**
- 端到端测试：从clone到生成汇总数据
- 测试项目：选择3个代表性项目（mem0, graphiti, SimpleMem）
- 验证输出文件完整性

**执行：** `npm run test:integration`

### 网站功能测试

**手动测试：**
- 首页数据看板正确显示
- 项目列表分类筛选正常
- 项目详情页完整渲染
- 云需求汇总数据准确
- 所有链接有效

**自动化测试（可选）：**
- Playwright端到端测试

### 边缘情况

- 论文不存在的项目（跳过论文分析）
- GitHub API rate limit（重试机制）
- PDF下载失败（标记"待分析"）
- Markdown解析错误（降级显示原文）
- 项目已被删除（标记"已归档"）

---

## 验证命令

执行每个命令以确保零回归和100%功能正确性。

### 级别 1：语法和类型检查

```bash
# 分析脚本
cd analysis
npm run type-check  # tsc --noEmit

# 网站
cd website
npm run type-check
npm run lint        # eslint
```

### 级别 2：单元测试

```bash
cd analysis
npm test

cd website
npm test
```

### 级别 3：集成测试

```bash
# 完整分析流程
cd analysis
npm run analyze-all  # 应成功处理25个项目

# 网站构建
cd website
npm run build        # 应生成静态HTML
```

### 级别 4：手动验证

**数据验证：**
```bash
# 检查生成的文件数量
ls data/projects/*/meta.json | wc -l  # 应为25
ls data/projects/*/architecture.md | wc -l  # 应为25
ls data/projects/*/paper-analysis.md | wc -l  # 应>=15
ls data/aggregated/*.json | wc -l  # 应为4
```

**网站验证：**
```bash
cd website
npm run dev
# 访问 http://localhost:3000
# 手动测试：
# 1. 首页数据看板显示正确
# 2. 项目列表显示25个项目
# 3. 筛选功能正常
# 4. 随机打开5个项目详情页，检查内容完整
# 5. 云需求汇总页数据正确
```

**性能验证：**
```bash
# Lighthouse审计
npm run build
npx serve out
# 使用Chrome DevTools Lighthouse测试
# Performance > 90
# Accessibility > 95
```

### 级别 5：部署验证

```bash
# Railway部署后
curl https://your-app.railway.app/
# 应返回200和HTML内容

# 检查所有页面
curl https://your-app.railway.app/projects
curl https://your-app.railway.app/cloud-needs
curl https://your-app.railway.app/trends
```

---

## 验收标准

- [ ] **数据完整性**
  - [ ] 25个项目都有meta.json
  - [ ] 25个项目都有architecture.md
  - [ ] 至少15个项目有paper-analysis.md
  - [ ] 所有项目都有cloud-needs.md
  - [ ] 所有项目都有user-pain-points.md
  - [ ] 汇总数据完整（categories, cloud-needs, trends, papers-summary）

- [ ] **数据准确性**
  - [ ] GitHub数据与实际一致（stars误差<5%）
  - [ ] 论文信息准确（标题、会议、年份）
  - [ ] 架构分析包含关键信息（存储方案、技术栈）
  - [ ] Benchmark数据来自可验证来源
  - [ ] 云需求分析合理（至少3个维度）

- [ ] **网站功能**
  - [ ] 首页正确显示数据看板（统计卡片、Top项目、趋势图）
  - [ ] 项目列表支持分类筛选（技术方案、语言）
  - [ ] 项目详情页完整展示所有章节（概览、论文、架构、云需求、痛点）
  - [ ] 云需求汇总页正确聚合数据
  - [ ] 所有链接有效（GitHub、论文、官网）

- [ ] **性能要求**
  - [ ] 首页加载时间 < 2秒
  - [ ] 项目详情页加载时间 < 1.5秒
  - [ ] Lighthouse Performance > 90
  - [ ] 移动端适配完整

- [ ] **部署**
  - [ ] 网站可通过公开URL访问
  - [ ] Railway部署成功
  - [ ] CI/CD流程运行正常（GitHub push触发部署）

- [ ] **文档**
  - [ ] README.md完整（项目介绍、本地开发、部署）
  - [ ] 更新流程文档完整（update-workflow.md）
  - [ ] 代码有基本注释

- [ ] **可维护性**
  - [ ] 数据更新流程可复现（<30分钟）
  - [ ] 新增项目的流程清晰
  - [ ] 代码结构清晰，易于理解

---

## 完成检查清单

- [ ] **阶段1-6完成**：所有分析脚本开发完成，25个项目数据完整
- [ ] **阶段7-9完成**：Next.js网站开发完成，所有页面功能正常
- [ ] **阶段10完成**：部署到Railway成功，公开URL可访问
- [ ] **阶段11完成**：测试和文档完善
- [ ] 所有验证命令成功执行
- [ ] 所有验收标准均满足
- [ ] 内容审核完成（准确率>80%）
- [ ] 用户反馈收集（如有早期用户）

---

## 备注

### 关键设计决策

**1. 为什么选择静态生成（SSG）而非服务端渲染（SSR）？**
- 数据更新频率低（每周一次）
- 静态站点性能最优（CDN分发）
- 部署和运维成本低
- 离线访问支持

**2. 为什么使用Claude Agent而非传统分析工具？**
- 需要深度语义理解（论文、代码）
- 传统工具难以提取"创新点"、"用户价值"等高层洞察
- Claude能生成结构化的Markdown报告

**3. 为什么分离数据层和展示层？**
- 数据可复用（未来可能支持API访问）
- 便于版本控制（Git追踪数据变化）
- 分析和展示可独立迭代

### 风险和缓解

**风险1：Claude API成本高**
- 缓解：优化prompt减少token使用
- 缓解：缓存分析结果，增量更新

**风险2：论文下载失败率高**
- 缓解：支持多种下载方式（arXiv API、直接PDF链接）
- 缓解：失败时标记"待分析"，不阻塞流程

**风险3：分析准确性不足**
- 缓解：人工审核前5个项目，迭代prompt
- 缓解：分析结果与原始数据一起展示，用户可验证

**风险4：开发周期紧张**
- 缓解：使用shadcn/ui快速构建UI
- 缓解：MVP聚焦核心功能，后续迭代

### 后续优化方向

**V2功能（3-6个月后）：**
- 项目对比功能（并排对比2-4个项目）
- 扩展到RAG框架、向量数据库
- 全文搜索（Algolia）
- 成本估算工具

**运营优化：**
- 自动化程度提升（GitHub Actions定时触发）
- 新项目自动发现（GitHub trending监控）
- 用户反馈收集机制

---

**计划版本：** V1.0
**创建日期：** 2026-02-11
**估计工期：** 8周
**复杂度：** 高
**信心分数：** 8/10（基于已有数据基础和清晰的PRD）
