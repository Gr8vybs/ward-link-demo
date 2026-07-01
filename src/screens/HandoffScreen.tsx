import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { db } from '../db/schema';
import type { Patient, VitalSigns, Medication, Task, Alert, HandOff } from '../types';

export default function HandoffScreen() {
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
  
  // Voice note state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const setScreen = useAppStore((s) => s.setScreen);
  const currentNurse = useAppStore((s) => s.currentNurse);
  const currentShift = useAppStore((s) => s.currentShift);

  // Check for Web Speech API support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setVoiceSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-NG';
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        setVoiceTranscript((prev) => prev + finalTranscript);
        if (interimTranscript) {
          setNotes((prev) => {
            const base = prev.replace(/\s*\[listening\.\.\.\]\s*$/, '');
            return base + ' ' + interimTranscript + ' [listening...]';
          });
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please allow microphone access to use voice notes.');
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        setNotes((prev) => prev.replace(/\s*\[listening\.\.\.\]\s*$/, '').trim());
      };

      recognitionRef.current = recognition;
    }
  }, []);

  useEffect(() => {
    loadPatientData();
  }, [patientId]);

  async function loadPatientData() {
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
      
      const prev = await db.handoffs
        .where('patientId')
        .equals(patientId)
        .and(h => h.status === 'acknowledged')
        .last();
      
      if (prev) {
        setPreviousHandoff(prev);
        setMedications(prev.medications.map(m => ({ ...m, given: false })));
        setAlerts(prev.alerts);
      }
    } catch (err) {
      console.error('Failed to load patient data:', err);
      setPatient(null);
    } finally {
      setLoading(false);
    }
  }

  const toggleVoiceRecording = useCallback(() => {
    if (!voiceSupported) {
      alert('Voice notes are not supported in this browser. Please use Chrome or Safari.');
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      setVoiceTranscript('');
      setNotes((prev) => prev.trim());
      try {
        recognitionRef.current?.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Failed to start recording:', err);
      }
    }
  }, [isRecording, voiceSupported]);

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
    
    const cleanNotes = notes.replace(/\s*\[listening\.\.\.\]\s*$/, '').trim();
    
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
      voiceNoteUrl: voiceTranscript || undefined,
      freeTextNotes: cleanNotes,
      createdAt: Date.now(),
      syncStatus: 'local'
    };
    
    await db.handoffs.add(handoff);
    
    await db.syncQueue.add({
      table: 'handoffs',
      operation: 'create',
      payload: JSON.stringify(handoff),
      retryCount: 0,
      createdAt: Date.now()
    });
    
    const count = await db.syncQueue.count();
    useAppStore.getState().setPendingSync(count);
    
    setScreen('dashboard');
  }

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
        {tasks.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '12px' }}>
            No tasks added yet.
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="checkbox-item">
              <div className="checkbox"></div>
              <div style={{ fontWeight: 500 }}>{task.description}</div>
            </div>
          ))
        )}
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
        {!voiceSupported && (
          <div style={{ color: 'var(--warning)', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>
            ⚠️ Voice notes not supported in this browser
          </div>
        )}
        <button 
          className={`voice-btn ${isRecording ? 'recording' : ''}`}
          onClick={toggleVoiceRecording}
          disabled={!voiceSupported}
        >
          <span>{isRecording ? '⏹️' : '🎤'}</span>
          {isRecording ? 'Recording... Tap to stop' : voiceSupported ? 'Tap to record note' : 'Not available'}
        </button>
        {voiceTranscript && (
          <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', fontSize: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>Transcript</div>
            {voiceTranscript}
          </div>
        )}
      </div>

      {/* Notes Input */}
      <div className="form-section glass" style={{ marginBottom: '140px' }}>
        <div className="form-section-title">📝 Free Text Notes</div>
        <textarea
          className="input-field"
          style={{ minHeight: '100px', resize: 'vertical', marginBottom: 0 }}
          placeholder="Enter any additional notes, or use voice note above..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Bottom Actions - Fixed */}
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

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}