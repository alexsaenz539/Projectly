import { Component, input } from '@angular/core';
@Component({
  selector: 'app-page-header',
  templateUrl: './page-header.component.html',
})
export class PageHeaderComponent {
  title = input.required<string>();
  eyebrow = input('Gestión');
  subtitle = input('');
}
