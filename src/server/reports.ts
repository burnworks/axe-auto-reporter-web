import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export type ReportIndexEntry = {
  runId: string;
  runTimestamp?: string;
  generatedAt: string;
  summaryJson: string;
  summaryHtml: string;
  resultsDir: string;
  totalPages: number;
  globalTotal: number;
  tags: string[];
  mode: string;
  maxPages: number;
  frequency?: string;
};

export type ReportsIndex = {
  runs: ReportIndexEntry[];
};

export type RunSummary = {
  runId: string;
  runTimestamp?: string;
  generatedAt: string;
  resultsDir: string;
  totalPages: number;
  globalTotal: number;
  totals: Record<string, number>;
  occurrenceRates: Record<string, number>;
  pages: Array<{
    url: string;
    baseFilename: string;
    minor: number;
    moderate: number;
    serious: number;
    critical: number;
    total: number;
  }>;
  settings: {
    sitemapUrl: string;
    tags: string[];
    mode: string;
    maxPages: number;
    frequency?: string;
  };
};

const REPORTS_DIR = path.resolve(process.cwd(), 'data', 'reports');
const REPORTS_INDEX_PATH = path.join(REPORTS_DIR, 'index.json');

const ensureReportsIndex = async (): Promise<ReportsIndex> => {
  if (!existsSync(REPORTS_INDEX_PATH)) {
    return { runs: [] };
  }

  const content = await readFile(REPORTS_INDEX_PATH, 'utf-8');
  try {
    const parsed = JSON.parse(content) as ReportsIndex;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.runs)) {
      return { runs: [] };
    }

    const filteredRuns = parsed.runs.filter((entry) => {
      if (!entry || typeof entry !== 'object') return false;
      const summaryPath = typeof entry.summaryJson === 'string' ? path.resolve(process.cwd(), entry.summaryJson) : null;
      const resultsPath = typeof entry.resultsDir === 'string' ? path.resolve(process.cwd(), entry.resultsDir) : null;
      const summaryExists = summaryPath ? existsSync(summaryPath) : false;
      const resultsExists = resultsPath ? existsSync(resultsPath) : false;
      return summaryExists && resultsExists;
    });

    return { runs: filteredRuns };
  } catch {
    return { runs: [] };
  }
};

export const readReportsIndex = async (): Promise<ReportsIndex> => ensureReportsIndex();

export const readRunSummary = async (runId: string): Promise<RunSummary | null> => {
  if (!runId) return null;

  const index = await ensureReportsIndex();
  const match = index.runs.find((entry) => entry.runId === runId);
  if (!match) return null;

  const summaryPath = path.resolve(process.cwd(), match.summaryJson);
  if (!existsSync(summaryPath)) {
    return null;
  }

  const raw = await readFile(summaryPath, 'utf-8');
  try {
    const summary = JSON.parse(raw) as RunSummary;
    return summary;
  } catch {
    return null;
  }
};
