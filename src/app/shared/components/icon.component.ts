import { Component, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
@Component({
  selector: 'app-icon',
  imports: [LucideDynamicIcon],
  templateUrl: './icon.component.html',
  styles: [':host{display:inline-flex;align-items:center;flex-shrink:0}'],
})
export class IconComponent {
  name = input.required<string>();
  size = input(18);
}
