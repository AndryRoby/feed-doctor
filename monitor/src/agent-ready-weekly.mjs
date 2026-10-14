import {inspectStore,publicUrl,createReader} from './agent-ready-fetch.mjs';
export function weekKey(now){const d=new Date(now);d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
export async function saveSettings(db,id,{store_url,product_url='',revision},now=new Date()){
  const u=publicUrl(store_url);if(u.pathname!=='/'||u.search)throw new Error('store_origin_required');
  if(product_url&&publicUrl(product_url).origin!==u.origin)throw new Error('product_same_origin_required');
  if(!Number.isInteger(revision)||revision<0)throw new Error('revision_required');
  const sql=revision===0
    ? `INSERT OR IGNORE INTO agent_ready_settings(monitor_id,store_url,product_url,revision,updated_at) SELECT ?,?,?,1,? WHERE EXISTS(SELECT 1 FROM monitors WHERE id=? AND plan='pro' AND status='active')`
    : `UPDATE agent_ready_settings SET store_url=?,product_url=?,revision=revision+1,updated_at=? WHERE monitor_id=? AND revision=? AND EXISTS(SELECT 1 FROM monitors WHERE id=? AND plan='pro' AND status='active')`;
  const values=revision===0?[id,u.origin,product_url,now.toISOString(),id]:[u.origin,product_url,now.toISOString(),id,revision,id];
  const r=await db.prepare(sql).bind(...values).run();
  if(!r.meta?.changes)throw new Error('revision_conflict');
  return {revision:revision+1};
}
export async function getWeekly(db,id){
  const settings=await db.prepare('SELECT * FROM agent_ready_settings WHERE monitor_id=?').bind(id).first();
  if(!settings)return {settings:null,report:null};
  const row=await db.prepare("SELECT * FROM agent_ready_reports WHERE monitor_id=? AND revision=? ORDER BY week DESC LIMIT 1").bind(id,settings.revision).first();
  return {settings,report:row?.status==='done'?JSON.parse(row.report_json):null,status:row?.status||'pending',error:row?.error||null};
}
export async function runWeekly(env,monitor,{now=new Date(),scan=inspectStore}={}){
  if(env.AGENT_READY_WEEKLY!=='true'||monitor.plan!=='pro'||monitor.status!=='active')return {status:'disabled'};
  const db=env.DB,settings=await db.prepare('SELECT * FROM agent_ready_settings WHERE monitor_id=?').bind(monitor.id).first();
  if(!settings)return {status:'not_configured'};
  const week=weekKey(now),token=crypto.randomUUID(),lease=new Date(now.getTime()+120000).toISOString();
  const claim=await db.prepare(`INSERT INTO agent_ready_reports(monitor_id,week,revision,token,lease_until,status)
    VALUES(?,?,?,?,?,'running') ON CONFLICT(monitor_id,week) DO UPDATE SET revision=excluded.revision,token=excluded.token,lease_until=excluded.lease_until,status='running',report_json=NULL,error=NULL
    WHERE agent_ready_reports.revision < excluded.revision OR (agent_ready_reports.status != 'done' AND agent_ready_reports.lease_until < ?)`)
    .bind(monitor.id,week,settings.revision,token,lease,now.toISOString()).run();
  if(!claim.meta?.changes)return {status:'already_claimed'};
  try{
    const report=await scan(settings.store_url,{productUrl:settings.product_url,read:createReader({fetchImpl:env.fetchImpl||fetch})});
    if(report.score===null||report.sample.pages===0)throw new Error('insufficient_evidence');
    // Save minimal report; current rule descriptions come from the shared engine.
    const stored={version:report.version,at:report.at,storeUrl:report.storeUrl,score:report.score,coverage:report.coverage,sample:report.sample,rules:report.rules.map(({code,status,checked,affected})=>({code,status,checked,affected}))};
    const json=JSON.stringify(stored);JSON.parse(json);
    const saved=await db.prepare(`UPDATE agent_ready_reports SET status='done',report_json=?,error=NULL WHERE monitor_id=? AND week=? AND token=? AND revision=?
      AND EXISTS(SELECT 1 FROM agent_ready_settings WHERE monitor_id=? AND revision=?)
      AND EXISTS(SELECT 1 FROM monitors WHERE id=? AND plan='pro' AND status='active')`)
      .bind(json,monitor.id,week,token,settings.revision,monitor.id,settings.revision,monitor.id).run();
    return {status:saved.meta?.changes?'done':'superseded'};
  }catch{
    await db.prepare("UPDATE agent_ready_reports SET status='failed',error='scan_failed',lease_until=? WHERE monitor_id=? AND week=? AND token=? AND revision=?")
      .bind(now.toISOString(),monitor.id,week,token,settings.revision).run();
    return {status:'failed'};
  }
}
export async function refreshWeekly(env,{now=new Date(),scan=inspectStore,clock=Date.now,budgetMs=480000}={}){
  if(env.AGENT_READY_WEEKLY!=='true')return [];
  const week=weekKey(now);
  const rows=await env.DB.prepare(`SELECT m.* FROM monitors m JOIN agent_ready_settings a ON a.monitor_id=m.id
    LEFT JOIN agent_ready_reports r ON r.monitor_id=m.id AND r.week=? AND r.revision=a.revision
    WHERE m.plan='pro' AND m.status='active' AND (r.monitor_id IS NULL OR (r.status!='done' AND r.lease_until<?))
    ORDER BY COALESCE(r.lease_until,''),m.id LIMIT 50`).bind(week,now.toISOString()).all();
  const outcomes=[],started=clock();for(const m of rows.results||[]){if(clock()-started>=budgetMs)break;outcomes.push({id:m.id,...await runWeekly(env,m,{now:new Date(now.getTime()+clock()-started),scan})});}return outcomes;
}
