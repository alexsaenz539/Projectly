import { Component, computed, inject } from '@angular/core';
import { WorkspaceService } from '../../core/services/workspace.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusChartComponent } from '../../shared/components/status-chart.component';
@Component({
  selector: 'app-reports',
  imports: [PageHeaderComponent, StatusChartComponent],
  templateUrl: './reports.component.html',
})
export class ReportsComponent {
  readonly store = inject(WorkspaceService);
  readonly rate = computed(() =>
    this.store.tickets().length
      ? Math.round(
          (this.store.tickets().filter((t) => t.status === 'Completado').length /
            this.store.tickets().length) *
            100,
        )
      : 0,
  );
  workload(id: string) {
    return this.store.tickets().filter((t) => t.assignee === id && t.status !== 'Completado')
      .length;
  }
  count(id: string, done = false) {
    return this.store
      .tickets()
      .filter((t) => t.project_id === id && (!done || t.status === 'Completado')).length;
  }
  exportCsv() {
    const cell = (value: string) =>
      `"${(/^[=+@\-\t\r\n]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
    const rows = [
      ['ID', 'Título', 'Proyecto', 'Estado', 'Prioridad', 'Responsable', 'Vencimiento'],
      ...this.store
        .tickets()
        .map((t) => [
          t.key,
          t.title,
          this.store.project(t.project_id)?.name || '',
          t.status,
          t.priority,
          this.store.member(t.assignee)?.name || '',
          t.due || '',
        ]),
    ];
    const url = URL.createObjectURL(
      new Blob(['\ufeff' + rows.map((r) => r.map(cell).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'projectly-tickets.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
