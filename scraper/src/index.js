import express from 'express';
import puppeteerCore from 'puppeteer-core';
import { addExtra } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { CompanyTypes, createScraper } from 'israeli-bank-scrapers';

const app = express();
app.use(express.json());

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
const PORT = process.env.PORT || 3001;

const puppeteer = addExtra(puppeteerCore);
puppeteer.use(StealthPlugin());

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-blink-features=AutomationControlled',
];

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/scrape/isracard', async (req, res) => {
  const { id, card6Digits, password, startDate } = req.body;

  if (!id || !card6Digits || !password) {
    return res.status(400).json({
      error: 'MISSING_CREDENTIALS',
      message: 'id, card6Digits, and password are required',
    });
  }

  const resolvedStartDate = startDate
    ? new Date(startDate)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // #region agent log
  console.log(JSON.stringify({ dbg: true, sessionId: '2aaa7c', runId: 'post-fix', hypothesisId: 'H-A', message: 'scrape started', data: { startDate: resolvedStartDate.toISOString(), stealthEnabled: true } }));
  // #endregion

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: CHROMIUM_PATH,
      args: BROWSER_ARGS,
    });

    // #region agent log
    console.log(JSON.stringify({ dbg: true, sessionId: '2aaa7c', hypothesisId: 'H-B', message: 'browser launched with stealth', data: { args: BROWSER_ARGS } }));
    // #endregion

    browser.on('targetcreated', async (target) => {
      try {
        const page = await target.page();
        if (page) {
          await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
          });
        }
      } catch (_) {}
    });

    const scraper = createScraper({
      companyId: CompanyTypes.isracard,
      startDate: resolvedStartDate,
      combineInstallments: false,
      showBrowser: false,
      additionalTransactionInformation: true,
      browser,
      skipCloseBrowser: true,
    });

    const result = await scraper.scrape({ id, card6Digits, password });

    // #region agent log
    console.log(JSON.stringify({ dbg: true, sessionId: '2aaa7c', runId: 'post-fix', hypothesisId: 'H-A', message: 'scrape result', data: { success: result.success, errorType: result.errorType || null, errorMessage: result.errorMessage || null } }));
    // #endregion

    if (!result.success) {
      return res.status(422).json({
        error: result.errorType,
        message: result.errorMessage,
      });
    }

    return res.json({ accounts: result.accounts });
  } catch (err) {
    // #region agent log
    console.log(JSON.stringify({ dbg: true, sessionId: '2aaa7c', hypothesisId: 'H-A', message: 'scrape exception', data: { message: err.message } }));
    // #endregion
    console.error('Scrape failed:', err.message);
    return res.status(500).json({
      error: 'SCRAPE_FAILED',
      message: err.message,
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
});

app.listen(PORT, () => {
  console.log(`Scraper service listening on port ${PORT}`);
});
