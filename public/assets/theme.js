(() => {
  const system=matchMedia('(prefers-color-scheme: dark)');
  let preference='system';
  try{preference=localStorage.getItem('kg-theme')||'system'}catch{}
  if(!['system','light','dark'].includes(preference))preference='system';
  function apply(){document.documentElement.dataset.theme=preference==='system'?(system.matches?'dark':'light'):preference;const select=document.querySelector('#theme');if(select)select.value=preference;window.dispatchEvent(new CustomEvent('kg-theme-change'));}
  apply();
  system.addEventListener('change',()=>{if(preference==='system')apply()});
  window.addEventListener('storage',e=>{if(e.key==='kg-theme'||e.key===null){preference=['light','dark'].includes(e.newValue)?e.newValue:'system';apply()}});
  document.addEventListener('DOMContentLoaded',()=>{apply();document.querySelector('#theme')?.addEventListener('change',e=>{preference=e.target.value;try{if(preference==='system')localStorage.removeItem('kg-theme');else localStorage.setItem('kg-theme',preference)}catch{}apply()})});
})();
