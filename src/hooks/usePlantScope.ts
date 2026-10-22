import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useMasterDataStore } from "@/stores/masterDataStore";

export interface PlantScope {
  canManage: boolean;
  availablePlants: ReturnType<typeof useMasterDataStore.getState>["plants"];
  plantId: string;
  setPlantId: (id: string) => void;
  plant: ReturnType<typeof useMasterDataStore.getState>["plants"][number] | null;
}

// Shifts, shift reports and the HR screens are all plant-wise, so they share the
// same role scoping: super admin sees every plant, OEM admin sees their company's
// plants, plant manager and HR see only their own plant.
export function usePlantScope(): PlantScope {
  const user = useAuthStore((s) => s.user);
  const companies = useMasterDataStore((s) => s.companies);
  const plants = useMasterDataStore((s) => s.plants);

  const isSuperAdmin = user?.role === "super_admin";
  const isOemAdmin = user?.role === "oem_admin";
  const isPlantManager = user?.role === "plant_manager";
  const isHr = user?.role === "hr";
  const canManage = isSuperAdmin || isOemAdmin || isPlantManager || isHr;

  const availablePlants = useMemo(() => {
    if (isOemAdmin) {
      const company = companies.find((c) => c.name === user?.oem);
      return company ? plants.filter((p) => p.companyId === company.id) : [];
    }
    if (isPlantManager || isHr) return plants.filter((p) => p.name === user?.plant);
    return plants;
  }, [plants, companies, isOemAdmin, isPlantManager, isHr, user?.oem, user?.plant]);

  const [plantId, setPlantId] = useState("");

  useEffect(() => {
    if (plantId || availablePlants.length === 0) return;
    const preferred = availablePlants.find((p) => p.name === user?.plant) || availablePlants[0];
    setPlantId(preferred.id);
  }, [availablePlants, plantId, user?.plant]);

  const plant = useMemo(
    () => availablePlants.find((p) => p.id === plantId) || null,
    [availablePlants, plantId]
  );

  return { canManage, availablePlants, plantId, setPlantId, plant };
}
