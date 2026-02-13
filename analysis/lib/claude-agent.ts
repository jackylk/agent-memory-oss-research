/**
 * Claude Agent wrapper using Anthropic SDK
 * Handles automated analysis of projects, papers, and issues
 */

import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import type { PainPoint } from './types.js';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-5-20250929';

/**
 * Analyze project architecture
 */
export async function analyzeArchitecture(
  projectName: string,
  readme: string,
  fileList: string[]
): Promise<string> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ANALYZE] Analyzing architecture for ${projectName}...`);

  const prompt = `Analyze the following project's technical architecture:

Project Name: ${projectName}
README Content: ${readme}
Main Files: ${fileList.join(', ')}

Please provide a detailed analysis in Markdown format with the following sections:

# Technical Architecture Analysis

## 1. Technology Stack Overview
List the main technologies, frameworks, and languages used.

## 2. Storage Solutions
Describe the storage approach (vector databases, traditional databases, caching, etc.).

## 3. Core Architecture Design
Explain the system architecture, key modules, and how components interact.

## 4. Scalability Assessment
Evaluate how well the architecture scales (distributed systems, load handling, etc.).

## 5. Key Dependencies
List critical dependencies and their purposes.

Be concise but thorough. Use bullet points where appropriate.`;

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    console.log(`[${timestamp}] [SUCCESS] Architecture analysis completed for ${projectName}`);
    return content.text;
  } catch (error) {
    console.error(`[${timestamp}] [ERROR] Failed to analyze architecture:`, error);
    throw error;
  }
}

/**
 * Analyze academic paper
 */
export async function analyzePaper(
  projectName: string,
  paperText: string
): Promise<string> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ANALYZE] Analyzing paper for ${projectName}...`);

  const prompt = `Deep analysis of the following academic paper:

Paper Content: ${paperText.slice(0, 20000)}

Please provide a detailed analysis in Markdown format with the following sections:

# Paper Analysis

## 1. Paper Information
Extract: Title, Authors, Venue/Conference, Year, URL (if available)

## 2. Core Innovations
List 3-5 key innovations or contributions.

## 3. Performance Improvements
Extract specific numbers from experiments comparing to baselines (e.g., "20% improvement over baseline").

## 4. Practical Value
Describe real-world applications and benefits for users.

## 5. Academic Impact
Assess the significance (conference tier, novelty, potential impact).

Be specific and cite numbers from the paper where possible.`;

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    console.log(`[${timestamp}] [SUCCESS] Paper analysis completed for ${projectName}`);
    return content.text;
  } catch (error) {
    console.error(`[${timestamp}] [ERROR] Failed to analyze paper:`, error);
    throw error;
  }
}

/**
 * Extract pain points from GitHub issues
 */
export async function extractPainPoints(
  projectName: string,
  issues: Array<{ title: string; body: string; labels: string[] }>
): Promise<PainPoint[]> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ANALYZE] Extracting pain points from ${issues.length} issues for ${projectName}...`);

  const issuesText = issues
    .slice(0, 50)
    .map((issue, i) => `Issue ${i + 1}: ${issue.title}\n${issue.body.slice(0, 500)}`)
    .join('\n\n---\n\n');

  const prompt = `Analyze the following GitHub issues and extract common pain points:

Project: ${projectName}
Issues:
${issuesText}

Please identify and categorize pain points. Return a JSON array with this structure:
[
  {
    "category": "deployment" | "performance" | "feature" | "integration" | "documentation",
    "description": "Brief description of the pain point",
    "frequency": <estimated number of affected users>,
    "example_issues": ["issue title 1", "issue title 2"]
  }
]

Focus on the most significant and recurring problems. Limit to top 5-10 pain points.`;

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn(`[${timestamp}] [WARN] Could not extract JSON from response`);
      return [];
    }

    const painPoints = JSON.parse(jsonMatch[0]) as PainPoint[];
    console.log(`[${timestamp}] [SUCCESS] Extracted ${painPoints.length} pain points for ${projectName}`);
    return painPoints;
  } catch (error) {
    console.error(`[${timestamp}] [ERROR] Failed to extract pain points:`, error);
    return [];
  }
}

/**
 * Infer cloud needs from architecture description
 */
export async function inferCloudNeeds(
  projectName: string,
  architectureText: string
): Promise<string> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ANALYZE] Inferring cloud needs for ${projectName}...`);

  const prompt = `Based on the following architecture analysis, infer cloud service requirements:

Project: ${projectName}
Architecture: ${architectureText}

Please provide a detailed cloud needs analysis in Markdown format:

# Cloud Service Requirements

## 1. Storage Needs
- Vector databases (if applicable)
- Traditional databases
- Object storage
- Estimated scale and performance requirements

## 2. Compute Requirements
- Embedding generation needs
- GPU requirements
- CPU and memory estimates
- Serverless vs. dedicated compute

## 3. Deployment Complexity
- Containerization approach
- Orchestration needs (K8s, etc.)
- Multi-region requirements
- CI/CD considerations

## 4. Additional Services
- Caching layers
- Message queues
- Monitoring and observability
- Security and compliance

Be specific about scale and provide rough estimates where possible.`;

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    console.log(`[${timestamp}] [SUCCESS] Cloud needs analysis completed for ${projectName}`);
    return content.text;
  } catch (error) {
    console.error(`[${timestamp}] [ERROR] Failed to infer cloud needs:`, error);
    throw error;
  }
}
