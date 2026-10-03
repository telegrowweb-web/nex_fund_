'use client';
import {useState,useEffect,useRef} from 'react';
import {readApiResponse} from '@/lib/api-response';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Table,TableHeader,TableHead,TableBody,TableRow,TableCell} from '@/components/ui/table';
type Account={id:string,name:string,currency:string,balance:number|null,accountStatus?:number|null};
type Spend={amount:number,currency:string,checkedAt:string,timezone:string};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const money=(n:number,c:string)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:c}).format(n);
export default function ClientSpend({accounts,mappings,connected,onConnect,refreshEpoch,parentBusy}:{refreshEpoch:number,parentBusy:boolean,accounts:Account[],mappings:Record<string,{name:string}>,connected:boolean,onConnect:()=>void}){
 const lock=useRef(false),latest=useRef<()=>Promise<void>>(async()=>{});
 const [since,setSince]=useState(()=>today().slice(0,7)+'-01'),[until,setUntil]=useState(today),[results,setResults]=useState<Record<string,Spend>>({}),[errors,setErrors]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[range,setRange]=useState(''),[query,setQuery]=useState('');
 const eligible=accounts.filter(a=>a.accountStatus!==2&&a.balance!==null&&mappings[a.id]?.name.trim());
 const groups=Object.values(eligible.reduce((all:Record<string,{name:string,accounts:Account[]}>,a)=>{const name=mappings[a.id].name.trim(),key=name.toLocaleLowerCase();(all[key]??={name,accounts:[]}).accounts.push(a);return all;},{})).sort((a,b)=>a.name.localeCompare(b.name));
 const matches=groups.filter(g=>(g.name+' '+g.accounts.map(a=>a.name).join(' ')).toLowerCase().includes(query.toLowerCase()));
 const valid=!!since&&!!until&&since<=until&&until<=today();
 const current=range===since+' / '+until;
 function dates(start:string,end:string){setSince(start);setUntil(end);}
 async function refresh(){if(lock.current)return;if(!connected){onConnect();return;}lock.current=true;setBusy(true);setResults({});setErrors({});setRange(since+' / '+until);for(let i=0;i<eligible.length;i++){const a=eligible[i];setProgress(`${i+1} / ${eligible.length} · ${a.name}`);try{const r=await fetch('/api/dashboard',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'spend',id:a.id,since,until})});const j=await readApiResponse(r);setResults(x=>({...x,[a.id]:j.spend}));}catch(e){setErrors(x=>({...x,[a.id]:(e as Error).message}));}}lock.current=false;setBusy(false);setProgress('');}
 latest.current=refresh;
 const eligibleKey=eligible.map(a=>a.id).sort().join(',');
 useEffect(()=>{if(!connected||parentBusy||!valid||!eligibleKey)return;const timer=setTimeout(()=>{if(!lock.current)void latest.current();},1000);return()=>clearTimeout(timer);},[connected,parentBusy,refreshEpoch,since,until,eligibleKey,valid]);
 return <section className="accounts spend-section"><div className="table-heading"><div><h2>Client spend <span>{groups.length} clients</span></h2><p>Link multiple ad accounts to the same client name to see their combined spend.</p></div><Input aria-label="Search client spend" placeholder="Search client…" value={query} onChange={e=>setQuery(e.target.value)} className="spend-search"/></div>
 <div className="spend-controls"><Button variant="outline" disabled={busy} onClick={()=>dates(today(),today())}>Today</Button><Button variant="outline" disabled={busy} onClick={()=>dates(today().slice(0,7)+'-01',today())}>This month</Button><label>From<Input type="date" value={since} max={until} disabled={busy} onChange={e=>setSince(e.target.value)}/></label><label>To<Input type="date" value={until} min={since} max={today()} disabled={busy} onChange={e=>setUntil(e.target.value)}/></label><Button disabled={busy||!valid||!eligible.length} onClick={refresh}>{busy?'Loading spend…':'Refresh client spend'}</Button></div>
 <p className="spend-note">Actual Meta ad spend for the selected dates, in each ad account’s timezone. This is spend, not funds added. Disabled and missing-balance accounts remain in the Disabled section and are excluded here.</p>
 {!valid&&<p className="spend-note red">Select a valid date range ending today or earlier.</p>}{busy&&<p className="spend-note" role="status">{progress}</p>}{!current&&groups.length>0&&<p className="spend-note">This date range will load automatically after the account update.</p>}
 <div className="client-groups">{matches.map(g=>{const totals:Record<string,{sum:number,loaded:number,count:number}>={};for(const a of g.accounts){const r=current?results[a.id]:undefined,c=r?.currency||a.currency;const t=totals[c]??={sum:0,loaded:0,count:0};t.count++;if(r){t.sum+=r.amount;t.loaded++;}}
 return <article className="client-group" key={g.name.toLowerCase()}><div className="client-group-heading"><div><h3>{g.name}</h3><p>{g.accounts.length} ad accounts</p></div><div className="client-totals">{Object.entries(totals).map(([currency,t])=><div key={currency}><small>{t.loaded===t.count?'Total spent':'Partial spend'} · {currency}</small><strong>{t.loaded?money(t.sum,currency):'—'}</strong>{t.loaded<t.count&&<small>{t.loaded} of {t.count} accounts loaded</small>}</div>)}</div></div><Table><TableHeader><TableRow><TableHead>AD ACCOUNT</TableHead><TableHead className="number">AMOUNT SPENT</TableHead><TableHead>LAST CHECKED</TableHead></TableRow></TableHeader><TableBody>{g.accounts.map(a=>{const r=current?results[a.id]:undefined;return <TableRow key={a.id}><TableCell>{a.name}<div className="meta">…{a.id.slice(-6)}</div></TableCell><TableCell className="number balance">{r?money(r.amount,r.currency):'—'}</TableCell><TableCell>{r?<><span>{new Date(r.checkedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</span><div className="meta">Report timezone: {r.timezone}</div></>:<span className={current&&errors[a.id]?'red':'muted'}>{current&&errors[a.id]||'Not loaded'}</span>}</TableCell></TableRow>;})}</TableBody></Table></article>;})}</div>
 {!matches.length&&<div className="empty">{groups.length?'No matching clients.':'Use Link client below. Select the same client for each of their accounts.'}</div>}
 </section>;
}
