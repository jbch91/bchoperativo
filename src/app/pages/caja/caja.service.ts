import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../../shared/api-base';

export interface CashTransaction {
  id: string;
  type: 'in' | 'out';
  category: string;
  amount: number;
  description?: string | null;
  created_at: string;
  source: string;
  sale_id?: string | null;
  payment_method?: string | null;
}

export interface CashSummary {
  totalIn: number;
  totalOut: number;
  balance: number;
}

@Injectable({ providedIn: 'root' })
export class CajaService {
  private readonly apiBase = API_BASE;

  constructor(private readonly http: HttpClient) {}

  async getSummary(clientId: string): Promise<CashSummary> {
    return firstValueFrom(this.http.get<CashSummary>(`${this.apiBase}/cash/${clientId}/summary`));
  }

  async listTransactions(clientId: string, filters: {
    type?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<CashTransaction[]> {
    let params = new HttpParams();
    if (filters.type && filters.type !== 'all') params = params.set('type', filters.type);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.dateFrom) params = params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params = params.set('date_to', filters.dateTo);
    return firstValueFrom(
      this.http.get<CashTransaction[]>(`${this.apiBase}/cash/${clientId}/transactions`, { params })
    );
  }

  async createTransaction(clientId: string, payload: {
    type: 'in' | 'out';
    category: string;
    amount: number;
    description?: string;
    source?: string;
  }): Promise<{ id: string; created_at: string }> {
    return firstValueFrom(
      this.http.post<{ id: string; created_at: string }>(`${this.apiBase}/cash/${clientId}/transactions`, payload)
    );
  }

  async updateTransaction(clientId: string, id: string, payload: {
    type: 'in' | 'out';
    category: string;
    amount: number;
    description?: string;
  }): Promise<{ ok: boolean }> {
    return firstValueFrom(
      this.http.put<{ ok: boolean }>(`${this.apiBase}/cash/${clientId}/transactions/${id}`, payload)
    );
  }

  async deleteTransaction(clientId: string, id: string): Promise<{ ok: boolean }> {
    return firstValueFrom(
      this.http.delete<{ ok: boolean }>(`${this.apiBase}/cash/${clientId}/transactions/${id}`)
    );
  }
}
