import { Injectable, OnDestroy, signal } from '@angular/core';
export type ToastKind = 'success' | 'error' | 'warning' | 'info';
export interface ToastMessage {
  id: number;
  message: string;
  kind: ToastKind;
  paused: boolean;
}
@Injectable({ providedIn: 'root' })
export class ToastService implements OnDestroy {
  readonly messages = signal<ToastMessage[]>([]);
  private nextId = 0;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly countdowns = new Map<
    number,
    {
      remaining: number;
      startedAt: number;
      pauses: Set<string>;
    }
  >();
  show(message: string, kind: ToastKind = 'info'): number {
    message = message.trim();
    if (!message) return 0;
    const existing = this.messages().find((item) => item.message === message && item.kind === kind);
    if (existing) return existing.id;
    const id = ++this.nextId;
    if (this.messages().length >= 4) this.dismiss(this.messages()[0].id);
    this.messages.update((items) => [...items, { id, message, kind, paused: false }]);
    if (kind !== 'error') {
      this.countdowns.set(id, { remaining: 6000, startedAt: Date.now(), pauses: new Set() });
      this.resume(id);
    }
    return id;
  }
  success(message: string) {
    return this.show(message, 'success');
  }
  error(message: string) {
    return this.show(message, 'error');
  }
  warning(message: string) {
    return this.show(message, 'warning');
  }
  info(message: string) {
    return this.show(message, 'info');
  }
  pause(id: number, reason = 'manual') {
    const countdown = this.countdowns.get(id);
    if (!countdown || countdown.pauses.has(reason)) return;
    if (this.timers.has(id)) {
      countdown.remaining = Math.max(0, countdown.remaining - (Date.now() - countdown.startedAt));
    }
    countdown.pauses.add(reason);
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.messages.update((items) =>
      items.map((item) => (item.id === id ? { ...item, paused: true } : item)),
    );
  }
  resume(id: number, reason = 'manual') {
    const countdown = this.countdowns.get(id);
    if (!countdown) return;
    countdown.pauses.delete(reason);
    if (countdown.pauses.size || this.timers.has(id)) return;
    countdown.startedAt = Date.now();
    this.messages.update((items) =>
      items.map((item) => (item.id === id ? { ...item, paused: false } : item)),
    );
    this.timers.set(
      id,
      setTimeout(() => this.dismiss(id), countdown.remaining),
    );
  }
  dismiss(id: number) {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.countdowns.delete(id);
    this.messages.update((items) => items.filter((item) => item.id !== id));
  }
  ngOnDestroy() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.countdowns.clear();
  }
}
