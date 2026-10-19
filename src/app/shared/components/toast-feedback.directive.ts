import { Directive, effect, inject, input, untracked } from '@angular/core';
import { ToastKind, ToastService } from '../../core/services/toast.service';

/** Mirrors operational feedback into the global host, keeping inline form context. */
@Directive({ selector: '[appToastFeedback]' })
export class ToastFeedbackDirective {
  readonly appToastFeedback = input('');
  readonly toastKind = input<ToastKind>('error');
  private readonly toasts = inject(ToastService);
  constructor() {
    effect(() => {
      const message = this.appToastFeedback();
      const kind = this.toastKind();
      if (message) untracked(() => this.toasts.show(message, kind));
    });
  }
}
