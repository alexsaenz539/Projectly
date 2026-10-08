import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from '../auth/auth.service';
import { Collection, Entity, Preferences, Status, Ticket, Workspace } from './models';
import { sampleWorkspace } from './seed';
const EMPTY: Workspace = { projects: [], members: [], tickets: [], sprints: [], notifications: [] };
const DATA_KEY = 'project-os-angular-demo-v1';
const PREF_KEY = 'project-os-angular-preferences-v1';
@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  readonly auth = inject(AuthService);
  private get client() {
    return this.auth.client;
  }
  readonly data = signal<Workspace>(this.auth.isDemo ? this.loadDemo() : structuredClone(EMPTY));
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
  readonly myMemberId = computed(
    () => this.preferences().myMemberId || this.members()[0]?.id || '',
  );
  readonly myName = computed(
    () => this.member(this.myMemberId())?.name || this.auth.user()?.email || 'Mi espacio',
  );
  private channel?: RealtimeChannel;
  private generation = 0;
  private dataVersion = 0;
  private refreshVersion = 0;
  private toastTimer?: ReturnType<typeof setTimeout>;
  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (!this.client) return;
      const generation = ++this.generation;
      if (this.channel) void this.client.removeChannel(this.channel);
      this.data.set(structuredClone(EMPTY));
      this.error.set('');
      if (!user) {
        this.loading.set(false);
        return;
      }
      void this.refresh(generation);
      this.channel = this.client
        .channel(`workspace-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', filter: `user_id=eq.${user.id}` },
          () => {
            void this.refresh(generation);
          },
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' && generation === this.generation)
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
  private loadDemo(): Workspace {
    try {
      const data = JSON.parse(localStorage.getItem(DATA_KEY) || 'null');
      if (
        data &&
        ['projects', 'members', 'tickets', 'sprints', 'notifications'].every((k) =>
          Array.isArray(data[k]),
        )
      )
        return {
          ...data,
          notifications: data.notifications.map((notice: { title: string }) =>
            notice.title === 'Bienvenido a Project OS'
              ? { ...notice, title: 'Bienvenido a Projectly' }
              : notice,
          ),
        };
    } catch {
      /* Invalid cached data: start with a clean demo. */
    }
    const seed = sampleWorkspace();
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(seed));
    } catch {
      /* Demo still works for this session. */
    }
    return seed;
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
    if (!this.client || !this.auth.user()) return;
    this.loading.set(true);
    const dataVersion = this.dataVersion,
      refreshVersion = ++this.refreshVersion;
    try {
      const collections = Object.keys(EMPTY) as Collection[];
      const results = await Promise.all(
        collections.map((c) =>
          this.client!.from(c).select('*').eq('user_id', this.auth.user()!.id).order('created_at'),
        ),
      );
      if (
        generation !== this.generation ||
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
    if (this.busy()) return false;
    this.busy.set(true);
    const generation = this.generation;
    try {
      let saved: Entity = entity;
      if (this.client) {
        const user = this.auth.user();
        if (!user) throw new Error('La sesión ha terminado. Inicia sesión nuevamente.');
        const { data, error } = await this.client
          .from(collection)
          .upsert({ ...entity, user_id: user.id })
          .select()
          .single();
        if (error) throw error;
        saved = data;
      }
      if (generation !== this.generation) return false;
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
    if (this.busy()) return false;
    this.busy.set(true);
    const generation = this.generation;
    try {
      if (this.client) {
        const { data, error } = await this.client
          .from('tickets')
          .delete()
          .eq('id', id)
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
    if (!this.auth.isDemo) return;
    this.commit(sampleWorkspace());
    this.setPreference('myMemberId', '');
    this.notify('Datos de demostración restablecidos.');
  }
  private commit(next: Workspace) {
    if (this.auth.isDemo) localStorage.setItem(DATA_KEY, JSON.stringify(next));
    this.dataVersion++;
    this.data.set(next);
  }
  private message(error: unknown) {
    return error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : 'No se pudieron guardar los cambios.';
  }
}
