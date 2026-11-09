"""PDF/X-3:2002 conversion with independent technical checks, not full ISO validation."""
import io,json,math,subprocess
from pathlib import Path
from PIL import ImageCms
from pypdf import PdfReader,PdfWriter
from pypdf.generic import NameObject,RectangleObject

def icc_profile(data):
    if not 128<=len(data)<=4*1024*1024 or int.from_bytes(data[:4],'big')!=len(data) or data[36:40]!=b'acsp' or data[12:16]!=b'prtr' or data[16:20]!=b'CMYK' or data[20:24] not in (b'XYZ ',b'Lab '):raise ValueError('Ein gültiges CMYK-Druckerprofil auswählen.')
    try:return ImageCms.getProfileDescription(ImageCms.ImageCmsProfile(io.BytesIO(data))).strip()
    except Exception:raise ValueError('Das ICC-Profil konnte nicht gelesen werden.') from None

def default_profile():
    for path in [Path('/usr/share/color/icc/ghostscript/default_cmyk.icc'),*Path('/usr/share/ghostscript').glob('*/iccprofiles/default_cmyk.icc')]:
        if path.is_file():return path.read_bytes()
    raise ValueError('Das standardmäßige CMYK-Profil fehlt. Ein Druckereiprofil hochladen.')

def check_pdfx(path,profile,pages):
    reader=PdfReader(path);errors=[]
    def require(condition,label):
        if not condition:errors.append(label)
    require(reader.pdf_header=='%PDF-1.3','PDF 1.3');require(not reader.is_encrypted,'No encryption');require(len(reader.pages)==pages,'Page count')
    info=reader.metadata or {};require(info.get('/GTS_PDFXVersion')=='PDF/X-3:2002','PDF/X declaration');require(str(info.get('/Trapped')) in ('/True','/False'),'Trapped');require(bool(info.get('/CreationDate')) and bool(info.get('/ModDate')),'Dates');require(bool(reader.trailer.get('/ID')),'Document ID')
    root=reader.trailer['/Root'];require(not any(root.get(k) for k in ('/OpenAction','/AA','/AcroForm','/Collection')),'No active catalog')
    intents=root.get('/OutputIntents',[]);matches=[]
    for raw in intents:
        intent=raw.get_object();icc=intent.get('/DestOutputProfile')
        if intent.get('/S')=='/GTS_PDFX' and icc:
            icc=icc.get_object();matches.append(icc.get('/N')==4 and icc.get_data()==profile)
    require(len(matches)==1 and matches[0],'Exact embedded CMYK output profile')
    visited=set()
    def resources(res,depth=0):
        if depth>30:errors.append('Nested resource depth');return
        res=res.get_object() if hasattr(res,'get_object') else res;identity=id(res)
        if identity in visited:return
        visited.add(identity)
        for f in res.get('/Font',{}).get_object().values() if hasattr(res.get('/Font',{}),'get_object') else res.get('/Font',{}).values():
            f=f.get_object();fonts=[n.get_object() for n in f.get('/DescendantFonts',[])] or [f]
            for font in fonts:
                descriptor=font.get('/FontDescriptor');descriptor=descriptor.get_object() if descriptor else {}
                require(font.get('/Subtype')=='/Type3' or any(descriptor.get(k) for k in ('/FontFile','/FontFile2','/FontFile3')),'Embedded fonts')
        states=res.get('/ExtGState',{});states=states.get_object() if hasattr(states,'get_object') else states
        for state in states.values():
            state=state.get_object();require(state.get('/ca',1)==1 and state.get('/CA',1)==1 and str(state.get('/SMask','/None'))=='/None' and str(state.get('/BM','/Normal')) in ('/Normal','/Compatible'),'No transparency')
        xobjects=res.get('/XObject',{});xobjects=xobjects.get_object() if hasattr(xobjects,'get_object') else xobjects
        for obj in xobjects.values():
            obj=obj.get_object();require(not obj.get('/SMask') and not obj.get('/Ref') and not obj.get('/OPI'),'No soft masks or external references')
            group=obj.get('/Group');require(not group or group.get_object().get('/S')!='/Transparency','No transparency group')
            if obj.get('/Resources'):resources(obj['/Resources'],depth+1)
    for p in reader.pages:
        require(not p.get('/Annots'),'No annotations');boxes=[]
        for k in ('/MediaBox','/BleedBox','/TrimBox'):
            b=p.get(k);valid=b is not None and len(b)==4 and all(math.isfinite(float(n)) for n in b) and float(b[2])>float(b[0]) and float(b[3])>float(b[1]);require(valid,k)
            boxes.append([float(n) for n in b] if valid else None)
        if all(boxes):
            for outer,inner in zip(boxes,boxes[1:]):require(outer[0]<=inner[0] and outer[1]<=inner[1] and outer[2]>=inner[2] and outer[3]>=inner[3],'Nested page boxes')
        group=p.get('/Group');require(not group or group.get_object().get('/S')!='/Transparency','No page transparency');resources(p.get('/Resources',{}))
    return {'technicalChecksPassed':not errors,'isoConformanceVerified':False,'engine':'pypdf','checksFailed':sorted(set(errors)),'profile':'PDF/X-3:2002','scope':'Technical partial checks only. No full ISO PDF/X certification or press approval.'}

def pdfx(source,directory):
    settings=json.loads((directory/'settings.json').read_text());trim=settings.get('trimInsetMm',0);allow=settings.get('allowFontSubstitution',False)
    if set(settings)-{'trimInsetMm','allowFontSubstitution'} or type(trim) not in (int,float) or not math.isfinite(trim) or not 0<=trim<=20 or type(allow) is not bool:raise ValueError('Ungültige Druckeinstellungen.')
    profile=(directory/'custom.icc').read_bytes() if (directory/'custom.icc').exists() else default_profile();label=icc_profile(profile);(directory/'output.icc').write_bytes(profile)
    import pymupdf as fitz
    with fitz.open(source) as doc:
        if doc.needs_pass or not 0<len(doc)<=200:raise ValueError('Bitte eine ungeschützte PDF mit 1 bis 200 Seiten verwenden.')
        if not allow and any(not doc.extract_font(f[0])[3] for p in doc for f in p.get_fonts(full=True) if f[0]):raise ValueError('Nicht eingebettete Schriften gefunden. Ersetzung ausdrücklich erlauben oder Schriften vorher einbetten.')
    reader=PdfReader(source);writer=PdfWriter(clone_from=reader)
    for key in ('/OpenAction','/AA','/AcroForm','/Collection','/Names'):
        if key in writer.root_object:del writer.root_object[key]
    margin=trim*72/25.4
    for p in writer.pages:
        p.transfer_rotation_to_content();box=p.cropbox;p.mediabox=RectangleObject(box);p.bleedbox=RectangleObject(box)
        if box.width<=2*margin or box.height<=2*margin:raise ValueError('Der Beschnitt lässt kein Endformat übrig.')
        p.trimbox=RectangleObject([box.left+margin,box.bottom+margin,box.right-margin,box.top-margin]);
        if '/Annots' in p:del p['/Annots']
    writer.write(directory/'prepared.pdf')
    definition='''%!PS
[/GTS_PDFXVersion (PDF/X-3:2002) /Trapped /False /DOCINFO pdfmark
[/_objdef {icc} /type /stream /OBJ pdfmark
[{icc} << /N 4 >> /PUT pdfmark
[{icc} (output.icc) (r) file /PUT pdfmark
[/_objdef {intent} /type /dict /OBJ pdfmark
[{intent} << /Type /OutputIntent /S /GTS_PDFX /OutputConditionIdentifier (Custom CMYK) /Info (Embedded printer profile) /DestOutputProfile {icc} >> /PUT pdfmark
[{Catalog} << /OutputIntents [ {intent} ] >> /PUT pdfmark
'''
    (directory/'pdfx.ps').write_text(definition)
    args=['gs','-q','-dSAFER','--permit-file-read=output.icc','-dBATCH','-dNOPAUSE','-sDEVICE=pdfwrite','-dPDFX','-dCompatibilityLevel=1.3','-dPDFXCompatibilityPolicy=2','-sColorConversionStrategy=CMYK','-sProcessColorModel=DeviceCMYK','-dEmbedAllFonts=true','-r300','-sOutputFile=output.pdf','pdfx.ps','prepared.pdf']
    try:subprocess.run(args,cwd=directory,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True,timeout=160)
    except (subprocess.CalledProcessError,subprocess.TimeoutExpired):raise ValueError('Die PDF/X-Erstellung ist fehlgeschlagen. Schriften, Transparenzen und Druckprofil prüfen.') from None
    if not (directory/'output.pdf').is_file() or not 0<(directory/'output.pdf').stat().st_size<=80*1024*1024:raise ValueError('Die Druckdatei ist leer oder zu groß.')
    report=check_pdfx(directory/'output.pdf',profile,len(reader.pages));report.update(iccProfile=label,trimInsetMm=trim,fontSubstitutionAllowed=allow,note='CMYK conversion can change colors. Transparency may rasterize. No missing bleed content is invented. Links, forms, annotations and attachments are removed. Printer approval required.')
    if not report['technicalChecksPassed']:raise ValueError('Die erzeugte Datei hat die unabhängige technische Teilprüfung nicht bestanden.')
    (directory/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
