import { Component, input } from '@angular/core';
@Component({
  selector: 'app-brand-logo',
  templateUrl: './brand-logo.component.html',
  styleUrl: './brand-logo.component.css',
})
export class BrandLogoComponent {
  readonly compact = input(false);
}
