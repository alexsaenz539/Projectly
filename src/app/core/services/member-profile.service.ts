import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { WorkspaceService } from './workspace.service';
import { ProfileService } from './profile.service';
import { Member } from './models';
import { presetAvatar } from './profile-model';

interface MemberImage {
  member_id: string;
  account_id: string;
  avatar: string;
  photo_path: string;
}

@Injectable({ providedIn: 'root' })
export class MemberProfileService {
  private readonly store = inject(WorkspaceService);
  private readonly profile = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly images = signal<Record<string, string>>({});
  readonly error = signal('');
  private revision = 0;

  constructor() {
    effect(() => {
      const user = this.store.auth.user();
      const workspace = this.store.activeWorkspaceId();
      const members = this.store.members();
      untracked(() => void this.load(workspace, user?.id ?? '', members));
    });
    this.destroyRef.onDestroy(() => {
      this.revision++;
      this.release(this.images());
    });
  }

  image(member: Member | undefined): string {
    if (!member) return '';
    const user = this.store.auth.user();
    const ownAccount =
      user &&
      (member.account_id === user.id ||
        (!member.account_id &&
          !!member.email.trim() &&
          member.email.trim().toLowerCase() === user.email?.trim().toLowerCase()));
    return ownAccount ? this.profile.image() : (this.images()[member.id] ?? '');
  }

  private release(images: Record<string, string>) {
    for (const url of new Set(Object.values(images))) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    }
  }

  private async load(workspace: string | null, userId: string, members: Member[]): Promise<void> {
    const revision = ++this.revision;
    this.release(this.images());
    this.images.set({});
    this.error.set('');
    const client = this.store.auth.client;
    if (!client || !userId || !workspace || !members.length) return;
    const images: Record<string, string> = {};
    try {
      const result = await client.rpc('member_profile_images', { p_workspace_id: workspace });
      if (revision !== this.revision) return;
      if (result.error) throw result.error;
      const records = (result.data ?? []) as MemberImage[];
      // Una descarga por cuenta, aunque haya varios responsables vinculados a ella.
      const downloads = new Map<string, Promise<string>>();
      await Promise.all(
        records.map(async (record) => {
          const member = members.find((item) => item.id === record.member_id);
          if (!member || member.account_id !== record.account_id || record.account_id === userId)
            return;
          if (record.avatar !== 'custom') {
            images[member.id] = presetAvatar(record.avatar);
            return;
          }
          const prefix = `${record.account_id}/`;
          if (
            !record.photo_path.startsWith(prefix) ||
            !/^[a-zA-Z0-9-]+\.(webp|png|jpg)$/.test(record.photo_path.slice(prefix.length))
          )
            return;
          let download = downloads.get(record.account_id);
          if (!download) {
            download = client.storage
              .from('profile-avatars')
              .download(record.photo_path)
              .then((result) => {
                if (result.error) throw result.error;
                return URL.createObjectURL(result.data);
              });
            downloads.set(record.account_id, download);
          }
          try {
            images[member.id] = await download;
          } catch {
            if (revision === this.revision)
              this.error.set('No se pudo cargar una foto del equipo.');
          }
        }),
      );
      if (revision !== this.revision) {
        this.release(images);
        return;
      }
      this.images.set(images);
    } catch {
      this.release(images);
      if (revision === this.revision)
        this.error.set(
          'No se pudieron consultar las fotos del equipo. Comprueba la conexión y la migración de perfiles de responsables.',
        );
    }
  }
}
