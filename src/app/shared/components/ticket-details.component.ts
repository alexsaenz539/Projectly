import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Ticket } from '../../core/services/models';
import { WorkspaceService } from '../../core/services/workspace.service';
import { BadgeComponent } from './badge.component';
import { IconComponent } from './icon.component';
import { TicketScreenshotsComponent } from './ticket-screenshots.component';

@Component({
  imports: [DatePipe, BadgeComponent, IconComponent, TicketScreenshotsComponent],
  selector: 'app-ticket-details',
  styleUrl: './ticket-details.component.css',
  templateUrl: './ticket-details.component.html',
})
export class TicketDetailsComponent {
  readonly ticket = inject<Ticket>(DIALOG_DATA);
  readonly ref = inject(DialogRef);
  readonly store = inject(WorkspaceService);
  readonly workspaceId = this.store.activeWorkspaceId() ?? '';
  private readonly router = inject(Router);
  async openPage(): Promise<void> {
    if (await this.router.navigate(['/tickets', this.ticket.id], {
      queryParams: { workspace: this.workspaceId },
    })) this.ref.close();
  }
  get sprintName(): string {
    return this.store.sprints().find(sprint => sprint.id === this.ticket.sprint_id)?.name || 'Sin sprint';
  }
}
