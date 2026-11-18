/** Fixed public TSA endpoint. Only a digest request, never document contents, is forwarded. */
export async function timestampHandler(request,exchange=fetch){
 const headers={'Cache-Control':'no-store'};const url=new URL(request.url);
 if(request.method!=='POST'||request.headers.get('X-MoinPDF-Client')!=='web'||['cross-site','same-site'].includes(request.headers.get('Sec-Fetch-Site'))||(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin&&!(url.protocol==='http:'&&request.headers.get('Sec-Fetch-Site')==='same-origin'&&request.headers.get('Origin')==='https://'+url.host)))return new Response(null,{status:403,headers});
 const parts=[];let size=0;const reader=request.body?.getReader();if(!reader)return new Response(null,{status:400,headers});
 while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>4096){await reader.cancel();return new Response(null,{status:413,headers});}parts.push(r.value);}
 if(!size)return new Response(null,{status:400,headers});const body=new Uint8Array(size);let at=0;for(const p of parts){body.set(p,at);at+=p.length;}
 try{const response=await exchange('https://freetsa.org/tsr',{method:'POST',headers:{'Content-Type':'application/timestamp-query','Accept':'application/timestamp-reply'},body,signal:AbortSignal.any([request.signal,AbortSignal.timeout(20000)]),redirect:'error'});
 if(!response.ok)throw new Error();const chunks=[];let total=0;const stream=response.body.getReader();while(true){const r=await stream.read();if(r.done)break;total+=r.value.length;if(total>1024*1024){await stream.cancel();throw new Error();}chunks.push(r.value);}return new Response(new Blob(chunks),{headers:{...headers,'Content-Type':'application/timestamp-reply'}});
 }catch{return new Response('Zeitstempeldienst nicht erreichbar.',{status:502,headers});}
}
