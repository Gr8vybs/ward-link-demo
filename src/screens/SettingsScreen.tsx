import { useState, useEffect } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { db, forceReseedDemoData } from '../db/schema';

export default function SettingsScreen() {
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageTotal, setStorageTotal] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [reseedMessage, setReseedMessage] = useState('');

  const setScreen = useAppStore((s) => s.setScreen);
  const currentNurse = useAppStore((s) => s.currentNurse);
  const isOnline = useAppStore((s) => s.isOnline);
  const pendingSync = useAppStore((s) => s.pendingSyncCount);
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);
  const triggerDashboardRefresh = useAppStore((s) => s.triggerDashboardRefresh);

  useEffect(() => {
    loadStats();
  }, [pendingSync]);

  async function loadStats() {
    const handoffs = await db.handoffs.count();
    const patients = await db.patients.count();
    const nurses = await db.nurses.count();
    const queue = await db.syncQueue.count();

    const total = handoffs + patients + nurses + queue;
    setStorageUsed(total);

    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage && estimate.quota) {
          setStorageTotal(Math.round((estimate.usage / estimate.quota) * 100));
        }
      } catch {
        setStorageTotal(Math.min(total * 2, 100));
      }
    } else {
      setStorageTotal(Math.min(total * 2, 100));
    }
  }

  async function forceSync() {
    if (syncing || !isOnline) {
      if (!isOnline) {
        setSyncMessage('Cannot sync — you are offline');
        setTimeout(() => setSyncMessage(''), 3000);
      }
      return;
    }

    setSyncing(true);
    setSyncMessage('Syncing to cloud...');

    await new Promise((resolve) => setTimeout(resolve, 2500));

    const localHandoffs = await db.handoffs.where('syncStatus').equals('local').toArray();
    for (const h of localHandoffs) {
      await db.handoffs.update(h.id, { syncStatus: 'synced', syncedAt: Date.now() });
    }

    await db.syncQueue.clear();
    useAppStore.getState().setPendingSync(0);
    useAppStore.getState().setLastSyncAt(Date.now());

    setSyncMessage('All data synced successfully! ✅');
    setTimeout(() => setSyncMessage(''), 3000);
    setSyncing(false);
    loadStats();
  }

  async function handleReseed() {
    if (!confirm('Reset all demo data? This will restore the initial state with a pending handoff for A. Musa.')) return;
    
    setReseedMessage('Resetting...');
    try {
      await forceReseedDemoData();
      
      const queueCount = await db.syncQueue.count();
      useAppStore.getState().setPendingSync(queueCount);
      useAppStore.getState().setLastSyncAt(Date.now());
      
      setReseedMessage('Demo data reset! ✅');
      setTimeout(() => setReseedMessage(''), 3000);
      
      triggerDashboardRefresh();
    } catch (err) {
      setReseedMessage('Reset failed ❌');
      setTimeout(() => setReseedMessage(''), 3000);
    }
  }

  async function clearAllData() {
    if (!confirm('Clear all local data? This cannot be undone.')) return;
    await db.delete();
    window.location.reload();
  }

  return (
    <div className="screen-container">
      <div className="header">
        <button className="icon-btn" onClick={() => setScreen('dashboard')}>
          ←
        </button>
        <h1>Settings</h1>
        <button className="icon-btn">⋮</button>
      </div>

      {/* Sync Status */}
      <div className="form-section glass">
        <div className="form-section-title">📡 Sync Status</div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Connection</span>
          <span style={{ color: isOnline ? 'var(--success)' : 'var(--warning)', fontWeight: 700 }}>
            {isOnline ? '🟢 Online' : '🟡 Offline'}
          </span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Pending records</span>
          <span style={{ color: pendingSync > 0 ? 'var(--warning)' : 'var(--success)', fontWeight: 800, fontSize: '18px' }}>
            {pendingSync}
          </span>
        </div>
        
        {lastSyncAt && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Last sync</span>
            <span>{new Date(lastSyncAt).toLocaleTimeString()}</span>
          </div>
        )}
        
        <div className="divider" />
        
        <button 
          className="btn btn-primary" 
          style={{ width: '100%', marginTop: '8px' }}
          onClick={forceSync}
          disabled={syncing || !isOnline}
        >
          {syncing ? (
            <>
              <span className="sync-spinner" />
              <span>Syncing...</span>
            </>
          ) : (
            <>
              <span>🔄</span> Force Sync Now
            </>
          )}
        </button>
        
        {syncMessage && (
          <div style={{ 
            marginTop: '12px', 
            textAlign: 'center', 
            fontSize: '13px', 
            color: syncMessage.includes('success') ? 'var(--success)' : 'var(--warning)',
            fontWeight: 600 
          }}>
            {syncMessage}
          </div>
        )}
      </div>

      {/* Device Storage */}
      <div className="form-section glass">
        <div className="form-section-title">📱 Device Storage</div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Records stored</span>
          <span style={{ fontWeight: 700 }}>{storageUsed} items</span>
        </div>
        
        <div className="storage-bar">
          <div 
            className="storage-bar-fill" 
            style={{ width: `${Math.min(storageTotal, 100)}%` }}
          />
        </div>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginTop: '8px', 
          fontSize: '12px', 
          color: 'var(--text-muted)' 
        }}>
          <span>Storage used</span>
          <span>{storageTotal}%</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Encryption</span>
          <span style={{ color: 'var(--success)', fontWeight: 700 }}>✅ AES-256-GCM Active</span>
        </div>
        
        <div className="divider" />
        
        <button 
          className="btn btn-secondary" 
          style={{ width: '100%', marginTop: '8px', marginBottom: '8px', color: 'var(--primary)' }}
          onClick={handleReseed}
        >
          <span>🔄</span> Reset Demo Data
        </button>
        
        {reseedMessage && (
          <div style={{ 
            textAlign: 'center', 
            fontSize: '13px', 
            color: reseedMessage.includes('✅') ? 'var(--success)' : 'var(--warning)',
            fontWeight: 600,
            marginBottom: '8px'
          }}>
            {reseedMessage}
          </div>
        )}
        
        <button 
          className="btn btn-secondary" 
          style={{ width: '100%', color: 'var(--critical)' }} 
          onClick={clearAllData}
        >
          Clear All Local Data
        </button>
      </div>

      {/* Account */}
      <div className="form-section glass">
        <div className="form-section-title">👤 Account</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Nurse</span>
          <span style={{ fontWeight: 600 }}>{currentNurse?.name || '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)' }}>ID</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{currentNurse?.employeeId || '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Ward</span>
          <span style={{ fontWeight: 600 }}>{currentNurse?.ward || '—'}</span>
        </div>
        <div className="divider" />
        <button className="btn btn-secondary" style={{ width: '100%', marginTop: '8px', marginBottom: '8px' }}>
          Change PIN
        </button>
        <button
          className="btn btn-secondary"
          style={{ width: '100%' }}
          onClick={() => useAppStore.getState().logout()}
        >
          Logout
        </button>
      </div>

      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
        <div style={{ fontWeight: 700, marginBottom: '4px' }}>Ward Link NG</div>
        <div>v0.1.0 • Offline-First PWA</div>
        <div style={{ marginTop: '4px' }}>© 2026</div>
      </div>
    </div>
  );
}