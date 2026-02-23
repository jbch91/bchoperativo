import { pool, query } from './db.js';
import { deleteCashTransactionBySale, upsertCashTransactionForSale } from './cash.js';

export async function createSale(clientId, payload) {
  const { totalBase, totalIva, total, lines, buyerName, buyerDocument, buyerAddress, consumptionArea, consumptionNote, saleType, serviceType, paymentMethod, createdBy } = payload;
  const { rows } = await query(
    `INSERT INTO sales (client_id, total_base, total_iva, total, buyer_name, buyer_document, buyer_address, consumption_area, consumption_note, sale_type, service_type, payment_method)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id, created_at`,
    [
      clientId,
      totalBase,
      totalIva,
      total,
      buyerName || null,
      buyerDocument || null,
      buyerAddress || null,
      consumptionArea || null,
      consumptionNote || null,
      saleType || 'producto',
      serviceType || null,
      paymentMethod || 'efectivo'
    ]
  );
  const sale = rows[0];

  for (const line of lines) {
    await query(
      `INSERT INTO sale_lines
        (sale_id, entry_id, code, name, lote, vencimiento, cantidad, unitario, iva, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        sale.id,
        line.entryId || null,
        line.code,
        line.name,
        line.lote,
        line.vencimiento,
        line.cantidad,
        line.unitario,
        line.iva,
        line.total
      ]
    );

    if (line.entryId) {
      await query(
        `UPDATE inventory_entries
         SET cantidad = cantidad - $1
         WHERE id = $2 AND cantidad >= $1`,
        [line.cantidad, line.entryId]
      );
    }
  }

  const normalizedType = saleType || 'producto';
  if ((normalizedType === 'producto' || normalizedType === 'servicio') && (paymentMethod || 'efectivo') === 'efectivo') {
    await upsertCashTransactionForSale(clientId, {
      saleId: sale.id,
      amount: Number(total) || 0,
      createdBy
    });
  }

  return sale;
}

export async function listSales(clientId) {
  const { rows } = await query(
    `SELECT id, created_at, total_base, total_iva, total, buyer_name, buyer_document, buyer_address, consumption_area, consumption_note, sale_type, service_type, payment_method
     FROM sales
     WHERE client_id = $1
     ORDER BY created_at DESC`,
    [clientId]
  );
  return rows;
}

export async function listSaleLines(saleId) {
  const { rows } = await query(
    `SELECT id, entry_id, code, name, lote, vencimiento, cantidad, unitario, iva, total
     FROM sale_lines
     WHERE sale_id = $1`,
    [saleId]
  );
  return rows;
}

export async function updateSale(clientId, saleId, payload) {
  const { totalBase, totalIva, total, lines, buyerName, buyerDocument, buyerAddress, consumptionArea, consumptionNote, saleType, serviceType, paymentMethod, createdBy } = payload;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const saleCheck = await client.query(
      `SELECT id FROM sales WHERE id = $1 AND client_id = $2`,
      [saleId, clientId]
    );
    if (!saleCheck.rowCount) {
      throw new Error('Venta no encontrada.');
    }

    const existing = await client.query(
      `SELECT entry_id, cantidad FROM sale_lines WHERE sale_id = $1`,
      [saleId]
    );
    const existingMap = new Map(
      existing.rows
        .filter((row) => row.entry_id)
        .map((row) => [row.entry_id, Number(row.cantidad) || 0])
    );

    for (const line of lines) {
      if (!line.entryId) continue;
      const oldQty = existingMap.get(line.entryId) || 0;
      const newQty = Number(line.cantidad) || 0;
      if (newQty === oldQty) continue;
      if (newQty > oldQty) {
        const extra = newQty - oldQty;
        const inv = await client.query(
          `SELECT cantidad FROM inventory_entries WHERE id = $1 FOR UPDATE`,
          [line.entryId]
        );
        const available = Number(inv.rows[0]?.cantidad || 0);
        if (available < extra) {
          throw new Error('Stock insuficiente para actualizar la venta.');
        }
        await client.query(
          `UPDATE inventory_entries SET cantidad = cantidad - $1 WHERE id = $2`,
          [extra, line.entryId]
        );
      } else {
        const back = oldQty - newQty;
        await client.query(
          `UPDATE inventory_entries SET cantidad = cantidad + $1 WHERE id = $2`,
          [back, line.entryId]
        );
      }
    }

    await client.query(`DELETE FROM sale_lines WHERE sale_id = $1`, [saleId]);

    for (const line of lines) {
      await client.query(
        `INSERT INTO sale_lines
          (sale_id, entry_id, code, name, lote, vencimiento, cantidad, unitario, iva, total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          saleId,
          line.entryId || null,
          line.code,
          line.name,
          line.lote,
          line.vencimiento,
          line.cantidad,
          line.unitario,
          line.iva,
          line.total
        ]
      );
    }

    await client.query(
      `UPDATE sales
       SET total_base = $1,
           total_iva = $2,
           total = $3,
           buyer_name = $4,
           buyer_document = $5,
           buyer_address = $6,
           consumption_area = $7,
           consumption_note = $8,
           sale_type = $9,
           service_type = $10,
           payment_method = $11
       WHERE id = $12 AND client_id = $13`,
      [
        totalBase,
        totalIva,
        total,
        buyerName || null,
        buyerDocument || null,
        buyerAddress || null,
        consumptionArea || null,
        consumptionNote || null,
        saleType || 'producto',
        serviceType || null,
        paymentMethod || 'efectivo',
        saleId,
        clientId
      ]
    );

    const normalizedType = saleType || 'producto';
    if ((normalizedType === 'producto' || normalizedType === 'servicio') && (paymentMethod || 'efectivo') === 'efectivo') {
      await upsertCashTransactionForSale(clientId, {
        saleId,
        amount: Number(total) || 0,
        createdBy
      });
    } else {
      await deleteCashTransactionBySale(saleId);
    }

    await client.query('COMMIT');
    return { ok: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteSale(clientId, saleId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const saleCheck = await client.query(
      `SELECT id FROM sales WHERE id = $1 AND client_id = $2`,
      [saleId, clientId]
    );
    if (!saleCheck.rowCount) {
      throw new Error('Venta no encontrada.');
    }

    const existing = await client.query(
      `SELECT entry_id, cantidad FROM sale_lines WHERE sale_id = $1`,
      [saleId]
    );
    for (const row of existing.rows) {
      if (!row.entry_id) continue;
      await client.query(
        `UPDATE inventory_entries SET cantidad = cantidad + $1 WHERE id = $2`,
        [Number(row.cantidad) || 0, row.entry_id]
      );
    }

    await client.query(`DELETE FROM sale_lines WHERE sale_id = $1`, [saleId]);
    await client.query(`DELETE FROM sales WHERE id = $1 AND client_id = $2`, [saleId, clientId]);
    await deleteCashTransactionBySale(saleId);

    await client.query('COMMIT');
    return { ok: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
