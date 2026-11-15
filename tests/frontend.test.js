import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRequest, makeSnippet, redact, readBounded } from '../public/assets/request.js';
const endpoint={id:'dl.tiktok',path:'/api/downloader/tiktok',executionPath:'/api/v1/downloader/tiktok',method:'GET',public:false};
test('request uses versioned same-origin path and encodes input as one parameter',()=>{
 const result=makeRequest(endpoint,{url:"https://example.invalid/a?x=';&b=1"});
 assert.equal(result.path.split('?')[0],'/api/v1/downloader/tiktok');
 assert.equal(new URL(result.path,'https://local.invalid').searchParams.get('url'),"https://example.invalid/a?x=';&b=1");
 assert.ok(!result.path.includes('apikey'));
});
test('snippets isolate shell input and use key environment variables, never supplied key',()=>{
 const code=makeSnippet(endpoint,{url:"https://example.invalid/'; echo bad"},'cURL');
 assert.match(code,/\$API_KEY/); assert.ok(code.includes("'\\''")||code.includes('%27'));
 assert.match(makeSnippet(endpoint,{},'Python'),/os.environ\["API_KEY"\]/);
 assert.match(makeSnippet(endpoint,{},'TypeScript'),/: unknown/);
});
test('response redaction removes supplied key from nested data and headers',()=>{
 assert.deepEqual(redact({message:'echo UNIT_SECRET',nested:['UNIT_SECRET'],UNIT_SECRET:'value'},'UNIT_SECRET'),{message:'echo [redacted]',nested:['[redacted]'],'[redacted]':'value'});
});
test('bounded reader stops oversized payload instead of buffering all data',async()=>{
 const response=new Response(new Uint8Array(100));
 await assert.rejects(()=>readBounded(response,32),/too large/i);
});
test('bounded reader preserves valid JSON text',async()=>{
 assert.equal(await readBounded(new Response('{"status":true}'),100),'{"status":true}');
});
test('nested JSON stays compact instead of amplifying indentation without bounds', async()=>{
 const {formatResponse}=await import('../public/assets/request.js');
 const text='['.repeat(100)+'['+Array(1000).fill('0').join(',')+']'+']'.repeat(100);
 const result=formatResponse(text);
 assert.ok(result.text.length<=text.length+100);
 assert.ok(Array.isArray(result.value));
});
test('JSON Unicode escaping cannot reveal an entered key after parsing or copying',async()=>{
 const {formatResponse}=await import('../public/assets/request.js');
 const key='fixture-only-key';
 const response=formatResponse('{"echo":"\\u0066ixture-only-key"}',key);
 assert.ok(!response.text.includes(key));
 assert.equal(response.value.echo,'[redacted]');
});
test('unrecognized paths cannot become arbitrary proxy requests',()=>{
 assert.throws(()=>makeRequest({...endpoint,executionPath:'https://outside.invalid/'},{}),/Unsupported endpoint/);
 assert.throws(()=>makeRequest({...endpoint,executionPath:'/v1'},{}),/Unsupported endpoint/);
});
test('published catalog stays synchronized with actual endpoint metadata',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {ENDPOINT_REGISTRY}=await import('../src/registry/endpoints.js');
 const catalog=JSON.parse(await readFile(new URL('../public/assets/catalog.json',import.meta.url),'utf8'));
 assert.equal(catalog.length,ENDPOINT_REGISTRY.length);
 for(const endpoint of ENDPOINT_REGISTRY){const published=catalog.find(e=>e.id===endpoint.id);assert.equal(published.title,endpoint.metadata.title);assert.equal(published.public,endpoint.scopes?.includes('public')||false);assert.equal(published.credits,endpoint.billing_policy.default_credits);}
 assert.equal(catalog.find(e=>e.id==='solve.bridge').supported,false);
});
