"""Manual repair of existing tagged PDFs; never invent MCIDs or content associations."""
from __future__ import annotations
import hashlib
import io
import json
import re
from pyhanko.pdf_utils import generic as g
from pyhanko.pdf_utils.reader import PdfFileReader
from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter

ROLES = {'Document','Part','Sect','Div','P','H','H1','H2','H3','H4','H5','H6','BlockQuote','Caption','L','LI','Lbl','LBody','Table','TR','TH','TD','THead','TBody','TFoot','Span','Quote','Note','Reference','BibEntry','Code','Link','Annot','Figure','Formula','Form'}


def deref(value):
    return value.get_object() if isinstance(value,g.IndirectObject) else value


def raw(obj,key,default=None):
    try:return obj.raw_get(key)
    except KeyError:return default


def bounded_text(value,maximum):
    if not isinstance(value,str) or len(value)>maximum or re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f\ud800-\udfff]',value):
        raise ValueError('Ungültiger Text im Tag-Auftrag.')
    return value


def structure(reader):
    if getattr(reader,'prev',reader).embedded_signatures:
        raise ValueError('Diese PDF enthält digitale Signaturen. Tag-Änderungen würden deren Aussage verändern; bitte zuerst eine ausdrücklich unsignierte Arbeitskopie erstellen.')
    tree_ref=raw(reader.root,'/StructTreeRoot')
    tree=deref(tree_ref)
    if not isinstance(tree,g.DictionaryObject):
        raise ValueError('Die PDF enthält keinen vorhandenen Strukturbaum. Eine Zuordnung ungetaggter Inhalte ist in diesem Reparaturmodus nicht möglich.')
    nodes=[];mapping={};seen=set()
    def visit(reference,parent,owner=None,depth=0):
        if depth>64 or len(nodes)>=5000:raise ValueError('Der Strukturbaum überschreitet 5000 Knoten oder 64 Ebenen.')
        obj=deref(reference)
        if not isinstance(obj,g.DictionaryObject):raise ValueError('Ungültiger Strukturknoten.')
        identity=(reference.idnum,reference.generation) if isinstance(reference,g.IndirectObject) else ('direct',id(obj))
        if identity in seen:raise ValueError('Der Strukturbaum enthält zyklische oder mehrfach verwendete Knoten.')
        seen.add(identity)
        owner=reference if isinstance(reference,g.IndirectObject) else owner
        node_id='n'+str(len(nodes));children_raw=raw(obj,'/K');children=deref(children_raw)
        children=list(children) if isinstance(children,g.ArrayObject) else [] if children is None else [children_raw]
        role=str(obj.get('/S','/StructTreeRoot')).lstrip('/')
        widgets=[]
        for child in children:
            item=deref(child)
            if isinstance(item,g.DictionaryObject) and item.get('/Type')=='/OBJR':
                widget_ref=raw(item,'/Obj');widget=deref(widget_ref)
                if isinstance(widget,g.DictionaryObject) and widget.get('/Subtype')=='/Widget':
                    field_ref=widget_ref;field=widget
                    for _ in range(32):
                        if '/FT' in field or raw(field,'/Parent') is None:break
                        field_ref=raw(field,'/Parent');field=deref(field_ref)
                        if not isinstance(field,g.DictionaryObject):raise ValueError('Ungültige Formularfeldzuordnung.')
                    widgets.append((field_ref,field))
        attr=deref(raw(obj,'/A'));attrs=list(attr) if isinstance(attr,g.ArrayObject) else [attr]
        table=next((deref(a) for a in attrs if isinstance(deref(a),g.DictionaryObject) and deref(a).get('/O')=='/Table'),{})
        node={'id':node_id,'parent':parent,'depth':depth,'role':role,'alt':str(obj.get('/Alt','')),'language':str(obj.get('/Lang','')),'scope':str(table.get('/Scope','')).lstrip('/'),'rowSpan':int(table.get('/RowSpan',1)),'colSpan':int(table.get('/ColSpan',1)),'fieldLabel':str(widgets[0][1].get('/TU','')) if len(widgets)==1 else None,'children':[],'reorderable':True}
        nodes.append(node);mapping[node_id]={'object':obj,'owner':owner,'children':children,'widgets':widgets,'node':node}
        for child in children:
            item=deref(child)
            if isinstance(item,g.DictionaryObject) and (item.get('/Type')=='/StructElem' or '/S' in item):
                node['children'].append(visit(child,node_id,owner,depth+1))
            else:node['reorderable']=False
        return node_id
    visit(tree_ref,None)
    return nodes,mapping


def inspect_tags(source,directory):
    data=source.read_bytes();reader=PdfFileReader(io.BytesIO(data))
    nodes,_=structure(reader)
    (directory/'report.json').write_text(json.dumps({'digest':hashlib.sha256(data).hexdigest(),'language':str(reader.root.get('/Lang','')),'nodes':nodes},ensure_ascii=False))


def repair_tags(source,directory):
    data=source.read_bytes();options=json.loads((directory/'settings.json').read_text())
    if not isinstance(options,dict) or set(options)-{'digest','changes','language'} or options.get('digest')!=hashlib.sha256(data).hexdigest():
        raise ValueError('Der Tag-Auftrag gehört nicht zu dieser PDF. Den Strukturbaum erneut laden.')
    changes=options.get('changes')
    if not isinstance(changes,list) or len(changes)>5000:raise ValueError('Ungültiger Tag-Auftrag.')
    writer=IncrementalPdfFileWriter(io.BytesIO(data))
    # Resolve objects through this writer to register incremental updates.
    nodes,mapping=structure(writer)
    seen=set()
    for change in changes:
        if not isinstance(change,dict) or set(change)-{'id','role','alt','language','scope','rowSpan','colSpan','fieldLabel','order'} or change.get('id') not in mapping or change['id'] in seen:
            raise ValueError('Der Tag-Auftrag enthält einen unbekannten oder doppelten Knoten.')
        seen.add(change['id']);entry=mapping[change['id']];obj=entry['object'];node=entry['node']
        if 'role' in change:
            if change['role'] not in ROLES or node['role']=='StructTreeRoot':raise ValueError('Unzulässige Strukturrolle.')
            obj[g.NameObject('/S')]=g.NameObject('/'+change['role'])
        for key,pdf_key in [('alt','/Alt'),('language','/Lang')]:
            if key in change:
                value=bounded_text(change[key],2000 if key=='alt' else 64)
                if key=='language' and value and not re.fullmatch(r'[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*',value):raise ValueError('Ungültige Sprachkennung.')
                if value:obj[g.NameObject(pdf_key)]=g.TextStringObject(value)
                elif pdf_key in obj:del obj[pdf_key]
        if any(key in change for key in ('scope','rowSpan','colSpan')):
            if str(obj.get('/S')) not in {'/TH','/TD'}:raise ValueError('Tabellenattribute sind nur für TH und TD zulässig.')
            attr=deref(raw(obj,'/A'));attrs=list(attr) if isinstance(attr,g.ArrayObject) else [] if attr is None else [attr]
            table=next((deref(a) for a in attrs if isinstance(deref(a),g.DictionaryObject) and deref(a).get('/O')=='/Table'),None)
            # Replace the table attribute dictionary as a fresh direct value so
            # indirect shared attributes are not edited in other cells.
            updated=g.DictionaryObject(dict(table)) if table is not None else g.DictionaryObject({g.NameObject('/O'):g.NameObject('/Table')})
            if 'scope' in change:
                if change['scope'] not in {'','Row','Column','Both'}:raise ValueError('Ungültige Tabellenkopfzuordnung.')
                if change['scope']:updated[g.NameObject('/Scope')]=g.NameObject('/'+change['scope'])
                elif '/Scope' in updated:del updated['/Scope']
            for key,pdf_key in [('rowSpan','/RowSpan'),('colSpan','/ColSpan')]:
                if key in change:
                    value=change[key]
                    if isinstance(value,bool) or not isinstance(value,int) or not 1<=value<=1000:raise ValueError('Ungültige Zellenspanne.')
                    updated[g.NameObject(pdf_key)]=g.NumberObject(value)
            kept=[a for a in attrs if not (isinstance(deref(a),g.DictionaryObject) and deref(a).get('/O')=='/Table')]
            obj[g.NameObject('/A')]=g.ArrayObject(kept+[updated]) if kept else updated
        if 'fieldLabel' in change:
            if len(entry['widgets'])!=1:raise ValueError('Keine eindeutige Formularfeldzuordnung für diesen Tag.')
            field_ref,field=entry['widgets'][0];field[g.NameObject('/TU')]=g.TextStringObject(bounded_text(change['fieldLabel'],2000))
            if isinstance(field_ref,g.IndirectObject):writer.mark_update(field_ref)
            else:raise ValueError('Das Formularfeld kann nicht sicher einzeln aktualisiert werden.')
        if 'order' in change:
            order=change['order']
            if not node['reorderable'] or not isinstance(order,list) or any(not isinstance(key,str) for key in order) or len(order)!=len(node['children']) or set(order)!=set(node['children']):
                raise ValueError('Die Lesereihenfolge muss alle vorhandenen Kinder genau einmal enthalten.')
            by_id=dict(zip(node['children'],entry['children']))
            obj[g.NameObject('/K')]=g.ArrayObject([by_id[key] for key in order])
        if not entry['owner']:raise ValueError('Der Strukturknoten besitzt keinen aktualisierbaren Objektverweis.')
        writer.mark_update(entry['owner'])
    if 'language' in options:
        language=bounded_text(options['language'],64)
        if not re.fullmatch(r'[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*',language):raise ValueError('Ungültige Dokumentsprache.')
        writer.root[g.NameObject('/Lang')]=g.TextStringObject(language);writer.update_root()
    with (directory/'output.pdf').open('wb') as stream:writer.write(stream)
    (directory/'changes.json').write_text(json.dumps({'changedNodes':len(changes),'pageContentsUnchanged':True,'humanChecksRequired':True},ensure_ascii=False))
