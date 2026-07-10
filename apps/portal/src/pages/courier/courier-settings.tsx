import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Loader2,
  Settings,
  Users,
  MapPin,
  Wifi,
  Building,
  AlertOctagon,
  Search
} from "lucide-react";

interface LookupsResponse {
  cities: Array<{ id: number; name_en: string; name_ar: string }>;
  technicians: Array<{ id: number; name: string; code: string }>;
  simTypes: Array<{ id: number; name: string }>;
  vendorTypes: Array<{ id: number; name: string }>;
  failureReasons: Array<{ id: number; name: string; sortOrder: number }>;
}

type TabKey = "technicians" | "cities" | "simTypes" | "vendorTypes" | "failureReasons";

export default function CourierSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("technicians");
  const [search, setSearch] = useState("");

  const { data: lookups, isLoading } = useQuery<LookupsResponse>({
    queryKey: ["/api/courier/lookups"],
    queryFn: () => apiRequest("GET", "/api/courier/lookups").then((r) => r.json())
  });

  const getFilteredItems = () => {
    if (!lookups) return [];
    const query = search.toLowerCase();
    
    switch (activeTab) {
      case "technicians":
        return lookups.technicians.filter(
          (t) =>
            (t.name || "").toLowerCase().includes(query) ||
            (t.code || "").toLowerCase().includes(query)
        );
      case "cities":
        return lookups.cities.filter(
          (c) =>
            (c.name_en || "").toLowerCase().includes(query) ||
            (c.name_ar || "").includes(query)
        );
      case "simTypes":
        return lookups.simTypes.filter((s) => (s.name || "").toLowerCase().includes(query));
      case "vendorTypes":
        return lookups.vendorTypes.filter((v) => (v.name || "").toLowerCase().includes(query));
      case "failureReasons":
        return lookups.failureReasons.filter((f) => (f.name || "").toLowerCase().includes(query));
      default:
        return [];
    }
  };

  const tabs = [
    { key: "technicians", label: "الفنيين", icon: Users },
    { key: "cities", label: "المدن والمناطق", icon: MapPin },
    { key: "simTypes", label: "شرائح الاتصال", icon: Wifi },
    { key: "vendorTypes", label: "الشركات المصنعة", icon: Building },
    { key: "failureReasons", label: "أسباب الفشل", icon: AlertOctagon }
  ];

  const filtered = getFilteredItems();

  return (
    <div dir="rtl" className="space-y-6 text-slate-100 max-w-4xl">
      {/* Title */}
      <div className="border-b border-slate-700/60 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-cyan-400" />
          تهيئة الإعدادات وجداول المطابقة
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          قوائم المطابقة والتحقق المعتمدة للفنيين، المدن، مزودي الشرائح، والشركات المصنعة.
        </p>
      </div>

      {/* Tabs list */}
      <div className="flex flex-wrap gap-2 border-b border-slate-700/65 pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as TabKey);
                setSearch("");
              }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 ${
                active
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/10"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search Filter */}
      <div className="flex items-center gap-3 max-w-sm bg-[#1a3636] border border-slate-700/60 rounded-xl px-3 py-1.5 focus-within:border-cyan-400/80 transition-colors">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث في القائمة..."
          className="w-full bg-transparent border-0 text-slate-100 text-sm focus:outline-none focus:ring-0 placeholder:text-slate-500"
        />
      </div>

      {/* List content */}
      <div className="bg-[#1a3636] border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-10 text-center text-slate-450">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
              جاري تحميل قوائم التهيئة...
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-550">
            لا توجد سجلات مطابقة للبحث.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {activeTab === "technicians" &&
              (filtered as any[]).map((tech) => (
                <div key={tech.id} className="p-4 flex items-center justify-between hover:bg-slate-850/10 transition-colors">
                  <span className="font-semibold text-slate-200">{tech.name}</span>
                  <span className="text-xs font-mono text-cyan-400 px-2.5 py-1 bg-cyan-500/10 rounded-lg">
                    رمز: {tech.code}
                  </span>
                </div>
              ))}

            {activeTab === "cities" &&
              (filtered as any[]).map((city) => (
                <div key={city.id} className="p-4 flex items-center justify-between hover:bg-slate-850/10 transition-colors">
                  <span className="font-semibold text-slate-200">{city.name_ar}</span>
                  <span className="text-sm font-mono text-slate-400">{city.name_en}</span>
                </div>
              ))}

            {activeTab === "simTypes" &&
              (filtered as any[]).map((sim) => (
                <div key={sim.id} className="p-4 flex items-center justify-between hover:bg-slate-850/10 transition-colors">
                  <span className="font-semibold text-slate-200">{sim.name}</span>
                  <span className="text-xs text-slate-500">مُعرّف: #{sim.id}</span>
                </div>
              ))}

            {activeTab === "vendorTypes" &&
              (filtered as any[]).map((vendor) => (
                <div key={vendor.id} className="p-4 flex items-center justify-between hover:bg-slate-850/10 transition-colors">
                  <span className="font-semibold text-slate-200">{vendor.name}</span>
                  <span className="text-xs text-slate-500">مُعرّف: #{vendor.id}</span>
                </div>
              ))}

            {activeTab === "failureReasons" &&
              (filtered as any[]).map((reason) => (
                <div key={reason.id} className="p-4 flex items-center justify-between hover:bg-slate-850/10 transition-colors">
                  <span className="font-semibold text-slate-200">{reason.name}</span>
                  <span className="text-xs text-slate-400">الترتيب: {reason.sortOrder}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
