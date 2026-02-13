#!/usr/bin/env python3
"""
为 25 个 agent memory 项目生成华为式价值判断
"""

import json
import os
from pathlib import Path

# 项目价值判断数据
VALUE_PROPOSITIONS = {
    "mem0": {
        "value_propositions": [
            {
                "name": "智能记忆管理与成本优化",
                "description": "通过多层级记忆管理架构(用户、会话、AI代理三层)和动态记忆整合机制,实现了跨会话的智能记忆保持和个性化交互能力,在LOCOMO基准上相比OpenAI提升26%准确率的同时降低90% token成本。"
            },
            {
                "name": "生产级高性能检索系统",
                "description": "采用图增强记忆表示和亚秒级检索优化技术,实现了生产就绪的大规模记忆系统,支持26+向量数据库和多LLM提供商,p95延迟降低91%达到企业级性能标准。"
            }
        ]
    },
    "graphiti": {
        "value_propositions": [
            {
                "name": "双时态知识图谱架构",
                "description": "通过双时态模型(bi-temporal model)追踪事件发生时间和记录时间,结合动态知识图谱实时更新和增量式非破坏性修改机制,在Deep Memory Retrieval基准测试中达到94.8%准确率,超越MemGPT的93.4%。"
            },
            {
                "name": "企业级混合检索引擎",
                "description": "采用语义嵌入+BM25关键词+图遍历的混合检索策略,支持复杂关系结构的演化追踪和多图数据库后端(Neo4j、FalkorDB、Neptune),实现企业级动态知识整合和历史关系追踪能力。"
            }
        ]
    },
    "SimpleMem": {
        "value_propositions": [
            {
                "name": "语义压缩与成本极限优化",
                "description": "通过三阶段流水线(语义压缩→在线合成→意图感知检索)和语义无损压缩技术,实现Token用量降低30倍(约550 tokens),在LoCoMo基准F1分数达到43.24%,相比Mem0提升26.4%的同时检索速度提升50.2%。"
            },
            {
                "name": "多视图索引检索系统",
                "description": "采用多视图索引架构(语义向量+词汇BM25+符号元数据)和在线语义合成机制,实现实时整合相关上下文为统一抽象表示,支持跨会话记忆持久化,与Claude、Cursor、LM Studio无缝集成。"
            }
        ]
    },
    "Memary": {
        "value_propositions": [
            {
                "name": "人类记忆仿真架构",
                "description": "通过双层记忆流架构(Memory Stream + Entity Knowledge Store)和递归实体检索(最大深度2层),模拟人类记忆工作原理,实现多跳推理和同义词扩展检索,提供零代码集成的长期记忆能力。"
            },
            {
                "name": "多图隔离与本地部署",
                "description": "采用FalkorDB多图隔离技术支持多代理场景,结合Ollama本地模型实现零云成本部署,通过Context Window管理和Token蒸馏机制降低智能代理开发门槛,保障隐私数据本地化。"
            }
        ]
    },
    "Memori": {
        "value_propositions": [
            {
                "name": "SQL原生企业级记忆",
                "description": "通过单行代码集成LLM提供商和Advanced Augmentation异步引擎,自动提取事实和语义三元组,支持10+数据库的适配器模式(SQL/NoSQL),利用企业现有数据库基础设施实现零集成成本的持久化记忆。"
            },
            {
                "name": "零延迟异步增强系统",
                "description": "采用FAISS本地向量索引实现零延迟语义搜索,通过异步后台处理(Advanced Augmentation)不影响主流程响应时间,支持Entity-Process-Session三层灵活归属系统,降低向量数据库托管成本。"
            }
        ]
    },
    "claude-mem": {
        "value_propositions": [
            {
                "name": "自动化记忆捕获与渐进披露",
                "description": "通过5个生命周期Hook自动捕获工具使用观察,采用3层递进式上下文注入(会话初始化100-200 tokens→时间线查询→完整详情),减少90%无效token消耗,平均每会话仅消耗3000-5000 tokens(约$0.02-0.05)。"
            },
            {
                "name": "本地优先混合搜索架构",
                "description": "采用SQLite FTS5全文搜索(<100ms)+Chroma向量语义搜索(<1s)的混合架构,结合私密标签系统(<private>边缘过滤)和Web Viewer UI实时可视化,实现隐私数据不离开用户设备的本地优先存储方案。"
            }
        ]
    },
    "letta": {
        "value_propositions": [
            {
                "name": "操作系统式内存管理",
                "description": "借鉴OS虚拟内存机制实现三层内存架构(Core Memory当前状态+Recall Memory最近对话+Archival Memory长期知识),通过Agent自主记忆编辑工具突破上下文窗口限制,理论上支持无限对话长度的同时降低50-70% token使用量。"
            },
            {
                "name": "企业级Agent平台",
                "description": "提供完整的REST API、Python/TypeScript SDK、用户管理和组织隔离,支持OpenAI、Anthropic、Google等20+ LLM提供商,通过流式响应、工具生态系统和MCP集成,实现生产就绪的无缝会话连续性和多租户安全隔离。"
            }
        ]
    },
    "supermemory": {
        "value_propositions": [
            {
                "name": "边缘计算全球低延迟",
                "description": "通过Cloudflare Workers全球边缘计算部署(300+节点自动分发)和Hyperdrive连接池优化,实现全球低延迟访问(<50ms)和数据库性能提升80%,结合R2对象存储零出口费用,大幅降低运营成本。"
            },
            {
                "name": "统一记忆管理平台",
                "description": "采用Model Context Protocol(MCP)集成为Claude和Cursor提供记忆能力,支持多渠道统一访问(Web应用、浏览器扩展、Raycast),通过PGVector内置向量搜索和混合检索(向量+全文),实现多平台无缝同步的第二大脑。"
            }
        ]
    },
    "memU": {
        "value_propositions": [
            {
                "name": "24/7主动式记忆监控",
                "description": "通过异步持续监控用户交互和主动学习流水线,自动提取知识、技能、行为模式,在Locomo基准达到92.09%平均准确率,实现零延迟记忆可用性(新记忆即时可查询),支持主动预见用户需求。"
            },
            {
                "name": "层次化文件系统记忆",
                "description": "采用分布式目录结构组织记忆(类文件系统),结合交叉引用和符号链接实现直观的多层级知识组织,通过双模混合检索(快速向量嵌入+LLM深度推理)平衡成本和准确性,支持多模态资源(文本、文档、图像、音频、视频)统一处理。"
            }
        ]
    },
    "beads": {
        "value_propositions": [
            {
                "name": "Git原生分布式记忆",
                "description": "通过Hash-based ID系统防止合并冲突和版本控制数据库(Dolt)实现时间旅行查询和分支管理,采用Git原生分发消除中心服务器依赖,支持离线优先和零冲突合并设计,为AI编码代理提供持久化结构化记忆。"
            },
            {
                "name": "语义压缩与依赖追踪",
                "description": "采用LLM(Claude Haiku)语义记忆压缩技术处理已关闭问题,结合依赖感知图实现多代理协作协调,通过JSONL同步兼容行级Git合并策略,支持完整审计追踪和依赖可视化。"
            }
        ]
    },
    "memory-agent": {
        "value_propositions": [
            {
                "name": "用户级记忆隔离与检索",
                "description": "通过基于user_id的命名空间设计实现跨对话线程的记忆持久化和隐私隔离,集成向量搜索(LangGraph Store+嵌入模型)根据对话上下文自动检索最相关历史记忆,提供相似度分数可见的语义记忆检索能力。"
            },
            {
                "name": "ReAct闭环与异步优化",
                "description": "采用InjectedToolArg注解隐藏系统级参数和store_memory节点自动回到call_model节点的ReAct闭环设计,结合完全异步架构支持并发记忆保存(asyncio.gather),单实例可处理20-50并发请求,实现最小化状态设计和时间上下文注入。"
            }
        ]
    },
    "langgraph-redis": {
        "value_propositions": [
            {
                "name": "双实现架构与TTL优化",
                "description": "通过泛型(Generic[RedisClientType, IndexType])实现同步和异步版本的类型安全代码复用,采用Redis原生TTL机制支持刷新读(refresh_on_read)和动态TTL移除,结合Sorted Set键注册表实现O(log N)检查点查找性能,零额外开销的自动过期管理。"
            },
            {
                "name": "语义缓存与成本优化",
                "description": "基于向量相似度的LLM响应缓存和工具结果缓存中间件,30%+缓存命中率可节省30%+ LLM费用,支持自适应集群检测(单机、Cluster、Azure/Enterprise代理),避免CROSSSLOT错误,单一代码库兼容所有Redis部署模式。"
            }
        ]
    },
    "MemoryAgentBench": {
        "value_propositions": [
            {
                "name": "五维记忆能力评估框架",
                "description": "通过增量多轮交互评估范式全面覆盖准确检索(AR)、测试时学习(TTL)、长程理解(LRU)、冲突解决(CR)和拒绝回答五大核心能力,结合注入一次查询多次设计哲学和GPT-4o LLM判断器,实现首个系统性评估长期记忆的多维标准化基准(ICLR 2026)。"
            },
            {
                "name": "统一代理评估平台",
                "description": "采用统一代理接口(AgentWrapper)支持15+种记忆方法的一致性评估,提供EventQA(事件时序记忆)和FactConsolidation(冲突信息整合)两个新构建数据集,通过完整的端到端评估流程(从数据加载到指标计算)和灵活的YAML配置驱动架构,简化记忆方法研究与开发。"
            }
        ]
    },
    "Backboard-Locomo-Benchmark": {
        "value_propositions": [
            {
                "name": "SOTA级记忆系统性能",
                "description": "在LoCoMo-MC10基准测试中达到90.00%整体准确率(单跳89.36%、多跳75.00%、开放域91.20%、时序推理91.90%),相比竞品Memobase提升14.22%、Zep提升14.86%、OpenAI原生记忆提升37.10%,实现业界领先的对话AI记忆维度评估。"
            },
            {
                "name": "云原生评估框架",
                "description": "采用LLM-as-Judge评估(GPT-4.1)和Gemini-2.5-pro对话生成,通过Backboard托管记忆存储和异步I/O(httpx)实现2-4秒/问题响应时间,支持Kubernetes Job并行处理和自动重试逻辑,10-30分钟完成250+问题的多维度评估,完整开源实现保证可复现性。"
            }
        ]
    },
    "memtrace": {
        "value_propositions": [
            {
                "name": "零嵌入时序记忆架构",
                "description": "采用Arc时序数据库和无嵌入纯文本架构,消除向量数据库和嵌入API依赖,通过Parquet列式存储实现5-10倍压缩,相比向量解决方案节省50-70%成本(中型部署$153/月 vs Pinecone $120-480/月),零GPU需求和LLM无关设计。"
            },
            {
                "name": "快速结构化时间查询",
                "description": "基于Arc数据库的SQL时序查询实现10-200ms查询延迟和50-500ms会话上下文聚合,支持MCP Server、Python SDK、TypeScript SDK多接口部署,通过Go运行时效率和写批处理并行化,单实例可处理500-1000写入/秒。"
            }
        ]
    },
    "easymemory": {
        "value_propositions": [
            {
                "name": "100%本地隐私部署",
                "description": "采用ChromaDB(本地持久化)、NetworkX+JSON图数据库和内置BM25全文索引,实现零强制云依赖的完全本地化部署,支持空气隔离环境运行,相比Mem0 Cloud节省100%(零月费 vs $99/月),满足GDPR和HIPAA合规要求的完全数据主权控制。"
            },
            {
                "name": "混合检索与MCP集成",
                "description": "通过Graph+Vector+Keyword三重混合检索实现95ms平均延迟,结合BAAI/bge-m3本地嵌入(CPU 10句/秒、GPU 120句/秒)和Ollama本地LLM,支持Claude Desktop、GPT、Gemini原生MCP协议集成,提供LoCoMo基准测试支持。"
            }
        ]
    },
    "LongMemEval": {
        "value_propositions": [
            {
                "name": "五维长期记忆基准",
                "description": "通过属性控制的Haystack编译流程和五维评估框架(信息提取、多会话推理、知识更新、时间推理、拒绝回答),提供三个难度级别(LongMemEval_S 115k tokens、LongMemEval_M ~500会话、LongMemEval_Oracle),结合LLM-as-Judge自动评估,实现首个系统性长期记忆评估标准(ICLR 2025)。"
            },
            {
                "name": "Chain-of-Notes优化方法",
                "description": "创新的两阶段生成方法(先为每个检索会话生成阅读笔记,再基于笔记回答),在LongMemEval_S上准确率提升6.7%(vs CoT),通过索引扩展机制(会话摘要、关键短语提取、用户事实提取、时间事件)实现Recall@5提升5-6%,为长上下文处理提供新思路。"
            }
        ]
    },
    "A-MEM": {
        "value_propositions": [
            {
                "name": "Zettelkasten数字化实现",
                "description": "基于Zettelkasten卡片盒笔记法原则,通过情景记忆与语义记忆的清晰分离架构和动态记忆演化机制,结合基于注意力机制的记忆管理系统和自动元数据生成,实现研究笔记知识图谱的智能化构建和语义关联(NeurIPS 2025)。"
            },
            {
                "name": "高效语义检索优化",
                "description": "采用混合检索策略(向量相似度+BM25算法)和LLM驱动的演化引擎,支持百万级记忆的高效语义检索(<100ms延迟),相比传统向量检索提升记忆关联准确度30%+,降低90%记忆检索响应时间,支持完全本地化部署保障数据主权。"
            }
        ]
    },
    "LightMem": {
        "value_propositions": [
            {
                "name": "LLMlingua-2极限压缩",
                "description": "通过LLMlingua-2压缩技术实现98% token减少和117倍更低token消耗,在LoCoMo benchmark达到最优F1性能(43.24%),相比传统方案节省98%的token成本(中型部署可节省$173,904/月),运行速度提升12倍,159倍更少API调用(ICLR 2026)。"
            },
            {
                "name": "模块化轻量部署方案",
                "description": "采用模块化设计支持多种LLM提供商(OpenAI/DeepSeek/Ollama)和MCP Server集成,通过vLLM本地部署降低成本,提供开箱即用的Docker部署方案,在资源受限环境下实现高精度检索和快速响应的最佳平衡。"
            }
        ]
    },
    "MemOS": {
        "value_propositions": [
            {
                "name": "技能记忆操作系统",
                "description": "通过Multi-Cube Knowledge Base实现持久化技能记忆和跨任务技能复用演进,在多个基准测试中表现优异(LoCoMo 75.80、LongMemEval +40.43%、PrefEval-10 +2568%、PersonaMem +40.75%),支持多模态存储(文本、图像、工具追踪、角色信息)。"
            },
            {
                "name": "统一记忆API与调度",
                "description": "采用统一记忆API和MemScheduler调度器实现多代理共享和记忆优化,通过AI记忆操作系统架构支持跨任务技能演进和持久化,提供Kubernetes容器化部署和内存优化的8-16 vCPUs计算需求估算。"
            }
        ]
    },
    "ReMe": {
        "value_propositions": [
            {
                "name": "模块化多类型记忆",
                "description": "通过可插拔记忆组件支持个人、任务、工具和工作记忆四种类型,采用5种向量数据库后端(SQLite、Elasticsearch、ChromaDB、Qdrant、PostgreSQL)统一接口,实现从小型部署到企业级规模的灵活记忆管理,在AppWorld、BFCL(v3)、FrozenLake基准测试中验证有效性。"
            },
            {
                "name": "跨实体记忆共享与压缩",
                "description": "通过统一向量数据库后端实现跨用户、任务和代理的记忆共享和集体学习,采用LLM驱动的记忆操作(提取、摘要、检索)和工作记忆压缩避免token溢出,支持MCP协议、HTTP API和Python SDK多接口部署,实现长期交互的上下文延续。"
            }
        ]
    },
    "cognee": {
        "value_propositions": [
            {
                "name": "6行代码知识引擎",
                "description": "通过ECL(提取、认知化、加载)流程替代传统RAG,采用知识图谱+向量混合架构(Graph+Vector Hybrid)和Pythonic数据管道,支持30+数据源集成和8种搜索类型,实现6行代码即可构建AI记忆系统的极简开发体验。"
            },
            {
                "name": "多租户混合检索引擎",
                "description": "支持8+向量数据库(LanceDB等)和3+图数据库(Kuzu、Neo4j等)统一集成,采用10+ LLM提供商(litellm+Instructor)和本地优先设计(SQLite+Kuzu+LanceDB零成本),通过模块化任务系统和多租户隔离实现企业级知识管理和权限控制。"
            }
        ]
    },
    "general-agentic-memory": {
        "value_propositions": [
            {
                "name": "JIT即时记忆优化",
                "description": "采用即时(JIT)记忆优化超越预先(AOT)系统,通过双智能体协作架构(MemoryAgent+ResearchAgent)结合混合检索机制(BM25+Dense Vector+Page Index),在LoCoMo、HotpotQA、RULER、NarrativeQA等基准达到SOTA,相比A-MEM、Mem0、MemoryOS、LightMem有更优的F1和BLEU-1指标。"
            },
            {
                "name": "深度研究与记忆保持",
                "description": "通过TTL时间管理支持长期运行应用和基于文件系统的可靠持久化存储,采用模块化插件化设计易于扩展,支持跨模型兼容(GPT-4、Qwen2.5等)和云端API+本地vLLM混合部署,离线保持完整上下文保真度,在线执行深度研究。"
            }
        ]
    },
    "hindsight": {
        "value_propositions": [
            {
                "name": "仿生学习型记忆系统",
                "description": "通过基于反思的记忆系统(Reflect操作)和Chain-of-Thought推理能力,采用仿生记忆架构(世界事实、经验事实、心智模型)实现学习型记忆而非存储型记忆,在LongMemEval基准测试达到业界最高准确率,已在财富500强企业生产环境部署。"
            },
            {
                "name": "多策略融合检索引擎",
                "description": "采用多策略融合检索(语义+BM25+图谱+时序)和多路径事实传播(MPFP)图检索算法,结合交叉编码器重排序提升检索精度和Schema隔离实现多租户安全,支持异步I/O高并发处理和本地优先架构降低云成本,提供完整的SDK支持(Python/TypeScript/Rust)。"
            }
        ]
    },
    "locomo": {
        "value_propositions": [
            {
                "name": "超长期对话记忆基准",
                "description": "首个超长期对话记忆评估基准(时间跨度达240天),通过多任务评估框架(问答5种类型、事件摘要、多模态对话生成)和LLM驱动的对话生成框架(因果事件图和时序依赖),提供标准化评估指标(F1/EM/Recall/BERT-Score多维度)(ACL 2024, SNAP Research)。"
            },
            {
                "name": "分层记忆与多跳推理",
                "description": "采用分层记忆机制(粗粒度会话摘要+细粒度检索增强)和RAG多数据库模式(dialog/observation/summary三种检索策略),支持多模型多模态(GPT/Claude/Gemini+BLIP图像理解)和记忆反思机制,实现跨会话跨时间的复杂问答和多跳推理能力测试。"
            }
        ]
    }
}

def update_meta_json(project_name, value_props):
    """更新单个项目的 meta.json 文件"""
    project_dir = Path(f"/Users/jacky/code/agent-memory-oss-research/data/projects/{project_name}")
    meta_file = project_dir / "meta.json"

    if not meta_file.exists():
        print(f"❌ 文件不存在: {meta_file}")
        return False

    try:
        # 读取现有 meta.json
        with open(meta_file, 'r', encoding='utf-8') as f:
            meta_data = json.load(f)

        # 添加 value_propositions 字段
        meta_data['value_propositions'] = value_props['value_propositions']

        # 写回文件
        with open(meta_file, 'w', encoding='utf-8') as f:
            json.dump(meta_data, f, indent=2, ensure_ascii=False)

        print(f"✅ 已更新: {project_name}")
        return True
    except Exception as e:
        print(f"❌ 更新失败 {project_name}: {e}")
        return False

def main():
    """主函数：批量更新所有项目"""
    print("开始为 25 个项目生成华为式价值判断...\n")

    success_count = 0
    fail_count = 0

    for project_name, value_props in VALUE_PROPOSITIONS.items():
        if update_meta_json(project_name, value_props):
            success_count += 1
        else:
            fail_count += 1

    print(f"\n{'='*60}")
    print(f"执行完成:")
    print(f"  ✅ 成功: {success_count} 个项目")
    print(f"  ❌ 失败: {fail_count} 个项目")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    main()
