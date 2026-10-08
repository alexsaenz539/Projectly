import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WorkspaceService } from '../../core/services/workspace.service';
import { EditorService } from '../../core/services/editor.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { IconComponent } from '../../shared/components/icon.component';
import { TicketTableComponent } from '../../shared/components/ticket-table.component';
import { StatusChartComponent } from '../../shared/components/status-chart.component';
@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    PageHeaderComponent,
    IconComponent,
    TicketTableComponent,
    StatusChartComponent,
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  readonly store = inject(WorkspaceService);
  readonly editor = inject(EditorService);
  readonly recent = computed(() => this.store.tickets().slice(-5).reverse());
  readonly metrics = computed(() => [
    {
      label: 'Proyectos activos',
      value: this.store.projects().filter((p) => p.status === 'Activo').length,
      note: 'En este espacio de trabajo',
    },
    {
      label: 'Tickets abiertos',
      value: this.store.tickets().filter((t) => t.status !== 'Completado').length,
      note: 'Pendientes de resolución',
    },
    {
      label: 'Bloqueados',
      value: this.store.tickets().filter((t) => t.status === 'Bloqueado').length,
      note: 'Requieren atención',
    },
    {
      label: 'Completados',
      value: this.store.tickets().filter((t) => t.status === 'Completado').length,
      note: 'Trabajo finalizado',
    },
  ]);
}
