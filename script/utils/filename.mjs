import crypto from 'node:crypto';

const sanitizeSegment = (segment) =>
    segment
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-_]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();

const createHashSuffix = (value, length = 8) =>
    crypto.createHash('sha1').update(value).digest('hex').slice(0, length);

export const generateBaseFilename = (url) => {
    if (typeof url !== 'string' || !url.trim()) {
        throw new Error('URL must be a non-empty string');
    }

    const trimmed = url.trim();
    let parsed;

    try {
        parsed = new URL(trimmed);
    } catch {
        const fallback = sanitizeSegment(trimmed).slice(0, 80) || 'invalid-url';
        return `${fallback}-${createHashSuffix(trimmed)}`;
    }

    const hostSegment = sanitizeSegment(parsed.hostname) || 'root';
    const pathSegments = parsed.pathname
        .split('/')
        .filter(Boolean)
        .map(sanitizeSegment)
        .filter(Boolean);

    let base = [hostSegment, ...pathSegments].join('-');
    if (!base) {
        base = hostSegment;
    }

    if (parsed.search) {
        base += `-${createHashSuffix(parsed.search, 6)}`;
    }

    if (base.length > 120) {
        base = base.slice(0, 110) + '-' + createHashSuffix(base, 8);
    }

    return base || `url-${Date.now()}`;
};

export default generateBaseFilename;
