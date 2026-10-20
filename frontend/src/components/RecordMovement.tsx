import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type {
  Product,
  Location,
  MovementType,
  AdjustmentReason,
} from '../types';
import { formatQuantity } from '../utils/formatters';

interface RecordMovementProps {
  onSuccess: () => void;
  initialProductId?: number;
  initialType?: MovementType;
}

export const RecordMovement: React.FC<RecordMovementProps> = ({
  onSuccess,
  initialProductId,
  initialType,
}) => {
  const [movementType, setMovementType] = useState<MovementType>(initialType || 'IN');
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Form states
  const [productId, setProductId] = useState<number>(initialProductId || 0);
  const [fromLocationId, setFromLocationId] = useState<number>(0);
  const [toLocationId, setToLocationId] = useState<number>(0);
  const [locationId, setLocationId] = useState<number>(0);
  const [quantity, setQuantity] = useState<string>('');
  const [unitCost, setUnitCost] = useState<string>('');
  const [reason, setReason] = useState<AdjustmentReason>('damaged');
  const [reference, setReference] = useState<string>('');
  const [createdBy, setCreatedBy] = useState<string>('operator_1');

  // Available balance indicator
  const [availableStock, setAvailableStock] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialType) setMovementType(initialType);
    if (initialProductId) setProductId(initialProductId);
  }, [initialType, initialProductId]);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [prods, locs] = await Promise.all([api.getProducts(), api.getLocations()]);
        setProducts(prods);
        setLocations(locs);
        if (prods.length > 0 && !initialProductId) setProductId(prods[0].id);
        if (locs.length > 0) {
          setToLocationId(locs[0].id);
          setFromLocationId(locs[0].id);
          setLocationId(locs[0].id);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load master metadata');
      }
    };
    loadMetadata();
  }, []);

  // Fetch available balance when product or fromLocation changes
  useEffect(() => {
    const checkBalance = async () => {
      const loc = movementType === 'ADJUSTMENT' ? locationId : fromLocationId;
      if (productId > 0 && loc > 0 && (movementType === 'OUT' || movementType === 'TRANSFER' || movementType === 'ADJUSTMENT')) {
        try {
          const res = await api.getBalance(productId, loc);
          setAvailableStock(res.quantity);
        } catch {
          setAvailableStock(null);
        }
      } else {
        setAvailableStock(null);
      }
    };
    checkBalance();
  }, [productId, fromLocationId, locationId, movementType]);

  const selectedProduct = products.find((p) => p.id === productId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const parsedQty = parseFloat(quantity);
    if (isNaN(parsedQty) || parsedQty === 0) {
      setErrorMsg('Quantity must be a valid non-zero number');
      return;
    }

    if (movementType !== 'ADJUSTMENT' && parsedQty <= 0) {
      setErrorMsg('Quantity must be greater than zero');
      return;
    }

    if (movementType === 'TRANSFER' && fromLocationId === toLocationId) {
      setErrorMsg('Source and destination locations cannot be identical');
      return;
    }

    if (movementType === 'ADJUSTMENT' && reason === 'other-with-note' && !reference.trim()) {
      setErrorMsg('A reference note is required when reason is "other-with-note"');
      return;
    }

    setSubmitting(true);
    try {
      let createdMovement;
      if (movementType === 'IN') {
        createdMovement = await api.stockIn({
          product_id: productId,
          to_location_id: toLocationId,
          quantity: parsedQty,
          unit_cost: parseFloat(unitCost) || 0,
          reference: reference.trim() || undefined,
          created_by: createdBy.trim() || 'operator',
        });
      } else if (movementType === 'OUT') {
        createdMovement = await api.stockOut({
          product_id: productId,
          from_location_id: fromLocationId,
          quantity: parsedQty,
          reference: reference.trim() || undefined,
          created_by: createdBy.trim() || 'operator',
        });
      } else if (movementType === 'TRANSFER') {
        createdMovement = await api.stockTransfer({
          product_id: productId,
          from_location_id: fromLocationId,
          to_location_id: toLocationId,
          quantity: parsedQty,
          reference: reference.trim() || undefined,
          created_by: createdBy.trim() || 'operator',
        });
      } else if (movementType === 'ADJUSTMENT') {
        createdMovement = await api.stockAdjust({
          product_id: productId,
          location_id: locationId,
          quantity: parsedQty,
          reason,
          reference: reference.trim() || undefined,
          created_by: createdBy.trim() || 'operator',
        });
      }

      setSuccessMsg(
        `Movement #${createdMovement?.id} recorded successfully (${createdMovement?.movement_type}: ${formatQuantity(
          createdMovement?.quantity,
          selectedProduct?.unit
        )})`
      );
      setQuantity('');
      setReference('');
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Transaction rejected by ledger rules');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto' }}>
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <h3>Record Inventory Movement</h3>
            <p>Append-only ledger transaction with real-time balance validation</p>
          </div>
        </div>

        {/* Movement Type Tabs */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '0.5rem' }}>
          {(['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT'] as MovementType[]).map((type) => {
            const isActive = movementType === type;
            let activeClass = 'chip-in';
            if (type === 'OUT') activeClass = 'chip-out';
            if (type === 'TRANSFER') activeClass = 'chip-transfer';
            if (type === 'ADJUSTMENT') activeClass = 'chip-adjust';

            return (
              <button
                key={type}
                type="button"
                className={`btn ${isActive ? 'btn-primary' : 'btn-outline'}`}
                style={{ flex: 1, padding: '0.65rem' }}
                onClick={() => {
                  setMovementType(type);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
              >
                <span className={`chip ${activeClass}`} style={{ marginRight: '0.25rem' }}>
                  {type}
                </span>
                <span>
                  {type === 'IN' && 'Receipt / Purchase'}
                  {type === 'OUT' && 'Dispatch / Order'}
                  {type === 'TRANSFER' && 'Bin Relocation'}
                  {type === 'ADJUSTMENT' && 'Stock Audit'}
                </span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {errorMsg && (
            <div className="alert-banner alert-error">
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="alert-banner alert-success">
              <span>{successMsg}</span>
            </div>
          )}

          {/* Product Select */}
          <div className="form-group">
            <label className="form-label">Catalog Product</label>
            <select
              className="input-field"
              style={{ width: '100%' }}
              value={productId}
              onChange={(e) => setProductId(Number(e.target.value))}
              required
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.sku}] {p.name} ({p.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Location Selectors depending on Type */}
          {movementType === 'IN' && (
            <div className="form-group">
              <label className="form-label">Destination Storage Bin</label>
              <select
                className="input-field"
                style={{ width: '100%' }}
                value={toLocationId}
                onChange={(e) => setToLocationId(Number(e.target.value))}
                required
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    [{loc.bin_code}] {loc.description}
                  </option>
                ))}
              </select>
            </div>
          )}

          {movementType === 'OUT' && (
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>
                  Source Storage Bin
                </label>
                {availableStock !== null && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Available in bin:{' '}
                    <strong className="mono" style={{ color: 'var(--text-main)' }}>
                      {formatQuantity(availableStock, selectedProduct?.unit)}
                    </strong>
                  </span>
                )}
              </div>
              <select
                className="input-field"
                style={{ width: '100%' }}
                value={fromLocationId}
                onChange={(e) => setFromLocationId(Number(e.target.value))}
                required
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    [{loc.bin_code}] {loc.description}
                  </option>
                ))}
              </select>
            </div>
          )}

          {movementType === 'TRANSFER' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    From Bin
                  </label>
                  {availableStock !== null && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Available:{' '}
                      <strong className="mono" style={{ color: 'var(--text-main)' }}>
                        {formatQuantity(availableStock, selectedProduct?.unit)}
                      </strong>
                    </span>
                  )}
                </div>
                <select
                  className="input-field"
                  style={{ width: '100%' }}
                  value={fromLocationId}
                  onChange={(e) => setFromLocationId(Number(e.target.value))}
                  required
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      [{loc.bin_code}] {loc.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">To Bin</label>
                <select
                  className="input-field"
                  style={{ width: '100%' }}
                  value={toLocationId}
                  onChange={(e) => setToLocationId(Number(e.target.value))}
                  required
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      [{loc.bin_code}] {loc.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {movementType === 'ADJUSTMENT' && (
            <>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    Storage Bin
                  </label>
                  {availableStock !== null && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Current Bin Stock:{' '}
                      <strong className="mono" style={{ color: 'var(--text-main)' }}>
                        {formatQuantity(availableStock, selectedProduct?.unit)}
                      </strong>
                    </span>
                  )}
                </div>
                <select
                  className="input-field"
                  style={{ width: '100%' }}
                  value={locationId}
                  onChange={(e) => setLocationId(Number(e.target.value))}
                  required
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      [{loc.bin_code}] {loc.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Reason Code (Mandatory)</label>
                <select
                  className="input-field"
                  style={{ width: '100%' }}
                  value={reason}
                  onChange={(e) => setReason(e.target.value as AdjustmentReason)}
                  required
                >
                  <option value="damaged">damaged (Loss due to damaged inventory)</option>
                  <option value="expired">expired (Loss due to shelf expiry)</option>
                  <option value="count correction">count correction (Physical count delta)</option>
                  <option value="theft">theft (Shrinkage / unexplainable loss)</option>
                  <option value="other-with-note">other-with-note (Custom reason, note mandatory)</option>
                </select>
              </div>
            </>
          )}

          {/* Quantity & Unit Cost */}
          <div style={{ display: 'grid', gridTemplateColumns: movementType === 'IN' ? '1fr 1fr' : '1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">
                Quantity ({selectedProduct?.unit || 'units'})
                {movementType === 'ADJUSTMENT' && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    (Use positive for stock found, negative for loss)
                  </span>
                )}
              </label>
              <input
                type="number"
                step="0.001"
                className="input-field mono"
                style={{ width: '100%' }}
                placeholder={movementType === 'ADJUSTMENT' ? '-2.000 or 5.000' : '10.000'}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            {movementType === 'IN' && (
              <div className="form-group">
                <label className="form-label">Unit Cost (INR ₹ / {selectedProduct?.unit})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input-field mono"
                  style={{ width: '100%' }}
                  placeholder="45.00"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          {/* Reference & Created By */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">
                Reference / Note {movementType === 'ADJUSTMENT' && reason === 'other-with-note' && <span style={{ color: 'var(--status-danger)' }}>*</span>}
              </label>
              <input
                type="text"
                className="input-field"
                style={{ width: '100%' }}
                placeholder="Invoice #, PO #, or reason explanation"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={100}
                required={movementType === 'ADJUSTMENT' && reason === 'other-with-note'}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Operator Signature</label>
              <input
                type="text"
                className="input-field mono"
                style={{ width: '100%' }}
                value={createdBy}
                onChange={(e) => setCreatedBy(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ padding: '0.65rem 1.5rem' }}>
              {submitting ? 'Recording in Ledger...' : 'Commit Movement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
