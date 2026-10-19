import { Component, ElementRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { firstValueFrom } from 'rxjs';
import { WorkspaceService } from '../../core/services/workspace.service';
import {
  WorkspaceRecord,
  workspaceErrors,
  workspaceSlug,
} from '../../core/services/workspace-record';
import { DEMO_WORKSPACE_ID } from '../../core/services/local-workspaces';
import { TicketScreenshotsService } from '../../core/services/ticket-screenshots.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../shared/components/confirm-dialog.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { IconComponent } from '../../shared/components/icon.component';
import { ToastFeedbackDirective } from '../../shared/components/toast-feedback.directive';
@Component({
  selector: 'app-workspaces',
  imports: [FormsModule, PageHeaderComponent, IconComponent, ToastFeedbackDirective],
  templateUrl: './workspaces.component.html',
  styleUrl: './workspaces.component.css',
})
export class WorkspacesComponent {
  readonly store = inject(WorkspaceService);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly screenshots = inject(TicketScreenshotsService);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly feedback = signal('');
  readonly directoryFeedback = signal('');
  readonly editingId = signal<string | null>(null);
  readonly demoWorkspaceId = DEMO_WORKSPACE_ID;
  name = '';
  slug = '';
  description = '';
  slugEdited = false;
  errors = { name: '', slug: '', description: '' };
  nameChanged(value: string) {
    this.name = value;
    this.errors.name = '';
    if (!this.slugEdited) {
      this.slug = workspaceSlug(value);
      this.errors.slug = '';
    }
    this.feedback.set('');
  }
  edit(space: WorkspaceRecord) {
    if (this.store.spaceBusy() || this.store.busy()) return;
    this.editingId.set(space.id);
    this.name = space.name;
    this.slug = space.slug;
    this.description = space.description;
    this.slugEdited = true;
    this.errors = { name: '', slug: '', description: '' };
    this.feedback.set('');
    const input = this.element.nativeElement.querySelector<HTMLInputElement>('#workspace-name');
    input?.scrollIntoView({ block: 'center', behavior: 'instant' });
    input?.focus({ preventScroll: true });
  }
  cancelEdit() {
    this.editingId.set(null);
    this.name = this.slug = this.description = '';
    this.slugEdited = false;
    this.errors = { name: '', slug: '', description: '' };
    this.feedback.set('');
  }
  async save() {
    if (this.store.spaceBusy()) return;
    this.slug = this.slug.trim();
    this.errors = workspaceErrors(
      this.name,
      this.slug,
      this.description,
      this.store.workspaceDirectory(),
      this.editingId() ?? undefined,
    );
    this.feedback.set('');
    const invalid = (Object.keys(this.errors) as (keyof typeof this.errors)[]).find(
      (key) => this.errors[key],
    );
    if (invalid) {
      this.element.nativeElement.querySelector<HTMLElement>('#workspace-' + invalid)?.focus();
      return;
    }
    try {
      const id = this.editingId();
      if (id) {
        await this.store.updateWorkspace(id, this.name, this.slug, this.description);
        this.cancelEdit();
      } else {
        await this.store.createWorkspace(this.name, this.slug, this.description);
        await this.router.navigate(['/dashboard']);
      }
    } catch (error) {
      this.feedback.set(error instanceof Error ? error.message : 'No se pudo guardar el espacio.');
    }
  }
  async remove(space: WorkspaceRecord) {
    if (this.store.spaceBusy() || this.store.busy()) return;
    this.directoryFeedback.set('');
    const confirmed = await firstValueFrom(
      this.dialog.open<boolean>(ConfirmDialogComponent, {
        data: {
          title: 'Eliminar espacio',
          message: `Se eliminará permanentemente «${space.name}» junto con todos sus proyectos, tickets, sprints, miembros y notificaciones. Esta acción no se puede deshacer.`,
          confirmationText: space.name,
          confirmLabel: 'Eliminar espacio',
        } satisfies ConfirmDialogData,
        width: '510px',
        maxWidth: 'calc(100vw - 32px)',
        ariaLabel: 'Confirmar eliminación del espacio',
        autoFocus: 'input',
        restoreFocus: true,
      }).closed,
    );
    if (!confirmed) return;
    try {
      await this.store.removeWorkspace(space.id);
      if (this.editingId() === space.id) this.cancelEdit();
      try {
        await this.screenshots.cleanup(space.id);
      } catch {
        this.directoryFeedback.set(
          'El espacio ya se eliminó, pero no se pudieron limpiar sus capturas. Revisa el bucket de Supabase.',
        );
      }
    } catch (error) {
      this.directoryFeedback.set(
        error instanceof Error ? error.message : 'No se pudo eliminar el espacio.',
      );
    }
  }
  async open(id: string) {
    if (await this.store.selectWorkspace(id)) await this.router.navigate(['/dashboard']);
  }
}
