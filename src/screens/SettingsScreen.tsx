import { useState, useEffect } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { db } from '../db/schema';

export default function SettingsScreen() {
  const [storageUsed, setStorageUsed] = useState(0);
  const [syncCount, setSyncCount] = useState(0);

  const setScreen = useAppStore((s) => s.setScreen);
  const currentNurse = useAppStore((s) => s.currentNurse);
  const isOnline = useAppStore((s) => s.isOnline);
  const pendingSync = useAppStore((s) => s.pendingSyncCount);
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const handoffs = await db.handoffs.count();
    const patients = await db.patients.count();
    const queue = await db.syncQueue.count();

    setStorageUsed(handoffs + patients + queue);
    setSyncCount(queue);
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
        <button className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
          <span>🔄</span> Force Sync Now
        </button>
      </div>

      <div className="form-section glass">
        <div className="form-section-title">📱 Device</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Records stored</span>
          <span>{storageUsed}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Encryption</span>
          <span style={{ color: 'var(--success)', fontWeight: 700 }}>✅ AES-256-GCM Active</span>
        </div>
        <div className="divider" />
        <button className="btn btn-secondary" style={{ width: '100%', marginTop: '8px', color: 'var(--critical)' }} onClick={clearAllData}>
          Clear Local Data
        </button>
      </div>

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