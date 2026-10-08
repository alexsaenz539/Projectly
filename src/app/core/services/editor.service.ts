import { Injectable, inject } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { Entity } from './models';
import { EntityEditorComponent, EditorData } from '../../shared/components/entity-editor.component';
@Injectable({ providedIn: 'root' })
export class EditorService {
  private readonly dialog = inject(Dialog);
  open(kind: EditorData['kind'], entity?: Entity) {
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
