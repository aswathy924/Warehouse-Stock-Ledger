import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { StockOverviewGridItem, Location } from '../types';
import { formatCurrencyINR, formatQuantity } from '../utils/formatters';

interface StockOverviewProps {
  onSelectProduct?: (productId: number) => void;
}

export const StockOverview: React.FC<StockOverviewProps> = ({ onSelectProduct }) => {
  const [items, setItems] = useState<StockOverviewGridItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [gridData, locData] = await Promise.all([
        api.getOverviewGrid(),
        api.getLocations(),
      ]);
      setItems(gridData);
      setLocations(locData);
    } catch (err: any) {
      setError(err.message || 'Failed to load stock data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      item.product_name.toLowerCase().includes(search.toLowerCase()) ||
      item.bin_code.toLowerCase().includes(search.toLowerCase());

    const matchesLocation =
      locationId === 'all' || item.location_id.toString() === locationId;

    return matchesSearch && matchesLocation;
  });

  const totalQuantity = filteredItems.reduce(
    (sum, item) => sum + parseFloat(item.quantity || '0'),
    0
  );

  const totalValue = filteredItems.reduce(
    (sum, item) => sum + parseFloat(item.total_value || '0'),
    0
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <h1>Stock Overview Matrix</h1>
        </div>

        <div className="toolbar">
          <input
            type="text"
            className="input-text"
            placeholder="Search SKU, item, or bin..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '220px' }}
          />

          <select
            className="select-input"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            <option value="all">All Locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id.toString()}>
                {loc.bin_code} ({loc.description})
              </option>
            ))}
          </select>

          <button className="btn" onClick={loadData} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Bin / Location</th>
                <th>Location Details</th>
                <th className="text-right">On-Hand Qty</th>
                <th className="text-right">Unit Cost (WAC)</th>
                <th className="text-right">Total Value</th>
                {onSelectProduct && <th className="text-center">Action</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="empty-state">
                    Loading stock balances...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-state">
                    No stock records found matching filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={`${item.product_id}-${item.location_id}-${idx}`}>
                    <td>
                      <span className="tag">{item.sku}</span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{item.product_name}</td>
                    <td>
                      <span className="tag tag-bin">{item.bin_code}</span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {item.location_description}
                    </td>
                    <td className="text-right mono" style={{ fontWeight: 600 }}>
                      {formatQuantity(item.quantity, item.unit)}
                    </td>
                    <td className="text-right mono">
                      {formatCurrencyINR(item.unit_cost)}
                    </td>
                    <td className="text-right mono" style={{ fontWeight: 600 }}>
                      {formatCurrencyINR(item.total_value)}
                    </td>
                    {onSelectProduct && (
                      <td className="text-center">
                        <button
                          className="btn"
                          style={{ height: '28px', padding: '0 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => onSelectProduct(item.product_id)}
                        >
                          Ledger
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            {!loading && filteredItems.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4}>Summary ({filteredItems.length} records)</td>
                  <td className="text-right mono">
                    {totalQuantity.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                  </td>
                  <td className="text-right">—</td>
                  <td className="text-right mono">
                    {formatCurrencyINR(totalValue.toString())}
                  </td>
                  {onSelectProduct && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {!loading && (
          <div className="card-footer">
            <span>Showing {filteredItems.length} product-bin locations</span>
            <span>Total Valuation: <strong>{formatCurrencyINR(totalValue.toString())}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
};
