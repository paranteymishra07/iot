export type EntityStatus = "active" | "inactive";

export interface ManufacturingCompany {
  id: string;
  name: string;
  code: string;
  address: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  status: EntityStatus;
  createdAt: Date;
}

export interface PlantLocation {
  id: string;
  companyId: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  status: EntityStatus;
  createdAt: Date;
}

export interface ProductionLine {
  id: string;
  plantId: string;
  name: string;
  code: string;
  description: string;
  status: EntityStatus;
  createdAt: Date;
}

export interface MachineMaster {
  id: string;
  lineId: string;
  name: string;
  type: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  ipAddress: string;
  status: EntityStatus;
  installDate: string;
  threshold: number; // target/ideal cycle time (sec) - fixed baseline
  cycleTime: number; // nominal production cycle time (sec) - fixed for this machine
}
