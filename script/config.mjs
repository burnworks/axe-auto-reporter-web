import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
    DEFAULT_SETTINGS,
    ALLOWED_MODES,
    ALLOWED_TAGS,
    MAX_PAGE_LIMIT,
    ALLOWED_FREQUENCIES
} from '../shared/default-settings.js';

const ROOT_DIR = path.resolve(process.cwd());
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');
const URL_LIST_PATH = path.join(DATA_DIR, 'url-list.txt');

const ensureSettingsFile = async () => {
    if (!existsSync(DATA_DIR)) {
        await mkdir(DATA_DIR, { recursive: true });
    }
    if (!existsSync(SETTINGS_PATH)) {
        await writeFile(SETTINGS_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf-8');
    }
    if (!existsSync(URL_LIST_PATH)) {
        await writeFile(URL_LIST_PATH, '', 'utf-8');
    }
};

const normalizeSettings = (raw) => {
    if (!raw || typeof raw !== 'object') {
        return { ...DEFAULT_SETTINGS };
    }

    const sitemapUrl = typeof raw.sitemapUrl === 'string' ? raw.sitemapUrl.trim() : DEFAULT_SETTINGS.sitemapUrl;

    let tags = [];
    if (Array.isArray(raw.tags) && raw.tags.length > 0) {
        tags = raw.tags
            .filter(tag => typeof tag === 'string')
            .map(tag => tag.trim())
            .filter(tag => ALLOWED_TAGS.includes(tag));
    } else if (typeof raw.tag === 'string') {
        const tag = raw.tag.trim();
        if (ALLOWED_TAGS.includes(tag)) {
            tags = [tag];
        }
    }
    if (tags.length === 0) {
        tags = [...DEFAULT_SETTINGS.tags];
    }

    const mode = typeof raw.mode === 'string' && ALLOWED_MODES.includes(raw.mode.trim().toLowerCase())
        ? raw.mode.trim().toLowerCase()
        : DEFAULT_SETTINGS.mode;

    const rawMaxPages = Number.parseInt(String(raw.maxPages ?? DEFAULT_SETTINGS.maxPages), 10);
    const maxPages = Number.isFinite(rawMaxPages)
        ? Math.min(Math.max(rawMaxPages, MAX_PAGE_LIMIT.min), MAX_PAGE_LIMIT.max)
        : DEFAULT_SETTINGS.maxPages;

    const rawFrequency =
        typeof raw.frequency === 'string' ? raw.frequency.trim().toLowerCase() : DEFAULT_SETTINGS.frequency;
    const frequency = ALLOWED_FREQUENCIES.includes(rawFrequency) ? rawFrequency : DEFAULT_SETTINGS.frequency;

    return {
        sitemapUrl,
        tags,
        mode,
        maxPages,
        frequency
    };
};

const readSettings = async () => {
    try {
        const fileContent = await readFile(SETTINGS_PATH, 'utf-8');
        const parsed = JSON.parse(fileContent);
        return normalizeSettings(parsed);
    } catch (error) {
        return { ...DEFAULT_SETTINGS };
    }
};

await ensureSettingsFile();
const settings = await readSettings();

const config = {
    urlList: URL_LIST_PATH,
    locale: 'ja',
    tags: settings.tags,
    mode: settings.mode,
    frequency: settings.frequency,
    concurrency: 4,
    enableConcurrency: true,
    screenshotFormat: 'webp',
    screenshotQuality: 80,
    enableScreenshots: true,
    outputDirectory: path.join(ROOT_DIR, 'src', 'pages', 'results'),
    jsonIndentation: 2,
    navigationTimeout: 45000,
    allowedDomains: [],
    blockedDomains: [],
    enableSandbox: true,
    maxPageSize: 8 * 1024 * 1024,
    maxConcurrentPerDomain: 2,
    delayBetweenRequests: 1000
};

export default config;
export { settings as runtimeSettings, URL_LIST_PATH, SETTINGS_PATH, readSettings as loadSettings };
