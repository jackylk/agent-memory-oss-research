/**
 * Step 4: Analyze Papers
 * Uses Claude to analyze academic papers
 */

import { loadRawProjects, loadMarkdown, saveMarkdown, ensureProjectDir } from './lib/data-loader.js';
import { analyzePaper } from './lib/claude-agent.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import pdfParse from 'pdf-parse';

interface AnalysisResult {
  name: string;
  success: boolean;
  error?: string;
}

async function analyzePaperForProject(projectName: string): Promise<AnalysisResult> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [ANALYZE] Analyzing paper for ${projectName}...`);

  try {
    const projectDir = await ensureProjectDir(projectName);
    const pdfPath = path.join(projectDir, 'paper.pdf');

    const existing = await loadMarkdown(projectName, 'paper-analysis.md');
    if (existing) {
      console.log(`[${timestamp}] [SKIP] Paper analysis already exists for ${projectName}`);
      return { name: projectName, success: true };
    }

    const pdfExists = await fs.access(pdfPath).then(() => true).catch(() => false);
    if (!pdfExists) {
      console.log(`[${timestamp}] [SKIP] No paper PDF found for ${projectName}`);
      return { name: projectName, success: true };
    }

    const pdfBuffer = await fs.readFile(pdfPath);
    const pdfData = await pdfParse(pdfBuffer);
    const paperText = pdfData.text;

    const analysis = await analyzePaper(projectName, paperText);
    await saveMarkdown(projectName, 'paper-analysis.md', analysis);

    console.log(`[${timestamp}] [SUCCESS] Paper analysis completed for ${projectName}`);
    return { name: projectName, success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${timestamp}] [ERROR] Failed to analyze paper for ${projectName}:`, errorMsg);
    return { name: projectName, success: false, error: errorMsg };
  }
}

async function main() {
  console.log('=== Step 4: Analyze Papers ===\n');

  const projects = await loadRawProjects();
  console.log(`Found ${projects.length} projects to analyze\n`);

  const results: AnalysisResult[] = [];

  for (const project of projects) {
    const result = await analyzePaperForProject(project.name);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('\n=== Analysis Summary ===');
  console.log(`Total: ${projects.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
