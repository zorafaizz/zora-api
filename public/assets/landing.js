import {companion} from './companion.js';
import {loadCatalog,renderCatalog} from './catalog.js';
const actor=companion();
const search=document.querySelector('#search'),category=document.querySelector('#category'),status=document.querySelector('.catalog-status');
loadCatalog().then(items=>{for(const name of [...new Set(items.map(e=>e.category))])category.append(new Option(name,name));const render=()=>{const count=renderCatalog(items,document.querySelector('.catalog'),{search:search.value,category:category.value,limit:8});status.textContent=count?`Showing ${Math.min(count,8)} of ${count} matching APIs. Narrow your search to find an endpoint.`:'No matching APIs. Try a different term.'};search.addEventListener('input',render);category.addEventListener('change',render);render()}).catch(()=>{status.textContent='The catalog could not load. Open the API reference or reload to retry.'});
document.querySelector('.sample').addEventListener('click',()=>{document.querySelector('.sample-response').hidden=false;document.querySelector('.sample-status').textContent='Local example shown. No API request sent.';actor.state('success')});
