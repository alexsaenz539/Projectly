import { Component, computed, inject } from '@angular/core';
import {
  NgApexchartsModule,
  ApexChart,
  ApexXAxis,
  ApexPlotOptions,
  ApexDataLabels,
  ApexTooltip,
  ApexTheme,
} from 'ng-apexcharts';
import { WorkspaceService } from '../../core/services/workspace.service';
import { STATUSES } from '../../core/services/models';
@Component({
  selector: 'app-status-chart',
  imports: [NgApexchartsModule],
  templateUrl: './status-chart.component.html',
})
export class StatusChartComponent {
  readonly store = inject(WorkspaceService);
  readonly series = computed(() => [
    {
      name: 'Tickets',
      data: STATUSES.map((s) => this.store.tickets().filter((t) => t.status === s).length),
    },
  ]);
  readonly summary = computed(() =>
    STATUSES.map((s, i) => `${s}: ${this.series()[0].data[i]}`).join(', '),
  );
  readonly chart: ApexChart = {
    type: 'bar',
    height: 260,
    toolbar: { show: false },
    background: 'transparent',
    animations: { enabled: !matchMedia('(prefers-reduced-motion: reduce)').matches },
    fontFamily: 'Inter, Segoe UI, sans-serif',
  };
  readonly xaxis = computed<ApexXAxis>(() => ({
    categories: ['Pend.', 'Proceso', 'Revisión', 'Bloqueo', 'Hechos'],
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: {
      style: { fontSize: '12px', colors: this.store.preferences().dark ? '#CBD5E1' : '#6B7280' },
    },
  }));
  readonly plotOptions: ApexPlotOptions = {
    bar: { borderRadius: 5, distributed: true, columnWidth: '36%' },
  };
  readonly dataLabels: ApexDataLabels = { enabled: false };
  readonly colors = ['#64748B', '#F59E0B', '#111827', '#EF4444', '#10B981'];
  readonly tooltip: ApexTooltip = {
    x: { formatter: (_value, options) => STATUSES[options?.dataPointIndex ?? 0] },
  };
  readonly theme = computed<ApexTheme>(() => ({
    mode: this.store.preferences().dark ? 'dark' : 'light',
  }));
}
