/**
 * Step 3: Analyze Architecture
 * Uses Claude to analyze each project's technical architecture
 */

import { loadRawProjects, loadMarkdown, saveMarkdown, ensureProjectDir } from './lib/data-loader.js';
import { analyzeArchitecture } from './lib/claude-agent.js';
import * as fs from 'fs/promises';
import * as path from 'path';

interface AnalysisResult {
  name: string;
  success: boolean;
  error?: string;
}

async function getFileList(projectDir: string): Promise<string[]> {
  try {
    const repoDir = path.join(projectDir, 'repo');
    const entries = await fs.readdir(repoDir, { withFileTypes: true });
    return entries
      .filter(entry => !entry.name.startsWith('.'))
      .map(entry => entry.name)
      .slice(0, 20);
  } catch (error) {
    return [];
  }
}

async function analyzeProject(projectName: string): Promise<AnalysisResult> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ANALYZE] Analyzing architecture for ${projectName}...`);

  try {
    const projectDir = await ensureProjectDir(projectName);

    const existing = await loadMarkdown(projectName, 'architecture.md');
    if (existing) {
      console.log(`[${timestamp}] [SKIP] Architecture analysis already exists for ${projectName}`);
      return { name: projectName, success: true };
    }

    const readme = await loadMarkdown(projectName, 'README.md');
    if (!readme) {
      throw new Error('README.md not found');
    }

    const fileList = await getFileList(projectDir);

    const analysis = await analyzeArchitecture(projectName, readme, fileList);

    await saveMarkdown(projectName, 'architecture.md', analysis);

    console.log(`[${timestamp}] [SUCCESS] Architecture analysis completed for ${projectName}`);
    return { name: projectName, success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${timestamp}] [ERROR] Failed to analyze ${projectName}:`, errorMsg);
    return { name: projectName, success: false, error: errorMsg };
  }
}

async function main() {
  console.log('=== Step 3: Analyze Architecture ===\n');

  const projects = await loadRawProjects();
  console.log(`Found ${projects.length} projects to analyze\n`);

  const results: AnalysisResult[] = [];

  for (const project of projects) {
    const result = await analyzeProject(project.name);
    results.push(result);

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('\n=== Analysis Summary ===');
  console.log(`Total: ${projects.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed projects:');
    results
      .filter(r => !r.success)
      .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
  }
}

main().catch(console.error);
