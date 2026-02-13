/**
 * Data loader utility
 * Handles reading and writing project data files
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { RawProject, ProjectMeta } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');
const AGGREGATED_DIR = path.join(DATA_DIR, 'aggregated');

/**
 * Load raw projects from JSON file
 */
export async function loadRawProjects(): Promise<RawProject[]> {
  try {
    const filePath = path.join(RAW_DIR, 'agent-memory-projects.json');
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (Array.isArray(data)) {
      return data as RawProject[];
    } else if (data.projects && Array.isArray(data.projects)) {
      return data.projects as RawProject[];
    }

    throw new Error('Invalid format in agent-memory-projects.json');
  } catch (error) {
    console.error('[ERROR] Failed to load raw projects:', error);
    throw error;
  }
}

/**
 * Get project directory path
 */
export function getProjectDir(projectName: string): string {
  return path.join(PROJECTS_DIR, projectName);
}

/**
 * Ensure project directory exists
 */
export async function ensureProjectDir(projectName: string): Promise<string> {
  const projectDir = getProjectDir(projectName);
  await fs.mkdir(projectDir, { recursive: true });
  return projectDir;
}

/**
 * Save project metadata
 */
export async function saveProjectMeta(
  projectName: string,
  meta: ProjectMeta
): Promise<void> {
  try {
    const projectDir = await ensureProjectDir(projectName);
    const filePath = path.join(projectDir, 'meta.json');
    await fs.writeFile(filePath, JSON.stringify(meta, null, 2), 'utf-8');
    console.log(`[SUCCESS] Saved meta.json for ${projectName}`);
  } catch (error) {
    console.error(`[ERROR] Failed to save meta for ${projectName}:`, error);
    throw error;
  }
}

/**
 * Load project metadata
 */
export async function loadProjectMeta(projectName: string): Promise<ProjectMeta | null> {
  try {
    const filePath = path.join(getProjectDir(projectName), 'meta.json');
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as ProjectMeta;
  } catch (error) {
    console.warn(`[WARN] Could not load meta for ${projectName}:`, error);
    return null;
  }
}

/**
 * Save markdown file
 */
export async function saveMarkdown(
  projectName: string,
  filename: string,
  content: string
): Promise<void> {
  try {
    const projectDir = await ensureProjectDir(projectName);
    const filePath = path.join(projectDir, filename);
    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`[SUCCESS] Saved ${filename} for ${projectName}`);
  } catch (error) {
    console.error(`[ERROR] Failed to save ${filename} for ${projectName}:`, error);
    throw error;
  }
}

/**
 * Load markdown file
 */
export async function loadMarkdown(
  projectName: string,
  filename: string
): Promise<string | null> {
  try {
    const filePath = path.join(getProjectDir(projectName), filename);
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    console.warn(`[WARN] Could not load ${filename} for ${projectName}`);
    return null;
  }
}

/**
 * Save aggregated data
 */
export async function saveAggregatedData(
  filename: string,
  data: any
): Promise<void> {
  try {
    await fs.mkdir(AGGREGATED_DIR, { recursive: true });
    const filePath = path.join(AGGREGATED_DIR, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[SUCCESS] Saved aggregated data: ${filename}`);
  } catch (error) {
    console.error(`[ERROR] Failed to save aggregated data ${filename}:`, error);
    throw error;
  }
}

/**
 * Load aggregated data
 */
export async function loadAggregatedData(filename: string): Promise<any | null> {
  try {
    const filePath = path.join(AGGREGATED_DIR, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`[WARN] Could not load aggregated data ${filename}`);
    return null;
  }
}

/**
 * Get all project names
 */
export async function getAllProjectNames(): Promise<string[]> {
  try {
    const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  } catch (error) {
    console.warn('[WARN] Could not list projects, directory may not exist yet');
    return [];
  }
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
