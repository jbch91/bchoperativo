import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface SaleDto {
  id: string;
  created_at: string;
  total_base: number;
  total_iva: number;
  total: number;
  buyer_name?: string | null;
  buyer_document?: string | null;
  buyer_address?: string | null;
  consumption_area?: string | null;
  consumption_note?: string | null;
  sale_type?: string | null;
  service_type?: string | null;
  payment_method?: string | null;
}

export interface SaleLineDto {
  id: string;
  entry_id: string;
  code: string;
  name: string;
  lote: string;
  vencimiento: string;
  cantidad: number;
  unitario: number;
  iva: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class VentasService {
  private readonly apiBase = 'http://localhost:5050';

  constructor(private readonly http: HttpClient) {}

  async createSale(clientId: string, payload: {
    totalBase: number;
    totalIva: number;
    total: number;
    lines: any[];
    buyerName?: string;
    buyerDocument?: string;
    buyerAddress?: string;
    consumptionArea?: string;
    consumptionNote?: string;
    saleType?: string;
    serviceType?: string;
    paymentMethod?: string;
  }): Promise<{ id: string; created_at: string }> {
    return firstValueFrom(
      this.http.post<{ id: string; created_at: string }>(`${this.apiBase}/sales/${clientId}`, payload)
    );
  }

  async listSales(clientId: string): Promise<SaleDto[]> {
    return firstValueFrom(
      this.http.get<SaleDto[]>(`${this.apiBase}/sales/${clientId}`)
    );
  }

  async listSaleLines(clientId: string, saleId: string): Promise<SaleLineDto[]> {
    return firstValueFrom(
      this.http.get<SaleLineDto[]>(`${this.apiBase}/sales/${clientId}/${saleId}/lines`)
    );
  }

  async updateSale(clientId: string, saleId: string, payload: {
    totalBase: number;
    totalIva: number;
    total: number;
    buyerName?: string;
    buyerDocument?: string;
    buyerAddress?: string;
    consumptionArea?: string;
    consumptionNote?: string;
    saleType?: string;
    serviceType?: string;
    paymentMethod?: string;
    lines: any[];
  }): Promise<{ ok: boolean }> {
    return firstValueFrom(
      this.http.put<{ ok: boolean }>(`${this.apiBase}/sales/${clientId}/${saleId}`, payload)
    );
  }

  async deleteSale(clientId: string, saleId: string): Promise<{ ok: boolean }> {
    return firstValueFrom(
      this.http.delete<{ ok: boolean }>(`${this.apiBase}/sales/${clientId}/${saleId}`)
    );
  }
}
