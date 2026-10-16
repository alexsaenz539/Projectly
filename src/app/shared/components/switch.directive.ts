import { Directive } from '@angular/core';

/** Keep native checkbox/form behavior while presenting a consistent binary switch. */
@Directive({
  selector: 'input[type=checkbox][appSwitch]',
  host: { class: 'app-switch', role: 'switch' },
})
export class SwitchDirective {}
