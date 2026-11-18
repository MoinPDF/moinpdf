/* Local image decoding in a disposable worker. No external document requests. */
self.onmessage = async ({data}) => {
  try {
    const bytes=new Uint8Array(data.bytes);
    const limit=40000000;
    const check=(width,height)=>{
      if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>limit) throw new Error('Das Bild darf höchstens 40 Megapixel haben.');
    };
    let output;
    if(data.kind==='psd'){
      const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
      if(bytes.length<26 || String.fromCharCode(...bytes.subarray(0,4))!=='8BPS' || view.getUint16(4)!==1 || view.getUint16(22)!==8 || ![1,3].includes(view.getUint16(24)))
        throw new Error('PSD-Import unterstützt RGB- und Graustufenbilder mit 8 Bit und gespeichertem Gesamtbild. CMYK, Lab und PSB bitte zuvor als PNG oder TIFF exportieren.');
      check(view.getUint32(18),view.getUint32(14));
      importScripts('/vendor/images/ag-psd.js');
      self.agPsd.initializeCanvas(()=>{throw new Error('PSD enthält nicht unterstützte Bilddaten.');},(width,height)=>{check(width,height);return {width,height,data:new Uint8ClampedArray(width*height*4)};});
      const psd=self.agPsd.readPsd(bytes,{skipLayerImageData:true,skipThumbnail:true,skipLinkedFilesData:true,useImageData:true,strict:true,totalMemoryLimit:240*1024*1024});
      if(!psd.imageData)throw new Error('Die PSD enthält kein gespeichertes Gesamtbild. Bitte in Photoshop mit maximaler Kompatibilität speichern.');
      output=psd.imageData;
    } else if(data.kind==='heic'){
      if(bytes.length<16 || String.fromCharCode(...bytes.subarray(4,8))!=='ftyp')throw new Error('Keine gültige HEIC/HEIF-Datei.');
      importScripts('/vendor/images/libheif.js');
      const module=await libheif({locateFile:name=>'/vendor/images/'+name});
      const decoder=new module.HeifDecoder(),images=decoder.decode(bytes);
      try{
        if(!images.length)throw new Error('Das HEIC-Bild konnte nicht gelesen werden.');
        const primary=images.find(image=>image.is_primary())||images[0],width=primary.get_width(),height=primary.get_height();check(width,height);
        output=await new Promise((resolve,reject)=>primary.display({width,height,data:new Uint8ClampedArray(width*height*4)},value=>value?resolve(value):reject(new Error('HEIC-Bilddaten konnten nicht decodiert werden.'))));
      } finally {for(const image of images)image.free();}
    } else if(data.kind==='pnm'){
      output=(await import('./pnm-decode.mjs')).decodePnm(bytes);
    } else if(data.kind==='jp2'){
      const {JpxImage}=await import('/vendor/images/pdf.image_decoders.mjs');
      const {width,height,componentsCount}=JpxImage.parseImageProperties(bytes);check(width,height);
      if(![1,3].includes(componentsCount))throw new Error('JPEG 2000: nicht unterstützte Farbkanäle.');
      JpxImage.setOptions({useWasm:true,useWorkerFetch:true,wasmUrl:'/vendor/pdf/wasm/'});
      const pixels=await JpxImage.instance.decode(bytes,{numComponents:componentsCount});
      if(pixels.length!==width*height*componentsCount)throw new Error('Unvollständige Bilddaten.');
      const rgba=new Uint8ClampedArray(width*height*4);for(let p=0,i=0;p<pixels.length;p+=componentsCount,i+=4){rgba[i]=pixels[p];rgba[i+1]=pixels[p+(componentsCount===1?0:1)];rgba[i+2]=pixels[p+(componentsCount===1?0:2)];rgba[i+3]=255;}output={width,height,data:rgba};
    } else if(data.kind==='jxr'){
      // Validate TIFF-like JPEG XR dimensions before invoking the WASM decoder.
      const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
      if(bytes.length<8||view.getUint32(0,true)!==0x01bc4949)throw new Error('Ungültige JPEG-XR-Datei.');
      const ifd=view.getUint32(4,true);if(ifd+2>bytes.length)throw new Error('Ungültige JPEG-XR-Datei.');
      const count=view.getUint16(ifd,true);if(count>512||ifd+2+count*12>bytes.length)throw new Error('Ungültige JPEG-XR-Datei.');
      let w=0,h=0;for(let n=0;n<count;n++){const p=ifd+2+n*12,tag=view.getUint16(p,true);if(tag===0xbc80||tag===0xbc81){const type=view.getUint16(p+2,true);if(view.getUint32(p+4,true)!==1||![3,4].includes(type))throw new Error('Ungültige JPEG-XR-Bildgröße.');const value=type===3?view.getUint16(p+8,true):view.getUint32(p+8,true);if(tag===0xbc80)w=value;else h=value;}}
      check(w,h);const {default:decode}=await import('/vendor/images/jxr/decode.js');output=await decode(bytes.buffer);
      if(output.width!==w||output.height!==h)throw new Error('JPEG-XR-Bildgröße stimmt nicht überein.');
    } else throw new Error('Unbekanntes Bildformat.');
    check(output.width,output.height);
    if(output.data.length!==output.width*output.height*4)throw new Error('Unvollständige Bilddaten.');
    self.postMessage({width:output.width,height:output.height,rgba:output.data.buffer},[output.data.buffer]);
  } catch(error){self.postMessage({error:error instanceof Error?error.message:'Das Bild konnte nicht gelesen werden.'});}
};
