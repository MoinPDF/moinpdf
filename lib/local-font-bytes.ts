/** Read unchanged font bytes from plain or losslessly compressed local assets. */
export async function localFontBytes(response: Response): Promise<ArrayBuffer> {
  const buffer = await response.arrayBuffer();
  const signature = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
  if (signature[0] !== 0x1f || signature[1] !== 0x8b) return buffer;
  return new Response(
    new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip')),
  ).arrayBuffer();
}
