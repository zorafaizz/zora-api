/* Local concept only: no provider requests and no credential collection. */
const $ = s => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const system = matchMedia('(prefers-color-scheme: dark)');
const fine = matchMedia('(hover: hover) and (pointer: fine)');
const hero = $('.hero');
const character = $('.character');
const head = $('.nami-head, .momo-head');
let themeChoice, reactions = true, timeline, reaction, timer, requestVersion = 0;
let catalog = [], active, response = null, bounds;
try { themeChoice = localStorage.getItem('kg-anime-theme'); } catch {}
const miniature = document.createElement('div');
miniature.className = 'mini-character';
miniature.append(character.cloneNode(true));
$('.character-state').parentElement.before(miniature);
function state(name) {
  document.querySelectorAll('.character').forEach(el => el.dataset.state = name);
  $('.character-state').textContent = name;
  if (reaction) reaction.kill();
  if (!reactions || reduced.matches || typeof gsap === 'undefined') return;
  const targets = document.querySelectorAll('.character-wrap, .mini-character');
  reaction = gsap.timeline().to(targets,{rotation:name==='success'?-4:name==='rate limit'?-2:name==='authentication failure'?4:name==='server error'?2:name==='invalid parameters'?3:0,duration:.13,scale:name==='loading'?.98:1.02,ease:'power2.in'})
    .to(targets,{rotation:0,scale:1,duration:.5,ease:'back.out(1.5)'});
}
function applyTheme(react = false) {
  const theme = ['light','dark'].includes(themeChoice) ? themeChoice : system.matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  $('.theme').textContent = theme === 'dark' ? 'Day world' : 'Night world';
  $('.theme').setAttribute('aria-label',`Switch to ${theme === 'dark' ? 'day' : 'night'} world`);
  if(react) state('theme change');
}
applyTheme();
$('.theme').addEventListener('click',()=>{themeChoice=document.documentElement.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('kg-anime-theme',themeChoice)}catch{}applyTheme(true)});
system.addEventListener('change',()=>applyTheme());
window.addEventListener('storage',e=>{if(e.key==='kg-anime-theme'){themeChoice=e.newValue;applyTheme()}});
function motionSetting(){document.body.classList.toggle('motion-off',!reactions||reduced.matches);if(reduced.matches){stopOpening();hero.style.setProperty('--head','0deg');hero.style.setProperty('--eye-x','0px');hero.style.setProperty('--eye-y','0px')}}
$('.motion').addEventListener('click',()=>{reactions=!reactions;$('.motion').textContent=reactions?'Reactions on':'Reactions off';$('.motion').setAttribute('aria-pressed',String(reactions));if(!reactions){reaction?.kill();stopOpening();if(typeof gsap!=='undefined')gsap.set('.character-wrap, .mini-character',{clearProps:'transform'});hero.style.setProperty('--head','0deg');hero.style.setProperty('--eye-x','0px');hero.style.setProperty('--eye-y','0px')}motionSetting()});
reduced.addEventListener('change',motionSetting);
function measure(){bounds=hero.getBoundingClientRect()}
measure();window.addEventListener('resize',measure);hero.addEventListener('pointerenter',measure);
hero.addEventListener('pointermove',e=>{if(!reactions||reduced.matches||!fine.matches||e.pointerType==='touch')return;const x=Math.max(-1,Math.min(1,(e.clientX-bounds.left)/bounds.width*2-1));const y=Math.max(-1,Math.min(1,(e.clientY-bounds.top)/bounds.height*2-1));hero.style.setProperty('--head',`${x*4}deg`);hero.style.setProperty('--eye-x',`${x*5}px`);hero.style.setProperty('--eye-y',`${y*3}px`)});
hero.addEventListener('pointerleave',()=>{hero.style.setProperty('--head','0deg');hero.style.setProperty('--eye-x','0px');hero.style.setProperty('--eye-y','0px')});
$('.greet').addEventListener('click',()=>state('success'));
function stopOpening(){timeline?.kill();$('.opening').classList.remove('on');$('.opening').setAttribute('aria-hidden','true');$('.play-opening').setAttribute('aria-expanded','false');if($('.opening').contains(document.activeElement))$('.play-opening').focus()}
$('.play-opening').setAttribute('aria-expanded','false');
$('.play-opening').addEventListener('click',()=>{
  stopOpening();
  if(reduced.matches||!reactions||typeof gsap==='undefined'){state('success');$('.status').textContent='Static greeting. Motion is disabled.';return}
  $('.opening').classList.add('on');$('.opening').setAttribute('aria-hidden','false');$('.play-opening').setAttribute('aria-expanded','true');$('.skip-opening').focus();
  const pocket=document.body.classList.contains('pocket');
  timeline=gsap.timeline({onComplete:stopOpening})
    .fromTo('.opening',{scaleY:.01,rotation:-2,transformOrigin:'50% 50%'},{scaleY:1,rotation:0,duration:.45,ease:'power3.inOut'})
    .fromTo('.opening-title',{scaleX:.7,scaleY:1.3,rotation:-8},{scaleX:1,scaleY:1,rotation:pocket?4:-3,duration:.6,ease:'back.out(1.8)'},.65)
    .to('.opening-title',{scaleX:1.07,scaleY:.93,duration:.15},1.65)
    .to('.opening',{scaleY:0,rotation:-3,duration:.65,ease:'power3.inOut'},1.95);
});
$('.skip-opening').addEventListener('click',stopOpening);window.addEventListener('keydown',e=>{if(e.key==='Escape')stopOpening()});
const visibility=new IntersectionObserver(entries=>entries.forEach(e=>e.target.classList.toggle('sleeping',!e.isIntersecting)),{threshold:.05});visibility.observe(hero);visibility.observe(miniature);
document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('sleeping',document.hidden);if(document.hidden){timeline?.pause();reaction?.pause()}else{timeline?.resume();reaction?.resume()}});
let entered=false;
const sceneObserver=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)&&!entered){entered=true;state('ready to prepare')}},{threshold:.2});sceneObserver.observe($('#playground'));
function showCatalog(){const q=$('#search').value.trim().toLowerCase(),category=$('#category').value;const filtered=catalog.filter(e=>(!category||e.category===category)&&`${e.title} ${e.path} ${e.method} ${e.category}`.toLowerCase().includes(q));$('.catalog').replaceChildren();for(const endpoint of filtered.slice(0,8)){const link=document.createElement('a');link.className='endpoint';link.href='#playground';const method=document.createElement('span');method.className='method';method.textContent=endpoint.method;const text=document.createElement('span');const title=document.createElement('strong');title.textContent=endpoint.title;const path=document.createElement('code');path.textContent=endpoint.path;text.append(title,path);link.append(method,text);link.addEventListener('click',()=>{$('#endpoint').value=endpoint.id;chooseEndpoint()});$('.catalog').append(link)}$('.catalog-status').textContent=filtered.length?`Showing ${Math.min(8,filtered.length)} of ${filtered.length} matching registry endpoints.`:'No matching endpoints. Try a different term.'}
function chooseEndpoint(){cancelRequest(false);active=catalog.find(e=>e.id===$('#endpoint').value);$('.parameters').replaceChildren();for(const parameter of active.parameters){const label=document.createElement('label');label.textContent=`${parameter.name}${parameter.required?' (required)':' (optional)'}`;const input=document.createElement('input');input.name=parameter.name;input.required=parameter.required;input.type='text';input.autocomplete='off';input.placeholder=parameter.name==='url'?'Paste your URL here':parameter.description||parameter.name;input.addEventListener('focus',()=>state('input focus'));input.addEventListener('input',()=>{input.removeAttribute('aria-invalid');state('request preparation');snippet()});label.append(input);$('.parameters').append(label)}$('.request-line').textContent=`${active.method} ${active.path}`;$('.billing').textContent=active.policy==='no_quota'?'Public endpoint. No quota under the current registry policy.':`Production: API key required · ${active.policy} · registry default ${active.credits} credit(s). This simulation never spends quota.`;$('.status').textContent='Ready. Local fixture only.';response=null;$('.response').textContent='No local simulation yet.';snippet()}
function shell(s){return "'"+s.replaceAll("'","'\\''")+"'"}
function snippet(){if(!active)return;const url=new URL('https://api.itsfaiz.my.id'+active.path);for(const input of $('.parameters').querySelectorAll('input'))if(input.value)url.searchParams.set(input.name,input.value);const auth=active.policy!=='no_quota';const address=url.href;const lang=$('#language').value;let code;
 if(lang==='cURL')code=`curl ${shell(address)}${auth?' \\\n  -H "Authorization: Bearer $API_KEY"':''}`;
 else if(lang==='Python')code=`import os\nimport requests\n\nresponse = requests.get(\n    ${JSON.stringify(address)}${auth?',\n    headers={"Authorization": "Bearer " + os.environ["API_KEY"]}':''}\n)\nresponse.raise_for_status()\nprint(response.json())`;
 else code=`${auth?'// Set API_KEY in your server environment.\nconst apiKey = process.env.API_KEY;\n':''}const response = await fetch(${JSON.stringify(address)}${auth?', {\n  headers: { Authorization: `Bearer ${apiKey}` }\n}':''});\nif (!response.ok) throw new Error(\`HTTP \${response.status}\`);\nconst data${lang==='TypeScript'?': unknown':''} = await response.json();\nconsole.log(data);`;
 $('.snippet').textContent=code;
}
function cancelRequest(announce=true){requestVersion++;clearTimeout(timer);$('.execute').disabled=false;$('.cancel').disabled=true;if(announce){$('.status').textContent='Simulation cancelled. No quota spent.';state('cancelled')}}
$('.cancel').addEventListener('click',()=>cancelRequest());
$('form').noValidate=true;
$('form').addEventListener('submit',e=>{e.preventDefault();const inputs=[...$('.parameters').querySelectorAll('input')];const missing=inputs.find(i=>i.required&&!i.value.trim());if(missing){missing.setAttribute('aria-invalid','true');missing.focus();$('.status').textContent=`Missing required parameter: ${missing.name}.`;state('invalid parameters');return}if($('.execute').disabled)return;const version=++requestVersion;$('.execute').disabled=true;$('.cancel').disabled=false;$('.status').textContent='Preparing local fixture… no network request.';state('loading');const outcome=$('#outcome').value;timer=setTimeout(()=>{if(version!==requestVersion)return;$('.execute').disabled=false;$('.cancel').disabled=true;const ok=outcome==='success';response=ok?{status:true,creator:'KanjutGede'}:{status:false,creator:'KanjutGede',error:outcome==='401'?'Local fixture: API key required.':outcome==='429'?'Local fixture: rate limit reached.':'Local fixture: server error.',message:'Simulated response. No live request was sent.',code:'REQUEST_FAILED'};$('.response').textContent=JSON.stringify(response,null,2);$('.status').textContent=ok?'Local success excerpt ready. No HTTP status or latency was measured.':`Local ${outcome} fixture ready. Correct the issue, then run again.`;state(ok?'success':outcome==='401'?'authentication failure':outcome==='429'?'rate limit':'server error');},850)});
$('.copy').addEventListener('click',async()=>{if(!response){$('.copy-status').textContent='Run a local simulation first.';return}try{await navigator.clipboard.writeText(JSON.stringify(response,null,2));$('.copy-status').textContent='Local fixture JSON copied.'}catch{$('.copy-status').textContent='Clipboard unavailable. Select the JSON to copy manually.'}});
$('#search').addEventListener('input',showCatalog);$('#category').addEventListener('change',showCatalog);$('#endpoint').addEventListener('change',chooseEndpoint);$('#language').addEventListener('change',snippet);
fetch('catalog.json').then(r=>{if(!r.ok)throw Error('catalog');return r.json()}).then(data=>{catalog=data;for(const category of [...new Set(data.map(e=>e.category))]){const option=new Option(category,category);$('#category').append(option)}for(const ep of catalog)$('#endpoint').append(new Option(ep.title,ep.id));$('#endpoint').value='sys.health';chooseEndpoint();showCatalog()}).catch(()=>{$('.catalog-status').textContent='Catalog could not load. Reload this local preview to retry.';$('.execute').disabled=true});
motionSetting();
window.addEventListener('pagehide',()=>{stopOpening();reaction?.kill();clearTimeout(timer);visibility.disconnect();sceneObserver.disconnect()});
