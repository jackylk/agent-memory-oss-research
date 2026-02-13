/**
 * Step 7: Generate Aggregations
 * Aggregates data from all projects into summary reports
 */

import { getAllProjectNames, loadProjectMeta, saveAggregatedData } from './lib/data-loader.js';
import type { AggregatedCategory, AggregatedCloudNeed, Trend, PaperSummary } from './lib/types.js';

async function generateCategories() {
  console.log('[AGGREGATE] Generating categories...');

  const projectNames = await getAllProjectNames();
  const categories = new Map<string, Set<string>>();

  for (const name of projectNames) {
    const meta = await loadProjectMeta(name);
    if (!meta) continue;

    for (const approach of meta.categories.tech_approach) {
      if (!categories.has(approach)) {
        categories.set(approach, new Set());
      }
      categories.get(approach)!.add(name);
    }
  }

  const result: AggregatedCategory[] = Array.from(categories.entries()).map(
    ([name, projects]) => ({
      name,
      count: projects.size,
      projects: Array.from(projects),
      description: `Projects using ${name} approach`,
    })
  );

  await saveAggregatedData('categories.json', result);
  console.log(`[SUCCESS] Generated ${result.length} categories`);
}

async function generateCloudNeeds() {
  console.log('[AGGREGATE] Generating cloud needs...');

  const projectNames = await getAllProjectNames();
  const needsMap = new Map<string, Set<string>>();

  for (const name of projectNames) {
    const meta = await loadProjectMeta(name);
    if (!meta) continue;

    for (const storageType of meta.cloud_needs.storage.types) {
      if (!needsMap.has(storageType)) {
        needsMap.set(storageType, new Set());
      }
      needsMap.get(storageType)!.add(name);
    }
  }

  const result: AggregatedCloudNeed[] = Array.from(needsMap.entries())
    .map(([need_type, projects]) => ({
      need_type,
      frequency: projects.size,
      projects: Array.from(projects),
      priority: (projects.size > 10 ? 'high' : projects.size > 5 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
    }))
    .sort((a, b) => b.frequency - a.frequency);

  await saveAggregatedData('cloud-needs.json', result);
  console.log(`[SUCCESS] Generated ${result.length} cloud needs`);
}

async function generateTrends() {
  console.log('[AGGREGATE] Generating trends...');

  const projectNames = await getAllProjectNames();
  const trends: Trend[] = [
    {
      name: 'Total Projects',
      growth_rate: 0,
      project_count: projectNames.length,
      description: 'Total number of analyzed projects',
    },
  ];

  await saveAggregatedData('trends.json', trends);
  console.log(`[SUCCESS] Generated trends`);
}

async function generatePapersSummary() {
  console.log('[AGGREGATE] Generating papers summary...');

  const projectNames = await getAllProjectNames();
  const venues = new Map<string, number>();
  const years = new Map<number, number>();
  const topPapers: PaperSummary['top_papers'] = [];

  let totalPapers = 0;

  for (const name of projectNames) {
    const meta = await loadProjectMeta(name);
    if (!meta || !meta.paper || !meta.paper.exists) continue;

    totalPapers++;

    venues.set(meta.paper.venue, (venues.get(meta.paper.venue) || 0) + 1);
    years.set(meta.paper.year, (years.get(meta.paper.year) || 0) + 1);

    topPapers.push({
      title: meta.paper.title,
      project: name,
      venue: meta.paper.venue,
      year: meta.paper.year,
    });
  }

  const summary: PaperSummary = {
    total_papers: totalPapers,
    venues: Object.fromEntries(venues),
    years: Object.fromEntries(years),
    top_papers: topPapers.slice(0, 10),
  };

  await saveAggregatedData('papers-summary.json', summary);
  console.log(`[SUCCESS] Generated papers summary (${totalPapers} papers)`);
}

async function main() {
  console.log('=== Step 7: Generate Aggregations ===\n');

  await generateCategories();
  await generateCloudNeeds();
  await generateTrends();
  await generatePapersSummary();

  console.log('\n=== Aggregation Complete ===');
}

main().catch(console.error);
