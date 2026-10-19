import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../icon.component';

@Component({
  imports: [IconComponent],
  selector: 'app-toast',
  styleUrl: './toast.component.css',
  templateUrl: './toast.component.html',
})
export class ToastComponent {
  readonly toasts = inject(ToastService);
  readonly labels = { success: 'Correcto', error: 'Error', warning: 'Aviso', info: 'Información' };
  readonly icons = {
    success: 'circle-check',
    error: 'circle-alert',
    warning: 'triangle-alert',
    info: 'info',
  };
}
