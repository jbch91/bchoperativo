import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface RemisionClient {
  id: string;
  name: string;
  address?: string | null;
  contact?: string | null;
}

export interface RemisionItem {
  id: string;
  remision_number: string;
  remision_client_id?: string | null;
  recipient?: string | null;
  destination?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string | null;
}

export interface RemisionLine {
  id: string;
  entry_id: string;
  code: string;
  name: string;
  lote: string;
  vencimiento: string;
  cantidad: number;
}

@Injectable({ providedIn: 'root' })
export class RemisionesService {
  private readonly apiBase = 'http://localhost:5050';

  constructor(private readonly http: HttpClient) {}

  async listClients(clientId: string): Promise<RemisionClient[]> {
    return firstValueFrom(this.http.get<RemisionClient[]>(`${this.apiBase}/remisiones/${clientId}/clients`));
  }

  async createClient(clientId: string, payload: { name: string; address?: string; contact?: string }): Promise<{ id: string }> {
    return firstValueFrom(this.http.post<{ id: string }>(`${this.apiBase}/remisiones/${clientId}/clients`, payload));
  }

  async listRemisiones(clientId: string): Promise<RemisionItem[]> {
    return firstValueFrom(this.http.get<RemisionItem[]>(`${this.apiBase}/remisiones/${clientId}`));
  }

  async listLines(clientId: string, id: string): Promise<RemisionLine[]> {
    return firstValueFrom(this.http.get<RemisionLine[]>(`${this.apiBase}/remisiones/${clientId}/${id}/lines`));
  }

  async createRemision(clientId: string, payload: any): Promise<{ id: string; created_at: string }> {
    return firstValueFrom(this.http.post<{ id: string; created_at: string }>(`${this.apiBase}/remisiones/${clientId}`, payload));
  }

  async updateRemision(clientId: string, id: string, payload: any): Promise<{ ok: boolean }> {
    return firstValueFrom(this.http.put<{ ok: boolean }>(`${this.apiBase}/remisiones/${clientId}/${id}`, payload));
  }

  async deleteRemision(clientId: string, id: string): Promise<{ ok: boolean }> {
    return firstValueFrom(this.http.delete<{ ok: boolean }>(`${this.apiBase}/remisiones/${clientId}/${id}`));
  }
}
