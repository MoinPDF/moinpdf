export const TTL=15*60*1000, MAX_TRANSFER=12*1024*1024, MAX_FILES=20;
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),x=>x.toString(16).padStart(2,'0')).join('');
const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
async function limited(request,max){const reader=request.body?.getReader();if(!reader)return new Uint8Array();let size=0;const parts=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new Error('size');}parts.push(value);}const out=new Uint8Array(size);let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;}
/** Storage methods perform conditional state transitions, shared by hosted and self-hosted builds. */
export function createTransferHandler(store,now=Date.now){
 return async request=>{try{
  const url=new URL(request.url),parts=url.pathname.split('/').filter(Boolean),id=parts[2],action=parts[3];
  if(request.headers.get('X-MoinPDF-Client')!=='web'||['cross-site','same-site'].includes(request.headers.get('Sec-Fetch-Site'))||(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin&&!(url.protocol==='http:'&&request.headers.get('Sec-Fetch-Site')==='same-origin'&&request.headers.get('Origin')==='https://'+url.host)))return json({error:'origin'},403);
  await store.sweep(now());
  if(!id&&request.method==='POST'){
    const id=token(),send=token(),receive=token(),expires=now()+TTL;
    if(!await store.create({id,expires,send_hash:await digest(send),receive_hash:await digest(receive),pending:null,ack:null,count:0}))return json({error:'busy'},429);
    return json({id,send,receive,expires},201);
  }
  if(!/^[a-f0-9]{48}$/.test(id||''))return json({error:'missing'},404);
  const session=await store.get(id);if(!session||session.expires<=now())return json({error:'expired'},410);
  const auth=request.headers.get('Authorization')||'';if(!/^Bearer [a-f0-9]{48}$/.test(auth))return json({error:'auth'},403);
  const hash=await digest(auth.slice(7)),receive=hash===session.receive_hash,send=hash===session.send_hash;
  if(!receive&&!send)return json({error:'auth'},403);
  if(!action&&request.method==='GET')return json({expires:session.expires,pending:session.pending,ack:session.ack,count:session.count});
  if(!action&&request.method==='DELETE'&&receive){await store.remove(id);return json({closed:true});}
  if(action==='file'&&request.method==='PUT'&&send){
    const item=request.headers.get('X-Transfer-Id');if(!/^[a-f0-9]{32}$/.test(item||''))return json({error:'item'},400);
    if(session.ack===item)return json({accepted:true,ack:true});
    if(session.pending===item&&await store.has(id,item))return json({accepted:true});
    if(session.pending&&session.pending!==item)return json({error:'pending'},409);
    if(session.count>=MAX_FILES)return json({error:'limit'},413);
    const data=await limited(request,MAX_TRANSFER);if(data.length<29)return json({error:'size'},400);
    if(!await store.claim(id,item,now()))return json({error:'pending'},409);
    await store.put(id,item,data);
    const current=await store.get(id);if(!current||current.expires<=now()||current.pending!==item){await store.deleteFile(id,item);return json({error:'expired'},410);}
    return json({accepted:true},201);
  }
  if(action==='file'&&request.method==='GET'&&receive){
    const item=url.searchParams.get('id');if(!item||session.pending!==item)return json({error:'missing'},404);
    const data=await store.file(id,item);if(!data)return json({error:'pending'},404);
    return new Response(data,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  if(action==='ack'&&request.method==='POST'&&receive){
    const item=request.headers.get('X-Transfer-Id');if(!/^[a-f0-9]{32}$/.test(item||''))return json({error:'item'},400);
    if(session.ack===item)return json({ack:item});
    if(session.pending!==item||!await store.has(id,item))return json({error:'missing'},409);
    if(!await store.ack(id,item,now()))return json({error:'pending'},409);
    await store.deleteFile(id,item);return json({ack:item});
  }
  return json({error:'method'},405);
 }catch(error){return json({error:error?.message==='size'?'size':'unavailable'},error?.message==='size'?413:503);}};
}
export function memoryTransferStore(){
 const sessions=new Map(),files=new Map();const key=(id,item)=>id+'/'+item;
 return {async create(s){if(sessions.size>=8)return false;sessions.set(s.id,{...s});return true;},async get(id){const s=sessions.get(id);return s?{...s}:null;},async claim(id,item,now){const s=sessions.get(id);if(!s||s.expires<=now||s.count>=MAX_FILES||(s.pending&&s.pending!==item))return false;s.pending=item;return true;},async put(id,item,data){if([...files.values()].reduce((n,b)=>n+b.length,0)+data.length>64*1024*1024)throw new Error('capacity');if(!files.has(key(id,item)))files.set(key(id,item),data);},async has(id,item){return files.has(key(id,item));},async file(id,item){return files.get(key(id,item));},async deleteFile(id,item){files.delete(key(id,item));},async ack(id,item,now){const s=sessions.get(id);if(!s||s.expires<=now||s.pending!==item)return false;s.pending=null;s.ack=item;s.count++;return true;},async remove(id){const s=sessions.get(id);if(s?.pending)files.delete(key(id,s.pending));sessions.delete(id);},async sweep(now){for(const [id,s] of sessions)if(s.expires<=now)await this.remove(id);}};
}
