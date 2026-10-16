import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { SupabaseService } from './supabase.service';
import { screenshotFilename, validateScreenshot } from './screenshot-validation';

export interface TicketScreenshot {
  path: string;
  name: string;
  url: string;
}
interface LocalScreenshot {
  path: string;
  scope: string;
  workspaceId: string;
  name: string;
  blob: Blob;
}
const BUCKET = 'ticket-screenshots';

@Injectable({ providedIn: 'root' })
export class TicketScreenshotsService {
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService);

  private context(workspaceId: string, ticketId?: string) {
    if (
      !/^[a-zA-Z0-9_-]+$/.test(workspaceId) ||
      (ticketId !== undefined && !/^[a-zA-Z0-9_-]+$/.test(ticketId))
    )
      throw new Error('El espacio o ticket no es válido.');
    const userId = this.auth.user()?.id;
    if (!this.auth.isDemo && (!this.supabase.client || !userId))
      throw new Error('Inicia sesión para acceder a las capturas.');
    return { userId, demo: this.auth.isDemo, scope: `${workspaceId}/${ticketId ?? ''}` };
  }
  private assertUser(userId: string | undefined) {
    if (userId !== this.auth.user()?.id)
      throw new Error('La sesión ha cambiado. Vuelve a abrir el ticket.');
  }
  private async local<T>(
    mode: IDBTransactionMode,
    request: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('projectly-ticket-screenshots-v1', 1);
      open.onupgradeneeded = () => {
        const store = open.result.createObjectStore('screenshots', { keyPath: 'path' });
        store.createIndex('scope', 'scope');
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () =>
        reject(new Error('No se pudo abrir el almacenamiento local de capturas.'));
    });
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction('screenshots', mode);
      const operation = request(transaction.objectStore('screenshots'));
      transaction.oncomplete = () => {
        db.close();
        resolve(operation.result);
      };
      transaction.onabort = () => {
        db.close();
        reject(new Error('No se pudieron guardar o leer las capturas locales.'));
      };
      transaction.onerror = () => {};
    });
  }
  async list(workspaceId: string, ticketId: string): Promise<TicketScreenshot[]> {
    const context = this.context(workspaceId, ticketId);
    if (context.demo) {
      const rows = await this.local<LocalScreenshot[]>('readonly', (store) =>
        store.index('scope').getAll(context.scope),
      );
      return rows.map((row) => ({
        path: row.path,
        name: row.name,
        url: URL.createObjectURL(row.blob),
      }));
    }
    const prefix = `${context.userId}/${context.scope}`;
    const { data, error } = await this.supabase
      .client!.storage.from(BUCKET)
      .list(prefix, { limit: 100, sortBy: { column: 'created_at', order: 'asc' } });
    if (error)
      throw new Error(
        'No se pudieron cargar las capturas. Comprueba la migración del bucket y vuelve a intentar.',
      );
    this.assertUser(context.userId);
    const files = (data ?? []).filter((file) => file.id);
    if (!files.length) return [];
    const paths = files.map((file) => `${prefix}/${file.name}`);
    const signed = await this.supabase.client!.storage.from(BUCKET).createSignedUrls(paths, 3600);
    if (
      signed.error ||
      signed.data?.length !== files.length ||
      signed.data.some((file) => file.error || !file.signedUrl)
    )
      throw new Error('No se pudieron abrir las capturas privadas.');
    this.assertUser(context.userId);
    return files.map((file, index) => ({
      path: paths[index],
      name: file.name.replace(/^[0-9a-f-]{36}_/i, ''),
      url: signed.data![index].signedUrl!,
    }));
  }
  async upload(workspaceId: string, ticketId: string, file: File): Promise<TicketScreenshot> {
    const context = this.context(workspaceId, ticketId);
    await validateScreenshot(file);
    this.assertUser(context.userId);
    const name = screenshotFilename(file),
      leaf = `${crypto.randomUUID()}_${name}`;
    if (context.demo) {
      const path = `${context.scope}/${leaf}`;
      await this.local('readwrite', (store) =>
        store.add({
          path,
          scope: context.scope,
          workspaceId,
          name,
          blob: file,
        } satisfies LocalScreenshot),
      );
      return { path, name, url: URL.createObjectURL(file) };
    }
    const path = `${context.userId}/${context.scope}/${leaf}`;
    const { error } = await this.supabase
      .client!.storage.from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error)
      throw new Error(
        'No se pudo subir la captura. Verifica la conexión y la migración del bucket.',
      );
    this.assertUser(context.userId);
    return { path, name, url: URL.createObjectURL(file) };
  }
  async remove(workspaceId: string, ticketId: string, path: string): Promise<void> {
    const context = this.context(workspaceId, ticketId);
    const prefix = context.demo ? `${context.scope}/` : `${context.userId}/${context.scope}/`;
    if (!path.startsWith(prefix) || path.slice(prefix.length).includes('/'))
      throw new Error('La captura no pertenece a este ticket.');
    if (context.demo) await this.local('readwrite', (store) => store.delete(path));
    else {
      const { error } = await this.supabase.client!.storage.from(BUCKET).remove([path]);
      if (error) throw new Error('No se pudo eliminar la captura. Vuelve a intentar.');
      this.assertUser(context.userId);
    }
  }
  async cleanup(workspaceId: string, ticketId?: string): Promise<void> {
    const context = this.context(workspaceId, ticketId);
    if (context.demo) {
      const rows = await this.local<LocalScreenshot[]>('readonly', (store) => store.getAll());
      for (const row of rows.filter(
        (row) => row.workspaceId === workspaceId && (!ticketId || row.scope === context.scope),
      ))
        await this.local('readwrite', (store) => store.delete(row.path));
      return;
    }
    const bucket = this.supabase.client!.storage.from(BUCKET),
      paths: string[] = [];
    const visit = async (prefix: string) => {
      for (let offset = 0; ; offset += 100) {
        this.assertUser(context.userId);
        const { data, error } = await bucket.list(prefix, {
          limit: 100,
          offset,
          sortBy: { column: 'name', order: 'asc' },
        });
        if (error) throw error;
        for (const item of data ?? []) {
          if (item.id) paths.push(`${prefix}/${item.name}`);
          else await visit(`${prefix}/${item.name}`);
        }
        if (!data || data.length < 100) break;
      }
    };
    await visit(`${context.userId}/${context.scope}`.replace(/\/$/, ''));
    for (let index = 0; index < paths.length; index += 100) {
      this.assertUser(context.userId);
      const { error } = await bucket.remove(paths.slice(index, index + 100));
      if (error) throw error;
    }
  }
}
