import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import ExcelJS from "exceljs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Package,
  Plus,
  Upload,
  Edit2,
  Smartphone,
  FileText,
  CreditCard,
  Battery,
  Save,
  X,
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertTriangle,
  Ban,
  ScrollText,
  ArrowUpLeft
} from "lucide-react";
import type { ItemType as SchemaItemType } from "@shared/schema";

type ItemType = SchemaItemType;
type ItemCategory = "devices" | "papers" | "sim" | "accessories";

const CATEGORIES = [
  { id: 'devices', nameAr: 'الأجهزة', nameEn: 'Devices', icon: Smartphone },
  { id: 'papers', nameAr: 'الورقيات', nameEn: 'Papers', icon: FileText },
  { id: 'sim', nameAr: 'شرائح الاتصال', nameEn: 'SIM Cards', icon: CreditCard },
  { id: 'accessories', nameAr: 'الإكسسوارات', nameEn: 'Accessories', icon: Battery },
];

export default function ItemTypesManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemType | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    id: '',
    nameAr: '',
    nameEn: '',
    category: 'devices' as string,
    unitsPerBox: 10,
    sortOrder: 0,
    icon: '',
    color: '',
  });

  const [isImportingExcel, setIsImportingExcel] = useState(false);

  const { data: itemTypes = [], isLoading } = useQuery<ItemType[]>({
    queryKey: ['/api/item-types'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload: Record<string, any> = {
        nameAr: data.nameAr,
        nameEn: data.nameEn,
        category: data.category,
        unitsPerBox: data.unitsPerBox,
        sortOrder: data.sortOrder,
        isActive: true,
        isVisible: true,
      };
      if (data.id && data.id.trim()) {
        payload.id = data.id.trim();
      }
      return await apiRequest('POST', '/api/item-types', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === 'string' &&
          query.queryKey[0].startsWith('/api/item-types'),
      });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "تم بنجاح",
        description: "تم إضافة الصنف الجديد",
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء إضافة الصنف",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      return await apiRequest('PATCH', `/api/item-types/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === 'string' &&
          query.queryKey[0].startsWith('/api/item-types'),
      });
      setIsDialogOpen(false);
      setEditingItem(null);
      resetForm();
      toast({
        title: "تم بنجاح",
        description: "تم تحديث الصنف",
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء تحديث الصنف",
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await apiRequest('PATCH', `/api/item-types/${id}/toggle-active`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === 'string' &&
          query.queryKey[0].startsWith('/api/item-types'),
      });
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ id, isVisible }: { id: string; isVisible: boolean }) => {
      return await apiRequest('PATCH', `/api/item-types/${id}/toggle-visibility`, { isVisible });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === 'string' &&
          query.queryKey[0].startsWith('/api/item-types'),
      });
    },
  });

  const normalizeCategory = (rawValue?: string): ItemCategory | null => {
    const normalized = (rawValue || "").trim().toLowerCase();
    if (!normalized) return null;

    const map: Record<string, ItemCategory> = {
      devices: "devices",
      device: "devices",
      "الأجهزة": "devices",
      "اجهزة": "devices",
      papers: "papers",
      paper: "papers",
      "الورقيات": "papers",
      "ورقيات": "papers",
      sim: "sim",
      sims: "sim",
      "sim card": "sim",
      "sim cards": "sim",
      "شرائح الاتصال": "sim",
      "شرائح": "sim",
      accessories: "accessories",
      accessory: "accessories",
      "الاكسسوارات": "accessories",
      "الإكسسوارات": "accessories",
    };

    return map[normalized] || null;
  };

  const parseBooleanCell = (rawValue: unknown, defaultValue: boolean): boolean => {
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      return defaultValue;
    }

    const normalized = String(rawValue).trim().toLowerCase();
    if (["true", "1", "yes", "y", "نعم", "مفعل", "مرئي"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "لا", "غير مفعل", "مخفي"].includes(normalized)) return false;
    return defaultValue;
  };

  const parseNumberCell = (rawValue: unknown, defaultValue: number): number => {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return defaultValue;
    return value;
  };

  const buildAutoId = (nameAr: string, rowIndex: number): string => {
    const cleaned = nameAr
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w\u0600-\u06FF-]/g, "")
      .slice(0, 40);

    return `item-${cleaned || "import"}-${rowIndex}`;
  };

  const getHeaderIndex = (headerRow: string[], aliases: string[]): number => {
    const normalizedAliases = aliases.map((alias) => alias.trim().toLowerCase());
    return headerRow.findIndex((cell) => normalizedAliases.includes(cell.trim().toLowerCase()));
  };

  const handleImportExcelFile = async (file: File) => {
    setIsImportingExcel(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error("ملف Excel لا يحتوي على أي ورقة عمل.");
      }

      const headerCellsRaw = worksheet.getRow(1).values as Array<string | number | null>;
      const headerCells = headerCellsRaw
        .slice(1)
        .map((cell) => String(cell ?? "").trim());

      const idCol = getHeaderIndex(headerCells, ["id", "المعرف", "sku"]);
      const nameArCol = getHeaderIndex(headerCells, ["nameAr", "name_ar", "الاسم العربي", "name ar"]);
      const nameEnCol = getHeaderIndex(headerCells, ["nameEn", "name_en", "الاسم الانجليزي", "الاسم الإنجليزي", "name en"]);
      const categoryCol = getHeaderIndex(headerCells, ["category", "الفئة"]);
      const unitsCol = getHeaderIndex(headerCells, ["unitsPerBox", "units_per_box", "units per box", "وحدات لكل كرتون"]);
      const sortCol = getHeaderIndex(headerCells, ["sortOrder", "sort_order", "ترتيب العرض"]);
      const activeCol = getHeaderIndex(headerCells, ["isActive", "is_active", "نشط", "مفعل"]);
      const visibleCol = getHeaderIndex(headerCells, ["isVisible", "is_visible", "مرئي"]);

      if (nameArCol < 0 || categoryCol < 0) {
        throw new Error("الأعمدة الأساسية غير موجودة. يجب أن يحتوي الملف على: nameAr و category على الأقل.");
      }

      let createdCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
        const row = worksheet.getRow(rowNumber);
        const rowValues = (row.values as Array<string | number | null>).slice(1);
        const isEmpty = rowValues.every((value) => String(value ?? "").trim() === "");
        if (isEmpty) continue;

        try {
          const nameAr = String(rowValues[nameArCol] ?? "").trim();
          if (!nameAr) {
            throw new Error("الاسم العربي مطلوب");
          }

          const categoryRaw = String(rowValues[categoryCol] ?? "").trim();
          const category = normalizeCategory(categoryRaw);
          if (!category) {
            throw new Error(`فئة غير صالحة: ${categoryRaw || "(فارغ)"}`);
          }

          const providedId = idCol >= 0 ? String(rowValues[idCol] ?? "").trim() : "";
          const nameEn = nameEnCol >= 0 ? String(rowValues[nameEnCol] ?? "").trim() : "";

          const unitsPerBox = Math.max(1, Math.round(parseNumberCell(rowValues[unitsCol], 10)));
          const sortOrder = Math.max(0, Math.round(parseNumberCell(rowValues[sortCol], rowNumber * 10)));
          const isActive = parseBooleanCell(rowValues[activeCol], true);
          const isVisible = parseBooleanCell(rowValues[visibleCol], true);

          const payload = {
            id: providedId || buildAutoId(nameAr, rowNumber),
            nameAr,
            nameEn: nameEn || nameAr,
            category,
            unitsPerBox,
            sortOrder,
            isActive,
            isVisible,
          };

          await apiRequest("POST", "/api/item-types", payload);
          createdCount += 1;
        } catch (error: any) {
          failedCount += 1;
          errors.push(`سطر ${rowNumber}: ${error?.message || "خطأ غير متوقع"}`);
        }
      }

      if (createdCount > 0) {
        queryClient.invalidateQueries({
          predicate: (query) =>
            typeof query.queryKey[0] === "string" &&
            query.queryKey[0].startsWith("/api/item-types"),
        });
      }

      if (failedCount === 0) {
        toast({
          title: "تم الاستيراد بنجاح",
          description: `تم إنشاء ${createdCount} صنف من ملف Excel.`,
        });
      } else {
        toast({
          title: "تم الاستيراد جزئيًا",
          description: `تم إنشاء ${createdCount} صنف، وفشل ${failedCount} سطر.`,
          variant: "destructive",
        });

        console.error("Item types import errors:", errors);
      }
    } catch (error: any) {
      toast({
        title: "فشل الاستيراد",
        description: error?.message || "تعذر قراءة ملف Excel.",
        variant: "destructive",
      });
    } finally {
      setIsImportingExcel(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleExcelInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void handleImportExcelFile(file);
  };

  const resetForm = () => {
    setFormData({
      id: '',
      nameAr: '',
      nameEn: '',
      category: 'devices',
      unitsPerBox: 10,
      sortOrder: 0,
      icon: '',
      color: '',
    });
  };

  const handleEdit = (item: ItemType) => {
    setEditingItem(item);
    setFormData({
      id: item.id,
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      category: item.category,
      unitsPerBox: item.unitsPerBox,
      sortOrder: item.sortOrder,
      icon: item.icon || '',
      color: item.color || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingItem) {
      updateMutation.mutate({
        id: editingItem.id,
        data: {
          nameAr: formData.nameAr,
          nameEn: formData.nameEn,
          category: formData.category,
          unitsPerBox: formData.unitsPerBox,
          sortOrder: formData.sortOrder,
          icon: formData.icon || undefined,
          color: formData.color || undefined,
        },
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getCategoryInfo = (categoryId: string) => {
    return CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[0];
  };

  const groupedByCategory = itemTypes.reduce((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, ItemType[]>);

  const sortedItemTypes = useMemo(
    () => [...itemTypes].sort((a, b) => a.sortOrder - b.sortOrder),
    [itemTypes],
  );

  const filteredItemTypes = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return sortedItemTypes;

    return sortedItemTypes.filter((item) => {
      const catInfo = getCategoryInfo(item.category);
      return (
        item.id.toLowerCase().includes(keyword) ||
        item.nameAr.toLowerCase().includes(keyword) ||
        item.nameEn.toLowerCase().includes(keyword) ||
        item.category.toLowerCase().includes(keyword) ||
        catInfo.nameAr.toLowerCase().includes(keyword) ||
        catInfo.nameEn.toLowerCase().includes(keyword)
      );
    });
  }, [searchTerm, sortedItemTypes]);

  const stats = useMemo(() => {
    const total = itemTypes.length;
    const active = itemTypes.filter((item) => item.isActive).length;
    const lowVisibility = itemTypes.filter((item) => !item.isVisible).length;
    const inactive = itemTypes.filter((item) => !item.isActive).length;
    return { total, active, lowVisibility, inactive };
  }, [itemTypes]);

  const handleExportCsv = () => {
    if (filteredItemTypes.length === 0) {
      toast({
        title: "لا توجد بيانات",
        description: "لا توجد أصناف لتصديرها",
      });
      return;
    }

    const header = [
      "id",
      "nameAr",
      "nameEn",
      "category",
      "unitsPerBox",
      "sortOrder",
      "isActive",
      "isVisible",
    ];

    const escapeCsv = (value: unknown) => {
      const text = String(value ?? "");
      if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
        return `"${text.replace(/\"/g, '""')}"`;
      }
      return text;
    };

    const rows = filteredItemTypes.map((item) => [
      item.id,
      item.nameAr,
      item.nameEn,
      item.category,
      item.unitsPerBox,
      item.sortOrder,
      item.isActive ? "true" : "false",
      item.isVisible ? "true" : "false",
    ]);

    const csvContent = [header, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `item-types_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "تم التصدير",
      description: "تم تصدير قائمة الأصناف بنجاح",
    });
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="bg-red-500/10 border-red-500/20 max-w-md w-full">
            <CardContent className="p-8 text-center">
              <Package className="h-16 w-16 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">غير مصرح</h2>
              <p className="text-gray-400">هذه الصفحة متاحة فقط لمدير النظام</p>
            </CardContent>
          </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">إدارة الأصناف</h1>
            <p className="text-slate-400">إضافة الأصناف يدويًا أو استيرادها من Excel فقط</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleExcelInputChange}
            />

            <Button asChild variant="outline" className="border-slate-600 bg-slate-800/60 hover:bg-slate-700 text-slate-200">
              <Link href="/system-logs">
                <ScrollText className="h-4 w-4 ml-2" />
                سجل النظام
              </Link>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImportingExcel}
              className="border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
            >
              <Upload className="h-4 w-4 ml-2" />
              {isImportingExcel ? "جاري استيراد Excel..." : "استيراد Excel"}
            </Button>

            <Button
              onClick={() => {
                setEditingItem(null);
                resetForm();
                setIsDialogOpen(true);
              }}
              className="bg-cyan-400 hover:bg-cyan-300 text-slate-900 font-bold"
            >
              <Plus className="h-4 w-4 ml-2" />
              إضافة صنف جديد
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 backdrop-blur-xl p-4 sm:p-5 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث عن صنف، معرف، أو فئة..."
              className="pr-10 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700">
              <Filter className="h-4 w-4 ml-2" />
              تصفية
            </Button>
            <Button variant="outline" className="border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700" onClick={handleExportCsv}>
              <Download className="h-4 w-4 ml-2" />
              تصدير
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rounded-2xl bg-slate-900/45 border-slate-700/60 backdrop-blur-xl overflow-hidden">
            <div className="h-1 bg-cyan-400/80" />
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">الأصناف النشطة</p>
                <p className="text-3xl font-bold text-white">{stats.active}</p>
              </div>
              <div className="size-12 rounded-xl bg-cyan-400/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-slate-900/45 border-slate-700/60 backdrop-blur-xl overflow-hidden">
            <div className="h-1 bg-amber-400/80" />
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">أصناف مخفية</p>
                <p className="text-3xl font-bold text-white">{stats.lowVisibility}</p>
              </div>
              <div className="size-12 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-300">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-slate-900/45 border-slate-700/60 backdrop-blur-xl overflow-hidden">
            <div className="h-1 bg-red-400/80" />
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">أصناف غير مفعلة</p>
                <p className="text-3xl font-bold text-white">{stats.inactive}</p>
              </div>
              <div className="size-12 rounded-xl bg-red-400/15 border border-red-400/30 flex items-center justify-center text-red-300">
                <Ban className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl bg-slate-900/45 border-slate-700/60 backdrop-blur-xl overflow-hidden">
          <CardHeader className="border-b border-slate-700/60 bg-slate-900/40">
            <CardTitle className="text-white flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <Package className="h-5 w-5 text-cyan-300" />
                قائمة الأصناف
              </span>
              <Badge className="bg-cyan-400/15 text-cyan-300 border-cyan-400/25">
                {filteredItemTypes.length} / {stats.total}
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map((idx) => (
                  <Skeleton key={idx} className="h-12 bg-slate-800/60" />
                ))}
              </div>
            ) : filteredItemTypes.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="h-14 w-14 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">لا توجد أصناف مطابقة</h3>
                <p className="text-slate-400">أضف صنفًا يدويًا أو استورد ملف Excel ثم حدّث البحث</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700/60 hover:bg-transparent bg-slate-900/25">
                      <TableHead className="text-right text-slate-400">الصنف</TableHead>
                      <TableHead className="text-right text-slate-400">الفئة</TableHead>
                      <TableHead className="text-right text-slate-400">وحدات/كرتون</TableHead>
                      <TableHead className="text-right text-slate-400">الحالة</TableHead>
                      <TableHead className="text-right text-slate-400">الظهور</TableHead>
                      <TableHead className="text-right text-slate-400">الترتيب</TableHead>
                      <TableHead className="text-right text-slate-400">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItemTypes.map((item) => {
                      const catInfo = getCategoryInfo(item.category);
                      const CatIcon = catInfo.icon;

                      return (
                        <TableRow key={item.id} className="border-slate-700/50 hover:bg-slate-800/35 transition-colors">
                          <TableCell>
                            <div className="flex flex-col">
                              <Link href={`/item-types/${item.id}/details`} className="font-bold text-white hover:text-cyan-300 transition-colors w-fit">
                                {item.nameAr}
                              </Link>
                              <span className="text-xs text-slate-400 font-mono" dir="ltr">SKU: {item.id}</span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge className="bg-cyan-400/15 text-cyan-300 border-cyan-400/25">
                              <CatIcon className="h-3 w-3 ml-1" />
                              {catInfo.nameAr}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-white font-semibold">{item.unitsPerBox}</TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={item.isActive}
                                onCheckedChange={(checked) =>
                                  toggleActiveMutation.mutate({ id: item.id, isActive: checked })
                                }
                                className="data-[state=checked]:bg-emerald-500"
                              />
                              <span className={`text-xs font-bold ${item.isActive ? "text-emerald-400" : "text-red-400"}`}>
                                {item.isActive ? "مفعل" : "غير مفعل"}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={item.isVisible}
                                onCheckedChange={(checked) =>
                                  toggleVisibilityMutation.mutate({ id: item.id, isVisible: checked })
                                }
                                className="data-[state=checked]:bg-cyan-500"
                              />
                              <span className={`text-xs font-bold ${item.isVisible ? "text-cyan-300" : "text-slate-400"}`}>
                                {item.isVisible ? "مرئي" : "مخفي"}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge variant="outline" className="border-slate-600 text-slate-300">{item.sortOrder}</Badge>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button asChild variant="ghost" size="sm" className="text-cyan-300 hover:text-cyan-200 hover:bg-cyan-500/10">
                                <Link href={`/item-types/${item.id}/details`}>
                                  <ArrowUpLeft className="h-4 w-4" />
                                </Link>
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(item)}
                                className="text-cyan-300 hover:text-cyan-200 hover:bg-cyan-500/10"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[#1A1A24] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingItem ? 'تعديل الصنف' : 'إضافة صنف جديد'}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {editingItem ? 'قم بتعديل بيانات الصنف' : 'أدخل بيانات الصنف الجديد'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!editingItem && (
              <div className="space-y-2">
                <Label className="text-gray-300">المعرف (ID) - اختياري</Label>
                <Input
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  placeholder="اتركه فارغاً للإنشاء التلقائي"
                  className="bg-white/5 border-white/10 text-white"
                  dir="ltr"
                />
                <p className="text-xs text-gray-500">اتركه فارغاً وسيتم إنشاء معرف تلقائي</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">الاسم العربي</Label>
                <Input
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  placeholder="اسم الصنف بالعربي"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">الاسم الإنجليزي</Label>
                <Input
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  placeholder="Item Name"
                  className="bg-white/5 border-white/10 text-white"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">الفئة</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A24] border-white/10">
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.id} value={cat.id} className="text-white hover:bg-white/10">
                      {cat.nameAr} ({cat.nameEn})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">وحدات لكل كرتون</Label>
                <Input
                  type="number"
                  value={formData.unitsPerBox}
                  onChange={(e) => setFormData({ ...formData, unitsPerBox: parseInt(e.target.value) || 0 })}
                  className="bg-white/5 border-white/10 text-white"
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">ترتيب العرض</Label>
                <Input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                  className="bg-white/5 border-white/10 text-white"
                  min={0}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                setEditingItem(null);
                resetForm();
              }}
              className="border-white/20 text-gray-300 hover:bg-white/10"
            >
              <X className="h-4 w-4 ml-2" />
              إلغاء
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-[#18B2B0] hover:bg-[#18B2B0]/90"
            >
              <Save className="h-4 w-4 ml-2" />
              {editingItem ? 'حفظ التعديلات' : 'إضافة الصنف'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
