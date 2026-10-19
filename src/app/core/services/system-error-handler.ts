import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ToastService } from './toast.service';
@Injectable()
export class SystemErrorHandler extends ErrorHandler {
  private readonly toasts = inject(ToastService);
  override handleError(error: unknown): void {
    super.handleError(error);
    this.toasts.error(
      'Ocurrió un error inesperado. Inténtalo de nuevo; si continúa, reinicia la aplicación.',
    );
  }
}
