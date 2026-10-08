import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WorkspaceService } from '../../core/services/workspace.service';
import { EditorService } from '../../core/services/editor.service';
import { STATUSES } from '../../core/services/models';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { IconComponent } from '../../shared/components/icon.component';
import { TicketTableComponent } from '../../shared/components/ticket-table.component';
@Component({
  selector: 'app-tickets',
  imports: [FormsModule, PageHeaderComponent, IconComponent, TicketTableComponent],
  templateUrl: './tickets.component.html',
})
export class TicketsComponent {
  readonly store = inject(WorkspaceService);
  readonly editor = inject(EditorService);
  readonly statuses = STATUSES;
  readonly query = signal('');
  readonly status = signal('');
  readonly project = signal('');
  readonly visible = computed(() =>
    this.store
      .tickets()
      .filter(
        (t) =>
          `${t.key} ${t.title}`.toLocaleLowerCase().includes(this.query().toLocaleLowerCase()) &&
          (!this.status() || t.status === this.status()) &&
          (!this.project() || t.project_id === this.project()),
      ),
  );
}
