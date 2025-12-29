const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();
const PORT = 1234;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function pickProxy(customProxy) {
  if (!customProxy) return null;

  let proxyUrl = Array.isArray(customProxy)
    ? customProxy[Math.floor(Math.random() * customProxy.length)]
    : customProxy;

  if (proxyUrl.includes(',')) {
    const pool = proxyUrl.split(',');
    proxyUrl = pool[Math.floor(Math.random() * pool.length)].trim();
  }

  if (!proxyUrl.startsWith('http')) proxyUrl = 'http://' + proxyUrl;

  try {
    const parsed = new URL(proxyUrl);
    return {
      host: parsed.hostname,
      port: parsed.port,
      username: parsed.username,
      password: parsed.password,
    };
  } catch {
    return null;
  }
}

async function setupPage(page, proxyConfig) {
  if (proxyConfig?.username) {
    await page.authenticate({
      username: proxyConfig.username,
      password: proxyConfig.password,
    });
  }

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  // Reduce load: block images/fonts/media
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const type = req.resourceType();
    if (type === 'image' || type === 'font' || type === 'media') return req.abort();
    return req.continue();
  });

  // lower default timeouts
  page.setDefaultNavigationTimeout(30000);
  page.setDefaultTimeout(30000);
}

async function scrapeJobDetails(browser, job, proxyConfig, attempt = 1) {
  const page = await browser.newPage();
  try {
    await setupPage(page, proxyConfig);

    await page.goto(job.link, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const details = await page.evaluate(() => {
      const descEl = document.querySelector('#job-description, .job-description, .main-content');
      const rows = document.querySelectorAll('.card-body dl');
      const info = {};

      rows.forEach((row) => {
        const h3 = row.querySelector('h3');
        const p = row.querySelector('p');
        if (h3 && p) info[h3.innerText.trim()] = p.innerText.trim();
      });

      return {
        description: descEl ? descEl.innerText.trim() : document.body.innerText.substring(0, 1000),
        ...info,
      };
    });

    return { ...job, ...details };
  } catch (err) {
    // Simple retry with backoff
    if (attempt < 2) {
      await wait(800 + Math.random() * 800);
      return scrapeJobDetails(browser, job, proxyConfig, attempt + 1);
    }
    return { ...job, error: 'Failed to load details', errorMessage: err.message };
  } finally {
    await page.close().catch(() => {});
  }
}

// Tiny concurrency runner
async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let idx = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const current = idx++;
      if (current >= items.length) break;
      results[current] = await mapper(items[current], current);
    }
  });

  await Promise.all(workers);
  return results;
}

app.get('/search', async (req, res) => {
  const keyword = req.query.keyword || '';
  const limit = parseInt(req.query.limit) || 5;
  const deepFetch = req.query.deep_fetch === 'true';
  const customProxy = req.query.proxies || req.query.proxy;

  // Keep concurrency modest to reduce pressure
  const concurrency = Math.max(1, Math.min(parseInt(req.query.concurrency) || 2, 3));

  let browser = null;

  try {
    const proxyConfig = pickProxy(customProxy);

    const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
    if (proxyConfig?.host)
      launchArgs.push(`--proxy-server=${proxyConfig.host}:${proxyConfig.port}`);

    browser = await puppeteer.launch({ headless: 'new', args: launchArgs });

    // Listing page: single page
    const page = await browser.newPage();
    await setupPage(page, proxyConfig);

    const searchUrl = keyword
      ? `https://www.onlinejobs.ph/jobseekers/jobsearch?jobkeyword=${encodeURIComponent(keyword)}`
      : `https://www.onlinejobs.ph/jobseekers/jobsearch`;

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const initialJobs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.jobpost-cat-box')).map((card) => {
        const title = card.querySelector('h4')?.innerText.trim();
        const jobType = card.querySelector('.badge')?.innerText.trim();
        const link = card.querySelector('a')?.href;
        const rawNameText = card.querySelector('p.fs-13')?.innerText || '';
        const postedBy = rawNameText.includes('•')
          ? rawNameText.split('•')[0].trim()
          : rawNameText.trim();

        return { title, jobType, link, postedBy };
      });
    });

    await page.close();

    const jobsToScrape = initialJobs.slice(0, limit);

    if (!deepFetch) {
      return res.json({ success: true, count: jobsToScrape.length, data: jobsToScrape });
    }

    // Deep fetch in parallel with a cap
    const fullJobs = await mapLimit(jobsToScrape, concurrency, async (job) => {
      // small jitter between tasks helps smooth bursts
      await wait(1000 + Math.random() * 1000);
      if (!job.link) return job;
      return scrapeJobDetails(browser, job, proxyConfig);
    });

    res.json({ success: true, count: fullJobs.length, data: fullJobs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});

app.listen(PORT, () => console.log(`Scraper running on port ${PORT}`));
