import * as SQLite from 'expo-sqlite';
import { MedicineEntry, ChangeLogRow, QueryFilter } from './types';
import { buildExpiryQuery, todayISODate, isLowStock } from './utils';

const db = SQLite.openDatabase('rxledger.db');

function executeSqlAsync(sql: string, params: any[] = []): Promise<SQLite.SQLResultSet> {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        sql,
        params,
        (_, result) => resolve(result),
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
}

export async function initDatabase(): Promise<void> {
  await executeSqlAsync(
    `CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      batch TEXT,
      qty INTEGER,
      mrp REAL,
      rate REAL,
      prev_rate REAL,
      expiry TEXT,
      mfg TEXT,
      hsn TEXT,
      rate_changed INTEGER,
      low_stock INTEGER,
      last_updated TEXT
    );`
  );

  await executeSqlAsync(
    `CREATE TABLE IF NOT EXISTS change_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_name TEXT,
      event_type TEXT,
      old_value TEXT,
      new_value TEXT,
      message TEXT,
      timestamp TEXT
    );`
  );
}

export async function fetchAllMedicines(): Promise<MedicineEntry[]> {
  const result = await executeSqlAsync('SELECT * FROM medicines ORDER BY name COLLATE NOCASE;');
  return result.rows._array as MedicineEntry[];
}

export async function fetchChangeLog(): Promise<ChangeLogRow[]> {
  const result = await executeSqlAsync('SELECT * FROM change_log ORDER BY timestamp DESC;');
  return result.rows._array as ChangeLogRow[];
}

export async function fetchInventoryCounts(): Promise<{ total: number; expiring30: number; expired: number; lowStock: number }> {
  const totalResult = await executeSqlAsync('SELECT COUNT(*) as count FROM medicines;');
  const expiringResult = await executeSqlAsync(
    `SELECT COUNT(*) as count FROM medicines WHERE ${buildExpiryQuery('expiry')} BETWEEN date('now') AND date('now', '+30 day');`
  );
  const expiredResult = await executeSqlAsync(
    `SELECT COUNT(*) as count FROM medicines WHERE ${buildExpiryQuery('expiry')} < date('now');`
  );
  const lowStockResult = await executeSqlAsync('SELECT COUNT(*) as count FROM medicines WHERE low_stock = 1;');

  return {
    total: totalResult.rows._array[0]?.count ?? 0,
    expiring30: expiringResult.rows._array[0]?.count ?? 0,
    expired: expiredResult.rows._array[0]?.count ?? 0,
    lowStock: lowStockResult.rows._array[0]?.count ?? 0,
  };
}

export async function queryMedicines(filter: QueryFilter, searchText: string): Promise<MedicineEntry[]> {
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (searchText.trim()) {
    const search = `%${searchText.trim().toLowerCase()}%`;
    whereClauses.push('(LOWER(name) LIKE ? OR LOWER(batch) LIKE ? OR LOWER(mfg) LIKE ?)');
    params.push(search, search, search);
  }

  switch (filter) {
    case 'expiring7':
      whereClauses.push(`${buildExpiryQuery('expiry')} BETWEEN date('now') AND date('now', '+7 day')`);
      break;
    case 'expiring30':
      whereClauses.push(`${buildExpiryQuery('expiry')} BETWEEN date('now') AND date('now', '+30 day')`);
      break;
    case 'expiring90':
      whereClauses.push(`${buildExpiryQuery('expiry')} BETWEEN date('now') AND date('now', '+90 day')`);
      break;
    case 'expired':
      whereClauses.push(`${buildExpiryQuery('expiry')} < date('now')`);
      break;
    case 'low_stock':
      whereClauses.push('low_stock = 1');
      break;
    case 'rate_changed':
      whereClauses.push('rate_changed = 1');
      break;
    case 'all':
    default:
      break;
  }

  const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const result = await executeSqlAsync(`SELECT * FROM medicines ${where} ORDER BY name COLLATE NOCASE;`, params);
  return result.rows._array as MedicineEntry[];
}

async function insertChangeLog(entry: ChangeLogRow): Promise<void> {
  await executeSqlAsync(
    `INSERT INTO change_log (medicine_name, event_type, old_value, new_value, message, timestamp) VALUES (?, ?, ?, ?, ?, ?);`,
    [entry.medicine_name, entry.event_type, entry.old_value, entry.new_value, entry.message, entry.timestamp]
  );
}

export async function saveMedicine(entry: MedicineEntry): Promise<{ message: string; eventType: string }> {
  const trimmedName = entry.name.trim();
  const now = todayISODate();
  const searchResult = await executeSqlAsync('SELECT * FROM medicines WHERE LOWER(name) = LOWER(?);', [trimmedName]);
  const existing = searchResult.rows._array[0] as MedicineEntry | undefined;
  const lowStock = isLowStock(entry.qty) ? 1 : 0;

  if (!existing) {
    await executeSqlAsync(
      `INSERT INTO medicines (name, batch, qty, mrp, rate, prev_rate, expiry, mfg, hsn, rate_changed, low_stock, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        trimmedName,
        entry.batch,
        entry.qty,
        entry.mrp,
        entry.rate,
        entry.prev_rate ?? entry.rate,
        entry.expiry,
        entry.mfg,
        entry.hsn,
        0,
        lowStock,
        now,
      ]
    );

    await insertChangeLog({
      medicine_name: trimmedName,
      event_type: 'new',
      old_value: '',
      new_value: JSON.stringify({ ...entry, rate_changed: 0, low_stock: lowStock }),
      message: 'New medicine added',
      timestamp: now,
    });

    if (lowStock) {
      await insertChangeLog({
        medicine_name: trimmedName,
        event_type: 'low_stock',
        old_value: 'qty: 0',
        new_value: `qty: ${entry.qty}`,
        message: 'Low stock flagged on new item',
        timestamp: now,
      });
    }

    return { message: 'New medicine added', eventType: 'new' };
  }

  const updatedQty = existing.qty + entry.qty;
  const shouldRateUpdate = entry.rate > existing.rate;
  const newRate = shouldRateUpdate ? entry.rate : existing.rate;
  const prevRateValue = shouldRateUpdate ? existing.rate : existing.prev_rate ?? existing.rate;
  const rateChangedFlag = shouldRateUpdate ? 1 : 0;
  const newLowStock = updatedQty < 20 ? 1 : 0;
  const updateFields = [updatedQty, newRate, prevRateValue, rateChangedFlag, newLowStock, now, entry.batch, entry.mrp, entry.expiry, entry.mfg, entry.hsn, trimmedName];

  if (shouldRateUpdate) {
    await executeSqlAsync(
      `UPDATE medicines SET qty = ?, rate = ?, prev_rate = ?, rate_changed = ?, low_stock = ?, last_updated = ?, batch = ?, mrp = ?, expiry = ?, mfg = ?, hsn = ? WHERE LOWER(name) = LOWER(?);`,
      updateFields
    );

    await insertChangeLog({
      medicine_name: trimmedName,
      event_type: 'rate_update',
      old_value: `${existing.qty} qty, rate ${existing.rate}`,
      new_value: `${updatedQty} qty, rate ${entry.rate}`,
      message: `Rate updated: ₹${existing.rate.toFixed(2)} to ₹${entry.rate.toFixed(2)}`,
      timestamp: now,
    });

    if (newLowStock) {
      await insertChangeLog({
        medicine_name: trimmedName,
        event_type: 'low_stock',
        old_value: `qty: ${existing.qty}`,
        new_value: `qty: ${updatedQty}`,
        message: 'Low stock warning triggered',
        timestamp: now,
      });
    }

    return { message: 'Stock merged — rate and qty updated', eventType: 'rate_update' };
  }

  await executeSqlAsync(
    `UPDATE medicines SET qty = ?, rate = ?, prev_rate = ?, rate_changed = ?, low_stock = ?, last_updated = ?, batch = ?, mrp = ?, expiry = ?, mfg = ?, hsn = ? WHERE LOWER(name) = LOWER(?);`,
    updateFields
  );

  await insertChangeLog({
    medicine_name: trimmedName,
    event_type: 'qty_add',
    old_value: `${existing.qty} qty`,
    new_value: `${updatedQty} qty`,
    message: `Quantity updated: ${existing.qty} to ${updatedQty}`,
    timestamp: now,
  });

  if (newLowStock) {
    await insertChangeLog({
      medicine_name: trimmedName,
      event_type: 'low_stock',
      old_value: `qty: ${existing.qty}`,
      new_value: `qty: ${updatedQty}`,
      message: 'Low stock warning triggered',
      timestamp: now,
    });
  }

  return { message: shouldRateUpdate ? 'Stock merged — rate and qty updated' : 'Stock merged — qty updated', eventType: shouldRateUpdate ? 'rate_update' : 'qty_add' };
}
