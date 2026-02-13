/**
 * Type definitions for Agent Memory Research Hub
 * Based on PRD Chapter 9: Data Structure Specifications
 */

export interface RawProject {
  name: string;
  repository_url: string;
  stars: number;
  language: string;
  description: string;
  key_features: string[];
  benchmark_mentions: string[];
  innovation_highlights: string[];
}

export interface PaperInfo {
  exists: boolean;
  title: string;
  venue: string;
  year: number;
  url: string;
  authors?: string[];
}

export interface BenchmarkResult {
  score: number;
  details: string;
  date?: string;
}

export interface BenchmarkResults {
  locomo?: BenchmarkResult;
  longmemeval?: BenchmarkResult;
  needle_in_haystack?: BenchmarkResult;
  [key: string]: BenchmarkResult | undefined;
}

export interface TechStack {
  storage: string[];
  frameworks: string[];
  languages: string[];
  embedding_models?: string[];
}

export interface CloudNeeds {
  storage: {
    types: string[];
    requirements: string[];
  };
  compute: {
    embedding: boolean;
    gpu_needed: boolean;
    estimated_requirements?: string;
  };
  deployment: {
    complexity: number;
    containerized: boolean;
    orchestration?: string[];
  };
}

export interface Categories {
  tech_approach: string[];
  use_case: string[];
}

export interface ProjectMeta {
  name: string;
  repository_url: string;
  stars: number;
  primary_language: string;
  description: string;
  last_updated: string;
  paper?: PaperInfo;
  benchmarks: BenchmarkResults;
  tech_stack: TechStack;
  cloud_needs: CloudNeeds;
  categories: Categories;
}

export interface AggregatedCategory {
  name: string;
  count: number;
  projects: string[];
  description: string;
}

export interface AggregatedCloudNeed {
  need_type: string;
  frequency: number;
  projects: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface Trend {
  name: string;
  growth_rate: number;
  project_count: number;
  description: string;
}

export interface PaperSummary {
  total_papers: number;
  venues: { [venue: string]: number };
  years: { [year: number]: number };
  top_papers: Array<{
    title: string;
    project: string;
    venue: string;
    year: number;
  }>;
}

export interface AnalysisResult {
  success: boolean;
  project_name: string;
  timestamp: string;
  error?: string;
}

export interface GitHubIssue {
  title: string;
  body: string;
  state: string;
  created_at: string;
  labels: string[];
  comments: number;
}

export interface PainPoint {
  category: 'deployment' | 'performance' | 'feature' | 'integration' | 'documentation';
  description: string;
  frequency: number;
  example_issues: string[];
}
