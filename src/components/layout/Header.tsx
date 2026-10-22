import { useState } from "react";
import { Bell, ChevronDown, LogOut, User } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useFilteredAlarms } from "@/hooks/useFilteredData";
import { useMasterDataStore } from "@/stores/masterDataStore";
import { useNavigate } from "react-router-dom";

export default function Header() {
  const { user, logout, selectedOEM, selectedPlant, selectedLine, setSelectedPlant, setSelectedLine } = useAuthStore();
  const filteredAlarms = useFilteredAlarms();
  const activeAlarms = filteredAlarms.filter((a) => a.status === "active").length;
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showPlantMenu, setShowPlantMenu] = useState(false);

  const { companies, plants, lines } = useMasterDataStore();

  const activeCompanies = companies.filter((c) => c.status === "active");
  const selectedCompany = activeCompanies.find((c) => c.name === selectedOEM);
  const companyPlants = selectedCompany ? plants.filter((p) => p.companyId === selectedCompany.id && p.status === "active") : [];
  const selectedPlantObj = companyPlants.find((p) => p.name === selectedPlant);
  const plantLines = selectedPlantObj ? lines.filter((l) => l.plantId === selectedPlantObj.id && l.status === "active") : [];
  const allLines = ["All Lines", ...plantLines.map((l) => l.name)];

  const isSuperAdmin = user?.role === "super_admin";

  const handleCompanyChange = (companyName: string) => {
    const company = activeCompanies.find((c) => c.name === companyName);
    if (company) {
      useAuthStore.setState({ selectedOEM: company.name });
      const firstPlant = plants.find((p) => p.companyId === company.id && p.status === "active");
      if (firstPlant) {
        setSelectedPlant(firstPlant.name);
        setSelectedLine("All Lines");
      }
    }
  };

  const handlePlantChange = (plantName: string) => {
    setSelectedPlant(plantName);
    setSelectedLine("All Lines");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="h-14 bg-industrial-surface border-b border-industrial-border flex items-center px-4 gap-4 flex-shrink-0">
      {/* Company Selector */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground text-xs">Company:</span>
        {isSuperAdmin ? (
          <div className="relative">
            <button
              onClick={() => setShowPlantMenu(!showPlantMenu)}
              className="flex items-center gap-1 text-xs font-medium text-white hover:text-brand-primary transition-colors"
            >
              {selectedOEM}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showPlantMenu && (
              <div className="absolute top-6 left-0 bg-industrial-card border border-industrial-border rounded-lg shadow-xl py-1 z-50 min-w-[180px]">
                {activeCompanies.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { handleCompanyChange(c.name); setShowPlantMenu(false); }}
                    className="block w-full text-left px-3 py-2 text-xs hover:bg-industrial-hover text-white"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <span className="text-white font-medium text-xs">{selectedOEM}</span>
        )}

        <span className="text-muted-foreground/40 mx-1">|</span>

        <span className="text-muted-foreground text-xs">Plant:</span>
        <div className="relative">
          <button
            onClick={() => setShowPlantMenu(false)}
            className="flex items-center gap-1 text-xs font-medium text-white hover:text-brand-primary transition-colors"
          >
            {selectedPlant}
          </button>
          <select
            value={selectedPlant}
            onChange={(e) => handlePlantChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full"
          >
            {companyPlants.map((p) => (
              <option key={p.id} value={p.name} className="bg-industrial-card">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <span className="text-muted-foreground/40 mx-1">|</span>

        <span className="text-muted-foreground text-xs">Line:</span>
        <select
          value={selectedLine}
          onChange={(e) => setSelectedLine(e.target.value)}
          className="bg-transparent text-xs font-medium text-white border-none outline-none cursor-pointer"
        >
          {allLines.map((l) => (
            <option key={l} value={l} className="bg-industrial-card">
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1" />

      {/* Live indicator */}
      <span className="live-indicator text-[11px]">LIVE</span>

      {/* Alarms */}
      <button
        onClick={() => navigate("/alarms")}
        className="relative p-2 rounded-md hover:bg-industrial-hover transition-colors"
      >
        <Bell className="w-4 h-4 text-muted-foreground" />
        {activeAlarms > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-status-down text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {activeAlarms}
          </span>
        )}
      </button>

      {/* User */}
      <div className="relative">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-industrial-hover transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-brand-primary" />
          </div>
          <div className="text-left">
            <div className="text-xs font-medium text-white">{user?.name}</div>
            <div className="text-[10px] text-muted-foreground capitalize">{user?.role?.replace("_", " ")}</div>
          </div>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
        {showUserMenu && (
          <div className="absolute right-0 top-10 bg-industrial-card border border-industrial-border rounded-lg shadow-xl py-1 z-50 min-w-[140px]">
            <div className="px-3 py-2 border-b border-industrial-border">
              <div className="text-xs font-medium text-white">{user?.email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-status-down hover:bg-industrial-hover"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
