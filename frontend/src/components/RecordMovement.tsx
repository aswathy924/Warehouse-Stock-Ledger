import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type {
  Product,
  Location,
  MovementType,
  AdjustmentReason,
} from '../types';
import { formatQuantity } from '../utils/formatters';
import { IconInfo } from './Icons';

interface RecordMovementProps {
  onSuccess?: () => void;
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

  // Form inputs
  const [productId, setProductId] = useState<number>(initialProductId || 0);
  const [fromLocationId, setFromLocationId] = useState<number>(0);
  const [toLocationId, setToLocationId] = useState<number>(0);
  const [locationId, setLocationId] = useState<number>(0);
  const [quantity, setQuantity] = useState<string>('');
  const [unitCost, setUnitCost] = useState<string>('');
  const [reason, setReason] = useState<AdjustmentReason | ''>('');
  const [reference, setReference] = useState<string>('');
  const [createdBy, setCreatedBy] = useState<string>('');

  // Available stock balance
  const [availableStock, setAvailableStock] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState<boolean>(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load products and locations
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [prods, locs] = await Promise.all([api.getProducts(), api.getLocations()]);
        setProducts(prods);
        setLocations(locs);
        if (initialProductId) setProductId(initialProductId);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load master products and locations');
      }
    };
    loadMetadata();
  }, [initialProductId]);

  // Query live available balance whenever product or source location changes
  useEffect(() => {
    const checkBalance = async () => {
      const loc = movementType === 'ADJUSTMENT' ? locationId : fromLocationId;
      if (productId > 0 && loc > 0 && movementType !== 'IN') {
        setLoadingBalance(true);
        try {
          const res = await api.getBalance(productId, loc);
          setAvailableStock(res.quantity);
        } catch {
          setAvailableStock(null);
        } finally {
          setLoadingBalance(false);
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

    if (!productId) {
      setErrorMsg('Please select a product');
      return;
    }

    if (movementType === 'IN' && !toLocationId) {
      setErrorMsg('Please select a destination bin');
      return;
    }

    if (movementType === 'OUT' && !fromLocationId) {
      setErrorMsg('Please select a source bin');
      return;
    }

    if (movementType === 'TRANSFER') {
      if (!fromLocationId) {
        setErrorMsg('Please select a source bin');
        return;
      }
      if (!toLocationId) {
        setErrorMsg('Please select a destination bin');
        return;
      }
      if (fromLocationId === toLocationId) {
        setErrorMsg('Source location and destination location must be different');
        return;
      }
    }

    if (movementType === 'ADJUSTMENT') {
      if (!locationId) {
        setErrorMsg('Please select a storage location');
        return;
      }
      if (!reason) {
        setErrorMsg('Please select an adjustment reason');
        return;
      }
      if (reason === 'other-with-note' && !reference.trim()) {
        setErrorMsg('A reference note is required when reason code is "other-with-note"');
        return;
      }
    }

    const parsedQty = parseFloat(quantity);
    if (isNaN(parsedQty) || parsedQty === 0) {
      setErrorMsg('Quantity must be a valid non-zero number');
      return;
    }

    if (movementType !== 'ADJUSTMENT' && parsedQty <= 0) {
      setErrorMsg('Quantity must be greater than zero');
      return;
    }

    // Client-side quick check against known available stock
    if ((movementType === 'OUT' || movementType === 'TRANSFER') && availableStock !== null) {
      const currentAvail = parseFloat(availableStock);
      if (parsedQty > currentAvail) {
        setErrorMsg(
          `Insufficient stock: Cannot move ${parsedQty} units. Available balance is ${currentAvail} ${selectedProduct?.unit || ''}.`
        );
        return;
      }
    }

    setSubmitting(true);
    const operator = createdBy.trim() || 'warehouse_staff';
    try {
      let createdMovement;
      if (movementType === 'IN') {
        createdMovement = await api.stockIn({
          product_id: productId,
          to_location_id: toLocationId,
          quantity: parsedQty,
          unit_cost: parseFloat(unitCost) || 0,
          reference: reference.trim() || undefined,
          created_by: operator,
        });
      } else if (movementType === 'OUT') {
        createdMovement = await api.stockOut({
          product_id: productId,
          from_location_id: fromLocationId,
          quantity: parsedQty,
          reference: reference.trim() || undefined,
          created_by: operator,
        });
      } else if (movementType === 'TRANSFER') {
        createdMovement = await api.stockTransfer({
          product_id: productId,
          from_location_id: fromLocationId,
          to_location_id: toLocationId,
          quantity: parsedQty,
          reference: reference.trim() || undefined,
          created_by: operator,
        });
      } else if (movementType === 'ADJUSTMENT') {
        createdMovement = await api.stockAdjust({
          product_id: productId,
          location_id: locationId,
          quantity: parsedQty,
          reason: reason as AdjustmentReason,
          reference: reference.trim() || undefined,
          created_by: operator,
        });
      }

      setSuccessMsg(
        `Movement #${createdMovement?.id} successfully recorded (${createdMovement?.movement_type}: ${formatQuantity(
          createdMovement?.quantity,
          selectedProduct?.unit
        )})`
      );
      setProductId(0);
      setFromLocationId(0);
      setToLocationId(0);
      setLocationId(0);
      setQuantity('');
      setUnitCost('');
      setReason('');
      setReference('');
      setAvailableStock(null);

      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Movement rejected by inventory ledger rules');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTypeChange = (type: MovementType) => {
    setMovementType(type);
    setProductId(0);
    setFromLocationId(0);
    setToLocationId(0);
    setLocationId(0);
    setQuantity('');
    setUnitCost('');
    setReason('');
    setReference('');
    setAvailableStock(null);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div className="page-title">
          <h1>Record Movement</h1>
        </div>
      </div>

      <div className="card">
        {/* Operation Type Switcher */}
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.5rem', backgroundColor: '#f8fafc' }}>
          {(['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT'] as MovementType[]).map((type) => {
            const isActive = movementType === type;
            return (
              <button
                key={type}
                type="button"
                className={`btn ${isActive ? 'btn-primary' : ''}`}
                style={{ flex: 1, height: '34px', fontSize: '0.8rem', justifyContent: 'center' }}
                onClick={() => handleTypeChange(type)}
              >
                {type === 'IN' && 'Stock IN'}
                {type === 'OUT' && 'Stock OUT'}
                {type === 'TRANSFER' && 'TRANSFER'}
                {type === 'ADJUSTMENT' && 'ADJUSTMENT'}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {errorMsg && <div className="alert alert-error">{errorMsg}</div>}
          {successMsg && <div className="alert alert-success">{successMsg}</div>}

          {/* Product Selector */}
          <div className="form-group">
            <label className="form-label">Product</label>
            <select
              className="select-input"
              style={{ width: '100%' }}
              value={productId || ''}
              onChange={(e) => setProductId(Number(e.target.value))}
              required
            >
              <option value="">Select Product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.sku}] {p.name} ({p.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Locations according to movement type */}
          {movementType === 'IN' && (
            <div className="form-group">
              <label className="form-label">Destination Bin (To Location)</label>
              <select
                className="select-input"
                style={{ width: '100%' }}
                value={toLocationId || ''}
                onChange={(e) => setToLocationId(Number(e.target.value))}
                required
              >
                <option value=""> Select Destination Bin </option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.bin_code} — {loc.description}
                  </option>
                ))}
              </select>
            </div>
          )}

          {movementType === 'OUT' && (
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Source Bin (From Location)</label>
                {availableStock !== null && (
                  <span className="badge-balance">
                    On-Hand: {loadingBalance ? '...' : `${formatQuantity(availableStock, selectedProduct?.unit)}`}
                  </span>
                )}
              </div>
              <select
                className="select-input"
                style={{ width: '100%' }}
                value={fromLocationId || ''}
                onChange={(e) => setFromLocationId(Number(e.target.value))}
                required
              >
                <option value=""> Select Source Bin </option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.bin_code} — {loc.description}
                  </option>
                ))}
              </select>
            </div>
          )}

          {movementType === 'TRANSFER' && (
            <div className="form-row">
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Source Bin (From)</label>
                  {availableStock !== null && (
                    <span className="badge-balance">
                      Available: {loadingBalance ? '...' : `${formatQuantity(availableStock, selectedProduct?.unit)}`}
                    </span>
                  )}
                </div>
                <select
                  className="select-input"
                  style={{ width: '100%' }}
                  value={fromLocationId || ''}
                  onChange={(e) => setFromLocationId(Number(e.target.value))}
                  required
                >
                  <option value=""> Select Source Bin </option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.bin_code} ({loc.description})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Destination Bin (To)</label>
                <select
                  className="select-input"
                  style={{ width: '100%' }}
                  value={toLocationId || ''}
                  onChange={(e) => setToLocationId(Number(e.target.value))}
                  required
                >
                  <option value=""> Select Destination Bin </option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.bin_code} ({loc.description})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {movementType === 'ADJUSTMENT' && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Storage Location</label>
                    {availableStock !== null && (
                      <span className="badge-balance">
                        Current: {loadingBalance ? '...' : `${formatQuantity(availableStock, selectedProduct?.unit)}`}
                      </span>
                    )}
                  </div>
                  <select
                    className="select-input"
                    style={{ width: '100%' }}
                    value={locationId || ''}
                    onChange={(e) => setLocationId(Number(e.target.value))}
                    required
                  >
                    <option value=""> Select Storage Location </option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.bin_code} — {loc.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Adjustment Reason</label>
                  <select
                    className="select-input"
                    style={{ width: '100%' }}
                    value={reason}
                    onChange={(e) => setReason(e.target.value as AdjustmentReason)}
                    required
                  >
                    <option value=""> Select Adjustment Reason </option>
                    <option value="damaged">Damaged Goods</option>
                    <option value="expired">Expired Goods</option>
                    <option value="count correction">Count Correction</option>
                    <option value="theft">Theft / Shrinkage</option>
                    <option value="other-with-note">Other (Requires Note)</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Quantity & Unit Cost */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                Quantity {selectedProduct ? `(${selectedProduct.unit})` : ''}
                {movementType === 'ADJUSTMENT' && (
                  <span
                    className="info-icon"
                    title="Enter positive numbers (e.g. +5) to increase stock, or negative numbers (e.g. -2) to decrease stock."
                  >
                    <IconInfo size={13} />
                  </span>
                )}
              </label>
              <input
                type="number"
                step="0.001"
                className="input-text"
                style={{ width: '100%' }}
                placeholder={movementType === 'ADJUSTMENT' ? 'e.g. +5 or -2' : 'e.g. 10'}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            {movementType === 'IN' && (
              <div className="form-group">
                <label className="form-label">
                  Purchase Unit Cost (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input-text"
                  style={{ width: '100%' }}
                  placeholder="e.g. 150.00"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          {/* Reference & Operator */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                Reference / Doc #
                {movementType === 'ADJUSTMENT' && reason === 'other-with-note' && (
                  <span style={{ color: 'var(--danger)', marginLeft: '0.2rem' }}>*</span>
                )}
                <span
                  className="info-icon"
                  title="External document identifier such as Purchase Order (PO), Vendor Invoice, Delivery Challan, or Incident Sheet."
                >
                  <IconInfo size={13} />
                </span>
              </label>
              <input
                type="text"
                className="input-text"
                style={{ width: '100%' }}
                placeholder="e.g. PO-88392, INV-1002"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                required={movementType === 'ADJUSTMENT' && reason === 'other-with-note'}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Operator / Logged By
                <span
                  className="info-icon"
                  title="Name or employee ID for the ledger audit trail. Defaults to 'warehouse_staff' if left blank."
                >
                  <IconInfo size={13} />
                </span>
              </label>
              <input
                type="text"
                className="input-text"
                style={{ width: '100%' }}
                placeholder="Defaults to warehouse_staff"
                value={createdBy}
                onChange={(e) => setCreatedBy(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ minWidth: '160px', justifyContent: 'center' }}
            >
              {submitting
                ? 'Recording...'
                : movementType === 'IN'
                  ? 'Post Stock In'
                  : movementType === 'OUT'
                    ? 'Post Stock Out'
                    : movementType === 'TRANSFER'
                      ? 'Post Transfer'
                      : 'Post Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
