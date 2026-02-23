import { query } from './db.js';

export async function listCashTransactions(clientId, filters = {}) {
  const conditions = ['client_id = $1'];
  const params = [clientId];
  let idx = 2;

  if (filters.type && ['in', 'out'].includes(filters.type)) {
    conditions.push(`type = $${idx}`);
    params.push(filters.type);
    idx += 1;
  }

  if (filters.search) {
    conditions.push(`(LOWER(category) LIKE $${idx} OR LOWER(description) LIKE $${idx})`);
    params.push(`%${filters.search.toLowerCase()}%`);
    idx += 1;
  }

  if (filters.dateFrom) {
    conditions.push(`created_at >= $${idx}`);
    params.push(filters.dateFrom);
    idx += 1;
  }

  if (filters.dateTo) {
    conditions.push(`created_at <= $${idx}`);
    params.push(filters.dateTo);
    idx += 1;
  }

  const { rows } = await query(
    `SELECT id, type, category, amount, description, created_at, source, sale_id, payment_method
     FROM cash_transactions
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC`,
    params
  );
  return rows;
}

export async function getCashSummary(clientId) {
  const { rows } = await query(
    `SELECT
        COALESCE(SUM(CASE WHEN type = 'in' THEN amount ELSE 0 END), 0) AS total_in,
        COALESCE(SUM(CASE WHEN type = 'out' THEN amount ELSE 0 END), 0) AS total_out
     FROM cash_transactions
     WHERE client_id = $1`,
    [clientId]
  );
  const totalIn = Number(rows[0]?.total_in || 0);
  const totalOut = Number(rows[0]?.total_out || 0);
  return {
    totalIn,
    totalOut,
    balance: Math.round((totalIn - totalOut) * 100) / 100
  };
}

export async function createCashTransaction(clientId, payload) {
  const { type, category, amount, description, createdBy, source, saleId, paymentMethod } = payload;
  const { rows } = await query(
    `INSERT INTO cash_transactions
      (client_id, type, category, amount, description, created_by, source, sale_id, payment_method)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, created_at`,
    [
      clientId,
      type,
      category,
      amount,
      description || null,
      createdBy || null,
      source || 'manual',
      saleId || null,
      paymentMethod || null
    ]
  );
  return rows[0];
}

export async function getCashTransactionById(clientId, id) {
  const { rows } = await query(
    `SELECT id, source FROM cash_transactions WHERE id = $1 AND client_id = $2`,
    [id, clientId]
  );
  return rows[0];
}

export async function updateCashTransaction(clientId, id, payload) {
  const { type, category, amount, description } = payload;
  await query(
    `UPDATE cash_transactions
     SET type = $1,
         category = $2,
         amount = $3,
         description = $4
     WHERE id = $5 AND client_id = $6 AND source IN ('manual','opening')`,
    [type, category, amount, description || null, id, clientId]
  );
}

export async function deleteCashTransaction(clientId, id) {
  await query(
    `DELETE FROM cash_transactions WHERE id = $1 AND client_id = $2 AND source IN ('manual','opening')`,
    [id, clientId]
  );
}

export async function deleteCashTransactionBySale(saleId) {
  await query(`DELETE FROM cash_transactions WHERE sale_id = $1 AND source = 'sale'`, [saleId]);
}

export async function upsertCashTransactionForSale(clientId, payload) {
  const { saleId, amount, createdBy } = payload;
  await query(
    `INSERT INTO cash_transactions
      (client_id, type, category, amount, description, created_by, source, sale_id, payment_method)
     VALUES ($1,'in','Venta POS', $2, $3, $4, 'sale', $5, 'efectivo')
     ON CONFLICT (sale_id) WHERE source = 'sale'
     DO UPDATE SET amount = EXCLUDED.amount, description = EXCLUDED.description`,
    [clientId, amount, `Venta ${saleId}`, createdBy || null, saleId]
  );
}
