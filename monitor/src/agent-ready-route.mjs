import {inspectStore,publicUrl,createReader} from './agent-ready-fetch.mjs';
import {getWeekly,saveSettings} from './agent-ready-weekly.mjs';

const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
// Pages are served only from https://arling.sk (www.arling.sk answers 301 to it), 18. 10. 2026.
function cors(request,env){const origin=request.headers.get('origin');const allowed=String(env.AGENT_READY_ORIGINS||'https://arling.sk').split(',');return origin&&allowed.includes(origin)?{'access-control-allow-origin':origin,vary:'Origin','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Content-Type'}:{};}
// One IPv6 subscriber usually holds a whole /64, so the limit counts the /64 prefix; IPv4 counts
// the address. Unparsable input stays its own bucket (still limited).
export function limiterSubject(ip){
  const v=String(ip).trim().toLowerCase(),mapped=/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(v);
  if(mapped)return mapped[1];
  if(!v.includes(':'))return v;
  const halves=v.split('::');if(halves.length>2)return v;
  const head=halves[0]?halves[0].split(':'):[],tail=halves.length===2&&halves[1]?halves[1].split(':'):[];
  const groups=halves.length===2?[...head,...Array(Math.max(0,8-head.length-tail.length)).fill('0'),...tail]:head;
  const prefix=groups.slice(0,4).map(g=>/^[0-9a-f]{1,4}$/.test(g)?parseInt(g,16).toString(16):null);
  return prefix.length===4&&prefix.every(g=>g!==null)?prefix.join(':')+'::/64':v;
}
export async function purgeExpiredLimits(db,now=Date.now()){await db.prepare('DELETE FROM agent_ready_limits WHERE expires_at < ?').bind(now).run();}
export async function claimPublicCheck(db,ip,now=Date.now()){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(limiterSubject(ip)));const id=Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('');
 const key='agent-ready:'+id+':'+Math.floor(now/3600000);
 await purgeExpiredLimits(db,now);
 const claimed=await db.prepare('INSERT INTO agent_ready_limits(bucket,count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count<6 RETURNING count').bind(key,now+7200000).first();
 return Boolean(claimed);
}
export async function agentReadyRoute(request,env){
  const u=new URL(request.url),h={...headers,...cors(request,env)},out=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:h});
  if(!u.pathname.startsWith('/v1/agent-ready'))return null;
  if(request.headers.get('origin')&&!h['access-control-allow-origin'])return out({error:'origin_not_allowed'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:h});
  if(env.AGENT_READY_ENABLED!=='true')return out({error:'not_available'},503);
  if(u.pathname==='/v1/agent-ready/check'&&request.method==='GET'){
    const input=u.searchParams.get('url')||'',product=u.searchParams.get('product')||'';
    try{const store=publicUrl(input);if(store.search)throw new Error();if(product&&publicUrl(product).origin!==store.origin)throw new Error();}catch{return out({error:'invalid_public_url'},400);}
    // Atomic D1 counter, fail closed. No store URLs or raw IPs in the limiter.
    const ip=request.headers.get('CF-Connecting-IP');if(!ip||!env.DB)return out({error:'limiter_unavailable'},503);
    try{
      if(!await claimPublicCheck(env.DB,ip))return out({error:'rate_limited'},429);
    }catch{return out({error:'limiter_unavailable'},503);}
    try{return out(await inspectStore(input,{productUrl:product,read:createReader({fetchImpl:env.fetchImpl||fetch})}));}catch{return out({error:'scan_failed'},502);}
  }
  const m=/^\/v1\/agent-ready\/monitors\/([^/]+)$/.exec(u.pathname);
  if(m&&['GET','POST'].includes(request.method)){
    if(env.AGENT_READY_WEEKLY!=='true')return out({error:'not_available'},503);
    const monitor=await env.DB.prepare('SELECT * FROM monitors WHERE id=?').bind(m[1]).first();
    if(!monitor||!u.searchParams.get('key')||monitor.manage_key!==u.searchParams.get('key'))return out({error:'not_found'},404);
    if(monitor.plan!=='pro'||monitor.status!=='active')return out({error:'pro_required'},402);
    if(request.method==='GET')return out(await getWeekly(env.DB,monitor.id));
    try{const text=await request.text();if(text.length>5000)return out({error:'body_too_large'},413);const body=JSON.parse(text);return out(await saveSettings(env.DB,monitor.id,body));}
    catch(e){return out({error:e.message==='revision_conflict'?'revision_conflict':'invalid_settings'},e.message==='revision_conflict'?409:400);}
  }
  return out({error:'not_found'},404);
}
