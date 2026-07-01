import Dexie from "dexie";
import type { Table } from "dexie";
import type { Patient, HandOff, Nurse, SyncQueueItem } from "../types";

export class WardLinkDB extends Dexie {
  patients!: Table<Patient, string>;
  handoffs!: Table<HandOff, string>;
  nurses!: Table<Nurse, string>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super("WardLinkNG");

    this.version(1).stores({
      patients: "id, ward, bed, lastUpdated, *metaTags",
      handoffs:
        "id, patientId, status, version, createdAt, syncedAt, syncStatus",
      nurses: "id, employeeId, ward, isActive",
      syncQueue: "++id, table, operation, retryCount, createdAt",
    });
  }
}

export const db = new WardLinkDB();

// Patient IDs and nurse ID need to be stable across reseeds
// so we use deterministic UUIDs for seeding
const SEED_PATIENT_1 = "seed-patient-okafor-001";
const SEED_PATIENT_2 = "seed-patient-musa-002";
const SEED_PATIENT_3 = "seed-patient-ade-003";
const SEED_NURSE = "seed-nurse-ibrahim-001";
const SEED_HANDOFF = "seed-handoff-musa-001";

export async function seedDemoData(): Promise<void> {
  const patientCount = await db.patients.count();
  const handoffCount = await db.handoffs.count();

  // If fully seeded, skip
  if (patientCount > 0 && handoffCount > 0) {
    console.log("Demo data already seeded");
    return;
  }

  // Clear partial state if needed
  if (patientCount > 0 && handoffCount === 0) {
    await db.patients.clear();
    await db.nurses.clear();
    await db.syncQueue.clear();
    console.log("Cleared partial data for reseed");
  }

  await db.patients.bulkAdd([
    {
      id: SEED_PATIENT_1,
      hospitalNumber: "NGH-2026-001",
      name: "J. Okafor",
      age: 67,
      gender: "M",
      ward: "ICU-A",
      bed: "BED 02",
      encryptedData: "",
      metaTags: ["okafor", "male", "67"],
      createdAt: Date.now() - 172800000,
      lastUpdated: Date.now(),
    },
    {
      id: SEED_PATIENT_2,
      hospitalNumber: "NGH-2026-002",
      name: "A. Musa",
      age: 45,
      gender: "F",
      ward: "ICU-A",
      bed: "BED 01",
      encryptedData: "",
      metaTags: ["musa", "female", "45"],
      createdAt: Date.now() - 432000000,
      lastUpdated: Date.now(),
    },
    {
      id: SEED_PATIENT_3,
      hospitalNumber: "NGH-2026-003",
      name: "C. Ade",
      age: 32,
      gender: "M",
      ward: "ICU-A",
      bed: "BED 03",
      encryptedData: "",
      metaTags: ["ade", "male", "32"],
      createdAt: Date.now() - 86400000,
      lastUpdated: Date.now(),
    },
  ]);

  await db.nurses.add({
    id: SEED_NURSE,
    name: "A. Ibrahim",
    employeeId: "NGH-4421",
    pinHash: "demo-hash",
    ward: "ICU-A",
    role: "nurse",
    isActive: true,
  });

  const twoHoursAgo = Date.now() - 7200000;

  await db.handoffs.add({
    id: SEED_HANDOFF,
    patientId: SEED_PATIENT_2,
    outgoingNurseId: SEED_NURSE,
    shift: "morning",
    status: "pending",
    version: 1,
    vitals: {
      bloodPressure: "145/92",
      heartRate: 88,
      temperature: 37.8,
      spO2: 94,
      respiratoryRate: 18,
      recordedAt: twoHoursAgo,
    },
    medications: [
      {
        id: "seed-med-001",
        name: "Paracetamol",
        dosage: "500mg",
        frequency: "Every 6 hours",
        given: false,
        scheduledTimes: ["06:00", "12:00", "18:00", "00:00"],
      },
      {
        id: "seed-med-002",
        name: "Ceftriaxone",
        dosage: "1g IV",
        frequency: "Every 12 hours",
        given: false,
        scheduledTimes: ["06:00", "18:00"],
      },
      {
        id: "seed-med-003",
        name: "Metformin",
        dosage: "500mg",
        frequency: "Twice daily",
        given: false,
        scheduledTimes: ["08:00", "20:00"],
      },
    ],
    tasks: [
      {
        id: "seed-task-001",
        description: "Monitor BP every 2 hours",
        priority: "high",
        completed: false,
        createdAt: twoHoursAgo,
      },
      {
        id: "seed-task-002",
        description: "Check IV site for infiltration",
        priority: "medium",
        completed: false,
        createdAt: twoHoursAgo,
      },
    ],
    alerts: [
      {
        id: "seed-alert-001",
        type: "custom",
        message: "Elevated BP — monitor closely",
        severity: "warning",
        createdAt: twoHoursAgo,
      },
      {
        id: "seed-alert-002",
        type: "allergy",
        message: "Penicillin allergy confirmed",
        severity: "critical",
        createdAt: twoHoursAgo,
      },
    ],
    freeTextNotes: "Patient complained of mild headache this morning. BP slightly elevated compared to previous readings. Continue monitoring and notify doctor if systolic exceeds 150.",
    createdAt: twoHoursAgo,
    syncStatus: "local",
  });

  await db.syncQueue.add({
    table: "handoffs",
    operation: "create",
    payload: JSON.stringify({ id: SEED_HANDOFF, patientId: SEED_PATIENT_2 }),
    retryCount: 0,
    createdAt: Date.now(),
  });

  console.log("Demo data seeded with pending handoff for A. Musa");
}

// Export function to force reseed (for Settings screen)
export async function forceReseedDemoData(): Promise<void> {
  await db.patients.clear();
  await db.handoffs.clear();
  await db.nurses.clear();
  await db.syncQueue.clear();
  console.log("All data cleared for reseed");
  
  await seedDemoData();
  console.log("Demo data reseeded successfully");
}