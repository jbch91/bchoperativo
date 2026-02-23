import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { LoginResult, Permission, Role, User } from './models';
import { API_BASE } from '../shared/api-base';

interface LoginResponse {
  user: {
    sub: string;
    username: string;
    displayName: string;
    clientId?: string | null;
    roles: Role[];
    permissions: Permission[];
  };
  accessToken: string;
  refreshToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'auth_user_v1';
  private readonly tokenKey = 'auth_tokens_v1';
  private readonly modulesKey = 'auth_modules_v1';
  private readonly apiBase = API_BASE;

  readonly currentUser = signal<User | null>(this.loadStoredUser());
  readonly tokens = signal<{ accessToken: string; refreshToken: string } | null>(
    this.loadStoredTokens()
  );
  readonly modules = signal<string[] | null>(this.loadStoredModules());

  constructor(private readonly http: HttpClient) {}

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  async login(username: string, password: string): Promise<LoginResult> {
    try {
      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${this.apiBase}/auth/login`, {
          username,
          password
        })
      );

      const role = (response.user.roles[0] ?? 'viewer') as Role;
      const user: User = {
        id: response.user.sub,
        username: response.user.username,
        displayName: response.user.displayName,
        clientId: response.user.clientId ?? null,
        role,
        permissions: response.user.permissions
      };

      this.currentUser.set(user);
      this.tokens.set({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken
      });

      localStorage.setItem(this.storageKey, JSON.stringify(user));
      localStorage.setItem(
        this.tokenKey,
        JSON.stringify({ accessToken: response.accessToken, refreshToken: response.refreshToken })
      );

      await this.loadModules();
      return { ok: true };
    } catch (error: any) {
      console.error(error);
      return {
        ok: false,
        message: error?.error?.message ?? 'Usuario o contraseña incorrectos.'
      };
    }
  }

  logout(): void {
    const refreshToken = this.tokens()?.refreshToken;
    if (refreshToken) {
      void firstValueFrom(
        this.http.post(`${this.apiBase}/auth/logout`, { refreshToken })
      ).catch(() => {});
    }

    this.currentUser.set(null);
    this.tokens.set(null);
    this.modules.set(null);
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.modulesKey);
  }

  async refreshSession(): Promise<boolean> {
    const refreshToken = this.tokens()?.refreshToken;
    if (!refreshToken) {
      return false;
    }

    try {
      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${this.apiBase}/auth/refresh`, { refreshToken })
      );

      const role = (response.user.roles[0] ?? 'viewer') as Role;
      const user: User = {
        id: response.user.sub,
        username: response.user.username,
        displayName: response.user.displayName,
        clientId: response.user.clientId ?? null,
        role,
        permissions: response.user.permissions
      };

      this.currentUser.set(user);
      this.tokens.set({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken
      });

      localStorage.setItem(this.storageKey, JSON.stringify(user));
      localStorage.setItem(
        this.tokenKey,
        JSON.stringify({ accessToken: response.accessToken, refreshToken: response.refreshToken })
      );

      await this.loadModules();
      return true;
    } catch (error) {
      console.error(error);
      this.logout();
      return false;
    }
  }

  hasRole(roles: Role[] | Role): boolean {
    const user = this.currentUser();
    if (!user) {
      return false;
    }

    const roleList = Array.isArray(roles) ? roles : [roles];
    return roleList.includes(user.role);
  }

  hasPermission(permissions: Permission[] | Permission): boolean {
    const user = this.currentUser();
    if (!user) {
      return false;
    }

    const required = Array.isArray(permissions) ? permissions : [permissions];
    return required.every((permission) => user.permissions.includes(permission));
  }

  hasModule(moduleKey: string): boolean {
    const list = this.modules();
    if (!list) return true;
    return list.includes(moduleKey);
  }

  private loadStoredUser(): User | null {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  private loadStoredTokens(): { accessToken: string; refreshToken: string } | null {
    const raw = localStorage.getItem(this.tokenKey);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as { accessToken: string; refreshToken: string };
    } catch {
      return null;
    }
  }

  private loadStoredModules(): string[] | null {
    const raw = localStorage.getItem(this.modulesKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return null;
    }
  }

  async loadModules(): Promise<void> {
    const tokens = this.tokens();
    if (!tokens?.accessToken) return;
    try {
      const modules = await firstValueFrom(
        this.http.get<{ key: string; enabled: boolean }[]>(`${this.apiBase}/modules/me`)
      );
      const enabled = modules.filter((m) => m.enabled).map((m) => m.key);
      this.modules.set(enabled);
      localStorage.setItem(this.modulesKey, JSON.stringify(enabled));
    } catch (error) {
      console.error(error);
    }
  }

  async requestPasswordReset(email: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.post(`${this.apiBase}/auth/forgot-password`, { email }));
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(`${this.apiBase}/auth/reset-password`, { email, code, newPassword })
      );
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }
}
