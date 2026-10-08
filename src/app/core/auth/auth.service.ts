import { Injectable, computed, inject, signal } from '@angular/core';
import type { User } from '@supabase/supabase-js';
import { SupabaseService } from '../services/supabase.service';
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);
  get client() {
    return this.supabase.client;
  }
  readonly user = signal<User | null>(null);
  readonly isDemo = !this.supabase.configured;
  private readonly demoSignedIn = signal(false);
  readonly hasAccess = computed(() => this.user() !== null || (this.isDemo && this.demoSignedIn()));
  readonly ready = this.initialize();
  private async initialize() {
    await this.supabase.ready;
    if (!this.client) return;
    this.client.auth.onAuthStateChange((_event, session) => this.user.set(session?.user ?? null));
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    this.user.set(data.session?.user ?? null);
  }
  async signIn(email: string, password: string) {
    await this.ready;
    if (!this.client) {
      if (!this.isDemo) throw new Error('No se pudo conectar con Supabase.');
      this.demoSignedIn.set(true);
      return;
    }
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.user.set(data.user);
  }
  async signUp(email: string, password: string, fullName: string) {
    await this.ready;
    if (!this.client) {
      if (!this.isDemo) throw new Error('No se pudo conectar con Supabase.');
      return false;
    }
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    if (data.session) this.user.set(data.session.user);
    return Boolean(data.session);
  }
  async signOut() {
    const result = await this.client?.auth.signOut();
    if (result?.error) throw result.error;
    this.demoSignedIn.set(false);
    this.user.set(null);
  }
}
