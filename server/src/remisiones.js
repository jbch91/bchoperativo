import { pool, query } from './db.js';

export async function listRemisionClients(clientId) {
  const { rows } = await query(
    `SELECT id, name, address, contact, created_at
     FROM remision_clients
     WHERE client_id = $1
     ORDER BY created_at DESC`,
    [clientId]
  );
  return rows;
}

export async function createRemisionClient(clientId, payload) {
  const { name, address, contact } = payload;
  const { rows } = await query(
    `INSERT INTO remision_clients (client_id, name, address, contact)
     VALUES ($1,$2,$3,$4)
     RETURNING id`,
    [clientId, name, address || null, contact || null]
  );
  return rows[0];
}

export async function listRemisiones(clientId) {
  const { rows } = await query(
    `SELECT r.id, r.remision_number, r.remision_client_id, r.recipient, r.destination, r.notes, r.created_at, r.updated_at,
            rc.name AS client_name
     FROM remisiones r
     LEFT JOIN remision_clients rc ON rc.id = r.remision_client_id
     WHERE r.client_id = $1
     ORDER BY r.created_at DESC`,
    [clientId]
  );
  return rows;
}

export async function listRemisionLines(remisionId) {
  const { rows } = await query(
    `SELECT id, entry_id, code, name, lote, vencimiento, cantidad
     FROM remision_lines
     WHERE remision_id = $1`,
    [remisionId]
  );
  return rows;
}

export async function createRemision(clientId, payload) {
  const { remisionNumber, remisionClientId, recipient, destination, notes, lines } = payload;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO remisiones (client_id, remision_number, remision_client_id, recipient, destination, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, created_at`,
      [clientId, remisionNumber, remisionClientId || null, recipient || null, destination || null, notes || null]
    );
    const remision = rows[0];

    for (const line of lines) {
      await client.query(
        `INSERT INTO remision_lines (remision_id, entry_id, code, name, lote, vencimiento, cantidad)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [remision.id, line.entryId, line.code, line.name, line.lote, line.vencimiento, line.cantidad]
      );

      await client.query(
        `UPDATE inventory_entries
         SET cantidad = cantidad - $1
         WHERE id = $2 AND cantidad >= $1`,
        [line.cantidad, line.entryId]
      );
    }

    await client.query('COMMIT');
    return remision;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateRemision(clientId, remisionId, payload) {
  const { remisionNumber, remisionClientId, recipient, destination, notes, lines } = payload;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT entry_id, cantidad FROM remision_lines WHERE remision_id = $1`,
      [remisionId]
    );
    const existingMap = new Map(existing.rows.map((row) => [row.entry_id, Number(row.cantidad) || 0]));

    for (const line of lines) {
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
          throw new Error('Stock insuficiente para actualizar la remisión.');
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

    await client.query(`DELETE FROM remision_lines WHERE remision_id = $1`, [remisionId]);
    for (const line of lines) {
      await client.query(
        `INSERT INTO remision_lines (remision_id, entry_id, code, name, lote, vencimiento, cantidad)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [remisionId, line.entryId, line.code, line.name, line.lote, line.vencimiento, line.cantidad]
      );
    }

    await client.query(
      `UPDATE remisiones
       SET remision_number = $1,
           remision_client_id = $2,
           recipient = $3,
           destination = $4,
           notes = $5,
           updated_at = now()
       WHERE id = $6 AND client_id = $7`,
      [remisionNumber, remisionClientId || null, recipient || null, destination || null, notes || null, remisionId, clientId]
    );

    await client.query('COMMIT');
    return { ok: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteRemision(clientId, remisionId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT entry_id, cantidad FROM remision_lines WHERE remision_id = $1`,
      [remisionId]
    );
    for (const row of existing.rows) {
      await client.query(
        `UPDATE inventory_entries SET cantidad = cantidad + $1 WHERE id = $2`,
        [Number(row.cantidad) || 0, row.entry_id]
      );
    }
    await client.query(`DELETE FROM remision_lines WHERE remision_id = $1`, [remisionId]);
    await client.query(`DELETE FROM remisiones WHERE id = $1 AND client_id = $2`, [remisionId, clientId]);
    await client.query('COMMIT');
    return { ok: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
