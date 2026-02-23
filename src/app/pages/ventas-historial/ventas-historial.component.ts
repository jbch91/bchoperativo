import { ChangeDetectorRef, Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ClientContextService } from '../../shared/client-context.service';
import { SaleDto, SaleLineDto, VentasService } from '../ventas/ventas.service';
import { InventoryEntryItem, InventoryProductsService } from '../inventario/inventory-products.service';
import { AuthService } from '../../auth/auth.service';

interface SaleLineView extends SaleLineDto {
  ivaRate: number;
  maxQty: number;
}

@Component({
  selector: 'app-ventas-historial',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ventas-historial.component.html',
  styleUrl: './ventas-historial.component.scss'
})
export class VentasHistorialComponent implements OnInit {
  sales: SaleDto[] = [];
  lines: SaleLineDto[] = [];
  loading = false;
  errorMessage = '';
  selectedSaleId = '';
  searchTerm = '';
  startDate = '';
  endDate = '';

  showPreview = false;
  showEdit = false;
  previewSale: SaleDto | null = null;
  previewLines: SaleLineView[] = [];
  buyerName = '';
  buyerDocument = '';
  buyerAddress = '';
  consumptionArea = '';
  consumptionNote = '';
  saving = false;
  warningMessage = '';

  constructor(
    public readonly clientContext: ClientContextService,
    public readonly auth: AuthService,
    private readonly ventas: VentasService,
    private readonly inventory: InventoryProductsService,
    private readonly cdr: ChangeDetectorRef
  ) {
    void this.clientContext.init();
    void this.loadSales();
    effect(() => {
      const clientId = this.clientContext.selectedClientId();
      if (clientId) {
        void this.loadSales();
      }
    });
  }

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    const saleId = params.get('saleId');
    if (saleId) {
      this.selectedSaleId = saleId;
      const sale = this.sales.find((s) => s.id === saleId);
      if (sale) {
        void this.openPreview(sale);
      } else {
        void this.loadSales().then(() => {
          const target = this.sales.find((s) => s.id === saleId);
          if (target) void this.openPreview(target);
        });
      }
    }
  }

  get canManage(): boolean {
    return this.auth.hasPermission('sales:edit') || this.auth.hasPermission('sales:manage');
  }

  get canDelete(): boolean {
    return this.auth.hasPermission('sales:delete') || this.auth.hasPermission('sales:manage');
  }

  get filteredSales(): SaleDto[] {
    const term = this.searchTerm.toLowerCase().trim();
    const start = this.startDate ? new Date(this.startDate) : null;
    const end = this.endDate ? new Date(this.endDate) : null;
    if (start) {
      start.setHours(0, 0, 0, 0);
    }
    if (end) {
      end.setHours(23, 59, 59, 999);
    }
    return this.sales.filter((sale) => {
      const created = new Date(sale.created_at);
      if (start && created < start) return false;
      if (end && created > end) return false;
      if (!term) return true;
      const haystack = [
        sale.id,
        sale.buyer_name,
        sale.buyer_document,
        sale.buyer_address
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }

  get totalFiltered(): number {
    return this.filteredSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.startDate = '';
    this.endDate = '';
  }

  exportExcel(): void {
    const rows = this.filteredSales.map((sale) => [
      new Date(sale.created_at).toLocaleDateString('en-US'),
      sale.buyer_name || '',
      sale.buyer_document || '',
      sale.buyer_address || '',
      Number(sale.total_base || 0).toFixed(2),
      Number(sale.total_iva || 0).toFixed(2),
      Number(sale.total || 0).toFixed(2)
    ]);

    const header = ['Fecha', 'Comprador', 'Documento', 'Dirección', 'Total base', 'Total IVA', 'Total'];
    const totalRow = ['', '', '', 'SUMA FILTRO', '', '', this.totalFiltered.toFixed(2)];

    const tableRows = [header, ...rows, totalRow]
      .map(
        (cols) =>
          `<tr>${cols.map((col) => `<td>${String(col).replace(/</g, '&lt;')}</td>`).join('')}</tr>`
      )
      .join('');

    const html = `
      <html>
        <head><meta charset="UTF-8"></head>
        <body>
          <table>${tableRows}</table>
        </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ventas_${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async loadSales(): Promise<void> {
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    this.loading = true;
    this.errorMessage = '';
    try {
      this.sales = await this.ventas.listSales(clientId);
      if (this.selectedSaleId) {
        await this.loadLines(this.selectedSaleId);
      }
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo cargar el historial de ventas.';
      this.sales = [];
      this.lines = [];
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async loadLines(saleId: string): Promise<void> {
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    this.selectedSaleId = saleId;
    try {
      this.lines = await this.ventas.listSaleLines(clientId, saleId);
    } catch (error) {
      console.error(error);
      this.lines = [];
    } finally {
      this.cdr.detectChanges();
    }
  }

  async openPreview(sale: SaleDto): Promise<void> {
    this.previewSale = sale;
    this.showEdit = false;
    this.showPreview = true;
    this.warningMessage = '';
    await this.loadPreviewLines(sale, false);
  }

  async openPdf(sale: SaleDto): Promise<void> {
    this.previewSale = sale;
    this.warningMessage = '';
    await this.loadPreviewLines(sale, false);
    this.printInvoice();
  }

  async openEdit(sale: SaleDto): Promise<void> {
    if (!this.canManage) return;
    this.previewSale = sale;
    this.showEdit = true;
    this.showPreview = true;
    this.warningMessage = '';
    this.buyerName = sale.buyer_name ?? '';
    this.buyerDocument = sale.buyer_document ?? '';
    this.buyerAddress = sale.buyer_address ?? '';
    this.consumptionArea = sale.consumption_area ?? '';
    this.consumptionNote = sale.consumption_note ?? '';
    await this.loadPreviewLines(sale, true);
  }

  private async loadPreviewLines(sale: SaleDto, withInventory: boolean): Promise<void> {
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    const lines = await this.ventas.listSaleLines(clientId, sale.id);
    let entries: InventoryEntryItem[] = [];
    if (withInventory) {
      entries = await this.inventory.listEntries(clientId);
    }
    const entryMap = new Map(entries.map((entry) => [entry.id, Number(entry.cantidad) || 0]));
    this.previewLines = lines.map((line) => {
      const base = (Number(line.unitario) || 0) * (Number(line.cantidad) || 0);
      const rate = base > 0 ? (Number(line.iva) || 0) / base : 0;
      const available = entryMap.get(line.entry_id) ?? 0;
      return {
        ...line,
        ivaRate: rate,
        maxQty: withInventory ? available + (Number(line.cantidad) || 0) : Number(line.cantidad) || 0
      };
    });
    this.cdr.detectChanges();
  }

  updateLineQuantity(line: SaleLineView): void {
    const qty = Math.max(1, Number(line.cantidad) || 1);
    if (line.maxQty && qty > line.maxQty) {
      line.cantidad = line.maxQty;
      this.warningMessage = `Cantidad supera el disponible (${line.maxQty}).`;
    } else {
      line.cantidad = qty;
      this.warningMessage = '';
    }
    const base = line.cantidad * Number(line.unitario || 0);
    line.iva = Math.round(base * (line.ivaRate || 0) * 100) / 100;
    line.total = Math.round((base + (Number(line.iva) || 0)) * 100) / 100;
  }

  get totalBase(): number {
    return this.previewLines.reduce((sum, line) => sum + (Number(line.unitario) || 0) * (Number(line.cantidad) || 0), 0);
  }

  get totalIva(): number {
    return this.previewLines.reduce((sum, line) => sum + (Number(line.iva) || 0), 0);
  }

  get totalGeneral(): number {
    return this.totalBase + this.totalIva;
  }

  get previewSaleType(): string {
    return this.previewSale?.sale_type ?? 'producto';
  }

  get previewIsService(): boolean {
    return this.previewSaleType === 'servicio';
  }

  get previewIsDonation(): boolean {
    return this.previewSaleType === 'donacion';
  }

  get previewIsConsumption(): boolean {
    return this.previewSaleType === 'consumo';
  }

  get hasBlockingWarnings(): boolean {
    return this.previewLines.some((line) => line.maxQty <= 0 || line.cantidad > line.maxQty);
  }

  closeModal(): void {
    this.showPreview = false;
    this.showEdit = false;
    this.previewSale = null;
    this.previewLines = [];
    this.warningMessage = '';
  }

  async saveEdit(): Promise<void> {
    if (!this.previewSale || !this.canManage) return;
    if (this.hasBlockingWarnings) return;
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    this.saving = true;
    try {
      await this.ventas.updateSale(clientId, this.previewSale.id, {
        totalBase: this.totalBase,
        totalIva: this.totalIva,
        total: this.totalGeneral,
        buyerName: this.buyerName.trim(),
        buyerDocument: this.buyerDocument.trim(),
        buyerAddress: this.buyerAddress.trim(),
        consumptionArea: this.consumptionArea.trim(),
        consumptionNote: this.consumptionNote.trim(),
        saleType: this.previewSale.sale_type ?? 'producto',
        serviceType: this.previewSale.service_type ?? '',
        paymentMethod: this.previewSale.payment_method ?? 'efectivo',
        lines: this.previewLines.map((line) => ({
          entryId: line.entry_id,
          code: line.code,
          name: line.name,
          lote: line.lote,
          vencimiento: line.vencimiento,
          cantidad: line.cantidad,
          unitario: line.unitario,
          iva: line.iva,
          total: line.total
        }))
      });
      await this.loadSales();
      this.closeModal();
    } catch (error) {
      console.error(error);
      this.warningMessage = 'No se pudo actualizar la venta.';
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  async deleteSale(sale: SaleDto): Promise<void> {
    if (!this.canManage) return;
    if (!confirm('¿Eliminar esta venta? Se devolverá el stock.')) return;
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    try {
      await this.ventas.deleteSale(clientId, sale.id);
      await this.loadSales();
      this.closeModal();
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo eliminar la venta.';
    }
  }

  printInvoice(): void {
    if (!this.previewSale || this.previewLines.length === 0) return;
    const sale = this.previewSale;
    const client = this.clientContext.selectedClientInfo;
    const rows = this.previewLines
      .map(
        (line) => `
        <tr>
          <td>${line.code}</td>
          <td>${line.name}</td>
          <td>${line.lote}</td>
          <td>${new Date(line.vencimiento).toLocaleDateString('en-US')}</td>
          <td>${line.cantidad}</td>
          <td>${Number(line.unitario).toFixed(2)}</td>
          <td>${Number(line.iva).toFixed(2)}</td>
          <td>${Number(line.total).toFixed(2)}</td>
        </tr>`
      )
      .join('');

    const html = `
      <html>
        <head>
          <title>Factura ${sale.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { margin: 0 0 8px; }
            .meta { margin-bottom: 16px; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
            .totals { margin-top: 16px; display: grid; gap: 6px; font-size: 13px; }
          </style>
        </head>
        <body>
          <h1>Factura de venta</h1>
          <div class="meta">
            <div><strong>Venta:</strong> ${sale.id}</div>
            <div><strong>Fecha:</strong> ${new Date(sale.created_at).toLocaleString('en-US')}</div>
            <div><strong>Cliente:</strong> ${client?.name ?? 'N/A'}</div>
            <div><strong>NIT:</strong> ${client?.nit ?? 'N/A'}</div>
            ${sale.buyer_name ? `<div><strong>Comprador:</strong> ${sale.buyer_name}</div>` : ''}
            ${sale.buyer_document ? `<div><strong>Documento:</strong> ${sale.buyer_document}</div>` : ''}
            ${sale.buyer_address ? `<div><strong>Dirección:</strong> ${sale.buyer_address}</div>` : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Lote</th>
                <th>Vencimiento</th>
                <th>Cantidad</th>
                <th>Valor unitario</th>
                <th>IVA</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <div class="totals">
            <div><strong>Total base:</strong> ${this.totalBase.toFixed(2)}</div>
            <div><strong>Total IVA:</strong> ${this.totalIva.toFixed(2)}</div>
            <div><strong>Total:</strong> ${this.totalGeneral.toFixed(2)}</div>
          </div>
        </body>
      </html>
    `;

    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) return;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
    setTimeout(() => popup.close(), 300);
  }
}
