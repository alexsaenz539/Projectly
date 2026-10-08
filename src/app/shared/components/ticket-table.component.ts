import { Component, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { WorkspaceService } from '../../core/services/workspace.service';
import { EditorService } from '../../core/services/editor.service';
import { Ticket } from '../../core/services/models';
import { BadgeComponent } from './badge.component';
@Component({
  selector: 'app-ticket-table',
  imports: [DatePipe, BadgeComponent],
  templateUrl: './ticket-table.component.html',
})
export class TicketTableComponent {
  readonly tickets = input.required<Ticket[]>();
  readonly store = inject(WorkspaceService);
  readonly editor = inject(EditorService);
}
