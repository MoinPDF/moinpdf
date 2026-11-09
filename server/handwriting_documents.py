"""Offline modern German single-line HTR. Every result requires source review."""
import json,math,os
from pathlib import Path
import numpy as np
import pymupdf as fitz
from PIL import Image,ImageOps

def prepare(image,config):
    image=ImageOps.exif_transpose(image).convert('RGBA');background=Image.new('RGBA',image.size,'white');background.alpha_composite(image);image=background.convert('L')
    pixels=np.asarray(image)
    if pixels.size<8 or np.std(pixels)<2 or np.count_nonzero(pixels<220)<8:return None
    height=config['image_height'];width=max(1,math.floor(image.width*height/image.height+.5))
    if width>config['max_width']:raise ValueError('Die Zeile ist zu lang. In kürzere Bereiche teilen.')
    padded_width=math.ceil(width/config['output_stride'])*config['output_stride'];resized=image.resize((width,height),Image.Resampling.BILINEAR);padded=Image.new('L',(padded_width,height),255);padded.paste(resized,(0,0))
    return np.ascontiguousarray(np.asarray(padded,dtype=np.float32)[None,None,:,:]/255.0)

def decode(logits,config):
    if logits.ndim!=3 or logits.shape[0]!=1 or logits.shape[2]!=len(config['alphabet'])+1 or not np.isfinite(logits).all():raise ValueError('Ungültige Handschriftausgabe.')
    result=[];previous=None
    for index in logits[0].argmax(axis=-1):
        index=int(index)
        if index!=config['blank_index'] and index!=previous:result.append(config['alphabet'][index-1])
        previous=index
    return ''.join(result).strip()

def handwriting(source,directory):
    import onnxruntime as ort
    # Local document processing must not emit runtime telemetry. Disable before creating any session.
    ort.disable_telemetry_events()
    settings=json.loads((directory/'settings.json').read_text());lines=settings.get('lines')
    if set(settings)!={'lines'} or not isinstance(lines,list) or not 1<=len(lines)<=50:raise ValueError('Bitte 1 bis 50 einzelne Handschriftzeilen auswählen.')
    root=Path(os.getenv('MOINPDF_TOOLS','/opt/moinpdf-tools'))/'handwriting';config=json.loads((root/'config.json').read_text());options=ort.SessionOptions();options.intra_op_num_threads=1;options.inter_op_num_threads=1;options.execution_mode=ort.ExecutionMode.ORT_SEQUENTIAL
    model=ort.InferenceSession(str(root/'model.onnx'),options,providers=['CPUExecutionProvider']);results=[]
    with fitz.open(source) as doc:
        if doc.needs_pass or not 0<len(doc)<=200:raise ValueError('Bitte eine ungeschützte PDF mit höchstens 200 Seiten verwenden.')
        for item in lines:
            if not isinstance(item,dict) or set(item)!={'page','rect'} or type(item['page']) is not int or not 0<=item['page']<len(doc):raise ValueError('Ungültige Handschriftseite.')
            r=item['rect']
            if not isinstance(r,dict) or set(r)!={'x','y','w','h'} or any(type(v) not in (int,float) or not math.isfinite(v) for v in r.values()) or r['x']<0 or r['y']<0 or r['w']<=0 or r['h']<=0 or r['x']+r['w']>1.000001 or r['y']+r['h']>1.000001:raise ValueError('Ungültiger Zeilenbereich.')
            page=doc[item['page']];bounds=page.rect;clip=fitz.Rect(r['x']*bounds.width,r['y']*bounds.height,(r['x']+r['w'])*bounds.width,(r['y']+r['h'])*bounds.height);scale=min(3,3200/max(bounds.width,bounds.height));pix=page.get_pixmap(matrix=fitz.Matrix(scale,scale),clip=clip,alpha=False,colorspace=fitz.csRGB);image=Image.frombytes('RGB',(pix.width,pix.height),pix.samples);pixels=prepare(image,config)
            text='' if pixels is None else decode(model.run([config['output_name']],{config['input_name']:pixels})[0],config)
            results.append({**item,'text':text,'status':'blank' if pixels is None else 'review'})
    (directory/'report.json').write_text(json.dumps({'engine':'naeyn/de-htr-web-v2','reviewRequired':True,'lines':results,'scope':'Modern German single lines; no historical handwriting or whole-page recognition.'},ensure_ascii=False))
