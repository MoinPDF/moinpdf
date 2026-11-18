import * as asn1 from 'asn1js';
import {
  TimeStampReq,
  TimeStampResp,
  MessageImprint,
  AlgorithmIdentifier,
  SignedData,
  TSTInfo,
  CryptoEngine,
} from 'pkijs';
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFNumber,
  PDFString,
  PDFHexString,
} from 'pdf-lib';
import { rejectSignedPdf } from './pdf-signature-guard';
const SHA256 = '2.16.840.1.101.3.4.2.1';
const hex = (a: Uint8Array) => Array.from(a, (x) => x.toString(16).padStart(2, '0')).join('');
export async function verifyTimestamp(reply: ArrayBuffer, request: TimeStampReq, data: Uint8Array) {
  if (reply.byteLength > 1024 * 1024) throw new Error('Die Zeitstempelantwort ist zu groß.');
  const parsed = asn1.fromBER(reply);
  if (parsed.offset !== reply.byteLength) throw new Error('Ungültige Zeitstempelantwort.');
  const response = new TimeStampResp({ schema: parsed.result });
  if (
    ![0, 1].includes(response.status.status) ||
    !response.timeStampToken ||
    response.timeStampToken.contentType !== '1.2.840.113549.1.7.2'
  )
    throw new Error('Der Zeitstempeldienst hat die Anfrage abgelehnt.');
  const cms = new SignedData({ schema: response.timeStampToken.content });
  if (
    cms.signerInfos.length !== 1 ||
    cms.encapContentInfo.eContentType !== '1.2.840.113549.1.9.16.1.4' ||
    !cms.encapContentInfo.eContent
  )
    throw new Error('Ungültiger Zeitstempeltoken.');
  const info = TSTInfo.fromBER(cms.encapContentInfo.eContent.getValue());
  if (
    info.version !== 1 ||
    info.messageImprint.hashAlgorithm.algorithmId !== SHA256 ||
    !info.nonce ||
    !request.nonce ||
    !info.nonce.isEqual(request.nonce) ||
    hex(new Uint8Array(info.messageImprint.hashedMessage.getValue())) !==
      hex(new Uint8Array(request.messageImprint.hashedMessage.getValue()))
  )
    throw new Error('Zeitstempel gehört nicht zu dieser Anfrage.');
  const engine = new CryptoEngine({ name: 'MoinPDF timestamp', crypto: globalThis.crypto });
  const result = await cms.verify(
    { signer: 0, data: data.slice().buffer, checkChain: false, extendedMode: true },
    engine,
  );
  const certificate = result.signerCertificate;
  if (!result.signatureVerified || !certificate)
    throw new Error('Die Signatur des Zeitstempels ist ungültig.');
  const eku = certificate.extensions?.find((e) => e.extnID === '2.5.29.37');
  if (
    !eku?.critical ||
    eku.parsedValue?.keyPurposes?.length !== 1 ||
    eku.parsedValue.keyPurposes[0] !== '1.3.6.1.5.5.7.3.8' ||
    info.genTime < certificate.notBefore.value ||
    info.genTime > certificate.notAfter.value
  )
    throw new Error('Das Zertifikat ist für diesen Zeitstempel nicht gültig.');
  // Bind the signer certificate to the signed ESS attribute (RFC 3161 / RFC 5816).
  const attrs = cms.signerInfos[0].signedAttrs?.attributes || [];
  const ess =
    attrs.find((a) => a.type === '1.2.840.113549.1.9.16.2.47') ||
    attrs.find((a) => a.type === '1.2.840.113549.1.9.16.2.12');
  const values = (ess?.values[0] as asn1.Sequence)?.valueBlock.value;
  const entry = ((values?.[0] as asn1.Sequence)?.valueBlock.value[0] as asn1.Sequence)?.valueBlock
    .value;
  if (!entry?.length) throw new Error('Der Zeitstempel enthält keine Zertifikatsbindung.');
  const digestAlgorithm = ess!.type.endsWith('.12') ? 'SHA-1' : 'SHA-256';
  let certificateHash = entry[0];
  if (certificateHash instanceof asn1.Sequence) {
    const alg = new AlgorithmIdentifier({ schema: certificateHash });
    if (alg.algorithmId !== SHA256) throw new Error('Nicht unterstützte Zertifikatsbindung.');
    certificateHash = entry[1];
  }
  if (
    !(certificateHash instanceof asn1.OctetString) ||
    hex(new Uint8Array(certificateHash.getValue())) !==
      hex(
        new Uint8Array(
          await crypto.subtle.digest(digestAlgorithm, certificate.toSchema(true).toBER(false)),
        ),
      )
  )
    throw new Error('Zertifikatsbindung des Zeitstempels stimmt nicht.');
  return {
    token: new Uint8Array(response.timeStampToken.toSchema().toBER(false)),
    time: info.genTime.toISOString(),
  };
}
export async function timestampPdf(
  bytes: Uint8Array,
  exchange: (body: ArrayBuffer) => Promise<ArrayBuffer>,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  if (!crypto?.subtle) throw new Error('Zeitstempel benötigen HTTPS oder localhost.');
  if (bytes.length > 80 * 1024 * 1024) throw new Error('Bitte höchstens 80 MB verwenden.');
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  rejectSignedPdf(doc);
  const existing = doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
  if (existing?.has(PDFName.of('XFA'))) throw new Error('XFA-Dokumente werden nicht verändert.');
  if (!doc.getPageCount()) throw new Error('Die PDF enthält keine Seiten.');
  const capacity = 32768,
    marker = 9999999999;
  const signature = doc.context.register(
    doc.context.obj({
      Type: 'DocTimeStamp',
      Filter: 'Adobe.PPKLite',
      SubFilter: 'ETSI.RFC3161',
      ByteRange: [0, marker, marker, marker],
      Contents: PDFHexString.of('0'.repeat(capacity * 2)),
    }),
  );
  const page = doc.getPage(0),
    widget = doc.context.register(
      doc.context.obj({
        Type: 'Annot',
        Subtype: 'Widget',
        FT: 'Sig',
        T: PDFString.of('MoinPDF-Zeitstempel-' + crypto.randomUUID()),
        F: 132,
        Rect: [0, 0, 0, 0],
        V: signature,
        P: page.ref,
      }),
    );
  const form = existing || doc.context.obj({ Fields: [] });
  if (!existing) doc.catalog.set(PDFName.of('AcroForm'), doc.context.register(form));
  let fields = form.lookupMaybe(PDFName.of('Fields'), PDFArray);
  if (!fields) {
    fields = doc.context.obj([]);
    form.set(PDFName.of('Fields'), fields);
  }
  fields.push(widget);
  form.set(PDFName.of('SigFlags'), PDFNumber.of(3));
  page.node.addAnnot(widget);
  const output = await doc.save({ useObjectStreams: false, updateFieldAppearances: false }),
    text = new TextDecoder('latin1').decode(output),
    placeholder = '<' + '0'.repeat(capacity * 2) + '>',
    offset = text.indexOf(placeholder),
    rangeText = `[ 0 ${marker} ${marker} ${marker} ]`,
    rangeOffset = text.indexOf(rangeText);
  if (
    offset < 0 ||
    text.lastIndexOf(placeholder) !== offset ||
    rangeOffset < 0 ||
    text.lastIndexOf(rangeText) !== rangeOffset
  )
    throw new Error('Zeitstempelplatzhalter ist nicht eindeutig.');
  const after = offset + placeholder.length;
  output.set(
    new TextEncoder().encode(
      `[0 ${offset} ${after} ${output.length - after}]`.padEnd(rangeText.length, ' '),
    ),
    rangeOffset,
  );
  const data = new Uint8Array(offset + output.length - after);
  data.set(output.subarray(0, offset));
  data.set(output.subarray(after), offset);
  const nonce = crypto.getRandomValues(new Uint8Array(16));
  nonce[0] &= 0x7f;
  nonce[0] |= 1;
  const request = new TimeStampReq({
    version: 1,
    certReq: true,
    nonce: new asn1.Integer({ valueHex: nonce.buffer }),
    messageImprint: new MessageImprint({
      hashAlgorithm: new AlgorithmIdentifier({ algorithmId: SHA256 }),
      hashedMessage: new asn1.OctetString({
        valueHex: await crypto.subtle.digest('SHA-256', data),
      }),
    }),
  });
  signal?.throwIfAborted();
  const response = await exchange(request.toSchema().toBER(false));
  signal?.throwIfAborted();
  const verified = await verifyTimestamp(response, request, data);
  if (verified.token.length > capacity) throw new Error('Der Zeitstempeltoken ist zu groß.');
  output.set(new TextEncoder().encode(hex(verified.token).padEnd(capacity * 2, '0')), offset + 1);
  return { bytes: output, time: verified.time };
}
