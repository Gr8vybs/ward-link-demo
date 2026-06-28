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

// Seed demo data
export async function seedDemoData(): Promise<void> {
  const count = await db.patients.count();
  if (count > 0) return;

  await db.patients.bulkAdd([
    {
      id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
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
    id: crypto.randomUUID(),
    name: "A. Ibrahim",
    employeeId: "NGH-4421",
    pinHash: "demo-hash",
    ward: "ICU-A",
    role: "nurse",
    isActive: true,
  });

  console.log("Demo data seeded");
}
