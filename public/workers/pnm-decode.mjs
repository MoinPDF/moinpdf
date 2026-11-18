/** Netpbm P1–P7 decoder. Bounded before allocation; binary raster bytes are never whitespace-trimmed. */
export function decodePnm(bytes) {
  let at=0;
  const fail=()=>{throw new Error('Ungültige oder nicht unterstützte PNM/PAM-Datei.');};
  const white=b=>[9,10,11,12,13,32].includes(b);
  const token=()=>{
    while(at<bytes.length){if(white(bytes[at]))at++;else if(bytes[at]===35){while(at<bytes.length&&bytes[at]!==10&&bytes[at]!==13)at++;}else break;}
    const start=at;while(at<bytes.length&&!white(bytes[at])&&bytes[at]!==35)at++;
    if(at===start)fail();return new TextDecoder().decode(bytes.subarray(start,at));
  };
  const number=()=>{const s=token();if(!/^\d{1,8}$/.test(s))fail();return Number(s);};
  const kind=token();if(!/^P[1-7]$/.test(kind))fail();
  let width,height,max=1,depth=1;
  if(kind==='P7'){
    const values={};let end=false;
    while(at<bytes.length){let start=at;while(at<bytes.length&&bytes[at]!==10)at++;const line=new TextDecoder().decode(bytes.subarray(start,at++)).replace(/#.*/,'').trim();if(!line)continue;
      if(line==='ENDHDR'){end=true;break;}const pair=line.match(/^(WIDTH|HEIGHT|DEPTH|MAXVAL|TUPLTYPE)\s+(.+)$/);if(!pair||values[pair[1]]!==undefined)fail();values[pair[1]]=pair[2];if(at>4096)fail();}
    if(!end)fail();for(const k of ['WIDTH','HEIGHT','DEPTH','MAXVAL'])if(!/^\d{1,8}$/.test(values[k]||''))fail();
    width=Number(values.WIDTH);height=Number(values.HEIGHT);depth=Number(values.DEPTH);max=Number(values.MAXVAL);
    const tuples={BLACKANDWHITE:1,GRAYSCALE:1,RGB:3,BLACKANDWHITE_ALPHA:2,GRAYSCALE_ALPHA:2,RGB_ALPHA:4};
    if(values.TUPLTYPE && tuples[values.TUPLTYPE]!==depth)fail();if(values.TUPLTYPE?.startsWith('BLACKANDWHITE')&&max!==1)fail();
  }else{
    width=number();height=number();if(!['P1','P4'].includes(kind))max=number();depth=['P3','P6'].includes(kind)?3:1;
    if(['P4','P5','P6'].includes(kind)){if(!white(bytes[at]))fail();const b=bytes[at++];if(b===13&&bytes[at]===10)at++;}
  }
  if(width<1||height<1||width*height>40000000||max<1||max>65535||![1,2,3,4].includes(depth))fail();
  const ascii=['P1','P2','P3'].includes(kind),bit=kind==='P4',size=max>255?2:1;
  if(!ascii && bytes.length-at < (bit?Math.ceil(width/8)*height:width*height*depth*size))fail();
  const data=new Uint8ClampedArray(width*height*4);
  const sample=()=>{let v;if(ascii)v=number();else{v=bytes[at++];if(size===2)v=v*256+bytes[at++];}if(v>max)fail();return Math.round(v*255/max);};
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4;
    if(bit){const v=(bytes[at+y*Math.ceil(width/8)+(x>>3)]>>(7-(x&7)))&1;data[i]=data[i+1]=data[i+2]=v?0:255;data[i+3]=255;}
    else{const a=sample();if(depth<=2){data[i]=data[i+1]=data[i+2]=kind==='P1'?255-a:a;data[i+3]=depth===2?sample():255;}
      else{data[i]=a;data[i+1]=sample();data[i+2]=sample();data[i+3]=depth===4?sample():255;}}
  }
  return {width,height,data};
}
