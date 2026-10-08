export const STATUSES = [
  'Pendiente',
  'En progreso',
  'En revisión',
  'Bloqueado',
  'Completado',
] as const;
export const PRIORITIES = ['Urgente', 'Alta', 'Media', 'Baja'] as const;
export type Status = (typeof STATUSES)[number];
export interface Project {
  id: string;
  key: string;
  name: string;
  description: string;
  owner: string | null;
  status: 'Activo' | 'Archivado';
}
export interface Member {
  id: string;
  name: string;
  role: string;
  email: string;
}
export interface Sprint {
  id: string;
  project_id: string;
  name: string;
  goal: string;
  start: string;
  end: string;
  status: 'Planificado' | 'Activo' | 'Cerrado';
}
export interface Ticket {
  id: string;
  key: string;
  project_id: string;
  title: string;
  description: string;
  type: string;
  status: Status;
  priority: (typeof PRIORITIES)[number];
  assignee: string | null;
  due: string | null;
  sprint_id: string | null;
}
export interface Notice {
  id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}
export interface Preferences {
  dark: boolean;
  collapsed: boolean;
  dense: boolean;
  myMemberId: string;
}
export interface Workspace {
  projects: Project[];
  members: Member[];
  sprints: Sprint[];
  tickets: Ticket[];
  notifications: Notice[];
}
export type Collection = keyof Workspace;
export type Entity = Project | Member | Sprint | Ticket | Notice;
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function day(offset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return isoDate(date);
}
