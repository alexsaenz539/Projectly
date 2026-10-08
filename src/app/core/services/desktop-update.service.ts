import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
export interface UpdateState {
  status:
    | 'idle'
    | 'development'
    | 'checking'
    | 'downloading'
    | 'up-to-date'
    | 'ready'
    | 'installing'
    | 'error';
  currentVersion: string;
  availableVersion: string | null;
  progress: number;
  message: string;
  enabled: boolean;
  lastCheckedAt: string | null;
}
export interface DesktopBridge {
  getUpdateState(): Promise<UpdateState>;
  checkForUpdates(): Promise<UpdateState>;
  installUpdate(): Promise<{ ok: boolean; message?: string }>;
  onUpdateState(listener: (state: UpdateState) => void): () => void;
}
declare global {
  interface Window {
    projectOSDesktop?: DesktopBridge;
  }
}
@Injectable({ providedIn: 'root' })
export class DesktopUpdateService {
  private readonly zone = inject(NgZone);
  private readonly bridge = window.projectOSDesktop;
  readonly isDesktop = Boolean(this.bridge);
  readonly state = signal<UpdateState | null>(null);
  readonly error = signal('');
  readonly working = computed(() =>
    ['checking', 'downloading', 'installing'].includes(this.state()?.status || ''),
  );
  private revision = 0;
  constructor() {
    if (!this.bridge) return;
    this.bridge.onUpdateState((state) =>
      this.zone.run(() => {
        this.revision++;
        this.state.set(state);
        this.error.set('');
      }),
    );
    const revision = this.revision;
    void this.bridge
      .getUpdateState()
      .then((state) => {
        if (this.revision === revision) this.state.set(state);
      })
      .catch(() => this.error.set('No se pudo consultar el estado de la aplicación.'));
  }
  async check() {
    if (!this.bridge || this.working() || this.state()?.status === 'ready') return;
    this.error.set('');
    const revision = this.revision;
    try {
      const state = await this.bridge.checkForUpdates();
      if (this.revision === revision) this.state.set(state);
    } catch {
      this.error.set('No se pudo buscar una nueva versión. Inténtalo nuevamente.');
    }
  }
  async install() {
    if (!this.bridge || this.state()?.status !== 'ready') return;
    this.error.set('');
    try {
      const result = await this.bridge.installUpdate();
      if (!result.ok) this.error.set(result.message || 'No se pudo iniciar la instalación.');
    } catch {
      this.error.set('No se pudo iniciar la instalación. Inténtalo nuevamente.');
    }
  }
}
