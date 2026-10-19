import { Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormControlsModule } from '../../shared/components/form-controls.module';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { InitialsPipe } from '../../shared/pipes/initials.pipe';
import { ProfileService } from '../../core/services/profile.service';
import { PROFILE_AVATARS, presetAvatar, profileErrors } from '../../core/services/profile-model';
import { prepareProfilePhoto } from '../../core/services/profile-photo';

@Component({
  imports: [FormsModule, FormControlsModule, PageHeaderComponent, InitialsPipe],
  selector: 'app-profile',
  styleUrl: './profile.component.css',
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnDestroy {
  readonly profile = inject(ProfileService);
  readonly avatars = PROFILE_AVATARS;
  readonly error = signal('');
  readonly success = signal('');
  readonly processing = signal(false);
  name = this.profile.name();
  bio = this.profile.bio();
  avatar = this.profile.avatar();
  private photo: File | null = null;
  private photoUrl = '';
  private selection = 0;
  private account = this.profile.auth.user()?.id;

  constructor() {
    effect(() => {
      const id = this.profile.auth.user()?.id;
      if (id !== this.account) {
        this.account = id;
        this.reset();
      }
    });
  }
  get preview(): string {
    return this.avatar === 'custom'
      ? this.photoUrl || (this.profile.avatar() === 'custom' ? this.profile.image() : '')
      : presetAvatar(this.avatar);
  }
  get dirty(): boolean {
    return (
      this.name !== this.profile.name() ||
      this.bio !== this.profile.bio() ||
      this.avatar !== this.profile.avatar() ||
      this.photo !== null
    );
  }
  choose(avatar: string) {
    this.avatar = avatar;
    this.error.set('');
    this.success.set('');
  }
  async selectPhoto(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const selection = ++this.selection;
    this.processing.set(true);
    this.error.set('');
    this.success.set('');
    try {
      const photo = await prepareProfilePhoto(file);
      if (selection !== this.selection) return;
      this.clearPhoto();
      this.photo = photo;
      this.photoUrl = URL.createObjectURL(photo);
      this.avatar = 'custom';
    } catch (error) {
      if (selection === this.selection)
        this.error.set(error instanceof Error ? error.message : 'No se pudo preparar la imagen.');
    } finally {
      if (selection === this.selection) this.processing.set(false);
    }
  }
  reset() {
    this.selection++;
    this.processing.set(false);
    this.clearPhoto();
    this.name = this.profile.name();
    this.bio = this.profile.bio();
    this.avatar = this.profile.avatar();
    this.error.set('');
    this.success.set('');
  }
  async save() {
    if (this.profile.busy() || this.processing()) return;
    this.error.set('');
    this.success.set('');
    const error = profileErrors({ name: this.name, bio: this.bio, avatar: this.avatar });
    if (error) {
      this.error.set(error);
      return;
    }
    const account = this.account;
    try {
      await this.profile.save(
        { name: this.name, bio: this.bio, avatar: this.avatar },
        this.avatar === 'custom' ? this.photo : null,
      );
      if (account !== this.profile.auth.user()?.id) return;
      this.reset();
      this.success.set('Tu perfil se guardó correctamente.');
    } catch (error) {
      if (account === this.profile.auth.user()?.id)
        this.error.set(error instanceof Error ? error.message : 'No se pudo guardar el perfil.');
    }
  }
  private clearPhoto() {
    if (this.photoUrl) URL.revokeObjectURL(this.photoUrl);
    this.photoUrl = '';
    this.photo = null;
  }
  ngOnDestroy() {
    this.selection++;
    this.clearPhoto();
  }
}
