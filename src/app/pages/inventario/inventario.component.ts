import { ChangeDetectorRef, Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { InventoryEntryItem, InventoryProductsService, InventorySummaryItem } from './inventory-products.service';
import { ClientContextService } from '../../shared/client-context.service';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './inventario.component.html',
  styleUrl: './inventario.component.scss'
})
export class InventarioComponent {
  summaryItems: InventorySummaryItem[] = [];
  entries: InventoryEntryItem[] = [];
  loading = false;
  errorMessage = '';
  searchTerm = '';
  exportFormat: 'csv' | 'xlsx' | 'pdf' = 'xlsx';
  expandedProductId: string | null = null;
  currentPage = 1;
  pageSize = 10;
  editingEntryId: string | null = null;
  editEntry = {
    costo: 0,
    ivaTipo: 'gravado',
    costoBase: 0,
    ivaValor: 0,
    costoTotal: 0,
    ventaFactor: 0.5,
    precioVenta: 0,
    fechaVencimiento: '',
    lote: '',
    invima: '',
    cantidad: 0
  };

  constructor(
    private readonly products: InventoryProductsService,
    public readonly auth: AuthService,
    public readonly clientContext: ClientContextService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router
  ) {
    void this.clientContext.init();
    void this.init();
    effect(() => {
      const clientId = this.clientContext.selectedClientId();
      if (clientId) {
        void this.loadItems();
      }
    });
  }

  async init(): Promise<void> {
    if (this.clientContext.selectedClientId()) {
      await this.loadItems();
    }
  }

  async loadItems(): Promise<void> {
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    this.loading = true;
    this.errorMessage = '';
    try {
      const [summary, entries] = await Promise.all([
        this.products.listSummary(clientId),
        this.products.listEntries(clientId)
      ]);
      this.summaryItems = summary;
      this.entries = entries;
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo cargar el inventario.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  get filteredProducts(): InventorySummaryItem[] {
    const term = this.normalize(this.searchTerm);
    return this.summaryItems.filter((item) => {
      if (!term) return true;
      const haystack = [
        item.code,
        item.articulo,
        item.presentacion,
        item.marca
      ]
        .map((value) => this.normalize(value))
        .join(' ');
      return haystack.includes(term);
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredProducts.length / this.pageSize));
  }

  get pagedProducts(): InventorySummaryItem[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredProducts.slice(start, start + this.pageSize);
  }

  get filteredCount(): number {
    return this.filteredProducts.length;
  }

  get totalCount(): number {
    return this.summaryItems.length;
  }

  get activeFilters(): { key: string; label: string }[] {
    const filters: { key: string; label: string }[] = [];
    if (this.searchTerm.trim()) {
      filters.push({ key: 'search', label: `Búsqueda: ${this.searchTerm.trim()}` });
    }
    return filters;
  }

  clearFilter(key: string): void {
    if (key === 'search') {
      this.searchTerm = '';
      this.currentPage = 1;
    }
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.currentPage = 1;
  }

  onSearchChange(): void {
    this.currentPage = 1;
  }

  changePage(next: number): void {
    if (next < 1 || next > this.totalPages) return;
    this.currentPage = next;
  }

  exportInventory(useFiltered: boolean): void {
    const items = useFiltered ? this.filteredEntries : this.entries;
    const filenameBase = useFiltered ? 'inventario-ingresos-filtrado' : 'inventario-ingresos';
    const headers = [
      'Código',
      'Artículo',
      'Presentación',
      'Marca',
      'Costo',
      'Vencimiento',
      'Lote',
      'Invima',
      'Cantidad',
      'Fecha ingreso'
    ];
    const rows = items.map((item) => [
      item.code,
      item.articulo,
      item.presentacion,
      item.marca,
      String(item.costo ?? 0),
      this.toDateString(item.fecha_vencimiento),
      item.lote,
      item.invima,
      String(item.cantidad ?? 0),
      this.toDateString(item.created_at)
    ]);

    if (this.exportFormat === 'csv') {
      const csv = this.toCsv(headers, rows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenameBase}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (this.exportFormat === 'xlsx') {
      const data = rows.map((row) => ({
        [headers[0]]: row[0],
        [headers[1]]: row[1],
        [headers[2]]: row[2],
        [headers[3]]: row[3],
        [headers[4]]: row[4],
        [headers[5]]: row[5],
        [headers[6]]: row[6],
        [headers[7]]: row[7],
        [headers[8]]: row[8],
        [headers[9]]: row[9]
      }));
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventario');
      XLSX.writeFile(workbook, `${filenameBase}.xlsx`);
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    autoTable(doc, {
      head: [headers],
      body: rows
    });
    doc.save(`${filenameBase}.pdf`);
  }

  private toCsv(headers: string[], rows: string[][]): string {
    const escape = (value: string) => `"${String(value).replace(/\"/g, '""')}"`;
    const lines = [headers.join(','), ...rows.map((row) => row.map((cell) => escape(cell)).join(','))];
    return lines.join('\n');
  }

  private normalize(value: string | number | null | undefined): string {
    return (value ?? '').toString().toLowerCase().trim();
  }

  toDateString(value: string | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toISOString().slice(0, 10);
  }

  async deleteEntry(item: InventoryEntryItem): Promise<void> {
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    await this.products.deleteEntry(clientId, item.id);
    await this.loadItems();
  }

  startEditEntry(entry: InventoryEntryItem): void {
    this.editingEntryId = entry.id;
    this.editEntry = this.hydrateEditEntry(entry);
  }

  cancelEditEntry(): void {
    this.editingEntryId = null;
  }

  async saveEditEntry(entry: InventoryEntryItem): Promise<void> {
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    this.recalculateEditIva();
    const payload: {
      costo: number;
      ivaTipo: string;
      costoBase: number;
      ivaValor: number;
      costoTotal: number;
      fechaVencimiento: string;
      lote: string;
      invima: string;
      cantidad: number;
      ventaFactor?: number;
      precioVenta?: number;
    } = {
      costo: Number(this.editEntry.costoTotal) || 0,
      ivaTipo: this.editEntry.ivaTipo,
      costoBase: Number(this.editEntry.costoBase) || 0,
      ivaValor: Number(this.editEntry.ivaValor) || 0,
      costoTotal: Number(this.editEntry.costoTotal) || 0,
      fechaVencimiento: this.editEntry.fechaVencimiento,
      lote: this.editEntry.lote,
      invima: this.editEntry.invima,
      cantidad: Number(this.editEntry.cantidad) || 0
    };
    if (this.auth.hasRole('superuser')) {
      payload.ventaFactor = Number(this.editEntry.ventaFactor) || 0.5;
      payload.precioVenta = Number(this.editEntry.precioVenta) || 0;
    }
    await this.products.updateEntry(clientId, entry.id, payload);
    this.editingEntryId = null;
    await this.loadItems();
  }

  recalculateEditIva(): void {
    const base = Number(this.editEntry.costoBase) || 0;
    const rate = this.editEntry.ivaTipo === 'gravado' ? 0.19 : 0;
    const iva = Math.round(base * rate * 100) / 100;
    this.editEntry.ivaValor = iva;
    this.editEntry.costoTotal = Math.round((base + iva) * 100) / 100;
    this.recalculateEditVenta();
  }

  recalculateEditVenta(): void {
    const base = Number(this.editEntry.costoBase) || 0;
    const factor = Number(this.editEntry.ventaFactor) || 0.5;
    if (factor <= 0) {
      this.editEntry.precioVenta = 0;
      return;
    }
    this.editEntry.precioVenta = Math.round((base / factor) * 100) / 100;
  }

  private hydrateEditEntry(entry: InventoryEntryItem) {
    const ivaTipo = (entry.iva_tipo as any) || 'gravado';
    const storedBase = Number(entry.costo_base) || 0;
    const storedTotal = Number(entry.costo_total) || 0;
    const legacyTotal = Number(entry.costo) || 0;
    const ventaFactor = Number(entry.venta_factor) || 0.5;
    const storedPrecio = Number(entry.precio_venta) || 0;
    let base = storedBase;
    let total = storedTotal || legacyTotal;
    if (!base) {
      if (ivaTipo === 'gravado' && total > 0) {
        base = Math.round((total / 1.19) * 100) / 100;
      } else {
        base = total;
      }
    }
    const rate = ivaTipo === 'gravado' ? 0.19 : 0;
    const iva = Math.round(base * rate * 100) / 100;
    total = Math.round((base + iva) * 100) / 100;
    const precioVenta = storedPrecio || (ventaFactor ? Math.round((base / ventaFactor) * 100) / 100 : 0);
    return {
      costo: legacyTotal,
      ivaTipo,
      costoBase: base,
      ivaValor: iva,
      costoTotal: total,
      ventaFactor,
      precioVenta,
      fechaVencimiento: this.toDateString(entry.fecha_vencimiento),
      lote: entry.lote || '',
      invima: entry.invima || '',
      cantidad: Number(entry.cantidad) || 0
    };
  }

  get entriesByProduct(): Record<string, InventoryEntryItem[]> {
    const map: Record<string, InventoryEntryItem[]> = {};
    for (const entry of this.entries) {
      const key = entry.product_id;
      if (!map[key]) map[key] = [];
      map[key].push(entry);
    }
    return map;
  }

  get inventoryTotals(): { base: number; iva: number; total: number } {
    let base = 0;
    let iva = 0;
    let total = 0;
    for (const entry of this.entries) {
      const qty = Number(entry.cantidad) || 0;
      const { base: b, iva: i, total: t } = this.computeEntryTotals(entry);
      base += b * qty;
      iva += i * qty;
      total += t * qty;
    }
    return {
      base: Math.round(base * 100) / 100,
      iva: Math.round(iva * 100) / 100,
      total: Math.round(total * 100) / 100
    };
  }

  private computeEntryTotals(entry: InventoryEntryItem): { base: number; iva: number; total: number } {
    const ivaTipo = (entry.iva_tipo as any) || 'gravado';
    const storedBase = Number(entry.costo_base) || 0;
    const storedTotal = Number(entry.costo_total) || 0;
    const legacyTotal = Number(entry.costo) || 0;
    let base = storedBase;
    let total = storedTotal || legacyTotal;
    if (!base) {
      if (ivaTipo === 'gravado' && total > 0) {
        base = Math.round((total / 1.19) * 100) / 100;
      } else {
        base = total;
      }
    }
    const rate = ivaTipo === 'gravado' ? 0.19 : 0;
    const iva = Math.round(base * rate * 100) / 100;
    total = Math.round((base + iva) * 100) / 100;
    return { base, iva, total };
  }

  get filteredEntries(): InventoryEntryItem[] {
    const term = this.normalize(this.searchTerm);
    if (!term) return this.entries;
    return this.entries.filter((item) => {
      const haystack = [
        item.code,
        item.articulo,
        item.presentacion,
        item.marca,
        item.lote,
        item.invima
      ]
        .map((value) => this.normalize(value))
        .join(' ');
      return haystack.includes(term);
    });
  }

  toggleEntries(productId: string): void {
    this.expandedProductId = this.expandedProductId === productId ? null : productId;
  }

  goCreateProduct(): void {
    void this.router.navigate(['/inventario/producto']);
  }

  goCreateEntry(): void {
    void this.router.navigate(['/inventario/ingreso']);
  }
}
