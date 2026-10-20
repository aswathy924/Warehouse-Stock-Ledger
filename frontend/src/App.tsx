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

      {/* Main Content Area */}
      <main className="container">
        {activeTab === 'grid' && (
          <StockOverview
            onSelectProduct={(id) => {
              setLedgerProductId(id);
              handleTabChange('ledger');
            }}
          />
        )}

        {activeTab === 'movement' && (
          <RecordMovement
            initialProductId={movementProductId}
            initialType="IN"
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
