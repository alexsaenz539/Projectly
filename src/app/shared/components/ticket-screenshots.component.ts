import { Component, computed, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import {
  TicketScreenshot,
  TicketScreenshotsService,
} from '../../core/services/ticket-screenshots.service';
import { SCREENSHOT_LIMIT, validateScreenshot } from '../../core/services/screenshot-validation';
import { ImagePreviewComponent } from './image-preview.component';
import { ToastFeedbackDirective } from './toast-feedback.directive';

interface PendingScreenshot {
  id: string;
  file: File;
  url: string;
}

@Component({
  imports: [ToastFeedbackDirective],
  selector: 'app-ticket-screenshots',
  styleUrl: './ticket-screenshots.component.css',
  templateUrl: './ticket-screenshots.component.html',
})
export class TicketScreenshotsComponent implements OnInit, OnDestroy {
  readonly workspaceId = input.required<string>();
  readonly ticketId = input.required<string>();
  readonly existing = input(false);
  readonly busy = input(false);
  readonly readOnly = input(false);
  readonly saved = signal<TicketScreenshot[]>([]);
  readonly pending = signal<PendingScreenshot[]>([]);
  readonly removed = signal<Set<string>>(new Set());
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly processing = signal(false);
  readonly error = signal('');
  readonly limit = SCREENSHOT_LIMIT;
  readonly visible = computed(() =>
    this.saved().filter((image) => !this.removed().has(image.path)),
  );
  readonly count = computed(() => this.visible().length + this.pending().length);
  private readonly service = inject(TicketScreenshotsService);
  private readonly dialog = inject(Dialog);
  private destroyed = false;

  ngOnInit(): void {
    if (this.existing()) void this.load();
  }
  private release(url: string): void {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    this.saved().forEach((image) => this.release(image.url));
    this.pending().forEach((image) => this.release(image.url));
  }
  async load(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.error.set('');
    try {
      const images = await this.service.list(this.workspaceId(), this.ticketId());
      if (this.destroyed) {
        images.forEach((image) => this.release(image.url));
        return;
      }
      this.saved().forEach((image) => this.release(image.url));
      this.saved.set(images);
    } catch (error) {
      this.loadFailed.set(true);
      this.error.set(
        error instanceof Error ? error.message : 'No se pudieron cargar las capturas.',
      );
    } finally {
      this.loading.set(false);
    }
  }
  async addFiles(files: FileList | File[]): Promise<void> {
    if (this.readOnly() || this.busy() || this.loading() || this.processing() || this.loadFailed()) return;
    this.processing.set(true);
    this.error.set('');
    const errors: string[] = [];
    try {
      for (const file of Array.from(files)) {
        if (this.count() >= this.limit) {
          errors.push(`Puedes adjuntar hasta ${this.limit} capturas por ticket.`);
          break;
        }
        try {
          await validateScreenshot(file);
          if (this.destroyed) return;
          this.pending.update((images) => [
            ...images,
            { id: crypto.randomUUID(), file, url: URL.createObjectURL(file) },
          ]);
        } catch (error) {
          errors.push(
            `${file.name}: ${error instanceof Error ? error.message : 'Imagen no válida.'}`,
          );
        }
      }
      this.error.set(errors.join(' '));
    } finally {
      this.processing.set(false);
    }
  }
  selected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) void this.addFiles(Array.from(input.files));
    input.value = '';
  }
  paste(event: ClipboardEvent): void {
    if (this.readOnly()) return;
    if (event.defaultPrevented || !event.clipboardData?.files.length) return;
    event.preventDefault();
    void this.addFiles(event.clipboardData.files);
  }
  drop(event: DragEvent): void {
    event.preventDefault();
    if (this.readOnly()) return;
    if (event.dataTransfer?.files) void this.addFiles(event.dataTransfer.files);
  }
  removePending(image: PendingScreenshot): void {
    if (this.readOnly()) return;
    this.release(image.url);
    this.pending.update((images) => images.filter((item) => item.id !== image.id));
  }
  removeSaved(image: TicketScreenshot): void {
    if (this.readOnly()) return;
    this.removed.update((paths) => new Set([...paths, image.path]));
  }
  undo(): void {
    if (this.readOnly()) return;
    this.removed.set(new Set());
  }
  preview(image: TicketScreenshot): void {
    this.dialog.open(ImagePreviewComponent, {
      data: image,
      width: '1000px',
      maxWidth: 'calc(100vw - 32px)',
      ariaLabel: image.name,
      restoreFocus: true,
    });
  }
  async persist(): Promise<void> {
    if (this.readOnly()) return;
    if (!this.pending().length && !this.removed().size) return;
    if (this.processing() || this.loading() || this.loadFailed())
      throw new Error('Espera a que las capturas terminen de cargar.');
    for (const queued of [...this.pending()]) {
      const image = await this.service.upload(this.workspaceId(), this.ticketId(), queued.file);
      if (this.destroyed) {
        this.release(image.url);
        throw new Error('El formulario se cerró durante la carga.');
      }
      this.saved.update((images) => [...images, image]);
      this.removePending(queued);
    }
    for (const path of this.removed()) {
      await this.service.remove(this.workspaceId(), this.ticketId(), path);
      const image = this.saved().find((item) => item.path === path);
      if (image) this.release(image.url);
      this.saved.update((images) => images.filter((item) => item.path !== path));
      this.removed.update((paths) => new Set([...paths].filter((item) => item !== path)));
    }
  }
}
