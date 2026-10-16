import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { WorkspaceService } from '../../core/services/workspace.service';
import { BadgeComponent } from '../../shared/components/badge.component';
import { TicketScreenshotsComponent } from '../../shared/components/ticket-screenshots.component';

@Component({
  imports: [DatePipe, RouterLink, BadgeComponent, TicketScreenshotsComponent],
  selector: 'app-ticket-page',
  styleUrl: './ticket-page.component.css',
  templateUrl: './ticket-page.component.html',
})
export class TicketPageComponent {
  readonly store = inject(WorkspaceService);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  readonly wrongWorkspace = computed(() => {
    const workspace = this.query().get('workspace');
    return !!workspace && workspace !== this.store.activeWorkspaceId();
  });
  readonly ticket = computed(() => this.wrongWorkspace() ? undefined :
    this.store.tickets().find(ticket => ticket.id === this.params().get('id')));
  readonly sprintName = computed(() =>
    this.store.sprints().find(sprint => sprint.id === this.ticket()?.sprint_id)?.name || 'Sin sprint');
}
