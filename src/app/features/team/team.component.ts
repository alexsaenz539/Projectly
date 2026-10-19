import { Component, inject } from '@angular/core';
import { WorkspaceService } from '../../core/services/workspace.service';
import { EditorService } from '../../core/services/editor.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { IconComponent } from '../../shared/components/icon.component';
import { AssigneeAvatarComponent } from '../../shared/components/assignee-avatar/assignee-avatar.component';
import { MemberProfileService } from '../../core/services/member-profile.service';
@Component({
  selector: 'app-team',
  imports: [PageHeaderComponent, IconComponent, AssigneeAvatarComponent],
  templateUrl: './team.component.html',
})
export class TeamComponent {
  readonly store = inject(WorkspaceService);
  readonly editor = inject(EditorService);
  readonly profiles = inject(MemberProfileService);
  assigned(id: string) {
    return this.store.tickets().filter((t) => t.assignee === id && t.status !== 'Completado')
      .length;
  }
}
