export type DocumentColors = {
  mode: 'native' | 'raster';
  textEnabled: boolean;
  backgroundEnabled: boolean;
  text: string;
  background: string;
  brightness: number;
  contrast: number;
  saturation: number;
};
export const defaultDocumentColors: DocumentColors = {
  mode: 'native',
  textEnabled: true,
  backgroundEnabled: true,
  text: '#243340',
  background: '#fff8e8',
  brightness: 0,
  contrast: 0,
  saturation: 100,
};
export function validateDocumentColors(o: DocumentColors) {
  if (
    !['native', 'raster'].includes(o.mode) ||
    !/^#[0-9a-f]{6}$/i.test(o.text) ||
    !/^#[0-9a-f]{6}$/i.test(o.background) ||
    typeof o.textEnabled !== 'boolean' ||
    typeof o.backgroundEnabled !== 'boolean' ||
    !Number.isFinite(o.brightness) ||
    Math.abs(o.brightness) > 100 ||
    !Number.isFinite(o.contrast) ||
    Math.abs(o.contrast) > 100 ||
    !Number.isFinite(o.saturation) ||
    o.saturation < 0 ||
    o.saturation > 200
  )
    throw new Error('Ungültige Farbeinstellungen.');
}
export function adjustDocumentPixels(data: Uint8ClampedArray, o: DocumentColors) {
  validateDocumentColors(o);
  const contrast = (100 + o.contrast) / 100,
    saturation = o.saturation / 100;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    for (let c = 0; c < 3; c++)
      data[i + c] =
        (gray + (data[i + c] - gray) * saturation - 127.5) * contrast + 127.5 + o.brightness * 2.55;
  }
}
