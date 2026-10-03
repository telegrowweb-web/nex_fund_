import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isWorkspaceOwner} from '@/lib/workspace';
import {GET as readDashboard,POST as dashboardAction} from '@/app/api/dashboard/route';
export const dynamic='force-dynamic';
const definitions=[
 {name:'read_fund_dashboard',description:'Read the saved shared Meta account balances, daily budgets and total spend, including each account update timestamp. Owner only.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'refresh_fund_dashboard',description:'Refresh Meta funds, daily budgets and total spend and save them. Start with cursor 0, then call again with nextCursor until null. Each call processes up to 3 accounts. Requires the owner connection; uses existing server-stored Meta credentials. Returns failures without exposing tokens.',inputSchema:{type:'object',properties:{cursor:{type:'integer',minimum:0}},additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true}}
];
export async function POST(req:Request){
 let rpc:any;try{rpc=await req.json();}catch{return Response.json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}},{status:400});}
 const result=(value:any)=>Response.json({jsonrpc:'2.0',id:rpc.id,result:value});
 const error=(code:number,message:string)=>Response.json({jsonrpc:'2.0',id:rpc.id??null,error:{code,message}});
 if(rpc.method==='initialize')return result({protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'Client Fund Desk',version:'1.0.0'}});
 if(rpc.method?.startsWith('notifications/'))return new Response(null,{status:202});
 if(rpc.method==='ping')return result({});
 if(rpc.method==='tools/list')return result({tools:definitions});
 if(rpc.method!=='tools/call')return error(-32601,'Method not found');
 const u=await getChatGPTUser();if(!u||!isWorkspaceOwner(u))return new Response('Owner sign-in required',{status:u?403:401});
 const tool=rpc.params?.name,args=rpc.params?.arguments||{};
 const output=(data:any,isError=false)=>result({content:[{type:'text',text:JSON.stringify(data)}],isError});
 try{
 if(tool==='read_fund_dashboard'){if(Object.keys(args).length)return error(-32602,'No arguments expected');const r=await readDashboard();const d:any=await r.json();if(!r.ok)return output(d,true);return output({accounts:d.accounts,mappings:d.mappings});}
 if(tool!=='refresh_fund_dashboard')return error(-32602,'Unknown tool');
 const cursor=args.cursor??0;if(!Number.isInteger(cursor)||cursor<0||Object.keys(args).some(k=>k!=='cursor'))return error(-32602,'Invalid cursor');
 const action=async(body:any)=>{const r=await dashboardAction(new Request(new URL('/api/dashboard',req.url),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));const d:any=await r.json();if(!r.ok)throw Error(d.error||'Update failed');return d;};
 let accounts:any[],connectionErrors:any[]=[];
 if(cursor===0){const d=await action({action:'list'});accounts=d.accounts;connectionErrors=d.connections.filter((c:any)=>c.error).map((c:any)=>({label:c.label,error:c.error}));}
 else{const r=await readDashboard();const d:any=await r.json();if(!r.ok)throw Error('Could not read saved accounts');accounts=d.accounts;}
 accounts.sort((a,b)=>a.id.localeCompare(b.id));
 const updated:any[]=[],failed:any[]=[];
 for(const a of accounts.slice(cursor,cursor+3)){try{const d=await action({action:'refresh',id:a.id});updated.push({id:a.id,checkedAt:d.account.updatedAt,totalSpentError:d.account.totalSpentError||null});}catch(e){failed.push({id:a.id,error:(e as Error).message});}}
 return output({updated,failed,connectionErrors,totalAccounts:accounts.length,nextCursor:cursor+3<accounts.length?cursor+3:null});
 }catch{return output({error:'Could not complete the update. Check the dashboard connection and retry.'},true);}
}
export async function GET(){return new Response('Use POST',{status:405});}
