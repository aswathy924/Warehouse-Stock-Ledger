import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { LowStockItem, ValuationReport, ReconcileResponse } from '../types';
import { formatCurrencyINR, formatQuantity } from '../utils/formatters';
import {
  IconRefresh,
  IconShieldCheck,
  IconAlertTriangle,
  IconTrendingUp,
  IconActivity,
} from './Icons';

interface ReportsAuditProps {
  onRestockProduct: (productId: number) => void;
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
          ? 'Audit complete: Ledger drift detected! Review discrepancies below.'
          : `Audit complete: All ${res.total_records_checked} product-bin balances verified with zero drift.`
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
      {/* KPI Deck */}
      <div className="kpi-deck">
        <div className="kpi-card">
          <span className="label">Total Asset Valuation</span>
          <span className="value mono">{formatCurrencyINR(valuation?.total_warehouse_value || '0')}</span>
          <span className="subtext">Weighted-average cost (WAC) basis</span>
        </div>
        <div className="kpi-card" style={lowStock.length > 0 ? { borderColor: 'var(--status-adjust-border)' } : {}}>
          <span className="label" style={lowStock.length > 0 ? { color: 'var(--status-adjust)' } : {}}>
            Reorder Level Deficits
          </span>
          <span className="value mono" style={lowStock.length > 0 ? { color: 'var(--status-adjust)' } : {}}>
            {lowStock.length}
          </span>
          <span className="subtext">SKUs needing immediate PO placement</span>
        </div>
        <div className="kpi-card">
          <span className="label">Audit Integrity State</span>
          <span className="value" style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--status-in)' }}>
            <IconShieldCheck size={20} />
            <span>Immutable</span>
          </span>
          <span className="subtext">Strict append-only event sourcing</span>
        </div>
        <div className="kpi-card">
          <span className="label">Valued SKU Count</span>
          <span className="value mono">{valuation?.items.length || 0}</span>
          <span className="subtext">Active items in valuation register</span>
        </div>
      </div>

      {errorMsg && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="alert-banner alert-error">
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {auditSuccessMsg && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div className={`alert-banner ${reconcileResult?.drift_detected ? 'alert-warning' : 'alert-success'}`}>
            <span>{auditSuccessMsg}</span>
          </div>
        </div>
      )}

      {/* Grid of Sections: Reorder Alerts + Ledger Integrity Audit */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem', marginBottom: '1.75rem' }}>
        
        {/* Reorder Alerts Card */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <IconAlertTriangle size={18} style={{ color: 'var(--status-adjust)' }} />
                <h3>Low-Stock Reorder Queue</h3>
              </div>
              <p>Products where aggregate warehouse balance is ≤ threshold</p>
            </div>
            <button className="btn btn-outline" onClick={fetchReports} disabled={loading}>
              <IconRefresh size={14} />
            </button>
          </div>

          <div className="panel-body">
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Checking reorder levels...
              </div>
            ) : lowStock.length === 0 ? (
              <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <IconShieldCheck size={32} style={{ color: 'var(--status-in)', margin: '0 auto 0.75rem auto', display: 'block' }} />
                <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                  Healthy Inventory Levels
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  All stocked SKUs are currently operating above their configured reorder thresholds.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {lowStock.map((item) => {
                  const current = parseFloat(item.current_stock);
                  const deficit = Math.max(0, item.reorder_level - current);

                  return (
                    <div
                      key={item.product_id}
                      style={{
                        padding: '0.875rem 1rem',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span className="chip chip-normal mono">{item.sku}</span>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Available: <strong className="mono" style={{ color: 'var(--status-adjust)' }}>{formatQuantity(item.current_stock, item.unit)}</strong> | Reorder Threshold: <span className="mono">{item.reorder_level} {item.unit}</span>
                          {deficit > 0 && (
                            <span style={{ color: 'var(--status-danger)', marginLeft: '0.5rem' }}>
                              (Deficit: -{deficit} {item.unit})
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        className="btn btn-outline"
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                        onClick={() => onRestockProduct(item.product_id)}
                      >
                        + Restock
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Ledger Integrity & Drift Audit Panel */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <IconActivity size={18} style={{ color: 'var(--brand-blue)' }} />
                <h3>Ledger Integrity & Reconciliation Audit</h3>
              </div>
              <p>Verify that derived balances strictly match chronological movement sums</p>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleRunReconcile}
              disabled={auditRunning}
            >
              {auditRunning ? 'Auditing...' : 'Run Audit'}
            </button>
          </div>

          <div className="panel-body">
            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '6px', border: '1px solid var(--border-subtle)', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                In this event-sourced architecture, product balances in specific bin locations are derived purely from append-only ledger entries.
                Running this audit checks every product-bin pair across the entire database for unrecorded drift or negative balance violations.
              </div>
            </div>

            {reconcileResult && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.875rem 1rem',
                    borderRadius: '6px',
                    backgroundColor: reconcileResult.drift_detected ? 'var(--status-danger-bg)' : 'var(--status-in-bg)',
                    border: `1px solid ${reconcileResult.drift_detected ? 'var(--status-danger-border)' : 'var(--status-in-border)'}`,
                  }}
                >
                  {reconcileResult.drift_detected ? (
                    <IconAlertTriangle size={20} style={{ color: 'var(--status-danger)' }} />
                  ) : (
                    <IconShieldCheck size={20} style={{ color: 'var(--status-in)' }} />
                  )}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      {reconcileResult.drift_detected
                        ? 'Ledger Discrepancy Found'
                        : 'Audit Verified: 100% Ledger Consistency'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {reconcileResult.total_records_checked} product-location combinations verified against chronological transactions.
                    </div>
                  </div>
                </div>

                {reconcileResult.drifts && reconcileResult.drifts.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>SKU</th>
                            <th>Bin</th>
                            <th style={{ textAlign: 'right' }}>Expected</th>
                            <th style={{ textAlign: 'right' }}>Actual</th>
                            <th style={{ textAlign: 'right' }}>Drift</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reconcileResult.drifts.map((d, i) => (
                            <tr key={i}>
                              <td className="mono">{d.sku}</td>
                              <td className="mono">{d.bin_code}</td>
                              <td style={{ textAlign: 'right' }} className="mono">{d.expected_balance}</td>
                              <td style={{ textAlign: 'right' }} className="mono">{d.actual_balance}</td>
                              <td style={{ textAlign: 'right', color: 'var(--status-danger)' }} className="mono">{d.drift}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Product Valuation Register (WAC) */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <IconTrendingUp size={18} style={{ color: 'var(--brand-blue)' }} />
              <h3>Inventory Valuation Register (WAC)</h3>
            </div>
            <p>Weighted-Average Costing dynamically adjusted on every inward stock receipt</p>
          </div>
          <button className="btn btn-outline" onClick={fetchReports} disabled={loading}>
            <IconRefresh size={14} />
          </button>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product SKU</th>
                <th>Item Name</th>
                <th style={{ textAlign: 'right' }}>Aggregated Quantity</th>
                <th style={{ textAlign: 'right' }}>Weighted Avg Cost</th>
                <th style={{ textAlign: 'right' }}>Total Inventory Asset Value</th>
                <th style={{ textAlign: 'right' }}>Share of Capital</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    Calculating valuation register...
                  </td>
                </tr>
              ) : !valuation || valuation.items.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No valuation data available. Record stock receipts to establish weighted average unit costs.
                  </td>
                </tr>
              ) : (
                valuation.items.map((item) => {
                  const itemValue = parseFloat(item.total_value || '0');
                  const sharePct = totalWarehouseVal > 0 ? (itemValue / totalWarehouseVal) * 100 : 0;

                  return (
                    <tr key={item.product_id}>
                      <td>
                        <span className="chip chip-normal mono">{item.sku}</span>
                      </td>
                      <td className="font-medium">{item.name}</td>
                      <td style={{ textAlign: 'right' }} className="mono font-medium">
                        {formatQuantity(item.total_quantity, item.unit)}
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono">
                        {formatCurrencyINR(item.average_cost)}
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono font-medium">
                        {formatCurrencyINR(item.total_value)}
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono">
                        <span style={{ color: sharePct > 20 ? 'var(--brand-blue)' : 'var(--text-secondary)' }}>
                          {sharePct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {valuation && valuation.items.length > 0 && (
              <tfoot>
                <tr style={{ backgroundColor: 'var(--bg-surface-elevated)', fontWeight: 600 }}>
                  <td colSpan={2} style={{ padding: '1rem 1.25rem' }}>
                    Total Portfolio Valuation
                  </td>
                  <td style={{ textAlign: 'right', padding: '1rem 1.25rem' }} className="mono">
                    {valuation.items
                      .reduce((sum, i) => sum + parseFloat(i.total_quantity || '0'), 0)
                      .toLocaleString('en-IN', { maximumFractionDigits: 1 })}{' '}
                    units
                  </td>
                  <td style={{ textAlign: 'right', padding: '1rem 1.25rem', color: 'var(--text-muted)' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '1rem 1.25rem', color: 'var(--text-main)', fontSize: '1rem' }} className="mono">
                    {formatCurrencyINR(valuation.total_warehouse_value)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '1rem 1.25rem' }} className="mono">
                    100.0%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
