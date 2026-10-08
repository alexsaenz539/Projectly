import type { Workspace } from './models';
import { sampleWorkspace } from './seed';
import { WorkspaceRecord, workspaceErrors } from './workspace-record';
export const DEMO_WORKSPACE_ID = 'demo';
export const EMPTY_WORKSPACE: Workspace = {
  projects: [],
  members: [],
  tickets: [],
  sprints: [],
  notifications: [],
};
const REGISTRY = 'projectly-workspaces-v1';
const ACTIVE = 'projectly-active-workspace-v1';
const DEMO: WorkspaceRecord = {
  id: DEMO_WORKSPACE_ID,
  name: 'Espacio de demostración',
  slug: 'demo',
  description: 'Proyectos y tickets de ejemplo para conocer Projectly.',
  created_at: '',
  projectCount: 0,
  ticketCount: 0,
};
export class LocalWorkspaces {
  constructor(private readonly storage: Storage) {}
  private key(id: string) {
    return id === DEMO_WORKSPACE_ID
      ? 'project-os-angular-demo-v1'
      : 'projectly-workspace-' + id + '-v1';
  }
  records(): WorkspaceRecord[] {
    const raw = this.storage.getItem(REGISTRY);
    if (!raw) return [DEMO];
    let records: unknown;
    try {
      records = JSON.parse(raw);
    } catch {
      throw new Error('No se pudo leer la lista de espacios guardados.');
    }
    if (
      !Array.isArray(records) ||
      records.some(
        (record) =>
          !record ||
          typeof record.id !== 'string' ||
          typeof record.name !== 'string' ||
          typeof record.slug !== 'string' ||
          typeof record.description !== 'string' ||
          typeof record.created_at !== 'string' ||
          record.id === DEMO_WORKSPACE_ID,
      ) ||
      new Set(records.map((record) => record.id)).size !== records.length ||
      new Set(records.map((record) => record.slug)).size !== records.length
    )
      throw new Error('La lista de espacios guardados no es válida.');
    return [DEMO, ...(records as WorkspaceRecord[])];
  }
  list(): WorkspaceRecord[] {
    return this.records().map((record) => {
      const data = this.read(record.id);
      return { ...record, projectCount: data.projects.length, ticketCount: data.tickets.length };
    });
  }
  selected(): string {
    const remembered = this.storage.getItem(ACTIVE);
    return this.records().some((record) => record.id === remembered)
      ? remembered!
      : DEMO_WORKSPACE_ID;
  }
  read(id: string): Workspace {
    const raw = this.storage.getItem(this.key(id));
    if (!raw) {
      if (id !== DEMO_WORKSPACE_ID) return structuredClone(EMPTY_WORKSPACE);
      const demo = sampleWorkspace();
      try {
        this.write(id, demo);
      } catch {
        /* Read-only demo remains usable if storage is unavailable. */
      }
      return demo;
    }
    let data: Workspace;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('No se pudieron leer los datos del espacio.');
    }
    if (
      !data ||
      !Object.keys(EMPTY_WORKSPACE).every((key) => Array.isArray(data[key as keyof Workspace]))
    )
      throw new Error('Los datos guardados del espacio no son válidos.');
    return {
      ...data,
      notifications: data.notifications.map((notice) =>
        notice.title === 'Bienvenido a Project OS'
          ? { ...notice, title: 'Bienvenido a Projectly' }
          : notice,
      ),
    };
  }
  select(id: string): Workspace {
    if (!this.records().some((record) => record.id === id))
      throw new Error('El espacio ya no está disponible.');
    const data = this.read(id);
    this.storage.setItem(ACTIVE, id);
    return data;
  }
  write(id: string, data: Workspace) {
    this.storage.setItem(this.key(id), JSON.stringify(data));
  }
  create(name: string, slug: string, description: string): WorkspaceRecord {
    const records = this.records();
    const errors = workspaceErrors(name, slug, description, records);
    const failure = Object.values(errors).find(Boolean);
    if (failure) throw new Error(failure);
    const record: WorkspaceRecord = {
      id: crypto.randomUUID(),
      name: name.trim(),
      slug,
      description: description.trim(),
      created_at: new Date().toISOString(),
      projectCount: 0,
      ticketCount: 0,
    };
    const writes = [
      [this.key(record.id), JSON.stringify(EMPTY_WORKSPACE)],
      [
        REGISTRY,
        JSON.stringify([...records.filter((item) => item.id !== DEMO_WORKSPACE_ID), record]),
      ],
      [ACTIVE, record.id],
    ];
    const previous = writes.map(([key]) => [key, this.storage.getItem(key)]);
    try {
      for (const [key, value] of writes) this.storage.setItem(key, value);
    } catch (error) {
      for (const [key, value] of previous) {
        try {
          if (value === null) this.storage.removeItem(key!);
          else this.storage.setItem(key!, value!);
        } catch {
          /* Keep the original storage error; do not report creation as successful. */
        }
      }
      throw error;
    }
    return record;
  }
}
