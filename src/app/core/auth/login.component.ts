import { Component, ElementRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from './auth.service';
import { AuthShellComponent } from './auth-shell.component';
import { emailError, passwordError } from './auth-validation';
@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, AuthShellComponent],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly showPassword = signal(false);
  errors = { email: '', password: '' };
  email = '';
  password = '';
  async submit() {
    if (this.busy()) return;
    this.errors = { email: emailError(this.email), password: passwordError(this.password) };
    this.message.set('');
    const invalid = this.errors.email
      ? 'signin-email'
      : this.errors.password
        ? 'signin-password'
        : '';
    if (invalid) {
      this.element.nativeElement.querySelector<HTMLInputElement>('#' + invalid)?.focus();
      return;
    }
    this.busy.set(true);
    try {
      await this.auth.signIn(this.email.trim(), this.password);
      this.password = '';
      await this.router.navigate(['/mis-tareas']);
    } catch (error) {
      this.message.set(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      this.busy.set(false);
    }
  }
}
