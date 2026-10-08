import { Component, computed, input } from '@angular/core';
@Component({
  selector: 'app-badge',
  templateUrl: './badge.component.html',
})
export class BadgeComponent {
  value = input.required<string>();
  tone = computed(
    () =>
      (
        ({
          Pendiente: 'pending',
          'En progreso': 'progress',
          'En revisión': 'review',
          Bloqueado: 'blocked',
          Completado: 'done',
          Urgente: 'urgent',
          Alta: 'high',
          Media: 'medium',
          Baja: 'low',
          Activo: 'progress',
          Planificado: 'pending',
          Cerrado: 'done',
        }) as Record<string, string>
      )[this.value()] ?? 'pending',
  );
}
