export interface ItemType {
  id: string;
  nameAr: string;
  nameEn: string;
  category: 'devices' | 'papers' | 'sim' | 'accessories';
  unitsPerBox: number;
  isActive: boolean;
  sortOrder: number;
}

export const ITEM_TYPES: ItemType[] = [
  {
    id: 'n950',
    nameAr: 'N950',
    nameEn: 'N950',
    category: 'devices',
    unitsPerBox: 10,
    isActive: true,
    sortOrder: 1
  },
  {
    id: 'i9000s',
    nameAr: 'I9000S',
    nameEn: 'I9000S',
    category: 'devices',
    unitsPerBox: 10,
    isActive: true,
    sortOrder: 2
  },
  {
    id: 'i9100',
    nameAr: 'I9100',
    nameEn: 'I9100',
    category: 'devices',
    unitsPerBox: 10,
    isActive: true,
    sortOrder: 3
  },
  {
    id: 'rollPaper',
    nameAr: 'ورق الطباعة',
    nameEn: 'Roll Paper',
    category: 'papers',
    unitsPerBox: 50,
    isActive: true,
    sortOrder: 4
  },
  {
    id: 'stickers',
    nameAr: 'الملصقات',
    nameEn: 'Stickers',
    category: 'papers',
    unitsPerBox: 100,
    isActive: true,
    sortOrder: 5
  },
  {
    id: 'newBatteries',
    nameAr: 'البطاريات الجديدة',
    nameEn: 'New Batteries',
    category: 'accessories',
    unitsPerBox: 20,
    isActive: true,
    sortOrder: 6
  },
  {
    id: 'mobilySim',
    nameAr: 'شريحة موبايلي',
    nameEn: 'Mobily SIM',
    category: 'sim',
    unitsPerBox: 50,
    isActive: true,
    sortOrder: 7
  },
  {
    id: 'stcSim',
    nameAr: 'شريحة STC',
    nameEn: 'STC SIM',
    category: 'sim',
    unitsPerBox: 50,
    isActive: true,
    sortOrder: 8
  },
  {
    id: 'zainSim',
    nameAr: 'شريحة زين',
    nameEn: 'Zain SIM',
    category: 'sim',
    unitsPerBox: 50,
    isActive: true,
    sortOrder: 9
  },
  {
    id: 'lebaraSim',
    nameAr: 'شريحة ليبارا',
    nameEn: 'Lebara SIM',
    category: 'sim',
    unitsPerBox: 50,
    isActive: true,
    sortOrder: 10
  }
];

export const getItemTypeById = (id: string): ItemType | undefined => {
  return ITEM_TYPES.find(item => item.id === id);
};

export const getItemNameAr = (id: string): string => {
  const item = getItemTypeById(id);
  return item?.nameAr || id;
};

export const getActiveItemTypes = (): ItemType[] => {
  return ITEM_TYPES.filter(item => item.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
};

export const getItemTypesByCategory = (category: ItemType['category']): ItemType[] => {
  return ITEM_TYPES.filter(item => item.category === category && item.isActive);
};

export const ITEM_CATEGORIES = {
  devices: { nameAr: 'الأجهزة', nameEn: 'Devices' },
  papers: { nameAr: 'الورقيات', nameEn: 'Papers' },
  sim: { nameAr: 'شرائح الاتصال', nameEn: 'SIM Cards' },
  accessories: { nameAr: 'الإكسسوارات', nameEn: 'Accessories' }
} as const;
