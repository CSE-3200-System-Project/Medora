/* Offline reviewer-tool regression; synthetic cases only, never clinician evidence. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const puppeteer=require(require.resolve('puppeteer-core',{paths:[path.resolve('frontend')]}));
(async()=>{
  const temp=fs.mkdtempSync(path.resolve('dist/medicine-review-browser-test-'));
  const fixture={corpus_sha256:'0'.repeat(64),profile:'synthetic-tool-test-only',version:'test',cases:[
    {record_id:'1'.repeat(64),brand_name:'Synthetic test brand',generic_name:'Synthetic generic',strength:'5 mg',dosage_form:'Tablet',manufacturer:'Test maker',medicine_type:'',source_refs:'TEST:1',selection:'test',flags:'',source_evidence:'[]'},
    {record_id:'2'.repeat(64),brand_name:'Second synthetic case',generic_name:'Test generic',strength:'',dosage_form:'Tablet',manufacturer:'Test maker',medicine_type:'',source_refs:'TEST:2',selection:'test',flags:'missing_strength',source_evidence:'[]'}]};
  const fixturePath=path.join(temp,'synthetic-fixture.json');fs.writeFileSync(fixturePath,JSON.stringify(fixture));
  const browser=await puppeteer.launch({headless:true,executablePath:process.env.REVIEW_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  try{
    const page=await browser.newPage(),errors=[],remote=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url());});
    await page.goto(pathToFileURL(path.resolve('tools/softwarex/medicine_review_app.html')).href);
    await (await page.$('#file')).uploadFile(fixturePath);await page.waitForFunction(()=>!document.querySelector('#review').hidden);
    await page.click('#next');assert((await page.$eval('#message',e=>e.textContent)).includes('Choose a verdict'));
    await page.click('[data-value="acceptable"]');await page.click('#next');
    assert((await page.$eval('#position',e=>e.textContent)).includes('Case 2 of 2'));
    await page.click('[data-value="cannot_assess"]');await page.click('#next');
    assert((await page.$eval('#message',e=>e.textContent)).includes('uncertainty'));
    await page.type('#notes','Synthetic test only: strength not supplied');await page.click('#next');
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('medora-medicine-review-v2:synthetic-tool-test-only:'+'0'.repeat(64))));
    assert.equal(Object.keys(saved.answers).length,2);assert.equal(saved.answers['2'.repeat(64)].mapping_strength_form,'cannot_assess');
    await page.reload();await (await page.$('#file')).uploadFile(fixturePath);await page.waitForFunction(()=>!document.querySelector('#review').hidden);
    assert((await page.$eval('#position',e=>e.textContent)).includes('2 saved verdicts'));
    assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
    console.log('PASS: offline load, required verdict/reason, case navigation, autosave/resume; zero remote requests. Synthetic harness results are not human evidence.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
