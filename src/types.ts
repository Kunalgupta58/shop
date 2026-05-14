export interface MedicineEntry {
  id?: number;
  name: string;
  batch: string;
  qty: number;
  mrp: number;
  rate: number;
  prev_rate?: number;
  expiry: string;
  mfg: string;
  hsn: string;
  rate_changed?: number;
  low_stock?: number;
  last_updated?: string;
}

export interface ChangeLogRow {
  id?: number;
  medicine_name: string;
  event_type: 'new' | 'qty_add' | 'rate_update' | 'low_stock' | 'rate_lower';
  old_value: string;
  new_value: string;
  message: string;
  timestamp: string;
}

export type QueryFilter =
  | 'all'
  | 'expiring7'
  | 'expiring30'
  | 'expiring90'
  | 'expired'
  | 'low_stock'
  | 'rate_changed';
