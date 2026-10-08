import { Injector, inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
export const workspaceGuard: CanActivateChildFn = async (route) => {
  if (['workspaces', 'settings'].includes(route.routeConfig?.path ?? '')) return true;
  const injector = inject(Injector),
    router = inject(Router);
  const { WorkspaceService } = await import('../services/workspace.service');
  const store = injector.get(WorkspaceService);
  try {
    await store.loadWorkspaces();
  } catch {
    return router.createUrlTree(['/workspaces']);
  }
  return store.hasWorkspace() || router.createUrlTree(['/workspaces']);
};
