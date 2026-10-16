export const SCREENSHOT_LIMIT = 6;
export const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
export const SCREENSHOT_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export async function validateScreenshot(file: File): Promise<void> {
  if (!(SCREENSHOT_TYPES as readonly string[]).includes(file.type))
    throw new Error('Usa imágenes PNG, JPG o WebP.');
  if (!file.size || file.size > SCREENSHOT_MAX_BYTES)
    throw new Error('Cada captura debe pesar entre 1 byte y 5 MB.');
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!(file.type === 'image/png' ? png : file.type === 'image/jpeg' ? jpeg : webp))
    throw new Error('El archivo no coincide con el formato de imagen indicado.');
}
export function screenshotFilename(file: Pick<File, 'name' | 'type'>): string {
  const stem =
    file.name
      .replace(/\.[^.]*$/, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'captura';
  return `${stem}.${file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png'}`;
}
