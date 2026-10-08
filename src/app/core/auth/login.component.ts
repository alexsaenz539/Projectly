import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from './auth.service';
import { BrandLogoComponent } from '../../shared/components/brand-logo.component';
@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, BrandLogoComponent],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly register = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');
  email = '';
  password = '';
  async submit() {
    this.busy.set(true);
    this.message.set('');
    try {
      if (this.register()) {
        if (!(await this.auth.signUp(this.email.trim(), this.password))) {
          this.message.set('Revisa tu correo para confirmar la cuenta y luego inicia sesión.');
          return;
        }
      } else await this.auth.signIn(this.email.trim(), this.password);
      await this.router.navigate(['/mis-tareas']);
    } catch (error) {
      this.message.set(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      this.busy.set(false);
    }
  }
}
