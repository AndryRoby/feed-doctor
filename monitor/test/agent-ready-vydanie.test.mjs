// 18. 10. 2026, vydanie Agent Ready (B-02): bezpečnosť zberu, limit, CORS, D1 a mazanie limitera.
// Každý test zlyhal pred opravou v src/ (pozri ops/strategia/2026-10-18-arling-2/stavba/agent-ready-vydanie/STAV.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import * as zber from '../src/agent-ready-fetch.mjs';
import * as cesta from '../src/agent-ready-route.mjs';
import worker from '../src/index.js';
import {nahodne} from '../../../arling-sk/feed-doctor/agent-ready/fixtures/povodne-parsery.mjs';

const migration1=await readFile(new URL('../migrations/0001.sql',import.meta.url),'utf8');
const migration3=await readFile(new URL('../migrations/0003-agent-ready.sql',import.meta.url),'utf8');
function database(){const sql=new DatabaseSync(':memory:');sql.exec(migration1);sql.exec(migration3);return {sql,prepare(query){const statement=sql.prepare(query);const bound=(args=[])=>({bind(...a){return bound(a);},async run(){return {meta:{changes:Number(statement.run(...args).changes)}};},async first(){return statement.get(...args)||null;},async all(){return {results:statement.all(...args)};}});return bound();}};}

test('policy discovery stays linear on hostile link paths',async()=>{
  const href='https://shop.example.org'+'/a'.repeat(50_000);
  const read=async url=>url.endsWith('/robots.txt')?{url,status:200,text:''}:url==='https://shop.example.org/'?{url,status:200,text:'<a href="'+href+'">x</a>'}:{url,status:404,text:''};
  const t=performance.now();await zber.collectStore('https://shop.example.org',{read});const took=performance.now()-t;
  assert.ok(took<300,`collectStore ${Math.round(took)} ms`);
});

test('policy link matching equals the former patterns',()=>{
  assert.equal(typeof zber.policyPathMatches,'function');
  const old={returns:/\/(?:policies\/refund-policy|[^?#]*(?:returns?|refunds?|vratenie|reklamacie|widerruf|ruckgabe|rueckgabe))\b/i,shipping:/\/(?:policies\/shipping-policy|[^?#]*(?:shipping|delivery|doprava|versand|lieferung))\b/i,contact:/\/(?:pages\/)?(?:contact|kontakt|contact-us|contact-information|help)(?:\/|$|\?)/i};
  const rnd=nahodne(5),pick=a=>a[Math.floor(rnd()*a.length)];
  const bits=['/','returns','Return','refund','REFUNDS','policies/refund-policy','policies/shipping-policy','shipping','Delivery','doprava','versand','lieferung','widerruf','ruckgabe','rueckgabe','vratenie','reklamacie','x','-','_','1','pages/','contact','Contact-Us','contact-information','help','kontakt','%20','.'];
  for(let i=0;i<5000;i++){let path='/';const len=Math.floor(rnd()*6);for(let k=0;k<len;k++)path+=pick(bits);
    for(const kind of ['returns','shipping','contact'])assert.equal(zber.policyPathMatches(kind,path),old[kind].test(path),kind+' '+path);}
});

test('unreadable robots.txt stops every page read',async()=>{
  const urls=[];const read=async(url)=>{urls.push(url);return {url,status:200,text:url.endsWith('/robots.txt')?'User-agent: *\n'+'Disallow: /zz\n'.repeat(5001):'<a href="/policies/refund-policy">r</a>'};};
  await zber.collectStore('https://example.org',{read});
  assert.deepEqual(urls,['https://example.org/robots.txt']);
});

test('public address checks: special ranges denied, ordinary public ranges allowed',()=>{
  for(const ip of ['100.72.136.4','100.127.255.255','192.0.0.8','192.0.2.1','192.88.99.1','0.0.0.0','255.255.255.255','169.254.169.254','fd7a:115c:a1e0::1','fe80::1','64:ff9b::7f00:1','::','2001:10::1','2001:2a::1','2001:2::1'])assert.equal(zber.publicAddress(ip),false,ip);
  for(const ip of ['192.0.78.24','192.2.1.1','100.128.0.1','8.8.8.8','2606:4700:4700::1111','2a00:1450:4001::1'])assert.equal(zber.publicAddress(ip),true,ip);
});

test('IPv6 limit counts the whole /64 network, IPv4 counts the address',async()=>{
  const db=database();
  for(let i=1;i<=6;i++)assert.ok(await cesta.claimPublicCheck(db,'2001:db8:1:2::'+i.toString(16),1000),'pokus '+i);
  assert.equal(await cesta.claimPublicCheck(db,'2001:0db8:0001:0002:ffff:ffff:ffff:ffff',1000),false);
  assert.ok(await cesta.claimPublicCheck(db,'2001:db8:1:3::1',1000));
  for(let i=1;i<=6;i++)assert.ok(await cesta.claimPublicCheck(db,'203.0.113.'+i,1000));
  assert.ok(!db.sql.prepare('SELECT group_concat(bucket) b FROM agent_ready_limits').get().b.includes('2001'));
  db.sql.close();
});

test('CORS defaults to https://arling.sk only',async()=>{
  const ask=origin=>cesta.agentReadyRoute(new Request('https://worker.example.org/v1/agent-ready/check?url=http%3A%2F%2Fexample.com',{headers:{origin}}),{AGENT_READY_ENABLED:'true'});
  const ok=await ask('https://arling.sk');assert.equal(ok.status,400);assert.equal(ok.headers.get('access-control-allow-origin'),'https://arling.sk');assert.equal(ok.headers.get('cache-control'),'no-store');
  for(const origin of ['https://www.arling.sk','http://arling.sk','https://arling.sk.evil.org','null']){const r=await ask(origin);assert.equal(r.status,403,origin);assert.equal(r.headers.get('access-control-allow-origin'),null,origin);}
  const custom=await cesta.agentReadyRoute(new Request('https://worker.example.org/v1/agent-ready/check?url=x',{headers:{origin:'https://test.arling.sk'}}),{AGENT_READY_ENABLED:'true',AGENT_READY_ORIGINS:'https://test.arling.sk'});
  assert.equal(custom.headers.get('access-control-allow-origin'),'https://test.arling.sk');
});

test('expired limiter rows are purged by the daily cron, live rows stay',async()=>{
  const db=database();const hour=3_600_000,now=Date.now();
  db.sql.prepare('INSERT INTO agent_ready_limits(bucket,count,expires_at) VALUES(?,?,?)').run('stary',6,now-hour);
  db.sql.prepare('INSERT INTO agent_ready_limits(bucket,count,expires_at) VALUES(?,?,?)').run('zivy',2,now+hour);
  const pending=[];await worker.scheduled({cron:'0 5 * * *',scheduledTime:now},{DB:db},{waitUntil:p=>pending.push(p)});await Promise.all(pending);
  assert.deepEqual(db.sql.prepare('SELECT bucket FROM agent_ready_limits ORDER BY bucket').all().map(r=>r.bucket),['zivy']);
  db.sql.close();
});

test('migration 0003 applied three times keeps one copy of each object',()=>{
  const sql=new DatabaseSync(':memory:');sql.exec(migration1);for(let i=0;i<3;i++)sql.exec(migration3);
  const objects=sql.prepare("SELECT type,name FROM sqlite_master WHERE name LIKE 'agent_ready%' ORDER BY name").all().map(r=>r.type+':'+r.name);
  assert.deepEqual(objects,['trigger:agent_ready_delete','table:agent_ready_limits','table:agent_ready_reports','table:agent_ready_settings']);
  sql.close();
});

test('whole public check through the route: limiter, DNS preflight, Shopify signals, CORS and no-store',async()=>{
  const db=database(),seen=[];
  const product={id:1,handle:'linen-shirt',title:'Linen shirt',product_type:'Shirt',vendor:'Demo',body_html:'<p>'+'Linen shirt with buttons and a straight cut for everyday wear in warm weather.'.repeat(2)+'</p>',options:[{name:'Size'}],variants:[{option1:'S',price:'10.00',available:true}],images:[{src:'https://cdn.shopify.com/s/files/1/a.jpg'}]};
  const pages={'/robots.txt':['text/plain','# we use Shopify as our ecommerce platform\nUser-agent: *\nDisallow: /cart\n'],'/':['text/html','<a href="/policies/refund-policy">Returns</a><script>Shopify.shop = "demo.myshopify.com";</script><link href="https://cdn.shopify.com/x.css">'],'/products.json':['application/json',JSON.stringify({products:[product]})]};
  const fetchImpl=async(input,init={})=>{const url=new URL(typeof input==='string'?input:input.url);seen.push(url.hostname+url.pathname);
    assert.equal(init.redirect,'manual');
    if(url.hostname==='cloudflare-dns.com')return Response.json({Status:0,Answer:url.searchParams.get('type')==='A'?[{type:1,data:'93.184.216.34'}]:[]});
    assert.equal(url.hostname,'shop.example.org');assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');
    const hit=pages[url.pathname];return hit?new Response(hit[1],{headers:{'content-type':hit[0]}}):new Response('',{status:404,headers:{'content-type':'text/html'}});};
  const env={AGENT_READY_ENABLED:'true',DB:db,fetchImpl};
  const r=await cesta.agentReadyRoute(new Request('https://worker.example.org/v1/agent-ready/check?url='+encodeURIComponent('https://shop.example.org'),{headers:{origin:'https://arling.sk','CF-Connecting-IP':'2001:db8:9:9::1'}}),env);
  assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),'https://arling.sk');assert.equal(r.headers.get('cache-control'),'no-store');
  const report=await r.json();
  assert.deepEqual(report.shopify,{detected:true,signals:['export','robots','assets']});
  assert.equal(report.sample.products,1);
  assert.ok(seen.filter(x=>x.startsWith('shop.example.org')).length<=zber.LIMITS.requests);
  assert.equal(seen.filter(x=>x.startsWith('cloudflare-dns.com')).length,2*seen.filter(x=>x.startsWith('shop.example.org')).length,'DNS pred každým čítaním obchodu');
  assert.ok(!JSON.stringify(db.sql.prepare('SELECT * FROM agent_ready_limits').all()).includes('shop.example.org'));
  db.sql.close();
});
