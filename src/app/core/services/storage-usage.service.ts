import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { FILE_STORAGE_LIMIT, formatStorageBytes, parseStorageUsage } from './storage-usage-model';

@Injectable({ providedIn: 'root' })
export class StorageUsageService {
  private readonly auth = inject(AuthService);
  readonly usage = signal<{ used: number; complete: boolean } | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly limit = FILE_STORAGE_LIMIT;
  readonly usedLabel = computed(() => formatStorageBytes(this.usage()?.used ?? 0));
  readonly remainingLabel = computed(() => formatStorageBytes(Math.max(0, this.limit - (this.usage()?.used ?? 0))));
  readonly meterValue = computed(() => Math.min(this.limit, this.usage()?.used ?? 0));
  private revision = 0;

  constructor() {
    effect(onCleanup => {
      const user = this.auth.user();
      this.revision++;
      this.usage.set(null);
      this.error.set('');
      this.loading.set(false);
      if (this.auth.isDemo || !user) return;
      untracked(() => { void this.refresh(); });
      const refresh = () => {
        if (document.visibilityState === 'visible' && navigator.onLine) void this.refresh();
      };
      const timer = setInterval(refresh, 60_000);
      document.addEventListener('visibilitychange', refresh);
      window.addEventListener('online', refresh);
      onCleanup(() => {
        clearInterval(timer);
        document.removeEventListener('visibilitychange', refresh);
        window.removeEventListener('online', refresh);
      });
    });
  }

  async refresh(): Promise<void> {
    const userId = this.auth.user()?.id;
    const client = this.auth.client;
    if (this.auth.isDemo || !userId || !client) return;
    const revision = ++this.revision;
    this.loading.set(true);
    try {
      const { data, error } = await client.rpc('project_storage_usage');
      if (revision !== this.revision || userId !== this.auth.user()?.id) return;
      if (error) throw error;
      this.usage.set(parseStorageUsage(data));
      this.error.set('');
    } catch {
      if (revision === this.revision && userId === this.auth.user()?.id) {
        this.usage.set(null);
        this.error.set('No se pudo consultar Storage. Comprueba la conexión y aplica la migración storage_usage en Supabase.');
      }
    } finally {
      if (revision === this.revision && userId === this.auth.user()?.id) this.loading.set(false);
    }
  }
}
