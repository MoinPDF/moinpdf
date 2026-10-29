export async function replacementImage(file: File) {
  if (file.size > 20 * 1024 * 1024)
    throw new Error('Das Ersatzbild darf höchstens 20 MB groß sein.');
  const url = URL.createObjectURL(file),
    image = new Image();
  try {
    image.src = url;
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 4000000)
      throw new Error('Das Ersatzbild darf höchstens 4 Megapixel haben.');
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    try {
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      return {
        width: canvas.width,
        height: canvas.height,
        rgba: new Uint8Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data),
      };
    } finally {
      canvas.width = canvas.height = 0;
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
