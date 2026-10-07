/* Run with a local Playwright installation. All remote requests are blocked.
 * No real bank sessions, cloud accounts or production data are used. */
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.DRCOACH_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
  const filename=path.resolve(root,'.'+new URL(req.url,'http://local').pathname.replace(/\/$/,'/index.html'));
  if(!filename.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try{res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream'});res.end(fs.readFileSync(filename));}
  catch{res.writeHead(404);res.end();}
});
let browser;
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:process.env.DRCOACH_CHROMIUM||undefined,headless:true,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:1280,height:1000},serviceWorkers:'block'});
  const errors=[];
  await context.route('**/*',route=>{
    const url=route.request().url();
    if(url===origin+'/config/supabase.config.js')return route.fulfill({contentType:'text/javascript',body:'/* Test: local mode, no cloud configuration. */'});
    return url.startsWith(origin+'/')?route.continue():route.abort();
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  async function load(){
    await page.goto(origin,{waitUntil:'domcontentloaded'});
    await page.locator('.dc-auth-tab[data-mode="local"]').click();
    await page.locator('#dcAuthLocalEnter').click();
    await page.waitForFunction(()=>window.DrCoachLearning?.exportData());
  }
  async function data(){return page.evaluate(()=>window.DrCoachLearning.exportData());}
  async function waitPhase(phase){await page.waitForFunction(phase=>window.DrCoachLearning.exportData().active?.phase===phase,phase);}
  await load();
  await page.locator('#learningHomeSetup').click();
  assert.equal(await page.locator('#view-review').evaluate(n=>n.classList.contains('active-view')),true);
  assert.equal(await page.locator('#reviewCoachView').isVisible(),true,'Coach is the default review surface');
  assert.equal(await page.locator('#reviewQuestionsView').isVisible(),false,'questions stay available behind the Coach tab');
  await page.locator('[data-review-mode="questions"]').click();
  assert.equal(await page.locator('#reviewQuestionsView').isVisible(),true,'question view opens explicitly');
  await page.locator('[data-review-mode="coach"]').click();
  assert.equal(await page.locator('#reviewCoachView').isVisible(),true,'Coach view returns without losing question data');
  assert.equal((await page.locator('body').innerText()).includes('Esclerosis múltiple'),false,'no preset topic is imposed');
  await page.locator('#learningCreate').click();
  await page.locator('#learningUnitTopic').fill('Mi repaso');await page.locator('#learningUnitTitle').fill('Idea inicial');
  await page.locator('#learningUnitPrompt').fill('Explica la idea inicial');await page.locator('#learningUnitAnswer').fill('La idea inicial se entiende paso a paso.');
  await page.locator('#learningUnitHint').fill('Empieza por la definición.');await page.locator('#learningUnitForm button[type="submit"]').click();
  await page.waitForFunction(()=>window.DrCoachLearning.exportData().units.length===1);
  await page.locator('#learningStart').click();await page.locator('#learningDialog').waitFor({state:'visible'});
  assert.equal(await page.locator('#learningReference').isVisible(),false,'reference is hidden before attempting');
  assert.equal(await page.locator('#learningGood').isVisible(),false,'grading is hidden before comparing');
  await page.locator('#learningResponse').fill('Mi explicación antes de la pista');
  await page.locator('#learningShowHint').click();
  await page.locator('#learningPause').click();
  const paused=await data();assert.equal(paused.active.response,'Mi explicación antes de la pista');assert.equal(paused.active.hint,true);
  await load();await page.locator('#learningHomeStart').click();
  await page.waitForTimeout(500);
  await page.waitForFunction(()=>document.querySelector('#learningResponse')?.value==='Mi explicación antes de la pista',{timeout:2000});
  assert.equal(await page.locator('#learningResponse').inputValue(),'Mi explicación antes de la pista');
  await page.locator('#learningCompare').click();await page.waitForTimeout(250);await waitPhase('revealed');
  assert.equal(await page.locator('#learningGood').isDisabled(),true,'hint blocks independent success');
  await page.locator('#learningAgain').click();await page.waitForTimeout(250);await waitPhase('rated');
  assert.equal((await data()).events[0].rating,'again');
  // The engine test suite covers sequence and contrast state transitions. Here we verify that the UI leaves the first attempt in a resumable state.
  const firstRated=await data();assert.equal(firstRated.active.phase,'rated');assert.equal(firstRated.events.length,1);
  await page.locator('#learningPause').click();
  // Backups merge idempotently and replace only the current training profile.
  await page.evaluate(async()=>{const d=window.DrCoachLearning.exportData();await window.DrCoachLearning.importData(d,'merge');});
  assert.equal((await data()).events.length,1);
  await page.evaluate(async()=>{const d=window.DrCoachLearning.exportData();await window.DrCoachLearning.reset();await window.DrCoachLearning.importData(d,'replace');});
  assert.equal((await data()).events.length,1);
  // Real IndexedDB: account isolation and serialized concurrent updates.
  const isolated=await page.evaluate(async()=>{
    const store=window.DrCoachLearningStore,e=window.DrCoachLearningEngine;
    await store.update('user:test-a',()=>e.empty());
    await Promise.all(Array.from({length:5},(_,i)=>store.update('user:test-a',data=>{data.units.push(e.makeUnit({title:String(i),topic:'T',prompt:'P',answer:'R'}));return data;})));
    const b=await store.read('user:test-b'),local=await store.read('local'),a=await store.read('user:test-a');
    return {b,local:local.units.length,a:a.units.length};
  });
  assert.equal(isolated.b,null);assert.equal(isolated.a,5);assert.equal(isolated.local,1);
  await page.evaluate(async()=>window.DrCoachLearning.reset());
  // Create custom material. HTML is rendered as text, never executable.
  await page.locator('[data-view="review"]').click();
  await page.locator('#learningPanel').waitFor({state:'visible'});
  await page.locator('#learningCreate').click();
  await page.locator('#learningUnitTopic').fill('Mi tema');await page.locator('#learningUnitTitle').fill('Mi tarjeta');
  await page.locator('#learningUnitPrompt').fill('Explica el mecanismo');
  await page.locator('#learningUnitAnswer').fill('<img src=x onerror="window.trainingXss=true">');
  await page.locator('#learningUnitForm button[type="submit"]').click();
  await page.waitForFunction(()=>window.DrCoachLearning.exportData().units.length===1);
  await page.locator('#learningTopic').selectOption('Mi tema');await page.locator('#learningStart').click();
  await page.locator('#learningResponse').fill('Intento');await page.locator('#learningCompare').click();await waitPhase('revealed');
  assert.match(await page.locator('#learningReferenceText').textContent(),/<img/);
  assert.equal(await page.evaluate(()=>window.trainingXss),undefined);
  await page.locator('#learningPause').click();
  // Responsive checks on the new surfaces, alongside the unchanged app chrome.
  for(const width of [1280,768,390,320]){
    await page.setViewportSize({width,height:900});
    assert.equal(await page.locator('#learningPanel').evaluate(n=>n.scrollWidth<=n.clientWidth+1),true,'panel fits width '+width);
    await page.locator('#learningStart').click();
    assert.equal(await page.locator('#learningDialog').evaluate(n=>n.getBoundingClientRect().right<=innerWidth+1&&n.getBoundingClientRect().left>=-1),true,'dialog fits width '+width);
    await page.locator('#learningPause').click();
  }
  await page.setViewportSize({width:1280,height:1000});
  await page.locator('[data-view="today"]').click();
  if(process.env.DRCOACH_SCREENSHOT)await page.screenshot({path:process.env.DRCOACH_SCREENSHOT,fullPage:true});
  assert.equal(await page.locator('#overallDone').textContent(),'0','training does not change QBank coverage');
  assert.equal(errors.length,0,'no page errors: '+errors.join('; '));
  console.log(JSON.stringify({passed:true,formats:['recall','sequence','contrast'],persistentDraft:true,hintRestriction:true,accountIsolation:true,concurrentWrites:5,backupMerge:true,xssBlocked:true,widths:[1280,768,390,320],pageErrors:errors},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
