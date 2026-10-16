import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { WorkspaceService } from './workspace.service';
import { Dialog } from '@angular/cdk/dialog';
import { Entity, Ticket } from './models';
import { EntityEditorComponent, EditorData } from '../../shared/components/entity-editor.component';
import { TicketDetailsComponent } from '../../shared/components/ticket-details.component';
@Injectable({ providedIn: 'root' })
export class EditorService {
  private readonly dialog = inject(Dialog);
  private readonly store = inject(WorkspaceService);
  private readonly router = inject(Router);
  private canOpen(): boolean {
    if (!this.store.hasWorkspace()) {
      this.store.notify('Crea o selecciona un espacio de trabajo.');
      void this.router.navigate(['/workspaces']);
      return false;
    }
    if (this.store.loading()) {
      this.store.notify('Espera a que termine de cargar el espacio.');
      return false;
    }
    return true;
  }
  viewTicket(ticket: Ticket): void {
    if (!this.canOpen()) return;
    this.dialog.open(TicketDetailsComponent, {
      data: ticket,
      width: '680px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaLabel: 'Detalle del ticket ' + ticket.key,
    });
  }
  open(kind: EditorData['kind'], entity?: Entity, projectId?: string) {
    if (!this.canOpen()) return;
    this.dialog.open(EntityEditorComponent, {
      data: { kind, entity, projectId },
      width: '510px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'input',
      restoreFocus: true,
      ariaLabel: entity ? 'Editar registro' : 'Nuevo registro',
    });
  }
}
