# Cloud Service Requirements - Backboard-Locomo-Benchmark

## Executive Summary

The Backboard-Locomo-Benchmark requires moderate compute resources, minimal storage, and consistent network connectivity for API-based evaluation. The workload is primarily **I/O-bound** with no GPU requirements, making it suitable for standard cloud VM instances or container services.

**Quick Specs**:
- **Compute**: 4-8 vCPUs, 8 GB RAM
- **Storage**: 5 GB SSD
- **Network**: 10 Mbps, <200ms latency to app.backboard.io
- **Deployment**: Docker container, Kubernetes Job, or ECS Task
- **Cost**: ~$10-50/month (compute) + $5-20/run (API costs)

---

## 1. Compute Requirements

### 1.1 CPU
- **Minimum**: 2 vCPUs (single conversation sequential)
- **Recommended**: 4 vCPUs (optimal single-worker performance)
- **High-Throughput**: 8-16 vCPUs (parallel conversation processing)
- **Architecture**: x86_64 or ARM64 (Python platform-agnostic)

**Rationale**: The workload is I/O-bound (waiting for API responses), so CPU is not the bottleneck. Additional cores enable parallel conversation evaluation but have diminishing returns beyond 8 vCPUs due to API rate limits.

### 1.2 Memory (RAM)
- **Minimum**: 4 GB
- **Recommended**: 8 GB
- **High-Throughput**: 16 GB (for large-scale benchmarks)

**Memory Breakdown**:
- Python runtime: 500 MB
- Dataset loading (10 conversations): 500 MB
- Per-conversation processing: ~200 MB
- Results buffering: 100-500 MB
- Overhead: 1-2 GB

### 1.3 GPU
- **Status**: Not Required
- **Rationale**: All LLM inference is handled by external APIs (Backboard, OpenAI, Google). Local processing is limited to JSON parsing and HTTP I/O.

---

## 2. Storage Requirements

### 2.1 Capacity
- **Minimum**: 500 MB
- **Recommended**: 5 GB
- **Production**: 20 GB (for extensive historical results)

**Storage Breakdown**:
- Python dependencies: 200 MB
- LoCoMo dataset: 50 MB
- Per-benchmark results: 5-10 MB
- Historical results (20 runs): 100-200 MB

### 2.2 Storage Type
- **Type**: Standard SSD (General Purpose SSD - gp3/gp2 on AWS)
- **IOPS**: 3000 IOPS sufficient (no high-performance I/O needed)
- **Throughput**: 125 MB/s baseline adequate

**Rationale**: Sequential read/write patterns for dataset loading and results export. No random access or database workloads.

### 2.3 Backup and Retention
- **Backup**: Daily backups of results/ directory
- **Retention**: 30-90 days for benchmark results
- **Lifecycle**: Archive results >90 days to cold storage (S3 Glacier, Azure Cool)

---

## 3. Network Requirements

### 3.1 Bandwidth
- **Minimum**: 5 Mbps
- **Recommended**: 10 Mbps
- **High-Throughput**: 50 Mbps (parallel conversations)

**Traffic Estimates**:
- Per message: 10-50 KB (streaming)
- Per conversation: 500 KB - 2 MB
- Per benchmark (10 conversations): 20-50 MB total
- GPT-4.1 judge: 5 KB per evaluation

### 3.2 Latency
- **Critical**: <200ms to app.backboard.io
- **Acceptable**: <500ms
- **Degraded**: >500ms (slow but functional)

**Latency Impact**:
- API response time: 1-5 seconds per message
- Memory operation wait: 0.2-10 seconds
- Total benchmark time: 10-30 minutes (latency-sensitive)

### 3.3 Egress and Ingress
- **Egress (Upload)**: ~10 MB per benchmark (conversation uploads)
- **Ingress (Download)**: ~30 MB per benchmark (streaming responses)
- **Monthly (20 runs)**: ~800 MB total (negligible cost)

### 3.4 Connectivity Requirements
- **Outbound HTTPS**: 443 to app.backboard.io, api.openai.com
- **Inbound**: None (worker-only process)
- **VPC**: Private subnet with NAT gateway for API access
- **Firewall**: Allow outbound to Backboard and OpenAI IPs

---

## 4. Database and State Management

### 4.1 Local Database
- **Status**: Not Required
- **Alternative**: File-based JSON storage for results

### 4.2 External Database
- **Backboard Memory Storage**: Managed by Backboard platform
  - **Type**: Proprietary vector database (abstracted)
  - **Capacity**: Per assistant/thread (platform-managed)
  - **Persistence**: Indefinite until manual deletion

### 4.3 Caching
- **Current**: In-memory Python dict (ephemeral)
- **Optimization Opportunity**: Redis for repeated dataset loading
  - **Use Case**: CI/CD pipelines with frequent runs
  - **Cost Savings**: Minimal (dataset load is <1% of runtime)

---

## 5. Deployment Architecture

### 5.1 Recommended Deployment Options

#### Option A: AWS ECS Fargate
**Best For**: Sporadic benchmarks, minimal ops overhead

```yaml
Task Definition:
  CPU: 4 vCPUs
  Memory: 8 GB
  Storage: 20 GB ephemeral
  Networking: NAT gateway for API access
  Execution: On-demand task run

Cost Estimate: $0.20/hour × 0.5 hours = $0.10/run
```

#### Option B: Kubernetes Job
**Best For**: Continuous evaluation, parallel processing

```yaml
Job Spec:
  Parallelism: 5 conversations
  Completions: 10 conversations
  Resources:
    Requests: 2 CPU, 4 GB RAM
    Limits: 4 CPU, 8 GB RAM
  Node Affinity: Spot instances

Cost Estimate: 5 pods × $0.05/hour × 0.5 hours = $0.13/run
```

#### Option C: Google Cloud Run Jobs
**Best For**: Serverless, pay-per-use model

```yaml
Cloud Run Job:
  Memory: 8 GB
  CPU: 4 vCPUs
  Timeout: 1 hour
  Execution: Triggered via Cloud Scheduler

Cost Estimate: $0.18/hour × 0.5 hours = $0.09/run
```

#### Option D: Azure Container Instances
**Best For**: Azure-native deployments

```yaml
Container Group:
  CPU: 4 cores
  Memory: 8 GB
  OS: Linux
  Restart Policy: Never

Cost Estimate: $0.15/hour × 0.5 hours = $0.08/run
```

### 5.2 High-Availability Considerations
- **Requirement**: Low (batch workload, retry-safe)
- **Strategy**: Task-level retries (Kubernetes: restartPolicy=OnFailure)
- **Redundancy**: Not needed (stateless workers)

### 5.3 Auto-Scaling
```yaml
Scaling Policy:
  Metric: Queue depth (pending conversations)
  Scale-Up: >5 conversations waiting
  Scale-Down: <2 conversations in queue
  Min Replicas: 0 (scale to zero when idle)
  Max Replicas: 10 (API rate limit consideration)
  Cool-Down: 5 minutes
```

---

## 6. Orchestration and Scheduling

### 6.1 Kubernetes Resources

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: locomo-benchmark
spec:
  parallelism: 5
  completions: 10
  backoffLimit: 3
  template:
    spec:
      restartPolicy: OnFailure
      containers:
      - name: benchmark
        image: backboard-locomo:latest
        resources:
          requests:
            cpu: 2
            memory: 4Gi
          limits:
            cpu: 4
            memory: 8Gi
        env:
        - name: BACKBOARD_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-keys
              key: backboard-key
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-keys
              key: openai-key
        volumeMounts:
        - name: results
          mountPath: /app/results
      volumes:
      - name: results
        persistentVolumeClaim:
          claimName: benchmark-results-pvc
```

### 6.2 Scheduling Strategies
- **Continuous Evaluation**: Cron schedule (daily/weekly)
- **On-Demand**: Triggered by code commits or manual execution
- **Event-Driven**: Triggered by Backboard platform updates

---

## 7. Monitoring and Observability

### 7.1 Key Metrics

#### Application Metrics
```
benchmark_questions_total               # Total questions evaluated
benchmark_questions_correct             # Correct answers
benchmark_accuracy_percent              # Overall accuracy
benchmark_response_time_seconds         # Avg response time per question
benchmark_api_errors_total              # API call failures
benchmark_memory_operations_duration    # Memory operation latency
```

#### Infrastructure Metrics
```
cpu_utilization_percent                 # Target: 60-80%
memory_used_bytes                       # Monitor for leaks
network_io_bytes                        # API traffic volume
disk_io_bytes                           # Results write throughput
```

### 7.2 Logging Strategy
```yaml
Logging Configuration:
  Format: JSON structured logs
  Level: INFO (production), DEBUG (development)
  Retention: 14 days (debug), 90 days (error)
  Aggregation: CloudWatch Logs, ELK Stack, or Loki

Log Types:
  - Application: Conversation progress, accuracy updates
  - API: Request/response for Backboard and OpenAI
  - Error: API failures, evaluation errors, network timeouts
```

### 7.3 Alerting
```yaml
Alerts:
  - Name: Benchmark Failure
    Condition: Job exit code != 0
    Severity: High
    Channel: PagerDuty, Slack

  - Name: Low Accuracy
    Condition: Overall accuracy < 85%
    Severity: Medium
    Channel: Slack, Email

  - Name: High API Error Rate
    Condition: Error rate > 5%
    Severity: High
    Channel: PagerDuty

  - Name: Long Execution Time
    Condition: Runtime > 60 minutes
    Severity: Low
    Channel: Slack
```

---

## 8. Security Requirements

### 8.1 API Key Management
- **Storage**: Never commit to version control
- **Deployment**: Kubernetes Secrets, AWS Secrets Manager, Azure Key Vault
- **Rotation**: Quarterly recommended
- **Access**: Least privilege (evaluation-only permissions)

```yaml
# Kubernetes Secret Example
apiVersion: v1
kind: Secret
metadata:
  name: api-keys
type: Opaque
data:
  backboard-key: <base64-encoded>
  openai-key: <base64-encoded>
```

### 8.2 Network Security
```yaml
Network Policies:
  Egress:
    - app.backboard.io:443 (HTTPS)
    - api.openai.com:443 (HTTPS)
  Ingress:
    - None (worker process, no inbound traffic)

Firewall Rules:
  - Allow outbound HTTPS (443)
  - Deny all inbound traffic
  - NAT gateway for source IP consistency
```

### 8.3 Data Privacy
- **Dataset**: LoCoMo contains synthetic conversations (no real PII)
- **Results**: May contain AI-generated content (treat as sensitive)
- **Encryption**: TLS 1.3 for all API communication
- **Compliance**: GDPR/CCPA not directly applicable (synthetic data)

---

## 9. Cost Analysis

### 9.1 Compute Costs

#### AWS ECS Fargate
```
Configuration: 4 vCPUs, 8 GB RAM
Runtime: 30 minutes per benchmark
Frequency: 20 runs/month

Cost Calculation:
- Per hour: $0.20 (4 vCPU × $0.04048) + (8 GB × $0.004445) = $0.20
- Per run: $0.20 × 0.5 hours = $0.10
- Monthly: $0.10 × 20 runs = $2.00
```

#### Kubernetes (GKE/EKS)
```
Configuration: 5 pods × 2 vCPUs × 4 GB RAM
Runtime: 30 minutes per benchmark
Node Type: e2-standard-4 (spot)

Cost Calculation:
- Per pod-hour: $0.05 (spot pricing)
- Per run: 5 pods × $0.05 × 0.5 hours = $0.13
- Monthly: $0.13 × 20 runs = $2.60
```

#### Google Cloud Run
```
Configuration: 4 vCPUs, 8 GB RAM
Runtime: 30 minutes per benchmark

Cost Calculation:
- Per hour: $0.18
- Per run: $0.18 × 0.5 hours = $0.09
- Monthly: $0.09 × 20 runs = $1.80
```

### 9.2 Storage Costs
```
Benchmark Results: 5 GB
Backup: 10 GB (cross-region replication)

AWS S3 Standard:
- Storage: 15 GB × $0.023/GB = $0.35/month
- Requests: Negligible (<$0.10)
```

### 9.3 Network Costs
```
Data Transfer: 800 MB/month egress
AWS: 800 MB × $0.09/GB = $0.07/month (negligible)
```

### 9.4 API Costs
```
Backboard API:
- Pricing: Enterprise tier (contact sales)
- Estimate: $10-30/month for evaluation workload

OpenAI GPT-4.1:
- Questions: 250 per benchmark × 20 runs = 5,000 evaluations/month
- Cost per evaluation: ~$0.01-0.02
- Monthly: $50-100

Total API Costs: $60-130/month
```

### 9.5 Total Cost of Ownership (TCO)
```
Monthly TCO (20 benchmark runs):
- Compute: $2-3
- Storage: $0.35
- Network: $0.07
- APIs: $60-130
------------------------------
Total: $62-133/month

Annual TCO: $750-1,600/year
```

### 9.6 Cost Optimization Strategies

#### 1. Spot Instances
```
Savings: 60-80% on compute costs
Risk: Task interruption (mitigated by retries)
Net Compute Cost: $0.40-0.80/month (down from $2-3)
```

#### 2. Reserved Instances
```
Commitment: 1-3 years
Savings: 30-50% on compute
Use Case: Continuous evaluation pipelines
```

#### 3. API Cost Reduction
```
Strategies:
- Batch evaluations (reduce OpenAI calls)
- Cache GPT-4.1 results for repeated questions
- Use cheaper judge (GPT-3.5 for non-critical benchmarks)

Potential Savings: 30-50% on API costs ($20-50/month)
```

#### 4. Storage Lifecycle Policies
```
Policy: Move results >90 days to Glacier/Archive
Savings: 90% on old results storage
Cost Impact: <$0.10/month (storage is minimal)
```

---

## 10. Disaster Recovery and Business Continuity

### 10.1 Backup Strategy
```yaml
Backup Targets:
  - Dataset: locomo_dataset.json (version controlled)
  - Results: results/ directory (daily backup)
  - Configuration: .env, task definitions (version controlled)

Backup Schedule:
  - Frequency: Daily (incremental)
  - Retention: 30 days
  - Location: Cross-region S3/Cloud Storage

Recovery Time Objective (RTO): 1 hour
Recovery Point Objective (RPO): 24 hours
```

### 10.2 Failure Scenarios

#### Scenario 1: API Outage (Backboard)
```
Impact: Benchmark cannot run
Mitigation: Retry with exponential backoff
Recovery: Automatic when service restored
```

#### Scenario 2: Network Failure
```
Impact: Partial results loss
Mitigation: Per-conversation checkpointing
Recovery: Resume from last completed conversation
```

#### Scenario 3: Compute Resource Failure
```
Impact: Benchmark interruption
Mitigation: Kubernetes Job restartPolicy=OnFailure
Recovery: Automatic task restart
```

#### Scenario 4: Data Corruption
```
Impact: Invalid results
Mitigation: Daily backups, version control
Recovery: Restore from backup, re-run benchmark
```

---

## 11. Deployment Checklist

### 11.1 Pre-Deployment
- [ ] Provision cloud resources (VM/container service)
- [ ] Configure VPC/networking (NAT gateway, security groups)
- [ ] Set up secret management (API keys)
- [ ] Create storage buckets for results
- [ ] Configure monitoring and logging
- [ ] Test dry run mode locally

### 11.2 Deployment
- [ ] Build and push Docker image
- [ ] Deploy Kubernetes Job / ECS Task / Cloud Run Job
- [ ] Verify environment variables loaded
- [ ] Validate API connectivity (Backboard, OpenAI)
- [ ] Run initial benchmark (1-2 conversations)
- [ ] Verify results export to storage

### 11.3 Post-Deployment
- [ ] Set up scheduled runs (cron/Cloud Scheduler)
- [ ] Configure alerting rules
- [ ] Document runbook for operators
- [ ] Establish cost monitoring dashboard
- [ ] Plan quarterly API key rotation

---

## 12. Recommended Cloud Configurations

### 12.1 AWS Configuration
```yaml
Service: ECS Fargate
Region: us-east-1 (or closest to Backboard servers)
Task Definition:
  CPU: 4096 (4 vCPUs)
  Memory: 8192 MB
  Network Mode: awsvpc
  Execution Role: ecsTaskExecutionRole
  Task Role: backboard-benchmark-role
Storage:
  - EFS mount for results persistence
  - S3 bucket for long-term storage
Secrets:
  - AWS Secrets Manager for API keys
Logging:
  - CloudWatch Logs (7-day retention)
```

### 12.2 Google Cloud Configuration
```yaml
Service: Cloud Run Jobs
Region: us-central1
Job Configuration:
  Memory: 8Gi
  CPU: 4
  Max Retries: 3
  Timeout: 3600s (1 hour)
Storage:
  - Cloud Storage bucket for results
Secrets:
  - Secret Manager for API keys
Logging:
  - Cloud Logging (30-day retention)
Monitoring:
  - Cloud Monitoring with custom metrics
```

### 12.3 Azure Configuration
```yaml
Service: Container Instances
Region: East US
Container Group:
  OS: Linux
  CPU: 4 cores
  Memory: 8 GB
  Restart Policy: Never
Storage:
  - Azure Files share for results
  - Blob Storage for long-term archive
Secrets:
  - Azure Key Vault
Logging:
  - Log Analytics Workspace
Monitoring:
  - Azure Monitor
```

---

## Summary Table

| Requirement | Minimum | Recommended | High-Performance |
|-------------|---------|-------------|------------------|
| **CPU** | 2 vCPUs | 4 vCPUs | 8-16 vCPUs |
| **RAM** | 4 GB | 8 GB | 16 GB |
| **Storage** | 500 MB | 5 GB | 20 GB |
| **Network** | 5 Mbps | 10 Mbps | 50 Mbps |
| **Latency** | <500ms | <200ms | <100ms |
| **Monthly Cost** | $30-50 | $60-130 | $150-300 |
| **Deployment** | Docker Compose | Kubernetes Job | Multi-Region K8s |

---

**Document Version**: 1.0
**Last Updated**: 2026-02-12
**Maintained By**: Backboard Evaluation Team
