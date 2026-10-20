export interface Product {
  id: number;
  sku: string;
  name: string;
  unit: string;
  reorder_level: number;
}

export interface Location {
  id: number;
  bin_code: string;
  description: string;
}

export type MovementType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';

export type AdjustmentReason =
  | 'damaged'
  | 'expired'
  | 'count correction'
  | 'theft'
  | 'other-with-note';

export interface Movement {
  id: number;
  movement_type: MovementType;
  product_id: number;
  from_location_id: number | null;
  to_location_id: number | null;
  quantity: string;
  unit_cost: string;
  reason: string | null;
  reference: string | null;
  created_at: string | null;
  created_by: string;
  reverses_movement_id: number | null;
  is_reversed: boolean;
}

export interface StockInPayload {
  product_id: number;
  to_location_id: number;
  quantity: number | string;
  unit_cost: number | string;
  reference?: string;
  created_by: string;
}

export interface StockOutPayload {
  product_id: number;
  from_location_id: number;
  quantity: number | string;
  reference?: string;
  created_by: string;
}

export interface StockTransferPayload {
  product_id: number;
  from_location_id: number;
  to_location_id: number;
  quantity: number | string;
  reference?: string;
  created_by: string;
}

export interface StockAdjustmentPayload {
  product_id: number;
  location_id: number;
  quantity: number | string;
  reason: AdjustmentReason;
  reference?: string;
  created_by: string;
}

export interface MovementReversalPayload {
  reason?: string;
  created_by: string;
}

export interface StockOverviewGridItem {
  product_id: number;
  sku: string;
  product_name: string;
  unit: string;
  location_id: number;
  bin_code: string;
  location_description: string;
  quantity: string;
  unit_cost: string;
  total_value: string;
}

export interface LowStockItem {
  product_id: number;
  sku: string;
  name: string;
  unit: string;
  reorder_level: number;
  current_stock: string;
}

export interface ValuationItem {
  product_id: number;
  sku: string;
  name: string;
  unit: string;
  total_quantity: string;
  average_cost: string;
  total_value: string;
}

export interface ValuationReport {
  items: ValuationItem[];
  total_warehouse_value: string;
}

export interface ReconcileDriftItem {
  product_id: number;
  sku: string;
  location_id: number;
  bin_code: string;
  expected_balance: string;
  actual_balance: string;
  drift: string;
}

export interface ReconcileResponse {
  status: string;
  drift_detected: boolean;
  total_records_checked: number;
  drifts: ReconcileDriftItem[];
}
