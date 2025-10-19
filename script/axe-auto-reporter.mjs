/**
 * @fileoverview Automated accessibility testing script using axe-core and Puppeteer
 * @version 3.1.1
 * @author burnworks
 * @requires node >=22.0.0
 */

import { mkdir, readFile, writeFile } from 'fs/promises';
import puppeteer from 'puppeteer';
import { loadPage } from '@axe-core/puppeteer';
import AXELOCALES_JA from 'axe-core/locales/ja.json' with { type: 'json' };
import path from 'path';
import pLimit from 'p-limit';
import { isIP } from 'net';
import config from './config.mjs';
import { generateBaseFilename } from './utils/filename.mjs';
import { REPORT_TRANSLATIONS } from '../shared/report-translations.js';


/**
 * @typedef {Object} Viewport
 * @property {number} width - Viewport width in pixels
 * @property {number} height - Viewport height in pixels
 */

/**
 * Predefined viewport configurations for different device types
 * @type {Object.<string, Viewport>}
 */
const VIEWPORTS = {
    PC: { width: 1024, height: 768 },
    MOBILE: { width: 375, height: 812 }
};

/**
 * @typedef {Object} ProcessedConfiguration
 * @property {string} urlList - Path to the file containing URLs to test
 * @property {Object} localeData - Locale data for axe-core
 * @property {string[]} tags - Array of axe-core tags
 * @property {string} locale - Current locale setting
 * @property {Viewport} viewport - Viewport configuration
 * @property {number} concurrency - Concurrency level
 * @property {boolean} enableConcurrency - Concurrency enabled flag
 * @property {string} screenshotFormat - Screenshot format
 * @property {number} screenshotQuality - Screenshot quality
 * @property {boolean} enableScreenshots - Screenshots enabled flag
 * @property {string} outputDirectory - Directory for storing results
 * @property {number} jsonIndentation - Number of spaces for JSON pretty printing
 * @property {number} navigationTimeout - Navigation timeout in milliseconds
 * @property {string[]} allowedDomains - Allowed domains for URL testing
 * @property {string[]} blockedDomains - Blocked domains for URL testing
 * @property {boolean} enableSandbox - Enable browser sandbox for security
 * @property {number} maxPageSize - Maximum page size in bytes
 */

/**
 * Processes and validates the configuration, adding derived properties
 * @returns {ProcessedConfiguration} Processed configuration object
 * @throws {Error} When invalid mode is specified
 */
const reportConfigure = () => {
    const newConfig = { ...config };

    if (newConfig.locale === 'ja') {
        newConfig.localeData = AXELOCALES_JA;
    }

    if (newConfig.mode === 'pc') {
        newConfig.viewport = VIEWPORTS.PC;
    } else if (newConfig.mode === 'mobile') {
        newConfig.viewport = VIEWPORTS.MOBILE;
    } else {
        console.error('\x1b[31mInvalid mode specified\x1b[0m');
        throw new Error('Invalid mode specified');
    }

    return newConfig;
};

/**
 * Global browser instance for cleanup purposes
 * @type {import('puppeteer').Browser|null}
 */
let browser;

/**
 * Cleanup function to properly close browser resources
 * @async
 * @returns {Promise<void>}
 */
const cleanup = async () => {
    if (browser) {
        try {
            await browser.close();
        } catch (error) {
            console.error('\x1b[31mError during browser cleanup:\x1b[0m', error.message);
        }
    }
};

process.on('unhandledRejection', async (reason, promise) => {
    console.error('\x1b[31mUnhandled promise rejection:\x1b[0m');
    console.error('Reason:', reason);
    console.error('Promise:', promise);

    await cleanup();
    process.exit(1);
});

process.on('uncaughtException', async (error) => {
    console.error('\x1b[31mUncaught exception:\x1b[0m');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    await cleanup();
    process.exit(1);
});

process.on('SIGINT', async () => {
    console.log('\n\x1b[33mReceived SIGINT. Cleaning up...\x1b[0m');
    await cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n\x1b[33mReceived SIGTERM. Cleaning up...\x1b[0m');
    await cleanup();
    process.exit(0);
});

/**
 * Ensures that a directory exists, creating it if necessary
 * @async
 * @param {string} dir - Directory path to create
 * @returns {Promise<void>}
 */
const ensureDirectoryExists = async (dir) => {
    await mkdir(dir, { recursive: true });
};

/**
 * Validates if a string is a valid URL
 * @param {any} url - URL to validate
 * @returns {boolean} True if valid URL, false otherwise
 */
const isValidUrl = (url) => {
    if (typeof url !== 'string') return false;
    const trimmed = url.trim();
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

/**
 * Checks if an IP address falls within a CIDR range (supports both IPv4 and IPv6)
 * @param {string} ip - IP address to check
 * @param {string} cidr - CIDR notation (e.g., "192.168.0.0/16" or "2001:db8::/32")
 * @returns {boolean} True if IP is within range, false otherwise
 */
const isIpInCidr = (ip, cidr) => {
    try {
        const [network, prefixLength] = cidr.split('/');
        const prefix = parseInt(prefixLength, 10);

        const isIPv4 = network.includes('.') && !network.includes(':');
        const isIPv6 = network.includes(':');

        if (isIPv4) {
            const networkParts = network.split('.').map(Number);
            const ipParts = ip.split('.').map(Number);

            if (networkParts.length !== 4 || ipParts.length !== 4) return false;
            if (prefix < 0 || prefix > 32) return false;

            const networkBits = (networkParts[0] << 24) | (networkParts[1] << 16) | (networkParts[2] << 8) | networkParts[3];
            const ipBits = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
            const mask = -1 << (32 - prefix);

            return (networkBits & mask) === (ipBits & mask);
        } else if (isIPv6) {
            if (prefix < 0 || prefix > 128) return false;

            /**
             * Validate IP addresses using Node.js built-in validation
             */
            if (isIP(network) !== 6 || isIP(ip) !== 6) return false;

            /**
             * Convert IPv6 addresses to binary representation
             * @param {string} addr - IPv6 address to convert
             * @returns {string} Binary representation
             */
            const ipv6ToBinary = (addr) => {
                /**
                 * Expand IPv6 address to full form
                 */
                const parts = addr.split(':');
                const expandedParts = [];
                let doubleColonIndex = parts.indexOf('');

                if (doubleColonIndex !== -1) {
                    const beforeDouble = parts.slice(0, doubleColonIndex);
                    const afterDouble = parts.slice(doubleColonIndex + 1).filter(p => p !== '');
                    const zerosNeeded = 8 - beforeDouble.length - afterDouble.length;

                    expandedParts.push(...beforeDouble);
                    for (let i = 0; i < zerosNeeded; i++) {
                        expandedParts.push('0000');
                    }
                    expandedParts.push(...afterDouble);
                } else {
                    expandedParts.push(...parts);
                }

                /**
                 * Pad each part to 4 hex digits and convert to binary
                 */
                return expandedParts
                    .map(part => parseInt(part.padStart(4, '0'), 16))
                    .map(num => num.toString(2).padStart(16, '0'))
                    .join('');
            };

            const networkBinary = ipv6ToBinary(network);
            const ipBinary = ipv6ToBinary(ip);

            if (networkBinary.length !== 128 || ipBinary.length !== 128) return false;

            /**
             * Compare up to prefix length
             */
            const networkPrefix = networkBinary.substring(0, prefix);
            const ipPrefix = ipBinary.substring(0, prefix);

            return networkPrefix === ipPrefix;
        }

        return false;
    } catch {
        return false;
    }
};

/**
 * Validates URL against security policies (allowed/blocked domains)
 * @param {string} url - URL to validate
 * @param {string[]} allowedDomains - List of allowed domains (empty = allow all)
 * @param {string[]} blockedDomains - List of blocked domains (supports CIDR for IPs)
 * @returns {boolean} True if URL is allowed, false otherwise
 */
const isUrlAllowed = (url, allowedDomains, blockedDomains) => {
    try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname.toLowerCase();

        for (const blockedDomain of blockedDomains) {
            const blocked = blockedDomain.toLowerCase();

            if (blocked.includes('/')) {
                if (isIpInCidr(hostname, blocked)) {
                    return false;
                }
            } else {
                if (hostname === blocked || hostname.endsWith(`.${blocked}`)) {
                    return false;
                }
            }
        }

        if (allowedDomains.length === 0) {
            return true;
        }
        for (const allowedDomain of allowedDomains) {
            const allowed = allowedDomain.toLowerCase();
            if (hostname === allowed || hostname.endsWith(`.${allowed}`)) {
                return true;
            }
        }

        return false;
    } catch {
        return false;
    }
};

/**
 * Validates if a value is a non-empty string
 * @param {any} str - String to validate
 * @returns {boolean} True if valid non-empty string, false otherwise
 */
const isValidString = (str) => typeof str === 'string' && str.trim().length > 0;

/**
 * Validates if a value is a number within specified range
 * @param {any} num - Number to validate
 * @param {number} [min=0] - Minimum allowed value
 * @param {number} [max=Infinity] - Maximum allowed value
 * @returns {boolean} True if valid number in range, false otherwise
 */
const isValidNumber = (num, min = 0, max = Infinity) =>
    typeof num === 'number' && !isNaN(num) && num >= min && num <= max;

/**
 * Validates the configuration object
 * @param {Object} config - Configuration object to validate
 * @returns {string[]} Array of validation error messages (empty if valid)
 */
const validateConfig = (config) => {
    const errors = [];

    if (!isValidString(config.urlList)) {
        errors.push('urlList must be a non-empty string');
    }

    if (!isValidString(config.locale)) {
        errors.push('locale must be a non-empty string');
    }

    if (!Array.isArray(config.tags) || config.tags.length === 0) {
        errors.push('tags must be a non-empty array');
    }

    if (!isValidString(config.mode)) {
        errors.push('mode must be a non-empty string');
    }

    if (Object.hasOwn(config, 'concurrency') && !isValidNumber(config.concurrency, 1, 10)) {
        errors.push('concurrency must be a number between 1 and 10');
    }

    if (Object.hasOwn(config, 'enableConcurrency') && typeof config.enableConcurrency !== 'boolean') {
        errors.push('enableConcurrency must be a boolean');
    }

    if (Object.hasOwn(config, 'outputDirectory') && !isValidString(config.outputDirectory)) {
        errors.push('outputDirectory must be a non-empty string');
    }

    if (Object.hasOwn(config, 'jsonIndentation') && !isValidNumber(config.jsonIndentation, 0, 10)) {
        errors.push('jsonIndentation must be a number between 0 and 10');
    }

    if (Object.hasOwn(config, 'navigationTimeout') && !isValidNumber(config.navigationTimeout, 1000, 300000)) {
        errors.push('navigationTimeout must be a number between 1000 and 300000 milliseconds');
    }

    if (Object.hasOwn(config, 'allowedDomains') && !Array.isArray(config.allowedDomains)) {
        errors.push('allowedDomains must be an array');
    }

    if (Object.hasOwn(config, 'blockedDomains') && !Array.isArray(config.blockedDomains)) {
        errors.push('blockedDomains must be an array');
    }

    if (Object.hasOwn(config, 'enableSandbox') && typeof config.enableSandbox !== 'boolean') {
        errors.push('enableSandbox must be a boolean');
    }

    if (Object.hasOwn(config, 'maxPageSize') && !isValidNumber(config.maxPageSize, 0, 1024 * 1024 * 1024)) {
        errors.push('maxPageSize must be a number between 0 and 1GB');
    }

    return errors;
};


/**
 * Translation data for supported locales (cached for performance)
 */
const TRANSLATIONS = REPORT_TRANSLATIONS;

try {

    const config = reportConfigure();
    const configErrors = validateConfig(config);

    if (configErrors.length > 0) {
        console.error('\x1b[31mConfiguration validation errors:\x1b[0m');
        configErrors.forEach(error => console.error(`  - ${error}`));
        throw new Error('Invalid configuration');
    }

    const {
        urlList,
        localeData,
        tags,
        locale,
        viewport,
        concurrency,
        enableConcurrency,
        screenshotFormat,
        screenshotQuality,
        enableScreenshots,
        outputDirectory,
        jsonIndentation,
        navigationTimeout,
        allowedDomains,
        blockedDomains,
        enableSandbox,
        maxPageSize,
        maxConcurrentPerDomain,
        delayBetweenRequests
    } = config;

    const impactMap = (TRANSLATIONS[locale] || TRANSLATIONS.en).impactData || {};

    /**
     * Puppeteer launch arguments with memory optimizations and security settings
     * @type {string[]}
     */
    const launchArgs = [
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--memory-pressure-off',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
    ];

    if (!enableSandbox) {
        launchArgs.push('--no-sandbox', '--disable-setuid-sandbox');
        console.warn('\x1b[33mWarning: Browser sandbox is disabled. This reduces security.\x1b[0m');
    }

    browser = await puppeteer.launch({
        headless: 'new',
        defaultViewport: viewport,
        args: launchArgs,
    });

    if (!isValidString(urlList)) {
        throw new Error('Invalid URL list file path provided');
    }

    const normalizedPath = path.resolve(urlList);
    const currentDir = path.resolve('.');
    const relativePath = path.relative(currentDir, normalizedPath);
    const isOutsideWorkspace = relativePath.startsWith('..') || path.isAbsolute(relativePath);

    if (isOutsideWorkspace) {
        throw new Error('URL list file path must be within current directory');
    }

    const urlsContent = await readFile(urlList, 'utf-8');
    const rawUrls = urlsContent.split('\n').filter(Boolean);

    const urls = [];
    const invalidUrls = [];
    const blockedUrls = [];

    for (const rawUrl of rawUrls) {
        const trimmedUrl = rawUrl.trim();
        if (isValidUrl(trimmedUrl)) {
            if (isUrlAllowed(trimmedUrl, allowedDomains, blockedDomains)) {
                urls.push(trimmedUrl);
            } else {
                blockedUrls.push(trimmedUrl);
            }
        } else if (trimmedUrl) {
            invalidUrls.push(trimmedUrl);
        }
    }

    if (invalidUrls.length > 0) {
        console.warn('\x1b[33mInvalid URLs found and will be skipped:\x1b[0m');
        invalidUrls.forEach(url => console.warn(`  - ${url}`));
    }

    if (blockedUrls.length > 0) {
        console.warn('\x1b[33mBlocked URLs found and will be skipped (security policy):\x1b[0m');
        blockedUrls.forEach(url => console.warn(`  - ${url}`));
    }

    if (urls.length === 0) {
        throw new Error('No valid URLs found in the URL list file');
    }

    console.log(`\x1b[36mFound ${urls.length} valid URLs to process\x1b[0m`);

    if (enableSandbox) {
        console.log('\x1b[32mSecurity: Browser sandbox enabled\x1b[0m');
    } else {
        console.warn('\x1b[33mSecurity: Browser sandbox disabled\x1b[0m');
    }

    if (allowedDomains.length > 0) {
        console.log(`\x1b[32mSecurity: Domain allowlist active (${allowedDomains.length} domains)\x1b[0m`);
    }

    if (blockedDomains.length > 0) {
        console.log(`\x1b[32mSecurity: Domain blocklist active (${blockedDomains.length} domains)\x1b[0m`);
    }

    if (maxPageSize > 0) {
        console.log(`\x1b[32mSecurity: Page size limit set to ${Math.round(maxPageSize / 1024 / 1024)}MB\x1b[0m`);
    }

    await ensureDirectoryExists(outputDirectory);

    const now = new Date();
    const dateTimeFolder = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0')
    ].join('-') + '_' + [
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0')
    ].join('-');
    const folderName = path.join(outputDirectory, dateTimeFolder);
    await ensureDirectoryExists(folderName);
    const jsonFolder = path.join(folderName, '_json');
    const publicResultsBase = path.join(process.cwd(), 'public', 'results');
    const publicRunFolder = path.join(publicResultsBase, dateTimeFolder);
    const publicImagesFolder = path.join(publicRunFolder, 'images');
    const screenshotWebPath = `/results/${dateTimeFolder}/images`;
    const directoryTasks = [ensureDirectoryExists(jsonFolder)];
    if (enableScreenshots) {
        directoryTasks.push(ensureDirectoryExists(publicImagesFolder));
    }
    await Promise.all(directoryTasks);


    const processUrl = async (url, index, total) => {
        if (!isValidUrl(url)) {
            return { url, success: false, error: 'Invalid URL format' };
        }

        if (!isValidNumber(index, 1) || !isValidNumber(total, 1)) {
            return { url, success: false, error: 'Invalid index or total parameters' };
        }

        let page = null;
        let axeBuilder = null;
        let eventHandlers = [];

        try {
            ({ page, axeBuilder, eventHandlers } = await initializePage(url, index, total, browser, navigationTimeout, maxPageSize));

            const screenshotBuffer = await captureScreenshot(
                page,
                enableScreenshots,
                screenshotFormat,
                screenshotQuality
            );

            const results = await runAccessibilityTest(axeBuilder, localeData, tags);

            await saveResults({
                runId: dateTimeFolder,
                url,
                results,
                screenshotBuffer,
                screenshotFormat,
                locale,
                jsonFolder,
                publicImagesFolder,
                screenshotWebPath,
                jsonIndentation
            });

            await cleanupMemory(results, index);

            console.log(`\x1b[32mCompleted!\x1b[0m ${index}/${total}: ${url}`);
            return { url, success: true };

        } catch (error) {
            return handleProcessingError(error, url);
        } finally {
            await safeCleanupPage(page, eventHandlers, index);
        }
    };

    const initializePage = async (url, index, total, browser, navigationTimeout, maxPageSize) => {
        console.log(`Processing ${index}/${total}: ${url}`);

        const axeBuilder = await loadPage(browser, url.trim());
        const page = axeBuilder.page;

        await page.setDefaultNavigationTimeout(navigationTimeout);
        await page.setDefaultTimeout(navigationTimeout);
        await page.setJavaScriptEnabled(true);

        const eventHandlers = [];
        if (maxPageSize > 0) {
            const responseHandler = (response) => {
                const contentLength = response.headers()['content-length'];
                if (contentLength && parseInt(contentLength, 10) > maxPageSize) {
                    throw new Error(`Page size exceeds limit: ${contentLength} bytes`);
                }
            };
            page.on('response', responseHandler);
            eventHandlers.push({ event: 'response', handler: responseHandler });
        }

        return { page, axeBuilder, eventHandlers };
    };

    const captureScreenshot = async (page, enableScreenshots, screenshotFormat, screenshotQuality) => {
        if (!enableScreenshots) return null;

        const screenshotOptions = {
            encoding: 'binary',
            type: screenshotFormat,
            fullPage: false,
            ...(screenshotFormat !== 'png' && { quality: screenshotQuality })
        };
        return await page.screenshot(screenshotOptions);
    };

    const runAccessibilityTest = async (axeBuilder, localeData, tags) => {
        const results = await axeBuilder.configure({ locale: localeData }).withTags(tags).analyze();

        if (!results || typeof results !== 'object') {
            throw new Error('Invalid axe test results received');
        }

        return results;
    };

    const saveResults = async ({
        runId,
        url,
        results,
        screenshotBuffer,
        screenshotFormat,
        locale,
        jsonFolder,
        publicImagesFolder,
        screenshotWebPath,
        jsonIndentation
    }) => {
        const baseFilename = generateBaseFilename(url);

        if (!isValidString(baseFilename)) {
            throw new Error('Failed to generate valid filename');
        }

        let screenshotRelativePath = null;
        if (screenshotBuffer) {
            const screenshotExtension = screenshotFormat === 'png' ? 'png' : (screenshotFormat === 'webp' ? 'webp' : 'jpg');
            const screenshotFilename = path.join(publicImagesFolder, `${baseFilename}.${screenshotExtension}`);
            await writeFile(screenshotFilename, screenshotBuffer);
            screenshotRelativePath = `${screenshotWebPath}/${baseFilename}.${screenshotExtension}`;
        }

        const jsonFilename = path.join(jsonFolder, `${baseFilename}.json`);
        const metadata = {
            runId,
            baseFilename,
            locale,
            screenshotPath: screenshotRelativePath
        };

        if (!results || typeof results !== 'object') {
            throw new Error('Invalid axe result object received');
        }

        if (results.metadata && typeof results.metadata === 'object') {
            results.metadata = { ...results.metadata, ...metadata };
        } else {
            results.metadata = metadata;
        }

        const jsonData = JSON.stringify(results, null, jsonIndentation);
        await writeFile(jsonFilename, jsonData, { encoding: 'utf-8', flag: 'w' });

    };

    const cleanupMemory = async (results, index) => {
        if (results.violations) {
            results.violations.forEach(violation => {
                if (violation.nodes) {
                    violation.nodes = violation.nodes.map(({ element, ...node }) => node);
                }
            });
        }

        if (typeof globalThis.gc === 'function' && (index % 50 === 0)) {
            try {
                globalThis.gc();
            } catch (error) {
            }
        }
    };

    const handleProcessingError = (error, url) => {
        const errorInfo = {
            url,
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            type: error.constructor.name
        };

        console.error(`\x1b[31mFailed to process URL:\x1b[0m ${url}`);
        console.error('Error details:', errorInfo);

        return { url, success: false, error: errorInfo };
    };

    const safeCleanupPage = async (page, eventHandlers, index) => {
        if (page && !page.isClosed()) {
            for (const { event, handler } of eventHandlers) {
                try {
                    page.off(event, handler);
                } catch (error) {
                    console.warn(`\x1b[33mWarning: Failed to remove ${event} handler for page ${index}:\x1b[0m`, error.message);
                }
            }
            await page.close();
        }
    };

    /**
     * Extracts domain from URL for rate limiting purposes
     * @param {string} url - URL to extract domain from
     * @returns {string} Domain hostname or 'invalid-domain'
     */
    const extractDomain = (url) => {
        try {
            return new URL(url).hostname;
        } catch {
            return 'invalid-domain';
        }
    };

    /**
     * Group URLs by domain for rate limiting
     * @type {Map<string, Array<{url: string, index: number}>>}
     */
    const urlsByDomain = new Map();
    urls.forEach((url, index) => {
        const domain = extractDomain(url);
        if (!urlsByDomain.has(domain)) {
            urlsByDomain.set(domain, []);
        }
        urlsByDomain.get(domain).push({ url, index });
    });

    /**
     * Create domain-specific queues for rate limiting
     */
    const domainQueues = new Map();
    const domainLastRequest = new Map();

    for (const domain of urlsByDomain.keys()) {
        domainQueues.set(domain, pLimit(maxConcurrentPerDomain));
    }

    /**
     * Processes URL with domain-based rate limiting
     * @param {string} url - URL to process
     * @param {number} index - Current index
     * @param {number} total - Total number of URLs
     * @returns {Promise<Object>} Processing result
     */
    const processUrlWithRateLimit = async (url, index, total) => {
        const domain = extractDomain(url);
        const queue = domainQueues.get(domain);

        return queue(async () => {
            /**
             * Implement delay for same domain requests
             */
            const lastRequestTime = domainLastRequest.get(domain) || 0;
            const timeSinceLastRequest = Date.now() - lastRequestTime;

            if (timeSinceLastRequest < delayBetweenRequests) {
                const delayNeeded = delayBetweenRequests - timeSinceLastRequest;
                await new Promise(resolve => setTimeout(resolve, delayNeeded));
            }

            domainLastRequest.set(domain, Date.now());
            return processUrl(url, index, total);
        });
    };

    /**
     * Run accessibility tests with domain-aware concurrency control
     */
    console.log(`\x1b[36mProcessing ${urls.length} URLs across ${urlsByDomain.size} domains\x1b[0m`);
    console.log(`\x1b[36mRate limiting: max ${maxConcurrentPerDomain} concurrent per domain, ${delayBetweenRequests}ms delay\x1b[0m`);

    let results;
    if (enableConcurrency && urls.length > 1) {
        /**
         * Process URLs with domain-aware rate limiting
         */
        console.log(`\x1b[36mUsing domain-aware rate limiting with global concurrency: ${concurrency}\x1b[0m`);

        const globalLimit = pLimit(concurrency);
        const promises = urls.map((url, index) =>
            globalLimit(() => processUrlWithRateLimit(url, index + 1, urls.length))
        );

        results = await Promise.allSettled(promises);
    } else {
        /**
         * Process URLs sequentially with rate limiting
         */
        const allResults = [];
        for (let i = 0; i < urls.length; i++) {
            const result = await processUrlWithRateLimit(urls[i], i + 1, urls.length);
            allResults.push({ status: 'fulfilled', value: result });
        }
        results = allResults;
    }

    /**
     * Report processing results
     */
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    console.log(`\x1b[32mProcessing completed!\x1b[0m`);
    console.log(`✅ Successful: ${successful}`);
    if (failed > 0) {
        console.log(`❌ Failed: ${failed}`);
    }

    await cleanup();
    console.log('\x1b[32mAll URLs processed successfully!\x1b[0m');
} catch (error) {
    console.error('\x1b[31mFatal error occurred:\x1b[0m');
    console.error('Error type:', error.constructor.name);
    console.error('Message:', error.message);
    console.error('Stack trace:', error.stack);

    await cleanup();
    process.exit(1);
}

