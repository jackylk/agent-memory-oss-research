# Agent Memory Open Source Research - Analysis Summary

**Research Date:** 2026-02-11
**Total Projects Analyzed:** 24

## Overview

This research identifies and analyzes open source projects focused on Agent Memory for LLMs and AI Agents. The landscape shows significant growth in 2025-2026 with multiple approaches to solving persistent memory challenges.

## Key Findings

### 1. Market Leaders (Stars > 10,000)

- **mem0** (47.1K stars): Universal memory layer with strong LoCoMo benchmark performance (+26% vs OpenAI Memory)
- **claude-mem** (27K stars): Fastest-growing project in GitHub history (20K+ stars in 2 days), TypeScript-based
- **graphiti** (22.7K stars): Temporal knowledge graph approach from Zep
- **letta** (21K stars): Stateful agents framework (formerly MemGPT)
- **supermemory** (16.4K stars): State-of-the-art LongMemEval performance
- **beads** (15.9K stars): Git-backed memory for coding agents
- **cognee** (12.2K stars): Knowledge engine with 6-line integration
- **Memori** (12.1K stars): SQL-native enterprise memory layer

### 2. Emerging Innovators (Recent or Novel Approaches)

- **SimpleMem** (2.8K stars, Jan 2026): Semantic lossless compression, 64% boost over Claude-Mem
- **hindsight** (1.4K stars, Oct 2025): Biomimetic memory structures, SOTA LongMemEval
- **memU** (8.9K stars): 24/7 proactive agents, 92.09% LoCoMo accuracy
- **memtrace** (5 stars, Feb 2026): No embeddings/vector DB, time-series in Go
- **easymemory** (5 stars, Feb 2026): 100% local, hybrid retrieval

### 3. Benchmark Performance Leaders

#### LoCoMo Benchmark
1. **memU**: 92.09% average accuracy
2. **Backboard**: 90.00% overall performance
3. **MemOS**: 75.80% accuracy
4. **SimpleMem**: 43.24% F1 (26.4% improvement over Mem0)
5. **mem0**: +26% vs OpenAI Memory

#### LongMemEval Benchmark
1. **supermemory**: State-of-the-art performance
2. **hindsight**: State-of-the-art (independently reproduced)
3. **MemOS**: +40.43% improvement
4. **LightMem**: Up to 10.9% accuracy gains, 117× fewer tokens

### 4. Technical Approaches

#### Knowledge Graph Based
- **graphiti**: Temporal knowledge graphs with bi-temporal modeling
- **cognee**: Unified graphs + vectors
- **Memary**: Neo4j/FalkorDB with recursive retrieval
- **hindsight**: Biomimetic structures (World, Experiences, Mental Models)

#### Compression & Efficiency
- **SimpleMem**: Semantic lossless compression
- **LightMem**: Lightweight with 117× token reduction
- **claude-mem**: AI-powered compression, ~10× token savings

#### SQL/Traditional Database
- **Memori**: SQL-native with third normal form
- **langgraph-redis**: Redis checkpointer for LangGraph
- **beads**: Git-backed with Dolt database

#### Time-Series & Temporal
- **memtrace**: Time-series using Arc database
- **graphiti**: Bi-temporal data model
- **hindsight**: Temporal filtering and reasoning

#### Novel Architectures
- **general-agentic-memory**: Dual-agent (Memorizer + Researcher)
- **ReMe**: Modular memory types (Task, Personal, Tool, Working)
- **A-MEM**: Zettelkasten-inspired organization

### 5. Programming Language Distribution

- **Python**: 19 projects (79%)
- **TypeScript**: 3 projects (13%) - claude-mem, supermemory
- **Go**: 2 projects (8%) - beads, memtrace

### 6. Academic Recognition

#### ICLR 2026
- LightMem
- MemoryAgentBench

#### NeurIPS 2025
- A-MEM

#### ICLR 2025
- LongMemEval

#### ACL 2024
- LoCoMo

### 7. Integration & Ecosystem

#### LangChain/LangGraph
- memory-agent (official LangChain)
- langgraph-redis
- Memori (LangChain compatible)

#### CrewAI
- mem0 (official integration)

#### Claude Code / MCP
- claude-mem
- SimpleMem
- memtrace
- easymemory
- supermemory
- LightMem

#### Multi-Framework
- mem0: CrewAI, LangGraph
- MemOS: Cross-platform support
- cognee: 30+ data source integrations

### 8. Key Trends for 2026

1. **Memory Infrastructure Boom**: Multiple projects trending in Jan-Feb 2026
2. **MCP Integration**: Strong focus on Model Context Protocol support
3. **Benchmark-Driven Development**: Projects increasingly validated on LoCoMo/LongMemEval
4. **Efficiency Focus**: Token reduction and cost optimization (117×, 159× improvements)
5. **Local-First Options**: Privacy-focused with local deployment (easymemory, Memary)
6. **Proactive Memory**: Shift from reactive to proactive agents (memU)
7. **TypeScript Growth**: Enterprise focus with TS implementations
8. **Git-Native Approaches**: Version control integration (beads, claude-mem)

### 9. Benchmark Projects

Three official benchmark implementations were identified:

1. **LongMemEval** (397 stars): ICLR 2025, 500 questions, 5 core abilities
2. **LoCoMo** (539 stars): ACL 2024, SNAP Research, 10 conversations
3. **MemoryAgentBench** (223 stars): ICLR 2026, multi-turn interactions

### 10. Selection Criteria Met

Projects meeting the research criteria (Stars > 500 OR innovative recent projects):

**High Stars (>500):**
- 15 projects with >500 stars
- 8 projects with >10,000 stars

**Innovative Recent (<6 months):**
- SimpleMem (Jan 2026): Semantic compression
- claude-mem (Feb 2026): Explosive growth
- memtrace (Feb 2026): No embeddings approach
- easymemory (Feb 2026): 100% local

**All Active (Updated within 1 year):**
- 100% of selected projects updated in 2025-2026

## Recommended Deep-Dive Projects

### For Production Use
1. **mem0**: Mature, well-integrated, strong benchmarks
2. **letta**: Established platform, comprehensive API
3. **graphiti**: Enterprise-grade temporal knowledge graphs

### For Research
1. **SimpleMem**: Novel compression approach
2. **hindsight**: Biomimetic memory structures
3. **LightMem**: Exceptional efficiency metrics

### For Specific Use Cases
- **Coding Agents**: claude-mem, beads
- **24/7 Agents**: memU
- **Privacy-First**: easymemory, Memary
- **Time-Series**: memtrace
- **SQL Integration**: Memori

## Sources

This research aggregated data from:
- GitHub search and trending
- Academic paper repositories (arXiv, ACL, ICLR, NeurIPS)
- Awesome lists: TsinghuaC3I/Awesome-Memory-for-Agents, topoteretes/awesome-ai-memory, TeleAI-UAGI/Awesome-Agent-Memory
- Official benchmark repositories
- Project documentation and README files
- Recent blog posts and technical articles (2025-2026)

## Data Quality Notes

- Star counts are approximate as of 2026-02-11
- Some projects may have multiple repositories (forks, mirrors)
- Watchers data not available for all projects
- Creation dates available only for subset of projects
- Benchmark performance metrics taken from project documentation (may vary with different configurations)
