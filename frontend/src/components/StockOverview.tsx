import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { StockOverviewGridItem, Location } from '../types';
import { formatCurrencyINR, formatQuantity } from '../utils/formatters';
import { ClickToCopy } from './ClickToCopy';
import { Pagination } from './Pagination';

interface StockOverviewProps {
  onSelectProduct?: (productId: number) => void;
}

type SortKey =
  | 'sku'
  | 'product_name'
  | 'bin_code'
  | 'location_description'
  | 'quantity'
  | 'unit_cost'
  | 'total_value';

type SortDirection = 'asc' | 'desc';

interface ColumnFilters {
  sku: string;
  product_name: string;
  bin_code: string;
  location_description: string;
  quantity: string;
  unit_cost: string;
  total_value: string;
}

const initialFilters: ColumnFilters = {
  sku: '',
  product_name: '',
  bin_code: '',
  location_description: '',
  quantity: '',
  unit_cost: '',
  total_value: '',
};

function matchesNumericFilter(itemValStr: string | null | undefined, filterStr: string): boolean {
  if (!filterStr.trim()) return true;
  const val = parseFloat(itemValStr || '0');
  const trimmed = filterStr.trim();

  if (trimmed.startsWith('>=')) {
    const target = parseFloat(trimmed.slice(2).trim());
    return !isNaN(target) && val >= target;
  }
  if (trimmed.startsWith('>')) {
    const target = parseFloat(trimmed.slice(1).trim());
    return !isNaN(target) && val > target;
  }
  if (trimmed.startsWith('<=')) {
    const target = parseFloat(trimmed.slice(2).trim());
    return !isNaN(target) && val <= target;
  }
  if (trimmed.startsWith('<')) {
    const target = parseFloat(trimmed.slice(1).trim());
    return !isNaN(target) && val < target;
  }
  if (trimmed.startsWith('=')) {
    const target = parseFloat(trimmed.slice(1).trim());
    return !isNaN(target) && Math.abs(val - target) < 0.0001;
  }

  const num = parseFloat(trimmed);
  if (!isNaN(num)) {
    return val >= num;
  }
  return (itemValStr || '').toLowerCase().includes(trimmed.toLowerCase());
}

export const StockOverview: React.FC<StockOverviewProps> = ({ onSelectProduct }) => {
  const [items, setItems] = useState<StockOverviewGridItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Column filtering and sorting state
  const [showFilters, setShowFilters] = useState<boolean>(true);
  const [colFilters, setColFilters] = useState<ColumnFilters>(initialFilters);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

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

  const handleSort = (key: SortKey) => {
    setCurrentPage(1);
    if (sortKey === key) {
      if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        setSortKey(null);
        setSortDir('asc');
      }
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleColFilterChange = (field: keyof ColumnFilters, value: string) => {
    setCurrentPage(1);
    setColFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleClearAllFilters = () => {
    setCurrentPage(1);
    setSearch('');
    setLocationId('all');
    setColFilters(initialFilters);
    setSortKey(null);
    setSortDir('asc');
  };

  const activeColFilterCount = Object.values(colFilters).filter((v) => v.trim() !== '').length;
  const hasActiveFilters =
    search.trim() !== '' ||
    locationId !== 'all' ||
    activeColFilterCount > 0 ||
    sortKey !== null;

  // Filter pipeline
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !search.trim() ||
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      item.product_name.toLowerCase().includes(search.toLowerCase()) ||
      item.bin_code.toLowerCase().includes(search.toLowerCase()) ||
      item.location_description.toLowerCase().includes(search.toLowerCase());

    const matchesLocation =
      locationId === 'all' || item.location_id.toString() === locationId;

    const matchesSku =
      !colFilters.sku.trim() ||
      item.sku.toLowerCase().includes(colFilters.sku.trim().toLowerCase());

    const matchesName =
      !colFilters.product_name.trim() ||
      item.product_name.toLowerCase().includes(colFilters.product_name.trim().toLowerCase());

    const matchesBin =
      !colFilters.bin_code.trim() ||
      item.bin_code.toLowerCase().includes(colFilters.bin_code.trim().toLowerCase());

    const matchesDesc =
      !colFilters.location_description.trim() ||
      item.location_description
        .toLowerCase()
        .includes(colFilters.location_description.trim().toLowerCase());

    const matchesQty = matchesNumericFilter(item.quantity, colFilters.quantity);
    const matchesCost = matchesNumericFilter(item.unit_cost, colFilters.unit_cost);
    const matchesValue = matchesNumericFilter(item.total_value, colFilters.total_value);

    return (
      matchesSearch &&
      matchesLocation &&
      matchesSku &&
      matchesName &&
      matchesBin &&
      matchesDesc &&
      matchesQty &&
      matchesCost &&
      matchesValue
    );
  });

  // Sort pipeline
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (!sortKey) return 0;
    const mult = sortDir === 'asc' ? 1 : -1;

    if (sortKey === 'quantity' || sortKey === 'unit_cost' || sortKey === 'total_value') {
      const valA = parseFloat(a[sortKey] || '0');
      const valB = parseFloat(b[sortKey] || '0');
      return (valA - valB) * mult;
    }

    const strA = (a[sortKey] || '').toLowerCase();
    const strB = (b[sortKey] || '').toLowerCase();
    return strA.localeCompare(strB) * mult;
  });

  const totalFiltered = sortedItems.length;
  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const paginatedItems =
    pageSize === -1
      ? sortedItems
      : sortedItems.slice((safePage - 1) * pageSize, safePage * pageSize);

  const totalQuantity = filteredItems.reduce(
    (sum, item) => sum + parseFloat(item.quantity || '0'),
    0
  );

  const totalValue = filteredItems.reduce(
    (sum, item) => sum + parseFloat(item.total_value || '0'),
    0
  );

  const renderSortIndicator = (key: SortKey) => {
    const isActive = sortKey === key;
    return (
      <span className={`sort-indicator ${isActive ? 'active' : ''}`} aria-hidden="true">
        {isActive ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
      </span>
    );
  };

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
            placeholder="Quick search SKU, item, bin..."
            value={search}
            onChange={(e) => {
              setCurrentPage(1);
              setSearch(e.target.value);
            }}
            style={{ width: '220px' }}
          />

          <select
            className="select-input"
            value={locationId}
            onChange={(e) => {
              setCurrentPage(1);
              setLocationId(e.target.value);
            }}
          >
            <option value="all">All Locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id.toString()}>
                {loc.bin_code} ({loc.description})
              </option>
            ))}
          </select>

          <button
            className="btn"
            onClick={() => setShowFilters(!showFilters)}
            title="Toggle column filters row"
          >
            {showFilters ? 'Hide Filters' : 'Column Filters'}
            {activeColFilterCount > 0 && ` (${activeColFilterCount})`}
          </button>

          {hasActiveFilters && (
            <button
              className="btn"
              onClick={handleClearAllFilters}
              title="Clear search, column filters, and sorting"
            >
              Clear All
            </button>
          )}

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
                <th
                  className="th-sortable"
                  onClick={() => handleSort('sku')}
                  title="Click to sort by SKU"
                >
                  <div className="th-content">
                    <span>SKU</span>
                    {renderSortIndicator('sku')}
                  </div>
                </th>
                <th
                  className="th-sortable"
                  onClick={() => handleSort('product_name')}
                  title="Click to sort by Product Name"
                >
                  <div className="th-content">
                    <span>Product Name</span>
                    {renderSortIndicator('product_name')}
                  </div>
                </th>
                <th
                  className="th-sortable"
                  onClick={() => handleSort('bin_code')}
                  title="Click to sort by Bin"
                >
                  <div className="th-content">
                    <span>Bin / Location</span>
                    {renderSortIndicator('bin_code')}
                  </div>
                </th>
                <th
                  className="th-sortable"
                  onClick={() => handleSort('location_description')}
                  title="Click to sort by Location Details"
                >
                  <div className="th-content">
                    <span>Location Details</span>
                    {renderSortIndicator('location_description')}
                  </div>
                </th>
                <th
                  className="th-sortable text-right"
                  onClick={() => handleSort('quantity')}
                  title="Click to sort by On-Hand Qty"
                >
                  <div className="th-content text-right">
                    <span>On-Hand Qty</span>
                    {renderSortIndicator('quantity')}
                  </div>
                </th>
                <th
                  className="th-sortable text-right"
                  onClick={() => handleSort('unit_cost')}
                  title="Click to sort by Unit Cost"
                >
                  <div className="th-content text-right">
                    <span>Unit Cost (WAC)</span>
                    {renderSortIndicator('unit_cost')}
                  </div>
                </th>
                <th
                  className="th-sortable text-right"
                  onClick={() => handleSort('total_value')}
                  title="Click to sort by Total Value"
                >
                  <div className="th-content text-right">
                    <span>Total Value</span>
                    {renderSortIndicator('total_value')}
                  </div>
                </th>
                {onSelectProduct && <th className="text-center">Action</th>}
              </tr>

              {showFilters && (
                <tr className="filter-row">
                  <td>
                    <input
                      type="text"
                      className="col-filter-input"
                      placeholder="Filter SKU..."
                      value={colFilters.sku}
                      onChange={(e) => handleColFilterChange('sku', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="col-filter-input"
                      placeholder="Filter name..."
                      value={colFilters.product_name}
                      onChange={(e) => handleColFilterChange('product_name', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="col-filter-input"
                      placeholder="Filter bin..."
                      value={colFilters.bin_code}
                      onChange={(e) => handleColFilterChange('bin_code', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="col-filter-input"
                      placeholder="Filter details..."
                      value={colFilters.location_description}
                      onChange={(e) => handleColFilterChange('location_description', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="col-filter-input text-right"
                      placeholder="Min or >10..."
                      value={colFilters.quantity}
                      onChange={(e) => handleColFilterChange('quantity', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="col-filter-input text-right"
                      placeholder="Min or >100..."
                      value={colFilters.unit_cost}
                      onChange={(e) => handleColFilterChange('unit_cost', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="col-filter-input text-right"
                      placeholder="Min or >500..."
                      value={colFilters.total_value}
                      onChange={(e) => handleColFilterChange('total_value', e.target.value)}
                    />
                  </td>
                  {onSelectProduct && (
                    <td className="text-center">
                      {activeColFilterCount > 0 && (
                        <button
                          className="btn"
                          style={{ height: '26px', padding: '0 0.4rem', fontSize: '0.7rem' }}
                          onClick={() => setColFilters(initialFilters)}
                          title="Reset column filters"
                        >
                          Clear
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={onSelectProduct ? 8 : 7} className="empty-state">
                    Loading stock balances...
                  </td>
                </tr>
              ) : sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={onSelectProduct ? 8 : 7} className="empty-state">
                    No stock records found matching filters.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, idx) => (
                  <tr key={`${item.product_id}-${item.location_id}-${idx}`}>
                    <td>
                      <ClickToCopy text={item.sku} title="Click to copy SKU" />
                    </td>
                    <td style={{ fontWeight: 500 }}>{item.product_name}</td>
                    <td>
                      <ClickToCopy text={item.bin_code} className="tag tag-bin" title="Click to copy Bin Code" />
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
            {!loading && sortedItems.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4}>Summary ({sortedItems.length} records)</td>
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
          <>
            <Pagination
              currentPage={safePage}
              totalItems={totalFiltered}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[25, 50, 100, -1]}
            />
            <div className="card-footer">
              <span>
                Showing {totalFiltered === 0 ? 0 : pageSize === -1 ? `all ${totalFiltered}` : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, totalFiltered)} of ${totalFiltered}`} product-bin records
                {totalFiltered < items.length && ` (filtered from ${items.length} total)`}
                {sortKey && ` • Sorted by ${sortKey} (${sortDir})`}
              </span>
              <span>Total Valuation: <strong>{formatCurrencyINR(totalValue.toString())}</strong></span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

