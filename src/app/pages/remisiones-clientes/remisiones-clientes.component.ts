import { ChangeDetectorRef, Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ClientContextService } from '../../shared/client-context.service';
import { AuthService } from '../../auth/auth.service';
import { RemisionClient, RemisionesService } from '../remisiones/remisiones.service';

@Component({
  selector: 'app-remisiones-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './remisiones-clientes.component.html',
  styleUrl: './remisiones-clientes.component.scss'
})
export class RemisionesClientesComponent {
  clients: RemisionClient[] = [];
  loading = false;
  errorMessage = '';

  name = '';
  address = '';
  contact = '';

  constructor(
    public readonly clientContext: ClientContextService,
    public readonly auth: AuthService,
    private readonly remisiones: RemisionesService,
    private readonly cdr: ChangeDetectorRef
  ) {
    void this.clientContext.init();
    void this.loadClients();
    effect(() => {
      const clientId = this.clientContext.selectedClientId();
      if (clientId) {
        void this.loadClients();
      }
    });
  }

  async loadClients(): Promise<void> {
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    this.loading = true;
    try {
      this.clients = await this.remisiones.listClients(clientId);
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudieron cargar los clientes.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async createClient(): Promise<void> {
    const clientId = this.clientContext.selectedClientId();
    if (!clientId || !this.name.trim()) return;
    await this.remisiones.createClient(clientId, {
      name: this.name.trim(),
      address: this.address.trim(),
      contact: this.contact.trim()
    });
    this.name = '';
    this.address = '';
    this.contact = '';
    await this.loadClients();
  }
}
