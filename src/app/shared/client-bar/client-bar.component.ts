import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientContextService } from '../client-context.service';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-client-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './client-bar.component.html',
  styleUrl: './client-bar.component.scss'
})
export class ClientBarComponent {
  searchTerm = '';

  constructor(
    public readonly clientContext: ClientContextService,
    public readonly auth: AuthService
  ) {
    void this.clientContext.init();
  }

  get filteredClients() {
    const term = this.searchTerm.toLowerCase().trim();
    const clients = this.clientContext.clients();
    if (!term) return clients;
    return clients.filter((client) => client.name.toLowerCase().includes(term));
  }

  get selectedClientInfo() {
    return this.clientContext.selectedClientInfo;
  }

  clientLogoUrl(): string | null {
    const client = this.selectedClientInfo;
    if (!client?.logoPath) return null;
    if (client.logoPath.startsWith('http')) return client.logoPath;
    return `http://localhost:5050${client.logoPath}`;
  }
}
