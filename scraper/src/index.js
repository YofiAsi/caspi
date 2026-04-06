import express from 'express';
import puppeteerCore from 'puppeteer-core';
import { addExtra } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import {
  CompanyTypes,
  createScraper,
  ScraperProgressTypes,
} from 'israeli-bank-scrapers';

const app = express();
app.use(express.json({ limit: '50mb' }));

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

const DEFAULT_RATE_LIMIT_OPTIONS = {
  initialDelay: 3000,
  maxDelay: 120_000,
  recycleBrowserOnBlock: true,
  maxBrowserRecycles: 2,
};

function mergeRateLimitOptions(bodyOptions) {
  let fromEnv = {};
  const raw = process.env.ISRACARD_RATE_LIMIT_JSON;
  if (raw) {
    try {
      fromEnv = JSON.parse(raw);
    } catch (_) {
      fromEnv = {};
    }
  }
  return {
    ...DEFAULT_RATE_LIMIT_OPTIONS,
    ...fromEnv,
    ...(bodyOptions && typeof bodyOptions === 'object' ? bodyOptions : {}),
  };
}

function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

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

function attachStealthOnNewTarget(browser) {
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
}

async function launchBrowser() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROMIUM_PATH,
    args: BROWSER_ARGS,
  });
  attachStealthOnNewTarget(browser);
  return browser;
}

app.post('/scrape/isracard/stream', async (req, res) => {
  const { id, card6Digits, password, startDate, endDate, rateLimitOptions: bodyRl } =
    req.body;

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

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  let browser;
  let lastIdx = 0;
  let lastMonthStr = '';

  try {
    browser = await launchBrowser();

    const scraper = createScraper({
      companyId: CompanyTypes.isracard,
      startDate: resolvedStartDate,
      ...(resolvedEndDate ? { transactionMonthsEndDate: resolvedEndDate } : {}),
      combineInstallments: false,
      showBrowser: false,
      additionalTransactionInformation: true,
      browser,
      skipCloseBrowser: true,
      rateLimitOptions: mergeRateLimitOptions(bodyRl),
    });

    scraper.onProgress((_companyId, payload) => {
      const t = payload.type;
      if (t === ScraperProgressTypes.ScrapingMonth) {
        const total = payload.totalMonths ?? 0;
        const idx = payload.monthIndex;
        const month = payload.month || '';
        if (lastIdx > 0 && idx > lastIdx && lastMonthStr) {
          writeSse(res, { type: 'month_done', month: lastMonthStr });
        }
        lastIdx = idx;
        lastMonthStr = month;
        writeSse(res, {
          type: 'progress',
          current: idx,
          total,
          month,
        });
      } else if (t === ScraperProgressTypes.RateLimitRetry) {
        writeSse(res, {
          type: 'rate_limit',
          wait_ms: payload.delay,
          attempt: payload.attempt,
          month: payload.month || lastMonthStr || '',
        });
      } else if (t === ScraperProgressTypes.SessionRecycle) {
        writeSse(res, {
          type: 'session_recycle',
          recycles_remaining: payload.recyclesRemaining,
        });
      }
    });

    const result = await scraper.scrape({ id, card6Digits, password });

    if (lastMonthStr && result.success) {
      writeSse(res, { type: 'month_done', month: lastMonthStr });
    }

    writeSse(res, {
      type: 'complete',
      success: result.success,
      accounts: result.accounts,
      errorType: result.errorType,
      errorMessage: result.errorMessage,
    });
  } catch (err) {
    console.error('Stream scrape failed:', err.message);
    writeSse(res, {
      type: 'complete',
      success: false,
      errorType: 'SCRAPE_FAILED',
      errorMessage: err.message,
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    res.end();
  }
});

app.post('/scrape/isracard', async (req, res) => {
  const { id, card6Digits, password, startDate, endDate, rateLimitOptions: bodyRl } =
    req.body;

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
    browser = await launchBrowser();

    const scraper = createScraper({
      companyId: CompanyTypes.isracard,
      startDate: resolvedStartDate,
      ...(resolvedEndDate ? { transactionMonthsEndDate: resolvedEndDate } : {}),
      combineInstallments: false,
      showBrowser: false,
      additionalTransactionInformation: true,
      browser,
      skipCloseBrowser: true,
      rateLimitOptions: mergeRateLimitOptions(bodyRl),
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
