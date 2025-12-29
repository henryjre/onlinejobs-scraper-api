// server.js
const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();
const PORT = 1234;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.get('/search', async (req, res) => {
  const keyword = req.query.keyword || '';
  const limit = parseInt(req.query.limit) || 5;
  const deepFetch = req.query.deep_fetch === 'true';
  const customProxy = req.query.proxies || req.query.proxy;

  let browser = null;

  try {
    let proxyConfig = {};
    if (customProxy) {
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
        proxyConfig = {
          host: parsed.hostname,
          port: parsed.port,
          username: parsed.username,
          password: parsed.password,
        };
        console.log(`Using Proxy: ${proxyConfig.host}`);
      } catch (e) {
        console.error('Invalid proxy:', e.message);
      }
    }

    const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
    if (proxyConfig.host) launchArgs.push(`--proxy-server=${proxyConfig.host}:${proxyConfig.port}`);

    browser = await puppeteer.launch({ headless: 'new', args: launchArgs });
    const page = await browser.newPage();

    if (proxyConfig.username)
      await page.authenticate({ username: proxyConfig.username, password: proxyConfig.password });

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    );

    const searchUrl = keyword
      ? `https://www.onlinejobs.ph/jobseekers/jobsearch?jobkeyword=${encodeURIComponent(keyword)}`
      : `https://www.onlinejobs.ph/jobseekers/jobsearch`;

    console.log(`Searching for: ${keyword} (Deep Fetch: ${deepFetch})...`);
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    const initialJobs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.jobpost-cat-box')).map((card) => {
        const title = card.querySelector('h4')?.innerText.trim();
        const jobType = card.querySelector('.badge')?.innerText.trim();
        const link = card.querySelector('a')?.href;
        const rawNameText = card.querySelector('p.fs-13')?.innerText || '';
        const postedBy = rawNameText.includes('•')
          ? rawNameText.split('•')[0].trim()
          : rawNameText.trim();

        return {
          title: title,
          jobType: jobType,
          link: link,
          postedBy: postedBy,
        };
      });
    });

    const jobsToScrape = initialJobs.slice(0, limit);

    if (!deepFetch) {
      console.log(`Deep fetch disabled. Returning ${jobsToScrape.length} basic results.`);
      res.json({ success: true, count: jobsToScrape.length, data: jobsToScrape });
      return;
    }

    console.log(`Found ${initialJobs.length} jobs. Deep scraping top ${jobsToScrape.length}...`);
    const fullJobs = [];

    for (const job of jobsToScrape) {
      if (!job.link) continue;

      try {
        console.log(`Visiting: ${job.title}...`);
        await page.goto(job.link, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const details = await page.evaluate(() => {
          const descEl = document.querySelector(
            '#job-description, .job-description, .main-content'
          );
          const rows = document.querySelectorAll('.card-body dl');
          const info = {};

          rows.forEach((row) => {
            const h3Element = row.querySelector('h3');
            const pElement = row.querySelector('p');
            if (h3Element && pElement) {
              const label = h3Element.innerText.trim();
              const value = pElement.innerText.trim();
              info[label] = value;
            }
          });

          return {
            description: descEl
              ? descEl.innerText.trim()
              : document.body.innerText.substring(0, 1000),
            ...info,
          };
        });

        fullJobs.push({ ...job, ...details });
        await wait(2000 + Math.random() * 2000);
      } catch (err) {
        console.error(`Failed to scrape ${job.link}:`, err.message);
        fullJobs.push({ ...job, error: 'Failed to load details' });
      }
    }

    res.json({ success: true, count: fullJobs.length, data: fullJobs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`Scraper running on port ${PORT}`);
});
