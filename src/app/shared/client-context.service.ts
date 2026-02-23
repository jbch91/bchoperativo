import { Injectable, signal } from '@angular/core';
import { AdminService } from '../admin/admin.service';
import { AuthService } from '../auth/auth.service';

export interface ClientOption {
  id: string;
  name: string;
  nit?: string | null;
  city?: string | null;
  email?: string | null;
  address?: string | null;
  logoPath?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ClientContextService {
  private readonly storageKey = 'bch_operativo_client_v1';

  readonly clients = signal<ClientOption[]>([]);
  readonly selectedClientId = signal<string>('');
  readonly loading = signal(false);
  readonly initialized = signal(false);

  constructor(
    private readonly admin: AdminService,
    private readonly auth: AuthService
  ) {}

  async init(): Promise<void> {
    if (this.initialized()) return;
    this.loading.set(true);
    try {
      const userClientId = this.auth.currentUser()?.clientId ?? '';
      if (userClientId) {
        const client = await this.admin.getMyClient();
        if (client) {
          this.clients.set([
            {
              id: client.id,
              name: client.name,
              nit: client.nit,
              city: client.city,
              email: client.email,
              address: client.address ?? null,
              logoPath: client.logo_path ?? null
            }
          ]);
          this.selectedClientId.set(client.id);
        }
      } else if (this.auth.hasPermission('clients:manage')) {
        const rows = await this.admin.listClients();
        const clients = rows.map((row) => ({
          id: row.id,
          name: row.name,
          nit: row.nit,
          city: row.city,
          email: row.email,
          address: row.address ?? null,
          logoPath: row.logo_path ?? null
        }));
        this.clients.set(clients);
        const stored = localStorage.getItem(this.storageKey) || '';
        const exists = clients.some((c) => c.id === stored);
        const nextId = exists ? stored : (clients[0]?.id ?? '');
        this.selectedClientId.set(nextId);
        if (nextId) {
          localStorage.setItem(this.storageKey, nextId);
        }
      }
    } finally {
      this.loading.set(false);
      this.initialized.set(true);
    }
  }

  setSelectedClient(id: string): void {
    if (!id || id === this.selectedClientId()) return;
    this.selectedClientId.set(id);
    localStorage.setItem(this.storageKey, id);
  }

  get selectedClientInfo(): ClientOption | null {
    return this.clients().find((client) => client.id === this.selectedClientId()) ?? null;
  }
}
