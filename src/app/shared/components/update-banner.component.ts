import { Component, inject } from '@angular/core';
import { DesktopUpdateService } from '../../core/services/desktop-update.service';
@Component({
  selector: 'app-update-banner',
  templateUrl: './update-banner.component.html',
})
export class UpdateBannerComponent {
  readonly updates = inject(DesktopUpdateService);
}
