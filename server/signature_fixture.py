import asyncio,io,json
from datetime import datetime,timedelta,timezone
from cryptography import x509
from cryptography.hazmat.primitives import hashes,serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID,ExtendedKeyUsageOID
from asn1crypto import keys,x509 as ax,crl as ac
from pyhanko.sign import signers,timestamps
from pyhanko.sign.fields import SigSeedSubFilter
from pyhanko.sign.validation import validate_pdf_signature
from pyhanko.sign.validation.ades import ades_lta_validation
from pyhanko.sign.validation.policy_decl import PdfSignatureValidationSpec,SignatureValidationSpec,RevocationInfoGatheringSpec,RevinfoOnlineFetchingRule
from pyhanko_certvalidator import ValidationContext
from pyhanko_certvalidator.context import CertValidationPolicySpec
from pyhanko_certvalidator.policy_decl import REQUIRE_REVINFO,CertRevTrustPolicy
from pyhanko_certvalidator.registry import SimpleCertificateStore,SimpleTrustManager
from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
from pyhanko.pdf_utils.reader import PdfFileReader
from pyhanko.pdf_utils.writer import PdfFileWriter,PageObject
from pyhanko.pdf_utils.generic import StreamObject,DictionaryObject,NameObject
from pathlib import Path

def signature_fixture():
    now=datetime.now(timezone.utc).replace(microsecond=0)
    
    def create(name,issuer=None,issuer_key=None,ca=False,tsa=False):
     key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
     subject=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,name)])
     b=x509.CertificateBuilder().subject_name(subject).issuer_name(issuer.subject if issuer else subject).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(days=1)).not_valid_after(now+timedelta(days=365)).add_extension(x509.BasicConstraints(ca=ca,path_length=None),critical=True).add_extension(x509.SubjectKeyIdentifier.from_public_key(key.public_key()),critical=False).add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key((issuer_key or key).public_key()),critical=False).add_extension(x509.KeyUsage(digital_signature=True,content_commitment=not tsa,key_encipherment=False,data_encipherment=False,key_agreement=False,key_cert_sign=ca,crl_sign=ca,encipher_only=False,decipher_only=False),critical=True)
     if tsa:b=b.add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.TIME_STAMPING]),critical=True)
     return key,b.sign(issuer_key or key,hashes.SHA256())
    rootkey,root=create('Synthetic probe root CA',ca=True)
    signkey,signcert=create('Synthetic probe signer',root,rootkey)
    tsakey,tsacert=create('Synthetic probe TSA',root,rootkey,tsa=True)
    cast=lambda c:ax.Certificate.load(c.public_bytes(serialization.Encoding.DER))
    kcast=lambda k:keys.PrivateKeyInfo.load(k.private_bytes(serialization.Encoding.DER,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
    root_asn,sign_asn,tsa_asn=map(cast,[root,signcert,tsacert])
    store=SimpleCertificateStore();store.register(root_asn)
    signer=signers.SimpleSigner(sign_asn,kcast(signkey),store)
    tsa=timestamps.DummyTimeStamper(tsa_asn,kcast(tsakey),certs_to_embed=store,fixed_dt=now)
    
    def getcrl(revoked=False):
     b=x509.CertificateRevocationListBuilder().issuer_name(root.subject).last_update(now-timedelta(minutes=10)).next_update(now+timedelta(days=1)).add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(rootkey.public_key()),critical=False)
     if revoked:b=b.add_revoked_certificate(x509.RevokedCertificateBuilder().serial_number(signcert.serial_number).revocation_date(now-timedelta(hours=1)).build())
     return ac.CertificateList.load(b.sign(rootkey,hashes.SHA256()).public_bytes(serialization.Encoding.DER))
    crl=getcrl()
    def vc(crls=[crl]):return ValidationContext(trust_roots=[root_asn],allow_fetching=False,crls=crls,revocation_mode='require')
    w=PdfFileWriter(); stream=w.add_object(StreamObject(stream_data=b'BT /F1 14 Tf 40 700 Td (MoinPDF offline LTA probe) Tj ET'))
    font=DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),NameObject('/BaseFont'):NameObject('/Helvetica')})
    page=PageObject(stream,[0,0,595,842],DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):font})}));w.insert_page(page);plain=io.BytesIO();w.write(plain);plain.seek(0)
    return {"plain":plain.getvalue(),"signer":signer,"tsa":tsa,"roots":[root_asn],"crl":crl,"revoked_crl":getcrl(True)}
