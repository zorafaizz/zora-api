import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ENDPOINT_REGISTRY} from '../src/registry/endpoints.js';
import {generateOpenAPISpec} from '../src/modules/docs/openapi.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const spec=generateOpenAPISpec();
const catalog=ENDPOINT_REGISTRY.map(e=>{const method=e.method==='ALL'?'GET':e.method;return {id:e.id,path:e.path,executionPath:e.aliases?.find(p=>p.startsWith('/api/v1/'))||e.path,method,supported:e.path!=='/v1',public:e.scopes?.includes('public')||false,title:e.metadata.title,description:e.metadata.summary,category:e.category,policy:e.billing_policy.type,credits:e.billing_policy.default_credits,deadline:e.deadline_ms,parameters:spec.paths[e.path]?.[method.toLowerCase()]?.parameters||[]}});
const output=JSON.stringify(catalog,null,2)+'\n';
const target=path.join(root,'public/assets/catalog.json');
if(process.argv.includes('--check')){if(await fs.readFile(target,'utf8')!==output)throw Error('Catalog changed. Run node scripts/build-frontend.mjs');console.log('Frontend registry snapshot matches source.');}
else{await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,output);console.log(`Generated ${catalog.length} endpoint definitions.`);}
