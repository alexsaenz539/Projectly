import { Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { WorkspaceService } from '../../core/services/workspace.service';
import {
  Entity,
  Member,
  Project,
  Sprint,
  Ticket,
  STATUSES,
  PRIORITIES,
  day,
} from '../../core/services/models';
import { IconComponent } from './icon.component';
import { FormControlsModule } from './form-controls.module';
import { TicketScreenshotsComponent } from './ticket-screenshots.component';
import { TicketScreenshotsService } from '../../core/services/ticket-screenshots.service';
import { ToastFeedbackDirective } from './toast-feedback.directive';
export interface EditorData {
  kind: 'ticket' | 'project' | 'sprint' | 'member';
  entity?: Entity;
  projectId?: string;
}
@Component({
  selector: 'app-entity-editor',
  imports: [FormsModule, IconComponent, FormControlsModule, TicketScreenshotsComponent, ToastFeedbackDirective],
  templateUrl: './entity-editor.component.html',
})
export class EntityEditorComponent {
  readonly store = inject(WorkspaceService);
  readonly data = inject<EditorData>(DIALOG_DATA);
  readonly ref = inject(DialogRef);
  private readonly dialog = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly screenshotService = inject(TicketScreenshotsService);
  readonly screenshots = viewChild(TicketScreenshotsComponent);
  readonly saving = signal(false);
  readonly workspaceId = this.store.activeWorkspaceId() ?? '';
  readonly ticketId = this.data.entity?.id ?? crypto.randomUUID();
  readonly statuses = STATUSES;
  readonly priorities = PRIORITIES;
  readonly existing = Boolean(this.data.entity);
  readonly labels = { ticket: 'ticket', project: 'proyecto', sprint: 'sprint', member: 'miembro' };
  error = '';
  confirmDelete = false;
  model: Record<string, string> = {
    name: '',
    title: '',
    description: '',
    key: '',
    owner: this.store.myMemberId(),
    project_id:
      this.data.projectId ?? this.store.projects().find((p) => p.status === 'Activo')?.id ?? '',
    type: 'Tarea',
    status:
      this.data.kind === 'ticket'
        ? 'Pendiente'
        : this.data.kind === 'sprint'
          ? 'Planificado'
          : 'Activo',
    priority: 'Media',
    assignee: this.store.myMemberId(),
    due: day(2),
    sprint_id: '',
    target_version: '',
    goal: '',
    start: day(),
    end: day(14),
    email: '',
    role: 'Miembro',
    ...Object.fromEntries(
      Object.entries(this.data.entity ?? {}).map(([key, value]) => [key, value ?? '']),
    ),
  };
  get availableSprints() {
    return this.store.sprints().filter((s) => s.project_id === this.model['project_id']);
  }
  projectChanged() {
    if (!this.availableSprints.some((s) => s.id === this.model['sprint_id']))
      this.model['sprint_id'] = '';
  }
  createRelated(kind: 'project' | 'member'): void {
    const workspaceId = this.store.activeWorkspaceId();
    this.dialog
      .open<Project | Member>(EntityEditorComponent, {
        data: { kind } satisfies EditorData,
        width: '510px',
        maxWidth: 'calc(100vw - 32px)',
        autoFocus: 'input',
        restoreFocus: true,
        ariaLabel: kind === 'project' ? 'Crear proyecto para el ticket' : 'Añadir responsable',
      })
      .closed.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((entity) => {
        if (!entity || workspaceId !== this.store.activeWorkspaceId()) return;
        if (kind === 'project') {
          this.model['project_id'] = entity.id;
          this.projectChanged();
        } else this.model['assignee'] = entity.id;
      });
  }
  async save() {
    if (this.saving() || this.store.busy()) return;
    this.error = '';
    if (this.workspaceId !== this.store.activeWorkspaceId()) {
      this.error = 'El espacio cambió. Cierra el formulario y vuelve a abrirlo.';
      return;
    }
    const m = this.model,
      id =
        this.data.kind === 'ticket' ? this.ticketId : (this.data.entity?.id ?? crypto.randomUUID());
    let success = false;
    let savedEntity: Entity | undefined;
    if (this.data.kind === 'ticket') {
      const project = this.store.project(m['project_id']);
      if (!project) {
        this.error = 'Crea primero un proyecto.';
        return;
      }
      if (!m['title'].trim()) {
        this.error = 'Escribe un título.';
        return;
      }
      const targetVersion = m['target_version'].trim();
      if (targetVersion && !/^[A-Za-z0-9][A-Za-z0-9.+_-]{0,39}$/.test(targetVersion)) {
        this.error = 'La versión admite hasta 40 letras, números, puntos, guiones o guiones bajos; sin espacios.';
        return;
      }
      if (m['sprint_id'] && !this.availableSprints.some((s) => s.id === m['sprint_id'])) {
        this.error = 'El sprint debe pertenecer al proyecto seleccionado.';
        return;
      }
      const nums = this.store
        .tickets()
        .filter((t) => t.project_id === project.id)
        .map((t) => Number(t.key.split('-').pop()) || 100);
      const ticket: Ticket = {
        id,
        key:
          this.store.tickets().find((ticket) => ticket.id === id)?.key ??
          (this.existing ? m['key'] : `${project.key}-${Math.max(100, ...nums) + 1}`),
        title: m['title'].trim(),
        description: m['description'].trim(),
        project_id: project.id,
        type: m['type'],
        status: m['status'] as Ticket['status'],
        priority: m['priority'] as Ticket['priority'],
        assignee: m['assignee'] || null,
        due: m['due'] || null,
        sprint_id: m['sprint_id'] || null,
        target_version: targetVersion || null,
      };
      this.saving.set(true);
      const disableClose = this.ref.disableClose;
      this.ref.disableClose = true;
      try {
        success = await this.store.save('tickets', ticket);
        if (success) {
          try {
            await this.screenshots()?.persist();
          } catch (error) {
            success = false;
            this.error = `El ticket quedó guardado, pero faltan cambios en las capturas. ${error instanceof Error ? error.message : 'Vuelve a intentar guardar.'}`;
          }
        }
      } finally {
        this.saving.set(false);
        this.ref.disableClose = disableClose;
      }
    } else if (this.data.kind === 'project') {
      const key = m['key'].trim().toUpperCase();
      if (!m['name'].trim() || !/^[A-Z0-9]{2,6}$/.test(key)) {
        this.error = 'Escribe un nombre y una clave de 2 a 6 letras o números.';
        return;
      }
      if (this.store.projects().some((p) => p.key === key && p.id !== id)) {
        this.error = 'Esa clave ya existe.';
        return;
      }
      const project: Project = {
        id,
        key,
        name: m['name'].trim(),
        description: m['description'].trim(),
        owner: m['owner'] || null,
        status: m['status'] as Project['status'],
      };
      success = await this.store.save('projects', project);
      savedEntity = project;
    } else if (this.data.kind === 'sprint') {
      if (!m['name'].trim() || !m['project_id']) {
        this.error = 'Indica un nombre y un proyecto.';
        return;
      }
      if (m['end'] < m['start']) {
        this.error = 'La fecha de fin debe ser posterior al inicio.';
        return;
      }
      if (
        this.existing &&
        m['project_id'] !== (this.data.entity as Sprint).project_id &&
        this.store.tickets().some((t) => t.sprint_id === id)
      ) {
        this.error = 'Retira los tickets del sprint antes de cambiar su proyecto.';
        return;
      }
      const sprint: Sprint = {
        id,
        name: m['name'].trim(),
        project_id: m['project_id'],
        goal: m['goal'].trim(),
        start: m['start'],
        end: m['end'],
        status: m['status'] as Sprint['status'],
      };
      success = await this.store.save('sprints', sprint);
    } else {
      if (!m['name'].trim() || !m['email'].trim()) {
        this.error = 'Escribe el nombre y el correo.';
        return;
      }
      const member: Member = {
        id,
        name: m['name'].trim(),
        email: m['email'].trim(),
        role: m['role'],
      };
      success = await this.store.save('members', member);
      savedEntity = member;
    }
    if (success) this.ref.close(savedEntity);
  }
  async remove() {
    if (!this.data.entity || this.saving()) return;
    if (this.workspaceId !== this.store.activeWorkspaceId()) {
      this.error = 'El espacio cambió. Cierra el formulario y vuelve a abrirlo.';
      return;
    }
    this.saving.set(true);
    const disableClose = this.ref.disableClose;
    this.ref.disableClose = true;
    try {
      if (await this.store.removeTicket(this.data.entity.id)) {
        try {
          await this.screenshotService.cleanup(this.workspaceId, this.ticketId);
        } catch {
          this.store.notify(
            'Ticket eliminado. No se pudieron limpiar sus capturas; revisa el bucket.',
            'warning',
          );
        }
        this.ref.close();
      }
    } finally {
      this.saving.set(false);
      this.ref.disableClose = disableClose;
    }
  }
}
