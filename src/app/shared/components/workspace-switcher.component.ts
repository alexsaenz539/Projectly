import { Component, inject } from '@angular/core';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Router, RouterLink } from '@angular/router';
import { WorkspaceService } from '../../core/services/workspace.service';
import { IconComponent } from './icon.component';

@Component({
  imports: [CdkMenu, CdkMenuItem, CdkMenuTrigger, RouterLink, IconComponent],
  selector: 'app-workspace-switcher',
  styleUrl: './workspace-switcher.component.css',
  templateUrl: './workspace-switcher.component.html',
})
export class WorkspaceSwitcherComponent {
  readonly store = inject(WorkspaceService);
  private readonly router = inject(Router);

  async selectWorkspace(id: string): Promise<void> {
    if (id === this.store.activeWorkspaceId()) return;
    if (await this.store.selectWorkspace(id)) await this.router.navigate(['/dashboard']);
  }
}
