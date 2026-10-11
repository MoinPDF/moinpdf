import pymupdf as f

def tagged_fixture(destination):
    d=f.open();p=d.new_page();font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    content=[]
    def txt(s,x,y):
     prior=set(p.get_contents());p.insert_text((x,y),s,fontname='Noto',fontfile=font,fontsize=12);content.extend((xref,'text') for xref in p.get_contents() if xref not in prior)
    txt('Accessibility probe',40,40);txt('Original page retained.',40,65)
    prior=set(p.get_contents());p.draw_rect(f.Rect(40,85,160,110),color=None,fill=(.1,.4,.7));content.extend((xref,'figure') for xref in p.get_contents() if xref not in prior)
    txt('Name',40,150);txt('Value',220,150);txt('Alpha',40,175);txt('10',220,175)
    widget=f.Widget();widget.field_name='name';widget.field_type=f.PDF_WIDGET_TYPE_TEXT;widget.rect=f.Rect(40,200,300,230);widget.field_value='';p.add_widget(widget);widgetxref=list(p.widgets())[0].xref
    refs={}
    def obj(name,raw):
     x=d.get_new_xref();d.update_object(x,raw);refs[name]=x;return x
    tree=obj('tree','<< /Type /StructTreeRoot >>');doc=obj('doc',f'<< /Type /StructElem /S /Document /P {tree} 0 R >>')
    parents=[];mcid=0
    def elem(name,kind,parent,kids,extra=''):
     x=obj(name,f'<< /Type /StructElem /S /{kind} /P {parent} 0 R /Pg {p.xref} 0 R /K {kids} {extra} >>');return x
    h=elem('heading','H1',doc,'0');body=elem('para','P',doc,'1');fig=elem('figure','Figure',doc,'2')
    table=elem('table','Table',doc,'[]');r1=elem('r1','TR',table,'[]');r2=elem('r2','TR',table,'[]');h1=elem('h1','TH',r1,'3');h2=elem('h2','TH',r1,'4');c1=elem('c1','TD',r2,'5');c2=elem('c2','TD',r2,'6')
    form=elem('form','Form',doc,f'<< /Type /OBJR /Obj {widgetxref} 0 R /Pg {p.xref} 0 R >>');refs['widget']=widgetxref;d.xref_set_key(widgetxref,'StructParent','1')
    parents=[h,body,fig,h1,h2,c1,c2]
    d.xref_set_key(r1,'K',f'[{h1} 0 R {h2} 0 R]');d.xref_set_key(r2,'K',f'[{c1} 0 R {c2} 0 R]');d.xref_set_key(table,'K',f'[{r1} 0 R {r2} 0 R]');d.xref_set_key(doc,'K',f'[{h} 0 R {body} 0 R {fig} 0 R {table} 0 R {form} 0 R]')
    for i,(xref,kind) in enumerate(content):
     old=d.xref_stream(xref);d.update_stream(xref,f'/Span <</MCID {i}>> BDC\n'.encode()+old+b'\nEMC')
    pt=obj('parenttree','<< /Nums [0 ['+' '.join(f'{v} 0 R' for v in parents)+f'] 1 {form} 0 R] >>');d.xref_set_key(tree,'ParentTree',f'{pt} 0 R');d.xref_set_key(tree,'ParentTreeNextKey','2');d.xref_set_key(tree,'K',f'[{doc} 0 R]');d.xref_set_key(p.xref,'StructParents','0');d.xref_set_key(p.xref,'Tabs','/S')
    cat=d.pdf_catalog();d.xref_set_key(cat,'StructTreeRoot',f'{tree} 0 R');d.xref_set_key(cat,'MarkInfo','<< /Marked true >>');d.xref_set_key(cat,'Lang',f.get_pdf_str('en-US'));d.xref_set_key(cat,'ViewerPreferences','<< /DisplayDocTitle true >>');d.set_metadata({'title':'Accessibility probe'})
    d.set_xml_metadata('''<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:pdfuaid="http://www.aiim.org/pdfua/ns/id/"><pdfuaid:part>1</pdfuaid:part></rdf:Description><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">Accessibility probe</rdf:li></rdf:Alt></dc:title></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>''')
    
    for x in range(1,d.xref_length()):
     if d.xref_get_key(x,'Subtype')==('name','/CIDFontType2'):d.xref_set_key(x,'CIDToGIDMap','/Identity')
    d.save(destination);d.close();return refs
