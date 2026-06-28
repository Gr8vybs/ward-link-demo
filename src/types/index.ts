export interface Patient {
  id: string;
  hospitalNumber: string;
  name: string;
  age: number;
  gender: 'M' | 'F';
  ward: string;
  bed: string;
  encryptedData: string;
  metaTags: string[];
  createdAt: number;
  lastUpdated: number;
}

export interface VitalSigns {
  bloodPressure: string;
  heartRate: number;
  temperature: number;
  spO2: number;
  respiratoryRate: number;
  recordedAt: number;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  given: boolean;
  scheduledTimes: string[];
  lastGivenAt?: number;
}

export interface Task {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  completed: boolean;
  createdAt: number;
}

export interface Alert {
  id: string;
  type: 'allergy' | 'fall_risk' | 'isolation' | 'custom';
  message: string;
  severity: 'warning' | 'critical';
  createdAt: number;
}

export interface HandOff {
  id: string;
  patientId: string;
  outgoingNurseId: string;
  incomingNurseId?: string;
  shift: 'morning' | 'afternoon' | 'night';
  status: 'draft' | 'pending' | 'acknowledged' | 'flagged';
  version: number;
  vitals: VitalSigns;
  medications: Medication[];
  tasks: Task[];
  alerts: Alert[];
  voiceNoteUrl?: string;
  freeTextNotes: string;
  createdAt: number;
  acknowledgedAt?: number;
  syncedAt?: number;
  syncStatus: 'local' | 'syncing' | 'synced' | 'failed';
}

export interface Nurse {
  id: string;
  name: string;
  employeeId: string;
  pinHash: string;
  ward: string;
  role: 'nurse' | 'charge_nurse' | 'admin';
  isActive: boolean;
}

export interface SyncQueueItem {
  id?: number;
  table: string;
  operation: 'create' | 'update' | 'delete';
  payload: string;
  retryCount: number;
  createdAt: number;
}

export interface BedStatus {
  bed: string;
  patient?: Patient;
  handoff?: HandOff;
  status: 'critical' | 'warning' | 'stable' | 'empty';
  alerts: Alert[];
  pendingTasks: number;
  lastHandoffAt?: number;
}

export type ScreenType = 'login' | 'dashboard' | 'handoff' | 'acknowledge' | 'settings';

export interface AppState {
  currentNurse: Nurse | null;
  currentWard: string;
  currentShift: 'morning' | 'afternoon' | 'night';
  isOnline: boolean;
  isSyncing: boolean;
  pendingSyncCount: number;
  lastSyncAt?: number;
  encryptionKey: CryptoKey | null;
}