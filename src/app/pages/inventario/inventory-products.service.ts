import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface InventoryProduct {
  id: string;
  code: string;
  articulo: string;
  presentacion: string;
  marca: string;
  created_at?: string;
}


export interface InventoryEntryItem {
  id: string;
  product_id: string;
  code: string;
  articulo: string;
  presentacion: string;
  marca: string;
  costo: number;
  iva_tipo?: string;
  costo_base?: number;
  iva_valor?: number;
  costo_total?: number;
  venta_factor?: number;
  precio_venta?: number;
  fecha_vencimiento: string;
  lote: string;
  invima: string;
  cantidad: number;
  created_at: string;
}

export interface InventorySummaryItem {
  id: string;
  code: string;
  articulo: string;
  presentacion: string;
  marca: string;
  total_cantidad: number | string;
}


@Injectable({ providedIn: 'root' })
export class InventoryProductsService {
  private readonly apiBase = 'http://localhost:5050';

  constructor(private readonly http: HttpClient) {}

  async listProducts(clientId: string): Promise<InventoryProduct[]> {
    return firstValueFrom(
      this.http.get<InventoryProduct[]>(`${this.apiBase}/inventory/${clientId}/products`)
    );
  }


  async listEntries(clientId: string): Promise<InventoryEntryItem[]> {
    return firstValueFrom(
      this.http.get<InventoryEntryItem[]>(`${this.apiBase}/inventory/${clientId}/entries`)
    );
  }

  async listSummary(clientId: string): Promise<InventorySummaryItem[]> {
    return firstValueFrom(
      this.http.get<InventorySummaryItem[]>(`${this.apiBase}/inventory/${clientId}/summary`)
    );
  }

  async createProduct(clientId: string, payload: {
    code: string;
    articulo: string;
    presentacion: string;
    marca: string;
  }): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiBase}/inventory/${clientId}/products`, payload)
    );
  }

  async createProductsBulk(clientId: string, items: {
    code: string;
    articulo: string;
    presentacion: string;
    marca: string;
  }[]): Promise<{ inserted: number; skipped: number }> {
    return firstValueFrom(
      this.http.post<{ inserted: number; skipped: number }>(
        `${this.apiBase}/inventory/${clientId}/products/bulk`,
        { items }
      )
    );
  }

  async createEntry(clientId: string, payload: {
    productId: string;
    costo: number;
    ivaTipo: string;
    costoBase: number;
    ivaValor: number;
    costoTotal: number;
    ventaFactor: number;
    precioVenta: number;
    fechaVencimiento: string;
    lote: string;
    invima: string;
    cantidad: number;
  }): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.apiBase}/inventory/${clientId}/entries`, payload)
    );
  }

  async deleteProduct(clientId: string, id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.apiBase}/inventory/${clientId}/products/${id}`)
    );
  }

  async updateProduct(clientId: string, id: string, payload: {
    code: string;
    articulo: string;
    presentacion: string;
    marca: string;
  }): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${this.apiBase}/inventory/${clientId}/products/${id}`, payload)
    );
  }

  async deleteEntry(clientId: string, id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.apiBase}/inventory/${clientId}/entries/${id}`)
    );
  }

  async updateEntry(clientId: string, id: string, payload: {
    costo: number;
    ivaTipo: string;
    costoBase: number;
    ivaValor: number;
    costoTotal: number;
    ventaFactor: number;
    precioVenta: number;
    fechaVencimiento: string;
    lote: string;
    invima: string;
    cantidad: number;
  }): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${this.apiBase}/inventory/${clientId}/entries/${id}`, payload)
    );
  }
}
