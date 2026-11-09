"""Bounded unattended workflows: literal conditions, OCR, splitting and safe routing."""
from __future__ import annotations
import datetime,json,re,subprocess
import pymupdf as fitz
KINDS={'rotate90','rotate180','reverse','flattenForms','optimizeLossless','metadata','remove-annotations','ocr','removeBlank'}
def validate_workflow(v):
    if not isinstance(v,dict) or isinstance(v.get('version'),bool) or v.get('version') not in (1,2):raise ValueError('Ungültige Ablaufversion.')
    if set(v)-{'version','name','steps','split','routes','filename'}:raise ValueError('Unbekannte Ablaufeinstellungen.')
    name,steps=v.get('name'),v.get('steps')
    if not isinstance(name,str) or not name.strip() or len(name)>100 or not isinstance(steps,list) or not 1<=len(steps)<=12:raise ValueError('Ein Ablauf benötigt einen Namen und 1 bis 12 Schritte.')
    for s in steps:
        if not isinstance(s,dict) or s.get('kind') not in KINDS or set(s)-{'kind','condition','otherwise'}:raise ValueError('Nicht unterstützter Ablaufschritt.')
        if 'otherwise' in s and (not isinstance(s['otherwise'],dict) or set(s['otherwise'])!={'kind'} or s['otherwise']['kind'] not in KINDS or 'condition' not in s):raise ValueError('Ungültiger Sonst-Schritt.')
        if 'condition' in s:
            c=s['condition']
            if not isinstance(c,dict) or set(c)!={'field','operator','value'} or not isinstance(c['value'],str) or not 0<len(c['value'])<=200:raise ValueError('Ungültige Bedingung.')
            if c['field']=='pages':
                if c['operator'] not in {'gte','lt'} or not c['value'].isdigit() or not 0<=int(c['value'])<=1000:raise ValueError('Ungültige Seitenbedingung.')
            elif c['field'] not in {'filename','text'} or c['operator'] not in {'contains','notContains'}:raise ValueError('Ungültige Textbedingung.')
    result={'version':v['version'],'name':name.strip(),'steps':steps}
    if v['version']==1:
        if set(v)-{'version','name','steps'}:raise ValueError('Trennung und Ablage benötigen Ablaufversion 2.')
        return result
    split=v.get('split',{'mode':'none'});routes=v.get('routes',[]);filename=v.get('filename','{original}-{part}')
    if not isinstance(split,dict) or set(split)-{'mode','text'} or split.get('mode') not in {'none','page','text'} or not isinstance(split.get('text',''),str) or len(split.get('text',''))>200 or split['mode']=='text' and not split.get('text','').strip():raise ValueError('Ungültige Dokumenttrennung.')
    if not isinstance(routes,list) or len(routes)>20:raise ValueError('Höchstens 20 Ablageregeln verwenden.')
    for r in routes:
        if not isinstance(r,dict) or set(r)!={'contains','folder'} or not isinstance(r['contains'],str) or not r['contains'].strip() or len(r['contains'])>200 or not isinstance(r['folder'],str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,64}',r['folder']):raise ValueError('Ungültige Ablageregel.')
    if not isinstance(filename,str) or not 0<len(filename)<=120 or re.search(r'[<>:"/\\|?*\x00-\x1f]',filename) or '..' in filename or re.search(r'\{(?!original\}|date\}|part\}|invoice\})',filename) or re.sub(r'\{(?:original|date|part|invoice)\}','',filename).count('}'):raise ValueError('Ungültiges Dateinamensmuster.')
    result.update(split=split,routes=routes,filename=filename);return result
def applies(c,doc,filename):
    if not c:return True
    field,op,value=c['field'],c['operator'],c['value']
    if field=='pages':return len(doc)>=int(value) if op=='gte' else len(doc)<int(value)
    content=filename if field=='filename' else '\n'.join(p.get_text() for p in doc)
    match=value.casefold() in content.casefold();return match if op=='contains' else not match
def step(doc,kind,directory):
    report={'step':kind,'status':'done'}
    if kind in {'rotate90','rotate180'}:
        for page in doc:page.set_rotation((page.rotation+(90 if kind=='rotate90' else 180))%360)
    elif kind=='reverse':
        for index in range(len(doc)-1):doc.move_page(len(doc)-1,index)
    elif kind=='metadata':doc.set_metadata({});doc.del_xml_metadata()
    elif kind=='remove-annotations':
        for page in doc:
            for annot in list(page.annots() or []):page.delete_annot(annot)
    elif kind=='flattenForms':doc.bake(annots=False,widgets=True)
    elif kind=='removeBlank':
        blank=[]
        for page in doc:
            if page.get_text().strip() or page.first_annot or page.first_widget:continue
            scale=min(1,3200/max(page.rect.width,page.rect.height));pix=page.get_pixmap(matrix=fitz.Matrix(scale,scale),colorspace=fitz.csGRAY,alpha=False)
            if min(pix.samples,default=255)>=250:blank.append(page.number)
        if len(blank)==len(doc):raise ValueError('Die Ausgabe darf nicht ausschließlich aus entfernten Leerseiten bestehen.')
        for i in reversed(blank):doc.delete_page(i)
        report['removedPages']=[n+1 for n in blank]
    elif kind=='ocr':
        recognized=[]
        for i in range(len(doc)):
            page=doc[i]
            if len(page.get_text().strip())>=8:continue
            if page.first_annot or page.first_widget:raise ValueError('Scan-Seiten mit Formularen oder Anmerkungen vor OCR manuell prüfen.')
            scale=min(3,3200/max(page.rect.width,page.rect.height));png=directory/'watch-ocr.png';target=directory/'watch-ocr';page.get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=False).save(png)
            try:subprocess.run(['tesseract',str(png),str(target),'-l','deu+eng','--psm','3','pdf'],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,check=True,timeout=90)
            except (subprocess.CalledProcessError,subprocess.TimeoutExpired):raise ValueError('OCR fehlgeschlagen. Scanqualität und Sprachpakete prüfen.') from None
            with fitz.open(str(target)+'.pdf') as scanned:
                if len(scanned)!=1:raise ValueError('OCR hat kein eindeutiges Seitenergebnis geliefert.')
                width,height=page.rect.width,page.rect.height
                with fitz.open() as replacement:
                    replacement.new_page(width=width,height=height).show_pdf_page(fitz.Rect(0,0,width,height),scanned,0)
                    doc.delete_page(i);doc.insert_pdf(replacement,start_at=i)
            recognized.append(i+1);png.unlink(missing_ok=True);(directory/'watch-ocr.pdf').unlink(missing_ok=True)
        report['ocrPages']=recognized
    return report
def output_name(template,original,text,part):
    numbers=set(re.findall(r'(?:Rechnungsnummer|Rechnung-Nr\.?|Invoice number)\s*:?\s*([A-Za-z0-9][A-Za-z0-9_/-]{1,60})',text,re.I));dates=set()
    for raw in re.findall(r'\b\d{4}-\d{2}-\d{2}\b|\b\d{2}\.\d{2}\.\d{4}\b',text):
        try:dates.add(datetime.datetime.strptime(raw,'%Y-%m-%d' if '-' in raw else '%d.%m.%Y').date().isoformat())
        except ValueError:pass
    values={'original':original,'date':next(iter(dates)) if len(dates)==1 else 'ohne-Datum','invoice':next(iter(numbers)) if len(numbers)==1 else 'ohne-Nummer','part':f'{part:03d}'}
    for key,value in values.items():template=template.replace('{'+key+'}',value)
    return (re.sub(r'[^\w.-]','_',template).strip(' .')[:150] or f'Dokument-{part:03d}')+'.pdf'
def process(source,directory):
    flow=validate_workflow(json.loads((directory/'workflow.json').read_text(encoding='utf-8')))
    filename=(directory/'source-name.txt').read_text() if (directory/'source-name.txt').exists() else source.name
    with fitz.open(source) as doc:
        if not doc.is_pdf or doc.needs_pass or not 0<len(doc)<=200:raise ValueError('Bitte eine ungeschützte PDF mit 1 bis 200 Seiten verwenden.')
        if doc.get_sigflags()>0 or doc.xref_get_key(doc.pdf_catalog(),'Perms')[0]!='null' or any(w.field_type==fitz.PDF_WIDGET_TYPE_SIGNATURE for p in doc for w in p.widgets() or []):raise ValueError('PDFs mit Signaturfeldern werden nicht automatisch verändert.')
        if doc.xref_get_key(doc.pdf_catalog(),'AcroForm/XFA')[0]!='null':raise ValueError('XFA-Formulare werden nicht automatisch verändert.')
        log=[]
        for item in flow['steps']:
            kind=item['kind'] if applies(item.get('condition'),doc,filename) else item.get('otherwise',{}).get('kind')
            log.append(step(doc,kind,directory) if kind else {'step':item['kind'],'status':'skipped'})
        report={'workflow':flow['name'],'pages':len(doc),'steps':log}
        if flow['version']==1:doc.save(directory/'output.pdf',garbage=4,deflate=True,use_objstms=1)
        else:
            split=flow['split'];starts=[0]
            for n in range(1,len(doc)):
                if split['mode']=='page' or split['mode']=='text' and split['text'].casefold() in doc[n].get_text().casefold():starts.append(n)
            starts.append(len(doc));outputs=[];total=0
            for index,(first,last) in enumerate(zip(starts,starts[1:]),1):
                text='\n'.join(doc[n].get_text() for n in range(first,last));folders={r['folder'] for r in flow['routes'] if r['contains'].casefold() in text.casefold()};folder=next(iter(folders)) if len(folders)==1 else 'Pruefen' if folders else 'Unsortiert'
                name=output_name(flow['filename'],filename.rsplit('.',1)[0],text,index);file=f'part-{index:03d}.pdf'
                with fitz.open() as part:part.insert_pdf(doc,from_page=first,to_page=last-1);part.save(directory/file,garbage=4,deflate=True,use_objstms=1)
                total+=(directory/file).stat().st_size
                if total>80*1024*1024:raise ValueError('Die Gesamtausgabe überschreitet 80 MB.')
                outputs.append({'file':file,'name':name,'folder':folder,'pages':[first+1,last]})
            report['outputs']=outputs
        (directory/'report.json').write_text(json.dumps(report,ensure_ascii=False),encoding='utf-8')
