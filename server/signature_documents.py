"""Explicit-trust PAdES validation with offline revocation evidence."""
from __future__ import annotations
import asyncio
import io
import os
import uuid
from pathlib import Path
from urllib.parse import urlsplit
from asn1crypto import crl,ocsp
from pyhanko.keys import load_certs_from_pemder
from pyhanko.pdf_utils.reader import PdfFileReader
from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
from pyhanko.sign import signers
from pyhanko.sign.fields import SigSeedSubFilter
from pyhanko.sign.timestamps import HTTPTimeStamper
from pyhanko.sign.validation import validate_pdf_signature
from pyhanko.sign.validation.dss import DocumentSecurityStore,NoDSSFoundError
from pyhanko.sign.validation.ades import ades_lta_validation
from pyhanko.sign.validation.policy_decl import PdfSignatureValidationSpec,SignatureValidationSpec,RevocationInfoGatheringSpec,RevinfoOnlineFetchingRule
from pyhanko_certvalidator import ValidationContext
from pyhanko_certvalidator.context import CertValidationPolicySpec
from pyhanko_certvalidator.policy_decl import REQUIRE_REVINFO,CertRevTrustPolicy
from pyhanko_certvalidator.registry import SimpleTrustManager


def configured_evidence():
    folder=Path(os.getenv('MOINPDF_TRUST_ROOTS','/trust'))
    files=sorted(folder.glob('*.pem')) if folder.is_dir() else []
    if len(files)>100 or any(p.stat().st_size>2*1024*1024 for p in files):raise ValueError('Die Vertrauensanker-Konfiguration ist zu groß.')
    roots=list(load_certs_from_pemder([str(p) for p in files]))
    cache=Path(os.getenv('MOINPDF_REVOCATION_INFO','/trust/revocation'))
    entries=list(cache.glob('*.crl'))+list(cache.glob('*.ocsp')) if cache.is_dir() else []
    if len(entries)>100 or sum(p.stat().st_size for p in entries)>20*1024*1024:raise ValueError('Der Sperrnachweis-Speicher ist zu groß.')
    crls=[crl.CertificateList.load(p.read_bytes()) for p in entries if p.suffix=='.crl']
    ocsps=[ocsp.OCSPResponse.load(p.read_bytes()) for p in entries if p.suffix=='.ocsp']
    return roots,crls,ocsps


def validation_context(reader,roots,crls=(),ocsps=()):
    kwargs={'trust_roots':roots,'allow_fetching':False,'revocation_mode':'require','crls':list(crls),'ocsps':list(ocsps)}
    try:return DocumentSecurityStore.read_dss(reader).as_validation_context(kwargs)
    except NoDSSFoundError:return ValidationContext(**kwargs)


def timestamp_status(status):
    if status is None:return None
    return {'intact':status.intact,'cryptographicallyValid':status.valid,'trustedChain':status.trusted,'revoked':status.revoked,'time':str(status.timestamp),'trustProblem':str(status.trust_problem_indic) if status.trust_problem_indic else None}


def validate_bytes(data,roots,crls=(),ocsps=()):
    reader=PdfFileReader(io.BytesIO(data));reports=[]
    if len(reader.embedded_signatures)>50:raise ValueError('Bitte höchstens 50 Signaturen pro Prüfung verwenden.')
    for signature in reader.embedded_regular_signatures:
        vc=validation_context(reader,roots,crls,ocsps)
        status=validate_pdf_signature(signature,signer_validation_context=vc)
        report={'field':signature.field_name,'signer':status.signing_cert.subject.human_friendly,'intact':status.intact,'cryptographicallyValid':status.valid,'trustedChain':status.trusted,'revoked':status.revoked,'trustProblem':str(status.trust_problem_indic) if status.trust_problem_indic else None,'coverage':status.coverage.name if status.coverage else None,'documentChangesAllowed':status.docmdp_ok,'modificationLevel':status.modification_level.name if status.modification_level else None,'summary':status.summary(),'signatureTimestamp':timestamp_status(status.timestamp_validity)}
        if reader.embedded_timestamp_signatures:
            policy=CertValidationPolicySpec(trust_manager=SimpleTrustManager.build(trust_roots=roots),revinfo_policy=CertRevTrustPolicy(REQUIRE_REVINFO))
            spec=PdfSignatureValidationSpec(SignatureValidationSpec(cert_validation_policy=policy,revinfo_gathering_policy=RevocationInfoGatheringSpec(online_fetching_rule=RevinfoOnlineFetchingRule.LOCAL_ONLY)))
            lta=asyncio.run(ades_lta_validation(signature,spec))
            report['longTerm']={'indication':str(lta.ades_subindic.status),'detail':str(lta.ades_subindic),'bestSignatureTime':str(lta.best_signature_time),'trustedAtValidationTime':lta.api_status.trusted if lta.api_status else False}
        else:report['longTerm']={'indication':'NOT_APPLICABLE','detail':'Kein Dokumentzeitstempel vorhanden.'}
        reports.append(report)
    return {'engine':'pyHanko','signatures':reports,'documentTimestamps':len(reader.embedded_timestamp_signatures),'trustRootsConfigured':len(roots),'revocationStatus':'Strenge Offline-Prüfung eingebetteter und betreiberseitig bereitgestellter CRL/OCSP-Nachweise. Fehlende oder abgelaufene Nachweise begründen kein Vertrauen.','qualifiedSignatureStatus':'Nicht geprüft','note':'Zertifikatsvertrauen, Widerruf, Zeitstempel, Dokumentänderungen und historische Langzeitprüfung werden getrennt ausgewiesen. Es erfolgen keine automatischen Netzabfragen an Zertifikatsadressen.'}


def configured_timestamper():
    url=os.getenv('MOINPDF_TSA_URL','').strip();parsed=urlsplit(url)
    if parsed.scheme!='https' or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
        raise ValueError('Der Betreiber muss einen HTTPS-Zeitstempeldienst mit kontrollierter Erreichbarkeit konfigurieren.')
    bearer=os.getenv('MOINPDF_TSA_BEARER','')
    return HTTPTimeStamper(url,https=True,timeout=15,headers={'Authorization':'Bearer '+bearer} if bearer else None)


def sign_bytes(data,signer,level,roots=(),crls=(),ocsps=(),timestamper=None):
    if level not in {'basic','timestamp','lt','lta'}:raise ValueError('Unbekanntes Signaturprofil.')
    if level!='basic' and (not roots or timestamper is None):raise ValueError('Zeitstempel und Langzeitprofile benötigen konfigurierte Vertrauensanker, Sperrnachweise und einen Zeitstempeldienst.')
    writer=IncrementalPdfFileWriter(io.BytesIO(data));vc=validation_context(writer.prev,roots,crls,ocsps)
    metadata=signers.PdfSignatureMetadata(field_name='MoinPDF_'+uuid.uuid4().hex[:12],md_algorithm='sha256',subfilter=SigSeedSubFilter.PADES,validation_context=vc if level!='basic' else None,embed_validation_info=level in {'lt','lta'},use_pades_lta=level=='lta')
    signed=signers.PdfSigner(metadata,signer=signer,timestamper=timestamper if level!='basic' else None).sign_pdf(writer).getvalue()
    if level!='basic':
        checked=validate_bytes(signed,roots,crls,ocsps)['signatures'][-1]
        timestamp=checked['signatureTimestamp']
        if not checked['intact'] or not checked['cryptographicallyValid'] or not checked['trustedChain'] or checked['revoked'] or not timestamp or not timestamp['trustedChain'] or not timestamp['intact'] or not timestamp['cryptographicallyValid']:
            raise ValueError('Signatur oder Zeitstempel konnte mit den vorhandenen Vertrauens- und Sperrnachweisen nicht bestätigt werden; keine Ausgabe erstellt.')
        if level=='lta' and checked['longTerm']['indication']!='AdESStatus.PASSED':
            raise ValueError('Die Langzeitprüfung der erzeugten Signatur ist nicht bestanden; keine Ausgabe erstellt.')
    return signed


def renew_bytes(data,roots,crls,ocsps,timestamper):
    reader=PdfFileReader(io.BytesIO(data))
    if not reader.embedded_regular_signatures or not reader.embedded_timestamp_signatures:
        raise ValueError('Für die Erneuerung wird eine vorhandene PAdES-LTA-Signatur benötigt.')
    if len(reader.embedded_signatures)>50:raise ValueError('Zu viele Signaturen.')
    context=validation_context(reader,roots,crls,ocsps)
    output=io.BytesIO()
    signers.PdfTimeStamper(timestamper).update_archival_timestamp_chain(reader,context,in_place=False,output=output)
    data=output.getvalue();report=validate_bytes(data,roots,crls,ocsps)
    if not all(s['longTerm']['indication']=='AdESStatus.PASSED' for s in report['signatures']):
        raise ValueError('Die erneuerte Langzeitkette hat die strenge Prüfung nicht bestanden.')
    return data
