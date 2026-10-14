import { analyzeStore, extractHtml, robotsAllows } from '../../../arling-sk/feed-doctor/agent-ready/core.mjs';

export const LIMITS=Object.freeze({bytes:2_000_000,timeout:8000,totalMs:55000,requests:14,redirects:2});
const UA='ARLingAgentReady/1.0 (+https://arling.sk/feed-doctor/agent-ready/)';
export function publicUrl(input) {
  const u=new URL(input);const h=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||u.hash||u.href.length>2048)throw new Error('public_https_required');
  // Domain names only: rejects IPv4 (including numeric/hex forms normalized by URL),
  // IPv6, single-label hosts and private suffixes. DNS is checked separately.
  if(!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(h)||/\.(?:localhost|local|internal|lan|home|test|invalid|example|onion)$/.test(h))throw new Error('public_domain_required');
  if(/(?:^|\.)(?:metadata|localhost)\./.test(h))throw new Error('private_host');
  return u;
}
export function publicAddress(ip) {
  if(/^\d+\.\d+\.\d+\.\d+$/.test(ip)){
    const [a,b,c,d]=ip.split('.').map(Number);if([a,b,c,d].some(n=>n>255))return false;
    return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
  }
  // Public global-unicast IPv6 only, no mapped/compatible/NAT64/6to4/documentation.
  return /^2[0-9a-f]{0,3}:/i.test(ip)&&!/^(?:2001:(?:db8|0|10|20)(?::|$)|2002:)/i.test(ip);
}
async function capped(res,signal,max=LIMITS.bytes){
  if(Number(res.headers.get('content-length'))>max){await res.body?.cancel();throw new Error('response_too_large');}
  if(!res.body)return '';
  const reader=res.body.getReader(),chunks=[];let count=0;
  try {while(true){if(signal.aborted)throw new Error('timeout');const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>max)throw new Error('response_too_large');chunks.push(value);}}
  catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
  const bytes=new Uint8Array(count);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return new TextDecoder().decode(bytes);
}
export async function resolvePublic(host,{fetchImpl=fetch,signal}={}){
  const addresses=[];
  for(const type of ['A','AAAA']){
    const res=await fetchImpl('https://cloudflare-dns.com/dns-query?name='+encodeURIComponent(host)+'&type='+type,{method:'GET',headers:{accept:'application/dns-json'},redirect:'manual',signal});
    if(!res.ok)throw new Error('dns_unavailable');
    const data=JSON.parse(await capped(res,signal,64000));if(data.Status!==0)throw new Error('dns_unavailable');
    for(const a of data.Answer||[])if(a.type===1||a.type===28)addresses.push(a.data);
  }
  if(!addresses.length||addresses.some(ip=>!publicAddress(ip)))throw new Error('private_or_unknown_dns');
}

export function createReader({fetchImpl=fetch,resolveImpl=resolvePublic,limits=LIMITS,now=Date.now}={}){
  const started=now();let requests=0;
  return async function read(input,kind='html',allowRedirect=true){
    let url=publicUrl(input).href;
    const controller=new AbortController();const timeout=Math.min(limits.timeout,limits.totalMs-(now()-started));
    if(timeout<=0)return {url,status:0,error:'scan_budget_exhausted'};
    const timer=setTimeout(()=>controller.abort(),timeout);
    try{
      for(let hops=0;hops<=limits.redirects;hops++){
        if(++requests>limits.requests)throw new Error('request_budget_exhausted');
        const u=publicUrl(url);
        await resolveImpl(u.hostname,{fetchImpl,signal:controller.signal});
        const res=await fetchImpl(url,{method:'GET',redirect:'manual',credentials:'omit',signal:controller.signal,headers:{'user-agent':UA,accept:kind==='json'?'application/json':kind==='text'?'text/plain':'text/html'}});
        if([301,302,303,307,308].includes(res.status)){
          await res.body?.cancel();
          if(!allowRedirect)throw new Error('redirect_not_followed');
          const next=publicUrl(new URL(res.headers.get('location'),url).href);
          // Prevent arbitrary origin changes; www canonicalization is the only exception.
          if(next.hostname.replace(/^www\./,'')!==u.hostname.replace(/^www\./,''))throw new Error('cross_origin_redirect');
          url=next.href;continue;
        }
        if(!res.ok){await res.body?.cancel();return {url,status:res.status,text:''};}
        const type=(res.headers.get('content-type')||'').toLowerCase();
        if(kind==='json'&&!type.includes('json')||kind==='html'&&!type.includes('html')||kind==='text'&&!type.startsWith('text/plain')){await res.body?.cancel();throw new Error('unexpected_content_type');}
        return {url,status:res.status,text:await capped(res,controller.signal,limits.bytes)};
      }
      throw new Error('redirect_limit');
    }catch(e){return {url,status:0,error:controller.signal.aborted?'timeout':e.message};}finally{clearTimeout(timer);}
  };
}
function policyLink(links,origin,kind){
  const patterns={returns:/\/(?:policies\/refund-policy|[^?#]*(?:returns?|refunds?|vratenie|reklamacie|widerruf|ruckgabe|rueckgabe))\b/i,shipping:/\/(?:policies\/shipping-policy|[^?#]*(?:shipping|delivery|doprava|versand|lieferung))\b/i,contact:/\/(?:pages\/)?(?:contact|kontakt|contact-us|contact-information|help)(?:\/|$|\?)/i};
  return links.find(link=>{const u=new URL(link);return u.origin===origin&&patterns[kind].test(u.pathname);});
}
export async function collectStore(input,{productUrl='',read=createReader(),now=()=>new Date().toISOString()}={}){
  const start=publicUrl(input);if(start.search)throw new Error('store_query_not_allowed');
  let origin=start.origin;
  const resources={};resources.robots=await read(origin+'/robots.txt','text');
  if([200,404,410].includes(resources.robots.status))origin=new URL(resources.robots.url).origin;
  const canRead=url=>{
    const r=resources.robots;
    if(![200,404,410].includes(r.status))return false;
    return robotsAllows(r.text||'','ARLingAgentReady',new URL(url).pathname+new URL(url).search);
  };
  const permitted=async(url,kind='html')=>canRead(url)?read(url,kind,false):{url,status:0,error:'robots_prevented_fetch'};
  // Home canonical redirects are inspected by the reader; subsequent reads do not
  // follow redirects, so a robots-disallowed destination is never fetched implicitly.
  resources.home=await permitted(origin+'/');
  // A root redirect to www needs that origin's robots policy before any page.
  if(resources.home.error==='redirect_not_followed'){
    const candidate=origin.startsWith('https://www.')?origin.replace('https://www.','https://') : origin.replace('https://','https://www.');
    const robots=await read(candidate+'/robots.txt','text');
    if([200,404,410].includes(robots.status)&&new URL(robots.url).origin===candidate){
      const old=resources.robots;resources.robots=robots;const home=await permitted(candidate+'/');
      if(home.status===200){origin=candidate;resources.home=home;}else resources.robots=old;
    }
  }
  let links=[];
  if(resources.home.status===200)links=extractHtml(resources.home.text,resources.home.url).links;
  resources.feed=await permitted(origin+'/products.json?limit=20','json');
  let products=[];if(resources.feed.status===200){try{const j=JSON.parse(resources.feed.text);if(Array.isArray(j.products))products=j.products.slice(0,20);}catch{resources.feed={...resources.feed,status:0,error:'invalid_json'};}}
  let candidates=[];
  if(productUrl){const u=publicUrl(productUrl);if(u.hostname.replace(/^www\./,'')!==new URL(origin).hostname.replace(/^www\./,''))throw new Error('product_same_origin_required');candidates=[origin+u.pathname+u.search];}
  else if(start.pathname!=='/')candidates=[origin+start.pathname];
  else candidates=products.filter(p=>typeof p?.handle==='string'&&/^[a-zA-Z0-9_-]+$/.test(p.handle)).slice(0,3).map(p=>origin+'/products/'+encodeURIComponent(p.handle));
  if(!candidates.length)candidates=links.filter(x=>new URL(x).origin===origin&&/\/(products|product|produkt|p)\//i.test(new URL(x).pathname)).slice(0,3);
  const productPages=[];
  for(const url of [...new Set(candidates)].slice(0,3)){const page=await permitted(url);productPages.push(page);if(page.status===200)links.push(...extractHtml(page.text,page.url).links);}
  for(const [kind,fallback] of [['returns','/policies/refund-policy'],['shipping','/policies/shipping-policy'],['contact','/pages/contact']]){
    const discovered=policyLink(links,origin,kind),url=discovered||(products.length?origin+fallback:null);
    resources[kind]=url?await permitted(url):{url:origin+'/',status:0,error:'policy_link_not_found'};
    if(!discovered&&[404,410].includes(resources[kind].status))resources[kind]={url,status:0,error:'policy_link_not_found'};
  }
  resources.llms=await permitted(origin+'/llms.txt','text');
  return {at:now(),storeUrl:origin,resources,productPages};
}
export async function inspectStore(url,options={}){return analyzeStore(await collectStore(url,options));}
