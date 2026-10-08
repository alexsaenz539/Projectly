import { Component, ElementRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from './auth.service';
import { AuthShellComponent } from './auth-shell.component';
import { registrationErrors } from './auth-validation';
@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink, AuthShellComponent],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  readonly auth = inject(AuthService);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly success = signal(false);
  readonly hasSession = signal(false);
  readonly showPassword = signal(false);
  readonly showConfirm = signal(false);
  errors = { fullName: '', email: '', password: '', confirm: '' };
  fullName = '';
  email = '';
  password = '';
  confirm = '';
  async submit() {
    if (this.busy() || this.success()) return;
    this.errors = registrationErrors(this.fullName, this.email, this.password, this.confirm);
    this.message.set('');
    const invalid = (Object.keys(this.errors) as (keyof typeof this.errors)[]).find(
      (key) => this.errors[key],
    );
    if (invalid) {
      this.element.nativeElement
        .querySelector<HTMLInputElement>('[name="' + invalid + '"]')
        ?.focus();
      return;
    }
    this.busy.set(true);
    try {
      this.hasSession.set(
        await this.auth.signUp(this.email.trim(), this.password, this.fullName.trim()),
      );
      this.password = '';
      this.confirm = '';
      this.success.set(true);
      setTimeout(() =>
        this.element.nativeElement.querySelector<HTMLElement>('.auth-success h2')?.focus(),
      );
    } catch (error) {
      this.message.set(error instanceof Error ? error.message : 'No se pudo crear el usuario.');
    } finally {
      this.busy.set(false);
    }
  }
}
