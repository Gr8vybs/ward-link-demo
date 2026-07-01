import { create } from 'zustand';
import type { Nurse, ScreenType } from '../types';

interface Store {
  currentNurse: Nurse | null;
  currentWard: string;
  currentShift: 'morning' | 'afternoon' | 'night';
  isOnline: boolean;
  isSyncing: boolean;
  pendingSyncCount: number;
  lastSyncAt?: number;
  encryptionKey: CryptoKey | null;
  currentScreen: ScreenType;
  selectedPatientId: string;
  selectedHandoffId: string;
  dashboardRefresh: number;

  setScreen: (screen: ScreenType) => void;
  setSelectedPatientId: (id: string) => void;
  setSelectedHandoffId: (id: string) => void;
  triggerDashboardRefresh: () => void;
  login: (nurse: Nurse) => void;
  logout: () => void;
  setOnline: (online: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setPendingSync: (count: number) => void;
  setLastSyncAt: (timestamp: number) => void;
}

export const useAppStore = create<Store>((set) => ({
  currentNurse: null,
  currentWard: 'ICU-A',
  currentShift: 'night',
  isOnline: navigator.onLine,
  isSyncing: false,
  pendingSyncCount: 0,
  encryptionKey: null,
  currentScreen: 'login',
  selectedPatientId: '',
  selectedHandoffId: '',
  dashboardRefresh: 0,

  setScreen: (screen) => set({ currentScreen: screen }),
  setSelectedPatientId: (id) => set({ selectedPatientId: id }),
  setSelectedHandoffId: (id) => set({ selectedHandoffId: id }),
  triggerDashboardRefresh: () => set((state) => ({ dashboardRefresh: state.dashboardRefresh + 1 })),
  login: (nurse) => set({ currentNurse: nurse, currentScreen: 'dashboard' }),
  logout: () => set({ currentNurse: null, encryptionKey: null, currentScreen: 'login' }),
  setOnline: (online) => set({ isOnline: online }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setPendingSync: (count) => set({ pendingSyncCount: count }),
  setLastSyncAt: (timestamp) => set({ lastSyncAt: timestamp }),
}));

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => useAppStore.getState().setOnline(true));
  window.addEventListener('offline', () => useAppStore.getState().setOnline(false));
}