import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { LOCALE_ID, importProvidersFrom } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import es from '@angular/common/locales/es';
import { DialogModule } from '@angular/cdk/dialog';
import {
  provideLucideIcons,
  LucideLayoutGrid,
  LucideFolder,
  LucideTicket,
  LucideSquareCheck,
  LucideColumns3,
  LucideClock,
  LucideCalendar,
  LucideUsers,
  LucideChartNoAxesCombined,
  LucideBell,
  LucideSettings,
  LucideSearch,
  LucideMenu,
  LucideMoon,
  LucideSun,
  LucideChevronRight,
  LucideChevronLeft,
  LucidePlus,
  LucideX,
  LucideGripVertical,
} from '@lucide/angular';
registerLocaleData(es);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: LOCALE_ID, useValue: 'es' },
    importProvidersFrom(DialogModule),
    provideLucideIcons(
      LucideLayoutGrid,
      LucideFolder,
      LucideTicket,
      LucideSquareCheck,
      LucideColumns3,
      LucideClock,
      LucideCalendar,
      LucideUsers,
      LucideChartNoAxesCombined,
      LucideBell,
      LucideSettings,
      LucideSearch,
      LucideMenu,
      LucideMoon,
      LucideSun,
      LucideChevronRight,
      LucideChevronLeft,
      LucidePlus,
      LucideX,
      LucideGripVertical,
    ),
  ],
};
