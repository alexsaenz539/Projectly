import { Injectable, OnDestroy, signal } from '@angular/core';
export type ToastKind = 'success' | 'error' | 'warning' | 'info';
export interface ToastMessage {
  id: number;
  message: string;
  kind: ToastKind;
}
@Injectable({ providedIn: 'root' })
export class ToastService implements OnDestroy {
  readonly messages = signal<ToastMessage[]>([]);
  private nextId = 0;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  show(message: string, kind: ToastKind = 'info'): number {
    message = message.trim();
    if (!message) return 0;
    const existing = this.messages().find((item) => item.message === message && item.kind === kind);
    if (existing) return existing.id;
    const id = ++this.nextId;
    if (this.messages().length >= 4) this.dismiss(this.messages()[0].id);
    this.messages.update((items) => [...items, { id, message, kind }]);
    if (kind !== 'error') this.resume(id);
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
  pause(id: number) {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
  }
  resume(id: number) {
    this.pause(id);
    const item = this.messages().find((message) => message.id === id);
    if (item && item.kind !== 'error')
      this.timers.set(
        id,
        setTimeout(() => this.dismiss(id), 6000),
      );
  }
  dismiss(id: number) {
    this.pause(id);
    this.messages.update((items) => items.filter((item) => item.id !== id));
  }
  ngOnDestroy() {
    for (const id of this.timers.keys()) this.pause(id);
  }
}
