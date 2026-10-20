import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Product, Location, Movement } from '../types';
import { formatISTDateTime, formatCurrencyINR, formatQuantity } from '../utils/formatters';

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        if (initialProductId) {
          setSelectedProductId(initialProductId);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load master products');
      }
    };
    loadProductsAndLocations();
  }, [initialProductId]);

  const loadLedger = async () => {
    if (!selectedProductId) {
      setMovements([]);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const typeFilter = filterType === 'ALL' ? undefined : filterType;
      const data = await api.getMovements(selectedProductId, undefined, typeFilter);
      setMovements(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load product ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, [selectedProductId, filterType]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const locationMap = new Map<number, Location>();
  locations.forEach((l) => locationMap.set(l.id, l));

  // Compute running balance in chronological order (oldest to newest)
  const sortedChronological = [...movements].sort((a, b) => a.id - b.id);
  let cumulative = 0;
  const runningBalanceMap = new Map<number, number>();

  sortedChronological.forEach((m) => {
    const qty = parseFloat(m.quantity);
    if (m.movement_type === 'IN') {
      cumulative += qty;
    } else if (m.movement_type === 'OUT') {
      cumulative -= qty;
    } else if (m.movement_type === 'TRANSFER') {
      // Transfer within warehouse does not change overall aggregate balance
    } else if (m.movement_type === 'ADJUSTMENT') {
      if (m.to_location_id !== null) {
        cumulative += qty;
      } else if (m.from_location_id !== null) {
        cumulative -= qty;
      }
    }
    runningBalanceMap.set(m.id, cumulative);
  });

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
            value={selectedProductId || ''}
            onChange={(e) => setSelectedProductId(Number(e.target.value))}
            style={{ minWidth: '240px' }}
          >
            <option value=""> Select Product </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.sku}] {p.name}
              </option>
            ))}
          </select>

          <select
            className="select-input"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="ALL">All Movement Types</option>
            <option value="IN">IN (Receipts)</option>
            <option value="OUT">OUT (Dispatches)</option>
            <option value="TRANSFER">TRANSFER (Relocations)</option>
            <option value="ADJUSTMENT">ADJUSTMENT (Audits)</option>
          </select>

          <button className="btn" onClick={loadLedger} disabled={loading || !selectedProductId}>
            Refresh
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {errorMsg}
        </div>
      )}

      {!selectedProductId ? (
        <div className="card empty-state">
          Please select a product from the dropdown above to view its chronological ledger.
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Timestamp (IST)</th>
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
                    <td colSpan={10} className="empty-state">
                      Loading product ledger...
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="empty-state">
                      No ledger entries recorded for this product yet.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => {
                    const runningTotal = runningBalanceMap.get(m.id) ?? 0;
                    const fromLoc = m.from_location_id ? locationMap.get(m.from_location_id) : null;
                    const toLoc = m.to_location_id ? locationMap.get(m.to_location_id) : null;

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
                        <td>
                          <span className={`tag ${typeTagClass}`}>{m.movement_type}</span>
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>
                          {m.movement_type === 'IN' && <span>→ {toLoc?.bin_code || `Bin ${m.to_location_id}`}</span>}
                          {m.movement_type === 'OUT' && <span>{fromLoc?.bin_code || `Bin ${m.from_location_id}`} →</span>}
                          {m.movement_type === 'TRANSFER' && (
                            <span>
                              {fromLoc?.bin_code} → {toLoc?.bin_code}
                            </span>
                          )}
                          {m.movement_type === 'ADJUSTMENT' && (
                            <span>
                              {m.to_location_id
                                ? `+ ${toLoc?.bin_code || `Bin ${m.to_location_id}`}`
                                : `- ${fromLoc?.bin_code || `Bin ${m.from_location_id}`}`}
                            </span>
                          )}
                        </td>
                        <td className="text-right mono" style={{ fontWeight: 600 }}>
                          {m.movement_type === 'OUT' || (m.movement_type === 'ADJUSTMENT' && m.from_location_id) ? '-' : '+'}
                          {formatQuantity(m.quantity, selectedProduct?.unit)}
                        </td>
                        <td className="text-right mono">
                          {formatCurrencyINR(m.unit_cost)}
                        </td>
                        <td className="text-right mono" style={{ fontWeight: 600 }}>
                          {formatQuantity(runningTotal.toString(), selectedProduct?.unit)}
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

          {!loading && movements.length > 0 && (
            <div className="card-footer">
              <span>{movements.length} ledger transactions recorded</span>
              <span>
                Current On-Hand Balance:{' '}
                <strong>
                  {formatQuantity(
                    (runningBalanceMap.get(sortedChronological[sortedChronological.length - 1]?.id) ?? 0).toString(),
                    selectedProduct?.unit
                  )}
                </strong>
              </span>
            </div>
          )}
        </div>
      )}

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
