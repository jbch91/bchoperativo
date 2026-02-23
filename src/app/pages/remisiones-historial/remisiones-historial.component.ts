import { ChangeDetectorRef, Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ClientContextService } from '../../shared/client-context.service';
import { InventoryEntryItem, InventoryProductsService } from '../inventario/inventory-products.service';
import { RemisionClient, RemisionItem, RemisionLine, RemisionesService } from '../remisiones/remisiones.service';
import { AuthService } from '../../auth/auth.service';

interface RemisionLineView extends RemisionLine {
  maxQty: number;
}

@Component({
  selector: 'app-remisiones-historial',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './remisiones-historial.component.html',
  styleUrl: './remisiones-historial.component.scss'
})
export class RemisionesHistorialComponent {
  remisiones: RemisionItem[] = [];
  clients: RemisionClient[] = [];
  loading = false;
  errorMessage = '';
  searchTerm = '';
  startDate = '';
  endDate = '';
  clientFilter = '';

  showPreview = false;
  showEdit = false;
  previewRemision: RemisionItem | null = null;
  previewLines: RemisionLineView[] = [];

  remisionNumber = '';
  remisionClientId = '';
  recipient = '';
  destination = '';
  notes = '';

  warningMessage = '';
  saving = false;

  constructor(
    public readonly clientContext: ClientContextService,
    public readonly auth: AuthService,
    private readonly remisionesService: RemisionesService,
    private readonly inventory: InventoryProductsService,
    private readonly cdr: ChangeDetectorRef
  ) {
    void this.clientContext.init();
    void this.loadRemisiones();
    effect(() => {
      const clientId = this.clientContext.selectedClientId();
      if (clientId) {
        void this.loadRemisiones();
      }
    });
  }

  get canManage(): boolean {
    return this.auth.hasPermission('remisiones:edit') || this.auth.hasPermission('remisiones:manage');
  }

  get canDelete(): boolean {
    return this.auth.hasPermission('remisiones:delete') || this.auth.hasPermission('remisiones:manage');
  }

  get filteredRemisiones(): RemisionItem[] {
    const term = this.searchTerm.toLowerCase().trim();
    const start = this.startDate ? new Date(this.startDate) : null;
    const end = this.endDate ? new Date(this.endDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);
    return this.remisiones.filter((rem) => {
      const created = new Date(rem.created_at);
      if (start && created < start) return false;
      if (end && created > end) return false;
      if (this.clientFilter && rem.remision_client_id !== this.clientFilter) return false;
      if (!term) return true;
      const haystack = [
        rem.remision_number,
        rem.client_name,
        rem.recipient,
        rem.destination,
        rem.notes
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.startDate = '';
    this.endDate = '';
    this.clientFilter = '';
  }

  async loadRemisiones(): Promise<void> {
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    this.loading = true;
    this.errorMessage = '';
    try {
      const [remisiones, clients] = await Promise.all([
        this.remisionesService.listRemisiones(clientId),
        this.remisionesService.listClients(clientId)
      ]);
      this.remisiones = remisiones;
      this.clients = clients;
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo cargar el historial de remisiones.';
      this.remisiones = [];
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async openPreview(remision: RemisionItem): Promise<void> {
    this.previewRemision = remision;
    this.showEdit = false;
    this.showPreview = true;
    this.warningMessage = '';
    await this.loadPreviewLines(remision, false);
  }

  async openEdit(remision: RemisionItem): Promise<void> {
    if (!this.canManage) return;
    this.previewRemision = remision;
    this.showEdit = true;
    this.showPreview = true;
    this.warningMessage = '';
    this.remisionNumber = remision.remision_number;
    this.remisionClientId = remision.remision_client_id || '';
    this.recipient = remision.recipient || '';
    this.destination = remision.destination || '';
    this.notes = remision.notes || '';
    await this.loadPreviewLines(remision, true);
  }

  private async loadPreviewLines(remision: RemisionItem, withInventory: boolean): Promise<void> {
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    const lines = await this.remisionesService.listLines(clientId, remision.id);
    let entries: InventoryEntryItem[] = [];
    if (withInventory) {
      entries = await this.inventory.listEntries(clientId);
    }
    const entryMap = new Map(entries.map((entry) => [entry.id, Number(entry.cantidad) || 0]));
    this.previewLines = lines.map((line) => {
      const currentQty = Number(line.cantidad) || 0;
      const available = entryMap.get(line.entry_id) ?? 0;
      return {
        ...line,
        maxQty: withInventory ? available + currentQty : currentQty
      };
    });
    this.cdr.detectChanges();
  }

  updateLineQuantity(line: RemisionLineView): void {
    const qty = Math.max(1, Number(line.cantidad) || 1);
    if (qty > line.maxQty) {
      line.cantidad = line.maxQty;
      this.warningMessage = `Cantidad supera el disponible (${line.maxQty}).`;
    } else {
      line.cantidad = qty;
      this.warningMessage = '';
    }
  }

  async saveEdit(): Promise<void> {
    if (!this.previewRemision) return;
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    this.saving = true;
    this.warningMessage = '';
    try {
      await this.remisionesService.updateRemision(clientId, this.previewRemision.id, {
        remisionNumber: this.remisionNumber.trim(),
        remisionClientId: this.remisionClientId || null,
        recipient: this.recipient.trim(),
        destination: this.destination.trim(),
        notes: this.notes.trim(),
        lines: this.previewLines.map((line) => ({
          entryId: line.entry_id,
          code: line.code,
          name: line.name,
          lote: line.lote,
          vencimiento: line.vencimiento,
          cantidad: line.cantidad
        }))
      });
      await this.loadRemisiones();
      this.closeModal();
    } catch (error) {
      console.error(error);
      this.warningMessage = 'No se pudo actualizar la remisión.';
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  async deleteRemision(remision: RemisionItem): Promise<void> {
    if (!this.canManage) return;
    const ok = confirm('¿Eliminar esta remisión? Esto regresará el inventario.');
    if (!ok) return;
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    try {
      await this.remisionesService.deleteRemision(clientId, remision.id);
      await this.loadRemisiones();
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo eliminar la remisión.';
    }
  }

  closeModal(): void {
    this.showPreview = false;
    this.showEdit = false;
    this.previewRemision = null;
    this.previewLines = [];
    this.warningMessage = '';
  }
}
