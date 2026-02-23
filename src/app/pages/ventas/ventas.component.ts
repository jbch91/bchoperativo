import { ChangeDetectorRef, Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ClientContextService } from '../../shared/client-context.service';
import { InventoryEntryItem, InventoryProductsService } from '../inventario/inventory-products.service';
import { VentasService } from './ventas.service';
import { AuthService } from '../../auth/auth.service';

interface SaleLine {
  entryId: string | null;
  code: string;
  name: string;
  lote: string;
  vencimiento: string;
  cantidad: number;
  unitario: number;
  ivaRate: number;
  iva: number;
  total: number;
  maxQty: number;
  type: 'producto' | 'servicio' | 'donacion' | 'consumo';
}

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ventas.component.html',
  styleUrl: './ventas.component.scss'
})
export class VentasComponent {
  entries: InventoryEntryItem[] = [];
  loading = false;
  errorMessage = '';

  searchTerm = '';
  selectedEntryId = '';
  cantidad = 1;
  saleType: 'producto' | 'servicio' | 'donacion' | 'consumo' = 'producto';
  serviceType: 'calibraciones' | 'mantenimientos' = 'calibraciones';
  serviceIvaRate = 0.19;
  serviceDescription = '';
  paymentMethod: 'efectivo' | 'transferencia' | 'otro' = 'efectivo';
  warningMessage = '';
  selling = false;
  successMessage = '';
  buyerName = '';
  buyerDocument = '';
  buyerAddress = '';
  consumptionArea = '';
  consumptionNote = '';
  showInvoicePreview = false;
  previewDate = new Date();

  lines: SaleLine[] = [];

  constructor(
    public readonly clientContext: ClientContextService,
    public readonly auth: AuthService,
    private readonly inventory: InventoryProductsService,
    private readonly ventas: VentasService,
    private readonly cdr: ChangeDetectorRef
  ) {
    void this.clientContext.init();
    void this.loadEntries();
    effect(() => {
      const clientId = this.clientContext.selectedClientId();
      if (clientId) {
        void this.loadEntries();
      }
    });
  }

  async loadEntries(): Promise<void> {
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    this.loading = true;
    this.errorMessage = '';
    try {
      this.entries = await this.inventory.listEntries(clientId);
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudieron cargar los productos.';
      this.entries = [];
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  get filteredEntries(): InventoryEntryItem[] {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) return this.entries;
    return this.entries.filter((item) =>
      `${item.code} ${item.articulo} ${item.lote} ${item.invima}`.toLowerCase().includes(term)
    );
  }

  addLine(): void {
    if (this.saleType === 'servicio') {
      const qty = Math.max(1, Number(this.cantidad) || 1);
      const unitario = 0;
      const ivaRate = this.serviceIvaRate;
      const base = qty * unitario;
      const iva = Math.round(base * ivaRate * 100) / 100;
      const total = Math.round((base + iva) * 100) / 100;
      this.lines.push({
        entryId: null,
        code: 'SERV',
        name: this.serviceType === 'calibraciones' ? 'Calibraciones' : 'Mantenimientos',
        lote: '-',
        vencimiento: new Date().toISOString(),
        cantidad: qty,
        unitario,
        ivaRate,
        iva,
        total,
        maxQty: 0,
        type: 'servicio'
      });
      if (this.serviceDescription.trim()) {
        this.lines[this.lines.length - 1].lote = this.serviceDescription.trim();
      }
      this.cantidad = 1;
      this.serviceDescription = '';
      return;
    }

    const entry = this.entries.find((e) => e.id === this.selectedEntryId);
    if (!entry) return;
    this.warningMessage = '';
    if (this.lines.some((line) => line.entryId === entry.id)) {
      this.warningMessage = 'Este ingreso ya fue agregado.';
      return;
    }
    const maxQty = Number(entry.cantidad) || 0;
    const qty = Math.max(1, Number(this.cantidad) || 1);
    if (maxQty <= 0) {
      this.warningMessage = 'No hay unidades disponibles.';
      return;
    }
    if (maxQty && qty > maxQty) {
      this.warningMessage = `Cantidad supera el disponible (${maxQty}).`;
      return;
    }
    const unitario = Number(entry.precio_venta ?? entry.costo_total ?? entry.costo) || 0;
    const base = qty * unitario;
    const ivaRate = entry.iva_tipo === 'gravado' ? 0.19 : 0;
    const iva = Math.round(base * ivaRate * 100) / 100;
    const total = Math.round((base + iva) * 100) / 100;

    const isDonation = this.saleType === 'donacion' || this.saleType === 'consumo';

    this.lines.push({
      entryId: entry.id,
      code: entry.code,
      name: entry.articulo,
      lote: entry.lote,
      vencimiento: entry.fecha_vencimiento,
      cantidad: qty,
      unitario: isDonation ? 0 : unitario,
      ivaRate,
      iva: isDonation ? 0 : iva,
      total: isDonation ? 0 : total,
      maxQty,
      type: this.saleType === 'consumo' ? 'consumo' : (isDonation ? 'donacion' : 'producto')
    });
    this.selectedEntryId = '';
    this.cantidad = 1;
  }

  get selectedEntry(): InventoryEntryItem | null {
    return this.entries.find((e) => e.id === this.selectedEntryId) ?? null;
  }

  removeLine(index: number): void {
    this.lines.splice(index, 1);
  }

  get totalBase(): number {
    return this.lines.reduce((sum, line) => sum + line.cantidad * line.unitario, 0);
  }

  get totalIva(): number {
    return this.lines.reduce((sum, line) => sum + line.iva, 0);
  }

  get totalGeneral(): number {
    return this.totalBase + this.totalIva;
  }

  updateLineTotal(line: SaleLine): void {
    if (line.type === 'donacion') {
      line.unitario = 0;
      line.iva = 0;
      line.total = 0;
      return;
    }
    const qty = Math.max(1, Number(line.cantidad) || 1);
    const total = Math.max(0, Number(line.total) || 0);
    const base = total / (1 + (line.ivaRate || 0));
    line.unitario = Math.round((base / qty) * 100) / 100;
    const iva = total - base;
    line.iva = Math.round(iva * 100) / 100;
    line.total = Math.round(total * 100) / 100;
  }

  updateLineUnitario(line: SaleLine): void {
    if (line.type === 'donacion') {
      line.unitario = 0;
      line.iva = 0;
      line.total = 0;
      return;
    }
    const qty = Math.max(1, Number(line.cantidad) || 1);
    const unitario = Math.max(0, Number(line.unitario) || 0);
    const base = qty * unitario;
    const iva = Math.round(base * (line.ivaRate || 0) * 100) / 100;
    line.iva = iva;
    line.total = Math.round((base + iva) * 100) / 100;
    line.unitario = Math.round(unitario * 100) / 100;
  }

  openInvoicePreview(): void {
    if (this.lines.length === 0) return;
    this.warningMessage = '';
    this.previewDate = new Date();
    this.showInvoicePreview = true;
  }

  updateLineQuantity(line: SaleLine): void {
    const qty = Math.max(1, Number(line.cantidad) || 1);
    if (line.type !== 'servicio' && line.maxQty && qty > line.maxQty) {
      line.cantidad = line.maxQty;
      this.warningMessage = `Cantidad supera el disponible (${line.maxQty}).`;
    } else {
      line.cantidad = qty;
    }
    if (line.type === 'donacion') {
      line.unitario = 0;
      line.iva = 0;
      line.total = 0;
      return;
    }
    const base = line.cantidad * line.unitario;
    const iva = Math.round(base * (line.ivaRate || 0) * 100) / 100;
    line.iva = iva;
    line.total = Math.round((base + iva) * 100) / 100;
  }

  isQuantityValid(line: SaleLine): boolean {
    return line.maxQty > 0 && line.cantidad <= line.maxQty;
  }

  get previewWarnings(): string[] {
    const warnings: string[] = [];
    for (const line of this.lines) {
      if (line.type === 'servicio') continue;
      if (line.maxQty <= 0) {
        warnings.push(`Sin stock: ${line.code} - ${line.name}`);
      } else if (line.cantidad > line.maxQty) {
        warnings.push(`Cantidad supera disponible (${line.maxQty}) en ${line.code} - ${line.name}`);
      } else if (line.cantidad === line.maxQty) {
        warnings.push(`Este ingreso se agota: ${line.code} - ${line.name}`);
      }
    }
    return warnings;
  }

  get hasBlockingWarnings(): boolean {
    return this.lines.some((line) => line.type !== 'servicio' && (line.maxQty <= 0 || line.cantidad > line.maxQty));
  }

  get actionLabel(): string {
    if (this.saleType === 'donacion') return 'Donar';
    if (this.saleType === 'consumo') return 'Registrar consumo';
    return 'Vender';
  }

  get productLines(): SaleLine[] {
    return this.lines.filter((line) => line.type === 'producto');
  }

  get donationLines(): SaleLine[] {
    return this.lines.filter((line) => line.type === 'donacion');
  }

  get consumptionLines(): SaleLine[] {
    return this.lines.filter((line) => line.type === 'consumo');
  }

  get serviceLines(): SaleLine[] {
    return this.lines.filter((line) => line.type === 'servicio');
  }

  async confirmSale(printAfter: boolean): Promise<void> {
    if (this.selling || this.lines.length === 0) return;
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    this.selling = true;
    this.successMessage = '';
    try {
      const now = new Date();
      const client = this.clientContext.selectedClientInfo;
      const sale = await this.ventas.createSale(clientId, {
        totalBase: this.totalBase,
        totalIva: this.totalIva,
        total: this.totalGeneral,
        buyerName: this.buyerName.trim(),
        buyerDocument: this.buyerDocument.trim(),
        buyerAddress: this.buyerAddress.trim(),
        consumptionArea: this.consumptionArea.trim(),
        consumptionNote: this.consumptionNote.trim(),
        saleType: this.saleType,
        serviceType: this.saleType === 'servicio' ? this.serviceType : '',
        paymentMethod: (this.saleType === 'producto' || this.saleType === 'servicio') ? this.paymentMethod : '',
        lines: this.lines.map((line) => ({
          entryId: line.entryId,
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
      this.successMessage = 'Venta registrada.';
      this.warningMessage = '';
      const invoiceSnapshot = {
        saleId: sale.id,
        createdAt: now,
        clientName: client?.name ?? 'N/A',
        clientNit: client?.nit ?? 'N/A',
        buyerName: this.buyerName.trim(),
        buyerDocument: this.buyerDocument.trim(),
        buyerAddress: this.buyerAddress.trim(),
        consumptionArea: this.consumptionArea.trim(),
        consumptionNote: this.consumptionNote.trim(),
        lines: this.lines.map((line) => ({ ...line })),
        totalBase: this.totalBase,
        totalIva: this.totalIva,
        total: this.totalGeneral
      };
      this.showInvoicePreview = false;
      if (printAfter) {
        this.printInvoice(invoiceSnapshot);
      }
      this.lines = [];
      this.selectedEntryId = '';
      this.cantidad = 1;
      this.buyerName = '';
      this.buyerDocument = '';
      this.buyerAddress = '';
      this.consumptionArea = '';
      this.consumptionNote = '';
      this.paymentMethod = 'efectivo';
      await this.loadEntries();
    } catch (error) {
      console.error(error);
      this.warningMessage = 'No se pudo registrar la venta.';
    } finally {
      this.selling = false;
      this.showInvoicePreview = false;
      this.cdr.detectChanges();
    }
  }

  printInvoice(preview: {
    saleId: string;
    createdAt: Date;
    clientName: string;
    clientNit: string;
    buyerName: string;
    buyerDocument: string;
    buyerAddress: string;
    consumptionArea?: string;
    consumptionNote?: string;
    lines: SaleLine[];
    totalBase: number;
    totalIva: number;
    total: number;
  }): void {
    const rows = preview.lines
      .map(
        (line) => `
        <tr>
          <td>${line.code}</td>
          <td>${line.name}</td>
          <td>${line.lote}</td>
          <td>${new Date(line.vencimiento).toLocaleDateString('en-US')}</td>
          <td>${line.cantidad}</td>
          <td>${line.unitario.toFixed(2)}</td>
          <td>${line.iva.toFixed(2)}</td>
          <td>${line.total.toFixed(2)}</td>
        </tr>`
      )
      .join('');

    const html = `
      <html>
        <head>
          <title>Factura ${preview.saleId}</title>
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
            <div><strong>Venta:</strong> ${preview.saleId}</div>
            <div><strong>Fecha:</strong> ${preview.createdAt.toLocaleString('en-US')}</div>
            <div><strong>Cliente:</strong> ${preview.clientName}</div>
            <div><strong>NIT:</strong> ${preview.clientNit}</div>
            ${preview.buyerName ? `<div><strong>Comprador:</strong> ${preview.buyerName}</div>` : ''}
            ${preview.buyerDocument ? `<div><strong>Documento:</strong> ${preview.buyerDocument}</div>` : ''}
            ${preview.buyerAddress ? `<div><strong>Dirección:</strong> ${preview.buyerAddress}</div>` : ''}
            ${preview.consumptionArea ? `<div><strong>Area consumo:</strong> ${preview.consumptionArea}</div>` : ''}
            ${preview.consumptionNote ? `<div><strong>Observacion:</strong> ${preview.consumptionNote}</div>` : ''}
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
            <div><strong>Total base:</strong> ${preview.totalBase.toFixed(2)}</div>
            <div><strong>Total IVA:</strong> ${preview.totalIva.toFixed(2)}</div>
            <div><strong>Total:</strong> ${preview.total.toFixed(2)}</div>
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

  closeInvoicePreview(): void {
    this.showInvoicePreview = false;
  }
}
