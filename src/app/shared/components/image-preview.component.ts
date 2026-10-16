import { Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TicketScreenshot } from '../../core/services/ticket-screenshots.service';

@Component({
  imports: [],
  selector: 'app-image-preview',
  styleUrl: './image-preview.component.css',
  templateUrl: './image-preview.component.html',
})
export class ImagePreviewComponent {
  readonly image = inject<TicketScreenshot>(DIALOG_DATA);
  readonly ref = inject(DialogRef);
}
