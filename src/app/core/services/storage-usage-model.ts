// Cuota de referencia del plan Free confirmada en el panel de Supabase.
// Es compartida: esta consulta incluye este proyecto, no otros proyectos de la organización.
export const FILE_STORAGE_LIMIT = 1_000_000_000;

export function parseStorageUsage(data: unknown): { used: number; complete: boolean } {
  if (!Array.isArray(data) || data.length !== 1) throw new Error('Respuesta de Storage no válida.');
  const row = data[0];
  const value = row?.used_bytes;
  if ((typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && !/^\d+$/.test(value))) throw new Error('Tamaño no válido.');
  const used = Number(value);
  if (!Number.isSafeInteger(used) || used < 0 || typeof row?.complete !== 'boolean')
    throw new Error('Tamaño no válido.');
  return { used, complete: row.complete };
}

export function formatStorageBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unit = bytes > 0 ? Math.min(units.length - 1, Math.floor(Math.log10(bytes) / 3)) : 0;
  return `${new Intl.NumberFormat('es', { maximumFractionDigits: 2 }).format(bytes / 1000 ** unit)} ${units[unit]}`;
}
