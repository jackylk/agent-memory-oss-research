/**
 * Step 5: Extract Cloud Needs
 * Infers cloud service requirements from architecture analysis
 */

import { loadRawProjects, loadMarkdown, saveMarkdown, loadProjectMeta, saveProjectMeta } from './lib/data-loader.js';
import { inferCloudNeeds } from './lib/claude-agent.js';
import type { CloudNeeds } from './lib/types.js';

interface ExtractionResult {
  name: string;
  success: boolean;
  error?: string;
}

async function extractCloudNeedsForProject(projectName: string): Promise<ExtractionResult> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [EXTRACT] Extracting cloud needs for ${projectName}...`);

  try {
    const existing = await loadMarkdown(projectName, 'cloud-needs.md');
    if (existing) {
      console.log(`[${timestamp}] [SKIP] Cloud needs already extracted for ${projectName}`);
      return { name: projectName, success: true };
    }

    const architecture = await loadMarkdown(projectName, 'architecture.md');
    if (!architecture) {
      throw new Error('Architecture analysis not found');
    }

    const cloudNeedsText = await inferCloudNeeds(projectName, architecture);
    await saveMarkdown(projectName, 'cloud-needs.md', cloudNeedsText);

    const meta = await loadProjectMeta(projectName);
    if (meta) {
      const cloudNeeds: CloudNeeds = {
        storage: { types: [], requirements: [] },
        compute: { embedding: false, gpu_needed: false },
        deployment: { complexity: 3, containerized: true },
      };
      meta.cloud_needs = cloudNeeds;
      await saveProjectMeta(projectName, meta);
    }

    console.log(`[${timestamp}] [SUCCESS] Cloud needs extracted for ${projectName}`);
    return { name: projectName, success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${timestamp}] [ERROR] Failed to extract cloud needs for ${projectName}:`, errorMsg);
    return { name: projectName, success: false, error: errorMsg };
  }
}

async function main() {
  console.log('=== Step 5: Extract Cloud Needs ===\n');

  const projects = await loadRawProjects();
  console.log(`Found ${projects.length} projects to process\n`);

  const results: ExtractionResult[] = [];

  for (const project of projects) {
    const result = await extractCloudNeedsForProject(project.name);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('\n=== Extraction Summary ===');
  console.log(`Total: ${projects.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
