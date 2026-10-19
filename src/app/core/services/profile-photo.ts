import { validateScreenshot } from './screenshot-validation';

export async function prepareProfilePhoto(file: File): Promise<File> {
  if (!file.size || file.size > 5 * 1024 * 1024)
    throw new Error('La imagen debe pesar entre 1 byte y 5 MB.');
  await validateScreenshot(file);
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('No se pudo leer la imagen. Prueba con otra foto.');
  }
  try {
    if (!image.width || !image.height || image.width * image.height > 40_000_000)
      throw new Error('Usa una imagen de hasta 40 megapíxeles.');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo procesar la imagen.');
    const side = Math.min(image.width, image.height);
    context.drawImage(
      image,
      (image.width - side) / 2,
      (image.height - side) / 2,
      side,
      side,
      0,
      0,
      512,
      512,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('No se pudo preparar la foto.'))),
        'image/webp',
        0.85,
      ),
    );
    if (blob.size > 512 * 1024)
      throw new Error('La foto procesada es demasiado grande. Prueba con otra imagen.');
    return new File([blob], 'perfil.webp', { type: blob.type });
  } finally {
    image.close();
  }
}

export function photoDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo guardar la imagen local.'));
    reader.readAsDataURL(file);
  });
}
