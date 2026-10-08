import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { workspaceGuard } from './core/guards/workspace.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'iniciar-sesion', redirectTo: 'login', pathMatch: 'full' },
  { path: 'crear-usuario', redirectTo: 'register', pathMatch: 'full' },
  { path: 'crear-espacio', redirectTo: 'workspaces', pathMatch: 'full' },
  { path: 'espacios-de-trabajo', redirectTo: 'workspaces', pathMatch: 'full' },
  {
    path: 'login',
    title: 'Iniciar sesión · Projectly',
    loadComponent: () => import('./core/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    title: 'Crear usuario · Projectly',
    loadComponent: () => import('./core/auth/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard, workspaceGuard],
    loadComponent: () =>
      import('./core/layouts/workspace-layout.component').then((m) => m.WorkspaceLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'mis-tareas' },
      {
        path: 'workspaces',
        title: 'Espacios de trabajo · Projectly',
        loadComponent: () =>
          import('./features/workspaces/workspaces.component').then((m) => m.WorkspacesComponent),
      },
      {
        path: 'dashboard',
        title: 'Dashboard · Projectly',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'projects',
        title: 'Proyectos · Projectly',
        loadComponent: () =>
          import('./features/projects/projects.component').then((m) => m.ProjectsComponent),
      },
      {
        path: 'tickets',
        title: 'Tickets · Projectly',
        loadComponent: () =>
          import('./features/tickets/tickets.component').then((m) => m.TicketsComponent),
      },
      {
        path: 'mis-tareas',
        title: 'Mis tareas · Projectly',
        loadComponent: () =>
          import('./features/tickets/my-tasks.component').then((m) => m.MyTasksComponent),
      },
      {
        path: 'kanban',
        title: 'Kanban · Projectly',
        loadComponent: () =>
          import('./features/kanban/kanban.component').then((m) => m.KanbanComponent),
      },
      {
        path: 'sprints',
        title: 'Sprints · Projectly',
        loadComponent: () =>
          import('./features/sprints/sprints.component').then((m) => m.SprintsComponent),
      },
      {
        path: 'calendar',
        title: 'Calendario · Projectly',
        loadComponent: () =>
          import('./features/calendar/calendar.component').then((m) => m.CalendarComponent),
      },
      {
        path: 'team',
        title: 'Equipo · Projectly',
        loadComponent: () => import('./features/team/team.component').then((m) => m.TeamComponent),
      },
      {
        path: 'reports',
        title: 'Reportes · Projectly',
        loadComponent: () =>
          import('./features/reports/reports.component').then((m) => m.ReportsComponent),
      },
      {
        path: 'notifications',
        title: 'Notificaciones · Projectly',
        loadComponent: () =>
          import('./features/notifications/notifications.component').then(
            (m) => m.NotificationsComponent,
          ),
      },
      {
        path: 'settings',
        title: 'Configuración · Projectly',
        loadComponent: () =>
          import('./features/settings/settings.component').then((m) => m.SettingsComponent),
      },
      { path: '**', redirectTo: 'mis-tareas' },
    ],
  },
];
