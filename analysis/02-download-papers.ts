/**
 * Step 2: Download Papers
 * Downloads academic papers (PDFs) from README links
 */

import { loadRawProjects, loadMarkdown, ensureProjectDir } from './lib/data-loader.js';
import { processPaper } from './lib/pdf-downloader.js';
import * as fs from 'fs/promises';
import * as path from 'path';

interface DownloadResult {
  name: string;
  success: boolean;
  hasPaper: boolean;
  error?: string;
}

async function downloadPaperForProject(projectName: string): Promise<DownloadResult> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DOWNLOAD] Processing papers for ${projectName}...`);

  try {
    const projectDir = await ensureProjectDir(projectName);
    const readme = await loadMarkdown(projectName, 'README.md');

    if (!readme) {
      console.log(`[${timestamp}] [SKIP] No README found for ${projectName}`);
      return { name: projectName, success: true, hasPaper: false };
    }

    const paperInfo = await processPaper(projectName, readme, projectDir);

    if (paperInfo) {
      await fs.writeFile(
        path.join(projectDir, 'paper-metadata.json'),
        JSON.stringify(paperInfo, null, 2),
        'utf-8'
      );
      console.log(`[${timestamp}] [SUCCESS] Paper processed for ${projectName}`);
      return { name: projectName, success: true, hasPaper: true };
    } else {
      console.log(`[${timestamp}] [INFO] No paper found for ${projectName}`);
      return { name: projectName, success: true, hasPaper: false };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${timestamp}] [ERROR] Failed to download paper for ${projectName}:`, errorMsg);
    return { name: projectName, success: false, hasPaper: false, error: errorMsg };
  }
}

async function main() {
  console.log('=== Step 2: Download Papers ===\n');

  const projects = await loadRawProjects();
  console.log(`Found ${projects.length} projects to process\n`);

  const results: DownloadResult[] = [];

  for (const project of projects) {
    const result = await downloadPaperForProject(project.name);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const successful = results.filter(r => r.success).length;
  const withPapers = results.filter(r => r.hasPaper).length;
  const failed = results.filter(r => !r.success).length;

  console.log('\n=== Download Summary ===');
  console.log(`Total: ${projects.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`With Papers: ${withPapers}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
