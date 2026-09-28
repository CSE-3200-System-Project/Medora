/* Read-only authenticated UI checks. Never writes screenshots or session tokens. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const puppeteer = require(require.resolve('puppeteer-core', { paths: [path.resolve('frontend')] }));

(async () => {
  const email = process.env.QA_EMAIL, password = process.env.QA_PASSWORD;
  if (!email || !password) throw Error('Provide QA_EMAIL and QA_PASSWORD privately.');
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      const response = await fetch('http://localhost:3000/login', { signal: AbortSignal.timeout(20000) });
      if (response.ok) { ready = true; break; }
    } catch { /* Container may still be installing dependencies. */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) throw Error('Local frontend did not become ready.');
  const browser = await puppeteer.launch({ executablePath: process.env.REVIEW_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('input[type="email"]', { timeout: 60000 });
    // Wait for React's submit handler, not just server-rendered form markup.
    await page.waitForFunction(() => {
      const form = document.querySelector('input[type="email"]')?.form;
      return form && Object.keys(form).some(key => key.startsWith('__reactProps$') && typeof form[key]?.onSubmit === 'function');
    }, { timeout: 60000 });
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => location.pathname.startsWith('/patient'), { timeout: 90000 });
    await page.waitForFunction(() => document.body.innerText.includes("Today's record coverage"), { timeout: 90000 });
    let body = await page.$eval('body', el => el.innerText);
    assert(body.includes("Today's measurement groups"));
    assert(!body.includes('Overall Health Score') && !body.includes('AI Health Insights'));
    assert(/(?:0|25|50|75|100)%/.test(body) && !body.includes('Record coverage unavailable'));
    await page.evaluate(() => document.cookie = 'medora_ui_locale=bn;path=/;SameSite=Lax');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('আজকের রেকর্ডের উপস্থিতি'), { timeout: 60000 });
    body = await page.$eval('body', el => el.innerText);
    assert(body.includes('আজকের পরিমাপের গোষ্ঠী'));
    assert(/(?:0|25|50|75|100)%/.test(body) && !body.includes('রেকর্ডের উপস্থিতির তথ্য পাওয়া যাচ্ছে না'));
    console.log('PASS: local browser login; English/Bengali record coverage and group status; authenticated API data; old clinical score/insights/adherence chart absent. No screenshots or tokens saved.');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
