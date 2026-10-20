import { useState, useEffect } from 'react';
import { api } from './services/api';
import { StockOverview } from './components/StockOverview';
import './index.css';

export type NavTab = 'grid' | 'movement' | 'ledger' | 'reports';

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('grid');
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        await api.checkHealth();
        setIsOnline(true);
      } catch {
        setIsOnline(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      {/* Clean Top Navigation Bar */}
      <header className="navbar">
        <div className="navbar-brand">
          <span>Warehouse Stock Ledger</span>
        </div>

        <nav className="navbar-nav">
          <button
            className={`nav-link ${activeTab === 'grid' ? 'active' : ''}`}
            onClick={() => setActiveTab('grid')}
          >
            Stock Overview
          </button>
          <button
            className={`nav-link ${activeTab === 'movement' ? 'active' : ''}`}
            onClick={() => setActiveTab('movement')}
          >
            Record Movement
          </button>
          <button
            className={`nav-link ${activeTab === 'ledger' ? 'active' : ''}`}
            onClick={() => setActiveTab('ledger')}
          >
            Ledger History
          </button>
          <button
            className={`nav-link ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            Reports
          </button>
        </nav>

        <div className="navbar-status">
          <span className={`status-dot ${isOnline ? 'online' : isOnline === false ? 'offline' : ''}`} />
          <span>{isOnline ? 'API Connected' : isOnline === false ? 'Offline' : 'Connecting...'}</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container">
        {activeTab === 'grid' && <StockOverview />}

        {activeTab === 'movement' && (
          <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Record Movement
            </h2>
          </div>
        )}

        {activeTab === 'ledger' && (
          <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Ledger History
            </h2>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <h2 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Reports & Audit
            </h2>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
