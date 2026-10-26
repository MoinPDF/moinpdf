/* File-backed inputs. Each operation owns and destroys one QPDF WASM instance. */
importScripts('/vendor/qpdf/qpdf.js');
self.onmessage = async ({ data }) => {
  let engine, printed = '', tooMuch = false;
  const capture = line => { if (printed.length + line.length > 16*1024*1024) {tooMuch=true;throw Error('large');} printed += line+'\n'; };
  self.console.log = capture;
  self.console.error = () => {};
  try {
    if (!['inspect','extract','assemble'].includes(data.operation) || !Array.isArray(data.files) ||
      !data.files.length || data.files.length > 1001 || data.files.some(file => !(file instanceof Blob) || file.size > 256*1024*1024)) throw Error('invalid');
    engine = await Module({ locateFile: () => '/vendor/qpdf/qpdf.wasm',
      print: capture, printErr: () => {} });
    engine.FS.mkdir('/source');
    engine.FS.mount(engine.WORKERFS,{blobs:data.files.map((file,index)=>({name:`${index}.pdf`,data:file}))},'/source');
    let args;
    if(data.operation==='inspect') args=['/source/0.pdf','--json=2','--json-key=qpdf','--json-key=encrypt','--json-key=acroform','--json-key=pages','--json-stream-data=none'];
    else if(data.operation==='extract') {
      if(!Number.isInteger(data.first)||!Number.isInteger(data.last)||data.first<1||data.last<data.first||data.last>1000||data.last-data.first>=50)throw Error('invalid');
      args=['--empty','--pages','/source/0.pdf',`${data.first}-${data.last}`,'--','--object-streams=generate','/output.pdf'];
    } else args=['--empty','--pages',...data.files.flatMap((_,i)=>[`/source/${i}.pdf`,'1-z']),'--','--object-streams=generate','/output.pdf'];
    const code=engine.callMain(args);
    if(tooMuch||code!==0)throw Error('invalid');
    if(data.operation==='inspect') self.postMessage({json:JSON.parse(printed)});
    else {
      if(engine.FS.stat('/output.pdf').size > (data.operation==='extract'?64:256)*1024*1024) throw Error('size');
      const bytes=engine.FS.readFile('/output.pdf').slice();
      self.postMessage({bytes},[bytes.buffer]);
    }
  } catch(error) { self.postMessage({error:error.message==='size'?'size':'invalid'}); }
  finally { if(engine)try{engine.FS.unmount('/source');}catch{}self.close(); }
};
