export type UserRole =
  | "super_admin"
  | "oem_admin"
  | "plant_manager"
  | "production_manager"
  | "maintenance_manager"
  | "hr"
  | "operator"
  | "viewer";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  oem: string;
  plant: string;
  avatar?: string;
}export interface Tenant {
  id: string;
  name: string;
  plants: Plant[];
}

export interface Plant {
  id: string;
  name: string;
  lines: string[];
  location: string;
}
