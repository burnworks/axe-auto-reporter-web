import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { runtimeSettings, URL_LIST_PATH } from './config.mjs';

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true
});

const visitedSitemaps = new Set();

const normalizeToArray = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
};

const isHttpUrl = (value) => {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed || (!trimmed.startsWith('http://') && !trimmed.startsWith('https://'))) {
        return false;
    }
    try {
        new URL(trimmed);
        return true;
    } catch {
        return false;
    }
};

const extractLocation = (entry) => {
    if (!entry) return null;
    if (typeof entry === 'string') return entry.trim();
    if (entry.loc) return String(entry.loc).trim();
    if (entry.url) return extractLocation(entry.url);
    return null;
};

const fetchSitemap = async (url) => {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) {
        throw new Error(`Failed to fetch sitemap: ${url} (${response.status})`);
    }
    return await response.text();
};

const resolveUrl = (baseUrl, relativeUrl) => {
    try {
        return new URL(relativeUrl, baseUrl).toString();
    } catch (error) {
        return null;
    }
};

const collectUrlsFromSitemap = async (sitemapUrl, limit, collected) => {
    if (collected.length >= limit) return;
    if (visitedSitemaps.has(sitemapUrl)) return;
    visitedSitemaps.add(sitemapUrl);

    const xml = await fetchSitemap(sitemapUrl);
    const parsed = parser.parse(xml);

    if (parsed.urlset) {
        const entries = normalizeToArray(parsed.urlset.url);
        for (const entry of entries) {
            if (collected.length >= limit) break;
            const location = extractLocation(entry);
            if (location && isHttpUrl(location) && !collected.includes(location)) {
                collected.push(location);
            }
        }
        return;
    }

    if (parsed.sitemapindex) {
        const children = normalizeToArray(parsed.sitemapindex.sitemap);
        for (const child of children) {
            if (collected.length >= limit) break;
            const location = extractLocation(child);
            if (!location) continue;
            const resolved = resolveUrl(sitemapUrl, location);
            if (!resolved || !isHttpUrl(resolved)) continue;
            await collectUrlsFromSitemap(resolved, limit, collected);
        }
    }
};

const main = async () => {
    const sitemapUrl = runtimeSettings.sitemapUrl;
    const limit = runtimeSettings.maxPages;

    if (!sitemapUrl) {
        console.warn('sitemapUrl が設定されていないため、URL リストを生成できません。設定画面で URL を保存してください。');
        return;
    }

    const collected = [];

    try {
        await collectUrlsFromSitemap(sitemapUrl, limit, collected);
    } catch (error) {
        console.error('sitemap の取得・解析に失敗しました:', error.message);
        throw error;
    }

    if (collected.length === 0) {
        console.warn('sitemap から URL を取得できませんでした。設定値をご確認ください。');
    }

    const normalizedPaths = collected.slice(0, limit).join('\n');
    await writeFile(URL_LIST_PATH, normalizedPaths, 'utf-8');

    console.log(`抽出した URL 件数: ${Math.min(collected.length, limit)} 件（最大 ${limit} 件）`);
    console.log(`URL リストを更新しました: ${path.relative(process.cwd(), URL_LIST_PATH)}`);
};

await main();
