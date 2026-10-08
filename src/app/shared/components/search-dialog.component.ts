import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogRef } from '@angular/cdk/dialog';
import { Router } from '@angular/router';
import { WorkspaceService } from '../../core/services/workspace.service';
import { EditorService } from '../../core/services/editor.service';
import { Ticket } from '../../core/services/models';
import { IconComponent } from './icon.component';
import { AutofocusDirective } from '../directives/autofocus.directive';
@Component({
  selector: 'app-search-dialog',
  imports: [FormsModule, IconComponent, AutofocusDirective],
  templateUrl: './search-dialog.component.html',
})
export class SearchDialogComponent {
  readonly store = inject(WorkspaceService);
  readonly ref = inject(DialogRef);
  private readonly router = inject(Router);
  private readonly editor = inject(EditorService);
  readonly query = signal('');
  readonly projects = computed(() =>
    this.store
      .projects()
      .filter((p) =>
        `${p.key} ${p.name}`.toLocaleLowerCase().includes(this.query().trim().toLocaleLowerCase()),
      )
      .slice(0, 6),
  );
  readonly tickets = computed(() =>
    this.store
      .tickets()
      .filter((t) =>
        `${t.key} ${t.title}`.toLocaleLowerCase().includes(this.query().trim().toLocaleLowerCase()),
      )
      .slice(0, 8),
  );
  openProject(id: string) {
    this.ref.close();
    void this.router.navigate(['/projects'], { queryParams: { project: id } });
  }
  openTicket(ticket: Ticket) {
    this.ref.close();
    this.editor.open('ticket', ticket);
  }
}
