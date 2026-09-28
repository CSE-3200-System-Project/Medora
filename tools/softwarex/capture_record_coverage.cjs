/* Authentic, read-only local UI captures. Frames navigation and the requested feature. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const puppeteer = require(require.resolve('puppeteer-core', {paths:[path.resolve('frontend')]}));
(async()=>{
  if(!process.env.QA_EMAIL||!process.env.QA_PASSWORD)throw Error('Provide QA_EMAIL and QA_PASSWORD privately.');
  const browser=await puppeteer.launch({executablePath:process.env.REVIEW_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const captures=[];
  try{
    const page=await browser.newPage();await page.setViewport({width:1440,height:1200,deviceScaleFactor:1});
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
    await page.goto('http://localhost:3000/login',{waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForSelector('input[type="email"]');
    await page.waitForFunction(()=>{const form=document.querySelector('input[type="email"]')?.form;return form&&Object.keys(form).some(k=>k.startsWith('__reactProps$')&&typeof form[k]?.onSubmit==='function');});
    await page.type('input[type="email"]',process.env.QA_EMAIL);await page.type('input[type="password"]',process.env.QA_PASSWORD);await page.click('button[type="submit"]');
    await page.waitForFunction(()=>location.pathname.startsWith('/patient'),{timeout:90000});
    for(const locale of ['en','bn']){
      await page.evaluate(locale=>document.cookie=`medora_ui_locale=${locale};path=/;SameSite=Lax`,locale);
      await page.goto('http://localhost:3000/patient/home',{waitUntil:'domcontentloaded',timeout:120000});
      await page.waitForFunction(()=>document.querySelector('main section.grid details'),{timeout:90000});
      await page.$eval('main section.grid details',el=>el.open=true);
      await page.evaluate(()=>document.fonts.ready);
      // Wait for real hydration and CSS entrance animation, without altering pixels/styles.
      await page.waitForFunction(()=>{
        const card=document.querySelector('main section.grid .animate-fade-in-up');
        return card&&Number(getComputedStyle(card).opacity)>=0.999;
      },{timeout:30000});
      await new Promise(r=>setTimeout(r,1200));
      const state=await page.$eval('main section.grid',section=>{
        const a=section.children[0].getBoundingClientRect(),b=section.children[1].getBoundingClientRect();
        const left=Math.min(a.left,b.left),top=Math.min(a.top,b.top),right=Math.max(a.right,b.right),bottom=Math.max(a.bottom,b.bottom);
        return {clip:{x:left+scrollX,y:top+scrollY,width:right-left,height:bottom-top},text:section.children[0].innerText+'\n'+section.children[1].innerText};
      });
      assert(!state.text.includes(process.env.QA_EMAIL));
      assert(!/Overall Health Score|AI Health Insights|Medication Trend/i.test(state.text));
      assert(/(?:0|25|50|75|100)%/.test(state.text));
      const dest=path.resolve('docs/softwarex/imagesui/patient',locale==='en'?'dashboard.png':'dashboard_bangla.png');
      fs.mkdirSync(path.dirname(dest),{recursive:true});
      const bytes=await page.screenshot({path:dest,clip:state.clip});
      captures.push({locale,path:path.relative(process.cwd(),dest).replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(bytes).digest('hex'),captured_at:new Date().toISOString(),disclosure:'open',browser_preference:'prefers-reduced-motion: reduce',capture:'Unmodified screenshot pixels, clip limited to coverage/status cards; no page header, greeting, profile or other health records'});
      // Journal panel: the existing compact card state, not a redesign or edited image.
      await page.$eval('main section.grid details',el=>el.open=false);
      // Paper: retain actual frontend context, not a gauge-only crop. The account
      // belongs to the consenting author; other record values remain outside frame.
      const framed = await page.$eval('main section.grid', section => ({
        x: 0, y: 0, width: document.documentElement.clientWidth,
        height: Math.ceil(Math.max(section.children[0].getBoundingClientRect().bottom,
          section.children[1].getBoundingClientRect().bottom) + scrollY + 16),
      }));
      const framedDest = path.resolve('docs/softwarex/imagesui/patient', locale === 'en' ? 'dashboard_frontend.png' : 'dashboard_frontend_bangla.png');
      const framedBytes = await page.screenshot({path: framedDest, clip: framed});
      captures.push({locale, path: path.relative(process.cwd(), framedDest).replaceAll('\\', '/'),
        sha256: crypto.createHash('sha256').update(framedBytes).digest('hex'), captured_at: new Date().toISOString(),
        disclosure: 'closed', capture: 'Actual frontend navigation, heading, coverage and measurement-group panels; consenting author account; other health records outside frame'});
      const compact=await page.$eval('main section.grid',section=>{const r=section.children[0].getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height};});
      const compactDest=path.resolve('docs/softwarex/imagesui/patient',locale==='en'?'dashboard_coverage_card.png':'dashboard_coverage_card_bangla.png');
      const compactBytes=await page.screenshot({path:compactDest,clip:compact});
      captures.push({locale,path:path.relative(process.cwd(),compactDest).replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(compactBytes).digest('hex'),captured_at:new Date().toISOString(),disclosure:'closed',capture:'Authentic compact coverage-card state for legible journal panel; no text or values altered'});
    }
    fs.writeFileSync('docs/softwarex/generated/dashboard_capture_receipt.json',JSON.stringify({origin:'http://localhost:3000/patient/home',synthetic_record:false,record:'Consenting author demonstration account; paper frames include frontend context and author account header; other health records outside frame',captures},null,2)+'\n');
    console.log('PASS: authentic bilingual frontend-context frames and archived calculation views; other health records excluded.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
