export interface WorkspaceRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  created_at: string;
  projectCount: number;
  ticketCount: number;
}
export function workspaceSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/g, '');
}
export function workspaceErrors(
  name: string,
  slug: string,
  description: string,
  records: WorkspaceRecord[],
) {
  return {
    name:
      name.trim().length < 3 || name.trim().length > 64
        ? 'Escribe un nombre de entre 3 y 64 caracteres.'
        : '',
    slug:
      slug.length < 3 || slug.length > 32 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
        ? 'Usa entre 3 y 32 caracteres: letras minúsculas, números y guiones.'
        : slug === 'demo' || records.some((record) => record.slug === slug)
          ? 'Ese identificador ya está en uso.'
          : '',
    description:
      description.trim().length > 240 ? 'Usa una descripción de hasta 240 caracteres.' : '',
  };
}
