/**
 * Step 1: Clone GitHub projects
 * Clones all 25 projects from agent-memory-projects.json
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { loadRawProjects, ensureProjectDir } from './lib/data-loader.js';
import { getReadme } from './lib/github-api.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

interface CloneResult {
  name: string;
  success: boolean;
  error?: string;
}

async function cloneProject(
  repoUrl: string,
  projectName: string
): Promise<CloneResult> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [CLONE] Cloning ${projectName}...`);

  try {
    const projectDir = await ensureProjectDir(projectName);
    const cloneDir = path.join(projectDir, 'repo');

    const dirExists = await fs
      .access(cloneDir)
      .then(() => true)
      .catch(() => false);

    if (dirExists) {
      console.log(`[${timestamp}] [SKIP] ${projectName} already cloned`);
      return { name: projectName, success: true };
    }

    const command = `git clone --depth 1 ${repoUrl} ${cloneDir}`;
    await execAsync(command, { timeout: 300000 });

    const readme = await getReadme(repoUrl);
    if (readme) {
      await fs.writeFile(path.join(projectDir, 'README.md'), readme, 'utf-8');
    }

    console.log(`[${timestamp}] [SUCCESS] Cloned ${projectName}`);
    return { name: projectName, success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${timestamp}] [ERROR] Failed to clone ${projectName}:`, errorMsg);
    return { name: projectName, success: false, error: errorMsg };
  }
}

async function main() {
  console.log('=== Step 1: Clone Projects ===\n');

  const projects = await loadRawProjects();
  console.log(`Found ${projects.length} projects to clone\n`);

  const results: CloneResult[] = [];

  for (const project of projects) {
    const result = await cloneProject(project.repository_url, project.name);
    results.push(result);

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('\n=== Clone Summary ===');
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
