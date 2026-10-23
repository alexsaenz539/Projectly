import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControlsModule } from '../../shared/components/form-controls.module';
import { WorkspaceService } from '../../core/services/workspace.service';
import { EditorService } from '../../core/services/editor.service';
import { PRIORITIES, STATUSES } from '../../core/services/models';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { IconComponent } from '../../shared/components/icon.component';
import { TicketTableComponent } from '../../shared/components/ticket-table.component';
import { EMPTY_TICKET_FILTERS, TicketFilters, filterTickets, paginateTickets } from '../../core/services/ticket-list';
@Component({
  selector: 'app-tickets',
  imports: [
    FormsModule,
    PageHeaderComponent,
    IconComponent,
    TicketTableComponent,
    FormControlsModule,
  ],
  templateUrl: './tickets.component.html',
  styleUrl: './tickets.component.css',
})
export class TicketsComponent {
  readonly store = inject(WorkspaceService);
  readonly editor = inject(EditorService);
  readonly statuses = STATUSES;
  readonly priorities = PRIORITIES;
  private readonly route = inject(ActivatedRoute);
  private readonly routeQuery = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  readonly filters = linkedSignal(() => {
    const workspace = this.store.activeWorkspaceId();
    const params = this.routeQuery();
    const sameWorkspace = !params.get('workspace') || params.get('workspace') === workspace;
    return { ...EMPTY_TICKET_FILTERS,
      topic: sameWorkspace ? params.get('topic') ?? '' : '',
      version: sameWorkspace ? params.get('version') ?? '' : '',
    };
  });
  readonly pageSize = signal(25);
  readonly page = linkedSignal(() => {
    this.filters();
    this.pageSize();
    return 1;
  });
  readonly versions = this.store.versions;
  readonly visible = computed(() => filterTickets(this.store.tickets(), this.filters()));
  readonly pagination = computed(() => paginateTickets(this.visible(), this.page(), this.pageSize()));
  setFilter(key: keyof TicketFilters, value: string): void {
    this.filters.update(filters => ({ ...filters, [key]: value }));
  }
  resetFilters(): void {
    this.filters.set({ ...EMPTY_TICKET_FILTERS });
  }
}
