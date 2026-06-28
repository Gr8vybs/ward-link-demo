import { useState, useEffect } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { db } from '../db/schema';
import type { Patient, VitalSigns, Medication, Task, Alert, HandOff } from '../types';

export default function HandoffScreen() {
  // FIX: Read patientId from store since App.tsx doesn't pass it as a prop
  const patientId = useAppStore((s) => s.selectedPatientId);
  
  const [patient, setPatient] = useState<Patient | null>(null);
  const [previousHandoff, setPreviousHandoff] = useState<HandOff | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [vitals, setVitals] = useState<VitalSigns>({
    bloodPressure: '',
    heartRate: 0,
    temperature: 0,
    spO2: 0,
    respiratoryRate: 0,
    recordedAt: Date.now()
  });
  
  const [medications, setMedications] = useState<Medication[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notes, setNotes] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  
  const setScreen = useAppStore((s) => s.setScreen);
  const currentNurse = useAppStore((s) => s.currentNurse);
  const currentShift = useAppStore((s) => s.currentShift);

  // Load patient data on mount
  useEffect(() => {
    loadPatientData();
  }, [patientId]);

  async function loadPatientData() {
    // FIX: Guard against invalid patientId before calling Dexie
    if (!patientId || patientId.trim() === '') {
      setPatient(null);
      setLoading(false);
      return;
    }

    try {
      const p = await db.patients.get(patientId);
      if (!p) {
        setPatient(null);
        setLoading(false);
        return;
      }
      setPatient(p);
      
      // Load previous handoff to carry forward medications and alerts
      const prev = await db.handoffs
        .where('patientId')
        .equals(patientId)
        .and(h => h.status === 'acknowledged')
        .last();
      
      if (prev) {
        setPreviousHandoff(prev);
        setMedications(prev.medications.map(m => ({ ...m, given: false }))); // Reset given status
        setAlerts(prev.alerts);
      }
    } catch (err) {
      console.error('Failed to load patient data:', err);
      setPatient(null);
    } finally {
      setLoading(false);
    }
  }

  // Auto-flag vitals based on normal ranges
  function getVitalStatus(type: keyof VitalSigns, value: string | number): 'normal' | 'warning' | 'critical' {
    if (type === 'bloodPressure' && typeof value === 'string') {
      const [sys, dia] = value.split('/').map(Number);
      if (isNaN(sys) || isNaN(dia)) return 'normal';
      if (sys > 160 || dia > 100) return 'critical';
      if (sys > 140 || dia > 80) return 'warning';
      return 'normal';
    }
    if (type === 'heartRate') {
      const hr = Number(value);
      if (hr < 50 || hr > 120) return 'critical';
      if (hr < 60 || hr > 100) return 'warning';
      return 'normal';
    }
    if (type === 'temperature') {
      const temp = Number(value);
      if (temp > 38.5) return 'critical';
      if (temp > 37.5) return 'warning';
      return 'normal';
    }
    if (type === 'spO2') {
      const o2 = Number(value);
      if (o2 < 92) return 'critical';
      if (o2 < 95) return 'warning';
      return 'normal';
    }
    return 'normal';
  }

  function toggleMedication(id: string) {
    setMedications(prev => prev.map(m => 
      m.id === id ? { ...m, given: !m.given, lastGivenAt: !m.given ? Date.now() : undefined } : m
    ));
  }

  function addTask(description: string) {
    const newTask: Task = {
      id: crypto.randomUUID(),
      description,
      priority: 'medium',
      completed: false,
      createdAt: Date.now()
    };
    setTasks(prev => [...prev, newTask]);
  }

  async function completeHandoff() {
    if (!patient || !currentNurse) return;
    
    const handoff: HandOff = {
      id: crypto.randomUUID(),
      patientId: patient.id,
      outgoingNurseId: currentNurse.id,
      shift: currentShift,
      status: 'pending',
      version: 1,
      vitals,
      medications,
      tasks,
      alerts,
      freeTextNotes: notes,
      createdAt: Date.now(),
      syncStatus: 'local'
    };
    
    // Save to IndexedDB
    await db.handoffs.add(handoff);
    
    // Add to sync queue
    await db.syncQueue.add({
      table: 'handoffs',
      operation: 'create',
      payload: JSON.stringify(handoff),
      retryCount: 0,
      createdAt: Date.now()
    });
    
    // Update pending sync count
    const count = await db.syncQueue.count();
    useAppStore.getState().setPendingSync(count);
    
    // Return to dashboard
    setScreen('dashboard');
  }

  // FIX: Show loading state instead of blank screen
  if (loading) {
    return (
      <div className="screen-container">
        <div className="header">
          <button className="icon-btn" onClick={() => setScreen('dashboard')}>←</button>
          <h1>Loading...</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          Loading patient data...
        </div>
      </div>
    );
  }

  // FIX: Show error state when no valid patient selected
  if (!patient) {
    return (
      <div className="screen-container">
        <div className="header">
          <button className="icon-btn" onClick={() => setScreen('dashboard')}>←</button>
          <h1>No Patient Selected</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          <p style={{ marginBottom: '24px' }}>No patient was selected. Please select a patient from the dashboard first.</p>
          <button className="btn btn-primary" onClick={() => setScreen('dashboard')}>
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-container">
      <div className="header">
        <button className="icon-btn" onClick={() => setScreen('dashboard')}>←</button>
        <h1>{patient.bed} — {patient.name}</h1>
        <button className="icon-btn">⋮</button>
      </div>

      {/* Vitals Section */}
      <div className="form-section glass">
        <div className="form-section-title">❤️ Vitals</div>
        <div className="vitals-grid">
          <div className="vital-item">
            <div className="vital-label">Blood Pressure</div>
            <input
              className="input-field"
              style={{ marginBottom: 0 }}
              placeholder="120/80"
              value={vitals.bloodPressure}
              onChange={(e) => setVitals({ ...vitals, bloodPressure: e.target.value })}
            />
            <div className={`vital-value ${getVitalStatus('bloodPressure', vitals.bloodPressure)}`}>
              {vitals.bloodPressure || '—'}
            </div>
          </div>
          
          <div className="vital-item">
            <div className="vital-label">Heart Rate</div>
            <input
              type="number"
              className="input-field"
              style={{ marginBottom: 0 }}
              placeholder="72"
              value={vitals.heartRate || ''}
              onChange={(e) => setVitals({ ...vitals, heartRate: Number(e.target.value) })}
            />
            <div className={`vital-value ${getVitalStatus('heartRate', vitals.heartRate)}`}>
              {vitals.heartRate ? `${vitals.heartRate} bpm` : '—'}
            </div>
          </div>
          
          <div className="vital-item">
            <div className="vital-label">Temperature</div>
            <input
              type="number"
              step="0.1"
              className="input-field"
              style={{ marginBottom: 0 }}
              placeholder="36.5"
              value={vitals.temperature || ''}
              onChange={(e) => setVitals({ ...vitals, temperature: Number(e.target.value) })}
            />
            <div className={`vital-value ${getVitalStatus('temperature', vitals.temperature)}`}>
              {vitals.temperature ? `${vitals.temperature}°C` : '—'}
            </div>
          </div>
          
          <div className="vital-item">
            <div className="vital-label">SpO2</div>
            <input
              type="number"
              className="input-field"
              style={{ marginBottom: 0 }}
              placeholder="98"
              value={vitals.spO2 || ''}
              onChange={(e) => setVitals({ ...vitals, spO2: Number(e.target.value) })}
            />
            <div className={`vital-value ${getVitalStatus('spO2', vitals.spO2)}`}>
              {vitals.spO2 ? `${vitals.spO2}%` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Medications */}
      <div className="form-section glass">
        <div className="form-section-title">💉 Medications</div>
        {medications.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
            No previous medications. Add manually or carry forward from previous handoff.
          </div>
        ) : (
          medications.map((med) => (
            <div key={med.id} className="checkbox-item">
              <div 
                className={`checkbox ${med.given ? 'checked' : ''}`}
                onClick={() => toggleMedication(med.id)}
              >
                {med.given ? '✓' : ''}
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>{med.name} {med.dosage}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {med.frequency} {med.given ? '✓ Given' : '⏳ Pending'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Tasks */}
      <div className="form-section glass">
        <div className="form-section-title">📋 Pending Tasks</div>
        {tasks.map((task) => (
          <div key={task.id} className="checkbox-item">
            <div className="checkbox"></div>
            <div style={{ fontWeight: 500 }}>{task.description}</div>
          </div>
        ))}
        <button 
          className="btn btn-secondary" 
          style={{ width: '100%', marginTop: '8px' }}
          onClick={() => {
            const desc = prompt('Enter task description:');
            if (desc) addTask(desc);
          }}
        >
          <span>+</span> Add Task
        </button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="form-section glass">
          <div className="form-section-title">🚨 Alerts</div>
          {alerts.map((alert) => (
            <div key={alert.id} className={`alert-tag ${alert.severity}`} style={{ marginBottom: '8px', display: 'inline-block' }}>
              {alert.severity === 'critical' ? '🚨' : '⚠️'} {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Voice Notes */}
      <div className="form-section glass">
        <div className="form-section-title">🎤 Voice Note</div>
        <button 
          className={`voice-btn ${isRecording ? 'recording' : ''}`}
          onClick={() => setIsRecording(!isRecording)}
        >
          <span>{isRecording ? '⏹️' : '🎤'}</span>
          {isRecording ? 'Recording... Tap to stop' : 'Tap to record note'}
        </button>
        {notes && (
          <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', fontSize: '14px' }}>
            {notes}
          </div>
        )}
      </div>

      {/* Notes Input */}
      <div className="form-section glass">
        <div className="form-section-title">📝 Free Text Notes</div>
        <textarea
          className="input-field"
          style={{ minHeight: '100px', resize: 'vertical' }}
          placeholder="Enter any additional notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Bottom Actions */}
      <div className="bottom-bar">
        <button className="btn btn-secondary" onClick={() => setScreen('dashboard')}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={completeHandoff}>
          <span>📝</span> Complete Handoff
        </button>
      </div>
    </div>
  );
}