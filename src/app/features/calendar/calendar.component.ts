import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { WorkspaceService } from '../../core/services/workspace.service';
import { EditorService } from '../../core/services/editor.service';
import { isoDate, day } from '../../core/services/models';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { IconComponent } from '../../shared/components/icon.component';
@Component({
  selector: 'app-calendar',
  imports: [DatePipe, PageHeaderComponent, IconComponent],
  templateUrl: './calendar.component.html',
})
export class CalendarComponent {
  readonly store = inject(WorkspaceService);
  readonly editor = inject(EditorService);
  readonly weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  readonly todayIso = day();
  readonly month = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly days = computed(() => {
    const month = this.month(),
      offset = (month.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(month.getFullYear(), month.getMonth(), 1 - offset + i),
        iso = isoDate(date);
      return {
        date,
        iso,
        other: date.getMonth() !== month.getMonth(),
        tickets: this.store.tickets().filter((t) => t.due === iso),
      };
    });
  });
  move(offset: number) {
    const m = this.month();
    this.month.set(new Date(m.getFullYear(), m.getMonth() + offset, 1));
  }
  today() {
    this.month.set(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  }
}
