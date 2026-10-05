/* One isolated WASM instance per operation. No network access beyond same-origin engine assets. */
importScripts('/vendor/qpdf/qpdf.js');
self.onmessage=async({data})=>{
 let qpdf;
 let errors='';
 self.console.log=()=>{};
 self.console.error=(...parts)=>{if(errors.length<4000)errors+=parts.join(' ')+'\n';};
 try{
  qpdf=await Module({locateFile:()=>'/vendor/qpdf/qpdf.wasm',print:()=>{},printErr:s=>{if(errors.length<4000)errors+=s+'\n';}});
  qpdf.FS.writeFile('/input.pdf',data.bytes);data.bytes.fill(0);
  const {password='',ownerPassword='',printing='full',copying=true,editing=true}=data.settings;
  const args=data.operation==='encrypt'?['/input.pdf','--encrypt',`--user-password=${password}`,`--owner-password=${ownerPassword}`,'--bits=256',`--print=${printing}`,`--extract=${copying?'y':'n'}`,`--modify=${editing?'all':'none'}`,'--','/output.pdf']:['/input.pdf',`--password=${password}`,'--decrypt','/output.pdf'];
  const code=qpdf.callMain(args);args.fill('');data.settings={};
  if(code!==0&&code!==3)throw new Error(/invalid password|incorrect password/i.test(errors)?'password':'invalid');
  const bytes=qpdf.FS.readFile('/output.pdf').slice();
  self.postMessage({bytes},[bytes.buffer]);
 }catch(error){self.postMessage({error:error.message==='password'?'password':'invalid'});}
 finally{if(qpdf)for(const path of ['/input.pdf','/output.pdf'])try{const bytes=qpdf.FS.readFile(path);bytes.fill(0);qpdf.FS.writeFile(path,bytes);qpdf.FS.unlink(path);}catch{}self.close();}
};
