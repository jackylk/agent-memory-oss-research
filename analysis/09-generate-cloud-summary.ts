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
      vector_db_ranking: vectorDbRanking.slice(0, 10)
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

    optimization_strategies: [
      "Use object storage tiering (hot/warm/cold) to reduce costs by 70%",
      "Consider local embedding models to reduce API costs",
      "Batch processing for embedding generation",
      "Use smaller LLM models (e.g., GPT-4o-mini) for non-critical operations",
      "Implement caching for frequently accessed memories"
    ]
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
