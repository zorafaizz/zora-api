export function makeRequest(endpoint, values) {
  const path = endpoint.executionPath;
  if (!/^\/(?:health|api\/v1\/[a-z0-9/_-]+)$/.test(path)) throw new Error('Unsupported endpoint path.');
  const query = new URLSearchParams();
  for (const [name,value] of Object.entries(values)) if (value !== '') query.set(name,String(value));
  return {path:path+(query.size?'?'+query.toString():''), method:endpoint.method};
}
export function makeSnippet(endpoint, values, language) {
  const request=makeRequest(endpoint,values), address='https://api.itsfaiz.my.id'+request.path, auth=!endpoint.public;
  if(language==='cURL') return `curl '${address.replaceAll("'","'\\''")}'${auth?' \\\n  -H "Authorization: Bearer $API_KEY"':''}`;
  if(language==='Python') return `import requests${auth?'\nimport os':''}\n\nresponse = requests.get(\n    ${JSON.stringify(address)}${auth?',\n    headers={"Authorization": "Bearer " + os.environ["API_KEY"]}':''}\n)\nresponse.raise_for_status()\nprint(response.json())`;
  return `${auth?'// Run on your server with API_KEY set in the environment.\nconst apiKey = process.env.API_KEY;\n':''}const response = await fetch(${JSON.stringify(address)}${auth?', {\n  headers: { Authorization: `Bearer ${apiKey}` }\n}':''});\nif (!response.ok) throw new Error(\`HTTP \${response.status}\`);\nconst data${language==='TypeScript'?': unknown':''} = await response.json();\nconsole.log(data);`;
}
export function redact(value, key) {
  if(!key)return value;
  let remaining=10000;
  function visit(item,depth=0){
    if(--remaining<0||depth>32)return '[redacted: display limit]';
    if(typeof item==='string')return item.replaceAll(key,'[redacted]');
    if(Array.isArray(item)){if(item.length>10000)return '[redacted: display limit]';return item.map(v=>visit(v,depth+1));}
    if(item&&typeof item==='object'){const entries=Object.entries(item);if(entries.length>10000)return '[redacted: display limit]';return Object.fromEntries(entries.map(([k,v])=>[k.replaceAll(key,'[redacted]'),visit(v,depth+1)]));}
    return item;
  }
  return visit(value);
}
export async function readBounded(response, limit=1024*1024) {
  if(Number(response.headers.get('content-length'))>limit){await response.body?.cancel();throw new Error('Response too large to display (1 MB limit).');}
  if(!response.body)return '';
  const reader=response.body.getReader(),decoder=new TextDecoder();let text='',size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new Error('Response too large to display (1 MB limit).');}text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}finally{reader.releaseLock();}
}
export function formatResponse(text, key='') {
  let value;
  try{value=JSON.parse(text)}catch{return {text:redact(text,key),value:undefined}}
  if(key){value=redact(value,key);text=JSON.stringify(value);}
  if(text.length>50000)return {text,value};
  const stack=[[value,0]];let scheduled=1;
  while(stack.length){const [item,depth]=stack.pop();if(depth>12)return {text,value};
    if(item&&typeof item==='object')for(const child of Object.values(item)){if(++scheduled>2000)return {text,value};stack.push([child,depth+1]);}
  }
  return {text:JSON.stringify(value,null,2),value};
}
