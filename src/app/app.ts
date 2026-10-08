import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UpdateBannerComponent } from './shared/components/update-banner.component';

@Component({
  imports: [RouterOutlet, UpdateBannerComponent],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {}
