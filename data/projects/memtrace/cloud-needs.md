# Memtrace Cloud Service Requirements Analysis

## Executive Summary

**Project**: Memtrace - LLM-Agnostic Memory Layer
**Architecture**: Go microservice + Arc time-series database + SQLite metadata
**Key Differentiator**: No embeddings, no vector DB, plain text temporal memory
**Cloud Complexity**: Moderate (4/5) - Requires time-series database and persistent storage

---

## 1. Compute Requirements

### 1.1 CPU Specifications
| Deployment Size | vCPUs | Justification |
|----------------|-------|---------------|
| Small (1-5 agents) | 2 | Lightweight Go runtime, minimal concurrent load |
| Medium (10-50 agents) | 4-8 | Concurrent write batching and Arc query processing |
| Large (100+ agents) | 16-32 | High write throughput (1000+ writes/sec) |

**Critical Note**: **No GPU required** - Zero ML workloads, no embedding generation, no vector operations.

### 1.2 Memory Requirements
- **Minimum**: 512MB RAM (basic operation)
- **Recommended**: 2-4GB RAM (production with buffer overhead)
- **Peak Usage**: 100MB write buffer (10,000 record cap at ~10KB each)
- **Scaling Factor**: Memory requirements scale with concurrent connections, not data volume

### 1.3 Scaling Characteristics
- **Stateless Design**: Horizontal scaling via load balancer
- **Bottleneck**: Arc database write capacity, not Memtrace CPU
- **Recommendation**: Start with 2-4 vCPUs, scale horizontally beyond 1000 writes/sec

---

## 2. Storage Architecture

### 2.1 Time-Series Database (Arc)

**Database Type**: Arc - Parquet-based time-series database
- **Storage Format**: Columnar Parquet files with compression
- **Write Pattern**: Append-only (no updates or deletes)
- **Query Pattern**: Time-windowed SQL over Parquet

**Cloud Deployment Options**:
1. **Co-located with Memtrace**: Single VM/container for simplicity
2. **Dedicated Arc Cluster**: Separate service for scale (100M+ memories)
3. **Managed Time-Series Alternatives** (with adapter layer):
   - InfluxDB Cloud
   - TimescaleDB (PostgreSQL extension)
   - ClickHouse
   - QuestDB

**Storage Estimates**:
| Workload | Memories/Day | Average Size | Daily Storage | Annual Storage |
|----------|--------------|--------------|---------------|----------------|
| Small    | 1,000        | 500 bytes    | 500 KB        | 180 MB         |
| Medium   | 100,000      | 1 KB         | 100 MB        | 36 GB          |
| Large    | 1,000,000    | 2 KB         | 2 GB          | 730 GB         |

**Cost Implications**:
- **No Vector Database**: Eliminates expensive vector index storage
- **No Embedding Storage**: No 1,536-dimension float32 vectors to store
- **Compression Benefit**: Parquet achieves 5-10× compression on text data

### 2.2 Metadata Storage (SQLite)

**Database**: SQLite embedded file
- **Size**: < 10MB for typical deployments
- **Contents**: Sessions, agents, organizations, API keys (bcrypt hashed)
- **Persistence**: Requires persistent volume mount in containers
- **Backup**: Simple file-based backup of `memtrace.db`

**High Availability Consideration**:
- SQLite is single-file, not HA-compatible
- For production HA: Migrate to PostgreSQL or MySQL (requires code adaptation)
- Current limitation: Single point of failure for metadata

### 2.3 Storage Service Requirements

**Persistent Volumes**:
- **Arc Data**: Large block storage (SSD recommended for query performance)
  - AWS: EBS gp3 (3,000 IOPS baseline)
  - GCP: Persistent SSD
  - Azure: Premium SSD
- **SQLite Metadata**: Small persistent volume (1-10GB sufficient)

**Backup Storage**:
- **Object Storage**: S3/GCS/Azure Blob for Arc Parquet backups
- **Retention**: Align with data retention policy (e.g., 30-90 days)
- **Archival**: Glacier/Coldline for long-term historical data

---

## 3. Network Requirements

### 3.1 Bandwidth Estimates
| Workload | Writes/sec | Read Queries/sec | Estimated Bandwidth |
|----------|-----------|------------------|---------------------|
| Small    | 1-10      | 5-20             | < 100 Kbps          |
| Medium   | 10-100    | 20-100           | 1-5 Mbps            |
| Large    | 100-1000  | 100-500          | 10-50 Mbps          |

### 3.2 Latency Requirements
- **Write Latency**: < 100ms (buffered writes, async flush)
- **Query Latency**: 10-200ms (depends on Arc query performance)
- **Session Context Generation**: 50-500ms (multi-query aggregation)

### 3.3 Port Configuration
- **API Port**: 9100 (HTTP/HTTPS)
- **Arc Connection**: Internal port 8000 (HTTP to Arc database)
- **Health Checks**: `/health` and `/ready` endpoints (no auth required)

### 3.4 TLS/SSL Requirements
- **Not Built-In**: Memtrace uses plain HTTP
- **Recommendation**: Terminate TLS at load balancer or reverse proxy (Nginx, Caddy)
- **Arc Connection**: Configure Arc with HTTPS for encrypted internal traffic

---

## 4. Database Service Requirements

### 4.1 Primary Database: Arc Time-Series DB

**Deployment Characteristics**:
- **Self-Hosted**: Deploy Arc as separate Docker container or VM
- **Connection**: HTTP API with optional API key authentication
- **Concurrency**: 10 idle connections per Memtrace instance
- **Timeouts**: 5s connect, 30s query (configurable)

**Managed Alternative Considerations**:
| Service | Compatibility | Effort | Cost |
|---------|--------------|--------|------|
| InfluxDB Cloud | High | Adapter layer required | $50-200/month |
| TimescaleDB | High | SQL adapter required | $30-150/month |
| ClickHouse | Medium | Schema redesign | $100-400/month |
| QuestDB | Medium | SQL adapter | $50-200/month |

**Recommendation**: Self-host Arc for cost efficiency and simplicity (no vendor lock-in).

### 4.2 Metadata Database: SQLite

**Characteristics**:
- **Embedded**: No separate database service required
- **Persistence**: File-based (`./data/memtrace.db`)
- **Performance**: Low-volume CRUD (sessions, agents, API keys)

**High Availability Path**:
For production HA, migrate to:
- **PostgreSQL**: Cloud-managed (RDS, Cloud SQL, Azure Database)
- **MySQL**: Alternative managed option
- **Implementation**: Requires Go code changes (replace SQLite driver)

---

## 5. Deployment Architecture

### 5.1 Single-VM Deployment (Development/Small Teams)

```
┌─────────────────────────────────────┐
│  VM Instance (4 vCPU, 4GB RAM)      │
│                                     │
│  ┌──────────────┐  ┌─────────────┐ │
│  │  Memtrace    │  │    Arc      │ │
│  │  (Port 9100) │──│ (Port 8000) │ │
│  └──────────────┘  └─────────────┘ │
│        │                 │          │
│   ┌────▼────┐      ┌────▼──────┐   │
│   │ SQLite  │      │  Parquet  │   │
│   │ Metadata│      │   Files   │   │
│   └─────────┘      └───────────┘   │
└─────────────────────────────────────┘
```

**Use Case**: Development, small teams, single-agent systems
**Cost**: $20-50/month (AWS t3.medium, GCP e2-medium)

### 5.2 Container Orchestration (Production Kubernetes)

```
┌────────────────────────────────────────────────────┐
│  Kubernetes Cluster                                │
│                                                    │
│  ┌──────────────────────────────────────────┐     │
│  │  Memtrace Deployment (3 replicas)        │     │
│  │  ┌──────┐  ┌──────┐  ┌──────┐            │     │
│  │  │ Pod1 │  │ Pod2 │  │ Pod3 │            │     │
│  │  └───┬──┘  └───┬──┘  └───┬──┘            │     │
│  │      └─────────┼─────────┘               │     │
│  └────────────────┼─────────────────────────┘     │
│                   │                               │
│  ┌────────────────▼───────────────────┐           │
│  │  Arc StatefulSet (3 replicas)      │           │
│  │  ┌──────┐  ┌──────┐  ┌──────┐      │           │
│  │  │ Arc1 │  │ Arc2 │  │ Arc3 │      │           │
│  │  └───┬──┘  └───┬──┘  └───┬──┘      │           │
│  └──────┼─────────┼─────────┼─────────┘           │
│         │         │         │                     │
│  ┌──────▼─────────▼─────────▼─────────┐           │
│  │  Persistent Volume Claims (SSD)    │           │
│  └─────────────────────────────────────┘           │
└────────────────────────────────────────────────────┘
```

**Use Case**: Production multi-agent systems, high availability
**Features**: Auto-scaling, rolling updates, health checks, load balancing

### 5.3 Hybrid Cloud Architecture

```
┌─────────────────────┐      ┌──────────────────────┐
│   Cloud (AWS/GCP)   │      │   On-Premises DC     │
│                     │      │                      │
│  ┌──────────────┐   │      │  ┌─────────────┐    │
│  │  Memtrace    │   │ VPN  │  │    Arc      │    │
│  │  (3 replicas)│───┼──────┼──│  Cluster    │    │
│  └──────────────┘   │      │  └─────────────┘    │
│        │            │      │         │           │
│  ┌─────▼──────┐     │      │  ┌──────▼────────┐  │
│  │ PostgreSQL │     │      │  │  Parquet Data │  │
│  │  (Managed) │     │      │  │  (Compliance) │  │
│  └────────────┘     │      │  └───────────────┘  │
└─────────────────────┘      └──────────────────────┘
```

**Use Case**: Data sovereignty, regulatory compliance, latency optimization
**Cost**: Higher due to VPN/VPC peering charges

---

## 6. Operational Requirements

### 6.1 Configuration Management

**Configuration Sources** (priority order):
1. Environment variables (`MEMTRACE_*` prefix)
2. Config file (`memtrace.toml`)
3. Defaults

**Critical Environment Variables**:
```bash
MEMTRACE_SERVER_PORT=9100
MEMTRACE_ARC_URL=http://arc-service:8000
MEMTRACE_ARC_API_KEY=<secret>
MEMTRACE_LOG_LEVEL=info
MEMTRACE_LOG_FORMAT=json
MEMTRACE_AUTH_DB_PATH=/app/data/memtrace.db
```

**Secrets Management**:
- Store API keys in: AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault
- Inject at runtime via environment variables
- Never commit secrets to version control

### 6.2 Monitoring Requirements

**Health Endpoints**:
- `GET /health` - Service liveness (no auth)
- `GET /ready` - Arc connectivity readiness (no auth)

**Recommended Metrics** (requires custom Prometheus exporter):
- `memtrace_writes_total` (counter)
- `memtrace_queries_total` (counter)
- `memtrace_buffer_size` (gauge)
- `memtrace_arc_latency_seconds` (histogram)
- `memtrace_errors_total` (counter by type)

**Logging**:
- Format: Structured JSON (production) or console (development)
- Levels: debug, info, warn, error
- Destination: stdout (integrate with ELK, Datadog, CloudWatch)

### 6.3 Backup & Recovery

**SQLite Metadata**:
- **Frequency**: Daily
- **Method**: File copy during low-traffic window
- **Retention**: 7-30 days
- **Recovery**: Replace file and restart

**Arc Time-Series Data**:
- **Frequency**: Based on retention policy (daily/weekly)
- **Method**: Parquet file backup to S3/GCS
- **Retention**: Align with compliance requirements
- **Recovery**: Arc restore procedures

**RTO/RPO**:
- **RTO**: < 15 minutes (container restart + volume mount)
- **RPO**: 1 second (flush interval) to 24 hours (backup interval)

---

## 7. Scalability Analysis

### 7.1 Horizontal Scaling

**Write Throughput Scaling**:
| Instances | vCPUs | Est. Writes/sec | Bottleneck |
|-----------|-------|-----------------|------------|
| 1         | 4     | 500-1,000       | Single Arc connection |
| 3         | 12    | 1,500-3,000     | Arc write capacity |
| 10        | 40    | 5,000-10,000    | Arc cluster required |

**Read Throughput Scaling**:
- Linear scaling with instances (stateless queries)
- Arc cluster enables parallel query execution
- Context generation benefits from multi-core processing

### 7.2 Data Volume Scaling

**Query Performance by Data Volume**:
| Memories | Storage | Query Latency | Action Required |
|----------|---------|---------------|-----------------|
| < 1M     | < 1GB   | < 50ms        | Single Arc node |
| 1M-10M   | 1-10GB  | 50-200ms      | SSD storage for Arc |
| 10M-100M | 10-100GB| 100-500ms     | Arc cluster + partitioning |
| > 100M   | > 100GB | 500ms+        | Time-based partitioning, archive old data |

**Optimization Strategies**:
1. Increase write batch size (100 → 1,000)
2. Adjust flush interval (1000ms → 5000ms for throughput)
3. Add Arc indexes on `agent_id`, `session_id`, `event_type`
4. Archive memories older than retention window to S3

### 7.3 Limitations & Workarounds

**SQLite Bottleneck**:
- **Issue**: Single-file metadata store limits HA
- **Workaround**: Migrate to PostgreSQL for HA (requires code changes)

**Arc Dependency**:
- **Issue**: Tight coupling to Arc database
- **Workaround**: Develop adapter layer for ClickHouse/TimescaleDB

---

## 8. Cost Estimation

### 8.1 AWS Deployment Costs

**Small Deployment** (1-5 agents, 1K memories/day):
| Resource | Specification | Monthly Cost |
|----------|---------------|--------------|
| Compute  | t3.small (2 vCPU, 2GB) | $15 |
| Storage  | 10GB EBS gp3 | $1 |
| Network  | 1GB egress | $0.09 |
| **Total** | | **$16** |

**Medium Deployment** (10-50 agents, 100K memories/day):
| Resource | Specification | Monthly Cost |
|----------|---------------|--------------|
| Compute  | 2× t3.medium (2 vCPU, 4GB) | $60 |
| Arc DB   | t3.large (2 vCPU, 8GB) | $60 |
| Storage  | 100GB EBS gp3 | $8 |
| Load Balancer | ALB | $16 |
| Network  | 100GB egress | $9 |
| **Total** | | **$153** |

**Large Deployment** (100+ agents, 1M memories/day):
| Resource | Specification | Monthly Cost |
|----------|---------------|--------------|
| Compute  | 5× t3.xlarge (4 vCPU, 16GB) | $600 |
| Arc Cluster | 3× r6g.xlarge (4 vCPU, 32GB) | $540 |
| Storage  | 1TB EBS gp3 | $80 |
| Load Balancer | ALB | $16 |
| Network  | 1TB egress | $90 |
| **Total** | | **$1,326** |

### 8.2 Cost Comparison: Memtrace vs. Vector Solutions

**100K memories/day workload**:
| Solution | Infrastructure | Embedding API | Total |
|----------|---------------|---------------|-------|
| **Memtrace (self-hosted)** | $153/month | $0 | **$153/month** |
| Pinecone (vector DB) | $70-280/month | $50-200/month | $120-480/month |
| Weaviate Cloud | $100-400/month | $50-200/month | $150-600/month |
| Redis Enterprise | $120-500/month | N/A | $120-500/month |

**Key Savings**:
- **No Embedding Costs**: Eliminates OpenAI/Cohere API fees ($0.0001-0.0004/embedding)
- **No Vector Storage**: Text-only storage is 10-50× smaller than vector storage
- **Simple Architecture**: Fewer moving parts = lower ops overhead

### 8.3 Cost Optimization Strategies

1. **Spot Instances**: 50-70% savings on compute (non-critical workloads)
2. **Reserved Instances**: 30-50% savings for 1-year commitment
3. **Object Storage Archival**: S3 ($0.023/GB) vs. EBS ($0.08/GB) for old data
4. **Compression**: Parquet compression reduces storage by 5-10×
5. **Right-Sizing**: Monitor CPU/memory, scale down if underutilized

---

## 9. Security & Compliance

### 9.1 Data Security

**Encryption**:
- **At-Rest**: Not built-in - use encrypted EBS/GCE volumes
- **In-Transit**: TLS termination at load balancer (Let's Encrypt recommended)
- **Arc Connection**: Configure HTTPS for Arc-to-Memtrace encryption

**Access Control**:
- **Authentication**: API key-based (bcrypt hashed, `mtk_` prefix)
- **Authorization**: Organization-level isolation (no RBAC)
- **Secrets**: Store API keys in cloud secrets manager

### 9.2 Compliance Considerations

**GDPR**:
- **Right to Access**: API supports data export
- **Right to Deletion**: No built-in delete API (requires custom implementation)
- **Data Minimization**: Application responsibility

**HIPAA**:
- **Not Certified**: Requires custom hardening (encryption, audit logs, access controls)

**SOC 2**:
- **Access Control**: API key baseline (Type I)
- **Logging**: Structured logs support audit requirements
- **Gaps**: No formal access review process

---

## 10. Key Differentiators (Cloud Perspective)

### 10.1 What Makes Memtrace Unique

**No Embedding Infrastructure**:
- Eliminates need for GPU instances for embedding generation
- No dependency on OpenAI/Cohere/Vertex AI embedding APIs
- Drastically lower operational complexity

**No Vector Database**:
- Avoids Pinecone, Weaviate, Qdrant, or Milvus deployment/management
- Simpler architecture: Just time-series DB + lightweight Go service
- Lower storage costs: Text-only vs. high-dimensional vectors

**LLM-Agnostic Design**:
- Works with any model (ChatGPT, Claude, Gemini, DeepSeek, Llama)
- No vendor lock-in to specific embedding model
- Switch models without re-indexing data

**Temporal-First Architecture**:
- Time-series database optimized for "what happened when" queries
- Natural fit for operational agents (DevOps, monitoring, automation)
- Built-in time-windowed queries (default behavior)

### 10.2 Cloud Service Recommendations

**Ideal Cloud Services**:
- **Compute**: AWS ECS Fargate, GCP Cloud Run, Azure Container Instances (stateless containers)
- **Storage**: Block storage (EBS gp3, GCE Persistent SSD) for Arc data
- **Database**: Self-hosted Arc (Docker) + optional managed PostgreSQL for metadata
- **Load Balancer**: AWS ALB, GCP Load Balancer with TLS termination
- **Monitoring**: CloudWatch, Stackdriver, Azure Monitor + custom Prometheus metrics

**Not Recommended**:
- Serverless/FaaS (Lambda, Cloud Functions) - requires persistent state
- Managed vector databases - unnecessary complexity and cost
- Heavy ML infrastructure - zero GPU/TPU requirements

---

## Summary: Cloud Deployment Readiness

| Aspect | Rating | Notes |
|--------|--------|-------|
| **Compute Efficiency** | 5/5 | Low CPU/memory footprint, no GPU required |
| **Storage Simplicity** | 4/5 | Time-series DB + SQLite, no vector indexes |
| **Cost Efficiency** | 5/5 | 50-70% cheaper than vector solutions |
| **Scalability** | 4/5 | Horizontal scaling ready, SQLite HA limitation |
| **Operational Complexity** | 4/5 | Moderate - requires Arc database deployment |
| **Cloud-Native Readiness** | 4/5 | Docker/K8s ready, 12-factor compliant |
| **Security Posture** | 3/5 | API key auth, needs TLS termination, no built-in encryption |
| **Overall Cloud Fit** | **4/5** | **Strong for operational agents, moderate complexity** |

**Bottom Line**: Memtrace is well-suited for cloud deployment with significantly lower infrastructure costs than vector-based memory solutions. The main trade-off is the requirement to deploy and manage the Arc time-series database, but this is offset by eliminating embedding infrastructure and vector database complexity. Ideal for cost-conscious deployments where temporal/operational memory is the primary use case.
