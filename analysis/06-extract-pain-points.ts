/**
 * Step 6: Extract Pain Points
 * Extracts user pain points from GitHub issues
 */

import { loadRawProjects, saveMarkdown } from './lib/data-loader.js';
import { getIssues } from './lib/github-api.js';
import { extractPainPoints } from './lib/claude-agent.js';

interface ExtractionResult {
  name: string;
  success: boolean;
  error?: string;
}

async function extractPainPointsForProject(
  repoUrl: string,
  projectName: string
): Promise<ExtractionResult> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [EXTRACT] Extracting pain points for ${projectName}...`);

  try {
    const issues = await getIssues(repoUrl, 100);

    if (issues.length === 0) {
      console.log(`[${timestamp}] [SKIP] No issues found for ${projectName}`);
      return { name: projectName, success: true };
    }

    const painPoints = await extractPainPoints(projectName, issues);

    const markdown = `# User Pain Points: ${projectName}

## Summary
Extracted from ${issues.length} recent GitHub issues.

## Pain Points by Category

${painPoints
  .map(
    pp => `### ${pp.category.charAt(0).toUpperCase() + pp.category.slice(1)}

**Description:** ${pp.description}

**Estimated Frequency:** ${pp.frequency} users affected

**Example Issues:**
${pp.example_issues.map(issue => `- ${issue}`).join('\n')}
`
  )
  .join('\n')}

## Analysis Date
${new Date().toISOString()}
`;

    await saveMarkdown(projectName, 'user-pain-points.md', markdown);

    console.log(`[${timestamp}] [SUCCESS] Pain points extracted for ${projectName}`);
    return { name: projectName, success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${timestamp}] [ERROR] Failed to extract pain points for ${projectName}:`, errorMsg);
    return { name: projectName, success: false, error: errorMsg };
  }
}

async function main() {
  console.log('=== Step 6: Extract Pain Points ===\n');

  const projects = await loadRawProjects();
  console.log(`Found ${projects.length} projects to process\n`);

  const results: ExtractionResult[] = [];

  for (const project of projects) {
    const result = await extractPainPointsForProject(project.repository_url, project.name);
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
