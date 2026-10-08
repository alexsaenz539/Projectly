import { Injectable } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly configured = Boolean(environment.supabaseUrl && environment.supabasePublishableKey);
  client: SupabaseClient | null = null;
  readonly ready = this.initialize();
  private async initialize() {
    if (!this.configured) return;
    const { createClient } = await import('@supabase/supabase-js');
    this.client = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
  }
}
