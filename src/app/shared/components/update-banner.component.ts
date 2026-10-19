import { Component, inject } from '@angular/core';
import { DesktopUpdateService } from '../../core/services/desktop-update.service';
import { ToastFeedbackDirective } from './toast-feedback.directive';
@Component({
  selector: 'app-update-banner',
  imports: [ToastFeedbackDirective],
  templateUrl: './update-banner.component.html',
})
export class UpdateBannerComponent {
  readonly updates = inject(DesktopUpdateService);
}
