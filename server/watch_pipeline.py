"""PDF steps supported by unattended input folders, run in the bounded worker."""
from __future__ import annotations
import json
import pymupdf as fitz

KINDS = {'rotate90', 'rotate180', 'reverse', 'flattenForms', 'optimizeLossless', 'metadata', 'remove-annotations'}


def validate_workflow(value):
    if not isinstance(value, dict) or value.get('version') != 1 or isinstance(value.get('version'), bool):
        raise ValueError('Ungültige Ablaufversion.')
    name, steps = value.get('name'), value.get('steps')
    if not isinstance(name, str) or not name.strip() or len(name) > 100 or not isinstance(steps, list) or not 1 <= len(steps) <= 12:
        raise ValueError('Ein Ablauf benötigt einen Namen und 1 bis 12 Schritte.')
    for step in steps:
        if not isinstance(step, dict) or step.get('kind') not in KINDS or set(step) != {'kind'}:
            raise ValueError('Dieser Ablauf enthält einen nicht unterstützten Schritt oder eine Bedingung. Bitte den Export für Eingangsordner verwenden.')
    return {'version': 1, 'name': name.strip(), 'steps': steps}


def process(source, directory):
    workflow = validate_workflow(json.loads((directory / 'workflow.json').read_text(encoding='utf-8')))
    with fitz.open(source) as document:
        if not document.is_pdf or document.needs_pass or not 0 < len(document) <= 200:
            raise ValueError('Bitte eine ungeschützte PDF mit 1 bis 200 Seiten verwenden.')
        if document.get_sigflags() > 0 or document.xref_get_key(document.pdf_catalog(), 'Perms')[0] != 'null' or any(
            widget.field_type == fitz.PDF_WIDGET_TYPE_SIGNATURE for page in document for widget in page.widgets() or []
        ):
            raise ValueError('PDFs mit Signaturfeldern werden nicht automatisch verändert.')
        if document.xref_get_key(document.pdf_catalog(), 'AcroForm/XFA')[0] != 'null':
            raise ValueError('XFA-Formulare werden nicht automatisch verändert.')
        log = []
        for step in workflow['steps']:
            kind = step['kind']
            if kind in {'rotate90', 'rotate180'}:
                angle = 90 if kind == 'rotate90' else 180
                for page in document:
                    page.set_rotation((page.rotation + angle) % 360)
            elif kind == 'reverse':
                # move_page keeps document-level objects, links and form fields.
                for index in range(len(document) - 1):
                    document.move_page(len(document) - 1, index)
            elif kind == 'metadata':
                document.set_metadata({})
                document.del_xml_metadata()
            elif kind == 'remove-annotations':
                for page in document:
                    for annotation in list(page.annots() or []):
                        page.delete_annot(annotation)
            elif kind == 'flattenForms':
                document.bake(annots=False, widgets=True)
            log.append({'step': kind, 'status': 'done'})
        document.save(directory / 'output.pdf', garbage=4, deflate=True, use_objstms=1)
        (directory / 'report.json').write_text(json.dumps({'workflow': workflow['name'], 'pages': len(document), 'steps': log}, ensure_ascii=False), encoding='utf-8')
