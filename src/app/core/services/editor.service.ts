import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { WorkspaceService } from './workspace.service';
import { Dialog } from '@angular/cdk/dialog';
import { Entity } from './models';
import { EntityEditorComponent, EditorData } from '../../shared/components/entity-editor.component';
@Injectable({ providedIn: 'root' })
export class EditorService {
  private readonly dialog = inject(Dialog);
  private readonly store = inject(WorkspaceService);
  private readonly router = inject(Router);
  open(kind: EditorData['kind'], entity?: Entity) {
    if (!this.store.hasWorkspace()) {
      this.store.notify('Crea o selecciona un espacio de trabajo.');
      void this.router.navigate(['/workspaces']);
      return;
    }
    if (this.store.loading()) {
      this.store.notify('Espera a que termine de cargar el espacio.');
      return;
    }
    this.dialog.open(EntityEditorComponent, {
      data: { kind, entity },
      width: '510px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'input',
      restoreFocus: true,
      ariaLabel: entity ? 'Editar registro' : 'Nuevo registro',
    });
  }
}
