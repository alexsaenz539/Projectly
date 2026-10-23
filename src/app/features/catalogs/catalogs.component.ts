import { Component, inject } from '@angular/core';
import { WorkspaceService } from '../../core/services/workspace.service';
import { EditorService } from '../../core/services/editor.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { RouterLink } from '@angular/router';

@Component({
  imports: [PageHeaderComponent, RouterLink],
  selector: 'app-catalogs',
  styleUrl: './catalogs.component.css',
  templateUrl: './catalogs.component.html',
})
export class CatalogsComponent {
  readonly store = inject(WorkspaceService);
  readonly editor = inject(EditorService);
  readonly sections = [
    { kind: 'topic' as const, title: 'Temáticas', description: 'Relaciona tickets de distintos proyectos, por ejemplo: Hoteles o Reservas.' },
    { kind: 'version' as const, title: 'Versiones de entrega', description: 'Define las versiones del producto disponibles para asignar a los tickets.' },
  ];
  ticketCount(kind: 'topic' | 'version', name: string): number {
    return this.store.tickets().filter(ticket => kind === 'topic' ? ticket.topics?.includes(name) : ticket.target_version === name).length;
  }
}
