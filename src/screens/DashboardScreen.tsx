import { useState, useEffect } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { db } from '../db/schema';
import type { BedStatus } from '../types';

export default function DashboardScreen() {
  const [beds, setBeds] = useState<BedStatus[]>([]);
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const setScreen = useAppStore((s) => s.setScreen);
  const setSelectedPatientId = useAppStore((s) => s.setSelectedPatientId);
  const setSelectedHandoffId = useAppStore((s) => s.setSelectedHandoffId);
  const ward = useAppStore((s) => s.currentWard);
  const logout = useAppStore((s) => s.logout);
  const pendingSync = useAppStore((s) => s.pendingSyncCount);
  const dashboardRefresh = useAppStore((s) => s.dashboardRefresh);

  useEffect(() => {
    loadBeds();
  }, [ward, dashboardRefresh]);

  async function loadBeds() {
    setLoading(true);
    try {
      const patients = await db.patients.where('ward').equals(ward).toArray();
      const allHandoffs = await db.handoffs.toArray();
      const bedList: BedStatus[] = [];

      for (let i = 1; i <= 12; i++) {
        const bedNum = `BED ${String(i).padStart(2, '0')}`;
        const patient = patients.find((p) => p.bed === bedNum);

        if (!patient) {
          bedList.push({ bed: bedNum, status: 'empty', alerts: [], pendingTasks: 0 });
          continue;
        }

        const patientHandoffs = allHandoffs.filter(
          (h) => h.patientId === patient.id && h.status === 'pending'
        );
        const handoff = patientHandoffs.length > 0 ? patientHandoffs[patientHandoffs.length - 1] : null;

        const pendingTasks = handoff ? handoff.tasks.filter((t) => !t.completed).length : 0;

        let status: BedStatus['status'] = 'stable';
        if (handoff?.vitals) {
          const bp = handoff.vitals.bloodPressure.split('/').map(Number);
          if (!isNaN(bp[0]) && !isNaN(bp[1])) {
            if (bp[0] > 160 || bp[1] > 100 || handoff.vitals.spO2 < 92) {
              status = 'critical';
            } else if (bp[0] > 140 || handoff.vitals.temperature > 38) {
              status = 'warning';
            }
          }
        }

        bedList.push({
          bed: bedNum,
          patient,
          handoff: handoff || undefined,
          status,
          alerts: handoff?.alerts || [],
          pendingTasks,
          lastHandoffAt: handoff?.createdAt,
        });
      }

      setBeds(bedList);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    await db.syncQueue.clear();
    useAppStore.getState().setPendingSync(0);

    setSyncing(false);
  }

  const filtered = beds.filter((bed) => {
    if (activeTab === 'Critical' && bed.status !== 'critical') return false;
    if (activeTab === 'Pending' && bed.status !== 'warning') return false;
    if (activeTab === 'Empty' && bed.status !== 'empty') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        bed.bed.toLowerCase().includes(q) ||
        bed.patient?.name.toLowerCase().includes(q) ||
        bed.patient?.hospitalNumber.toLowerCase().includes(q)
      );
    }
    return true;
  });

  function handleBedClick(bed: BedStatus) {
    if (!bed.patient) return;

    if (bed.handoff && bed.handoff.status === 'pending') {
      setSelectedHandoffId(bed.handoff.id);
      setScreen('acknowledge');
    } else {
      // FIX: Validate patient ID before setting and navigating
      if (bed.patient.id && bed.patient.id.trim() !== '') {
        setSelectedPatientId(bed.patient.id);
        setScreen('handoff');
      }
    }
  }

  // FIX: Handle New Handoff button — don't navigate without a valid patient
  function handleNewHandoff() {
    setSelectedPatientId('');
    // Don't navigate to handoff screen without a patient selected
    // Show alert to user explaining they need to select a patient first
    alert('Please select a patient from the dashboard to create a new handoff.');
  }

  return (
    <div className="screen-container">
      <div className="header">
        <button className="icon-btn" onClick={logout}>
          ←
        </button>
        <h1>{ward}</h1>
        <button className="icon-btn" onClick={() => setScreen('settings')}>
          ⚙️
        </button>
      </div>

      <div className="search-bar glass">
        <span style={{ color: 'var(--text-muted)' }}>🔍</span>
        <input
          type="text"
          placeholder="Search bed or patient..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="tabs">
        {['All', 'Critical', 'Pending', 'Empty'].map((tab) => (
          <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading...</div>
      ) : (
        filtered.map((bed) => (
          <div
            key={bed.bed}
            className={`bed-card glass glass-hover ${bed.status}`}
            onClick={() => handleBedClick(bed)}
          >
            <div className="bed-header">
              <div className="bed-number">{bed.bed}</div>
              <div className={`bed-status ${bed.status}`}>{bed.status === 'empty' ? 'Empty' : bed.status}</div>
            </div>

            {bed.patient && (
              <>
                <div className="patient-name">{bed.patient.name}</div>
                <div className="patient-meta">
                  {bed.patient.age}
                  {bed.patient.gender} • Admitted {formatTimeAgo(bed.patient.createdAt)}
                </div>
              </>
            )}

            {bed.status === 'empty' && <div className="patient-name" style={{ color: 'var(--text-muted)' }}>—</div>}

            <div className="bed-alerts">
              {bed.alerts.map((alert) => (
                <div key={alert.id} className={`alert-tag ${alert.severity}`}>
                  {alert.severity === 'critical' ? '🚨' : '⚠️'} {alert.message}
                </div>
              ))}
              {bed.pendingTasks > 0 && (
                <div className="alert-tag warning">
                  ⏳ {bed.pendingTasks} Task{bed.pendingTasks > 1 ? 's' : ''}
                </div>
              )}
              {bed.handoff && bed.handoff.status === 'pending' && (
                <div className="alert-tag warning">⏳ Pending Handoff</div>
              )}
              {bed.status === 'stable' && !bed.handoff && <div className="alert-tag success">✅ All Caught Up</div>}
              {bed.status === 'empty' && (
                <div
                  className="alert-tag"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}
                >
                  Last: Discharged
                </div>
              )}
            </div>
          </div>
        ))
      )}

      {pendingSync > 0 && (
        <div className={`sync-badge glass ${syncing ? 'synced' : ''}`} onClick={handleSync}>
          <span>{syncing ? '🔄' : '📡'}</span>
          <span>{syncing ? 'Syncing...' : `${pendingSync} pending`}</span>
        </div>
      )}

      <div className="bottom-bar">
        <button
          className="btn btn-primary"
          onClick={handleNewHandoff}
        >
          <span>📝</span> New Handoff
        </button>
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const days = Math.floor((Date.now() - timestamp) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}