import { Component, ViewEncapsulation, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandLogoComponent } from '../../shared/components/brand-logo.component';
@Component({
  selector: 'app-auth-shell',
  imports: [RouterLink, BrandLogoComponent],
  templateUrl: './auth-shell.component.html',
  styleUrls: ['./auth-layout.css', './auth-forms.css', './auth-preview.css'],
  encapsulation: ViewEncapsulation.None,
})
export class AuthShellComponent {
  readonly registration = input(false);
  readonly demo = input(false);
  constructor() {
    try {
      const preferences = JSON.parse(
        localStorage.getItem('project-os-angular-preferences-v1') || '{}',
      );
      document.documentElement.classList.toggle('dark', preferences.dark === true);
    } catch {
      /* Keep the default theme if saved preferences are unavailable. */
    }
  }
}
