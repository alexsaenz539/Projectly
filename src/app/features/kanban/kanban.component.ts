import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { WorkspaceService } from '../../core/services/workspace.service';
import { EditorService } from '../../core/services/editor.service';
import { STATUSES, Status, Ticket } from '../../core/services/models';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { IconComponent } from '../../shared/components/icon.component';
import { BadgeComponent } from '../../shared/components/badge.component';
@Component({
  selector: 'app-kanban',
  imports: [FormsModule, DragDropModule, PageHeaderComponent, IconComponent, BadgeComponent],
  templateUrl: './kanban.component.html',
})
export class KanbanComponent {
  readonly store = inject(WorkspaceService);
  readonly editor = inject(EditorService);
  readonly statuses = STATUSES;
  tickets(status: Status) {
    return this.store.tickets().filter((t) => t.status === status);
  }
  drop(event: CdkDragDrop<Status, Status, Ticket>) {
    if (event.item.data.status !== event.container.data)
      void this.store.moveTicket(event.item.data, event.container.data);
  }
}
