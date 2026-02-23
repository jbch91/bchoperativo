import { ChangeDetectorRef, Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ClientContextService } from '../../shared/client-context.service';
import { InventoryEntryItem, InventoryProductsService } from '../inventario/inventory-products.service';
import { RemisionClient, RemisionLine, RemisionesService } from './remisiones.service';
import { AuthService } from '../../auth/auth.service';

interface RemisionDraftLine {
  entryId: string;
  code: string;
  name: string;
  lote: string;
  vencimiento: string;
  cantidad: number;
  maxQty: number;
}

@Component({
  selector: 'app-remisiones',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './remisiones.component.html',
  styleUrl: './remisiones.component.scss'
})
export class RemisionesComponent {
  entries: InventoryEntryItem[] = [];
  clients: RemisionClient[] = [];
  loading = false;
  errorMessage = '';

  remisionNumber = '';
  recipient = '';
  destination = '';
  notes = '';
  remisionClientId = '';

  searchTerm = '';
  selectedEntryId = '';
  cantidad = 1;

  lines: RemisionDraftLine[] = [];
  warningMessage = '';
  saving = false;
  showPreview = false;
  previewDate = new Date();

  constructor(
    public readonly clientContext: ClientContextService,
    public readonly auth: AuthService,
    private readonly inventory: InventoryProductsService,
    private readonly remisiones: RemisionesService,
    private readonly cdr: ChangeDetectorRef
  ) {
    void this.clientContext.init();
    void this.loadData();
    effect(() => {
      const clientId = this.clientContext.selectedClientId();
      if (clientId) {
        void this.loadData();
      }
    });
  }

  async loadData(): Promise<void> {
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    this.loading = true;
    try {
      const [entries, clients] = await Promise.all([
        this.inventory.listEntries(clientId),
        this.remisiones.listClients(clientId)
      ]);
      this.entries = entries;
      this.clients = clients;
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo cargar la información.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  get filteredEntries(): InventoryEntryItem[] {
    const term = this.searchTerm.toLowerCase().trim();
    const filtered = this.entries.filter((item) => (Number(item.cantidad) || 0) > 0);
    if (!term) return filtered;
    return filtered.filter((item) =>
      `${item.code} ${item.articulo} ${item.lote} ${item.invima}`.toLowerCase().includes(term)
    );
  }

  get selectedEntry(): InventoryEntryItem | null {
    return this.entries.find((e) => e.id === this.selectedEntryId) ?? null;
  }

  addLine(): void {
    const entry = this.entries.find((e) => e.id === this.selectedEntryId);
    if (!entry) return;
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
    if (qty > maxQty) {
      this.warningMessage = `Cantidad supera el disponible (${maxQty}).`;
      return;
    }
    this.lines.push({
      entryId: entry.id,
      code: entry.code,
      name: entry.articulo,
      lote: entry.lote,
      vencimiento: entry.fecha_vencimiento,
      cantidad: qty,
      maxQty
    });
    this.selectedEntryId = '';
    this.cantidad = 1;
    this.warningMessage = '';
  }

  updateQuantity(line: RemisionDraftLine): void {
    const qty = Math.max(1, Number(line.cantidad) || 1);
    if (qty > line.maxQty) {
      line.cantidad = line.maxQty;
      this.warningMessage = `Cantidad supera el disponible (${line.maxQty}).`;
    } else {
      line.cantidad = qty;
    }
  }

  removeLine(index: number): void {
    this.lines.splice(index, 1);
  }

  openPreview(): void {
    if (!this.remisionNumber.trim()) {
      this.warningMessage = 'Debes ingresar el número de remisión.';
      return;
    }
    if (this.lines.length === 0) {
      this.warningMessage = 'Agrega al menos un producto.';
      return;
    }
    this.warningMessage = '';
    this.previewDate = new Date();
    this.showPreview = true;
  }

  get selectedClientName(): string {
    return this.clients.find((c) => c.id === this.remisionClientId)?.name ?? '—';
  }

  async confirmSave(printAfter: boolean): Promise<void> {
    if (this.lines.length === 0 || !this.remisionNumber.trim()) return;
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    this.saving = true;
    try {
      const remision = await this.remisiones.createRemision(clientId, {
        remisionNumber: this.remisionNumber.trim(),
        remisionClientId: this.remisionClientId || null,
        recipient: this.recipient.trim(),
        destination: this.destination.trim(),
        notes: this.notes.trim(),
        lines: this.lines.map((line) => ({
          entryId: line.entryId,
          code: line.code,
          name: line.name,
          lote: line.lote,
          vencimiento: line.vencimiento,
          cantidad: line.cantidad
        }))
      });
      if (printAfter) {
        this.printRemision({
          remisionId: remision.id,
          createdAt: new Date(),
          remisionNumber: this.remisionNumber.trim(),
          clientName: this.selectedClientName,
          recipient: this.recipient.trim(),
          destination: this.destination.trim(),
          notes: this.notes.trim(),
          lines: this.lines.map((line) => ({ ...line }))
        });
      }
      this.remisionNumber = '';
      this.recipient = '';
      this.destination = '';
      this.notes = '';
      this.remisionClientId = '';
      this.lines = [];
      this.showPreview = false;
      await this.loadData();
    } catch (error) {
      console.error(error);
      this.warningMessage = 'No se pudo guardar la remisión.';
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  printRemision(preview: {
    remisionId: string;
    createdAt: Date;
    remisionNumber: string;
    clientName: string;
    recipient: string;
    destination: string;
    notes: string;
    lines: RemisionDraftLine[];
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
        </tr>`
      )
      .join('');

    const html = `
      <html>
        <head>
          <title>Remisión ${preview.remisionNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { margin: 0 0 8px; }
            .meta { margin-bottom: 16px; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Remisión</h1>
          <div class="meta">
            <div><strong>Remisión:</strong> ${preview.remisionNumber}</div>
            <div><strong>Fecha:</strong> ${preview.createdAt.toLocaleString('en-US')}</div>
            <div><strong>Cliente:</strong> ${preview.clientName}</div>
            ${preview.recipient ? `<div><strong>Dirigido a:</strong> ${preview.recipient}</div>` : ''}
            ${preview.destination ? `<div><strong>Destino:</strong> ${preview.destination}</div>` : ''}
            ${preview.notes ? `<div><strong>Notas:</strong> ${preview.notes}</div>` : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Lote</th>
                <th>Vencimiento</th>
                <th>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
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

  closePreview(): void {
    this.showPreview = false;
  }
}
