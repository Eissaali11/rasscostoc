import { useQuery } from "@tanstack/react-query";
import { Smartphone, FileText, Battery, Package, CreditCard } from "lucide-react";

export interface ItemType {
  id: string;
  nameAr: string;
  nameEn: string;
  category: string;
  unitsPerBox: number;
  isActive: boolean;
  isVisible: boolean;
  sortOrder: number;
}

export interface InventoryEntry {
  itemTypeId: string;
  boxes: number;
  units: number;
}

const categoryIcons: Record<string, any> = {
  devices: Smartphone,
  papers: FileText,
  accessories: Battery,
  sim: CreditCard,
  other: Package,
};

const categoryGradients: Record<string, string[]> = {
  devices: [
    "from-blue-500 to-blue-600",
    "from-purple-500 to-violet-600",
    "from-pink-500 to-rose-600",
    "from-indigo-500 to-blue-600",
  ],
  papers: [
    "from-amber-500 to-orange-600",
    "from-teal-500 to-cyan-600",
  ],
  accessories: [
    "from-emerald-500 to-green-600",
    "from-lime-500 to-green-600",
  ],
  sim: [
    "from-cyan-500 to-sky-600",
    "from-indigo-500 to-blue-600",
    "from-orange-500 to-red-600",
    "from-pink-500 to-rose-600",
    "from-violet-500 to-purple-600",
  ],
  other: [
    "from-gray-500 to-slate-600",
  ],
};

const categoryColors: Record<string, string[]> = {
  devices: ["#3b82f6", "#8b5cf6", "#ec4899", "#6366f1"],
  papers: ["#f59e0b", "#14b8a6"],
  accessories: ["#10b981", "#84cc16"],
  sim: ["#06b6d4", "#6366f1", "#f97316", "#ec4899", "#8b5cf6"],
  other: ["#6b7280"],
};

export function useActiveItemTypes() {
  return useQuery<ItemType[]>({
    queryKey: ["/api/item-types/active"],
  });
}

export function useAllItemTypes() {
  return useQuery<ItemType[]>({
    queryKey: ["/api/item-types"],
  });
}

export function getItemTypeVisuals(itemType: ItemType, index: number = 0) {
  const category = itemType.category || "other";
  const gradients = categoryGradients[category] || categoryGradients.other;
  const colors = categoryColors[category] || categoryColors.other;
  const Icon = categoryIcons[category] || categoryIcons.other;

  return {
    icon: Icon,
    gradient: gradients[index % gradients.length],
    color: colors[index % colors.length],
  };
}

export const legacyFieldMapping: Record<string, { boxes: string; units: string }> = {
  n950: { boxes: "n950Boxes", units: "n950Units" },
  i9000s: { boxes: "i9000sBoxes", units: "i9000sUnits" },
  i9100: { boxes: "i9100Boxes", units: "i9100Units" },
  rollPaper: { boxes: "rollPaperBoxes", units: "rollPaperUnits" },
  stickers: { boxes: "stickersBoxes", units: "stickersUnits" },
  newBatteries: { boxes: "newBatteriesBoxes", units: "newBatteriesUnits" },
  mobilySim: { boxes: "mobilySimBoxes", units: "mobilySimUnits" },
  stcSim: { boxes: "stcSimBoxes", units: "stcSimUnits" },
  zainSim: { boxes: "zainSimBoxes", units: "zainSimUnits" },
  lebaraSim: { boxes: "lebaraBoxes", units: "lebaraUnits" },
};

export function getInventoryValueForItemType(
  itemTypeId: string,
  entries: InventoryEntry[] | undefined | null,
  legacyInventory: Record<string, any> | null | undefined,
  valueType: 'boxes' | 'units'
): number {
  // First check entry tables (ensure entries is an array)
  if (entries && Array.isArray(entries)) {
    const entry = entries.find(e => e.itemTypeId === itemTypeId);
    if (entry) {
      return valueType === 'boxes' ? entry.boxes : entry.units;
    }
  }
  
  // Fall back to legacy columns
  if (legacyInventory) {
    const legacy = legacyFieldMapping[itemTypeId];
    if (legacy) {
      const fieldName = valueType === 'boxes' ? legacy.boxes : legacy.units;
      return (legacyInventory as any)[fieldName] || 0;
    }
  }
  
  return 0;
}

export function buildInventoryDisplayItems(
  itemTypes: ItemType[],
  entries: InventoryEntry[] | undefined | null,
  legacyInventory?: Record<string, number>
) {
  // Ensure entries is an array
  const safeEntries = Array.isArray(entries) ? entries : [];
  const entryMap = new Map(safeEntries.map((e) => [e.itemTypeId, e]));

  const visibleItems = itemTypes
    .filter((t) => t.isActive && t.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const categoryCounters: Record<string, number> = {};

  return visibleItems.map((itemType) => {
    const categoryIndex = categoryCounters[itemType.category] || 0;
    categoryCounters[itemType.category] = categoryIndex + 1;

    const entry = entryMap.get(itemType.id);
    let boxes = entry?.boxes || 0;
    let units = entry?.units || 0;

    if (legacyInventory && !entry) {
      const legacy = legacyFieldMapping[itemType.id];
      if (legacy) {
        boxes = (legacyInventory as any)[legacy.boxes] || 0;
        units = (legacyInventory as any)[legacy.units] || 0;
      }
    }

    const visuals = getItemTypeVisuals(itemType, categoryIndex);

    return {
      id: itemType.id,
      name: itemType.nameEn,
      nameAr: itemType.nameAr,
      boxes,
      units,
      icon: visuals.icon,
      color: visuals.color,
      gradient: visuals.gradient,
      category: itemType.category,
      unitsPerBox: itemType.unitsPerBox,
    };
  });
}
