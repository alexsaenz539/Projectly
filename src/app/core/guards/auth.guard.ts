import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService),
    router = inject(Router);
  try {
    await auth.ready;
  } catch {
    return router.createUrlTree(['/login']);
  }
  return auth.hasAccess() || router.createUrlTree(['/login']);
};
