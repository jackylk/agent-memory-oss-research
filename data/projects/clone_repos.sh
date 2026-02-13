#!/bin/bash

projects=(
"A-MEM|https://github.com/agiresearch/A-mem"
"Backboard-Locomo-Benchmark|https://github.com/Backboard-io/Backboard-Locomo-Benchmark"
"LightMem|https://github.com/zjunlp/LightMem"
"LongMemEval|https://github.com/xiaowu0162/LongMemEval"
"MemOS|https://github.com/MemTensor/MemOS"
"Memary|https://github.com/kingjulio8238/Memary"
"Memori|https://github.com/MemoriLabs/Memori"
"MemoryAgentBench|https://github.com/HUST-AI-HYZ/MemoryAgentBench"
"ReMe|https://github.com/agentscope-ai/ReMe"
"beads|https://github.com/steveyegge/beads"
"claude-mem|https://github.com/thedotmack/claude-mem"
"cognee|https://github.com/topoteretes/cognee"
"easymemory|https://github.com/JustVugg/easymemory"
"general-agentic-memory|https://github.com/VectorSpaceLab/general-agentic-memory"
"hindsight|https://github.com/vectorize-io/hindsight"
"langgraph-redis|https://github.com/redis-developer/langgraph-redis"
"letta|https://github.com/letta-ai/letta"
"locomo|https://github.com/snap-research/locomo"
"memU|https://github.com/NevaMind-AI/memU"
"memory-agent|https://github.com/langchain-ai/memory-agent"
"memtrace|https://github.com/Basekick-Labs/memtrace"
"supermemory|https://github.com/supermemoryai/supermemory"
)

total=${#projects[@]}
count=0

for project_info in "${projects[@]}"; do
  IFS='|' read -r project url <<< "$project_info"
  count=$((count + 1))
  
  echo "[$count/$total] 克隆 $project..."
  
  if [ -d "$project/repo" ]; then
    echo "  ⏭️  已存在，跳过"
  else
    mkdir -p "$project"
    git clone --depth 1 "$url" "$project/repo" 2>&1 | grep -E "(Cloning|done|error|fatal)" || true
    if [ -d "$project/repo" ]; then
      echo "  ✅ 完成"
    else
      echo "  ❌ 失败"
    fi
  fi
  echo ""
done

echo "克隆完成！"
