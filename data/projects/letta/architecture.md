# Letta 架构分析

> 基于实际代码库分析 (Letta v0.16.4，前身为 MemGPT)

## 1. 整体架构概述

**Letta** 是一个为 AI 代理提供**操作系统式长期内存管理**的开源平台。它是 MemGPT 项目的演进版本，采用创新的虚拟上下文管理设计，使 LLM 代理能够突破固定的上下文窗口限制，实现真正的长期学习和自我改进。

### 核心价值主张

1. **操作系统式内存管理**：如同操作系统管理物理内存一样，Letta 将大量对话历史存储在"外部内存"，动态加载到有限的"核心内存"（LLM 上下文窗口）
2. **无缝的会话连续性**：Agent 在多个会话中保持一致的状态和学习记忆
3. **完全模型无关**：支持 OpenAI、Anthropic、Google、Groq、Ollama 等 20+ LLM 提供商
4. **企业级部署**：提供完整的 REST API、Python/TypeScript SDK、本地开发和云原生部署支持

### 与其他项目的差异

| 维度 | Letta | Mem0 | Graphiti |
|------|-------|------|----------|
| **核心概念** | 虚拟上下文 + 操作系统式内存 | 向量记忆 + 多级存储 | 时态知识图谱 |
| **内存架构** | 3层（Core/Recall/Archival） | 向量 + 图 + 历史 | 双时态图 |
| **更新模式** | 实时（Agent 控制） | 智能去重 | 增量 (Episode) |
| **搜索方式** | 上下文注入 | 语义搜索 | 混合搜索 |
| **自学能力** | 通过内存编辑函数 | 系统自动提取 | 自动实体提取 |
| **适用场景** | 长期对话 Agent | 记忆检索系统 | 关系推理系统 |

---

## 2. 核心架构组件

### 架构分层图

```architecture
{
  "layers": [
    {
      "title": "Client Layer",
      "icon": "🔌",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "A1", "label": "Python SDK" },
        { "id": "A2", "label": "TypeScript SDK" },
        { "id": "A3", "label": "REST API Client" },
        { "id": "A4", "label": "Letta Code CLI" }
      ]
    },
    {
      "title": "Agent Execution Engine",
      "icon": "🧠",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "B1", "label": "Agent (Stateful)" },
        { "id": "B2", "label": "Agent Loop" },
        { "id": "B3", "label": "Tool Executor" },
        { "id": "B4", "label": "Prompt Generator" },
        { "id": "B5", "label": "Memory Compiler" }
      ]
    },
    {
      "title": "Memory Management Layer",
      "icon": "💾",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "C1", "label": "Core Memory (Blocks)" },
        { "id": "C2", "label": "Recall Memory (Recent)" },
        { "id": "C3", "label": "Archival Memory (Long-term)" },
        { "id": "C4", "label": "Memory Manager" }
      ]
    },
    {
      "title": "Data & Service Layer",
      "icon": "⚙️",
      "color": {
        "bg": "bg-blue-100",
        "border": "border-blue-600",
        "textColor": "#1e40af"
      },
      "nodes": [
        { "id": "D1", "label": "PostgreSQL (ORM)" },
        { "id": "D2", "label": "Vector DB (Pinecone/PGVector)" },
        { "id": "D3", "label": "LLM API (20+ providers)" },
        { "id": "D4", "label": "MCP Server Integration" }
      ]
    }
  ]
}
```

## 3. 核心模块详解

### 3.1 Agent 核心类

**主要职责**：
- Agent 状态管理和会话生命周期
- 消息处理和流水线编排
- 内存管理和上下文窗口计算
- 工具执行和函数调用处理
- 与 LLM 的交互循环

### 3.2 内存架构

Letta 的内存系统采用**三层设计**，模仿操作系统的内存管理：

**核心内存（Core Memory）**
- 目的：当前上下文中的状态信息
- 结构：可编辑的文本块（Blocks）
- 特点：受到严格的字符限制（默认 8000 字符）

**召回内存（Recall Memory）**
- 目的：最近的对话历史
- 实现：PostgreSQL 数据库中的消息表
- 大小：通常保留最近 N 条消息

**档案内存（Archival Memory）**
- 目的：长期事实和历史摘要
- 实现：向量数据库 + 全文搜索
- 特点：可搜索、可标记、可汇总

### 3.3 LLM 集成层

Letta 支持 **20+ LLM 提供商**：
- OpenAI (GPT-5, GPT-4, GPT-4o)
- Anthropic (Claude 3.5 Sonnet, Opus 4.5)
- Google (Gemini Pro, Vertex AI)
- Groq (快速推理模型)
- Ollama (本地开源模型)
- 等等

### 3.4 工具执行系统

**工具类型**：
1. **核心工具** - Letta 内置（send_message、core_memory_*、archival_memory_*）
2. **用户定义工具** - 通过 API 注册
3. **MCP 工具** - 来自 Model Context Protocol 服务器
4. **Composio 工具** - 来自 Composio 平台

## 4. 技术栈分析

### 4.1 核心框架

- **后端**：FastAPI + SQLAlchemy + PostgreSQL
- **存储**：PostgreSQL + PGVector / Pinecone
- **LLM**：20+ 提供商支持，统一接口
- **SDK**：Python + TypeScript

### 4.2 部署方式

- 开发环境：Docker Compose
- 生产环境：Kubernetes + 云原生
- 托管服务：Letta Cloud

## 5. 关键特性实现

### 5.1 虚拟上下文管理

动态加载/卸载内存，突破固定上下文窗口限制：
- 计算 token 使用量
- 触发内存压力警告
- 自动汇总旧消息
- 将汇总结果移到档案内存

### 5.2 自学习机制

Agent 可以通过 `core_memory_*` 函数主动修改自己的内存，实现学习和适应。

### 5.3 消息流和链式调用

支持工具链式调用，一次对话中可以执行多个工具操作。

## 6. REST API 设计

### 核心端点

- `/v1/agents` - Agent 管理
- `/v1/agents/{agent_id}/messages` - 消息/对话
- `/v1/agents/{agent_id}/memory` - 内存管理
- `/v1/agents/{agent_id}/tools` - 工具管理
- `/v1/providers` - LLM 提供商管理

## 7. 部署架构

### 本地开发

```bash
docker-compose up -d
# 或
letta server
```

### 生产环境

推荐使用 Kubernetes 部署，包含：
- Letta Server Pod (多副本)
- CloudSQL PostgreSQL
- Pinecone 向量数据库
- Secret Manager

### Letta Cloud

完全托管服务：https://app.letta.com

## 8. 工程实践

### 8.1 代码质量

- Ruff (格式化 + Linting)
- Pyright (类型检查)
- Pre-commit (提交前检查)

### 8.2 测试策略

- pytest (单元测试和集成测试)
- pytest-asyncio (异步代码测试)
- 覆盖率报告

### 8.3 CI/CD

GitHub Actions 自动化：
- 多版本 Python 测试
- Linting 和类型检查
- 代码覆盖率上传

## 9. 扩展能力

### 9.1 MCP 集成

支持 Model Context Protocol 服务器集成，可从 Claude 等 AI 助手调用。

### 9.2 多 Agent 系统

支持代理组（Agent Groups），构建复杂的多代理应用。

### 9.3 插件系统

通过自定义工具和插件扩展功能。

## 10. 性能优化

### Token 优化
- 向量化召回内存
- 智能汇总
- 块级限制
- 工具定义缓存

### 数据库优化
- PostgreSQL 索引优化
- 向量索引（ivfflat）

### 缓存策略
- 内存中缓存常用数据

## 11. 安全与隐私

- API Key 认证
- Organization 隔离
- HTTPS/TLS 加密
- 审计日志

## 12. 监控和可观测性

- OpenTelemetry 集成
- 结构化日志（JSON）
- 性能指标（Token 使用、响应时间等）

## 13. 总结

Letta 的架构设计体现了以下核心原则：

1. **模块化**：清晰的分层设计
2. **灵活性**：支持 20+ LLM、多种存储后端
3. **可扩展性**：MCP 集成、自定义工具、插件系统
4. **生产就绪**：企业级部署、监控、安全、高可用
5. **开发者友好**：直观的 SDK、完整的文档

**适用场景**：
- 长期对话型 AI 助手
- 个性化推荐系统
- 企业级智能客服
- AI 代码编辑器集成
- 自学习系统

**技术栈推荐**：FastAPI + PostgreSQL + PGVector + OpenAI/Claude + Kubernetes

---

**文档版本**：v1.0
**更新日期**：2025-02-11
**基础版本**：Letta v0.16.4
