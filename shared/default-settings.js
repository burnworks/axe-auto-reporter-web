export const DEFAULT_SETTINGS = Object.freeze({
  sitemapUrl: '',
  tags: ['wcag2aa'],
  mode: 'pc',
  maxPages: 100,
  frequency: 'daily'
});

export const ALLOWED_MODES = ['pc', 'mobile'];

export const ALLOWED_TAGS = Object.freeze([
  'wcag2a',
  'wcag2aa',
  'wcag2aaa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
  'best-practice'
]);

export const MAX_PAGE_LIMIT = Object.freeze({
  min: 1,
  max: 1000
});

export const ALLOWED_FREQUENCIES = Object.freeze(['daily', 'weekly', 'monthly']);
