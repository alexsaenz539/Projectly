import { Component, computed, inject, input, signal } from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { Member } from '../../../core/services/models';
import { MemberProfileService } from '../../../core/services/member-profile.service';

let nextTooltipId = 0;

@Component({
  imports: [OverlayModule],
  selector: 'app-assignee-avatar',
  styleUrl: './assignee-avatar.component.css',
  templateUrl: './assignee-avatar.component.html',
})
export class AssigneeAvatarComponent {
  readonly member = input<Member | undefined>();
  readonly profiles = inject(MemberProfileService);
  readonly hovered = signal(false);
  readonly focused = signal(false);
  readonly dismissed = signal(false);
  readonly failedImage = signal('');
  readonly tooltipId = `assignee-tooltip-${++nextTooltipId}`;
  readonly name = computed(() => this.member()?.name || 'Sin asignar');
  readonly initials = computed(() => {
    const words = this.member()?.name.trim().split(/\s+/).filter(Boolean) ?? [];
    return words.length
      ? (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toLocaleUpperCase('es')
      : '—';
  });
  readonly image = computed(() => this.profiles.image(this.member()));
  readonly showTooltip = computed(() => !this.dismissed() && (this.hovered() || this.focused()));
  readonly positions = [
    {
      originX: 'center' as const,
      originY: 'top' as const,
      overlayX: 'center' as const,
      overlayY: 'bottom' as const,
      offsetY: -8,
    },
    {
      originX: 'center' as const,
      originY: 'bottom' as const,
      overlayX: 'center' as const,
      overlayY: 'top' as const,
      offsetY: 8,
    },
  ];
}
