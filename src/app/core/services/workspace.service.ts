import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from '../auth/auth.service';
import { Collection, Entity, Preferences, Status, Ticket, Workspace } from './models';
import { sampleWorkspace } from './seed';
import { WorkspaceRecord, workspaceErrors } from './workspace-record';
import { DEMO_WORKSPACE_ID, EMPTY_WORKSPACE, LocalWorkspaces } from './local-workspaces';
const EMPTY: Workspace = { projects: [], members: [], tickets: [], sprints: [], notifications: [] };
const PREF_KEY = 'project-os-angular-preferences-v1';
@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  readonly auth = inject(AuthService);
  private readonly local = this.auth.isDemo ? new LocalWorkspaces(localStorage) : null;
  private get client() {
    return this.auth.client;
  }
  readonly data = signal<Workspace>(structuredClone(EMPTY));
  readonly workspaceDirectory = signal<WorkspaceRecord[]>([]);
  readonly activeWorkspaceId = signal<string | null>(null);
  readonly activeWorkspace = computed(
    () => this.workspaceDirectory().find((space) => space.id === this.activeWorkspaceId()) ?? null,
  );
  readonly hasWorkspace = computed(() => this.activeWorkspace() !== null);
  readonly isSampleWorkspace = computed(
    () => this.auth.isDemo && this.activeWorkspaceId() === DEMO_WORKSPACE_ID,
  );
  readonly directoryLoading = signal(false);
  readonly directoryError = signal('');
  readonly spaceBusy = signal(false);
  readonly workspaceSummaries = computed(() =>
    this.workspaceDirectory().map((space) =>
      space.id === this.activeWorkspaceId() && !this.loading()
        ? { ...space, projectCount: this.projects().length, ticketCount: this.tickets().length }
        : space,
    ),
  );
  readonly preferences = signal<Preferences>(this.loadPreferences());
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly toast = signal('');
  readonly projects = computed(() => this.data().projects);
  readonly tickets = computed(() => this.data().tickets);
  readonly members = computed(() => this.data().members);
  readonly sprints = computed(() => this.data().sprints);
  readonly notifications = computed(() => this.data().notifications);
  readonly unread = computed(() => this.notifications().filter((n) => !n.read).length);
  readonly myMemberId = computed(() =>
    this.members().some((member) => member.id === this.preferences().myMemberId)
      ? this.preferences().myMemberId
      : this.members()[0]?.id || '',
  );
  readonly myName = computed(
    () => this.member(this.myMemberId())?.name || this.auth.user()?.email || 'Mi espacio',
  );
  private channel?: RealtimeChannel;
  private generation = 0;
  private dataVersion = 0;
  private refreshVersion = 0;
  private directoryRevision = 0;
  private directoryUser = '';
  private directoryTask?: Promise<boolean>;
  private authEpoch = 0;
  private observedUserId = this.auth.user()?.id ?? '';
  private toastTimer?: ReturnType<typeof setTimeout>;
  constructor() {
    if (this.local) {
      try {
        this.workspaceDirectory.set(this.local.list());
        const id = this.local.selected();
        this.activeWorkspaceId.set(id);
        this.data.set(this.local.read(id));
      } catch (error) {
        this.directoryError.set(this.message(error));
      }
    }
    effect(() => {
      const user = this.auth.user();
      if (!this.client) return;
      const userChanged = this.observedUserId !== (user?.id ?? '');
      if (!userChanged && this.channel) return;
      if (userChanged) {
        this.observedUserId = user?.id ?? '';
        this.generation++;
        this.authEpoch++;
        this.directoryRevision++;
        this.directoryUser = '';
        this.directoryTask = undefined;
        if (this.channel) void this.client.removeChannel(this.channel);
        this.channel = undefined;
        this.data.set(structuredClone(EMPTY));
        this.workspaceDirectory.set([]);
        this.activeWorkspaceId.set(null);
        this.error.set('');
        this.directoryError.set('');
      }
      if (!user) {
        this.loading.set(false);
        this.directoryLoading.set(false);
        return;
      }
      void this.loadWorkspaces();
      this.channel = this.client
        .channel(`workspace-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', filter: `user_id=eq.${user.id}` },
          () => {
            if (this.auth.user()?.id === user.id)
              void this.loadWorkspaces(true).then(() => this.refresh());
          },
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' && this.auth.user()?.id === user.id)
            this.notify('No se pudo conectar Realtime. Puedes recargar los datos.');
        });
    });
    effect(() => {
      const prefs = this.preferences();
      document.documentElement.classList.toggle('dark', prefs.dark);
      document.documentElement.classList.toggle('dense', prefs.dense);
      try {
        localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
      } catch {
        this.notify('No se pudo guardar la preferencia en este navegador.');
      }
    });
  }
  async loadWorkspaces(force = false): Promise<boolean> {
    if (this.local) {
      if (!force) return !this.directoryError();
      try {
        this.workspaceDirectory.set(this.local.list());
        this.directoryError.set('');
        return true;
      } catch (error) {
        this.directoryError.set(this.message(error));
        return false;
      }
    }
    await this.auth.ready;
    const userId = this.auth.user()?.id;
    if (!this.client || !userId) return false;
    if (!force && this.directoryUser === userId && this.directoryTask) return this.directoryTask;
    this.directoryUser = userId;
    this.directoryTask = this.fetchDirectory(userId);
    return this.directoryTask;
  }
  private async fetchDirectory(userId: string): Promise<boolean> {
    const revision = ++this.directoryRevision;
    this.directoryLoading.set(true);
    this.directoryError.set('');
    try {
      const { data, error } = await this.client!.from('workspaces')
        .select('*,projects(count),tickets(count)')
        .eq('user_id', userId)
        .order('created_at');
      if (revision !== this.directoryRevision || this.auth.user()?.id !== userId) return false;
      if (error) throw error;
      const spaces: WorkspaceRecord[] = (data ?? []).map((space) => ({
        id: space.id,
        name: space.name,
        slug: space.slug,
        description: space.description,
        created_at: space.created_at,
        projectCount: space.projects?.[0]?.count ?? 0,
        ticketCount: space.tickets?.[0]?.count ?? 0,
      }));
      let remembered = '';
      try {
        remembered = localStorage.getItem('projectly-active-workspace-' + userId) || '';
      } catch {
        /* Selection still works in memory. */
      }
      const selected =
        spaces.find((space) => space.id === (this.activeWorkspaceId() || remembered)) ?? spaces[0];
      this.workspaceDirectory.set(spaces);
      if (selected && selected.id !== this.activeWorkspaceId())
        this.activate(selected.id, structuredClone(EMPTY));
      else if (!selected) this.activate(null, structuredClone(EMPTY));
      return true;
    } catch (error) {
      if (revision === this.directoryRevision) this.directoryError.set(this.message(error));
      return false;
    } finally {
      if (revision === this.directoryRevision) this.directoryLoading.set(false);
    }
  }
  private activate(id: string | null, data: Workspace) {
    this.generation++;
    this.refreshVersion++;
    this.dataVersion++;
    this.activeWorkspaceId.set(id);
    this.data.set(data);
    this.error.set('');
    this.loading.set(false);
    this.setPreference('myMemberId', '');
    if (id && this.client) void this.refresh();
  }
  async selectWorkspace(id: string): Promise<boolean> {
    if (this.busy() || this.spaceBusy()) {
      this.notify('Termina de guardar antes de cambiar de espacio.');
      return false;
    }
    try {
      if (!this.workspaceDirectory().some((space) => space.id === id))
        throw new Error('El espacio ya no está disponible.');
      if (id === this.activeWorkspaceId()) return true;
      const data = this.local ? this.local.select(id) : structuredClone(EMPTY);
      if (!this.local) {
        if (!this.auth.user()) throw new Error('La sesión ha terminado.');
        try {
          localStorage.setItem('projectly-active-workspace-' + this.auth.user()!.id, id);
        } catch {
          /* Selection still works in memory. */
        }
      }
      this.activate(id, data);
      return true;
    } catch (error) {
      this.notify(this.message(error));
      return false;
    }
  }
  async createWorkspace(name: string, slug: string, description: string): Promise<WorkspaceRecord> {
    if (this.spaceBusy() || this.busy() || this.directoryLoading())
      throw new Error('Espera a que termine la operación actual.');
    const failure = Object.values(
      workspaceErrors(name, slug, description, this.workspaceDirectory()),
    ).find(Boolean);
    if (failure) throw new Error(failure);
    this.spaceBusy.set(true);
    const epoch = this.authEpoch;
    try {
      let record: WorkspaceRecord;
      if (this.local) record = this.local.create(name, slug, description);
      else {
        const user = this.auth.user();
        if (!this.client || !user)
          throw new Error('La sesión ha terminado. Inicia sesión nuevamente.');
        const { data, error } = await this.client
          .from('workspaces')
          .insert({ name: name.trim(), slug, description: description.trim(), user_id: user.id })
          .select()
          .single();
        if (error) throw error;
        if (epoch !== this.authEpoch)
          throw new Error('La sesión ha cambiado. Abre de nuevo la lista de espacios.');
        record = { ...data, projectCount: 0, ticketCount: 0 };
        try {
          localStorage.setItem('projectly-active-workspace-' + user.id, record.id);
        } catch {
          /* Selection still works in memory. */
        }
      }
      this.workspaceDirectory.update((spaces) => [
        ...spaces.filter((space) => space.id !== record.id),
        record,
      ]);
      this.activate(record.id, structuredClone(EMPTY_WORKSPACE));
      this.notify('Espacio creado. Ya puedes añadir tu primer proyecto.');
      return record;
    } catch (error) {
      throw new Error(this.message(error));
    } finally {
      this.spaceBusy.set(false);
    }
  }
  private loadPreferences(): Preferences {
    const defaults = { dark: false, collapsed: false, dense: false, myMemberId: '' };
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') };
    } catch {
      return defaults;
    }
  }
  setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    this.preferences.update((p) => ({ ...p, [key]: value }));
  }
  notify(message: string) {
    clearTimeout(this.toastTimer);
    this.toast.set(message);
    this.toastTimer = setTimeout(() => this.toast.set(''), 4500);
  }
  project(id: string) {
    return this.projects().find((p) => p.id === id);
  }
  member(id: string | null) {
    return this.members().find((m) => m.id === id);
  }
  progress(id: string) {
    const rows = this.tickets().filter((t) => t.project_id === id);
    return rows.length
      ? Math.round((rows.filter((t) => t.status === 'Completado').length / rows.length) * 100)
      : 0;
  }
  async refresh(generation = this.generation) {
    if (!this.client || !this.auth.user() || !this.hasWorkspace()) return;
    const workspaceId = this.activeWorkspaceId()!;
    const userId = this.auth.user()!.id;
    this.loading.set(true);
    const dataVersion = this.dataVersion,
      refreshVersion = ++this.refreshVersion;
    try {
      const collections = Object.keys(EMPTY) as Collection[];
      const results = await Promise.all(
        collections.map((c) =>
          this.client!.from(c)
            .select('*')
            .eq('user_id', userId)
            .eq('workspace_id', workspaceId)
            .order('created_at'),
        ),
      );
      if (
        generation !== this.generation ||
        userId !== this.auth.user()?.id ||
        workspaceId !== this.activeWorkspaceId() ||
        dataVersion !== this.dataVersion ||
        refreshVersion !== this.refreshVersion
      )
        return;
      const failure = results.find((r) => r.error);
      if (failure?.error) throw failure.error;
      this.data.set(
        Object.fromEntries(collections.map((c, i) => [c, results[i].data])) as unknown as Workspace,
      );
      this.error.set('');
    } catch (error) {
      if (generation === this.generation && refreshVersion === this.refreshVersion)
        this.error.set(this.message(error));
    } finally {
      if (generation === this.generation && refreshVersion === this.refreshVersion)
        this.loading.set(false);
    }
  }
  async save<C extends Collection>(collection: C, entity: Workspace[C][number]): Promise<boolean> {
    if (this.busy() || this.spaceBusy()) return false;
    this.busy.set(true);
    const generation = this.generation;
    const userId = this.auth.user()?.id;
    try {
      if (!this.hasWorkspace()) throw new Error('Crea o selecciona un espacio de trabajo.');
      let saved: Entity = entity;
      if (this.client) {
        const user = this.auth.user();
        if (!user) throw new Error('La sesión ha terminado. Inicia sesión nuevamente.');
        const { data, error } = await this.client
          .from(collection)
          .upsert({ ...entity, user_id: user.id, workspace_id: this.activeWorkspaceId() })
          .select()
          .single();
        if (error) throw error;
        saved = data;
      }
      if (generation !== this.generation || userId !== this.auth.user()?.id) return false;
      const rows = this.data()[collection] as Entity[];
      const next = {
        ...this.data(),
        [collection]: rows.some((x) => x.id === entity.id)
          ? rows.map((x) => (x.id === entity.id ? saved : x))
          : [...rows, saved],
      };
      if (this.auth.isDemo && collection === 'tickets')
        next.notifications = [
          ...next.notifications,
          {
            id: crypto.randomUUID(),
            title: 'Ticket actualizado',
            body: `${(entity as Ticket).key} · ${(entity as Ticket).title} · ${(entity as Ticket).status}`,
            read: false,
            created_at: new Date().toISOString(),
          },
        ];
      this.commit(next);
      this.notify(this.auth.isDemo ? 'Cambios guardados en este navegador.' : 'Cambios guardados.');
      return true;
    } catch (error) {
      this.notify(this.message(error));
      return false;
    } finally {
      this.busy.set(false);
    }
  }
  async removeTicket(id: string): Promise<boolean> {
    if (this.busy() || this.spaceBusy()) return false;
    this.busy.set(true);
    const generation = this.generation;
    try {
      if (!this.hasWorkspace()) throw new Error('Crea o selecciona un espacio de trabajo.');
      if (this.client) {
        const { data, error } = await this.client
          .from('tickets')
          .delete()
          .eq('id', id)
          .eq('workspace_id', this.activeWorkspaceId()!)
          .select('id');
        if (error) throw error;
        if (!data?.length) throw new Error('No se pudo eliminar el ticket.');
      }
      if (generation !== this.generation) return false;
      this.commit({ ...this.data(), tickets: this.tickets().filter((t) => t.id !== id) });
      this.notify('Ticket eliminado.');
      return true;
    } catch (error) {
      this.notify(this.message(error));
      return false;
    } finally {
      this.busy.set(false);
    }
  }
  async moveTicket(ticket: Ticket, status: Status) {
    return this.save('tickets', { ...ticket, status });
  }
  resetDemo() {
    if (!this.isSampleWorkspace()) return;
    this.commit(sampleWorkspace());
    this.setPreference('myMemberId', '');
    this.notify('Datos de demostración restablecidos.');
  }
  private commit(next: Workspace) {
    if (this.local) this.local.write(this.activeWorkspaceId()!, next);
    this.dataVersion++;
    this.data.set(next);
    this.workspaceDirectory.update((spaces) =>
      spaces.map((space) =>
        space.id === this.activeWorkspaceId()
          ? { ...space, projectCount: next.projects.length, ticketCount: next.tickets.length }
          : space,
      ),
    );
  }
  private message(error: unknown) {
    return error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : 'No se pudieron guardar los cambios.';
  }
}
