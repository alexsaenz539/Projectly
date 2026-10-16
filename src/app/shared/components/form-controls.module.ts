import { NgModule } from '@angular/core';
import { DatePickerComponent } from './date-picker.component';
import { ThemedSelectDirective } from './themed-select.directive';
import { SwitchDirective } from './switch.directive';

/** Import alongside FormsModule in new forms to reuse the Projectly controls. */
@NgModule({
  imports: [DatePickerComponent, ThemedSelectDirective, SwitchDirective],
  exports: [DatePickerComponent, ThemedSelectDirective, SwitchDirective],
})
export class FormControlsModule {}
