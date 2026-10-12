import * as asn1 from 'asn1js';
import {
  PFX,
  Certificate,
  CertBag,
  PrivateKeyInfo,
  PKCS8ShroudedKeyBag,
  EncryptedData,
  EncryptedContentInfo,
  PBES2Params,
  PBKDF2Params,
  AlgorithmIdentifier,
  RSAPrivateKey,
  RSAPublicKey,
  SignedData,
  EncapsulatedContentInfo,
  SignerInfo,
  IssuerAndSerialNumber,
  SignedAndUnsignedAttributes,
  Attribute,
  ContentInfo,
  CryptoEngine,
} from 'pkijs';
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFString,
  PDFHexString,
  PDFNumber,
} from 'pdf-lib';
import { rejectSignedPdf } from './pdf-signature-guard';
const RSA = '1.2.840.113549.1.1.1',
  DATA = '1.2.840.113549.1.7.1';
function encryption(algorithm: AlgorithmIdentifier) {
  if (algorithm.algorithmId !== '1.2.840.113549.1.5.13' || !algorithm.algorithmParams)
    throw new Error('Bitte ein modernes PKCS#12 mit PBES2, PBKDF2 und AES verwenden.');
  const params = PBES2Params.fromBER(algorithm.algorithmParams.toBER(false));
  if (
    params.keyDerivationFunc.algorithmId !== '1.2.840.113549.1.5.12' ||
    !params.keyDerivationFunc.algorithmParams
  )
    throw new Error('PKCS#12 benötigt PBKDF2.');
  const kdf = PBKDF2Params.fromBER(params.keyDerivationFunc.algorithmParams.toBER(false));
  const bits: Record<string, number> = {
    '2.16.840.1.101.3.4.1.2': 128,
    '2.16.840.1.101.3.4.1.22': 192,
    '2.16.840.1.101.3.4.1.42': 256,
  };
  const bit = bits[params.encryptionScheme.algorithmId],
    iv = params.encryptionScheme.algorithmParams;
  if (
    !bit ||
    !(iv instanceof asn1.OctetString) ||
    iv.getValue().byteLength !== 16 ||
    !Number.isSafeInteger(kdf.iterationCount) ||
    kdf.iterationCount < 1 ||
    kdf.iterationCount > 1000000 ||
    !(kdf.salt instanceof asn1.OctetString) ||
    kdf.salt.getValue().byteLength > 1024 ||
    !['1.2.840.113549.2.9', '1.2.840.113549.2.10', '1.2.840.113549.2.11'].includes(
      kdf.prf?.algorithmId || '',
    ) ||
    (kdf.keyLength !== undefined && kdf.keyLength !== bit / 8)
  )
    throw new Error(
      'Die PKCS#12-Verschlüsselung wird nicht unterstützt. AES-CBC und HMAC-SHA256/384/512 verwenden.',
    );
}
async function identity(p12: Uint8Array, password: string, engine: CryptoEngine) {
  const pass = new TextEncoder().encode(password);
  const pfx = PFX.fromBER(new Uint8Array(p12).buffer);
  if (
    pfx.authSafe.contentType !== DATA ||
    !pfx.macData ||
    !Number.isSafeInteger(pfx.macData.iterations ?? 1) ||
    (pfx.macData.iterations ?? 1) < 1 ||
    (pfx.macData.iterations ?? 1) > 1000000 ||
    pfx.macData.macSalt.getValue().byteLength > 1024
  )
    throw new Error('PKCS#12 benötigt einen unterstützten Integritätsschutz.');
  try {
    try {
      await pfx.parseInternalValues({ password: pass.buffer, checkIntegrity: true }, engine);
    } catch {
      throw new Error('Zertifikatspasswort falsch oder PKCS#12-Datei beschädigt.');
    }
    const safe = pfx.parsedValue?.authenticatedSafe;
    if (!safe || safe.safeContents.length > 32) throw new Error('Ungültiger PKCS#12-Inhalt.');
    for (const content of safe.safeContents) {
      if (content.contentType === '1.2.840.113549.1.7.6')
        encryption(
          EncryptedData.fromBER(content.content.toBER(false)).encryptedContentInfo
            .contentEncryptionAlgorithm,
        );
      else if (content.contentType !== DATA)
        throw new Error('Dieses PKCS#12-Format wird nicht unterstützt.');
    }
    await safe.parseInternalValues(
      { safeContents: safe.safeContents.map(() => ({ password: pass.buffer })) },
      engine,
    );
    const bags = safe.parsedValue!.safeContents.flatMap(
      (s: { value: import('pkijs').SafeContents }) => s.value.safeBags,
    );
    if (bags.length > 128) throw new Error('Zu viele PKCS#12-Einträge.');
    const certs: Certificate[] = [],
      keys: PrivateKeyInfo[] = [];
    for (const bag of bags) {
      const value = bag.bagValue;
      if (value instanceof CertBag && value.parsedValue instanceof Certificate)
        certs.push(value.parsedValue);
      else if (value instanceof PrivateKeyInfo) keys.push(value);
      else if (value instanceof PKCS8ShroudedKeyBag) {
        encryption(value.encryptionAlgorithm);
        const decrypted = await new EncryptedData({
          encryptedContentInfo: new EncryptedContentInfo({
            contentEncryptionAlgorithm: value.encryptionAlgorithm,
            encryptedContent: value.encryptedData,
          }),
        }).decrypt({ password: pass.buffer }, engine);
        try {
          keys.push(PrivateKeyInfo.fromBER(decrypted));
        } finally {
          new Uint8Array(decrypted).fill(0);
        }
      } else throw new Error('Dieses PKCS#12 enthält nicht unterstützte Einträge.');
    }
    if (
      keys.length !== 1 ||
      keys[0].privateKeyAlgorithm.algorithmId !== RSA ||
      !(keys[0].parsedKey instanceof RSAPrivateKey)
    )
      throw new Error('Genau ein privater RSA-Schlüssel ab 2048 Bit ist erforderlich.');
    const key = keys[0],
      jwk = (key.parsedKey as RSAPrivateKey).toJSON();
    const matches = certs.filter((c) => {
      const pub = c.subjectPublicKeyInfo.parsedKey;
      return pub instanceof RSAPublicKey && pub.toJSON().n === jwk.n && pub.toJSON().e === jwk.e;
    });
    if (matches.length !== 1)
      throw new Error('Kein eindeutiges Zertifikat zum privaten Schlüssel gefunden.');
    const certificate = matches[0],
      now = new Date();
    if (now < certificate.notBefore.value || now > certificate.notAfter.value)
      throw new Error('Das Zertifikat ist aktuell nicht gültig.');
    const usage = certificate.extensions?.find((e) => e.extnID === '2.5.29.15');
    if (usage) {
      const parsed = asn1.fromBER(usage.extnValue.getValue()).result;
      if (!(parsed instanceof asn1.BitString) || !(parsed.valueBlock.valueHexView[0] & 0xc0))
        throw new Error('Das Zertifikat erlaubt keine Dokumentensignatur.');
    }
    const raw = key.toSchema().toBER(false);
    try {
      const privateKey = await crypto.subtle.importKey(
        'pkcs8',
        raw,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      if ((privateKey.algorithm as RsaKeyAlgorithm).modulusLength < 2048)
        throw new Error('RSA-Schlüssel ab 2048 Bit erforderlich.');
      return { privateKey, certificate, certs };
    } finally {
      new Uint8Array(raw).fill(0);
    }
  } finally {
    pass.fill(0);
  }
}
export async function signPdfLocally(
  bytes: Uint8Array,
  p12: Uint8Array,
  password: string,
): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle)
    throw new Error('Lokales Signieren benötigt HTTPS oder localhost.');
  if (
    bytes.length > 80 * 1024 * 1024 ||
    p12.length > 5 * 1024 * 1024 ||
    !p12.length ||
    password.length > 1000
  )
    throw new Error('Höchstens 80 MB PDF und 5 MB Zertifikat sind erlaubt.');
  const doc = await PDFDocument.load(bytes);
  rejectSignedPdf(doc);
  const existing = doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
  if (existing?.has(PDFName.of('XFA')))
    throw new Error('XFA-Dokumente werden lokal nicht signiert.');
  if (!doc.getPageCount()) throw new Error('Die PDF enthält keine Seiten.');
  const engine = new CryptoEngine({ name: 'MoinPDF WebCrypto', crypto: globalThis.crypto });
  const { privateKey, certificate, certs } = await identity(p12, password, engine);
  const capacity = 32768,
    marker = 9999999999;
  const signature = doc.context.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: 'adbe.pkcs7.detached',
    ByteRange: [0, marker, marker, marker],
    Contents: PDFHexString.of('0'.repeat(capacity * 2)),
    M: PDFString.fromDate(new Date()),
  });
  const sigRef = doc.context.register(signature),
    page = doc.getPage(0);
  const widget = doc.context.obj({
      Type: 'Annot',
      Subtype: 'Widget',
      FT: 'Sig',
      T: PDFString.of('MoinPDF-Zertifikat'),
      F: 132,
      Rect: [0, 0, 0, 0],
      V: sigRef,
      P: page.ref,
    }),
    widgetRef = doc.context.register(widget);
  const form = existing || doc.context.obj({ Fields: [] });
  if (!existing) doc.catalog.set(PDFName.of('AcroForm'), doc.context.register(form));
  let fields = form.lookupMaybe(PDFName.of('Fields'), PDFArray);
  if (!fields) {
    fields = doc.context.obj([]);
    form.set(PDFName.of('Fields'), fields);
  }
  fields.push(widgetRef);
  form.set(PDFName.of('SigFlags'), PDFNumber.of(3));
  page.node.addAnnot(widgetRef);
  const out = await doc.save({ useObjectStreams: false, updateFieldAppearances: false });
  const text = new TextDecoder('latin1').decode(out),
    placeholder = '<' + '0'.repeat(capacity * 2) + '>',
    offset = text.indexOf(placeholder),
    rangeText = `[ 0 ${marker} ${marker} ${marker} ]`,
    rangeOffset = text.indexOf(rangeText);
  if (
    offset < 0 ||
    offset !== text.lastIndexOf(placeholder) ||
    rangeOffset < 0 ||
    rangeOffset !== text.lastIndexOf(rangeText)
  )
    throw new Error('Signaturplatzhalter sind nicht eindeutig.');
  const after = offset + placeholder.length,
    range = `[0 ${offset} ${after} ${out.length - after}]`;
  out.set(new TextEncoder().encode(range.padEnd(rangeText.length, ' ')), rangeOffset);
  const signed = new Uint8Array(offset + out.length - after);
  signed.set(out.subarray(0, offset));
  signed.set(out.subarray(after), offset);
  const digest = await crypto.subtle.digest('SHA-256', signed);
  const attributes = [
    new Attribute({
      type: '1.2.840.113549.1.9.3',
      values: [new asn1.ObjectIdentifier({ value: DATA })],
    }),
    new Attribute({
      type: '1.2.840.113549.1.9.5',
      values: [new asn1.UTCTime({ valueDate: new Date() })],
    }),
    new Attribute({
      type: '1.2.840.113549.1.9.4',
      values: [new asn1.OctetString({ valueHex: digest })],
    }),
  ];
  attributes.sort((a, b) => {
    const aa = new Uint8Array(a.toSchema().toBER(false)),
      bb = new Uint8Array(b.toSchema().toBER(false));
    for (let i = 0; i < Math.min(aa.length, bb.length); i++)
      if (aa[i] !== bb[i]) return aa[i] - bb[i];
    return aa.length - bb.length;
  });
  const cms = new SignedData({
    version: 1,
    encapContentInfo: new EncapsulatedContentInfo({ eContentType: DATA }),
    certificates: certs,
    signerInfos: [
      new SignerInfo({
        version: 1,
        sid: new IssuerAndSerialNumber({
          issuer: certificate.issuer,
          serialNumber: certificate.serialNumber,
        }),
        signedAttrs: new SignedAndUnsignedAttributes({ type: 0, attributes }),
      }),
    ],
  });
  await cms.sign(privateKey, 0, 'SHA-256', signed.buffer, engine);
  const encoded = new Uint8Array(
    new ContentInfo({ contentType: '1.2.840.113549.1.7.2', content: cms.toSchema(true) })
      .toSchema()
      .toBER(false),
  );
  if (encoded.length > capacity) throw new Error('Die Zertifikatskette ist zu groß.');
  out.set(
    new TextEncoder().encode(Array.from(encoded, (n) => n.toString(16).padStart(2, '0')).join('')),
    offset + 1,
  );
  return out;
}
