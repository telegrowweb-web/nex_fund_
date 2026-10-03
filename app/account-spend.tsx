'use client';
import {useEffect,useState} from 'react';
import {readApiResponse} from '@/lib/api-response';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
type Total={amount:number,since:string|null,until:string|null,checkedAt:string};
type Spend={amount:number,currency:string,checkedAt:string,timezone:string};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const money=(n:number,c:string)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:c,maximumFractionDigits:2}).format(n);
export default function AccountSpend({account,stale}:{account:{id:string,name:string,currency:string,updatedAt:string,totalSpent?:Total|null,totalSpentError?:string},stale:boolean}){
 const [custom,setCustom]=useState(false),[since,setSince]=useState(()=>today().slice(0,7)+'-01'),[until,setUntil]=useState(today),[result,setResult]=useState<{key:string,spend:Spend}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
 const key=account.id+' / '+since+' / '+until;
 const valid=!!since&&!!until&&since<=until&&until<=today();
 useEffect(()=>{
  if(!custom||!valid){setBusy(false);return;}
  const controller=new AbortController();let active=true;
  setBusy(true);setError('');setResult(null);
  const timer=setTimeout(async()=>{try{
   const r=await fetch('/api/dashboard',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'spend',id:account.id,since,until}),signal:controller.signal});
   
   const j=await readApiResponse(r);
   if(active)setResult({key,spend:j.spend});
  }catch(e){if(active)setError((e as Error).message);}finally{if(active)setBusy(false);}},500);
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[custom,valid,account.id,account.updatedAt,since,until,key,retry]);
 const spend=valid&&result?.key===key?result.spend:null;
 return <div className="account-spend">
  <strong>{custom?(spend?money(spend.amount,spend.currency):'—'):(account.totalSpent?money(account.totalSpent.amount,account.currency):'—')}</strong>
  <small className="meta">{custom?(valid?`${since} – ${until}`:'Choose valid dates'):account.totalSpent?.since&&account.totalSpent.until?`${account.totalSpent.since} – ${account.totalSpent.until}`:account.totalSpent?'No spend reported':account.totalSpentError?'Could not load · refresh again':'Refresh to load'}</small>
  {!custom&&<small className="meta">Maximum available history</small>}
  {!custom&&account.totalSpent&&stale&&<small className="stale-label">Last known · refresh required</small>}
  <Button size="sm" variant="outline" onClick={()=>setCustom(x=>!x)}>{custom?'Show maximum history':'Choose dates'}</Button>
  {custom&&<div className="account-spend-dates">
   <label>From<Input aria-label={`Spend from date for ${account.name}`} type="date" value={since} max={until||today()} onChange={e=>setSince(e.target.value)}/></label>
   <label>To<Input aria-label={`Spend to date for ${account.name}`} type="date" value={until} min={since} max={today()} onChange={e=>setUntil(e.target.value)}/></label>
   {!valid&&<p className="error-detail">Select a start date on or before the end date, ending today or earlier.</p>}
   {valid&&busy&&<p role="status" className="meta">Loading selected dates…</p>}
   {valid&&!busy&&error&&<p role="alert" className="error-detail">{error}</p>}
   {spend&&<small className="meta">Checked {new Date(spend.checkedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST · Report: {spend.timezone}</small>}
   <Button size="sm" variant="ghost" disabled={!valid||busy} onClick={()=>setRetry(x=>x+1)}>Refresh selected dates</Button>
  </div>}
 </div>;
}
