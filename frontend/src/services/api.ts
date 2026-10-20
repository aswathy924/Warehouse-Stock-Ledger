import type {
  Product,
  Location,
  Movement,
  StockInPayload,
  StockOutPayload,
  StockTransferPayload,
  StockAdjustmentPayload,
  MovementReversalPayload,
  StockOverviewGridItem,
  LowStockItem,
  ValuationReport,
  ReconcileResponse,
} from '../types';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-Correlation-ID': `web-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    ...options.headers,
  };

  try {
    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
      let errorMsg = `HTTP Error ${res.status}: ${res.statusText}`;
      try {
        const errorJson = await res.json();
        if (errorJson.detail) {
          if (Array.isArray(errorJson.detail)) {
            errorMsg = errorJson.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
          } else {
            errorMsg = errorJson.detail;
          }
        }
      } catch {
        // Fallback to status text
      }
      throw new ApiError(errorMsg, res.status);
    }

    return await res.json();
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || 'Network connection failed', 0);
  }
}

export const api = {
  // System Health
  checkHealth: () => request<{ status: string; service: string }>('/health'),
  checkDbHealth: () => request<{ database: string; status: string }>('/health/db'),

  // Products
  getProducts: () => request<Product[]>('/products'),
  createProduct: (data: Omit<Product, 'id'>) =>
    request<Product>('/products', { method: 'POST', body: JSON.stringify(data) }),

  // Locations
  getLocations: () => request<Location[]>('/locations'),
  createLocation: (data: Omit<Location, 'id'>) =>
    request<Location>('/locations', { method: 'POST', body: JSON.stringify(data) }),

  // Movements Core Actions
  stockIn: (data: StockInPayload) =>
    request<Movement>('/movements/in', { method: 'POST', body: JSON.stringify(data) }),

  stockOut: (data: StockOutPayload) =>
    request<Movement>('/movements/out', { method: 'POST', body: JSON.stringify(data) }),

  stockTransfer: (data: StockTransferPayload) =>
    request<Movement>('/movements/transfer', { method: 'POST', body: JSON.stringify(data) }),

  stockAdjust: (data: StockAdjustmentPayload) =>
    request<Movement>('/movements/adjust', { method: 'POST', body: JSON.stringify(data) }),

  reverseMovement: (movementId: number, data: MovementReversalPayload) =>
    request<Movement>(`/movements/${movementId}/reverse`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Balances & Queries
  getBalance: (productId: number, locationId: number) =>
    request<{ product_id: number; location_id: number; quantity: string }>(
      `/movements/balance?product_id=${productId}&location_id=${locationId}`
    ),

  getOverviewGrid: (productId?: number, locationId?: number) => {
    const params = new URLSearchParams();
    if (productId) params.append('product_id', productId.toString());
    if (locationId) params.append('location_id', locationId.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<StockOverviewGridItem[]>(`/movements/grid${query}`);
  },

  getMovements: (productId?: number, locationId?: number, movementType?: string, limit = 100) => {
    const params = new URLSearchParams();
    if (productId) params.append('product_id', productId.toString());
    if (locationId) params.append('location_id', locationId.toString());
    if (movementType) params.append('movement_type', movementType);
    params.append('limit', limit.toString());
    return request<Movement[]>(`/movements?${params.toString()}`);
  },

  getMovementById: (id: number) => request<Movement>(`/movements/${id}`),

  // Reports & Reconciliation
  getLowStockReport: () => request<LowStockItem[]>('/reports/low-stock'),
  getValuationReport: () => request<ValuationReport>('/reports/valuation'),
  reconcileLedger: () => request<ReconcileResponse>('/reports/reconcile', { method: 'POST' }),
};
