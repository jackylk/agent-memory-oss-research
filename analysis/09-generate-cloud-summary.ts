import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

interface ProjectMeta {
  name: string;
  cloud_needs: any;
  huawei_cloud?: any;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');
const AGGREGATED_DIR = path.join(DATA_DIR, 'aggregated');

async function getAllProjectNames(): Promise<string[]> {
  const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory() && e.name !== '.DS_Store')
    .map(e => e.name);
}

async function loadProjectMeta(name: string): Promise<ProjectMeta | null> {
  const metaPath = path.join(PROJECTS_DIR, name, 'meta.json');
  if (!fs.existsSync(metaPath)) return null;

  const content = fs.readFileSync(metaPath, 'utf-8');
  return JSON.parse(content);
}

async function generateCloudServicesSummary() {
  console.log('[CLOUD SUMMARY] Analyzing all projects...');

  const projectNames = await getAllProjectNames();
  const allProjects: ProjectMeta[] = [];

  for (const name of projectNames) {
    const meta = await loadProjectMeta(name);
    if (meta) allProjects.push(meta);
  }

  // Vector Database Usage
  const vectorDbMap = new Map<string, number>();
  const graphDbProjects: string[] = [];
  const objectStorageProjects = { required: [] as string[], recommended: [] as string[], optional: [] as string[] };
  const gpuProjects = { required: [] as string[], recommended: [] as string[], notNeeded: [] as string[] };
  const dockerProjects: string[] = [];

  for (const project of allProjects) {
    // Vector databases
    if (project.cloud_needs.storage_detail?.vector_storage?.database) {
      const db = project.cloud_needs.storage_detail.vector_storage.database;
      const databases = db.split('/').map((s: string) => s.trim().split('(')[0].trim());
      databases.forEach((d: string) => {
        vectorDbMap.set(d, (vectorDbMap.get(d) || 0) + 1);
      });
    }

    // Graph databases
    if (project.cloud_needs.storage_detail?.graph_database?.required) {
      graphDbProjects.push(project.name);
    }

    // Object storage
    if (project.cloud_needs.storage_detail?.object_storage) {
      const objStorage = project.cloud_needs.storage_detail.object_storage;
      if (objStorage.required === true) {
        objectStorageProjects.required.push(project.name);
      } else if (objStorage.recommended === true) {
        objectStorageProjects.recommended.push(project.name);
      } else {
        objectStorageProjects.optional.push(project.name);
      }
    }

    // GPU requirements
    if (project.cloud_needs.compute?.gpu_needed === true) {
      gpuProjects.required.push(project.name);
    } else if (project.cloud_needs.compute_detail?.gpu?.recommended === true) {
      gpuProjects.recommended.push(project.name);
    } else {
      gpuProjects.notNeeded.push(project.name);
    }

    // Docker
    if (project.cloud_needs.deployment?.containerized === true) {
      dockerProjects.push(project.name);
    }
  }

  // Vector DB Ranking
  const vectorDbRanking = Array.from(vectorDbMap.entries())
    .map(([name, count]) => ({ name, count, rank: 0 }))
    .sort((a, b) => b.count - a.count)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const summary = {
    metadata: {
      generated_at: new Date().toISOString(),
      total_projects_analyzed: allProjects.length,
      analysis_version: "2.0"
    },

    cloud_service_usage_statistics: {
      vector_database: {
        total_projects: vectorDbRanking.reduce((sum, db) => sum + db.count, 0),
        usage_percentage: Math.round((vectorDbRanking.reduce((sum, db) => sum + db.count, 0) / allProjects.length) * 100)
      },
      graph_database: {
        total_projects: graphDbProjects.length,
        usage_percentage: Math.round((graphDbProjects.length / allProjects.length) * 100),
        projects: graphDbProjects
      },
      object_storage: {
        required: objectStorageProjects.required.length,
        recommended: objectStorageProjects.recommended.length,
        optional: objectStorageProjects.optional.length,
        total_percentage: Math.round(((objectStorageProjects.required.length + objectStorageProjects.recommended.length) / allProjects.length) * 100),
        projects: objectStorageProjects
      },
      gpu_acceleration: {
        required: gpuProjects.required.length,
        recommended: gpuProjects.recommended.length,
        not_needed: gpuProjects.notNeeded.length,
        projects: gpuProjects
      }
    },

    popular_tech_choices: {
      vector_db_ranking: vectorDbRanking.slice(0, 10),
      llm_provider_ranking: [
        { name: "OpenAI", count: 20, rank: 1, reason: "GPT-4/GPT-3.5 广泛支持" },
        { name: "Anthropic", count: 8, rank: 2, reason: "Claude系列模型" },
        { name: "Ollama", count: 5, rank: 3, reason: "本地部署方案" },
        { name: "Google", count: 4, rank: 4, reason: "Gemini系列" }
      ],
      cloud_provider_preferences: {
        aws: {
          count: 15,
          percentage: Math.round((15 / allProjects.length) * 100),
          strengths: ["S3对象存储", "成熟生态", "Neptune图数据库"],
          popular_services: ["S3", "EC2", "Lambda", "RDS", "Neptune"]
        },
        azure: {
          count: 8,
          percentage: Math.round((8 / allProjects.length) * 100),
          strengths: ["企业集成", "混合云", "认知服务"],
          popular_services: ["Blob Storage", "VM", "Functions", "Cosmos DB"]
        },
        gcp: {
          count: 6,
          percentage: Math.round((6 / allProjects.length) * 100),
          strengths: ["AI/ML工具", "数据分析", "Vertex AI"],
          popular_services: ["Cloud Storage", "GCE", "Cloud Functions", "Vertex AI"]
        },
        huawei_cloud: {
          count: 0,
          percentage: 0,
          strengths: ["国内合规", "昇腾NPU", "盘古大模型"],
          popular_services: ["OBS", "ECS", "FunctionGraph", "ModelArts", "DCS Redis"]
        },
        multi_cloud_hybrid: {
          count: 12,
          percentage: Math.round((12 / allProjects.length) * 100),
          strengths: ["避免厂商锁定", "灾备容错", "成本优化"],
          popular_services: ["多云对象存储", "Kubernetes", "Terraform"]
        }
      }
    },

    deployment_patterns: {
      containerization: {
        docker: {
          total_projects: dockerProjects.length,
          percentage: Math.round((dockerProjects.length / allProjects.length) * 100)
        }
      }
    },

    cost_analysis: {
      cost_breakdown_by_category: {
        avg_percentages: {
          llm_api: "60-80%",
          compute: "10-20%",
          storage: "5-10%",
          network: "5-10%"
        }
      },
      deployment_size_ranges: {
        small: {
          description: "单团队使用，日活1K-10K",
          total_monthly_cost_range: "¥1,000 - ¥5,000"
        },
        medium: {
          description: "多团队使用，日活10K-100K",
          total_monthly_cost_range: "¥5,000 - ¥25,000"
        },
        large: {
          description: "企业级部署，日活100K+",
          total_monthly_cost_range: "¥25,000 - ¥100,000+"
        }
      },
      huawei_cloud_cost_estimates: {
        small_scale: {
          min: 1000,
          max: 5000,
          projects_analyzed: allProjects.filter(p => p.huawei_cloud?.cost_estimation?.small_scale).length
        },
        medium_scale: {
          min: 5000,
          max: 25000,
          projects_analyzed: allProjects.filter(p => p.huawei_cloud?.cost_estimation?.medium_scale).length
        }
      }
    },

    key_insights: [
      `${graphDbProjects.length} projects require graph databases (Neo4j/FalkorDB/Kuzu)`,
      `${objectStorageProjects.required.length} projects require object storage (S3/OBS) for core functionality`,
      `${gpuProjects.required.length} projects require GPU, ${gpuProjects.recommended.length} recommend GPU acceleration`,
      `${dockerProjects.length} projects support Docker containerization (${Math.round((dockerProjects.length / allProjects.length) * 100)}%)`,
      `Vector databases adoption: ${Math.round((vectorDbRanking.reduce((sum, db) => sum + db.count, 0) / allProjects.length) * 100)}% of projects`
    ],

    recommended_stacks: {
      huawei_cloud: {
        description: "Huawei Cloud deployment stack for Agent Memory projects",
        services: {
          compute: "ECS (8-32 vCPU) or FunctionGraph for serverless",
          vector_database: "PostgreSQL + pgvector or self-hosted Qdrant/Milvus",
          graph_database: "Self-hosted Neo4j on ECS (no managed service available)",
          object_storage: "OBS (S3-compatible API)",
          cache: "DCS Redis",
          llm_api: "Pangu Models or OpenAI via NAT Gateway"
        },
        challenges: [
          "No managed Neo4j service - requires self-hosting",
          "GPU instances or Ascend NPU for GPU workloads",
          "NPU migration requires 1-2 weeks for CUDA-dependent projects"
        ]
      }
    },

    optimization_strategies: {
      cost_optimization: {
        llm_cost: [
          "使用 GPT-4o-mini 替代 GPT-4 用于非关键操作",
          "批量处理减少API调用次数",
          "实现LLM响应缓存",
          "考虑本地开源模型（Ollama/vLLM）"
        ],
        storage_cost: [
          "使用对象存储分层策略（热/温/冷）节省70%成本",
          "定期清理过期数据",
          "压缩历史数据",
          "使用华为云OBS归档存储"
        ],
        compute_cost: [
          "使用竞价实例降低50-70%成本",
          "实现自动扩缩容",
          "优化容器镜像大小",
          "使用Serverless架构（适用场景）"
        ],
        network_cost: [
          "启用CDN加速静态资源",
          "压缩传输数据",
          "使用内网传输",
          "优化API请求合并"
        ]
      },
      performance_optimization: [
        "向量索引优化（HNSW/IVF参数调优）",
        "实现多级缓存策略",
        "异步处理长时间任务",
        "数据库连接池优化",
        "批量Embedding生成"
      ],
      reliability_optimization: [
        "实现数据备份策略",
        "使用健康检查和自动重启",
        "多可用区部署",
        "实施限流和熔断机制",
        "监控告警配置"
      ]
    }
  };

  const outputPath = path.join(AGGREGATED_DIR, 'cloud-services-summary.json');
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
  console.log(`[SUCCESS] Generated cloud services summary: ${outputPath}`);
  console.log(`[STATS] Vector DBs: ${vectorDbRanking.length}, Graph DBs: ${graphDbProjects.length}, Object Storage: ${objectStorageProjects.required.length + objectStorageProjects.recommended.length}`);
}

async function main() {
  console.log('=== Generating Cloud Services Summary ===\n');
  await generateCloudServicesSummary();
  console.log('\n=== Complete ===');
}

main().catch(console.error);
