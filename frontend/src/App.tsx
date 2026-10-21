import { useState, useEffect } from 'react';
import { api } from './services/api';
import { StockOverview } from './components/StockOverview';
import { RecordMovement } from './components/RecordMovement';
import { LedgerHistory } from './components/LedgerHistory';
import { ReportsAudit } from './components/ReportsAudit';
import './index.css';

export type NavTab = 'grid' | 'movement' | 'ledger' | 'reports';

const VALID_TABS: NavTab[] = ['grid', 'movement', 'ledger', 'reports'];

const getInitialTab = (): NavTab => {
  const hash = window.location.hash.replace('#', '') as NavTab;
  if (VALID_TABS.includes(hash)) return hash;

  const saved = localStorage.getItem('active_tab') as NavTab;
  if (VALID_TABS.includes(saved)) return saved;

  return 'grid';
};

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>(getInitialTab);
  const [ledgerProductId, setLedgerProductId] = useState<number | undefined>(undefined);
  const [movementProductId, setMovementProductId] = useState<number | undefined>(undefined);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  const handleTabChange = (tab: NavTab) => {
    if (tab === 'ledger') {
      setLedgerProductId(undefined);
    }
    setActiveTab(tab);
    window.location.hash = tab;
    localStorage.setItem('active_tab', tab);
  };

  useEffect(() => {
    // Ensure URL hash matches initial tab
    if (!window.location.hash || !VALID_TABS.includes(window.location.hash.replace('#', '') as NavTab)) {
      window.location.hash = activeTab;
    }

    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '') as NavTab;
      if (VALID_TABS.includes(hash)) {
        setActiveTab(hash);
        localStorage.setItem('active_tab', hash);
      }
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        await api.checkHealth();
        setIsOnline(true);
      } catch {
        // Fallback: If /health is blocked by client-side adblockers (e.g. Brave Shields),
        try {
          await api.getLocations();
          setIsOnline(true);
        } catch {
          setIsOnline(false);
        }
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
            onClick={() => handleTabChange('grid')}
          >
            Stock Overview
          </button>
          <button
            className={`nav-link ${activeTab === 'movement' ? 'active' : ''}`}
            onClick={() => handleTabChange('movement')}
          >
            Record Movement
          </button>
          <button
            className={`nav-link ${activeTab === 'ledger' ? 'active' : ''}`}
            onClick={() => handleTabChange('ledger')}
          >
            Ledger History
          </button>
          <button
            className={`nav-link ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => handleTabChange('reports')}
          >
            Reports
          </button>
        </nav>

        <div className="navbar-status">
          <span className={`status-dot ${isOnline ? 'online' : isOnline === false ? 'offline' : ''}`} />
          <span>{isOnline ? 'API Connected' : isOnline === false ? 'Offline' : 'Connecting...'}</span>
        </div>
      </header>

      {/* Offline warning banner — shown prominently when API unreachable */}
      {isOnline === false && (
        <div className="offline-banner" role="alert">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <strong>Backend API is unreachable.</strong>&nbsp;Check that the FastAPI server is running on port 8000. Changes cannot be saved while offline.
        </div>
      )}

      {/* Main Content Area */}
      <main className="container">
        {activeTab === 'grid' && (
          <StockOverview
            onSelectProduct={(id) => {
              setLedgerProductId(id);
              setActiveTab('ledger');
              window.location.hash = 'ledger';
              localStorage.setItem('active_tab', 'ledger');
            }}
          />
        )}

        {activeTab === 'movement' && (
          <RecordMovement
            initialProductId={movementProductId}
            initialType="IN"
            onViewLedger={(id) => {
              setLedgerProductId(id);
              setActiveTab('ledger');
              window.location.hash = 'ledger';
              localStorage.setItem('active_tab', 'ledger');
            }}
          />
        )}

        {activeTab === 'ledger' && <LedgerHistory initialProductId={ledgerProductId} />}

        {activeTab === 'reports' && (
          <ReportsAudit
            onRestockProduct={(id) => {
              setMovementProductId(id);
              handleTabChange('movement');
            }}
          />
        )}
      </main>
    </div>
  );
}

export default App;
