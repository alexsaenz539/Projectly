import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { WorkspaceService } from '../../core/services/workspace.service';
import { EditorService } from '../../core/services/editor.service';
import { PRIORITIES, STATUSES, Status, Ticket } from '../../core/services/models';
import { FormControlsModule } from '../../shared/components/form-controls.module';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { IconComponent } from '../../shared/components/icon.component';
import { BadgeComponent } from '../../shared/components/badge.component';
import { AssigneeAvatarComponent } from '../../shared/components/assignee-avatar/assignee-avatar.component';
@Component({
  selector: 'app-kanban',
  imports: [
    DragDropModule,
    FormsModule,
    FormControlsModule,
    PageHeaderComponent,
    IconComponent,
    BadgeComponent,
    AssigneeAvatarComponent,
  ],
  templateUrl: './kanban.component.html',
  styleUrl: './kanban.component.css',
})
export class KanbanComponent {
  readonly store = inject(WorkspaceService);
  readonly editor = inject(EditorService);
  readonly statuses = STATUSES;
  readonly priorities = PRIORITIES;
  readonly query = signal('');
  readonly project = signal('');
  readonly assignee = signal('');
  readonly priority = signal('');
  readonly version = signal('');
  readonly versions = computed(() =>
    [
      ...new Set(
        this.store
          .tickets()
          .map((ticket) => ticket.target_version)
          .filter((version): version is string => !!version),
      ),
    ].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })),
  );
  readonly hasFilters = computed(
    () =>
      !!(
        this.query().trim() ||
        this.project() ||
        this.assignee() ||
        this.priority() ||
        this.version()
      ),
  );
  readonly visible = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    return this.store
      .tickets()
      .filter(
        (ticket) =>
          `${ticket.key} ${ticket.title}`.toLocaleLowerCase().includes(query) &&
          (!this.project() || ticket.project_id === this.project()) &&
          (!this.assignee() ||
            (this.assignee() === '__none__'
              ? !ticket.assignee
              : ticket.assignee === this.assignee())) &&
          (!this.priority() || ticket.priority === this.priority()) &&
          (!this.version() ||
            (this.version() === '__none__'
              ? !ticket.target_version
              : ticket.target_version === this.version())),
      );
  });
  constructor() {
    effect(() => {
      this.store.activeWorkspaceId();
      untracked(() => this.clearFilters());
    });
  }
  clearFilters() {
    this.query.set('');
    this.project.set('');
    this.assignee.set('');
    this.priority.set('');
    this.version.set('');
  }
  tickets(status: Status) {
    return this.visible().filter((t) => t.status === status);
  }
  drop(event: CdkDragDrop<Status, Status, Ticket>) {
    if (event.item.data.status !== event.container.data)
      void this.store.moveTicket(event.item.data, event.container.data);
  }
}
