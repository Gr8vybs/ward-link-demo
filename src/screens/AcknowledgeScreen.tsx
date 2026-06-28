import { useState, useEffect } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { db } from '../db/schema';
import type { HandOff } from '../types';

export default function AcknowledgeScreen() {
  const handoffId = useAppStore((s) => s.selectedHandoffId);
  const [handoff, setHandoff] = useState<HandOff | null>(null);
  const [patientName, setPatientName] = useState('');
  const [bed, setBed] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const setScreen = useAppStore((s) => s.setScreen);
  const currentNurse = useAppStore((s) => s.currentNurse);
  const triggerDashboardRefresh = useAppStore((s) => s.triggerDashboardRefresh);

  useEffect(() => {
    loadHandoff();
  }, [handoffId]);

  async function loadHandoff() {
    if (!handoffId) return;
    const h = await db.handoffs.get(handoffId);
    if (!h) return;
    setHandoff(h);

    const p = await db.patients.get(h.patientId);
    if (p) {
      setPatientName(p.name);
      setBed(p.bed);
    }
  }

  async function acknowledge() {
    if (!handoff || !currentNurse || pin.length !== 4) {
      setError('Enter 4-digit PIN');
      return;
    }

    await db.handoffs.update(handoff.id, {
      status: 'acknowledged',
      incomingNurseId: currentNurse.id,
      acknowledgedAt: Date.now(),
      syncStatus: 'local',
    });

    await db.syncQueue.add({
      table: 'handoffs',
      operation: 'update',
      payload: JSON.stringify({ id: handoff.id, status: 'acknowledged' }),
      retryCount: 0,
      createdAt: Date.now(),
    });

    triggerDashboardRefresh();
    setScreen('dashboard');
  }

  function handlePin(num: number) {
    if (pin.length >= 4) return;
    const newPin = pin + num;
    setPin(newPin);
    setError('');

    if (newPin.length === 4) {
      acknowledge();
    }
  }

  function clearPin() {
    setPin((p) => p.slice(0, -1));
    setError('');
  }

  if (!handoff) {
    return (
      <div className="screen-container" style={{ color: 'var(--text-secondary)', textAlign: 'center', paddingTop: '40px' }}>
        Loading handoff...
      </div>
    );
  }

  return (
    <div className="screen-container">
      <div className="header">
        <button className="icon-btn" onClick={() => setScreen('dashboard')}>
          ←
        </button>
        <h1>Incoming Handoff</h1>
        <button className="icon-btn">⋮</button>
      </div>

      <div className="form-section glass" style={{ textAlign: 'center', padding: '32px 24px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '15px' }}>
          From <span style={{ color: 'var(--primary)', fontWeight: 700 }}>Nurse A. Ibrahim</span>
          <br />
          <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
            {new Date(handoff.createdAt).toLocaleTimeString()} — Night Shift
          </span>
          <br />
          <br />
          Patient{' '}
          <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
            {bed} — {patientName}
          </span>
        </div>
      </div>

      <div className="form-section glass">
        <div className="form-section-title">⚠️ Critical Items</div>
        <div style={{ lineHeight: 2.2, fontWeight: 500 }}>
          {handoff.vitals.bloodPressure && (
            <div>
              <span style={{ color: 'var(--critical)' }}>•</span> BP: {handoff.vitals.bloodPressure}
            </div>
          )}
          {handoff.vitals.temperature > 37.5 && (
            <div>
              <span style={{ color: 'var(--warning)' }}>•</span> Temp: {handoff.vitals.temperature}°C
            </div>
          )}
          {handoff.vitals.spO2 < 95 && (
            <div>
              <span style={{ color: 'var(--critical)' }}>•</span> SpO2: {handoff.vitals.spO2}%
            </div>
          )}
          {handoff.alerts.map((alert) => (
            <div key={alert.id}>
              <span
                style={{
                  color: alert.severity === 'critical' ? 'var(--critical)' : 'var(--warning)',
                }}
              >
                •
              </span>{' '}
              {alert.message}
            </div>
          ))}
          {handoff.tasks.length > 0 && (
            <div>
              <span style={{ color: 'var(--warning)' }}>•</span> {handoff.tasks.length} pending task
              {handoff.tasks.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      <div className="form-section glass">
        <div className="form-section-title">✍️ Sign to Accept</div>
        <div
          style={{
            textAlign: 'center',
            color: 'var(--text-secondary)',
            marginBottom: '20px',
            fontSize: '14px',
          }}
        >
          Enter your PIN to accept responsibility
        </div>
        <div className="pin-display">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
          ))}
        </div>
        {error && (
          <div
            style={{
              color: 'var(--critical)',
              textAlign: 'center',
              fontSize: '13px',
              marginTop: '8px',
            }}
          >
            {error}
          </div>
        )}

        <div className="numpad" style={{ marginTop: '24px' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button key={num} className="numpad-btn" onClick={() => handlePin(num)}>
              {num}
            </button>
          ))}
          <button className="numpad-btn" style={{ opacity: 0 }} disabled>
            •
          </button>
          <button className="numpad-btn" onClick={() => handlePin(0)}>
            0
          </button>
          <button className="numpad-btn" onClick={clearPin}>
            ⌫
          </button>
        </div>
      </div>

      <div className="bottom-bar">
        <button className="btn btn-critical" onClick={() => setScreen('dashboard')}>
          <span>❌</span> Flag Issue
        </button>
        <button className="btn btn-success" onClick={() => acknowledge()}>
          <span>✅</span> Accept
        </button>
      </div>
    </div>
  );
}