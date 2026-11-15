const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/home/zorafaiz/.npm/_npx/9833c18b2d85bc59/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('fs');
const base=process.env.KG_QA_URL||'http://127.0.0.1:43881',out='docs/ui-redesign/evidence/landing-polish';
(async()=>{const b=await chromium.launch({executablePath:'/opt/google/chrome/chrome'});const results=[];
for(const width of [390,1440])for(const theme of ['dark','light']){
 const c=await b.newContext({viewport:{width,height:width===390?844:900},colorScheme:theme,reducedMotion:'reduce'});let requests=0,mode='success';
 await c.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='127.0.0.1')return r.abort();if(['/api/v1/health','/api/v1/search/anime'].includes(u.pathname)){requests++;const old=mode;if(old==='slow')await new Promise(r=>setTimeout(r,900));return r.fulfill({status:old==='error'?503:200,json:old==='error'?{status:false,error:'Fixture unavailable'}:{status:true,result:{marker:old==='slow'?'STALE_FIXTURE':'LOCAL_FIXTURE'}}}).catch(()=>{});}return r.continue()});
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.evaluate(()=>document.fonts.ready);assert.equal(requests,0);assert.equal(await p.locator('video').evaluate(e=>e.paused),true);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const primary=p.locator('.hero-summary').getByRole('link',{name:'Open Workbench',exact:true});await primary.focus();assert.notEqual(await primary.evaluate(e=>getComputedStyle(e).outlineStyle),'none');
 await p.addScriptTag({path:'/tmp/kg-axe.min.js'});const violations=await p.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));assert.deepEqual(violations,[]);
 const pg=p.locator('#playground');await pg.getByText('Your request. The real result.',{exact:true}).waitFor();await pg.getByRole('button',{name:/Kusonime/}).click();assert.equal(requests,0);
 mode='slow';await pg.getByRole('button',{name:'Execute request',exact:true}).click();await pg.getByText('Waiting for the endpoint…',{exact:true}).waitFor();await pg.getByRole('button',{name:/System Health/}).click();await p.waitForTimeout(1100);assert.equal(await p.getByText('STALE_FIXTURE',{exact:false}).count(),0);
 mode='success';await pg.getByRole('button',{name:'Execute request',exact:true}).click();await pg.getByText('LOCAL_FIXTURE',{exact:false}).first().waitFor();assert.equal(await pg.locator('.landing-response-empty').count(),0);
 await pg.getByRole('button',{name:/Kusonime/}).click();mode='slow';await pg.getByRole('button',{name:'Execute request',exact:true}).click();await pg.getByRole('button',{name:'Cancel',exact:true}).click();await p.waitForTimeout(1100);assert.equal(await p.getByText('STALE_FIXTURE',{exact:false}).count(),0);
 mode='error';await pg.getByRole('button',{name:'Execute request',exact:true}).click();await pg.getByText('Fixture unavailable',{exact:false}).first().waitFor();assert.deepEqual(errors,[]);
 results.push({width,theme,violations,errors,mountCalls:0,explicitMockRequests:requests,focus:true,reducedMotion:true,stale:true,cancel:true,success:true,error:true});await c.close();
}
await b.close();fs.writeFileSync(out+'/targeted-regression.json',JSON.stringify(results,null,2));console.log('PASS: landing dark/light 390/1440; focus, axe, no auto-run, loading, stale, cancel, success, error, reduced motion');})().catch(e=>{console.error(e);process.exit(1)});
