import {getChatGPTUser} from '@/app/chatgpt-auth';
import {db} from '@/lib/db';
import {workspace,viewerActions} from '@/lib/workspace';
import {graph,pages,calculate,balance} from '@/lib/meta';
import seed from '@/lib/seed.json';
import {totalSpend} from '@/lib/total-spend';
import {connections,publicConnections,uniqueAccounts,candidates} from '@/lib/connections';
export const dynamic='force-dynamic';
const reply=(d:any,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){const u=await getChatGPTUser();if(!u)return reply({error:'Please sign in to open your dashboard.'},401);try{const {owner,isOwner}=await workspace(u);const d=db();const s=await d.prepare('SELECT payload FROM snapshots WHERE owner=?').bind(owner).all();const c=await d.prepare('SELECT id,payload FROM clients WHERE owner=?').bind(owner).all();const rows=await connections(owner);const saved=new Map([...seed,...s.results.map((r:any)=>JSON.parse(r.payload))].map((a:any)=>[a.id,a]));const visible=rows.some(c=>c.accounts===null)?Array.from(saved.values()):uniqueAccounts(rows).map((a:any)=>saved.get(a.id)||{...a,balance:null,budget:null,active:0,updatedAt:'',source:'pending',accountStatus:a.account_status});return reply({accounts:visible,mappings:Object.fromEntries(c.results.map((r:any)=>[r.id,JSON.parse(r.payload)])),connected:rows.length>0,readOnly:!isOwner,connections:isOwner?publicConnections(rows):[]});}catch{return reply({error:'Could not load saved data. Please retry.'},503);}}
export async function POST(req:Request){const u=await getChatGPTUser();if(!u)return reply({error:'Please sign in again.'},401);if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Invalid origin'},403);
 try{const b:any=await req.json();const d=db();const {owner,isOwner}=await workspace(u);if(!isOwner&&!viewerActions.has(b.action))return reply({error:'Only the dashboard owner can change clients or Facebook connections.'},403);
 if(b.action==='connect'){
 if(typeof b.token!=='string'||b.token.length<20||b.token.length>4096)throw Error('Enter a valid Meta access token.');
 const token=b.token.trim();const rows=await connections(owner);
 if(b.connectionId&&!rows.some(c=>c.id===b.connectionId))throw Error('Connection not found.');
 const profile=await graph('me',token,{fields:'id,name'});
 const accounts=await pages('me/adaccounts',token,{fields:'id,name,currency,account_status'});
 const existing=rows.find(c=>c.meta_id===profile.id);
 if(existing&&b.connectionId&&existing.id!==b.connectionId)throw Error('This Facebook ID already has a connection. Update that connection instead.');
 const id=existing?.id||b.connectionId||crypto.randomUUID();
 const label=typeof b.label==='string'&&b.label.trim()?b.label.trim().slice(0,100):profile.name||'Facebook connection';
 await d.prepare('INSERT INTO connections(owner,id,label,token,meta_id,accounts,error,checked_at) VALUES(?,?,?,?,?,?,NULL,?) ON CONFLICT(owner,id) DO UPDATE SET label=excluded.label,token=excluded.token,meta_id=excluded.meta_id,accounts=excluded.accounts,error=NULL,checked_at=excluded.checked_at').bind(owner,id,label,token,profile.id,JSON.stringify(accounts),new Date().toISOString()).run();return reply({ok:true});}
 if(b.action==='disconnect'){if(typeof b.connectionId!=='string')throw Error('Select a connection.');await d.prepare('DELETE FROM connections WHERE owner=? AND id=?').bind(owner,b.connectionId).run();return reply({ok:true});}
 if(b.action==='client'){if(!/^act_\d+$/.test(b.id)||typeof b.name!=='string'||b.name.length>100)throw Error('Enter a client name under 100 characters.');const payload=JSON.stringify({name:b.name.trim(),tracked:!!b.tracked,updatedDay:typeof b.updatedDay==='string'?b.updatedDay.slice(0,10):''});await d.prepare('INSERT INTO clients(owner,id,payload) VALUES(?,?,?) ON CONFLICT(owner,id) DO UPDATE SET payload=excluded.payload').bind(owner,b.id,payload).run();return reply({ok:true});}
 const rows=await connections(owner);if(!rows.length)throw Error('Connect Meta first.');
 if(b.action==='list'){
 for(const c of rows){try{const accounts=await pages('me/adaccounts',c.token,{fields:'id,name,currency,account_status'});await d.prepare('UPDATE connections SET accounts=?,error=NULL,checked_at=? WHERE owner=? AND id=?').bind(JSON.stringify(accounts),new Date().toISOString(),owner,c.id).run();}catch(e){await d.prepare('UPDATE connections SET error=? WHERE owner=? AND id=?').bind((e as Error).message,owner,c.id).run();}}
 const latest=await connections(owner);let accounts=uniqueAccounts(latest);if(latest.some(c=>c.accounts===null)){const old=await d.prepare('SELECT payload FROM snapshots WHERE owner=?').bind(owner).all();accounts=Array.from(new Map([...seed,...old.results.map((r:any)=>JSON.parse(r.payload)),...accounts].map((a:any)=>[a.id,a])).values());}return reply({accounts,connections:isOwner?publicConnections(latest):[]});
 }
 if(!/^act_\d+$/.test(b.id))throw Error('Invalid account.');
 const eligible=candidates(rows,b.id);if(!eligible.length)throw Error('No connected Facebook ID has access to this account. Refresh accounts first.');
 let lastError:unknown;
 for(const config of eligible){try{
 if(b.action==='spend'){
 if(!/^act_\d+$/.test(b.id))throw Error('Invalid account.');
 const validDate=(v:any)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(!validDate(b.since)||!validDate(b.until)||b.since>b.until||b.until>today)throw Error('Select a valid date range ending today or earlier.');
 const account=await graph(b.id,config.token,{fields:'currency,timezone_name'});
 const rows=await pages(b.id+'/insights',config.token,{fields:'spend,account_currency',level:'account',time_increment:'all_days',time_range:JSON.stringify({since:b.since,until:b.until})});
 let amount=0;for(const row of rows){const n=Number(row.spend);if(row.spend==null||!Number.isFinite(n)||n<0||row.account_currency&&row.account_currency!==account.currency)throw Error('Meta returned incomplete spend data. Please retry.');amount+=n;}
 return reply({spend:{amount:Math.round(amount*100)/100,currency:account.currency,timezone:account.timezone_name||'Ad account timezone',checkedAt:new Date().toISOString()}});
 }
 if(b.action==='refresh'){if(!/^act_\d+$/.test(b.id))throw Error('Invalid account.');const a=await graph(b.id,config.token,{fields:'id,name,currency,account_status'});const disabled=Number(a.account_status)===2;let funds:any={};try{funds=await graph(b.id,config.token,{fields:'currency,is_prepay_account,funding_source_details'});}catch(e){if(!disabled)throw e;}
 const campaigns=disabled?[]:await pages(b.id+'/campaigns',config.token,{fields:'id,effective_status,daily_budget,lifetime_budget'});const sets=disabled?[]:await pages(b.id+'/adsets',config.token,{fields:'id,campaign_id,effective_status,daily_budget,lifetime_budget,start_time,end_time'});let spent:any=null,spentError='';for(const credential of eligible){try{spent=await totalSpend(b.id,credential.token,a.currency);spentError='';break;}catch(e){spentError=(e as Error).message;}}const payload={totalSpent:spent,totalSpentError:spentError,id:a.id,name:a.name,currency:a.currency,accountStatus:Number(a.account_status)||null,balance:balance({...a,...funds}),...calculate(campaigns,sets),...(disabled?{budget:null,active:0,budgetNote:'Account disabled'}:a.currency!=='INR'?{budget:null,budgetNote:'Currency not yet supported'}:{}),updatedAt:new Date().toISOString(),source:'live'};await d.prepare('INSERT INTO snapshots(owner,id,payload) VALUES(?,?,?) ON CONFLICT(owner,id) DO UPDATE SET payload=excluded.payload').bind(owner,b.id,JSON.stringify(payload)).run();return reply({account:payload});}
 }catch(e){lastError=e;}}
 if(lastError)throw lastError;
 return reply({error:'Unknown action'},400);
 }catch(e){return reply({error:e instanceof Error&&!/SQL|D1|database|fetch|network/i.test(e.message)?e.message:'Could not complete this request. Retry shortly.'},400);}}
