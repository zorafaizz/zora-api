export async function loadCatalog(){const response=await fetch('/assets/catalog.json',{credentials:'omit'});if(!response.ok)throw Error('Catalog unavailable');return response.json();}
export function renderCatalog(items,container,{search='',category='',limit=items.length}={}){
  const term=search.trim().toLowerCase();const filtered=items.filter(e=>(!category||e.category===category)&&`${e.title} ${e.path} ${e.executionPath} ${e.method} ${e.description} ${e.category}`.toLowerCase().includes(term));
  container.replaceChildren();
  for(const ep of filtered.slice(0,limit)){const link=document.createElement('a');link.className='endpoint';link.href='/explorer.html?endpoint='+encodeURIComponent(ep.id);const method=document.createElement('span');method.className='method';method.textContent=ep.method;const text=document.createElement('span'),title=document.createElement('strong'),path=document.createElement('code');title.textContent=ep.title;path.textContent=ep.executionPath;text.append(title,path);link.append(method,text);container.append(link)}
  return filtered.length;
}
