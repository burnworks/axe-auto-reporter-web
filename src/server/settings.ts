import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_SETTINGS,
  ALLOWED_MODES,
  ALLOWED_TAGS,
  MAX_PAGE_LIMIT,
  ALLOWED_FREQUENCIES
} from '../../shared/default-settings.js';

export type Settings = {
  sitemapUrl: string;
  tags: string[];
  mode: (typeof ALLOWED_MODES)[number];
  maxPages: number;
  frequency: (typeof ALLOWED_FREQUENCIES)[number];
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  value: Settings;
};

const SETTINGS_FILE_PATH = path.resolve(process.cwd(), 'data', 'settings.json');

const ensureSettingsStorage = async () => {
  const dir = path.dirname(SETTINGS_FILE_PATH);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  if (!existsSync(SETTINGS_FILE_PATH)) {
    await writeFile(SETTINGS_FILE_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf-8');
  }
};

const splitTags = (value: string): string[] =>
  value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

const normalizeTags = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw
      .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
      .filter(Boolean);
  }

  if (typeof raw === 'string') {
    return splitTags(raw);
  }

  if (raw && typeof raw === 'object' && 'tag' in (raw as Record<string, unknown>)) {
    const tagValue = (raw as Record<string, unknown>).tag;
    if (typeof tagValue === 'string') {
      return splitTags(tagValue);
    }
  }

  return [];
};

const normalizeSettings = (raw: Partial<Settings>): Settings => {
  const sitemapUrl = typeof raw.sitemapUrl === 'string' ? raw.sitemapUrl.trim() : DEFAULT_SETTINGS.sitemapUrl;

  const rawTags = normalizeTags(raw.tags ?? (raw as unknown as { tag?: string })?.tag);
  const tags = rawTags.length > 0 ? rawTags : DEFAULT_SETTINGS.tags;

  const rawMode = typeof raw.mode === 'string' ? raw.mode.trim().toLowerCase() : DEFAULT_SETTINGS.mode;
  const mode = ALLOWED_MODES.includes(rawMode as Settings['mode']) ? (rawMode as Settings['mode']) : DEFAULT_SETTINGS.mode;

  const numericMaxPages = typeof raw.maxPages === 'number' ? raw.maxPages : Number.parseInt(String(raw.maxPages ?? ''), 10);
  const maxPages =
    Number.isFinite(numericMaxPages) && numericMaxPages >= MAX_PAGE_LIMIT.min && numericMaxPages <= MAX_PAGE_LIMIT.max
      ? Math.floor(numericMaxPages)
      : DEFAULT_SETTINGS.maxPages;

  const rawFrequency =
    typeof raw.frequency === 'string' ? raw.frequency.trim().toLowerCase() : DEFAULT_SETTINGS.frequency;
  const frequency = ALLOWED_FREQUENCIES.includes(rawFrequency as Settings['frequency'])
    ? (rawFrequency as Settings['frequency'])
    : DEFAULT_SETTINGS.frequency;

  return {
    sitemapUrl,
    tags,
    mode,
    maxPages,
    frequency
  };
};

const validateSettingsValue = (value: Settings): string[] => {
  const errors: string[] = [];

  if (value.sitemapUrl) {
    try {
      const parsed = new URL(value.sitemapUrl);
      if (!parsed.pathname.endsWith('.xml')) {
        errors.push('sitemapUrl は .xml で終わる URL を指定してください。');
      }
    } catch (error) {
      errors.push('sitemapUrl が正しい URL 形式ではありません。');
    }
  }

  const filteredTags = value.tags.filter((tag) => ALLOWED_TAGS.includes(tag));
  if (filteredTags.length === 0) {
    errors.push(`タグは ${ALLOWED_TAGS.join(', ')} のいずれかを選択してください。`);
  } else if (filteredTags.length !== value.tags.length) {
    errors.push('使用できないタグが指定されました。');
  } else {
    value.tags = filteredTags;
  }

  if (!ALLOWED_MODES.includes(value.mode)) {
    errors.push(`mode は ${ALLOWED_MODES.join(' / ')} のいずれかを指定してください。`);
  }

  if (
    !Number.isInteger(value.maxPages) ||
    value.maxPages < MAX_PAGE_LIMIT.min ||
    value.maxPages > MAX_PAGE_LIMIT.max
  ) {
    errors.push(`maxPages は ${MAX_PAGE_LIMIT.min} から ${MAX_PAGE_LIMIT.max} の整数で指定してください。`);
  }

  if (!ALLOWED_FREQUENCIES.includes(value.frequency)) {
    errors.push(`frequency は ${ALLOWED_FREQUENCIES.join(' / ')} のいずれかを指定してください。`);
  }

  return errors;
};

export const readSettings = async (): Promise<Settings> => {
  await ensureSettingsStorage();

  try {
    const content = await readFile(SETTINGS_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(content) as Partial<Settings>;
    const normalized = normalizeSettings(parsed);
    const errors = validateSettingsValue({ ...normalized });

    if (errors.length > 0) {
      throw new Error(errors.join('\n'));
    }

    return normalized;
  } catch (error) {
    await writeFile(SETTINGS_FILE_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf-8');
    return { ...DEFAULT_SETTINGS };
  }
};

export const validateSettings = (payload: Partial<Settings>): ValidationResult => {
  const normalized = normalizeSettings(payload);
  const errors = validateSettingsValue({ ...normalized });

  return {
    valid: errors.length === 0,
    errors,
    value: normalized
  };
};

export const saveSettings = async (payload: Partial<Settings>): Promise<Settings> => {
  await ensureSettingsStorage();

  const { valid, errors, value } = validateSettings(payload);

  if (!valid) {
    const error = new Error('設定値にエラーがあります。');
    (error as Error & { details?: string[] }).details = errors;
    throw error;
  }

  await writeFile(SETTINGS_FILE_PATH, JSON.stringify(value, null, 2), 'utf-8');
  return value;
};

export { SETTINGS_FILE_PATH };
