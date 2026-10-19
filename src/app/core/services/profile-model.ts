export const PROFILE_AVATARS = [
  { id: 'orbit', name: 'Órbita', url: 'avatars/orbit.svg' },
  { id: 'leaf', name: 'Brote', url: 'avatars/leaf.svg' },
  { id: 'sunrise', name: 'Amanecer', url: 'avatars/sunrise.svg' },
  { id: 'mountain', name: 'Cumbre', url: 'avatars/mountain.svg' },
] as const;

export interface ProfileDraft {
  name: string;
  bio: string;
  avatar: string;
}

export function profileErrors(draft: ProfileDraft): string {
  if (!draft.name.trim() || draft.name.trim().length > 80)
    return 'Escribe un nombre de entre 1 y 80 caracteres.';
  if (draft.bio.length > 280) return 'La biografía admite hasta 280 caracteres.';
  if (!['', 'custom', ...PROFILE_AVATARS.map((avatar) => avatar.id)].includes(draft.avatar))
    return 'Selecciona un avatar válido.';
  return '';
}

export function presetAvatar(id: string): string {
  return PROFILE_AVATARS.find((avatar) => avatar.id === id)?.url ?? '';
}
