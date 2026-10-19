import { Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { InstalledRelease } from '../../../core/services/desktop-update.service';

@Component({
  imports: [],
  selector: 'app-release-notes',
  styleUrl: './release-notes.component.css',
  templateUrl: './release-notes.component.html',
})
export class ReleaseNotesComponent {
  readonly release = inject<InstalledRelease>(DIALOG_DATA);
  readonly ref = inject(DialogRef);
}
