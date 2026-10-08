import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { WorkspaceService } from '../../core/services/workspace.service';
import { EditorService } from '../../core/services/editor.service';
import { Sprint } from '../../core/services/models';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { IconComponent } from '../../shared/components/icon.component';
import { BadgeComponent } from '../../shared/components/badge.component';
@Component({
  selector: 'app-sprints',
  imports: [DatePipe, PageHeaderComponent, IconComponent, BadgeComponent],
  templateUrl: './sprints.component.html',
})
export class SprintsComponent {
  readonly store = inject(WorkspaceService);
  readonly editor = inject(EditorService);
  count(id: string) {
    return this.store.tickets().filter((t) => t.sprint_id === id).length;
  }
  completed(id: string) {
    return this.store.tickets().filter((t) => t.sprint_id === id && t.status === 'Completado')
      .length;
  }
  toggle(s: Sprint) {
    void this.store.save('sprints', { ...s, status: s.status === 'Activo' ? 'Cerrado' : 'Activo' });
  }
}
