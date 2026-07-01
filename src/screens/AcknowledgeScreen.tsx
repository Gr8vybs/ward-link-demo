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
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [flagSuccess, setFlagSuccess] = useState(false);

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

  async function flagIssue() {
    if (!handoff || !currentNurse || !flagReason.trim()) {
      setError('Please enter a reason for flagging');
      return;
    }

    await db.handoffs.update(handoff.id, {
      status: 'flagged',
      incomingNurseId: currentNurse.id,
      acknowledgedAt: Date.now(),
      syncStatus: 'local',
      // Store flag reason in freeTextNotes (appended)
      freeTextNotes: `${handoff.freeTextNotes}\n\n[FLAGGED by ${currentNurse.name}]: ${flagReason.trim()}`,
    });

    await db.syncQueue.add({
      table: 'handoffs',
      operation: 'update',
      payload: JSON.stringify({ id: handoff.id, status: 'flagged', reason: flagReason.trim() }),
      retryCount: 0,
      createdAt: Date.now(),
    });

    setFlagSuccess(true);
    setTimeout(() => {
      triggerDashboardRefresh();
      setScreen('dashboard');
    }, 1500);
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

  // Flag success state
  if (flagSuccess) {
    return (
      <div className="screen-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>🚩</div>
        <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Issue Flagged</div>
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>Charge nurse has been notified</div>
      </div>
    );
  }

  // Flag modal
  if (showFlagModal) {
    return (
      <div className="screen-container">
        <div className="header">
          <button className="icon-btn" onClick={() => setShowFlagModal(false)}>←</button>
          <h1>Flag Issue</h1>
          <button className="icon-btn">⋮</button>
        </div>

        <div className="form-section glass">
          <div className="form-section-title">🚩 Why are you flagging this handoff?</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px', lineHeight: 1.6 }}>
            Flagging will alert the charge nurse and require a review before this handoff can be processed.
          </div>
          <textarea
            className="input-field"
            style={{ minHeight: '120px', resize: 'vertical', marginBottom: 0 }}
            placeholder="Describe the issue (e.g., incorrect medication dosage, missing vital signs, patient concern...)"
            value={flagReason}
            onChange={(e) => {
              setFlagReason(e.target.value);
              setError('');
            }}
          />
          {error && (
            <div style={{ color: 'var(--critical)', fontSize: '13px', marginTop: '8px' }}>
              {error}
            </div>
          )}
        </div>

        <div className="bottom-bar">
          <button className="btn btn-secondary" onClick={() => setShowFlagModal(false)}>
            Cancel
          </button>
          <button className="btn btn-critical" onClick={flagIssue}>
            <span>🚩</span> Flag Issue
          </button>
        </div>
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
            {new Date(handoff.createdAt).toLocaleTimeString()} — Morning Shift
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

      {/* Medications Preview */}
      {handoff.medications.length > 0 && (
        <div className="form-section glass">
          <div className="form-section-title">💉 Medications ({handoff.medications.length})</div>
          {handoff.medications.map((med) => (
            <div key={med.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--glass-border)' }}>
              <span>{med.name} {med.dosage}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{med.frequency}</span>
            </div>
          ))}
        </div>
      )}

      {/* Notes Preview */}
      {handoff.freeTextNotes && (
        <div className="form-section glass">
          <div className="form-section-title">📝 Notes</div>
          <div style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            {handoff.freeTextNotes}
          </div>
        </div>
      )}

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
        <button className="btn btn-critical" onClick={() => setShowFlagModal(true)}>
          <span>🚩</span> Flag Issue
        </button>
        <button className="btn btn-success" onClick={() => acknowledge()}>
          <span>✅</span> Accept
        </button>
      </div>
    </div>
  );
}