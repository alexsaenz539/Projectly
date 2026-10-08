import { Component, HostListener, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { WorkspaceService } from '../services/workspace.service';
import { EditorService } from '../services/editor.service';
import { IconComponent } from '../../shared/components/icon.component';
import { InitialsPipe } from '../../shared/pipes/initials.pipe';
import { SearchDialogComponent } from '../../shared/components/search-dialog.component';
import { BrandLogoComponent } from '../../shared/components/brand-logo.component';
@Component({
  selector: 'app-workspace-layout',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    IconComponent,
    InitialsPipe,
    BrandLogoComponent,
  ],
  templateUrl: './workspace-layout.component.html',
})
export class WorkspaceLayoutComponent {
  readonly store = inject(WorkspaceService);
  readonly editor = inject(EditorService);
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);
  readonly groups = ['Principal', 'Gestión', 'Administración'];
  readonly navigation = [
    { path: '/dashboard', name: 'Dashboard', icon: 'layout-grid', group: 'Principal' },
    { path: '/workspaces', name: 'Espacios', icon: 'layout-grid', group: 'Principal' },
    { path: '/projects', name: 'Proyectos', icon: 'folder', group: 'Principal' },
    { path: '/tickets', name: 'Tickets', icon: 'ticket', group: 'Principal' },
    { path: '/mis-tareas', name: 'Mis tareas', icon: 'square-check', group: 'Principal' },
    { path: '/kanban', name: 'Kanban', icon: 'columns-3', group: 'Gestión' },
    { path: '/sprints', name: 'Sprints', icon: 'clock', group: 'Gestión' },
    { path: '/calendar', name: 'Calendario', icon: 'calendar', group: 'Gestión' },
    { path: '/team', name: 'Equipo', icon: 'users', group: 'Administración' },
    { path: '/reports', name: 'Reportes', icon: 'chart-no-axes-combined', group: 'Administración' },
    { path: '/notifications', name: 'Notificaciones', icon: 'bell', group: 'Administración' },
    { path: '/settings', name: 'Configuración', icon: 'settings', group: 'Administración' },
  ];
  constructor() {
    effect(() => {
      if (!this.store.auth.hasAccess()) void this.router.navigate(['/login']);
    });
  }
  search() {
    if (!this.dialog.openDialogs.length)
      this.dialog.open(SearchDialogComponent, {
        width: '510px',
        maxWidth: 'calc(100vw - 32px)',
        ariaLabel: 'Buscar en el espacio',
        restoreFocus: true,
      });
  }
  @HostListener('document:keydown', ['$event']) shortcut(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.search();
    } else if (
      event.key.toLowerCase() === 'c' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !this.dialog.openDialogs.length &&
      !['INPUT', 'SELECT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)
    ) {
      event.preventDefault();
      this.editor.open('ticket');
    }
  }
  async logout() {
    try {
      await this.store.auth.signOut();
      await this.router.navigate(['/login']);
    } catch {
      this.store.notify('No se pudo cerrar la sesión.');
    }
  }
}
