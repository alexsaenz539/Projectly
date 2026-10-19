import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { ProfileDraft, presetAvatar, profileErrors } from './profile-model';
import { photoDataUrl } from './profile-photo';
import { validateScreenshot } from './screenshot-validation';

const LOCAL_KEY = 'projectly-demo-profile-v1';
const BUCKET = 'profile-avatars';
interface DemoProfile extends ProfileDraft {
  photo: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  readonly auth = inject(AuthService);
  private readonly demo = signal<DemoProfile>(this.loadDemo());
  private readonly customUrl = signal('');
  readonly imageError = signal('');
  readonly busy = signal(false);
  readonly warning = signal('');
  readonly name = computed(() =>
    this.auth.isDemo
      ? this.demo().name
      : String(this.auth.user()?.user_metadata?.['full_name'] ?? ''),
  );
  readonly bio = computed(() =>
    this.auth.isDemo ? this.demo().bio : String(this.auth.user()?.user_metadata?.['bio'] ?? ''),
  );
  readonly avatar = computed(() =>
    this.auth.isDemo
      ? this.demo().avatar
      : String(this.auth.user()?.user_metadata?.['profile_avatar'] ?? ''),
  );
  readonly displayName = computed(() => this.name() || this.auth.user()?.email || 'Mi perfil');
  readonly image = computed(() =>
    this.avatar() === 'custom'
      ? this.auth.isDemo
        ? this.demo().photo
        : this.customUrl()
      : presetAvatar(this.avatar()),
  );
  private imageRevision = 0;

  constructor() {
    effect(() => {
      const user = this.auth.user();
      const path = String(user?.user_metadata?.['profile_photo_path'] ?? '');
      const revision = ++this.imageRevision;
      untracked(() => this.replaceUrl(''));
      this.imageError.set('');
      if (
        !this.auth.isDemo &&
        user &&
        user.user_metadata?.['profile_avatar'] === 'custom' &&
        this.ownsPath(path, user.id)
      )
        void this.loadPhoto(path, revision);
    });
  }
  private loadDemo(): DemoProfile {
    const empty: DemoProfile = { name: 'Usuario demo', bio: '', avatar: '', photo: '' };
    if (!this.auth.isDemo) return empty;
    try {
      const value = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
      if (
        !value ||
        typeof value.name !== 'string' ||
        typeof value.bio !== 'string' ||
        typeof value.avatar !== 'string' ||
        profileErrors(value)
      )
        return empty;
      return {
        ...value,
        photo:
          typeof value.photo === 'string' &&
          /^data:image\/(webp|png|jpeg);base64,/.test(value.photo)
            ? value.photo
            : '',
      };
    } catch {
      return empty;
    }
  }
  private ownsPath(path: string, userId: string): boolean {
    return (
      path.startsWith(userId + '/') &&
      /^[a-zA-Z0-9-]+\.(webp|png|jpg)$/.test(path.slice(userId.length + 1))
    );
  }
  private replaceUrl(url: string) {
    const previous = this.customUrl();
    this.customUrl.set(url);
    if (previous.startsWith('blob:')) URL.revokeObjectURL(previous);
  }
  private async loadPhoto(path: string, revision: number) {
    try {
      const result = await this.auth.client!.storage.from(BUCKET).download(path);
      if (revision !== this.imageRevision) return;
      if (result.error) throw result.error;
      this.replaceUrl(URL.createObjectURL(result.data));
    } catch {
      if (revision === this.imageRevision)
        this.imageError.set('No se pudo cargar tu foto. Puedes volver a subirla desde Mi perfil.');
    }
  }
  async save(draft: ProfileDraft, photo: File | null): Promise<void> {
    const error = profileErrors(draft);
    if (error) throw new Error(error);
    if (this.busy()) throw new Error('Espera a que termine el guardado.');
    if (!this.auth.hasAccess()) throw new Error('Inicia sesión para editar tu perfil.');
    this.busy.set(true);
    this.warning.set('');
    const user = this.auth.user();
    const client = this.auth.client;
    let uploaded = '';
    let committed = false;
    try {
      if (photo) {
        await validateScreenshot(photo);
        if (photo.size > 512 * 1024) throw new Error('La foto debe procesarse antes de guardarla.');
      }
      if (this.auth.isDemo) {
        const value: DemoProfile = {
          name: draft.name.trim(),
          bio: draft.bio.trim(),
          avatar: draft.avatar,
          photo:
            draft.avatar === 'custom'
              ? photo
                ? await photoDataUrl(photo)
                : this.demo().photo
              : '',
        };
        if (value.avatar === 'custom' && !value.photo) throw new Error('Selecciona una foto.');
        localStorage.setItem(LOCAL_KEY, JSON.stringify(value));
        this.demo.set(value);
        return;
      }
      if (!user || !client) throw new Error('No se pudo conectar con tu cuenta.');
      const assertSession = () => {
        if (this.auth.user()?.id !== user.id)
          throw new Error('La sesión ha cambiado. Vuelve a abrir Mi perfil.');
      };
      const previous = String(user.user_metadata?.['profile_photo_path'] ?? '');
      let path = draft.avatar === 'custom' && this.ownsPath(previous, user.id) ? previous : '';
      if (draft.avatar === 'custom' && photo) {
        assertSession();
        uploaded = `${user.id}/${crypto.randomUUID()}.${photo.type === 'image/png' ? 'png' : photo.type === 'image/jpeg' ? 'jpg' : 'webp'}`;
        const result = await client.storage
          .from(BUCKET)
          .upload(uploaded, photo, { contentType: photo.type, upsert: false });
        if (result.error)
          throw new Error(
            'No se pudo subir la foto. Comprueba la conexión y la migración profile-avatars.',
          );
        path = uploaded;
      }
      if (draft.avatar === 'custom' && !path) throw new Error('Selecciona una foto.');
      assertSession();
      const result = await client.auth.updateUser({
        data: {
          full_name: draft.name.trim(),
          bio: draft.bio.trim(),
          profile_avatar: draft.avatar,
          profile_photo_path: path,
        },
      });
      if (result.error) throw result.error;
      committed = true;
      assertSession();
      this.auth.user.set(result.data.user);
      if (previous && previous !== path && this.ownsPath(previous, user.id)) {
        try {
          const cleanup = await client.storage.from(BUCKET).remove([previous]);
          if (cleanup.error) throw cleanup.error;
        } catch {
          this.warning.set(
            'Perfil guardado, pero no se pudo eliminar la foto anterior del almacenamiento.',
          );
        }
      }
    } catch (error) {
      if (uploaded && !committed && client) {
        try {
          await client.storage.from(BUCKET).remove([uploaded]);
        } catch {
          /* No reemplazar el error original. */
        }
      }
      throw error;
    } finally {
      this.busy.set(false);
    }
  }
}
