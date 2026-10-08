import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { WorkspaceService } from '../../core/services/workspace.service';
import { EditorService } from '../../core/services/editor.service';
import { day } from '../../core/services/models';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
@Component({
  selector: 'app-notifications',
  imports: [DatePipe, PageHeaderComponent],
  templateUrl: './notifications.component.html',
})
export class NotificationsComponent {
  readonly store = inject(WorkspaceService);
  readonly editor = inject(EditorService);
  readonly urgent = computed(() =>
    this.store
      .tickets()
      .filter(
        (t) => t.status !== 'Completado' && (t.status === 'Bloqueado' || (t.due && t.due < day())),
      ),
  );
  readonly recent = computed(() =>
    [...this.store.notifications()].sort((a, b) => b.created_at.localeCompare(a.created_at)),
  );
}
