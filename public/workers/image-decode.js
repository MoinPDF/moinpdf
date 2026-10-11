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
      const psd=self.agPsd.readPsd(bytes,{skipLayerImageData:true,skipThumbnail:true,skipLinkedFilesData:true,useImageData:true,totalMemoryLimit:240*1024*1024});
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
    } else throw new Error('Unbekanntes Bildformat.');
    check(output.width,output.height);
    if(output.data.length!==output.width*output.height*4)throw new Error('Unvollständige Bilddaten.');
    self.postMessage({width:output.width,height:output.height,rgba:output.data.buffer},[output.data.buffer]);
  } catch(error){self.postMessage({error:error instanceof Error?error.message:'Das Bild konnte nicht gelesen werden.'});}
};
