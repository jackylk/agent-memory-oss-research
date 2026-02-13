#!/usr/bin/env python3
"""
Generate enhanced cloud analysis JSON for 6 Agent Memory projects
"""

import json
import os
from pathlib import Path

def create_langgraph_redis_analysis():
    """LangGraph-Redis: Redis-based checkpoint and store for LangGraph"""
    return {
        "storage": {
            "types": ["Redis", "Vector Storage"],
            "requirements": ["Redis 8.0+", "RedisJSON", "RediSearch", "Vector Search"],

            "vector_storage": {
                "solution": "PostgreSQL+pgvector",
                "database": "Redis + RediSearch (内置向量)",
                "vector_dimension": 1536,
                "index_type": "HNSW",
                "scale_requirement": "百万级"
            },

            "primary_database": {
                "type": "Redis",
                "min_version": "8.0",
                "required_extensions": ["RedisJSON", "RediSearch", "RedisGraph"],
                "schema_isolation": "单租户",
                "connection_pool": True
            },

            "graph_database": {
                "type": "内置Redis数据结构",
                "required": False,
                "use_case": "Checkpoint依赖关系和会话状态图",
                "complexity": "简单"
            },

            "cache": {
                "type": "Redis",
                "min_version": "8.0",
                "required_modules": ["RedisJSON", "RediSearch"],
                "persistence_required": True,
                "persistence_strategy": "AOF+RDB混合"
            },

            "object_storage": {
                "required": False,
                "use_case": ["Checkpoint Blob存储"],
                "s3_compatible": True
            },

            "data_scale": {
                "estimated_total": "10GB-100GB",
                "per_user_avg": "50MB",
                "growth_rate": "日增500MB",
                "max_single_record": "10MB"
            },

            "performance": {
                "vector_search_latency": "<100ms",
                "qps_target": "5000+",
                "p95_latency": "<150ms",
                "concurrent_connections": 1000
            }
        },

        "compute": {
            "embedding": True,
            "gpu_needed": False,
            "estimated_requirements": "CPU密集型，需要支持sentence-transformers",

            "cpu": {
                "min_vcpu": 2,
                "recommended_vcpu": 4,
                "workload_type": "IO密集型",
                "instruction_set_requirements": ["AVX2"]
            },

            "memory": {
                "min_gb": 4,
                "recommended_gb": 8,
                "memory_intensive_ops": ["sentence-transformers模型加载", "Redis连接池", "向量索引缓存"],
                "oom_risk": "中"
            },

            "gpu": {
                "required": False,
                "recommended": True,
                "gpu_models": ["T4", "L4"],
                "use_case": "仅推理",
                "vram_requirement": "4GB",

                "cuda_dependency": {
                    "has_direct_cuda": False,
                    "cuda_version": None,
                    "cudnn_required": False,
                    "tensorrt_used": False,
                    "custom_cuda_kernels": False,
                    "gpu_libraries": []
                }
            },

            "ascend_npu": {
                "compatibility_level": "容易适配",

                "framework_analysis": {
                    "framework": "PyTorch",
                    "framework_version": "2.x (via sentence-transformers)",
                    "ascend_support": True,
                    "ascend_version": "CANN 8.0"
                },

                "migration": {
                    "effort_level": "低(1-2天)",
                    "code_changes_required": ["使用torch_npu替换torch.cuda调用(如有)", "验证sentence-transformers在NPU上运行"],
                    "testing_effort": "基础embedding推理测试即可"
                },

                "blockers": [],

                "performance_expectation": {
                    "expected_vs_gpu": "相当",
                    "bottlenecks": ["首次模型加载时间略长"]
                },

                "recommendation": "该项目主要依赖sentence-transformers做embedding，PyTorch 2.x已有昇腾NPU支持。迁移成本极低，建议直接使用ModelArts推理服务部署embedding模型。"
            },

            "scalability": {
                "horizontal_scaling": True,
                "stateless": True,
                "session_persistence_required": False,

                "auto_scaling": {
                    "supported": True,
                    "trigger_metrics": ["CPU", "QPS", "Memory"],
                    "scale_down_safe": True
                }
            },

            "serverless": {
                "suitable": True,
                "cold_start_tolerance": "<5s",
                "cold_start_actual": "3-5s (模型加载)",
                "state_management": "Redis状态",
                "reasons": ["无状态设计", "所有数据存储在Redis", "适合函数计算模式"]
            },

            "concurrency": {
                "model": "异步",
                "async_framework": "asyncio",

                "message_queue": {
                    "required": False,
                    "systems": [],
                    "use_case": None
                },

                "long_connection": {
                    "websocket": False,
                    "sse": False,
                    "streaming": False
                }
            }
        },

        "external_services": {
            "llm": {
                "required_providers": ["OpenAI", "Anthropic", "本地模型"],
                "optional_providers": ["Azure OpenAI", "Google Vertex AI"],

                "embedding_models": {
                    "default": "sentence-transformers/all-MiniLM-L6-v2",
                    "alternatives": ["OpenAI text-embedding-ada-002", "BGE-large-zh"],
                    "local_option": True
                },

                "llm_models": {
                    "default": "gpt-4",
                    "alternatives": ["claude-3-sonnet", "gpt-3.5-turbo"],
                    "local_option": True
                },

                "cost_optimization": ["Embedding本地化", "Checkpoint缓存", "向量相似度去重"]
            },

            "object_storage": {
                "required": False,
                "use_case": ["可选：大型Checkpoint Blob外部存储"]
            },

            "search_service": {
                "type": "RediSearch (内置)",
                "required": True
            },

            "monitoring": {
                "apm": ["OpenTelemetry兼容"],
                "logging": ["结构化JSON日志"]
            }
        },

        "deployment": {
            "complexity": 5,
            "containerized": True,
            "orchestration": ["Kubernetes", "Docker Compose"],

            "docker": {
                "available": False,
                "image_size": "800MB",
                "multi_stage_build": True,
                "base_image": "python:3.11-slim"
            },

            "kubernetes": {
                "required": False,
                "recommended": True,
                "helm_chart_available": False,
                "manifests_available": False,
                "operators_available": False,
                "min_k8s_version": "1.24"
            },

            "configuration": {
                "env_vars_count": 10,
                "secrets_count": 3,
                "config_files": ["redis连接配置"],
                "complexity_level": "简单",
                "external_config_service": None
            },

            "observability": {
                "metrics_export": False,
                "structured_logging": True,
                "tracing_support": False,
                "health_checks": True
            },

            "upgrade": {
                "rolling_update_support": True,
                "blue_green_support": True,
                "migration_scripts_available": True,
                "backward_compatible": True
            }
        },

        "huawei_cloud": {
            "overall_difficulty": "容易",

            "recommended_services": {
                "database": {
                    "primary": "DCS Redis 7.0 企业版 (内存型)",
                    "vector_solution": "DCS Redis 7.0自带RediSearch向量",
                    "graph": "不需要"
                },

                "cache": "DCS Redis 7.0 (主备版，持久化AOF+RDB)",
                "object_storage": "OBS (可选，用于大Blob)",

                "compute": {
                    "primary": "CCI云容器实例 (Serverless)",
                    "ai_acceleration": "ModelArts在线服务 (可选，加速embedding)",
                    "auto_scaling": "CCI自动伸缩"
                },

                "middleware": {
                    "message_queue": "不需要",
                    "api_gateway": "APIG (可选)"
                },

                "network": {
                    "vpc": True,
                    "elb": True,
                    "nat": False
                }
            },

            "cost_estimation": {
                "small_scale": {
                    "description": "1000用户，2000 QPS",
                    "monthly_cost": "¥3,500-6,000",
                    "breakdown": {
                        "DCS Redis 企业版 8GB": "¥1,200",
                        "CCI容器实例 (2核4G x 2)": "¥1,800",
                        "ELB负载均衡": "¥300",
                        "VPC/带宽": "¥500",
                        "ModelArts推理(可选)": "¥700"
                    }
                },

                "medium_scale": {
                    "description": "1万用户，1万 QPS",
                    "monthly_cost": "¥12,000-18,000",
                    "breakdown": {
                        "DCS Redis 集群版 32GB": "¥4,800",
                        "CCI容器实例 (4核8G x 4)": "¥7,200",
                        "ELB负载均衡 (性能型)": "¥800",
                        "VPC/带宽 (增强)": "¥1,500",
                        "OBS存储 (100GB)": "¥50",
                        "ModelArts推理": "¥1,500",
                        "监控APM": "¥500"
                    }
                }
            },

            "special_requirements": [
                "需确认DCS Redis企业版已启用RediSearch和RedisJSON模块",
                "建议使用Redis 7.0+版本以获得完整模块支持",
                "embedding模型可部署到ModelArts在线服务以提升性能"
            ],

            "architecture_recommendations": [
                "采用CCI Serverless部署，按需弹性伸缩降低成本",
                "使用DCS Redis集群版保证高可用和高性能",
                "embedding推理可选ModelArts加速，也可用CPU推理节省成本",
                "生产环境建议启用Redis持久化AOF+RDB保证数据安全",
                "通过APIG统一API网关，便于流量管控和监控"
            ]
        }
    }


def create_memory_agent_analysis():
    """Memory-Agent: LangGraph template with memory tools"""
    return {
        "storage": {
            "types": ["In-Memory Store", "可选外部存储"],
            "requirements": ["LangGraph内置Store", "可选PostgreSQL/Redis"],

            "vector_storage": {
                "solution": "不需要",
                "database": "LangGraph内置Store (无向量搜索)",
                "scale_requirement": "小规模(千级)"
            },

            "primary_database": {
                "type": "内存/可选PostgreSQL",
                "min_version": "14.0",
                "required_extensions": [],
                "schema_isolation": "单租户",
                "connection_pool": False
            },

            "cache": {
                "type": "内存缓存",
                "required_modules": [],
                "persistence_required": False
            },

            "object_storage": {
                "required": False,
                "use_case": [],
                "s3_compatible": False
            },

            "data_scale": {
                "estimated_total": "100MB-1GB",
                "per_user_avg": "1MB",
                "growth_rate": "日增10MB",
                "max_single_record": "100KB"
            },

            "performance": {
                "vector_search_latency": "不适用",
                "qps_target": "100-500",
                "p95_latency": "<200ms",
                "concurrent_connections": 50
            }
        },

        "compute": {
            "embedding": False,
            "gpu_needed": False,
            "estimated_requirements": "轻量级，纯LLM调用",

            "cpu": {
                "min_vcpu": 1,
                "recommended_vcpu": 2,
                "workload_type": "IO密集型",
                "instruction_set_requirements": []
            },

            "memory": {
                "min_gb": 1,
                "recommended_gb": 2,
                "memory_intensive_ops": ["内存Store"],
                "oom_risk": "低"
            },

            "gpu": {
                "required": False,
                "recommended": False,
                "use_case": "不需要",
                "cuda_dependency": {
                    "has_direct_cuda": False,
                    "cuda_version": None,
                    "cudnn_required": False,
                    "tensorrt_used": False,
                    "custom_cuda_kernels": False,
                    "gpu_libraries": []
                }
            },

            "ascend_npu": {
                "compatibility_level": "不适用(无GPU需求)",
                "framework_analysis": {
                    "framework": "N/A",
                    "framework_version": "N/A",
                    "ascend_support": True,
                    "ascend_version": "N/A"
                },
                "migration": {
                    "effort_level": "低(1-2天)",
                    "code_changes_required": [],
                    "testing_effort": "无需GPU测试"
                },
                "blockers": [],
                "performance_expectation": {
                    "expected_vs_gpu": "不适用",
                    "bottlenecks": []
                },
                "recommendation": "该项目不需要GPU/NPU，纯CPU即可运行。"
            },

            "scalability": {
                "horizontal_scaling": True,
                "stateless": False,
                "session_persistence_required": True,
                "auto_scaling": {
                    "supported": True,
                    "trigger_metrics": ["CPU", "Memory"],
                    "scale_down_safe": True
                }
            },

            "serverless": {
                "suitable": True,
                "cold_start_tolerance": "<1s",
                "cold_start_actual": "<500ms",
                "state_management": "DB状态",
                "reasons": ["轻量级", "无复杂依赖"]
            },

            "concurrency": {
                "model": "同步",
                "async_framework": None,
                "message_queue": {
                    "required": False
                },
                "long_connection": {
                    "websocket": False,
                    "sse": True,
                    "streaming": True
                }
            }
        },

        "external_services": {
            "llm": {
                "required_providers": ["OpenAI", "Anthropic"],
                "optional_providers": [],
                "embedding_models": {
                    "default": "不需要",
                    "alternatives": [],
                    "local_option": False
                },
                "llm_models": {
                    "default": "claude-3-5-sonnet",
                    "alternatives": ["gpt-4"],
                    "local_option": False
                },
                "cost_optimization": ["Memory缓存减少重复查询"]
            },
            "object_storage": {
                "required": False
            }
        },

        "deployment": {
            "complexity": 2,
            "containerized": True,
            "orchestration": ["Docker"],
            "docker": {
                "available": False,
                "image_size": "300MB",
                "multi_stage_build": True,
                "base_image": "python:3.11-slim"
            },
            "kubernetes": {
                "required": False,
                "recommended": False,
                "helm_chart_available": False,
                "manifests_available": False,
                "operators_available": False
            },
            "configuration": {
                "env_vars_count": 5,
                "secrets_count": 2,
                "config_files": [".env"],
                "complexity_level": "简单"
            },
            "observability": {
                "metrics_export": False,
                "structured_logging": False,
                "tracing_support": False,
                "health_checks": True
            },
            "upgrade": {
                "rolling_update_support": True,
                "blue_green_support": False,
                "migration_scripts_available": False,
                "backward_compatible": True
            }
        },

        "huawei_cloud": {
            "overall_difficulty": "容易",
            "recommended_services": {
                "database": {
                    "primary": "RDS PostgreSQL 14 (可选)",
                    "vector_solution": "不需要"
                },
                "cache": "不需要",
                "compute": {
                    "primary": "CCI云容器实例",
                    "ai_acceleration": "不需要",
                    "auto_scaling": "CCI自动伸缩"
                },
                "network": {
                    "vpc": True,
                    "elb": False,
                    "nat": False
                }
            },
            "cost_estimation": {
                "small_scale": {
                    "description": "100用户，200 QPS",
                    "monthly_cost": "¥800-1,500",
                    "breakdown": {
                        "CCI容器实例 (1核2G)": "¥600",
                        "LLM API调用": "¥500-1000",
                        "VPC": "¥100"
                    }
                },
                "medium_scale": {
                    "description": "1000用户，1000 QPS",
                    "monthly_cost": "¥3,000-5,000",
                    "breakdown": {
                        "CCI容器实例 (2核4G x 2)": "¥1,800",
                        "RDS PostgreSQL 通用型": "¥600",
                        "LLM API调用": "¥1,500-2,500",
                        "VPC/ELB": "¥300"
                    }
                }
            },
            "special_requirements": [
                "极简模板，主要成本在LLM API调用"
            ],
            "architecture_recommendations": [
                "适合快速原型开发和小规模应用",
                "生产环境建议添加外部存储(RDS/DCS)",
                "LLM调用建议使用盘古大模型降低成本"
            ]
        }
    }


def create_memtrace_analysis():
    """Memtrace: Go-based time-series memory with Arc database"""
    return {
        "storage": {
            "types": ["Time-Series DB", "SQLite"],
            "requirements": ["Arc时序数据库", "高性能写入"],

            "vector_storage": {
                "solution": "不需要",
                "database": "Arc (时序数据库，无向量)",
                "scale_requirement": "千万级时序事件"
            },

            "primary_database": {
                "type": "Arc / SQLite",
                "min_version": "Arc latest",
                "required_extensions": [],
                "schema_isolation": "多租户Database隔离",
                "connection_pool": True
            },

            "cache": {
                "type": "内存缓存",
                "required_modules": [],
                "persistence_required": False
            },

            "object_storage": {
                "required": False,
                "use_case": [],
                "s3_compatible": False
            },

            "data_scale": {
                "estimated_total": "10GB-500GB",
                "per_user_avg": "100MB",
                "growth_rate": "日增1GB (时序事件)",
                "max_single_record": "1MB"
            },

            "performance": {
                "vector_search_latency": "不适用",
                "qps_target": "10000+",
                "p95_latency": "<50ms",
                "concurrent_connections": 5000
            }
        },

        "compute": {
            "embedding": False,
            "gpu_needed": False,
            "estimated_requirements": "Go高性能服务，CPU密集型",

            "cpu": {
                "min_vcpu": 2,
                "recommended_vcpu": 4,
                "workload_type": "CPU密集型",
                "instruction_set_requirements": []
            },

            "memory": {
                "min_gb": 2,
                "recommended_gb": 8,
                "memory_intensive_ops": ["时序数据批量写入", "查询缓存"],
                "oom_risk": "低"
            },

            "gpu": {
                "required": False,
                "recommended": False,
                "use_case": "不需要",
                "cuda_dependency": {
                    "has_direct_cuda": False,
                    "cuda_version": None,
                    "cudnn_required": False,
                    "tensorrt_used": False,
                    "custom_cuda_kernels": False,
                    "gpu_libraries": []
                }
            },

            "ascend_npu": {
                "compatibility_level": "不适用(无GPU需求)",
                "framework_analysis": {
                    "framework": "Go",
                    "framework_version": "1.25+",
                    "ascend_support": True,
                    "ascend_version": "N/A"
                },
                "migration": {
                    "effort_level": "低(1-2天)",
                    "code_changes_required": [],
                    "testing_effort": "无需特殊测试"
                },
                "blockers": [],
                "performance_expectation": {
                    "expected_vs_gpu": "不适用",
                    "bottlenecks": []
                },
                "recommendation": "Go服务无GPU依赖，直接部署到华为云ECS或CCI即可。"
            },

            "scalability": {
                "horizontal_scaling": True,
                "stateless": True,
                "session_persistence_required": False,
                "auto_scaling": {
                    "supported": True,
                    "trigger_metrics": ["CPU", "QPS"],
                    "scale_down_safe": True
                }
            },

            "serverless": {
                "suitable": True,
                "cold_start_tolerance": "<1s",
                "cold_start_actual": "<500ms",
                "state_management": "DB状态",
                "reasons": ["Go编译型语言启动快", "无状态设计"]
            },

            "concurrency": {
                "model": "异步",
                "async_framework": "Go goroutines",
                "message_queue": {
                    "required": False
                },
                "long_connection": {
                    "websocket": False,
                    "sse": True,
                    "streaming": False
                }
            }
        },

        "external_services": {
            "llm": {
                "required_providers": ["任意LLM"],
                "optional_providers": [],
                "embedding_models": {
                    "default": "不需要",
                    "alternatives": [],
                    "local_option": False
                },
                "llm_models": {
                    "default": "可选任意",
                    "alternatives": [],
                    "local_option": True
                },
                "cost_optimization": ["时序存储压缩", "批量写入"]
            },
            "object_storage": {
                "required": False
            }
        },

        "deployment": {
            "complexity": 4,
            "containerized": True,
            "orchestration": ["Kubernetes", "Docker"],
            "docker": {
                "available": True,
                "image_size": "20MB",
                "multi_stage_build": True,
                "base_image": "alpine"
            },
            "kubernetes": {
                "required": False,
                "recommended": True,
                "helm_chart_available": False,
                "manifests_available": False,
                "operators_available": False,
                "min_k8s_version": "1.24"
            },
            "configuration": {
                "env_vars_count": 8,
                "secrets_count": 2,
                "config_files": ["memtrace.toml"],
                "complexity_level": "中等"
            },
            "observability": {
                "metrics_export": True,
                "structured_logging": True,
                "tracing_support": False,
                "health_checks": True
            },
            "upgrade": {
                "rolling_update_support": True,
                "blue_green_support": True,
                "migration_scripts_available": False,
                "backward_compatible": True
            }
        },

        "huawei_cloud": {
            "overall_difficulty": "中等",
            "recommended_services": {
                "database": {
                    "primary": "GaussDB(for Influx) 时序数据库 或 自建Arc on ECS",
                    "vector_solution": "不需要"
                },
                "cache": "DCS Redis (可选，会话缓存)",
                "compute": {
                    "primary": "CCE容器引擎 (K8s)",
                    "ai_acceleration": "不需要",
                    "auto_scaling": "CCE HPA"
                },
                "middleware": {
                    "message_queue": "可选DMS Kafka (事件流)"
                },
                "network": {
                    "vpc": True,
                    "elb": True,
                    "nat": False
                }
            },
            "cost_estimation": {
                "small_scale": {
                    "description": "1000 agents，5000 events/min",
                    "monthly_cost": "¥2,500-4,000",
                    "breakdown": {
                        "ECS 2核4G (Arc数据库)": "¥400",
                        "CCE节点 2核4G x 2": "¥1,200",
                        "ELB": "¥300",
                        "DCS Redis 2GB": "¥200",
                        "VPC/带宽": "¥400"
                    }
                },
                "medium_scale": {
                    "description": "1万 agents，5万 events/min",
                    "monthly_cost": "¥10,000-15,000",
                    "breakdown": {
                        "GaussDB(for Influx) 通用型": "¥3,500",
                        "CCE节点 4核8G x 4": "¥4,800",
                        "ELB (性能型)": "¥800",
                        "DCS Redis 8GB": "¥600",
                        "VPC/带宽": "¥1,000",
                        "DMS Kafka (可选)": "¥1,500"
                    }
                }
            },
            "special_requirements": [
                "需要部署Arc时序数据库(开源项目)到ECS或使用GaussDB(for Influx)替代",
                "Arc数据库需要SSD存储以保证写入性能"
            ],
            "architecture_recommendations": [
                "时序数据库可用GaussDB(for Influx)替代Arc，获得托管服务优势",
                "Go服务编译后体积小、启动快，适合容器化部署",
                "建议使用CCE部署，配合HPA实现自动伸缩",
                "高频写入场景建议使用SSD云盘或本地SSD实例"
            ]
        }
    }



def create_memu_analysis():
    """MemU: 24/7 Proactive Memory with Rust core"""
    return {
        "storage": {
            "types": ["SQLite", "PostgreSQL", "向量存储"],
            "requirements": ["pgvector支持", "SQLModel ORM"],

            "vector_storage": {
                "solution": "PostgreSQL+pgvector",
                "database": "pgvector",
                "vector_dimension": 1536,
                "index_type": "HNSW",
                "scale_requirement": "百万级"
            },

            "primary_database": {
                "type": "PostgreSQL",
                "min_version": "14.0",
                "required_extensions": ["pgvector"],
                "schema_isolation": "多租户Schema隔离",
                "connection_pool": True
            },

            "cache": {
                "type": "内存缓存",
                "required_modules": [],
                "persistence_required": False
            },

            "object_storage": {
                "required": False,
                "use_case": [],
                "s3_compatible": False
            },

            "data_scale": {
                "estimated_total": "10GB-100GB",
                "per_user_avg": "50MB",
                "growth_rate": "日增200MB",
                "max_single_record": "5MB"
            },

            "performance": {
                "vector_search_latency": "<100ms",
                "qps_target": "2000",
                "p95_latency": "<200ms",
                "concurrent_connections": 500
            }
        },

        "compute": {
            "embedding": True,
            "gpu_needed": False,
            "estimated_requirements": "Rust+Python混合，CPU推理",

            "cpu": {
                "min_vcpu": 2,
                "recommended_vcpu": 4,
                "workload_type": "均衡型",
                "instruction_set_requirements": ["AVX2"]
            },

            "memory": {
                "min_gb": 4,
                "recommended_gb": 8,
                "memory_intensive_ops": ["Embedding模型", "向量索引", "Rust核心组件"],
                "oom_risk": "中"
            },

            "gpu": {
                "required": False,
                "recommended": True,
                "gpu_models": ["T4", "L4"],
                "use_case": "仅推理",
                "vram_requirement": "4GB",
                "cuda_dependency": {
                    "has_direct_cuda": False,
                    "cuda_version": None,
                    "cudnn_required": False,
                    "tensorrt_used": False,
                    "custom_cuda_kernels": False,
                    "gpu_libraries": []
                }
            },

            "ascend_npu": {
                "compatibility_level": "容易适配",
                "framework_analysis": {
                    "framework": "PyTorch (via lazyllm)",
                    "framework_version": "2.x",
                    "ascend_support": True,
                    "ascend_version": "CANN 8.0"
                },
                "migration": {
                    "effort_level": "低(1-2天)",
                    "code_changes_required": ["lazyllm框架配置NPU后端", "验证embedding推理"],
                    "testing_effort": "基础推理测试"
                },
                "blockers": [],
                "performance_expectation": {
                    "expected_vs_gpu": "相当",
                    "bottlenecks": ["Rust核心已优化，瓶颈主要在embedding"]
                },
                "recommendation": "使用ModelArts部署embedding模型到昇腾NPU，Rust核心组件CPU即可。整体迁移成本低。"
            },

            "scalability": {
                "horizontal_scaling": True,
                "stateless": True,
                "session_persistence_required": False,
                "auto_scaling": {
                    "supported": True,
                    "trigger_metrics": ["CPU", "Memory", "QPS"],
                    "scale_down_safe": True
                }
            },

            "serverless": {
                "suitable": False,
                "cold_start_tolerance": "<5s",
                "cold_start_actual": "5-8s (Rust+Python混合启动)",
                "state_management": "DB状态",
                "reasons": ["Rust核心需要编译时优化", "proactive agent需要常驻进程"]
            },

            "concurrency": {
                "model": "异步",
                "async_framework": "asyncio",
                "message_queue": {
                    "required": False
                },
                "long_connection": {
                    "websocket": True,
                    "sse": True,
                    "streaming": True
                }
            }
        },

        "external_services": {
            "llm": {
                "required_providers": ["OpenAI", "本地模型"],
                "optional_providers": ["Anthropic", "自定义"],
                "embedding_models": {
                    "default": "OpenAI text-embedding-3-small",
                    "alternatives": ["BGE", "本地模型"],
                    "local_option": True
                },
                "llm_models": {
                    "default": "gpt-4o-mini",
                    "alternatives": ["本地模型"],
                    "local_option": True
                },
                "cost_optimization": ["Proactive预测减少LLM调用", "Memory缓存", "本地embedding"]
            },
            "object_storage": {
                "required": False
            }
        },

        "deployment": {
            "complexity": 6,
            "containerized": True,
            "orchestration": ["Docker", "Kubernetes"],
            "docker": {
                "available": False,
                "image_size": "1.2GB",
                "multi_stage_build": True,
                "base_image": "rust:1.75 + python:3.13"
            },
            "kubernetes": {
                "required": False,
                "recommended": True,
                "helm_chart_available": False,
                "manifests_available": False,
                "operators_available": False,
                "min_k8s_version": "1.24"
            },
            "configuration": {
                "env_vars_count": 12,
                "secrets_count": 4,
                "config_files": ["config.yaml"],
                "complexity_level": "中等"
            },
            "observability": {
                "metrics_export": True,
                "structured_logging": True,
                "tracing_support": False,
                "health_checks": True
            },
            "upgrade": {
                "rolling_update_support": True,
                "blue_green_support": True,
                "migration_scripts_available": True,
                "backward_compatible": True
            }
        },

        "huawei_cloud": {
            "overall_difficulty": "中等",
            "recommended_services": {
                "database": {
                    "primary": "RDS PostgreSQL 14 (增强版)",
                    "vector_solution": "RDS PostgreSQL + pgvector插件",
                    "graph": "不需要"
                },
                "cache": "DCS Redis 6.0 (可选)",
                "compute": {
                    "primary": "CCE容器引擎 (K8s)",
                    "ai_acceleration": "ModelArts在线服务 (embedding)",
                    "auto_scaling": "CCE HPA"
                },
                "network": {
                    "vpc": True,
                    "elb": True,
                    "nat": False
                }
            },
            "cost_estimation": {
                "small_scale": {
                    "description": "500用户，proactive agent常驻",
                    "monthly_cost": "¥4,000-6,500",
                    "breakdown": {
                        "RDS PostgreSQL 2核4G": "¥800",
                        "CCE节点 2核4G x 2": "¥1,200",
                        "ModelArts推理 (embedding)": "¥800",
                        "ELB": "¥300",
                        "VPC/带宽": "¥500",
                        "LLM API": "¥1,000-2,500"
                    }
                },
                "medium_scale": {
                    "description": "5000用户，高频proactive",
                    "monthly_cost": "¥15,000-22,000",
                    "breakdown": {
                        "RDS PostgreSQL 4核8G (高可用)": "¥2,500",
                        "CCE节点 4核8G x 4": "¥4,800",
                        "ModelArts推理 (多实例)": "¥2,500",
                        "DCS Redis 4GB": "¥400",
                        "ELB (性能型)": "¥800",
                        "VPC/带宽": "¥1,000",
                        "LLM API": "¥5,000-10,000"
                    }
                }
            },
            "special_requirements": [
                "需在RDS PostgreSQL上启用pgvector插件",
                "Rust编译需要在容器镜像中完成",
                "Proactive agent需要常驻进程，不适合Serverless"
            ],
            "architecture_recommendations": [
                "使用CCE托管K8s集群，部署常驻proactive agent服务",
                "Embedding推理迁移到ModelArts昇腾服务降低成本",
                "建议使用盘古大模型替代OpenAI API节省成本",
                "RDS PostgreSQL启用pgvector后性能优异，支持百万级向量",
                "Proactive预测可配置定时任务或事件触发"
            ]
        }
    }


def create_simplemem_analysis():
    """SimpleMem: Semantic lossless compression for lifelong memory"""
    return {
        "storage": {
            "types": ["LanceDB", "Qdrant", "本地向量存储"],
            "requirements": ["向量数据库", "GPU加速(可选)"],

            "vector_storage": {
                "solution": "专用向量DB",
                "database": "LanceDB / Qdrant",
                "vector_dimension": 768,
                "index_type": "HNSW",
                "scale_requirement": "百万级"
            },

            "primary_database": {
                "type": "向量数据库(LanceDB)",
                "min_version": "0.25+",
                "required_extensions": [],
                "schema_isolation": "单租户",
                "connection_pool": False
            },

            "cache": {
                "type": "Redis",
                "min_version": "6.0",
                "required_modules": [],
                "persistence_required": True,
                "persistence_strategy": "RDB"
            },

            "object_storage": {
                "required": True,
                "use_case": ["PDF文档", "原始记忆数据"],
                "s3_compatible": True
            },

            "data_scale": {
                "estimated_total": "50GB-500GB",
                "per_user_avg": "200MB",
                "growth_rate": "日增1GB",
                "max_single_record": "50MB"
            },

            "performance": {
                "vector_search_latency": "<50ms",
                "qps_target": "1000",
                "p95_latency": "<100ms",
                "concurrent_connections": 200
            }
        },

        "compute": {
            "embedding": True,
            "gpu_needed": True,
            "estimated_requirements": "GPU推荐，CPU可选但慢",

            "cpu": {
                "min_vcpu": 4,
                "recommended_vcpu": 8,
                "workload_type": "CPU密集型",
                "instruction_set_requirements": ["AVX2", "AVX-512"]
            },

            "memory": {
                "min_gb": 8,
                "recommended_gb": 16,
                "memory_intensive_ops": ["压缩模型加载", "向量索引", "Embedding缓存"],
                "oom_risk": "高"
            },

            "gpu": {
                "required": False,
                "recommended": True,
                "gpu_models": ["T4", "A100", "L4"],
                "use_case": "训练和推理",
                "vram_requirement": "16GB",
                "cuda_dependency": {
                    "has_direct_cuda": True,
                    "cuda_version": "12.8+",
                    "cudnn_required": True,
                    "tensorrt_used": False,
                    "custom_cuda_kernels": False,
                    "gpu_libraries": ["torch", "nvidia-cuda-runtime-cu12", "nvidia-cudnn-cu12"]
                }
            },

            "ascend_npu": {
                "compatibility_level": "需要工作量",
                "framework_analysis": {
                    "framework": "PyTorch",
                    "framework_version": "2.8.0",
                    "ascend_support": True,
                    "ascend_version": "CANN 8.0 (支持PyTorch 2.x)"
                },
                "migration": {
                    "effort_level": "中(1-2周)",
                    "code_changes_required": [
                        "将torch.cuda替换为torch_npu",
                        "验证FlagEmbedding、transformers在NPU上运行",
                        "CUDA特定优化需要改为NPU优化",
                        "调整batch size和内存管理"
                    ],
                    "testing_effort": "需要完整的推理和压缩测试"
                },
                "blockers": [
                    "requirements-gpu.txt中大量CUDA依赖需要替换",
                    "triton依赖可能不兼容NPU"
                ],
                "performance_expectation": {
                    "expected_vs_gpu": "略低",
                    "bottlenecks": ["Transformer推理速度", "向量检索性能"]
                },
                "recommendation": "该项目有明确GPU依赖(requirements-gpu.txt)。迁移到昇腾NPU需要替换所有CUDA库为torch_npu，测试FlagEmbedding和transformers兼容性。建议使用ModelArts + 昇腾910B部署，预计1-2周适配工作。"
            },

            "scalability": {
                "horizontal_scaling": True,
                "stateless": False,
                "session_persistence_required": True,
                "auto_scaling": {
                    "supported": True,
                    "trigger_metrics": ["GPU利用率", "Memory", "QPS"],
                    "scale_down_safe": False
                }
            },

            "serverless": {
                "suitable": False,
                "cold_start_tolerance": "<10s",
                "cold_start_actual": "15-30s (模型加载)",
                "state_management": "DB+向量库状态",
                "reasons": ["模型加载时间长", "GPU资源需求", "向量索引需要预热"]
            },

            "concurrency": {
                "model": "异步",
                "async_framework": "asyncio",
                "message_queue": {
                    "required": True,
                    "systems": ["Redis Streams", "Celery"],
                    "use_case": "异步压缩任务"
                },
                "long_connection": {
                    "websocket": False,
                    "sse": True,
                    "streaming": True
                }
            }
        },

        "external_services": {
            "llm": {
                "required_providers": ["OpenAI", "Anthropic", "本地模型"],
                "optional_providers": ["LM Studio"],
                "embedding_models": {
                    "default": "FlagEmbedding/bge-large-zh-v1.5",
                    "alternatives": ["OpenAI text-embedding-3"],
                    "local_option": True
                },
                "llm_models": {
                    "default": "claude-3.5-sonnet",
                    "alternatives": ["gpt-4", "本地vllm"],
                    "local_option": True
                },
                "cost_optimization": ["本地embedding", "压缩减少token", "MCP复用"]
            },
            "object_storage": {
                "required": True,
                "use_case": ["PDF存储", "原始记忆备份"]
            },
            "search_service": {
                "type": "Tantivy (全文检索)",
                "required": True
            }
        },

        "deployment": {
            "complexity": 7,
            "containerized": True,
            "orchestration": ["Kubernetes"],
            "docker": {
                "available": False,
                "image_size": "3GB",
                "multi_stage_build": True,
                "base_image": "nvidia/cuda:12.8-cudnn9-runtime"
            },
            "kubernetes": {
                "required": False,
                "recommended": True,
                "helm_chart_available": False,
                "manifests_available": False,
                "operators_available": False,
                "min_k8s_version": "1.26"
            },
            "configuration": {
                "env_vars_count": 15,
                "secrets_count": 5,
                "config_files": ["config.py.example"],
                "complexity_level": "复杂"
            },
            "observability": {
                "metrics_export": False,
                "structured_logging": False,
                "tracing_support": False,
                "health_checks": True
            },
            "upgrade": {
                "rolling_update_support": True,
                "blue_green_support": True,
                "migration_scripts_available": False,
                "backward_compatible": True
            }
        },

        "huawei_cloud": {
            "overall_difficulty": "困难",
            "recommended_services": {
                "database": {
                    "primary": "自建LanceDB on ECS (SSD)",
                    "vector_solution": "自建Qdrant on ECS 或 LanceDB",
                    "graph": "不需要"
                },
                "cache": "DCS Redis 6.0 (持久化)",
                "object_storage": "OBS对象存储",
                "compute": {
                    "primary": "ModelArts训练/推理 (昇腾910B)",
                    "ai_acceleration": "昇腾910B NPU (需适配)",
                    "auto_scaling": "弹性推理服务"
                },
                "middleware": {
                    "message_queue": "DMS RabbitMQ (异步任务)"
                },
                "network": {
                    "vpc": True,
                    "elb": True,
                    "nat": False
                }
            },
            "cost_estimation": {
                "small_scale": {
                    "description": "100用户，压缩任务",
                    "monthly_cost": "¥6,000-10,000",
                    "breakdown": {
                        "ECS 8核16G (GPU g6.xlarge.4)": "¥3,500",
                        "自建Qdrant on ECS 4核8G": "¥800",
                        "DCS Redis 4GB": "¥400",
                        "OBS 100GB": "¥50",
                        "VPC/ELB": "¥500",
                        "LLM API": "¥1,000-3,000"
                    }
                },
                "medium_scale": {
                    "description": "1000用户，高频压缩",
                    "monthly_cost": "¥18,000-28,000",
                    "breakdown": {
                        "ModelArts 昇腾910B x 2": "¥8,000",
                        "ECS 16核32G (向量库)": "¥2,500",
                        "DCS Redis 16GB": "¥1,200",
                        "OBS 1TB": "¥500",
                        "DMS RabbitMQ": "¥800",
                        "ELB (性能型)": "¥800",
                        "VPC/带宽": "¥1,200",
                        "LLM API": "¥5,000-12,000"
                    }
                }
            },
            "special_requirements": [
                "需要GPU/NPU支持，需适配昇腾NPU (1-2周工作量)",
                "LanceDB和Qdrant需要自建部署",
                "大量CUDA依赖需要替换为torch_npu",
                "建议使用ModelArts + 昇腾910B进行模型推理"
            ],
            "architecture_recommendations": [
                "GPU密集型应用，建议使用ModelArts昇腾910B替代GPU降低成本",
                "向量数据库LanceDB/Qdrant需自建，部署到SSD ECS实例",
                "使用OBS存储原始PDF和备份数据",
                "异步压缩任务通过DMS消息队列解耦",
                "需要1-2周适配torch_npu，替换CUDA依赖",
                "生产环境建议使用盘古大模型降低LLM成本"
            ]
        }
    }


def create_general_agentic_memory_analysis():
    """GAM: Just-in-Time memory with deep research"""
    return {
        "storage": {
            "types": ["向量数据库", "BM25检索"],
            "requirements": ["FAISS", "BM25", "本地文件存储"],

            "vector_storage": {
                "solution": "专用向量DB",
                "database": "FAISS (CPU) / Qdrant",
                "vector_dimension": 1024,
                "index_type": "HNSW / Flat",
                "scale_requirement": "百万级"
            },

            "primary_database": {
                "type": "本地文件存储",
                "min_version": "N/A",
                "required_extensions": [],
                "schema_isolation": "单租户",
                "connection_pool": False
            },

            "cache": {
                "type": "内存缓存",
                "required_modules": [],
                "persistence_required": False
            },

            "object_storage": {
                "required": True,
                "use_case": ["评估数据集", "检索文档"],
                "s3_compatible": True
            },

            "data_scale": {
                "estimated_total": "10GB-100GB",
                "per_user_avg": "100MB",
                "growth_rate": "日增500MB",
                "max_single_record": "10MB"
            },

            "performance": {
                "vector_search_latency": "<100ms",
                "qps_target": "500-1000",
                "p95_latency": "<200ms",
                "concurrent_connections": 200
            }
        },

        "compute": {
            "embedding": True,
            "gpu_needed": False,
            "estimated_requirements": "CPU推理为主，GPU可选加速",

            "cpu": {
                "min_vcpu": 4,
                "recommended_vcpu": 8,
                "workload_type": "CPU密集型",
                "instruction_set_requirements": ["AVX2"]
            },

            "memory": {
                "min_gb": 8,
                "recommended_gb": 16,
                "memory_intensive_ops": ["FAISS索引", "Embedding模型", "BM25索引"],
                "oom_risk": "中"
            },

            "gpu": {
                "required": False,
                "recommended": True,
                "gpu_models": ["T4", "L4"],
                "use_case": "仅推理",
                "vram_requirement": "8GB",
                "cuda_dependency": {
                    "has_direct_cuda": False,
                    "cuda_version": None,
                    "cudnn_required": False,
                    "tensorrt_used": False,
                    "custom_cuda_kernels": False,
                    "gpu_libraries": []
                }
            },

            "ascend_npu": {
                "compatibility_level": "容易适配",
                "framework_analysis": {
                    "framework": "PyTorch",
                    "framework_version": "2.x (via transformers)",
                    "ascend_support": True,
                    "ascend_version": "CANN 8.0"
                },
                "migration": {
                    "effort_level": "低(1-2天)",
                    "code_changes_required": [
                        "确保transformers使用torch_npu",
                        "FAISS可用CPU版本",
                        "验证embedding推理"
                    ],
                    "testing_effort": "基础推理和检索测试"
                },
                "blockers": [],
                "performance_expectation": {
                    "expected_vs_gpu": "相当",
                    "bottlenecks": ["FAISS检索在CPU上性能足够"]
                },
                "recommendation": "该项目依赖transformers做embedding，无复杂GPU依赖。迁移到昇腾NPU非常简单，使用ModelArts部署embedding模型即可。FAISS可用CPU版本，性能足够。"
            },

            "scalability": {
                "horizontal_scaling": True,
                "stateless": False,
                "session_persistence_required": True,
                "auto_scaling": {
                    "supported": True,
                    "trigger_metrics": ["CPU", "Memory"],
                    "scale_down_safe": True
                }
            },

            "serverless": {
                "suitable": False,
                "cold_start_tolerance": "<5s",
                "cold_start_actual": "5-10s (模型+索引加载)",
                "state_management": "文件存储",
                "reasons": ["需要预加载FAISS索引", "研究任务可能长时间运行"]
            },

            "concurrency": {
                "model": "同步",
                "async_framework": None,
                "message_queue": {
                    "required": False
                },
                "long_connection": {
                    "websocket": False,
                    "sse": False,
                    "streaming": True
                }
            }
        },

        "external_services": {
            "llm": {
                "required_providers": ["OpenAI", "本地vllm"],
                "optional_providers": ["Qwen"],
                "embedding_models": {
                    "default": "FlagEmbedding/bge-base-en-v1.5",
                    "alternatives": ["OpenAI text-embedding-3"],
                    "local_option": True
                },
                "llm_models": {
                    "default": "gpt-4o-mini",
                    "alternatives": ["Qwen2.5", "本地vllm"],
                    "local_option": True
                },
                "cost_optimization": ["本地embedding", "本地vllm推理", "检索缓存"]
            },
            "object_storage": {
                "required": True,
                "use_case": ["数据集存储", "评估数据"]
            }
        },

        "deployment": {
            "complexity": 6,
            "containerized": True,
            "orchestration": ["Docker"],
            "docker": {
                "available": False,
                "image_size": "2GB",
                "multi_stage_build": True,
                "base_image": "python:3.11"
            },
            "kubernetes": {
                "required": False,
                "recommended": False,
                "helm_chart_available": False,
                "manifests_available": False,
                "operators_available": False
            },
            "configuration": {
                "env_vars_count": 10,
                "secrets_count": 3,
                "config_files": ["config文件"],
                "complexity_level": "中等"
            },
            "observability": {
                "metrics_export": False,
                "structured_logging": False,
                "tracing_support": False,
                "health_checks": False
            },
            "upgrade": {
                "rolling_update_support": True,
                "blue_green_support": False,
                "migration_scripts_available": False,
                "backward_compatible": True
            }
        },

        "huawei_cloud": {
            "overall_difficulty": "容易",
            "recommended_services": {
                "database": {
                    "primary": "OBS + ECS本地存储",
                    "vector_solution": "FAISS (CPU版本)",
                    "graph": "不需要"
                },
                "cache": "不需要",
                "object_storage": "OBS对象存储",
                "compute": {
                    "primary": "ECS通用型 (8核16G)",
                    "ai_acceleration": "ModelArts在线服务 (可选)",
                    "auto_scaling": "AS弹性伸缩"
                },
                "network": {
                    "vpc": True,
                    "elb": True,
                    "nat": False
                }
            },
            "cost_estimation": {
                "small_scale": {
                    "description": "研究评估场景",
                    "monthly_cost": "¥2,000-4,000",
                    "breakdown": {
                        "ECS 8核16G": "¥1,200",
                        "OBS 100GB": "¥50",
                        "VPC/带宽": "¥300",
                        "LLM API (OpenAI/盘古)": "¥1,000-2,500"
                    }
                },
                "medium_scale": {
                    "description": "生产应用场景",
                    "monthly_cost": "¥8,000-12,000",
                    "breakdown": {
                        "ECS 16核32G x 2": "¥4,800",
                        "ModelArts推理": "¥1,500",
                        "OBS 500GB": "¥250",
                        "ELB": "¥500",
                        "VPC/带宽": "¥800",
                        "LLM API": "¥2,000-5,000"
                    }
                }
            },
            "special_requirements": [
                "FAISS使用CPU版本即可，无需GPU",
                "评估数据集建议存储到OBS",
                "本地vllm推理可降低LLM成本"
            ],
            "architecture_recommendations": [
                "适合研究和评估场景，部署简单",
                "FAISS CPU版本性能足够，无需GPU加速",
                "建议使用盘古大模型或本地vllm降低LLM成本",
                "Embedding可部署到ModelArts昇腾服务加速",
                "评估数据集通过OBS管理，支持版本控制",
                "生产环境建议使用AS自动伸缩应对突发流量"
            ]
        }
    }


def main():
    """Generate all analysis JSON files"""
    projects = {
        "langgraph-redis": create_langgraph_redis_analysis,
        "memory-agent": create_memory_agent_analysis,
        "memtrace": create_memtrace_analysis,
        "memU": create_memu_analysis,
        "SimpleMem": create_simplemem_analysis,
        "general-agentic-memory": create_general_agentic_memory_analysis
    }

    base_path = Path("/Users/jacky/code/agent-memory-oss-research/data/projects")

    for project_name, create_func in projects.items():
        project_path = base_path / project_name
        project_path.mkdir(parents=True, exist_ok=True)

        output_file = project_path / "enhanced-cloud-analysis.json"

        analysis = create_func()

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(analysis, f, ensure_ascii=False, indent=2)

        print(f"✓ Generated: {output_file}")
        print(f"  - Storage: {analysis['storage']['primary_database']['type']}")
        print(f"  - GPU needed: {analysis['compute']['gpu_needed']}")
        print(f"  - NPU compatibility: {analysis['compute']['ascend_npu']['compatibility_level']}")
        print(f"  - Huawei Cloud difficulty: {analysis['huawei_cloud']['overall_difficulty']}")
        print()

if __name__ == "__main__":
    main()

