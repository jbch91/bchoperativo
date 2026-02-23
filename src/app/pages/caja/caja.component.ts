import { ChangeDetectorRef, Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { ClientContextService } from '../../shared/client-context.service';
import { CajaService, CashSummary, CashTransaction } from './caja.service';

@Component({
  selector: 'app-caja',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './caja.component.html',
  styleUrl: './caja.component.scss'
})
export class CajaComponent {
  summary: CashSummary = { totalIn: 0, totalOut: 0, balance: 0 };
  transactions: CashTransaction[] = [];
  loading = false;
  errorMessage = '';

  searchTerm = '';
  typeFilter: 'all' | 'in' | 'out' = 'all';
  dateFrom = '';
  dateTo = '';

  currentPage = 1;
  pageSize = 10;

  openingAmount = 0;
  openingNote = '';

  movementType: 'out' | 'in' = 'out';
  movementCategory = 'Repuestos';
  movementAmount = 0;
  movementDescription = '';
  lowBalanceThreshold = 50000;
  reportMode: 'daily' | 'monthly' = 'daily';
  reportExportFormat: 'xls' | 'pdf' = 'xls';

  closingName = '';
  closingNote = '';

  editingId: string | null = null;
  editMovement = {
    type: 'out' as 'out' | 'in',
    category: '',
    amount: 0,
    description: ''
  };

  goToSale(item: CashTransaction): void {
    if (!item.sale_id) return;
    void this.router.navigate(['/ventas/historial'], { queryParams: { saleId: item.sale_id } });
  }

  activeSection: 'resumen' | 'movimientos' | 'reportes' | 'corte' = 'resumen';

  constructor(
    public readonly auth: AuthService,
    public readonly clientContext: ClientContextService,
    private readonly caja: CajaService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router
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

  get canManage(): boolean {
    return this.auth.hasPermission('cash:manage') || this.auth.hasPermission('read:all');
  }

  get canOpen(): boolean {
    return this.auth.hasRole(['superuser']);
  }

  get filteredTotals(): { in: number; out: number } {
    const totalIn = this.transactions
      .filter((t) => t.type === 'in')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalOut = this.transactions
      .filter((t) => t.type === 'out')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    return {
      in: Math.round(totalIn * 100) / 100,
      out: Math.round(totalOut * 100) / 100
    };
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.transactions.length / this.pageSize));
  }

  get pagedTransactions(): CashTransaction[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.transactions.slice(start, start + this.pageSize);
  }

  get isLowBalance(): boolean {
    return Number(this.summary.balance || 0) < Number(this.lowBalanceThreshold || 0);
  }

  get reportRows(): { period: string; totalIn: number; totalOut: number; balance: number }[] {
    const map = new Map<string, { totalIn: number; totalOut: number }>();
    for (const item of this.transactions) {
      const date = new Date(item.created_at);
      const period = this.reportMode === 'daily'
        ? date.toISOString().slice(0, 10)
        : `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!map.has(period)) {
        map.set(period, { totalIn: 0, totalOut: 0 });
      }
      const bucket = map.get(period)!;
      if (item.type === 'in') {
        bucket.totalIn += Number(item.amount || 0);
      } else {
        bucket.totalOut += Number(item.amount || 0);
      }
    }
    const rows = Array.from(map.entries())
      .map(([period, totals]) => ({
        period,
        totalIn: Math.round(totals.totalIn * 100) / 100,
        totalOut: Math.round(totals.totalOut * 100) / 100,
        balance: Math.round((totals.totalIn - totals.totalOut) * 100) / 100
      }))
      .sort((a, b) => (a.period < b.period ? 1 : -1));
    return rows;
  }

  exportReport(): void {
    const rows = this.reportRows.map((row) => [
      row.period,
      row.totalIn.toFixed(2),
      row.totalOut.toFixed(2),
      row.balance.toFixed(2)
    ]);
    const header = this.reportMode === 'daily'
      ? ['Fecha', 'Ingresos', 'Egresos', 'Saldo']
      : ['Mes', 'Ingresos', 'Egresos', 'Saldo'];

    if (this.reportExportFormat === 'pdf') {
      const html = `
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; }
              th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
              th { background: #f3f4f6; }
            </style>
          </head>
          <body>
            <h2>Reporte de caja (${this.reportMode === 'daily' ? 'Diario' : 'Mensual'})</h2>
            <table>
              <thead>
                <tr>${header.map((h) => `<th>${h}</th>`).join('')}</tr>
              </thead>
              <tbody>
                ${rows.map((cols) => `<tr>${cols.map((col) => `<td>${col}</td>`).join('')}</tr>`).join('')}
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
      return;
    }

    const tableRows = [header, ...rows]
      .map(
        (cols) =>
          `<tr>${cols.map((col) => `<td>${String(col).replace(/</g, '&lt;')}</td>`).join('')}</tr>`
      )
      .join('');
    const html = `
      <html>
        <head><meta charset="UTF-8"></head>
        <body><table>${tableRows}</table></body>
      </html>
    `;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `caja_${this.reportMode}_${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }

  closeShift(): void {
    const now = new Date();
    const html = `
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h2 { margin-bottom: 12px; }
            .meta { font-size: 12px; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h2>Corte de caja</h2>
          <div class="meta">
            <div><strong>Fecha:</strong> ${now.toLocaleString('en-US')}</div>
            <div><strong>Responsable:</strong> ${this.closingName || '—'}</div>
            <div><strong>Nota:</strong> ${this.closingNote || '—'}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Saldo actual</th>
                <th>Ingresos</th>
                <th>Egresos</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${this.summary.balance.toFixed(2)}</td>
                <td>${this.summary.totalIn.toFixed(2)}</td>
                <td>${this.summary.totalOut.toFixed(2)}</td>
              </tr>
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

  async loadData(): Promise<void> {
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    this.loading = true;
    this.errorMessage = '';
    try {
      const [summary, transactions] = await Promise.all([
        this.caja.getSummary(clientId),
        this.caja.listTransactions(clientId, {
          type: this.typeFilter,
          search: this.searchTerm,
          dateFrom: this.dateFrom,
          dateTo: this.dateTo
        })
      ]);
      this.summary = summary;
      this.transactions = transactions;
      this.currentPage = 1;
    } catch (error) {
      console.error(error);
      this.errorMessage = 'No se pudo cargar la caja.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  changePage(next: number): void {
    if (next < 1 || next > this.totalPages) return;
    this.currentPage = next;
  }

  async applyFilters(): Promise<void> {
    await this.loadData();
  }

  async clearFilters(): Promise<void> {
    this.searchTerm = '';
    this.typeFilter = 'all';
    this.dateFrom = '';
    this.dateTo = '';
    await this.loadData();
  }

  async createOpening(): Promise<void> {
    if (!this.canOpen) return;
    const clientId = this.clientContext.selectedClientId();
    if (!clientId || this.openingAmount <= 0) return;
    await this.caja.createTransaction(clientId, {
      type: 'in',
      category: 'Saldo inicial',
      amount: this.openingAmount,
      description: this.openingNote,
      source: 'opening'
    });
    this.openingAmount = 0;
    this.openingNote = '';
    await this.loadData();
  }

  async createMovement(): Promise<void> {
    const clientId = this.clientContext.selectedClientId();
    if (!clientId) return;
    if (!this.movementCategory || this.movementAmount <= 0) return;
    await this.caja.createTransaction(clientId, {
      type: this.movementType,
      category: this.movementCategory,
      amount: this.movementAmount,
      description: this.movementDescription
    });
    this.movementAmount = 0;
    this.movementDescription = '';
    await this.loadData();
  }

  startEdit(item: CashTransaction): void {
    if (item.source === 'sale') return;
    if (item.source === 'opening' && !this.canOpen) return;
    this.editingId = item.id;
    this.editMovement = {
      type: item.type,
      category: item.category,
      amount: Number(item.amount) || 0,
      description: item.description || ''
    };
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  async saveEdit(item: CashTransaction): Promise<void> {
    const clientId = this.clientContext.selectedClientId();
    if (!clientId || !this.editingId) return;
    await this.caja.updateTransaction(clientId, this.editingId, {
      type: this.editMovement.type,
      category: this.editMovement.category,
      amount: Number(this.editMovement.amount) || 0,
      description: this.editMovement.description
    });
    this.editingId = null;
    await this.loadData();
  }

  async deleteMovement(item: CashTransaction): Promise<void> {
    const clientId = this.clientContext.selectedClientId();
    if (!clientId || item.source !== 'manual') return;
    if (!confirm('¿Eliminar este movimiento?')) return;
    await this.caja.deleteTransaction(clientId, item.id);
    await this.loadData();
  }
}
