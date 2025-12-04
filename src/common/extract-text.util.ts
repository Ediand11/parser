import * as cheerio from 'cheerio';

export interface SiteSelectors {
  title: string;
  content: string;
  removeSelectors?: string[];
}

// ⚠️ CRITICAL: These selectors are PLACEHOLDERS and MUST be verified via DevTools!
// Open actual article pages in browser, inspect elements, and update these selectors
export const SITE_SELECTORS: Record<string, SiteSelectors> = {
  finuslugi: {
    // TODO: Verify these selectors by opening https://finuslugi.ru/navigator/[article] in DevTools
    title: 'h1',
    content: '.article-content, .post-content, .entry-content, article',
    removeSelectors: [
      '.ads',
      '.advertisement',
      '.navigation',
      '.menu',
      '.comments',
      '.footer',
      'script',
      'style',
      'nav',
      'header',
      'aside',
    ],
  },
  tj: {
    // TODO: Verify these selectors by opening actual t-j.ru articles in DevTools
    title: 'h1',
    content: '.content__body, .l-island-a, article',
    removeSelectors: [
      '.ad',
      '.advertisement',
      '.promo',
      '.sidebar',
      '.comments',
      'script',
      'style',
      'nav',
      'header',
      'aside',
    ],
  },
};

export interface ExtractedArticle {
  title: string;
  content: string;
  isEmpty: boolean;
}

export function extractArticle(
  html: string,
  site: 'finuslugi' | 'tj',
): ExtractedArticle {
  const $ = cheerio.load(html);
  const selectors = SITE_SELECTORS[site];

  // Remove unwanted elements
  if (selectors.removeSelectors) {
    selectors.removeSelectors.forEach((selector) => $(selector).remove());
  }

  // Extract title
  const title = $(selectors.title).first().text().trim();

  // Extract content - try multiple selectors
  const contentSelectors = selectors.content.split(',').map((s) => s.trim());
  let content = '';

  for (const selector of contentSelectors) {
    const extracted = $(selector).text().trim();
    if (extracted && extracted.length > 100) {
      // Require at least 100 chars
      content = extracted;
      break;
    }
  }

  // Clean up content - remove excessive whitespace
  content = content.replace(/\s+/g, ' ').trim();

  const isEmpty = !title || !content || content.length < 100;

  return {
    title,
    content,
    isEmpty,
  };
}

export function isArticlePage(html: string): boolean {
  const $ = cheerio.load(html);

  // Check for common article indicators
  const hasArticle = $('article').length > 0;
  const hasMainContent =
    $('.article-content, .post-content, .content__body').length > 0;
  const hasH1 = $('h1').length > 0;

  return hasArticle || hasMainContent || hasH1;
}
