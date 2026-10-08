import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { WorkspaceService } from '../../core/services/workspace.service';
import { EditorService } from '../../core/services/editor.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { IconComponent } from '../../shared/components/icon.component';
@Component({
  selector: 'app-projects',
  imports: [FormsModule, PageHeaderComponent, IconComponent],
  templateUrl: './projects.component.html',
})
export class ProjectsComponent {
  readonly store = inject(WorkspaceService);
  readonly editor = inject(EditorService);
  readonly archived = signal(false);
  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap);
  readonly selected = computed(() => this.query()?.get('project'));
  readonly visible = computed(() =>
    this.store
      .projects()
      .filter((p) => this.archived() || p.status === 'Activo' || p.id === this.selected()),
  );
  ticketCount(id: string) {
    return this.store.tickets().filter((t) => t.project_id === id).length;
  }
}
