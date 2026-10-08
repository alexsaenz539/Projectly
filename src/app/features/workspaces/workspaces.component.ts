import { Component, ElementRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WorkspaceService } from '../../core/services/workspace.service';
import { workspaceErrors, workspaceSlug } from '../../core/services/workspace-record';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { IconComponent } from '../../shared/components/icon.component';
@Component({
  selector: 'app-workspaces',
  imports: [FormsModule, PageHeaderComponent, IconComponent],
  templateUrl: './workspaces.component.html',
  styleUrl: './workspaces.component.css',
})
export class WorkspacesComponent {
  readonly store = inject(WorkspaceService);
  private readonly router = inject(Router);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly feedback = signal('');
  name = '';
  slug = '';
  description = '';
  slugEdited = false;
  errors = { name: '', slug: '', description: '' };
  nameChanged(value: string) {
    this.name = value;
    this.errors.name = '';
    if (!this.slugEdited) {
      this.slug = workspaceSlug(value);
      this.errors.slug = '';
    }
    this.feedback.set('');
  }
  async create() {
    if (this.store.spaceBusy()) return;
    this.slug = this.slug.trim();
    this.errors = workspaceErrors(
      this.name,
      this.slug,
      this.description,
      this.store.workspaceDirectory(),
    );
    this.feedback.set('');
    const invalid = (Object.keys(this.errors) as (keyof typeof this.errors)[]).find(
      (key) => this.errors[key],
    );
    if (invalid) {
      this.element.nativeElement.querySelector<HTMLElement>('#workspace-' + invalid)?.focus();
      return;
    }
    try {
      await this.store.createWorkspace(this.name, this.slug, this.description);
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      this.feedback.set(error instanceof Error ? error.message : 'No se pudo crear el espacio.');
    }
  }
  async open(id: string) {
    if (await this.store.selectWorkspace(id)) await this.router.navigate(['/dashboard']);
  }
}
