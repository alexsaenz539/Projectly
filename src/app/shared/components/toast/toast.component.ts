import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  imports: [],
  selector: 'app-toast',
  styleUrl: './toast.component.css',
  templateUrl: './toast.component.html',
})
export class ToastComponent {
  readonly toasts = inject(ToastService);
  readonly labels = { success: 'Correcto', error: 'Error', warning: 'Aviso', info: 'Información' };
}
