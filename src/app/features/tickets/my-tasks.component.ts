import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { WorkspaceService } from '../../core/services/workspace.service';
import { EditorService } from '../../core/services/editor.service';
import { day } from '../../core/services/models';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { BadgeComponent } from '../../shared/components/badge.component';
@Component({
  selector: 'app-my-tasks',
  imports: [DatePipe, PageHeaderComponent, BadgeComponent],
  templateUrl: './my-tasks.component.html',
})
export class MyTasksComponent {
  readonly store = inject(WorkspaceService);
  readonly editor = inject(EditorService);
  readonly filters = ['Todas', 'Hoy', 'Próximas', 'Atrasadas'];
  readonly filter = signal('Todas');
  readonly visible = computed(() =>
    this.store
      .tickets()
      .filter((t) => t.assignee === this.store.myMemberId())
      .filter(
        (t) =>
          this.filter() === 'Todas' ||
          (t.status !== 'Completado' &&
            Boolean(t.due) &&
            (this.filter() === 'Hoy'
              ? t.due === day()
              : this.filter() === 'Próximas'
                ? t.due! > day()
                : t.due! < day())),
      ),
  );
}
