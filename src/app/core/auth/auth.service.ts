import { Injectable, inject, signal } from '@angular/core';
import type { User } from '@supabase/supabase-js';
import { SupabaseService } from '../services/supabase.service';
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);
  get client() {
    return this.supabase.client;
  }
  readonly user = signal<User | null>(null);
  readonly ready = this.initialize();
  readonly isDemo = !this.supabase.configured;
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
    if (!this.client) throw new Error('Configura Supabase para iniciar sesión.');
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }
  async signUp(email: string, password: string) {
    await this.ready;
    if (!this.client) throw new Error('Configura Supabase para crear una cuenta.');
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) throw error;
    return Boolean(data.session);
  }
  async signOut() {
    const result = await this.client?.auth.signOut();
    if (result?.error) throw result.error;
  }
}
