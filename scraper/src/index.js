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

function parseCalendarBodyDate(value) {
  if (value == null || value === '') return undefined;
  if (value instanceof Date) return value;
  const s = String(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return new Date(s);
  const y = Number(m[1]);
  const mon = Number(m[2]) - 1;
  const day = Number(m[3]);
  return new Date(Date.UTC(y, mon, day, 12, 0, 0, 0));
}

app.post('/scrape/isracard', async (req, res) => {
  const { id, card6Digits, password, startDate, endDate } = req.body;

  if (!id || !card6Digits || !password) {
    return res.status(400).json({
      error: 'MISSING_CREDENTIALS',
      message: 'id, card6Digits, and password are required',
    });
  }

  const resolvedStartDate = startDate
    ? parseCalendarBodyDate(startDate)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const resolvedEndDate = endDate ? parseCalendarBodyDate(endDate) : undefined;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: CHROMIUM_PATH,
      args: BROWSER_ARGS,
    });

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
      ...(resolvedEndDate ? { transactionMonthsEndDate: resolvedEndDate } : {}),
      combineInstallments: false,
      showBrowser: false,
      additionalTransactionInformation: true,
      browser,
      skipCloseBrowser: true,
    });

    const result = await scraper.scrape({ id, card6Digits, password });

    if (!result.success) {
      return res.status(422).json({
        error: result.errorType,
        message: result.errorMessage,
      });
    }

    return res.json({ accounts: result.accounts });
  } catch (err) {
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
