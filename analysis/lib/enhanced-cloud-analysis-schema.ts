/**
 * 增强的云服务需求分析数据结构
 * 包含详细的存储、计算、昇腾NPU兼容性和华为云适配性分析
 */

export interface EnhancedCloudNeeds {
  storage: {
    // 现有字段
    types: string[];
    requirements: string[];

    // 详细的向量存储分析
    vector_storage: {
      solution: '专用向量DB' | 'PostgreSQL+pgvector' | '混合方案' | '不需要';
      database: string; // "Pinecone" | "Weaviate" | "Qdrant" | "pgvector" | etc.
      vector_dimension?: number; // 向量维度 (512/768/1024/1536)
      index_type?: string; // "HNSW" | "IVF" | "Flat"
      scale_requirement: string; // "百万级" | "千万级" | "亿级"
    };

    // 主数据库详细要求
    primary_database: {
      type: string; // "PostgreSQL" | "MySQL" | "MongoDB" | "SQLite"
      min_version: string; // "14.0" | "8.0"
      required_extensions: string[]; // ["pgvector", "pg_trgm", "timescaledb"]
      schema_isolation: '单租户' | '多租户Schema隔离' | '多租户Database隔离';
      connection_pool: boolean;
    };

    // 图数据库 (可选)
    graph_database?: {
      type: string; // "Neo4j" | "ArangoDB" | "自建图存储"
      required: boolean; // 是否必需
      use_case: string; // 使用场景
      complexity: '简单' | '中等' | '复杂';
    };

    // 缓存层
    cache: {
      type: string; // "Redis" | "Memcached" | "内存缓存"
      min_version?: string;
      required_modules: string[]; // ["RedisJSON", "RediSearch", "RedisGraph"]
      persistence_required: boolean;
      persistence_strategy?: string; // "AOF" | "RDB" | "混合"
    };

    // 对象存储
    object_storage?: {
      required: boolean;
      use_case: string[]; // ["PDF文档", "音频", "图片", "模型文件"]
      s3_compatible: boolean;
    };

    // 数据规模预估
    data_scale: {
      estimated_total: string; // "10GB" | "100GB" | "1TB+"
      per_user_avg: string; // "10MB" | "100MB"
      growth_rate: string; // "日增1GB" | "月增10GB"
      max_single_record: string; // "1MB" | "10MB"
    };

    // 性能要求
    performance: {
      vector_search_latency: string; // "<100ms" | "<50ms" | "<200ms"
      qps_target: string | number; // "1000" | "5000+"
      p95_latency: string;
      concurrent_connections: string | number;
    };
  };

  compute: {
    // 现有字段
    embedding: boolean;
    gpu_needed: boolean;
    estimated_requirements?: string;

    // CPU详细需求
    cpu: {
      min_vcpu: number;
      recommended_vcpu: number;
      workload_type: 'CPU密集型' | 'IO密集型' | '均衡型';
      instruction_set_requirements?: string[]; // ["AVX2", "AVX-512"] for vector ops
    };

    // 内存详细需求
    memory: {
      min_gb: number;
      recommended_gb: number;
      memory_intensive_ops: string[]; // ["embedding缓存", "模型加载", "向量索引"]
      oom_risk: '低' | '中' | '高';
    };

    // GPU详细分析
    gpu: {
      required: boolean; // 是否必需GPU
      recommended: boolean; // 是否推荐使用GPU
      gpu_models?: string[]; // ["T4", "A100", "L4"]
      use_case: '不需要' | '仅训练' | '仅推理' | '训练和推理';
      vram_requirement?: string; // "8GB" | "16GB" | "24GB+"

      // CUDA依赖分析
      cuda_dependency: {
        has_direct_cuda: boolean; // 是否有直接CUDA调用
        cuda_version?: string;
        cudnn_required?: boolean;
        tensorrt_used?: boolean;
        custom_cuda_kernels: boolean; // 是否有自定义CUDA kernel
        gpu_libraries: string[]; // ["cupy", "rapids", "faiss-gpu"]
      };
    };

    // 🆕 昇腾NPU兼容性分析
    ascend_npu: {
      compatibility_level: '完全兼容' | '容易适配' | '需要工作量' | '困难' | '不适用(无GPU需求)';

      // 框架支持情况
      framework_analysis: {
        framework: string; // "PyTorch" | "TensorFlow" | "PaddlePaddle"
        framework_version: string;
        ascend_support: boolean; // CANN是否支持该框架版本
        ascend_version?: string; // "CANN 8.0" | "CANN 7.0"
      };

      // 迁移工作量评估
      migration: {
        effort_level: '低(1-2天)' | '中(1-2周)' | '高(1-2月)' | '极高(需重构)';
        code_changes_required: string[]; // 需要修改的代码类型
        testing_effort: string; // 测试工作量
      };

      // 阻碍因素
      blockers: string[]; // ["自定义CUDA kernel", "TensorRT推理", "cuDNN特定算子"]

      // 性能预期
      performance_expectation: {
        expected_vs_gpu: string; // "相当" | "略低" | "未知"
        bottlenecks: string[]; // 可能的性能瓶颈
      };

      // 推荐方案
      recommendation: string; // 详细的迁移建议
    };

    // 弹性伸缩
    scalability: {
      horizontal_scaling: boolean; // 支持水平扩展
      stateless: boolean; // 是否无状态
      session_persistence_required: boolean;

      auto_scaling: {
        supported: boolean;
        trigger_metrics: string[]; // ["CPU", "Memory", "QPS", "延迟"]
        scale_down_safe: boolean; // 缩容是否安全
      };
    };

    // Serverless适配性
    serverless: {
      suitable: boolean;
      cold_start_tolerance: string; // "<1s" | "<5s" | "不适合"
      cold_start_actual?: string;
      state_management: '无状态' | 'Redis状态' | 'DB状态';
      reasons?: string[]; // 适合或不适合的原因
    };

    // 并发模型
    concurrency: {
      model: '同步' | '异步' | '混合';
      async_framework?: string; // "asyncio" | "gevent" | "tokio"

      message_queue: {
        required: boolean;
        systems?: string[]; // ["Kafka", "RabbitMQ", "Redis Streams"]
        use_case?: string; // "异步任务" | "事件流"
      };

      long_connection: {
        websocket: boolean;
        sse: boolean; // Server-Sent Events
        streaming: boolean; // 流式响应
      };
    };
  };

  // 外部服务依赖
  external_services: {
    // LLM服务
    llm: {
      required_providers: string[]; // ["OpenAI", "Anthropic", "本地模型"]
      optional_providers?: string[];

      embedding_models: {
        default: string;
        alternatives: string[];
        local_option: boolean;
      };

      llm_models: {
        default: string;
        alternatives: string[];
        local_option: boolean;
      };

      cost_optimization: string[]; // ["请求缓存", "限流", "token压缩"]
    };

    // 其他服务
    object_storage: {
      required: boolean;
      use_case?: string[];
    };

    search_service?: {
      type: string; // "Elasticsearch" | "Meilisearch"
      required: boolean;
    };

    monitoring?: {
      apm: string[]; // ["DataDog", "New Relic"]
      logging: string[]; // ["ELK", "Loki"]
    };
  };

  deployment: {
    // 现有字段
    complexity: number; // 1-10
    containerized: boolean;
    orchestration?: string[];

    // Docker详情
    docker: {
      available: boolean;
      image_size?: string; // "500MB" | "2GB"
      multi_stage_build: boolean;
      base_image?: string; // "python:3.11-slim" | "node:20-alpine"
    };

    // Kubernetes需求
    kubernetes: {
      required: boolean; // 是否必需K8s
      recommended: boolean; // 是否推荐K8s
      helm_chart_available: boolean;
      manifests_available: boolean;
      operators_available: boolean;
      min_k8s_version?: string;
    };

    // 配置管理
    configuration: {
      env_vars_count: number; // 环境变量数量
      secrets_count: number; // 密钥数量
      config_files: string[]; // 配置文件列表
      complexity_level: '简单' | '中等' | '复杂';
      external_config_service?: string; // "Consul" | "etcd"
    };

    // 可观测性
    observability: {
      metrics_export: boolean; // Prometheus metrics
      structured_logging: boolean; // JSON logs
      tracing_support: boolean; // OpenTelemetry/Jaeger
      health_checks: boolean; // /health, /ready endpoints
    };

    // 升级策略
    upgrade: {
      rolling_update_support: boolean;
      blue_green_support: boolean;
      migration_scripts_available: boolean;
      backward_compatible: boolean;
    };
  };

  // 🆕 华为云适配性分析
  huawei_cloud: {
    overall_difficulty: '容易' | '中等' | '困难';

    // 推荐的华为云服务映射
    recommended_services: {
      // 数据库服务
      database: {
        primary: string; // "RDS PostgreSQL 14" | "GaussDB分布式版"
        vector_solution: string; // "RDS+pgvector" | "自建Qdrant on ECS"
        graph?: string; // "GES图引擎服务" | "自建Neo4j"
      };

      // 缓存和存储
      cache: string; // "DCS Redis 7.0 (主备版)" | "DCS Redis (集群版)"
      object_storage?: string; // "OBS对象存储服务"

      // 计算服务
      compute: {
        primary: string; // "ECS通用型" | "ECS内存优化型" | "CCI云容器实例"
        ai_acceleration?: string; // "ModelArts推理服务+昇腾NPU" | "不需要"
        auto_scaling?: string; // "AS弹性伸缩" | "CCI自动伸缩"
      };

      // 中间件
      middleware?: {
        message_queue?: string; // "DMS Kafka" | "DMS RocketMQ"
        api_gateway?: string; // "APIG"
      };

      // 网络和安全
      network: {
        vpc: boolean;
        elb: boolean; // 弹性负载均衡
        nat?: boolean;
      };
    };

    // 成本估算 (人民币/月)
    cost_estimation: {
      small_scale: {
        description: string; // "100用户，1000 QPS"
        monthly_cost: string; // "¥2,000-5,000"
        breakdown: Record<string, string>; // {"数据库": "¥800", "计算": "¥1500"}
      };

      medium_scale: {
        description: string;
        monthly_cost: string;
        breakdown: Record<string, string>;
      };

      large_scale?: {
        description: string;
        monthly_cost: string;
        breakdown: Record<string, string>;
      };
    };

    // 特殊要求和注意事项
    special_requirements: string[]; // ["需要申请pgvector插件", "昇腾NPU需要适配工作"]

    // 架构建议
    architecture_recommendations: string[]; // ["建议使用GaussDB替代PostgreSQL以获得更好的扩展性"]
  };
}
