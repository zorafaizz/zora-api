const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/home/zorafaiz/.npm/_npx/9833c18b2d85bc59/node_modules/playwright');
const fs=require('fs'),out='docs/ui-redesign/evidence/landing-polish';
(async()=>{const b=await chromium.launch({executablePath:'/opt/google/chrome/chrome'});
for(const width of [1440,390]){
 const c=await b.newContext({viewport:{width,height:width===390?844:900},colorScheme:'dark',reducedMotion:'no-preference',recordVideo:{dir:out,size:{width,height:width===390?844:900}}});
 await c.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());const p=await c.newPage();await p.goto('http://127.0.0.1:43881/');await p.waitForTimeout(4000);
 const primary=p.locator('.hero-summary .landing-action-primary'),secondary=p.locator('.hero-summary .landing-action-secondary');
 await primary.hover();await p.waitForTimeout(1400);await p.mouse.move(width-10,150);await p.waitForTimeout(700);await primary.hover();await p.waitForTimeout(1200);
 await primary.focus();await p.waitForTimeout(1300);await secondary.hover();await p.waitForTimeout(1500);await secondary.focus();await p.waitForTimeout(1000);
 // Show the press state without leaving the landing or dispatching any request.
 const box=await primary.boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.waitForTimeout(450);await p.mouse.move(width-5,150);await p.mouse.up();await p.waitForTimeout(1000);
 for(const selector of ['#playground','.landing-response-empty','.system-section','.system-features','.docs-stage','.landing-closing']){
  await p.locator(selector).evaluate(e=>e.scrollIntoView({behavior:'smooth',block:'center'}));await p.waitForTimeout(width===390?3300:3000);
 }
 await p.locator('.landing-closing .landing-action').hover();await p.waitForTimeout(1600);await p.mouse.move(width-10,50);await p.waitForTimeout(800);
 await p.evaluate(()=>window.scrollTo({top:0,behavior:'smooth'}));await p.waitForTimeout(2800);
 const video=p.video();await c.close();await video.saveAs(`${out}/landing-motion-${width}.webm`);
}
await b.close();console.log('Landing recordings complete');})().catch(e=>{console.error(e);process.exit(1)});
