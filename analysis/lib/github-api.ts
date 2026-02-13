/**
 * GitHub API wrapper using Octokit
 * Handles repository information, issues, and README fetching
 */

import { Octokit } from '@octokit/rest';
import * as dotenv from 'dotenv';
import type { GitHubIssue } from './types.js';

dotenv.config();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

/**
 * Parse repository URL to extract owner and repo name
 */
function parseRepoUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) {
    throw new Error(`Invalid GitHub URL: ${url}`);
  }
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ''),
  };
}

/**
 * Get repository information
 */
export async function getRepository(repoUrl: string) {
  const { owner, repo } = parseRepoUrl(repoUrl);

  try {
    const { data } = await octokit.repos.get({
      owner,
      repo,
    });

    return {
      name: data.name,
      full_name: data.full_name,
      description: data.description,
      stars: data.stargazers_count,
      language: data.language,
      updated_at: data.updated_at,
      topics: data.topics || [],
      license: data.license?.name,
    };
  } catch (error) {
    console.error(`[ERROR] Failed to fetch repository ${owner}/${repo}:`, error);
    throw error;
  }
}

/**
 * Get README content
 */
export async function getReadme(repoUrl: string): Promise<string> {
  const { owner, repo } = parseRepoUrl(repoUrl);

  try {
    const { data } = await octokit.repos.getReadme({
      owner,
      repo,
    });

    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return content;
  } catch (error) {
    console.error(`[ERROR] Failed to fetch README for ${owner}/${repo}:`, error);
    return '';
  }
}

/**
 * Get recent issues (open and closed)
 */
export async function getIssues(
  repoUrl: string,
  count: number = 100
): Promise<GitHubIssue[]> {
  const { owner, repo } = parseRepoUrl(repoUrl);

  try {
    const { data } = await octokit.issues.listForRepo({
      owner,
      repo,
      state: 'all',
      sort: 'created',
      direction: 'desc',
      per_page: Math.min(count, 100),
    });

    return data.map(issue => ({
      title: issue.title,
      body: issue.body || '',
      state: issue.state,
      created_at: issue.created_at,
      labels: issue.labels.map(label =>
        typeof label === 'string' ? label : label.name || ''
      ),
      comments: issue.comments,
    }));
  } catch (error) {
    console.error(`[ERROR] Failed to fetch issues for ${owner}/${repo}:`, error);
    return [];
  }
}

/**
 * Get file content from repository
 */
export async function getFileContent(
  repoUrl: string,
  path: string
): Promise<string> {
  const { owner, repo } = parseRepoUrl(repoUrl);

  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    if ('content' in data && data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }

    return '';
  } catch (error) {
    console.error(`[ERROR] Failed to fetch file ${path} from ${owner}/${repo}:`, error);
    return '';
  }
}

/**
 * Check rate limit status
 */
export async function getRateLimit() {
  try {
    const { data } = await octokit.rateLimit.get();
    return {
      limit: data.rate.limit,
      remaining: data.rate.remaining,
      reset: new Date(data.rate.reset * 1000),
    };
  } catch (error) {
    console.error('[ERROR] Failed to fetch rate limit:', error);
    throw error;
  }
}
