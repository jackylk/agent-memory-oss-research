/**
 * PDF downloader utility
 * Extracts paper links from README and downloads PDFs
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { PaperInfo } from './types.js';

/**
 * Extract paper links from README content
 */
export function extractPaperLinks(readme: string): string[] {
  const links: string[] = [];

  const patterns = [
    /https?:\/\/arxiv\.org\/abs\/[\d.]+/gi,
    /https?:\/\/arxiv\.org\/pdf\/[\d.]+\.pdf/gi,
    /https?:\/\/aclanthology\.org\/[\w\-\.]+\.pdf/gi,
    /https?:\/\/openreview\.net\/forum\?id=[\w-]+/gi,
    /https?:\/\/proceedings\.mlr\.press\/[\w\/\-]+\.pdf/gi,
    /https?:\/\/[^\s]+\.pdf/gi,
  ];

  for (const pattern of patterns) {
    const matches = readme.match(pattern);
    if (matches) {
      links.push(...matches);
    }
  }

  return [...new Set(links)];
}

/**
 * Convert arXiv abstract URL to PDF URL
 */
function convertArxivUrl(url: string): string {
  if (url.includes('/abs/')) {
    return url.replace('/abs/', '/pdf/') + '.pdf';
  }
  return url;
}

/**
 * Download PDF from URL
 */
export async function downloadPaper(
  url: string,
  savePath: string
): Promise<boolean> {
  try {
    const pdfUrl = convertArxivUrl(url);

    const response = await fetch(pdfUrl);
    if (!response.ok) {
      console.error(`[ERROR] Failed to download PDF from ${pdfUrl}: ${response.statusText}`);
      return false;
    }

    const buffer = await response.arrayBuffer();
    await fs.mkdir(path.dirname(savePath), { recursive: true });
    await fs.writeFile(savePath, Buffer.from(buffer));

    console.log(`[SUCCESS] Downloaded PDF to ${savePath}`);
    return true;
  } catch (error) {
    console.error(`[ERROR] Failed to download PDF from ${url}:`, error);
    return false;
  }
}

/**
 * Extract paper metadata from README
 */
export function extractPaperMetadata(readme: string, paperUrl: string): PaperInfo | null {
  try {
    const titleMatch = readme.match(/#{1,3}\s*(?:Paper|Publication)[:\s]*([^\n]+)/i) ||
                      readme.match(/\*\*(?:Paper|Publication)\*\*[:\s]*([^\n]+)/i);

    const venueMatch = readme.match(/(?:Published in|Conference|Venue)[:\s]*([^\n]+)/i) ||
                      readme.match(/\(([A-Z]+\s*\d{4})\)/);

    const yearMatch = readme.match(/\b(20\d{2})\b/);

    let title = 'Unknown';
    let venue = 'Unknown';
    let year = new Date().getFullYear();

    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    if (venueMatch) {
      venue = venueMatch[1].trim();
    }

    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
    }

    if (paperUrl.includes('arxiv.org')) {
      const arxivIdMatch = paperUrl.match(/(\d+\.\d+)/);
      if (arxivIdMatch) {
        const arxivYear = parseInt(arxivIdMatch[1].substring(0, 2), 10);
        if (arxivYear >= 0 && arxivYear <= 99) {
          year = arxivYear >= 90 ? 1900 + arxivYear : 2000 + arxivYear;
        }
      }
      if (venue === 'Unknown') {
        venue = 'arXiv';
      }
    }

    return {
      exists: true,
      title,
      venue,
      year,
      url: paperUrl,
    };
  } catch (error) {
    console.error('[ERROR] Failed to extract paper metadata:', error);
    return null;
  }
}

/**
 * Download and process paper for a project
 */
export async function processPaper(
  projectName: string,
  readme: string,
  projectDir: string
): Promise<PaperInfo | null> {
  const links = extractPaperLinks(readme);

  if (links.length === 0) {
    console.log(`[INFO] No paper links found for ${projectName}`);
    return null;
  }

  const paperUrl = links[0];
  const pdfPath = path.join(projectDir, 'paper.pdf');

  const metadata = extractPaperMetadata(readme, paperUrl);
  if (!metadata) {
    return null;
  }

  const downloaded = await downloadPaper(paperUrl, pdfPath);
  if (!downloaded) {
    console.warn(`[WARN] Could not download paper for ${projectName}, but metadata extracted`);
  }

  return metadata;
}
