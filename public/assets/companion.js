export function companion() {
  const actors=[...document.querySelectorAll('.character')], hero=document.querySelector('.hero');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
  let enabled=true,animations=[],openingTimeline,loadGsap,alive=true,bounds;
  const observer=new IntersectionObserver(entries=>entries.forEach(e=>e.target.classList.toggle('sleeping',!e.isIntersecting)),{threshold:.05});
  actors.forEach(el=>observer.observe(el));
  function state(name){actors.forEach(el=>el.dataset.state=name);animations.forEach(a=>a.cancel());animations=[];
    if(!enabled||reduced.matches||document.hidden)return;
    actors.filter(el=>!el.classList.contains('sleeping')).forEach(el=>{animations.push(el.animate([{transform:'rotate(0deg) scale(1)'},{transform:`rotate(${name==='success'?-4:3}deg) scale(.97,1.03)`,offset:.2},{transform:'rotate(0deg) scale(1)'}],{duration:550,easing:'cubic-bezier(.2,.8,.3,1)'}))});
  }
  function resetPointer(){if(!hero)return;for(const [prop,value] of [['--head','0deg'],['--eye-x','0px'],['--eye-y','0px'],['--body','0deg']])hero.style.setProperty(prop,value)}
  function stopOpening(){openingTimeline?.kill();const overlay=document.querySelector('.opening');if(overlay){const hadFocus=overlay.contains(document.activeElement);overlay.classList.remove('on');overlay.setAttribute('aria-hidden','true');document.querySelector('.play-opening')?.setAttribute('aria-expanded','false');if(hadFocus)document.querySelector('.play-opening')?.focus();}}
  function update(){document.body.classList.toggle('motion-off',!enabled||reduced.matches);if(!enabled||reduced.matches){animations.forEach(a=>a.cancel());stopOpening();resetPointer()}}
  function measure(){bounds=hero?.getBoundingClientRect()}
  function pointer(e){if(!hero||!enabled||reduced.matches||!fine.matches||e.pointerType==='touch')return;const x=Math.max(-1,Math.min(1,(e.clientX-bounds.left)/bounds.width*2-1)),y=Math.max(-1,Math.min(1,(e.clientY-bounds.top)/bounds.height*2-1));hero.style.setProperty('--head',`${x*4}deg`);hero.style.setProperty('--body',`${x*1.5}deg`);hero.style.setProperty('--eye-x',`${x*5}px`);hero.style.setProperty('--eye-y',`${y*3}px`)}
  function visibility(){document.body.classList.toggle('sleeping',document.hidden);if(document.hidden){animations.forEach(a=>a.pause());openingTimeline?.pause()}else{animations.forEach(a=>a.play());openingTimeline?.resume()}}
  document.querySelector('.motion')?.addEventListener('click',e=>{enabled=!enabled;e.currentTarget.setAttribute('aria-pressed',String(enabled));e.currentTarget.textContent=enabled?'Reactions on':'Reactions off';update()});
  document.querySelector('.greet')?.addEventListener('click',()=>state('success'));
  window.addEventListener('kg-theme-change',()=>state('theme change'));
  reduced.addEventListener('change',update);document.addEventListener('visibilitychange',visibility);
  if(hero){measure();hero.addEventListener('pointerenter',measure);hero.addEventListener('pointermove',pointer);hero.addEventListener('pointerleave',resetPointer);window.addEventListener('resize',measure);}
  const play=document.querySelector('.play-opening');
  if(play){play.setAttribute('aria-expanded','false');document.querySelector('.skip-opening').addEventListener('click',stopOpening);window.addEventListener('keydown',e=>{if(e.key==='Escape')stopOpening()});
    play.addEventListener('click',async()=>{stopOpening();if(reduced.matches||!enabled){state('success');return}play.disabled=true;
      try{if(!window.gsap){loadGsap??=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/assets/gsap.min.js';script.onload=resolve;script.onerror=reject;document.head.append(script)});await loadGsap}
        if(!alive||!enabled||reduced.matches)return;
        const poster=document.querySelector('.opening-poster');if(!poster.src)poster.src=poster.dataset.src;
        const overlay=document.querySelector('.opening');overlay.classList.add('on');overlay.setAttribute('aria-hidden','false');play.setAttribute('aria-expanded','true');document.querySelector('.skip-opening').focus();
        openingTimeline=window.gsap.timeline({onComplete:stopOpening}).fromTo(overlay,{scaleY:.01,rotation:-2},{scaleY:1,rotation:0,duration:.45,ease:'power3.inOut'})
          .fromTo('.opening-title',{scaleX:.7,scaleY:1.3,rotation:-8},{scaleX:1,scaleY:1,rotation:4,duration:.6,ease:'back.out(1.8)'},.65)
          .to('.opening-title',{scaleX:1.07,scaleY:.93,duration:.15},1.65).to(overlay,{scaleY:0,rotation:-3,duration:.65,ease:'power3.inOut'},1.95);
      }catch{state('success');document.querySelector('.sample-status').textContent='The opening could not load. You can still explore the APIs.'}finally{play.disabled=false}
    });
  }
  update();visibility();
  window.addEventListener('pagehide',()=>{alive=false;stopOpening();animations.forEach(a=>a.cancel());observer.disconnect();resetPointer()});
  window.addEventListener('pageshow',e=>{if(e.persisted)location.reload()});
  return {state};
}
