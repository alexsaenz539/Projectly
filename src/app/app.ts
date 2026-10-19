import { Component, afterNextRender, inject } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { DesktopUpdateService } from './core/services/desktop-update.service';
import { RouterOutlet } from '@angular/router';
import { UpdateBannerComponent } from './shared/components/update-banner.component';
import { ToastComponent } from './shared/components/toast/toast.component';

@Component({
  imports: [RouterOutlet, UpdateBannerComponent, ToastComponent],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly updates = inject(DesktopUpdateService);
  private readonly dialog = inject(Dialog);
  constructor() {
    afterNextRender(() => {
      void this.showReleaseNotes();
    });
  }
  private async showReleaseNotes(): Promise<void> {
    const release = await this.updates.installedRelease();
    if (!release) return;
    try {
      const { ReleaseNotesComponent } =
        await import('./shared/components/release-notes/release-notes.component');
      this.dialog
        .open(ReleaseNotesComponent, {
          data: release,
          width: '560px',
          maxWidth: 'calc(100vw - 32px)',
          ariaLabelledBy: 'release-notes-title',
          autoFocus: 'first-tabbable',
          restoreFocus: true,
        })
        .closed.subscribe(() => {
          void this.updates
            .acknowledgeInstalledRelease()
            .catch(() =>
              this.updates.error.set(
                'No se pudo guardar la lectura de las novedades. Volverán a mostrarse al abrir la aplicación.',
              ),
            );
        });
    } catch {
      this.updates.error.set('No se pudieron mostrar las novedades de esta versión.');
    }
  }
}
