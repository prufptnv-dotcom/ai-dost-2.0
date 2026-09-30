const logger = require('../logger');

/**
 * browserScrapingService.js
 * 
 * Deep Web Scraper using Playwright.
 * Used when standard fetch fails due to JS rendering requirements
 * (e.g., React/Next.js SPA sites, Cloudflare challenges, etc.).
 * Gracefully degrades if Playwright is not installed.
 */
class BrowserScrapingService {
    constructor() {
        this.playwright = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return true;

        try {
            // Lazy load to prevent crashing if playwright isn't installed
            this.playwright = require('playwright');
            this.isInitialized = true;
            logger.info(`[BrowserScraper] Playwright initialized successfully.`);
            return true;
        } catch (e) {
            logger.warn(`[BrowserScraper] Playwright not found. Deep scraping is disabled. To enable: npm install playwright`);
            return false;
        }
    }

    /**
     * Scrapes a URL by launching a headless browser and waiting for network idle.
     * @param {string} url 
     * @returns {string} Extracted text content
     */
    async scrapeDeep(url) {
        const canRun = await this.init();
        
        if (!canRun) {
            throw new Error("Playwright is not available for deep scraping.");
        }

        let browser = null;
        try {
            logger.info(`[BrowserScraper] Launching headless browser to fetch: ${url}`);
            
            // Launch chromium in headless mode
            browser = await this.playwright.chromium.launch({ headless: true });
            const page = await browser.newPage();
            
            // Wait until network is idle to ensure React/Vue apps have loaded
            await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
            
            // Extract visible text from the body
            const textContent = await page.evaluate(() => {
                // Remove scripts, styles, and SVGs to clean up text
                document.querySelectorAll('script, style, svg').forEach(el => el.remove());
                return document.body.innerText;
            });

            logger.info(`[BrowserScraper] Successfully extracted ${textContent.length} characters from ${url}`);
            return textContent;

        } catch (error) {
            logger.error(`[BrowserScraper] Failed to scrape ${url}: ${error.message}`);
            throw error;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
}

module.exports = new BrowserScrapingService();
