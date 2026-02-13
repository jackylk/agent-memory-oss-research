# Agent Memory Analysis Scripts

Automated analysis pipeline for Agent Memory research projects.

## Overview

This directory contains TypeScript scripts that analyze 25 agent memory projects from GitHub, extracting technical architecture, academic papers, cloud service requirements, and user pain points.

## Setup

### Prerequisites

- Node.js 18+ and npm
- Anthropic API key
- GitHub Personal Access Token (for higher rate limits)

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and add your API keys:

```bash
cp .env.example .env
```

Required variables:
- `ANTHROPIC_API_KEY`: Your Anthropic Claude API key
- `GITHUB_TOKEN`: GitHub Personal Access Token

## Scripts

### Individual Steps

Each script can be run independently:

```bash
npm run clone-projects        # Step 1: Clone 25 GitHub projects
npm run download-papers       # Step 2: Download academic papers (PDFs)
npm run analyze-architecture  # Step 3: Analyze technical architecture
npm run analyze-papers        # Step 4: Analyze academic papers
npm run extract-cloud-needs   # Step 5: Extract cloud service requirements
npm run extract-pain-points   # Step 6: Extract user pain points from Issues
npm run generate-aggregations # Step 7: Generate aggregated insights
```

### Complete Pipeline

Run all steps in sequence:

```bash
npm run analyze-all
```

This will execute all 7 steps and generate a comprehensive analysis of all projects.

## Output Structure

```
data/
├── projects/
│   ├── mem0/
│   │   ├── meta.json              # Structured metadata
│   │   ├── README.md              # Original project README
│   │   ├── architecture.md        # Technical architecture analysis
│   │   ├── paper-analysis.md      # Academic paper analysis
│   │   ├── cloud-needs.md         # Cloud service requirements
│   │   ├── user-pain-points.md    # User pain points from Issues
│   │   ├── paper.pdf              # Downloaded paper (if available)
│   │   └── repo/                  # Cloned repository
│   └── [24 other projects...]
└── aggregated/
    ├── categories.json            # Projects grouped by tech approach
    ├── cloud-needs.json           # Aggregated cloud requirements
    ├── trends.json                # Market trends analysis
    └── papers-summary.json        # Academic papers summary
```

## Library Modules

### `lib/types.ts`
TypeScript type definitions for all data structures.

### `lib/github-api.ts`
GitHub API wrapper using Octokit:
- `getRepository()`: Fetch repository info
- `getReadme()`: Fetch README content
- `getIssues()`: Fetch recent issues
- `getFileContent()`: Fetch specific files

### `lib/claude-agent.ts`
Claude AI analysis wrapper:
- `analyzeArchitecture()`: Analyze technical architecture
- `analyzePaper()`: Deep analysis of academic papers
- `extractPainPoints()`: Extract pain points from issues
- `inferCloudNeeds()`: Infer cloud service requirements

### `lib/pdf-downloader.ts`
PDF download and processing:
- `extractPaperLinks()`: Find paper URLs in README
- `downloadPaper()`: Download PDF from URL
- `processPaper()`: Complete paper processing workflow

### `lib/data-loader.ts`
Data I/O utilities:
- `loadRawProjects()`: Load source project list
- `saveProjectMeta()`: Save project metadata
- `loadProjectMeta()`: Load project metadata
- `saveMarkdown()`: Save markdown analysis
- `loadMarkdown()`: Load markdown content
- `saveAggregatedData()`: Save aggregated data
- `getAllProjectNames()`: List all analyzed projects

## Development

### Type Checking

```bash
npm run type-check
```

### Testing

```bash
npm test                  # Unit tests
npm run test:integration  # Integration tests
```

## Cost Estimates

Running the complete analysis pipeline:

- **Claude API**: ~$5-10 (architecture + paper analysis for 25 projects)
- **GitHub API**: Free (with token, stays under rate limits)
- **Time**: ~2-4 hours for complete pipeline

## Troubleshooting

### Rate Limits

If you hit GitHub rate limits:
1. Ensure `GITHUB_TOKEN` is set in `.env`
2. Check rate limit: Scripts will automatically log current limits
3. Wait and retry, or spread requests over time

### Claude API Errors

If Claude API calls fail:
1. Verify `ANTHROPIC_API_KEY` is valid
2. Check account credits
3. Scripts implement retry logic with exponential backoff

### PDF Download Failures

Some papers may be behind paywalls or have changed URLs:
- Scripts will continue processing other projects
- Failed downloads are logged but don't halt the pipeline
- Metadata is still extracted from README when possible

## Next Steps

After running the analysis pipeline, use the generated data with the Next.js website in `/website` directory to visualize and explore the research hub.
