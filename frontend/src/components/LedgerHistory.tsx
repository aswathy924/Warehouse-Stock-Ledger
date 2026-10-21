import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Product, Location, Movement } from '../types';
import { formatISTDateTime, formatCurrencyINR, formatQuantity } from '../utils/formatters';
import { ClickToCopy } from './ClickToCopy';
import { Pagination } from './Pagination';
import { exportToCSV } from '../utils/csvExport';

interface LedgerHistoryProps {
  initialProductId?: number;
}

export const LedgerHistory: React.FC<LedgerHistoryProps> = ({ initialProductId }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number>(initialProductId || 0);
  const [filterType, setFilterType] = useState<string>('ALL');

  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Date range filter state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Reversal Modal state
  const [reversingMovement, setReversingMovement] = useState<Movement | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('');
  const [reversalOperator, setReversalOperator] = useState<string>('');
  const [submittingReversal, setSubmittingReversal] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    const loadProductsAndLocations = async () => {
      try {
        const [prods, locs] = await Promise.all([api.getProducts(), api.getLocations()]);
        setProducts(prods);
        setLocations(locs);
        if (initialProductId !== undefined) {
          setSelectedProductId(initialProductId);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load master products');
      }
    };
    loadProductsAndLocations();
  }, [initialProductId]);

  const loadLedger = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const typeFilter = filterType === 'ALL' ? undefined : filterType;
      const prodFilter = selectedProductId === 0 ? undefined : selectedProductId;
      const data = await api.getMovements(prodFilter, undefined, typeFilter);
      setMovements(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load ledger history');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setErrorMsg(null);
    try {
      const [prods, locs] = await Promise.all([api.getProducts(), api.getLocations()]);
      setProducts(prods);
      setLocations(locs);
      const typeFilter = filterType === 'ALL' ? undefined : filterType;
      const prodFilter = selectedProductId === 0 ? undefined : selectedProductId;
      const data = await api.getMovements(prodFilter, undefined, typeFilter);
      setMovements(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to refresh ledger');
    } finally {
      setTimeout(() => setRefreshing(false), 350);
    }
  };

  useEffect(() => {
    loadLedger();
  }, [selectedProductId, filterType]);

  const productMap = new Map<number, Product>();
  products.forEach((p) => productMap.set(p.id, p));

  const selectedProduct = selectedProductId ? productMap.get(selectedProductId) : null;
  const locationMap = new Map<number, Location>();
  locations.forEach((l) => locationMap.set(l.id, l));

  // Compute running balance in chronological order (oldest to newest)
  const sortedChronological = [...movements].sort((a, b) => a.id - b.id);
  const perProductBalance = new Map<number, number>();
  const runningBalanceMap = new Map<number, number>();

  sortedChronological.forEach((m) => {
    const current = perProductBalance.get(m.product_id) || 0;
    const qty = parseFloat(m.quantity);
    let next = current;
    if (m.movement_type === 'IN') {
      next += qty;
    } else if (m.movement_type === 'OUT') {
      next -= qty;
    } else if (m.movement_type === 'TRANSFER') {
      // Transfer within warehouse does not change aggregate product balance
    } else if (m.movement_type === 'ADJUSTMENT') {
      if (m.to_location_id !== null) {
        next += qty;
      } else if (m.from_location_id !== null) {
        next -= qty;
      }
    }
    perProductBalance.set(m.product_id, next);
    runningBalanceMap.set(m.id, next);
  });

  // Filter movements by date range
  const filteredMovements = movements.filter((m) => {
    if (!startDate && !endDate) return true;
    if (!m.created_at) return false;
    const mDate = new Date(m.created_at);
    if (startDate) {
      const start = new Date(startDate + 'T00:00:00');
      if (mDate < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate + 'T23:59:59.999');
      if (mDate > end) return false;
    }
    return true;
  });

  // Pagination calculations
  const totalLedgerRecords = filteredMovements.length;
  const totalLedgerPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(totalLedgerRecords / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalLedgerPages);
  const paginatedMovements =
    pageSize === -1
      ? filteredMovements
      : filteredMovements.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleExportCSV = () => {
    const headers = [
      'Movement ID',
      'Timestamp (IST)',
      'SKU',
      'Product Name',
      'Movement Type',
      'From Location',
      'To Location',
      'Quantity',
      'Unit Cost (INR)',
      'Running Balance',
      'Reference / Invoice',
      'Reason / Notes',
      'Operator',
      'Status',
    ];
    const rows = filteredMovements.map((m) => {
      const prod = productMap.get(m.product_id);
      const fromLoc = m.from_location_id ? locationMap.get(m.from_location_id) : null;
      const toLoc = m.to_location_id ? locationMap.get(m.to_location_id) : null;
      const runningBal = runningBalanceMap.get(m.id);
      const statusStr = m.is_reversed
        ? 'Reversed'
        : m.reverses_movement_id
          ? `Compensating Reversal (of #${m.reverses_movement_id})`
          : 'Active';

      return [
        m.id,
        formatISTDateTime(m.created_at),
        prod?.sku || '',
        prod?.name || '',
        m.movement_type,
        fromLoc ? `${fromLoc.bin_code} (${fromLoc.description})` : 'EXTERNAL / NONE',
        toLoc ? `${toLoc.bin_code} (${toLoc.description})` : 'DISPATCHED / NONE',
        m.quantity,
        m.unit_cost !== null && m.unit_cost !== undefined ? m.unit_cost : '',
        runningBal !== undefined ? runningBal : '',
        m.reference || '',
        m.reason || '',
        m.created_by || '',
        statusStr,
      ];
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const prodPart = selectedProduct ? `_${selectedProduct.sku}` : '_all';
    exportToCSV(`warehouse_ledger_history${prodPart}_${dateStr}.csv`, headers, rows);
  };

  const handleExecuteReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversingMovement) return;
    setSubmittingReversal(true);
    setModalError(null);

    try {
      const op = reversalOperator.trim() || 'warehouse_staff';
      await api.reverseMovement(reversingMovement.id, {
        reason: reversalReason.trim() || undefined,
        created_by: op,
      });
      setReversingMovement(null);
      setReversalReason('');
      setReversalOperator('');
      await loadLedger();
    } catch (err: any) {
      setModalError(err.message || 'Failed to reverse movement');
    } finally {
      setSubmittingReversal(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <h1>Product Ledger History</h1>
        </div>

        <div className="toolbar">
          <select
            className="select-input"
            value={selectedProductId}
            onChange={(e) => {
              setCurrentPage(1);
              setSelectedProductId(Number(e.target.value));
            }}
            style={{ minWidth: '220px' }}
          >
            <option value={0}>All Products (Full Audit Trail)</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.sku}] {p.name}
              </option>
            ))}
          </select>

          <select
            className="select-input"
            value={filterType}
            onChange={(e) => {
              setCurrentPage(1);
              setFilterType(e.target.value);
            }}
          >
            <option value="ALL">All Movement Types</option>
            <option value="IN">IN (Receipts)</option>
            <option value="OUT">OUT (Dispatches)</option>
            <option value="TRANSFER">TRANSFER (Relocations)</option>
            <option value="ADJUSTMENT">ADJUSTMENT (Audits)</option>
          </select>

          <div className="date-filter-group">
            <label htmlFor="ledger-start-date">From:</label>
            <input
              id="ledger-start-date"
              type="date"
              className="date-input"
              value={startDate}
              onChange={(e) => {
                setCurrentPage(1);
                setStartDate(e.target.value);
              }}
              title="Filter from date"
            />
            <label htmlFor="ledger-end-date">To:</label>
            <input
              id="ledger-end-date"
              type="date"
              className="date-input"
              value={endDate}
              onChange={(e) => {
                setCurrentPage(1);
                setEndDate(e.target.value);
              }}
              title="Filter up to date"
            />
            {(startDate || endDate) && (
              <button
                className="btn btn-sm"
                onClick={() => {
                  setCurrentPage(1);
                  setStartDate('');
                  setEndDate('');
                }}
                title="Clear date range filters"
              >
                Clear Dates
              </button>
            )}
          </div>

          <button
            className="btn"
            onClick={handleExportCSV}
            disabled={loading || filteredMovements.length === 0}
            title="Export filtered ledger records to CSV"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>

          <button
            className="btn"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            title="Refresh ledger records and master data"
          >
            <svg
              className={refreshing ? 'spin-icon' : ''}
              style={{ width: '13px', height: '13px' }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {errorMsg}
        </div>
      )}

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Timestamp (IST)</th>
                {selectedProductId === 0 && <th>Product</th>}
                <th>Type</th>
                <th>Route / Location</th>
                <th className="text-right">Quantity</th>
                <th className="text-right">Unit Cost (WAC)</th>
                <th className="text-right">Running Balance</th>
                <th>Reference / Reason</th>
                <th>Operator</th>
                <th className="text-center">Status / Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={selectedProductId === 0 ? 11 : 10} className="empty-state">
                    Loading ledger movements...
                  </td>
                </tr>
              ) : filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={selectedProductId === 0 ? 11 : 10} className="empty-state">
                    {movements.length > 0
                      ? `No ledger entries found within the selected date range (${startDate || 'earliest'} to ${endDate || 'latest'}).`
                      : 'No ledger entries recorded matching the selected criteria.'}
                  </td>
                </tr>
              ) : (
                paginatedMovements.map((m) => {
                  const runningTotal = runningBalanceMap.get(m.id) ?? 0;
                  const fromLoc = m.from_location_id ? locationMap.get(m.from_location_id) : null;
                  const toLoc = m.to_location_id ? locationMap.get(m.to_location_id) : null;
                  const rowProduct = productMap.get(m.product_id) || selectedProduct;

                  let typeTagClass = 'tag-in';
                  if (m.movement_type === 'OUT') typeTagClass = 'tag-out';
                  if (m.movement_type === 'TRANSFER') typeTagClass = 'tag-transfer';
                  if (m.movement_type === 'ADJUSTMENT') typeTagClass = 'tag-adjust';

                  return (
                    <tr key={m.id} style={m.is_reversed ? { opacity: 0.6 } : {}}>
                      <td className="mono" style={{ color: 'var(--text-secondary)' }}>
                        #{m.id}
                      </td>
                      <td className="mono" style={{ fontSize: '0.8rem' }}>
                        {formatISTDateTime(m.created_at)}
                      </td>
                      {selectedProductId === 0 && (
                        <td>
                          <ClickToCopy
                            text={rowProduct?.sku || `#${m.product_id}`}
                            title="Click to copy SKU"
                            style={{ marginRight: '0.4rem' } as any}
                          />
                          <span style={{ fontWeight: 500, marginLeft: '0.4rem' }}>
                            {rowProduct?.name || 'Unknown Item'}
                          </span>
                        </td>
                      )}
                      <td>
                        <span className={`tag ${typeTagClass}`}>{m.movement_type}</span>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {m.movement_type === 'IN' && (
                          <span>
                            → <ClickToCopy text={toLoc?.bin_code || `Bin ${m.to_location_id}`} className="tag tag-bin" title="Click to copy Bin Code" />
                          </span>
                        )}
                        {m.movement_type === 'OUT' && (
                          <span>
                            <ClickToCopy text={fromLoc?.bin_code || `Bin ${m.from_location_id}`} className="tag tag-bin" title="Click to copy Bin Code" /> →
                          </span>
                        )}
                        {m.movement_type === 'TRANSFER' && (
                          <span>
                            <ClickToCopy text={fromLoc?.bin_code || ''} className="tag tag-bin" title="Click to copy From Bin" />
                            {' → '}
                            <ClickToCopy text={toLoc?.bin_code || ''} className="tag tag-bin" title="Click to copy To Bin" />
                          </span>
                        )}
                        {m.movement_type === 'ADJUSTMENT' && (
                          <span>
                            {m.to_location_id ? (
                              <>
                                + <ClickToCopy text={toLoc?.bin_code || `Bin ${m.to_location_id}`} className="tag tag-bin" title="Click to copy Bin Code" />
                              </>
                            ) : (
                              <>
                                - <ClickToCopy text={fromLoc?.bin_code || `Bin ${m.from_location_id}`} className="tag tag-bin" title="Click to copy Bin Code" />
                              </>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="text-right mono" style={{ fontWeight: 600 }}>
                        {m.movement_type === 'OUT' || (m.movement_type === 'ADJUSTMENT' && m.from_location_id) ? '-' : '+'}
                        {formatQuantity(m.quantity, rowProduct?.unit)}
                      </td>
                      <td className="text-right mono">
                        {formatCurrencyINR(m.unit_cost)}
                      </td>
                      <td className="text-right mono" style={{ fontWeight: 600 }}>
                        {formatQuantity(runningTotal.toString(), rowProduct?.unit)}
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        <div>{m.reference || '—'}</div>
                        {m.reason && <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{m.reason}</div>}
                      </td>
                      <td className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {m.created_by}
                      </td>
                      <td className="text-center">
                        {m.is_reversed ? (
                          <span className="tag tag-reversed">REVERSED</span>
                        ) : m.reverses_movement_id ? (
                          <span className="tag" title={`Compensating reversal of movement #${m.reverses_movement_id}`}>
                            REV #{m.reverses_movement_id}
                          </span>
                        ) : (
                          <button
                            className="btn"
                            style={{ height: '26px', padding: '0 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => {
                              setReversingMovement(m);
                              setModalError(null);
                            }}
                          >
                            Reverse
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && (
          <>
            <Pagination
              currentPage={safePage}
              totalItems={totalLedgerRecords}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[25, 50, 100, -1]}
            />
            <div className="card-footer">
              <span>
                Showing {totalLedgerRecords === 0 ? 0 : pageSize === -1 ? `all ${totalLedgerRecords}` : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, totalLedgerRecords)} of ${totalLedgerRecords}`} transactions
                {(startDate || endDate) && ` • Filtered by date: ${startDate || 'earliest'} to ${endDate || 'latest'}`}
              </span>
              <span>
                {selectedProduct ? (
                  <>
                    Current On-Hand Balance:{' '}
                    <strong>
                      {formatQuantity(
                        (runningBalanceMap.get(sortedChronological[sortedChronological.length - 1]?.id) ?? 0).toString(),
                        selectedProduct?.unit
                      )}
                    </strong>
                  </>
                ) : (
                  <span>Viewing warehouse-wide chronological ledger</span>
                )}
              </span>
            </div>
          </>
        )}
      </div>


      {/* Reversal Confirmation Modal */}
      {reversingMovement && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h4>Reverse Movement #{reversingMovement.id}</h4>
              <button
                className="btn"
                style={{ height: '28px', padding: '0 0.5rem' }}
                onClick={() => setReversingMovement(null)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleExecuteReversal}>
              <div className="modal-body">
                {modalError && (
                  <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                    {modalError}
                  </div>
                )}
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  This will create an exact compensating{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>reversal movement</strong>. The original transaction
                  will remain immutable and marked as reversed.
                </p>

                <div className="form-group">
                  <label className="form-label">Reversal Reason / Explanation</label>
                  <input
                    type="text"
                    className="input-text"
                    style={{ width: '100%' }}
                    placeholder="e.g. Erroneous entry, order cancelled"
                    value={reversalReason}
                    onChange={(e) => setReversalReason(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Operator / Manager (Optional)</label>
                  <input
                    type="text"
                    className="input-text"
                    style={{ width: '100%' }}
                    placeholder="Defaults to warehouse_staff"
                    value={reversalOperator}
                    onChange={(e) => setReversalOperator(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setReversingMovement(null)}
                  disabled={submittingReversal}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger" disabled={submittingReversal}>
                  {submittingReversal ? 'Posting Reversal...' : 'Confirm Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
