import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { LowStockItem, ValuationReport, ReconcileResponse } from '../types';
import { formatCurrencyINR, formatQuantity } from '../utils/formatters';

interface ReportsAuditProps {
  onRestockProduct?: (productId: number) => void;
}

export const ReportsAudit: React.FC<ReportsAuditProps> = ({ onRestockProduct }) => {
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [valuation, setValuation] = useState<ValuationReport | null>(null);
  const [reconcileResult, setReconcileResult] = useState<ReconcileResponse | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [auditRunning, setAuditRunning] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [auditSuccessMsg, setAuditSuccessMsg] = useState<string | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [lowData, valData] = await Promise.all([
        api.getLowStockReport(),
        api.getValuationReport(),
      ]);
      setLowStock(lowData);
      setValuation(valData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load report analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleRunReconcile = async () => {
    setAuditRunning(true);
    setAuditSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await api.reconcileLedger();
      setReconcileResult(res);
      setAuditSuccessMsg(
        res.drift_detected
          ? 'Ledger drift detected. Please inspect the discrepancy table below.'
          : `Audit passed: All ${res.total_records_checked} product-bin records verified with zero drift.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Ledger audit verification failed');
    } finally {
      setAuditRunning(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const totalWarehouseVal = parseFloat(valuation?.total_warehouse_value || '0');

  return (
    <div>
      <div className="page-header">
        <div className="page-title">
          <h1>Reports & Audit</h1>
        </div>

        <div className="toolbar">
          <button className="btn" onClick={fetchReports} disabled={loading}>
            Refresh Reports
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {errorMsg}
        </div>
      )}

      {/* 1. Low Stock Alerts */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
          Low-Stock Reorder Alerts
        </h2>

        <div className="card">
          {loading ? (
            <div className="empty-state">Checking stock thresholds...</div>
          ) : lowStock.length === 0 ? (
            <div className="empty-state">
              All inventory items are currently above their configured reorder thresholds.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product Name</th>
                    <th className="text-right">Current Stock</th>
                    <th className="text-right">Reorder Threshold</th>
                    <th className="text-right">Deficit</th>
                    {onRestockProduct && <th className="text-center">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((item) => {
                    const current = parseFloat(item.current_stock);
                    const deficit = Math.max(0, item.reorder_level - current);

                    return (
                      <tr key={item.product_id}>
                        <td>
                          <span className="tag">{item.sku}</span>
                        </td>
                        <td style={{ fontWeight: 500 }}>{item.name}</td>
                        <td className="text-right mono" style={{ color: 'var(--danger)', fontWeight: 600 }}>
                          {formatQuantity(item.current_stock, item.unit)}
                        </td>
                        <td className="text-right mono">
                          {item.reorder_level} {item.unit}
                        </td>
                        <td className="text-right mono" style={{ color: 'var(--danger)', fontWeight: 600 }}>
                          -{deficit} {item.unit}
                        </td>
                        {onRestockProduct && (
                          <td className="text-center">
                            <button
                              className="btn btn-primary"
                              style={{ height: '28px', padding: '0 0.6rem', fontSize: '0.75rem' }}
                              onClick={() => onRestockProduct(item.product_id)}
                            >
                              + Restock
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 2. Inventory Valuation Register (WAC) */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Inventory Valuation Register (WAC)
          </h2>
          {valuation && (
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Total Warehouse Value: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrencyINR(valuation.total_warehouse_value)}</strong>
            </span>
          )}
        </div>

        <div className="card">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product Name</th>
                  <th className="text-right">Total Quantity</th>
                  <th className="text-right">Weighted Avg Cost (WAC)</th>
                  <th className="text-right">Total Value</th>
                  <th className="text-right">Share of Portfolio</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      Calculating valuation register...
                    </td>
                  </tr>
                ) : !valuation || valuation.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      No valuation data available. Record stock receipts to establish cost basis.
                    </td>
                  </tr>
                ) : (
                  valuation.items.map((item) => {
                    const itemValue = parseFloat(item.total_value || '0');
                    const sharePct = totalWarehouseVal > 0 ? (itemValue / totalWarehouseVal) * 100 : 0;

                    return (
                      <tr key={item.product_id}>
                        <td>
                          <span className="tag">{item.sku}</span>
                        </td>
                        <td style={{ fontWeight: 500 }}>{item.name}</td>
                        <td className="text-right mono" style={{ fontWeight: 600 }}>
                          {formatQuantity(item.total_quantity, item.unit)}
                        </td>
                        <td className="text-right mono">
                          {formatCurrencyINR(item.average_cost)}
                        </td>
                        <td className="text-right mono" style={{ fontWeight: 600 }}>
                          {formatCurrencyINR(item.total_value)}
                        </td>
                        <td className="text-right mono" style={{ color: 'var(--text-secondary)' }}>
                          {sharePct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {!loading && valuation && valuation.items.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={2}>Total ({valuation.items.length} products)</td>
                    <td className="text-right mono">
                      {valuation.items
                        .reduce((sum, i) => sum + parseFloat(i.total_quantity || '0'), 0)
                        .toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                    </td>
                    <td className="text-right">—</td>
                    <td className="text-right mono">
                      {formatCurrencyINR(valuation.total_warehouse_value)}
                    </td>
                    <td className="text-right mono">100.0%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* 3. Ledger Reconciliation & Drift Audit */}
      <div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
          Ledger Integrity & Reconciliation Audit
        </h2>

        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                Ledger Drift Detection
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Verifies that derived inventory balances across all storage bins strictly match chronological transaction sums.
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleRunReconcile}
              disabled={auditRunning}
            >
              {auditRunning ? 'Running Audit...' : 'Run Audit Check'}
            </button>
          </div>

          {auditSuccessMsg && (
            <div
              className={`alert ${reconcileResult?.drift_detected ? 'alert-error' : 'alert-success'}`}
              style={{ marginBottom: '1rem' }}
            >
              {auditSuccessMsg}
            </div>
          )}

          {reconcileResult && reconcileResult.drifts && reconcileResult.drifts.length > 0 && (
            <div className="table-responsive" style={{ marginTop: '1rem' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Bin Location</th>
                    <th className="text-right">Expected Balance</th>
                    <th className="text-right">Actual Balance</th>
                    <th className="text-right">Drift</th>
                  </tr>
                </thead>
                <tbody>
                  {reconcileResult.drifts.map((d, i) => (
                    <tr key={i}>
                      <td>
                        <span className="tag">{d.sku}</span>
                      </td>
                      <td>
                        <span className="tag tag-bin">{d.bin_code}</span>
                      </td>
                      <td className="text-right mono">{d.expected_balance}</td>
                      <td className="text-right mono">{d.actual_balance}</td>
                      <td className="text-right mono" style={{ color: 'var(--danger)', fontWeight: 600 }}>
                        {d.drift}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
