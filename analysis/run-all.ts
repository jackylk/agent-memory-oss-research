/**
 * Complete Analysis Pipeline
 * Orchestrates all analysis steps from cloning to aggregation
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface StepResult {
  step: string;
  success: boolean;
  duration: number;
  error?: string;
}

async function runStep(
  stepNumber: number,
  scriptName: string,
  description: string
): Promise<StepResult> {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Step ${stepNumber}: ${description}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    const { stdout, stderr } = await execAsync(`tsx ${scriptName}`, {
      cwd: process.cwd(),
      timeout: 3600000,
    });

    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    const duration = Date.now() - startTime;
    console.log(`\n✓ Step ${stepNumber} completed in ${(duration / 1000).toFixed(2)}s`);

    return { step: description, success: true, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\n✗ Step ${stepNumber} failed:`, errorMsg);

    return { step: description, success: false, duration, error: errorMsg };
  }
}

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║        Agent Memory Research Hub - Analysis Pipeline      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);

  const startTime = Date.now();
  const results: StepResult[] = [];

  const steps = [
    { script: '01-clone-projects.ts', description: 'Clone GitHub Projects' },
    { script: '02-download-papers.ts', description: 'Download Academic Papers' },
    { script: '03-analyze-architecture.ts', description: 'Analyze Architecture' },
    { script: '04-analyze-papers.ts', description: 'Analyze Papers' },
    { script: '05-extract-cloud-needs.ts', description: 'Extract Cloud Needs' },
    { script: '06-extract-pain-points.ts', description: 'Extract Pain Points' },
    { script: '07-generate-aggregations.ts', description: 'Generate Aggregations' },
  ];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const result = await runStep(i + 1, step.script, step.description);
    results.push(result);

    if (!result.success) {
      console.error('\n⚠️  Pipeline halted due to error');
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  const totalDuration = Date.now() - startTime;
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n${'='.repeat(60)}`);
  console.log('PIPELINE SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total Steps: ${steps.length}`);
  console.log(`Completed: ${successful}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total Duration: ${(totalDuration / 1000 / 60).toFixed(2)} minutes`);

  if (failed > 0) {
    console.log('\nFailed steps:');
    results
      .filter(r => !r.success)
      .forEach(r => console.log(`  ✗ ${r.step}: ${r.error}`));
  } else {
    console.log('\n✓ All steps completed successfully!');
  }

  console.log(`\nTimestamp: ${new Date().toISOString()}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
