import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WorkspaceService } from '../../core/services/workspace.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { DesktopUpdateService } from '../../core/services/desktop-update.service';
@Component({
  selector: 'app-settings',
  imports: [FormsModule, PageHeaderComponent],
  templateUrl: './settings.component.html',
})
export class SettingsComponent {
  readonly updates = inject(DesktopUpdateService);
  readonly store = inject(WorkspaceService);
  readonly confirmReset = signal(false);
  exportBackup() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(this.store.data(), null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'projectly-respaldo.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
