import { useTranslation, t } from "@/lib/language";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  Calculator,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Landmark,
  Plus,
  Receipt,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { saveAs } from "file-saver";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CoaAccount = {
  id: string;
  code: string;
  name_ar: string;
  name_en?: string | null;
  account_type: string;
  is_active: boolean;
};

type JournalEntry = {
  id: string;
  entry_no: string;
  status: string;
  posting_date: string;
  source_type: string;
  total_debit?: number;
  total_credit?: number;
  created_at: string;
};

type SalesInvoice = {
  id: string;
  invoice_no: string;
  status: string;
  taxable_amount: number;
  vat_total: number;
  grand_total: number;
  issue_datetime: string;
  items_summary?: string;
};

type PurchaseBill = {
  id: string;
  bill_no: string;
  status: string;
  taxable_amount: number;
  vat_total: number;
  grand_total: number;
  issue_date: string;
  items_summary?: string;
};

type Payment = {
  id: string;
  voucher_no: string;
  payment_type: "receipt" | "disbursement";
  party_type: "customer" | "supplier";
  method: string;
  amount: number;
  payment_date: string;
  status: string;
};

type VatSummary = {
  outputTax: number;
  inputTax: number;
  netVatPayable: number;
};

type VatTransaction = {
  id: string;
  source_type: string;
  source_id: string;
  taxable_amount: number;
  tax_amount: number;
  direction: "input" | "output";
  created_at: string;
};

type EinvoiceDocument = {
  id: string;
  source_type: string;
  source_id: string;
  invoice_uuid: string;
  zatca_status: string;
  clearance_status: string;
  reporting_status: string;
  created_at: string;
};

type TechnicianSummary = {
  technicianId: string;
  technicianName: string;
  soldQty: number;
  soldAmount: number;
  invoiceCount: number;
};

type ItemSummary = {
  itemTypeId: string;
  itemTypeName: string;
  soldQty: number;
  soldAmount: number;
};

const FINANCE_READ_ROLES = ["admin", "supervisor", "accountant", "finance_manager", "auditor"];
const FINANCE_WRITE_ROLES = ["admin", "accountant", "finance_manager"];

function formatMoney(value: number | undefined): string {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function statusLabel(status: string): string {
  if (["posted", "submitted", "acknowledged"].includes(status)) return t('accounting.posted_1');
  if (status === "draft") return t('accounting.draft');
  if (status === "pending") return t('accounting.pending_1');
  if (status === "retrying") return t('accounting.item_17483');
  if (status === "generated") return t('accounting.item_6400');
  return status;
}

function statusClass(status: string): string {
  if (["posted", "submitted", "acknowledged"].includes(status)) {
    return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30";
  }
  if (["draft", "pending", "generated"].includes(status)) {
    return "bg-amber-500/15 text-amber-300 border border-amber-500/30";
  }
  if (["retrying", "failed"].includes(status)) {
    return "bg-rose-500/15 text-rose-300 border border-rose-500/30";
  }
  return "bg-slate-500/15 text-slate-300 border border-slate-500/30";
}

function toDateInputValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function mapApiError(error: unknown): string {
  if (!(error instanceof Error)) return t('accounting.error');

  if (error.message.includes("Unexpected token '<'")) {
    return t('accounting.completed_receive_data');
  }

  if (error.message.includes("<!DOCTYPE") || error.message.includes("<html")) {
    return t('accounting.route_loading');
  }

  return error.message;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatNumberForPdf(value: number): string {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const chartPalette = {
  cyan: "#22d3ee",
  cyanSoft: "#06b6d4",
  emerald: "#10b981",
  rose: "#fb7185",
  amber: "#f59e0b",
  slate: "#64748b",
};

type AccountingTabValue = "overview" | "coa" | "journal" | "sales" | "purchases" | "payments" | "tax" | "einvoice" | "reports";
type AccentTone = "cyan" | "emerald" | "amber" | "rose" | "violet";

const toneStyles: Record<AccentTone, { iconWrap: string; icon: string; title: string }> = {
  cyan: {
    iconWrap: "border-cyan-400/40 bg-cyan-500/15",
    icon: "text-cyan-200",
    title: "text-cyan-50",
  },
  emerald: {
    iconWrap: "border-emerald-400/40 bg-emerald-500/15",
    icon: "text-emerald-200",
    title: "text-emerald-50",
  },
  amber: {
    iconWrap: "border-amber-400/40 bg-amber-500/15",
    icon: "text-amber-200",
    title: "text-amber-50",
  },
  rose: {
    iconWrap: "border-rose-400/40 bg-rose-500/15",
    icon: "text-rose-200",
    title: "text-rose-50",
  },
  violet: {
    iconWrap: "border-violet-400/40 bg-violet-500/15",
    icon: "text-violet-200",
    title: "text-violet-50",
  },
};

const accountingTabs: Array<{ value: AccountingTabValue; label: string; icon: LucideIcon; tone: AccentTone }> = [
  { value: "overview", label: t('accounting.item_9559'), icon: BarChart3, tone: "cyan" },
  { value: "coa", label: t('accounting.item_19084'), icon: Calculator, tone: "emerald" },
  { value: "journal", label: t('accounting.item_20803'), icon: FileText, tone: "amber" },
  { value: "sales", label: t('accounting.invoices_sales'), icon: Receipt, tone: "cyan" },
  { value: "purchases", label: t('accounting.invoices_purchases'), icon: Landmark, tone: "rose" },
  { value: "payments", label: t('accounting.payments'), icon: ArrowRightLeft, tone: "violet" },
  { value: "tax", label: t('accounting.vat'), icon: ShieldCheck, tone: "emerald" },
  { value: "einvoice", label: t('accounting.invoice_1'), icon: FileCheck2, tone: "amber" },
  { value: "reports", label: t('accounting.reports_1'), icon: FileSpreadsheet, tone: "cyan" },
];

function SectionHeading({ title, icon: Icon, tone = "cyan" }: { title: string; icon: LucideIcon; tone?: AccentTone }): JSX.Element {
  const styles = toneStyles[tone];
  return (
    <CardTitle className={`flex items-center gap-3 text-base font-semibold ${styles.title}`}>
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${styles.iconWrap}`}>
        <Icon className={`h-4 w-4 ${styles.icon}`} />
      </span>
      <span>{title}</span>
    </CardTitle>
  );
}

function renderFinanceTooltip(
  valueFormatter: (value: number) => string,
): (props: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string }) => JSX.Element | null {
  return ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="rounded-xl border border-slate-500/50 bg-slate-950/95 px-3 py-2 text-xs text-slate-200 shadow-2xl backdrop-blur">
        {label && <p className="mb-2 text-[11px] font-bold text-cyan-200">{label}</p>}
        <div className="space-y-1">
          {payload.map((item, index) => (
            <div key={`${item.name || "item"}-${index}`} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color || chartPalette.cyan }} />
                <span>{item.name || t('accounting.value_3')}</span>
              </div>
              <span className="font-semibold text-white">{valueFormatter(Number(item.value || 0))}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };
}

async function fetchOptionalJson<T>(url: string, fallback: T): Promise<T> {
  const token = localStorage.getItem("auth-token");
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });

  if (res.status === 401) {
    throw new Error(t('accounting.item_51205'));
  }

  if (!res.ok) {
    return fallback;
  }

  const text = (await res.text()).trim();
  if (!text) return fallback;

  const contentType = res.headers.get("content-type") || "";
  const looksLikeJson = text.startsWith("{") || text.startsWith("[");
  if (!contentType.includes("application/json") && !looksLikeJson) {
    return fallback;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

async function exportHtmlContainerToPdf(container: HTMLDivElement, fileName: string): Promise<void> {
  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight <= pageHeight) {
      doc.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    } else {
      let heightLeft = imgHeight;
      let position = 0;

      doc.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = -pageHeight + (imgHeight - heightLeft - pageHeight);
        doc.addPage();
        doc.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
    }

    doc.save(fileName);
  } finally {
    document.body.removeChild(container);
  }
}

function formatExcelSheet(
  sheet: ExcelJS.Worksheet,
  options: {
    title?: string;
    subtitle?: string;
    headerRow: number;
    currencyCols?: number[];
    numberCols?: number[];
    dateCols?: number[];
  }
): void {
  const { title, subtitle, headerRow, currencyCols = [], numberCols = [], dateCols = [] } = options;
  const colCount = sheet.columnCount || 1;

  if (title) {
    sheet.insertRow(1, [title]);
    sheet.mergeCells(1, 1, 1, colCount);
    const titleCell = sheet.getCell(1, 1);
    titleCell.font = { bold: true, size: 15, color: { argb: "FFFFFFFF" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F766E" },
    };
    sheet.getRow(1).height = 26;
  }

  if (subtitle) {
    const subtitleRow = title ? 2 : 1;
    sheet.insertRow(subtitleRow, [subtitle]);
    sheet.mergeCells(subtitleRow, 1, subtitleRow, colCount);
    const subtitleCell = sheet.getCell(subtitleRow, 1);
    subtitleCell.font = { size: 11, color: { argb: "FF334155" }, italic: true };
    subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
    subtitleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };
    sheet.getRow(subtitleRow).height = 21;
  }

  const header = sheet.getRow(headerRow);
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0EA5A5" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFFFFFFF" } },
      left: { style: "thin", color: { argb: "FFFFFFFF" } },
      bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
      right: { style: "thin", color: { argb: "FFFFFFFF" } },
    };
  });
  header.height = 22;

  const firstDataRow = headerRow + 1;
  for (let rowIndex = firstDataRow; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    const isEven = rowIndex % 2 === 0;
    row.eachCell((cell) => {
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      if (isEven) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      }
    });
  }

  currencyCols.forEach((col) => {
    for (let rowIndex = firstDataRow; rowIndex <= sheet.rowCount; rowIndex += 1) {
      const cell = sheet.getRow(rowIndex).getCell(col);
      cell.numFmt = '#,##0.00 "SAR"';
    }
  });

  numberCols.forEach((col) => {
    for (let rowIndex = firstDataRow; rowIndex <= sheet.rowCount; rowIndex += 1) {
      const cell = sheet.getRow(rowIndex).getCell(col);
      cell.numFmt = "#,##0.00";
    }
  });

  dateCols.forEach((col) => {
    for (let rowIndex = firstDataRow; rowIndex <= sheet.rowCount; rowIndex += 1) {
      const cell = sheet.getRow(rowIndex).getCell(col);
      cell.numFmt = "yyyy-mm-dd hh:mm";
    }
  });

  sheet.views = [{ rightToLeft: true, state: "frozen", ySplit: headerRow }];
  sheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow, column: colCount },
  };
}

export default function AccountingDashboardPage() {
  const { t, language, dir } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();

  const canReadAccounting = FINANCE_READ_ROLES.includes(user?.role || "");
  const canWriteAccounting = FINANCE_WRITE_ROLES.includes(user?.role || "");

  const [coaForm, setCoaForm] = useState({
    code: "",
    nameAr: "",
    accountType: "asset",
  });

  const [journalForm, setJournalForm] = useState({
    postingDate: toDateInputValue(new Date()),
    sourceType: "manual",
    debitAccountId: "",
    creditAccountId: "",
    amount: "",
    description: "",
  });

  const [salesForm, setSalesForm] = useState({
    description: "",
    qty: "1",
    unitPrice: "",
    discount: "0",
  });

  const [purchaseForm, setPurchaseForm] = useState({
    description: "",
    qty: "1",
    unitCost: "",
    discount: "0",
  });

  const [paymentForm, setPaymentForm] = useState({
    receiptAmount: "",
    disbursementAmount: "",
    receiptMethod: "cash",
    disbursementMethod: "bank",
    referenceNo: "",
  });

  const [allocationForm, setAllocationForm] = useState({
    paymentId: "",
    documentType: "sales_invoice",
    documentId: "",
    allocatedAmount: "",
  });

  const [vatFilter, setVatFilter] = useState({
    from: "",
    to: "",
  });

  const [reportsFilter, setReportsFilter] = useState({
    from: "",
    to: "",
    limit: "10",
  });

  const [einvoiceForm, setEinvoiceForm] = useState({
    sourceType: "sales_invoice",
    sourceId: "",
  });
  const [isExporting, setIsExporting] = useState(false);

  const [allocationRows, setAllocationRows] = useState<Record<string, any[]>>({});

  const vatQuery = `/api/tax/vat-summary${vatFilter.from || vatFilter.to ? `?from=${encodeURIComponent(vatFilter.from)}&to=${encodeURIComponent(vatFilter.to)}` : ""}`;
  const vatTransactionsQuery = `/api/tax/vat-transactions${vatFilter.from || vatFilter.to ? `?from=${encodeURIComponent(vatFilter.from)}&to=${encodeURIComponent(vatFilter.to)}` : ""}`;
  const topTechniciansQuery = `/api/sales/technicians/top?limit=${encodeURIComponent(reportsFilter.limit || "10")}&from=${encodeURIComponent(reportsFilter.from)}&to=${encodeURIComponent(reportsFilter.to)}&metric=soldAmount`;
  const topItemsQuery = `/api/sales/items/top?limit=${encodeURIComponent(reportsFilter.limit || "10")}&from=${encodeURIComponent(reportsFilter.from)}&to=${encodeURIComponent(reportsFilter.to)}`;

  const { data: coaRaw, isLoading: isCoaLoading, error: coaError } = useQuery<CoaAccount[]>({
    queryKey: ["/api/accounting/coa"],
    enabled: canReadAccounting,
  });

  const { data: journalsRaw, isLoading: isJournalsLoading, error: journalsError } = useQuery<JournalEntry[]>({
    queryKey: ["/api/accounting/journal-entries"],
    enabled: canReadAccounting,
  });

  const { data: salesInvoicesRaw, isLoading: isSalesLoading, error: salesError } = useQuery<SalesInvoice[]>({
    queryKey: ["/api/sales/invoices"],
    enabled: canReadAccounting,
  });

  const { data: purchaseBillsRaw, isLoading: isPurchasesLoading, error: purchasesError } = useQuery<PurchaseBill[]>({
    queryKey: ["/api/purchases/bills"],
    enabled: canReadAccounting,
  });

  const { data: paymentsRaw, isLoading: isPaymentsLoading, error: paymentsError } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
    enabled: canReadAccounting,
    queryFn: () => fetchOptionalJson<Payment[]>("/api/payments", []),
  });

  const { data: vatSummaryRaw, isLoading: isVatLoading, error: vatError } = useQuery<VatSummary>({
    queryKey: [vatQuery],
    enabled: canReadAccounting,
  });

  const { data: vatTransactionsRaw, isLoading: isVatTxLoading, error: vatTxError } = useQuery<VatTransaction[]>({
    queryKey: [vatTransactionsQuery],
    enabled: canReadAccounting,
  });

  const { data: einvoiceRaw, isLoading: isEinvoiceLoading, error: einvoiceError } = useQuery<EinvoiceDocument[]>({
    queryKey: ["/api/einvoice?limit=100"],
    enabled: canReadAccounting,
    queryFn: () => fetchOptionalJson<EinvoiceDocument[]>("/api/einvoice?limit=100", []),
  });

  const { data: topTechniciansRaw, isLoading: isTopTechLoading, error: topTechError } = useQuery<TechnicianSummary[]>({
    queryKey: [topTechniciansQuery],
    enabled: canReadAccounting,
  });

  const { data: topItemsRaw, isLoading: isTopItemsLoading, error: topItemsError } = useQuery<ItemSummary[]>({
    queryKey: [topItemsQuery],
    enabled: canReadAccounting,
  });

  const coa = Array.isArray(coaRaw) ? coaRaw : [];
  const journals = Array.isArray(journalsRaw) ? journalsRaw : [];
  const salesInvoices = Array.isArray(salesInvoicesRaw) ? salesInvoicesRaw : [];
  const purchaseBills = Array.isArray(purchaseBillsRaw) ? purchaseBillsRaw : [];
  const payments = Array.isArray(paymentsRaw) ? paymentsRaw : [];
  const vatSummary = vatSummaryRaw && typeof vatSummaryRaw === "object" ? vatSummaryRaw : undefined;
  const vatTransactions = Array.isArray(vatTransactionsRaw) ? vatTransactionsRaw : [];
  const einvoiceDocuments = Array.isArray(einvoiceRaw) ? einvoiceRaw : [];
  const topTechnicians = Array.isArray(topTechniciansRaw) ? topTechniciansRaw : [];
  const topItems = Array.isArray(topItemsRaw) ? topItemsRaw : [];

  const apiErrors = [
    coaError,
    journalsError,
    salesError,
    purchasesError,
    paymentsError,
    vatError,
    vatTxError,
    einvoiceError,
    topTechError,
    topItemsError,
  ]
    .filter(Boolean)
    .map((error) => mapApiError(error));

  const totals = useMemo(() => {
    const salesTotal = salesInvoices.reduce((sum, row) => sum + Number(row.grand_total || 0), 0);
    const purchaseTotal = purchaseBills.reduce((sum, row) => sum + Number(row.grand_total || 0), 0);
    const receiptsTotal = payments
      .filter((payment) => payment.payment_type === "receipt")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const disbursementsTotal = payments
      .filter((payment) => payment.payment_type === "disbursement")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    return {
      salesTotal,
      purchaseTotal,
      receiptsTotal,
      disbursementsTotal,
      journalsPosted: journals.filter((entry) => entry.status === "posted").length,
      coaActive: coa.filter((account) => account.is_active).length,
    };
  }, [salesInvoices, purchaseBills, payments, journals, coa]);

  const monthTrend = useMemo(() => {
    const monthMap = new Map<string, { month: string; sales: number; purchases: number }>();

    const addMonth = (dateLike: string, kind: "sales" | "purchases", amount: number) => {
      const d = new Date(dateLike);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, {
          month: d.toLocaleDateString("ar-SA", { month: "short", year: "2-digit" }),
          sales: 0,
          purchases: 0,
        });
      }
      const row = monthMap.get(key)!;
      row[kind] += Number(amount || 0);
    };

    salesInvoices.forEach((row) => addMonth(row.issue_datetime, "sales", row.grand_total));
    purchaseBills.forEach((row) => addMonth(row.issue_date, "purchases", row.grand_total));

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([, value]) => ({
        ...value,
        net: value.sales - value.purchases,
      }));
  }, [salesInvoices, purchaseBills]);

  const paymentMix = useMemo(() => {
    return [
      {
        name: t('accounting.receipt'),
        value: payments
          .filter((p) => p.payment_type === "receipt")
          .reduce((sum, p) => sum + Number(p.amount || 0), 0),
      },
      {
        name: t('accounting.disbursement'),
        value: payments
          .filter((p) => p.payment_type === "disbursement")
          .reduce((sum, p) => sum + Number(p.amount || 0), 0),
      },
    ];
  }, [payments]);

  const journalStatusMix = useMemo(() => {
    const posted = journals.filter((j) => j.status === "posted").length;
    const draft = journals.filter((j) => j.status === "draft").length;
    const other = Math.max(0, journals.length - posted - draft);
    return [
      { name: t('accounting.posted_1'), value: posted },
      { name: t('accounting.draft'), value: draft },
      { name: t('accounting.other'), value: other },
    ];
  }, [journals]);

  const topTechniciansChart = useMemo(() => {
    return topTechnicians.slice(0, 6).map((row, index) => ({
      ...row,
      rank: index + 1,
      shortName: row.technicianName || t('accounting.item_7392', { var_0: index + 1 }),
      soldAmount: Number(row.soldAmount || 0),
    }));
  }, [topTechnicians]);

  const paymentTotal = useMemo(
    () => paymentMix.reduce((sum, row) => sum + Number(row.value || 0), 0),
    [paymentMix],
  );

  const journalTotal = useMemo(
    () => journalStatusMix.reduce((sum, row) => sum + Number(row.value || 0), 0),
    [journalStatusMix],
  );

  const einvoiceStatusCounts = useMemo(() => {
    const summary = {
      total: einvoiceDocuments.length,
      submitted: 0,
      pending: 0,
      retrying: 0,
    };

    einvoiceDocuments.forEach((doc) => {
      if (["submitted", "acknowledged"].includes(doc.zatca_status)) {
        summary.submitted += 1;
      } else if (doc.zatca_status === "retrying") {
        summary.retrying += 1;
      } else {
        summary.pending += 1;
      }
    });

    return summary;
  }, [einvoiceDocuments]);

  const topTechnicianAmount = Number(topTechnicians[0]?.soldAmount || 0);
  const topItemAmount = Number(topItems[0]?.soldAmount || 0);

  const refreshAll = () => {
    const keys = [
      ["/api/accounting/coa"],
      ["/api/accounting/journal-entries"],
      ["/api/sales/invoices"],
      ["/api/purchases/bills"],
      ["/api/payments"],
      [vatQuery],
      [vatTransactionsQuery],
      ["/api/einvoice?limit=100"],
      [topTechniciansQuery],
      [topItemsQuery],
    ];
    keys.forEach((queryKey) => {
      queryClient.invalidateQueries({ queryKey });
    });
  };

  const exportReports = async (mode: "summary" | "top"): Promise<void> => {
    try {
      if (mode === "top" && topTechnicians.length === 0 && topItems.length === 0) {
        toast({
          title: t('accounting.no_data'),
          description: t('accounting.no_data_report'),
          variant: "destructive",
        });
        return;
      }

      setIsExporting(true);

      const workbook = new ExcelJS.Workbook();
      const exportDate = new Date();
      const dateLabel = exportDate.toLocaleString("ar-SA");

      const summarySheet = workbook.addWorksheet(t('accounting.item_6380'));
      summarySheet.addRow([t('accounting.report_accounting'), t('accounting.date_export', { var_0: dateLabel })]);
      summarySheet.addRow([t('accounting.item_7944'), t('accounting.value')]);
      summarySheet.addRow([t('accounting.active'), totals.coaActive]);
      summarySheet.addRow([t('accounting.stage'), totals.journalsPosted]);
      summarySheet.addRow([t('accounting.total_sales'), totals.salesTotal]);
      summarySheet.addRow([t('accounting.total_purchases'), totals.purchaseTotal]);
      summarySheet.addRow([t('accounting.total_receipt'), totals.receiptsTotal]);
      summarySheet.addRow([t('accounting.total_disbursement'), totals.disbursementsTotal]);
      summarySheet.addRow([t('accounting.vat_1'), Number(vatSummary?.outputTax || 0)]);
      summarySheet.addRow([t('accounting.vat_2'), Number(vatSummary?.inputTax || 0)]);
      summarySheet.addRow([t('accounting.vat_5'), Number(vatSummary?.netVatPayable || 0)]);
      summarySheet.columns = [{ width: 28 }, { width: 30 }];
      formatExcelSheet(summarySheet, {
        title: t('accounting.report_accounting'),
        subtitle: t('accounting.date_export', { var_0: dateLabel }),
        headerRow: 3,
        currencyCols: [2],
      });

      const topTechSheet = workbook.addWorksheet(t('accounting.item_19185'));
      topTechSheet.addRow([t('accounting.item_9571'), t('accounting.quantity'), t('accounting.sales'), t('accounting.invoices')]);
      topTechnicians.forEach((row) => {
        topTechSheet.addRow([
          row.technicianName || t('accounting.item_11173'),
          Number(row.soldQty || 0),
          Number(row.soldAmount || 0),
          Number(row.invoiceCount || 0),
        ]);
      });
      topTechSheet.columns = [{ width: 26 }, { width: 14 }, { width: 18 }, { width: 18 }];
      formatExcelSheet(topTechSheet, {
        title: t('accounting.report'),
        subtitle: t('accounting.date_export', { var_0: dateLabel }),
        headerRow: 3,
        numberCols: [2, 4],
        currencyCols: [3],
      });

      const topItemsSheet = workbook.addWorksheet(t('accounting.item_17519'));
      topItemsSheet.addRow([t('accounting.item_7975'), t('accounting.quantity'), t('accounting.sales')]);
      topItems.forEach((row) => {
        topItemsSheet.addRow([
          row.itemTypeName || t('accounting.item_11173'),
          Number(row.soldQty || 0),
          Number(row.soldAmount || 0),
        ]);
      });
      topItemsSheet.columns = [{ width: 28 }, { width: 14 }, { width: 18 }];
      formatExcelSheet(topItemsSheet, {
        title: t('accounting.report_1'),
        subtitle: t('accounting.date_export', { var_0: dateLabel }),
        headerRow: 3,
        numberCols: [2],
        currencyCols: [3],
      });

      if (mode === "summary") {
        const salesSheet = workbook.addWorksheet(t('accounting.sales'));
        salesSheet.addRow([t('accounting.number_invoice'), t('accounting.status'), t('accounting.value_1'), t('accounting.vat'), t('accounting.total'), t('accounting.date')]);
        salesInvoices.forEach((invoice) => {
          salesSheet.addRow([
            invoice.invoice_no,
            invoice.status,
            Number(invoice.taxable_amount || 0),
            Number(invoice.vat_total || 0),
            Number(invoice.grand_total || 0),
            invoice.issue_datetime,
          ]);
        });
        salesSheet.columns = [{ width: 22 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 24 }];
        formatExcelSheet(salesSheet, {
          title: t('accounting.invoices_sales'),
          subtitle: t('accounting.date_export', { var_0: dateLabel }),
          headerRow: 3,
          currencyCols: [3, 4, 5],
          dateCols: [6],
        });

        const purchasesSheet = workbook.addWorksheet(t('accounting.purchases'));
        purchasesSheet.addRow([t('accounting.number_invoice'), t('accounting.status'), t('accounting.value_1'), t('accounting.vat'), t('accounting.total'), t('accounting.date')]);
        purchaseBills.forEach((bill) => {
          purchasesSheet.addRow([
            bill.bill_no,
            bill.status,
            Number(bill.taxable_amount || 0),
            Number(bill.vat_total || 0),
            Number(bill.grand_total || 0),
            bill.issue_date,
          ]);
        });
        purchasesSheet.columns = [{ width: 22 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 24 }];
        formatExcelSheet(purchasesSheet, {
          title: t('accounting.invoices_purchases'),
          subtitle: t('accounting.date_export', { var_0: dateLabel }),
          headerRow: 3,
          currencyCols: [3, 4, 5],
          dateCols: [6],
        });

        const vatTxSheet = workbook.addWorksheet(t('accounting.transactions_vat'));
        vatTxSheet.addRow([t('accounting.item_11094'), t('accounting.source'), t('accounting.value_1'), t('accounting.value_vat'), t('accounting.date')]);
        vatTransactions.forEach((row) => {
          vatTxSheet.addRow([
            row.direction,
            row.source_type,
            Number(row.taxable_amount || 0),
            Number(row.tax_amount || 0),
            row.created_at,
          ]);
        });
        vatTxSheet.columns = [{ width: 14 }, { width: 20 }, { width: 16 }, { width: 16 }, { width: 24 }];
        formatExcelSheet(vatTxSheet, {
          title: t('accounting.transactions_vat'),
          subtitle: t('accounting.date_export', { var_0: dateLabel }),
          headerRow: 3,
          currencyCols: [3, 4],
          dateCols: [5],
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(
        blob,
        t('accounting.item_2541', { var_0: mode === "summary" ? t('accounting.report_2') : t('accounting.report_sales'), var_1: exportDate.toISOString().slice(0, 10) })
      );

      toast({ title: t('accounting.completed_export'), description: t('accounting.completed_export_report_succes') });
    } catch (error) {
      toast({ title: t('accounting.error_1'), description: mapApiError(error), variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const exportReportsPdf = async (mode: "summary" | "top"): Promise<void> => {
    try {
      if (mode === "top" && topTechnicians.length === 0 && topItems.length === 0) {
        toast({
          title: t('accounting.no_data'),
          description: t('accounting.no_data_report_1'),
          variant: "destructive",
        });
        return;
      }

      setIsExporting(true);
      const exportDate = new Date();
      const dateLabel = exportDate.toLocaleString("ar-SA");

      const summaryRows = [
        [t('accounting.active'), String(totals.coaActive)],
        [t('accounting.stage'), String(totals.journalsPosted)],
        [t('accounting.total_sales'), `${formatNumberForPdf(totals.salesTotal)} SAR`],
        [t('accounting.total_purchases'), `${formatNumberForPdf(totals.purchaseTotal)} SAR`],
        [t('accounting.total_receipt'), `${formatNumberForPdf(totals.receiptsTotal)} SAR`],
        [t('accounting.total_disbursement'), `${formatNumberForPdf(totals.disbursementsTotal)} SAR`],
        [t('accounting.vat_1'), `${formatNumberForPdf(Number(vatSummary?.outputTax || 0))} SAR`],
        [t('accounting.vat_2'), `${formatNumberForPdf(Number(vatSummary?.inputTax || 0))} SAR`],
        [t('accounting.vat_5'), `${formatNumberForPdf(Number(vatSummary?.netVatPayable || 0))} SAR`],
      ];

      const topTechRows = topTechnicians
        .map(
          (row, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(row.technicianName || t('accounting.item_11173'))}</td>
              <td>${Number(row.soldQty || 0).toLocaleString("en-US")}</td>
              <td>${formatNumberForPdf(Number(row.soldAmount || 0))} SAR</td>
              <td>${Number(row.invoiceCount || 0).toLocaleString("en-US")}</td>
            </tr>
          `
        )
        .join("");

      const topItemsRows = topItems
        .map(
          (row, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(row.itemTypeName || t('accounting.item_11173'))}</td>
              <td>${Number(row.soldQty || 0).toLocaleString("en-US")}</td>
              <td>${formatNumberForPdf(Number(row.soldAmount || 0))} SAR</td>
            </tr>
          `
        )
        .join("");

      const summaryRowsHtml = summaryRows
        .map(
          ([label, value]) => `
            <tr>
              <td>${escapeHtml(label)}</td>
              <td>${escapeHtml(value)}</td>
            </tr>
          `
        )
        .join("");

      const container = document.createElement("div");
      container.style.cssText =
        'position:absolute;left:-9999px;top:0;width:794px;background:#fff;color:#0f172a;font-family: "Noto Kufi Arabic", Arial, sans-serif;direction:${dir};';
      container.innerHTML = `
        <div style="padding:0;">
          <div style="background:linear-gradient(135deg,#0f766e,#0ea5a5);padding:28px 24px;text-align:center;color:#fff;">
            <h1 style="margin:0;font-size:28px;">STOCKPRO</h1>
            <p style="margin:8px 0 0 0;font-size:15px;">${mode === "summary" ? t('accounting.report_3') : t('accounting.report_4')}</p>
            <p style="margin:6px 0 0 0;font-size:12px;opacity:.9;">${t('accounting.export_date_label', { date: escapeHtml(dateLabel) })}</p>
          </div>

          <div style="padding:20px 24px;">
            ${
              mode === "summary"
                ? `
              <h3 style="margin:0 0 10px 0;color:#0f766e;">{t('accounting.item_11185')}</h3>
              <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
                <thead>
                  <tr style="background:#e6fffb;">
                    <th style="text-align:right;padding:8px;border:1px solid #cbd5e1;">{t('accounting.item_7944')}</th>
                    <th style="text-align:right;padding:8px;border:1px solid #cbd5e1;">{t('accounting.value')}</th>
                  </tr>
                </thead>
                <tbody>${summaryRowsHtml}</tbody>
              </table>
            `
                : ""
            }

            <h3 style="margin:0 0 10px 0;color:#0f766e;">${t('accounting.top_distributors')}</h3>
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
              <thead>
                <tr style="background:#e6fffb;">
                  <th style="padding:8px;border:1px solid #cbd5e1;">#</th>
                  <th style="padding:8px;border:1px solid #cbd5e1;">${t('accounting.distributor')}</th>
                  <th style="padding:8px;border:1px solid #cbd5e1;">${t('accounting.quantity')}</th>
                  <th style="padding:8px;border:1px solid #cbd5e1;">${t('accounting.sales')}</th>
                  <th style="padding:8px;border:1px solid #cbd5e1;">${t('accounting.invoice_count')}</th>
                </tr>
              </thead>
              <tbody>${topTechRows || '<tr><td colspan="5" style="padding:8px;border:1px solid #cbd5e1;text-align:center;">' + t('accounting.no_data') + '</td></tr>'}</tbody>
            </table>

            <h3 style="margin:0 0 10px 0;color:#0f766e;">${t('accounting.top_items')}</h3>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#e6fffb;">
                  <th style="padding:8px;border:1px solid #cbd5e1;">#</th>
                  <th style="padding:8px;border:1px solid #cbd5e1;">${t('accounting.item')}</th>
                  <th style="padding:8px;border:1px solid #cbd5e1;">${t('accounting.quantity')}</th>
                  <th style="padding:8px;border:1px solid #cbd5e1;">${t('accounting.sales')}</th>
                </tr>
              </thead>
              <tbody>${topItemsRows || '<tr><td colspan="4" style="padding:8px;border:1px solid #cbd5e1;text-align:center;">' + t('accounting.no_data') + '</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      `;

      const fileDate = exportDate.toISOString().slice(0, 10);
      await exportHtmlContainerToPdf(container, t('accounting.item_2392', { var_0: mode === "summary" ? t('accounting.report_2') : t('accounting.report_sales'), var_1: fileDate }));

      toast({ title: t('accounting.completed_export'), description: t('accounting.completed_export_report_succes_1') });
    } catch (error) {
      toast({ title: t('accounting.error_1'), description: mapApiError(error), variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const exportInvoiceRegister = async (mode: "sales" | "purchases"): Promise<void> => {
    try {
      const rows = mode === "sales" ? salesInvoices : purchaseBills;
      if (rows.length === 0) {
        toast({
          title: t('accounting.no_data'),
          description: mode === "sales" ? t('accounting.no_invoices_sales') : t('accounting.no_invoices_purchases'),
          variant: "destructive",
        });
        return;
      }

      setIsExporting(true);
      const workbook = new ExcelJS.Workbook();
      const exportDate = new Date();
      const dateLabel = exportDate.toLocaleString("ar-SA");

      const registerSheet = workbook.addWorksheet(mode === "sales" ? t('accounting.log_invoices_sales') : t('accounting.log_invoices_purchases'));
      registerSheet.addRow([
        mode === "sales" ? t('accounting.number_invoice') : t('accounting.number_invoice'),
        t('accounting.status'),
        t('accounting.details'),
        t('accounting.value_1'),
        t('accounting.vat'),
        t('accounting.total'),
        t('accounting.date'),
      ]);

      rows.forEach((row) => {
        registerSheet.addRow([
          mode === "sales" ? (row as SalesInvoice).invoice_no : (row as PurchaseBill).bill_no,
          row.status,
          row.items_summary || "-",
          Number(row.taxable_amount || 0),
          Number(row.vat_total || 0),
          Number(row.grand_total || 0),
          mode === "sales" ? (row as SalesInvoice).issue_datetime : (row as PurchaseBill).issue_date,
        ]);
      });

      registerSheet.columns = [
        { width: 22 },
        { width: 14 },
        { width: 42 },
        { width: 16 },
        { width: 14 },
        { width: 16 },
        { width: 24 },
      ];
      formatExcelSheet(registerSheet, {
        title: mode === "sales" ? t('accounting.log_invoices_sales') : t('accounting.log_invoices_purchases'),
        subtitle: t('accounting.date_export', { var_0: dateLabel }),
        headerRow: 3,
        currencyCols: [4, 5, 6],
        dateCols: [7],
      });

      const linesSheet = workbook.addWorksheet(mode === "sales" ? t('accounting.invoices_sales_1') : t('accounting.invoices_purchases_1'));
      linesSheet.addRow([
        t('accounting.number_invoice'),
        t('accounting.status'),
        t('accounting.item_7977'),
        t('accounting.quantity'),
        mode === "sales" ? t('accounting.price_unit') : t('accounting.unit'),
        t('accounting.item_7955'),
        t('accounting.total_1'),
      ]);

      for (const row of rows) {
        const detailsUrl = mode === "sales" ? `/api/sales/invoices/${row.id}` : `/api/purchases/bills/${row.id}`;
        const detailsRes = await apiRequest("GET", detailsUrl);
        const details = await detailsRes.json();
        const detailsLines = Array.isArray(details?.lines) ? details.lines : [];

        if (detailsLines.length === 0) {
          linesSheet.addRow([
            mode === "sales" ? (row as SalesInvoice).invoice_no : (row as PurchaseBill).bill_no,
            row.status,
            "-",
            0,
            0,
            0,
            0,
          ]);
          continue;
        }

        detailsLines.forEach((line: any) => {
          linesSheet.addRow([
            mode === "sales" ? (row as SalesInvoice).invoice_no : (row as PurchaseBill).bill_no,
            row.status,
            line.description || line.item_name_ar || "-",
            Number(line.qty || 0),
            Number(mode === "sales" ? line.unit_price || 0 : line.unit_cost || 0),
            Number(line.discount || 0),
            Number(line.line_total || 0),
          ]);
        });
      }

      linesSheet.columns = [
        { width: 22 },
        { width: 14 },
        { width: 30 },
        { width: 12 },
        { width: 16 },
        { width: 12 },
        { width: 16 },
      ];
      formatExcelSheet(linesSheet, {
        title: mode === "sales" ? t('accounting.invoices_sales_1') : t('accounting.invoices_purchases_1'),
        subtitle: t('accounting.date_export', { var_0: dateLabel }),
        headerRow: 3,
        numberCols: [4],
        currencyCols: [5, 6, 7],
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      saveAs(
        blob,
        t('accounting.item_2541', { var_0: mode === "sales" ? t('accounting.invoices_sales_2') : t('accounting.invoices_purchases_2'), var_1: exportDate.toISOString().slice(0, 10) })
      );

      toast({
        title: t('accounting.completed_export'),
        description: mode === "sales" ? t('accounting.completed_export_invoices_sale') : t('accounting.completed_export_invoices_purc'),
      });
    } catch (error) {
      toast({ title: t('accounting.error_1'), description: mapApiError(error), variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const exportInvoicePdf = async (mode: "sales" | "purchases"): Promise<void> => {
    try {
      const rows = mode === "sales" ? salesInvoices : purchaseBills;
      if (rows.length === 0) {
        toast({
          title: t('accounting.no_data'),
          description: mode === "sales" ? t('accounting.no_invoices_sales') : t('accounting.no_invoices_purchases'),
          variant: "destructive",
        });
        return;
      }

      setIsExporting(true);
      const exportDate = new Date();
      const dateLabel = exportDate.toLocaleString("ar-SA");

      const grandTotal = rows.reduce((sum, row) => sum + Number(row.grand_total || 0), 0);
      const tableRows = rows
        .map((row, index) => {
          const invoiceNo = mode === "sales" ? (row as SalesInvoice).invoice_no : (row as PurchaseBill).bill_no;
          const issueDate = mode === "sales" ? (row as SalesInvoice).issue_datetime : (row as PurchaseBill).issue_date;
          const details = row.items_summary || "-";

          return `
            <tr>
              <td style="padding:8px;border:1px solid #cbd5e1;">${index + 1}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(invoiceNo)}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(statusLabel(row.status))}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(details)}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;">${formatNumberForPdf(Number(row.taxable_amount || 0))} SAR</td>
              <td style="padding:8px;border:1px solid #cbd5e1;">${formatNumberForPdf(Number(row.vat_total || 0))} SAR</td>
              <td style="padding:8px;border:1px solid #cbd5e1;">${formatNumberForPdf(Number(row.grand_total || 0))} SAR</td>
              <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(new Date(issueDate).toLocaleDateString(language === "en" ? "en-US" : "ar-SA"))}</td>
            </tr>
          `;
        })
        .join("");

      const container = document.createElement("div");
      container.style.cssText =
        `position:absolute;left:-9999px;top:0;width:794px;background:#fff;color:#0f172a;font-family: "Noto Kufi Arabic", Arial, sans-serif;direction:${dir};`;
      container.innerHTML = `
        <div style="padding:0;">
          <div style="background:linear-gradient(135deg,#0f766e,#0ea5a5);padding:28px 24px;text-align:center;color:#fff;">
            <h1 style="margin:0;font-size:28px;">STOCKPRO</h1>
            <p style="margin:8px 0 0 0;font-size:15px;">${mode === "sales" ? t('accounting.log_invoices_sales_1') : t('accounting.log_invoices_purchases_1')}</p>
            <p style="margin:6px 0 0 0;font-size:12px;opacity:.9;">${t('accounting.export_date_label', { date: escapeHtml(dateLabel) })}</p>
          </div>

          <div style="padding:20px 24px;">
            <div style="display:flex;gap:10px;margin-bottom:12px;">
              <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:10px 12px;flex:1;">
                <div style="font-size:12px;color:#0f766e;">${t('accounting.invoice_count')}</div>
                <div style="font-size:18px;font-weight:700;">${rows.length}</div>
              </div>
              <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:10px 12px;flex:1;">
                <div style="font-size:12px;color:#0f766e;">${t('accounting.total')}</div>
                <div style="font-size:18px;font-weight:700;">${formatNumberForPdf(grandTotal)} SAR</div>
              </div>
            </div>

            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#e6fffb;">
                  <th style="padding:8px;border:1px solid #cbd5e1;">#</th>
                  <th style="padding:8px;border:1px solid #cbd5e1;">${t('accounting.invoice_number')}</th>
                  <th style="padding:8px;border:1px solid #cbd5e1;">${t('accounting.status')}</th>
                  <th style="padding:8px;border:1px solid #cbd5e1;">${t('accounting.item_details')}</th>
                  <th style="padding:8px;border:1px solid #cbd5e1;">${t('accounting.taxable_amount')}</th>
                  <th style="padding:8px;border:1px solid #cbd5e1;">${t('accounting.vat')}</th>
                  <th style="padding:8px;border:1px solid #cbd5e1;">${t('accounting.total')}</th>
                  <th style="padding:8px;border:1px solid #cbd5e1;">${t('accounting.date')}</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
        </div>
      `;

      const fileDate = exportDate.toISOString().slice(0, 10);
      await exportHtmlContainerToPdf(container, t('accounting.item_2392', { var_0: mode === "sales" ? t('accounting.invoices_sales_2') : t('accounting.invoices_purchases_2'), var_1: fileDate }));

      toast({
        title: t('accounting.completed_export'),
        description: mode === "sales" ? t('accounting.completed_export_invoices_sale_1') : t('accounting.completed_export_invoices_purc_1'),
      });
    } catch (error) {
      toast({ title: t('accounting.error_1'), description: mapApiError(error), variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const createCoaMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/accounting/coa", {
        code: coaForm.code.trim(),
        nameAr: coaForm.nameAr.trim(),
        accountType: coaForm.accountType,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t('accounting.completed'), description: t('accounting.completed_1') });
      setCoaForm({ code: "", nameAr: "", accountType: "asset" });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/coa"] });
    },
    onError: (error) => {
      toast({ title: t('accounting.error_1'), description: mapApiError(error), variant: "destructive" });
    },
  });

  const createJournalMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(journalForm.amount || 0);
      const res = await apiRequest("POST", "/api/accounting/journal-entries", {
        postingDate: journalForm.postingDate,
        sourceType: journalForm.sourceType,
        lines: [
          {
            accountId: journalForm.debitAccountId,
            debit: amount,
            credit: 0,
            description: journalForm.description,
          },
          {
            accountId: journalForm.creditAccountId,
            debit: 0,
            credit: amount,
            description: journalForm.description,
          },
        ],
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t('accounting.completed'), description: t('accounting.completed_pending_new') });
      setJournalForm((prev) => ({ ...prev, amount: "", description: "" }));
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/journal-entries"] });
    },
    onError: (error) => {
      toast({ title: t('accounting.error_1'), description: mapApiError(error), variant: "destructive" });
    },
  });

  const createSalesInvoiceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sales/invoices", {
        invoiceType: "standard",
        notes: t('accounting.accounting_1'),
        lines: [
          {
            description: salesForm.description || t('accounting.sales_3'),
            qty: Number(salesForm.qty || 0),
            unitPrice: Number(salesForm.unitPrice || 0),
            discount: Number(salesForm.discount || 0),
          },
        ],
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t('accounting.completed'), description: t('accounting.completed_invoice_sales') });
      setSalesForm({ description: "", qty: "1", unitPrice: "", discount: "0" });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/invoices"] });
      queryClient.invalidateQueries({ queryKey: [vatQuery] });
    },
    onError: (error) => {
      toast({ title: t('accounting.error_1'), description: mapApiError(error), variant: "destructive" });
    },
  });

  const createPurchaseBillMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/purchases/bills", {
        lines: [
          {
            description: purchaseForm.description || t('accounting.purchases_1'),
            qty: Number(purchaseForm.qty || 0),
            unitCost: Number(purchaseForm.unitCost || 0),
            discount: Number(purchaseForm.discount || 0),
          },
        ],
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t('accounting.completed'), description: t('accounting.completed_invoice_purchases') });
      setPurchaseForm({ description: "", qty: "1", unitCost: "", discount: "0" });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases/bills"] });
      queryClient.invalidateQueries({ queryKey: [vatQuery] });
    },
    onError: (error) => {
      toast({ title: t('accounting.error_1'), description: mapApiError(error), variant: "destructive" });
    },
  });

  const createReceiptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/payments/receipts", {
        partyType: "customer",
        method: paymentForm.receiptMethod,
        amount: Number(paymentForm.receiptAmount || 0),
        referenceNo: paymentForm.referenceNo || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t('accounting.completed'), description: t('accounting.completed_voucher_receipt') });
      setPaymentForm((prev) => ({ ...prev, receiptAmount: "" }));
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
    },
    onError: (error) => {
      toast({ title: t('accounting.error_1'), description: mapApiError(error), variant: "destructive" });
    },
  });

  const createDisbursementMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/payments/disbursements", {
        partyType: "supplier",
        method: paymentForm.disbursementMethod,
        amount: Number(paymentForm.disbursementAmount || 0),
        referenceNo: paymentForm.referenceNo || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t('accounting.completed'), description: t('accounting.completed_voucher_disbursement') });
      setPaymentForm((prev) => ({ ...prev, disbursementAmount: "" }));
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
    },
    onError: (error) => {
      toast({ title: t('accounting.error_1'), description: mapApiError(error), variant: "destructive" });
    },
  });

  const allocatePaymentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/payments/${allocationForm.paymentId}/allocate`, {
        documentType: allocationForm.documentType,
        documentId: allocationForm.documentId,
        allocatedAmount: Number(allocationForm.allocatedAmount || 0),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t('accounting.completed'), description: t('accounting.completed_batch_document') });
      setAllocationForm((prev) => ({ ...prev, allocatedAmount: "" }));
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
    },
    onError: (error) => {
      toast({ title: t('accounting.error_1'), description: mapApiError(error), variant: "destructive" });
    },
  });

  const submitSimpleAction = async (url: string, successMessage: string, keysToRefresh: string[]) => {
    try {
      await apiRequest("POST", url);
      toast({ title: t('accounting.completed'), description: successMessage });
      keysToRefresh.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    } catch (error) {
      toast({ title: t('accounting.error_1'), description: mapApiError(error), variant: "destructive" });
    }
  };

  const loadPaymentAllocations = async (paymentId: string) => {
    try {
      const res = await apiRequest("GET", `/api/payments/${paymentId}/allocations`);
      const data = await res.json();
      setAllocationRows((prev) => ({ ...prev, [paymentId]: Array.isArray(data) ? data : [] }));
    } catch (error) {
      toast({ title: t('accounting.error_1'), description: mapApiError(error), variant: "destructive" });
    }
  };

  const handleCreateCoa = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWriteAccounting) return;
    createCoaMutation.mutate();
  };

  const handleCreateJournal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWriteAccounting) return;
    createJournalMutation.mutate();
  };

  const handleCreateSalesInvoice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWriteAccounting) return;
    createSalesInvoiceMutation.mutate();
  };

  const handleCreatePurchaseBill = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWriteAccounting) return;
    createPurchaseBillMutation.mutate();
  };

  const handleCreateReceipt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWriteAccounting) return;
    createReceiptMutation.mutate();
  };

  const handleCreateDisbursement = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWriteAccounting) return;
    createDisbursementMutation.mutate();
  };

  const handleAllocatePayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWriteAccounting) return;
    allocatePaymentMutation.mutate();
  };

  const handleGenerateEinvoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWriteAccounting) return;
    try {
      await apiRequest("POST", `/api/einvoice/${encodeURIComponent(einvoiceForm.sourceType)}/${encodeURIComponent(einvoiceForm.sourceId)}/generate`);
      toast({ title: t('accounting.completed'), description: t('accounting.completed_document_invoice') });
      setEinvoiceForm((prev) => ({ ...prev, sourceId: "" }));
      queryClient.invalidateQueries({ queryKey: ["/api/einvoice?limit=100"] });
    } catch (error) {
      toast({ title: t('accounting.error_1'), description: mapApiError(error), variant: "destructive" });
    }
  };

  if (!canReadAccounting) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
        <div className="flex items-center gap-3 text-lg font-semibold">
          <AlertTriangle className="h-5 w-5" />
          {t('accounting.no_accounting')}
        </div>
      </div>
    );
  }

  const isLoadingAny =
    isCoaLoading ||
    isJournalsLoading ||
    isSalesLoading ||
    isPurchasesLoading ||
    isPaymentsLoading ||
    isVatLoading ||
    isVatTxLoading ||
    isEinvoiceLoading ||
    isTopTechLoading ||
    isTopItemsLoading;

  return (
    <div
      className="space-y-6 rounded-3xl bg-[radial-gradient(circle_at_top_right,#0f172a_0%,#0b1220_35%,#06090f_100%)] p-4 md:p-6"
      data-testid="accounting-dashboard-page"
    >
      <section className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-slate-900/70 p-6 shadow-[0_20px_80px_-35px_rgba(6,182,212,0.65)] backdrop-blur-xl md:p-8">
        <div className="pointer-events-none absolute -left-10 -top-16 h-48 w-48 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-44 w-44 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.22em] text-cyan-300/90">STOCKPRO FINANCE CONTROL</p>
            <h3 className="mt-3 text-2xl font-black text-white md:text-3xl">{t('accounting.accounting')}</h3>
            <p className="mt-2 max-w-2xl text-sm text-slate-300 md:text-base">
              {t('accounting.ops_subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="border border-emerald-300/30 bg-emerald-400/15 text-emerald-200">
              {isLoadingAny ? t('accounting.update_2') : t('accounting.item_6348')}
            </Badge>
            <Button
              type="button"
              variant="outline"
              onClick={refreshAll}
              className="border-cyan-400/50 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20"
            >
              <RefreshCw className="ml-2 h-4 w-4" />
              {t('accounting.update_all')}
            </Button>
          </div>
        </div>
      </section>

      {apiErrors.length > 0 && (
        <section className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,0.15)]">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            {t('accounting.loading_part_data_accounting')}
          </div>
          <div className="mt-2 space-y-1 text-sm">
            {apiErrors.slice(0, 6).map((message, index) => (
              <p key={`${message}-${index}`}>- {message}</p>
            ))}
          </div>
        </section>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-slate-900/70 p-2 backdrop-blur sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
          {accountingTabs.map((tab) => {
            const styles = toneStyles[tab.tone];
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="group flex min-h-11 items-center justify-center gap-2 rounded-xl border border-transparent px-3 py-2 text-[13px] font-medium text-slate-300 transition-all data-[state=active]:border-cyan-400/40 data-[state=active]:bg-slate-800/85 data-[state=active]:text-white"
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-md border ${styles.iconWrap}`}>
                  <Icon className={`h-3.5 w-3.5 ${styles.icon}`} />
                </span>
                <span className="whitespace-nowrap">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="group relative overflow-hidden border-white/10 bg-slate-900/65 backdrop-blur-xl">
              <div className="pointer-events-none absolute -top-8 -right-8 h-20 w-20 rounded-full bg-cyan-300/20 blur-2xl" />
              <CardHeader className="pb-2">
                <SectionHeading title={t('accounting.active')} icon={Calculator} tone="cyan" />
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-2xl font-black text-white">{totals.coaActive}</p>
                <Calculator className="h-5 w-5 text-cyan-300" />
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden border-white/10 bg-slate-900/65 backdrop-blur-xl">
              <div className="pointer-events-none absolute -top-8 -right-8 h-20 w-20 rounded-full bg-emerald-300/20 blur-2xl" />
              <CardHeader className="pb-2">
                <SectionHeading title={t('accounting.item_22362')} icon={FileText} tone="emerald" />
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-2xl font-black text-white">{totals.journalsPosted}</p>
                <FileText className="h-5 w-5 text-emerald-300" />
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden border-white/10 bg-slate-900/65 backdrop-blur-xl">
              <div className="pointer-events-none absolute -top-8 -right-8 h-20 w-20 rounded-full bg-cyan-300/20 blur-2xl" />
              <CardHeader className="pb-2">
                <SectionHeading title={t('accounting.total_sales')} icon={Receipt} tone="cyan" />
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-lg font-black text-white">{formatMoney(totals.salesTotal)}</p>
                <Receipt className="h-5 w-5 text-cyan-300" />
              </CardContent>
            </Card>

            <Card className="group relative overflow-hidden border-white/10 bg-slate-900/65 backdrop-blur-xl">
              <div className="pointer-events-none absolute -top-8 -right-8 h-20 w-20 rounded-full bg-rose-300/20 blur-2xl" />
              <CardHeader className="pb-2">
                <SectionHeading title={t('accounting.total_purchases')} icon={Landmark} tone="rose" />
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-lg font-black text-white">{formatMoney(totals.purchaseTotal)}</p>
                <Landmark className="h-5 w-5 text-rose-300" />
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card className="border-white/10 bg-slate-900/65 backdrop-blur-xl">
              <CardHeader>
                <SectionHeading title={t('accounting.vat_3')} icon={ShieldCheck} tone="emerald" />
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3"><span>{t('accounting.vat_1')}</span><span className="font-semibold text-white">{formatMoney(vatSummary?.outputTax)}</span></div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3"><span>{t('accounting.vat_2')}</span><span className="font-semibold text-white">{formatMoney(vatSummary?.inputTax)}</span></div>
                <div className="flex items-center justify-between rounded-xl border border-cyan-300/30 bg-cyan-400/10 p-3 text-cyan-100"><span>{t('accounting.item_20718')}</span><span className="font-bold">{formatMoney(vatSummary?.netVatPayable)}</span></div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/65 backdrop-blur-xl">
              <CardHeader>
                <SectionHeading title={t('accounting.item_19155')} icon={ArrowRightLeft} tone="violet" />
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3"><span>{t('accounting.total_vouchers_receipt')}</span><span className="font-semibold text-emerald-300">{formatMoney(totals.receiptsTotal)}</span></div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3"><span>{t('accounting.total_vouchers_disbursement')}</span><span className="font-semibold text-rose-300">{formatMoney(totals.disbursementsTotal)}</span></div>
                <div className="flex items-center justify-between rounded-xl border border-cyan-300/30 bg-cyan-400/10 p-3 text-cyan-100"><span>{t('accounting.transaction')}</span><span className="font-bold">{formatMoney(totals.receiptsTotal - totals.disbursementsTotal)}</span></div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-12">
            <Card className="border-white/10 bg-slate-900/65 backdrop-blur-xl xl:col-span-8">
              <CardHeader>
                <SectionHeading title={t('accounting.item_38209')} icon={BarChart3} tone="cyan" />
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthTrend} margin={{ top: 16, right: 8, left: 0, bottom: 4 }}>
                    <defs>
                      <linearGradient id="salesGradPro" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartPalette.cyan} stopOpacity={0.6} />
                        <stop offset="100%" stopColor={chartPalette.cyan} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="purchaseGradPro" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartPalette.rose} stopOpacity={0.52} />
                        <stop offset="100%" stopColor={chartPalette.rose} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="month" stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} tickFormatter={(value: number) => `${Math.round(Number(value || 0) / 1000)}k`} />
                    <Tooltip content={renderFinanceTooltip((value) => formatMoney(value))} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                    <Area type="monotone" dataKey="sales" name={t('accounting.sales')} stroke={chartPalette.cyan} fill="url(#salesGradPro)" strokeWidth={2.2} />
                    <Area type="monotone" dataKey="purchases" name={t('accounting.purchases')} stroke={chartPalette.rose} fill="url(#purchaseGradPro)" strokeWidth={2.2} />
                    <Line type="monotone" dataKey="net" name={t('accounting.item_9554')} stroke={chartPalette.emerald} strokeWidth={2.4} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/65 backdrop-blur-xl xl:col-span-4">
              <CardHeader>
                <SectionHeading title={t('accounting.item_19185')} icon={BarChart3} tone="amber" />
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topTechniciansChart} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="topTechBarGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={chartPalette.cyanSoft} />
                        <stop offset="100%" stopColor={chartPalette.cyan} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="shortName" width={90} tick={{ fill: "#cbd5e1", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip content={renderFinanceTooltip((value) => formatMoney(value))} />
                    <Bar dataKey="soldAmount" radius={[10, 10, 10, 10]} fill="url(#topTechBarGrad)">
                      <LabelList dataKey="soldAmount" position="right" formatter={(value: number) => `${Math.round(Number(value || 0)).toLocaleString("ar-SA")}`} fill="#e2e8f0" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/65 backdrop-blur-xl xl:col-span-6">
              <CardHeader>
                <SectionHeading title={t('accounting.item_27162')} icon={ArrowRightLeft} tone="violet" />
              </CardHeader>
              <CardContent className="relative h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentMix} dataKey="value" nameKey="name" outerRadius={96} innerRadius={62} stroke="rgba(15,23,42,0.9)">
                      {paymentMix.map((_, index) => (
                        <Cell key={index} fill={index === 0 ? chartPalette.emerald : chartPalette.rose} />
                      ))}
                    </Pie>
                    <Tooltip content={renderFinanceTooltip((value) => formatMoney(value))} />
                    <Legend verticalAlign="bottom" iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                  <p className="text-[11px] text-slate-400">{t('accounting.total_transaction')}</p>
                  <p className="text-lg font-black text-white">{formatMoney(paymentTotal)}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-slate-900/65 backdrop-blur-xl xl:col-span-6">
              <CardHeader>
                <SectionHeading title={t('accounting.status_3')} icon={FileText} tone="amber" />
              </CardHeader>
              <CardContent className="grid h-72 grid-cols-2 gap-2">
                <div className="relative h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={journalStatusMix} dataKey="value" nameKey="name" outerRadius={88} innerRadius={55} stroke="rgba(15,23,42,0.9)">
                        {journalStatusMix.map((_, index) => (
                          <Cell key={index} fill={[chartPalette.cyan, chartPalette.amber, chartPalette.slate][index % 3]} />
                        ))}
                      </Pie>
                      <Tooltip content={renderFinanceTooltip((value) => t('accounting.log', { var_0: Math.round(value).toLocaleString("ar-SA") }))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                    <p className="text-[11px] text-slate-400">{t('accounting.total')}</p>
                    <p className="text-lg font-black text-white">{journalTotal}</p>
                  </div>
                </div>
                <div className="space-y-2 self-center rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
                  {journalStatusMix.map((row, index) => {
                    const color = [chartPalette.cyan, chartPalette.amber, chartPalette.slate][index % 3];
                    const percent = journalTotal > 0 ? Math.round((Number(row.value || 0) / journalTotal) * 100) : 0;
                    return (
                      <div key={row.name}>
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{row.name}</span>
                          <span>{row.value}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-800">
                          <div className="h-1.5 rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="coa" className="space-y-4">
          <Card className="border-slate-700/60 bg-[#173030]">
            <CardHeader>
              <SectionHeading title={t('accounting.add_new')} icon={Calculator} tone="emerald" />
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCoa} className="grid gap-3 md:grid-cols-4">
                <div>
                  <Label htmlFor="coa-code">{t('accounting.code')}</Label>
                  <Input id="coa-code" value={coaForm.code} onChange={(e) => setCoaForm((prev) => ({ ...prev, code: e.target.value }))} required />
                </div>
                <div>
                  <Label htmlFor="coa-name">{t('accounting.name')}</Label>
                  <Input id="coa-name" value={coaForm.nameAr} onChange={(e) => setCoaForm((prev) => ({ ...prev, nameAr: e.target.value }))} required />
                </div>
                <div>
                  <Label htmlFor="coa-type">{t('accounting.type')}</Label>
                  <select
                    id="coa-type"
                    className="h-10 w-full rounded-md border border-slate-700 bg-[#122828] px-3 text-sm text-slate-100"
                    value={coaForm.accountType}
                    onChange={(e) => setCoaForm((prev) => ({ ...prev, accountType: e.target.value }))}
                  >
                    <option value="asset">{t('accounting.item_6372')}</option>
                    <option value="liability">{t('accounting.item_6384')}</option>
                    <option value="equity">{t('accounting.item_14424')}</option>
                    <option value="revenue">{t('accounting.item_7926')}</option>
                    <option value="expense">{t('accounting.item_7988')}</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button type="submit" disabled={!canWriteAccounting || createCoaMutation.isPending} className="w-full">
                    <Plus className="ml-2 h-4 w-4" />
                    {t('accounting.add')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-slate-700/60 bg-[#173030]">
            <CardHeader><SectionHeading title={t('accounting.item_19084')} icon={Calculator} tone="emerald" /></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('accounting.code')}</TableHead>
                    <TableHead>{t('accounting.name_1')}</TableHead>
                    <TableHead>{t('accounting.type')}</TableHead>
                    <TableHead>{t('accounting.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coa.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>{account.code}</TableCell>
                      <TableCell>{account.name_ar}</TableCell>
                      <TableCell>{account.account_type}</TableCell>
                      <TableCell>
                        <Badge className={account.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-500/20 text-slate-300"}>
                          {account.is_active ? t('accounting.active_1') : t('accounting.item_7994')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="journal" className="space-y-4">
          <Card className="border-slate-700/60 bg-[#173030]">
            <CardHeader><SectionHeading title={t('accounting.pending')} icon={FileText} tone="amber" /></CardHeader>
            <CardContent>
              <form onSubmit={handleCreateJournal} className="grid gap-3 md:grid-cols-3">
                <div><Label htmlFor="j-date">{t('accounting.date')}</Label><Input id="j-date" type="date" value={journalForm.postingDate} onChange={(e) => setJournalForm((prev) => ({ ...prev, postingDate: e.target.value }))} required /></div>
                <div><Label htmlFor="j-source">{t('accounting.type_source')}</Label><Input id="j-source" value={journalForm.sourceType} onChange={(e) => setJournalForm((prev) => ({ ...prev, sourceType: e.target.value }))} required /></div>
                <div><Label htmlFor="j-amount">{t('accounting.item_9558')}</Label><Input id="j-amount" type="number" min="0" step="0.01" value={journalForm.amount} onChange={(e) => setJournalForm((prev) => ({ ...prev, amount: e.target.value }))} required /></div>
                <div>
                  <Label htmlFor="j-debit">{t('accounting.item_12755')}</Label>
                  <select id="j-debit" className="h-10 w-full rounded-md border border-slate-700 bg-[#122828] px-3 text-sm text-slate-100" value={journalForm.debitAccountId} onChange={(e) => setJournalForm((prev) => ({ ...prev, debitAccountId: e.target.value }))} required>
                    <option value="">{t('accounting.item_15850')}</option>
                    {coa.map((account) => <option key={`debit-${account.id}`} value={account.id}>{account.code} - {account.name_ar}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="j-credit">{t('accounting.item_12689')}</Label>
                  <select id="j-credit" className="h-10 w-full rounded-md border border-slate-700 bg-[#122828] px-3 text-sm text-slate-100" value={journalForm.creditAccountId} onChange={(e) => setJournalForm((prev) => ({ ...prev, creditAccountId: e.target.value }))} required>
                    <option value="">{t('accounting.item_15850')}</option>
                    {coa.map((account) => <option key={`credit-${account.id}`} value={account.id}>{account.code} - {account.name_ar}</option>)}
                  </select>
                </div>
                <div><Label htmlFor="j-desc">{t('accounting.item_7977')}</Label><Input id="j-desc" value={journalForm.description} onChange={(e) => setJournalForm((prev) => ({ ...prev, description: e.target.value }))} /></div>
                <div className="md:col-span-3"><Button type="submit" disabled={!canWriteAccounting || createJournalMutation.isPending}><Plus className="ml-2 h-4 w-4" />{t('accounting.save_pending')}</Button></div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-slate-700/60 bg-[#173030]">
            <CardHeader><SectionHeading title={t('accounting.item_17624')} icon={FileText} tone="amber" /></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>{t('accounting.number_pending')}</TableHead><TableHead>{t('accounting.date')}</TableHead><TableHead>{t('accounting.source')}</TableHead><TableHead>{t('accounting.item_9583')}</TableHead><TableHead>{t('accounting.item_9517')}</TableHead><TableHead>{t('accounting.status')}</TableHead><TableHead>{t('accounting.item_7882')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {journals.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.entry_no}</TableCell>
                      <TableCell>{new Date(entry.posting_date).toLocaleDateString("ar-SA")}</TableCell>
                      <TableCell>{entry.source_type}</TableCell>
                      <TableCell>{formatMoney(Number(entry.total_debit || 0))}</TableCell>
                      <TableCell>{formatMoney(Number(entry.total_credit || 0))}</TableCell>
                      <TableCell><Badge className={statusClass(entry.status)}>{statusLabel(entry.status)}</Badge></TableCell>
                      <TableCell>
                        {entry.status !== "posted" && (
                          <Button type="button" size="sm" variant="outline" disabled={!canWriteAccounting} onClick={() => submitSimpleAction(`/api/accounting/journal-entries/${entry.id}/post`, t('accounting.completed_pending'), ["/api/accounting/journal-entries"])}>
                            {t('accounting.item_7958')}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          <Card className="border-slate-700/60 bg-[#173030]">
            <CardHeader className="flex flex-row items-center justify-between">
              <SectionHeading title={t('accounting.invoice_sales')} icon={Receipt} tone="cyan" />
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => exportInvoicePdf("sales")} disabled={isExporting}>
                  <Download className="ml-2 h-4 w-4" />
                  PDF
                </Button>
                <Button type="button" variant="outline" onClick={() => exportInvoiceRegister("sales")} disabled={isExporting}>
                  <Download className="ml-2 h-4 w-4" />
                  Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateSalesInvoice} className="grid gap-3 md:grid-cols-5">
                <div><Label htmlFor="s-desc">{t('accounting.item_12774')}</Label><Input id="s-desc" value={salesForm.description} onChange={(e) => setSalesForm((prev) => ({ ...prev, description: e.target.value }))} /></div>
                <div><Label htmlFor="s-qty">{t('accounting.quantity')}</Label><Input id="s-qty" type="number" min="0" step="0.01" value={salesForm.qty} onChange={(e) => setSalesForm((prev) => ({ ...prev, qty: e.target.value }))} required /></div>
                <div><Label htmlFor="s-price">{t('accounting.price_unit')}</Label><Input id="s-price" type="number" min="0" step="0.01" value={salesForm.unitPrice} onChange={(e) => setSalesForm((prev) => ({ ...prev, unitPrice: e.target.value }))} required /></div>
                <div><Label htmlFor="s-discount">{t('accounting.item_4776')}</Label><Input id="s-discount" type="number" min="0" step="0.01" value={salesForm.discount} onChange={(e) => setSalesForm((prev) => ({ ...prev, discount: e.target.value }))} /></div>
                <div className="flex items-end"><Button type="submit" className="w-full" disabled={!canWriteAccounting || createSalesInvoiceMutation.isPending}><Plus className="ml-2 h-4 w-4" />{t('accounting.item_7911')}</Button></div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-slate-700/60 bg-[#173030]">
            <CardHeader><SectionHeading title={t('accounting.invoices_sales')} icon={Receipt} tone="cyan" /></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>{t('accounting.number_invoice')}</TableHead><TableHead>{t('accounting.date')}</TableHead><TableHead>{t('accounting.details')}</TableHead><TableHead>{t('accounting.value_1')}</TableHead><TableHead>{t('accounting.vat')}</TableHead><TableHead>{t('accounting.total')}</TableHead><TableHead>{t('accounting.status')}</TableHead><TableHead>{t('accounting.item_11035')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {salesInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>{invoice.invoice_no}</TableCell>
                      <TableCell>{new Date(invoice.issue_datetime).toLocaleDateString("ar-SA")}</TableCell>
                      <TableCell className="max-w-[280px] whitespace-normal text-xs text-slate-300">{invoice.items_summary || "-"}</TableCell>
                      <TableCell>{formatMoney(invoice.taxable_amount)}</TableCell>
                      <TableCell>{formatMoney(invoice.vat_total)}</TableCell>
                      <TableCell>{formatMoney(invoice.grand_total)}</TableCell>
                      <TableCell><Badge className={statusClass(invoice.status)}>{statusLabel(invoice.status)}</Badge></TableCell>
                      <TableCell className="space-x-2 space-x-reverse">
                        {invoice.status !== "posted" && (
                          <Button type="button" size="sm" variant="outline" disabled={!canWriteAccounting} onClick={() => submitSimpleAction(`/api/sales/invoices/${invoice.id}/post`, t('accounting.completed_invoice_sales_1'), ["/api/sales/invoices", "/api/accounting/journal-entries", vatQuery])}>{t('accounting.item_7958')}</Button>
                        )}
                        <Button type="button" size="sm" variant="outline" disabled={!canWriteAccounting} onClick={() => submitSimpleAction(`/api/sales/invoices/${invoice.id}/credit-note`, t('accounting.completed_2'), ["/api/sales/invoices", "/api/accounting/journal-entries", vatQuery])}>{t('accounting.item_14284')}</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchases" className="space-y-4">
          <Card className="border-slate-700/60 bg-[#173030]">
            <CardHeader className="flex flex-row items-center justify-between">
              <SectionHeading title={t('accounting.invoice_purchases')} icon={Landmark} tone="rose" />
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => exportInvoicePdf("purchases")} disabled={isExporting}>
                  <Download className="ml-2 h-4 w-4" />
                  PDF
                </Button>
                <Button type="button" variant="outline" onClick={() => exportInvoiceRegister("purchases")} disabled={isExporting}>
                  <Download className="ml-2 h-4 w-4" />
                  Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreatePurchaseBill} className="grid gap-3 md:grid-cols-5">
                <div><Label htmlFor="p-desc">{t('accounting.item_12774')}</Label><Input id="p-desc" value={purchaseForm.description} onChange={(e) => setPurchaseForm((prev) => ({ ...prev, description: e.target.value }))} /></div>
                <div><Label htmlFor="p-qty">{t('accounting.quantity')}</Label><Input id="p-qty" type="number" min="0" step="0.01" value={purchaseForm.qty} onChange={(e) => setPurchaseForm((prev) => ({ ...prev, qty: e.target.value }))} required /></div>
                <div><Label htmlFor="p-cost">{t('accounting.unit')}</Label><Input id="p-cost" type="number" min="0" step="0.01" value={purchaseForm.unitCost} onChange={(e) => setPurchaseForm((prev) => ({ ...prev, unitCost: e.target.value }))} required /></div>
                <div><Label htmlFor="p-discount">{t('accounting.item_4776')}</Label><Input id="p-discount" type="number" min="0" step="0.01" value={purchaseForm.discount} onChange={(e) => setPurchaseForm((prev) => ({ ...prev, discount: e.target.value }))} /></div>
                <div className="flex items-end"><Button type="submit" className="w-full" disabled={!canWriteAccounting || createPurchaseBillMutation.isPending}><Plus className="ml-2 h-4 w-4" />{t('accounting.item_7911')}</Button></div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-slate-700/60 bg-[#173030]">
            <CardHeader><SectionHeading title={t('accounting.invoices_purchases')} icon={Landmark} tone="rose" /></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>{t('accounting.number_invoice')}</TableHead><TableHead>{t('accounting.date')}</TableHead><TableHead>{t('accounting.details')}</TableHead><TableHead>{t('accounting.value_1')}</TableHead><TableHead>{t('accounting.vat')}</TableHead><TableHead>{t('accounting.total')}</TableHead><TableHead>{t('accounting.status')}</TableHead><TableHead>{t('accounting.item_11035')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {purchaseBills.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell>{bill.bill_no}</TableCell>
                      <TableCell>{new Date(bill.issue_date).toLocaleDateString("ar-SA")}</TableCell>
                      <TableCell className="max-w-[280px] whitespace-normal text-xs text-slate-300">{bill.items_summary || "-"}</TableCell>
                      <TableCell>{formatMoney(bill.taxable_amount)}</TableCell>
                      <TableCell>{formatMoney(bill.vat_total)}</TableCell>
                      <TableCell>{formatMoney(bill.grand_total)}</TableCell>
                      <TableCell><Badge className={statusClass(bill.status)}>{statusLabel(bill.status)}</Badge></TableCell>
                      <TableCell className="space-x-2 space-x-reverse">
                        {bill.status !== "posted" && (
                          <Button type="button" size="sm" variant="outline" disabled={!canWriteAccounting} onClick={() => submitSimpleAction(`/api/purchases/bills/${bill.id}/post`, t('accounting.completed_invoice_purchases_1'), ["/api/purchases/bills", "/api/accounting/journal-entries", vatQuery])}>{t('accounting.item_7958')}</Button>
                        )}
                        <Button type="button" size="sm" variant="outline" disabled={!canWriteAccounting} onClick={() => submitSimpleAction(`/api/purchases/bills/${bill.id}/debit-note`, t('accounting.completed_3'), ["/api/purchases/bills", "/api/accounting/journal-entries", vatQuery])}>{t('accounting.item_14350')}</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <section className="grid gap-4 xl:grid-cols-2">
            <Card className="border-slate-700/60 bg-[#173030]">
              <CardHeader><SectionHeading title={t('accounting.voucher_receipt_1')} icon={Receipt} tone="emerald" /></CardHeader>
              <CardContent>
                <form onSubmit={handleCreateReceipt} className="grid gap-3 md:grid-cols-3">
                  <div><Label htmlFor="r-amount">{t('accounting.item_9558')}</Label><Input id="r-amount" type="number" min="0" step="0.01" value={paymentForm.receiptAmount} onChange={(e) => setPaymentForm((prev) => ({ ...prev, receiptAmount: e.target.value }))} required /></div>
                  <div><Label htmlFor="r-method">{t('accounting.item_11144')}</Label><Input id="r-method" value={paymentForm.receiptMethod} onChange={(e) => setPaymentForm((prev) => ({ ...prev, receiptMethod: e.target.value }))} required /></div>
                  <div><Label htmlFor="r-ref">{t('accounting.item_6363')}</Label><Input id="r-ref" value={paymentForm.referenceNo} onChange={(e) => setPaymentForm((prev) => ({ ...prev, referenceNo: e.target.value }))} /></div>
                  <div className="md:col-span-3"><Button type="submit" disabled={!canWriteAccounting || createReceiptMutation.isPending}><Receipt className="ml-2 h-4 w-4" />{t('accounting.voucher_receipt')}</Button></div>
                </form>
              </CardContent>
            </Card>

            <Card className="border-slate-700/60 bg-[#173030]">
              <CardHeader><SectionHeading title={t('accounting.voucher_disbursement_1')} icon={ArrowRightLeft} tone="violet" /></CardHeader>
              <CardContent>
                <form onSubmit={handleCreateDisbursement} className="grid gap-3 md:grid-cols-3">
                  <div><Label htmlFor="d-amount">{t('accounting.item_9558')}</Label><Input id="d-amount" type="number" min="0" step="0.01" value={paymentForm.disbursementAmount} onChange={(e) => setPaymentForm((prev) => ({ ...prev, disbursementAmount: e.target.value }))} required /></div>
                  <div><Label htmlFor="d-method">{t('accounting.item_11144')}</Label><Input id="d-method" value={paymentForm.disbursementMethod} onChange={(e) => setPaymentForm((prev) => ({ ...prev, disbursementMethod: e.target.value }))} required /></div>
                  <div><Label htmlFor="d-ref">{t('accounting.item_6363')}</Label><Input id="d-ref" value={paymentForm.referenceNo} onChange={(e) => setPaymentForm((prev) => ({ ...prev, referenceNo: e.target.value }))} /></div>
                  <div className="md:col-span-3"><Button type="submit" disabled={!canWriteAccounting || createDisbursementMutation.isPending}><ArrowRightLeft className="ml-2 h-4 w-4" />{t('accounting.voucher_disbursement')}</Button></div>
                </form>
              </CardContent>
            </Card>
          </section>

          <Card className="border-slate-700/60 bg-[#173030]">
            <CardHeader><SectionHeading title={t('accounting.batch_document')} icon={Calculator} tone="amber" /></CardHeader>
            <CardContent>
              <form onSubmit={handleAllocatePayment} className="grid gap-3 md:grid-cols-4">
                <div>
                  <Label htmlFor="alloc-payment">{t('accounting.voucher_payment_receipt')}</Label>
                  <select id="alloc-payment" className="h-10 w-full rounded-md border border-slate-700 bg-[#122828] px-3 text-sm text-slate-100" value={allocationForm.paymentId} onChange={(e) => setAllocationForm((prev) => ({ ...prev, paymentId: e.target.value }))} required>
                    <option value="">{t('accounting.voucher')}</option>
                    {payments.map((payment) => <option key={payment.id} value={payment.id}>{payment.voucher_no} - {formatMoney(payment.amount)}</option>)}
                  </select>
                </div>
                <div><Label htmlFor="alloc-doc-type">{t('accounting.type_document')}</Label><Input id="alloc-doc-type" value={allocationForm.documentType} onChange={(e) => setAllocationForm((prev) => ({ ...prev, documentType: e.target.value }))} required /></div>
                <div><Label htmlFor="alloc-doc-id">{t('accounting.document')}</Label><Input id="alloc-doc-id" value={allocationForm.documentId} onChange={(e) => setAllocationForm((prev) => ({ ...prev, documentId: e.target.value }))} required /></div>
                <div><Label htmlFor="alloc-amount">{t('accounting.item_9558')}</Label><Input id="alloc-amount" type="number" min="0" step="0.01" value={allocationForm.allocatedAmount} onChange={(e) => setAllocationForm((prev) => ({ ...prev, allocatedAmount: e.target.value }))} required /></div>
                <div className="md:col-span-4"><Button type="submit" disabled={!canWriteAccounting || allocatePaymentMutation.isPending}>{t('accounting.item_7948')}</Button></div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-slate-700/60 bg-[#173030]">
            <CardHeader><SectionHeading title={t('accounting.vouchers_payment')} icon={ArrowRightLeft} tone="violet" /></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>{t('accounting.number_voucher')}</TableHead><TableHead>{t('accounting.type')}</TableHead><TableHead>{t('accounting.item_7956')}</TableHead><TableHead>{t('accounting.item_11144')}</TableHead><TableHead>{t('accounting.item_9558')}</TableHead><TableHead>{t('accounting.date')}</TableHead><TableHead>{t('accounting.status')}</TableHead><TableHead>{t('accounting.item_14280')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.voucher_no}</TableCell>
                      <TableCell>{payment.payment_type === "receipt" ? t('accounting.receipt') : t('accounting.disbursement')}</TableCell>
                      <TableCell>{payment.party_type === "customer" ? t('accounting.customer') : t('accounting.item_6381')}</TableCell>
                      <TableCell>{payment.method}</TableCell>
                      <TableCell>{formatMoney(payment.amount)}</TableCell>
                      <TableCell>{new Date(payment.payment_date).toLocaleDateString("ar-SA")}</TableCell>
                      <TableCell><Badge className={statusClass(payment.status)}>{statusLabel(payment.status)}</Badge></TableCell>
                      <TableCell className="space-y-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => loadPaymentAllocations(payment.id)}>{t('accounting.view_1')}</Button>
                        {(allocationRows[payment.id] || []).length > 0 && (
                          <div className="space-y-1 text-xs text-slate-300">
                            {(allocationRows[payment.id] || []).slice(0, 3).map((row) => (
                              <div key={row.id}>{row.document_type} - {formatMoney(row.allocated_amount)}</div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax" className="space-y-4">
          <Card className="border-slate-700/60 bg-[#173030]">
            <CardHeader><SectionHeading title={t('accounting.vat_4')} icon={ShieldCheck} tone="emerald" /></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <div><Label htmlFor="vat-from">{t('accounting.date_1')}</Label><Input id="vat-from" type="date" value={vatFilter.from} onChange={(e) => setVatFilter((prev) => ({ ...prev, from: e.target.value }))} /></div>
              <div><Label htmlFor="vat-to">{t('accounting.date_2')}</Label><Input id="vat-to" type="date" value={vatFilter.to} onChange={(e) => setVatFilter((prev) => ({ ...prev, to: e.target.value }))} /></div>
              <div className="flex items-end"><Button type="button" onClick={refreshAll}><RefreshCw className="ml-2 h-4 w-4" />{t('accounting.update')}</Button></div>
            </CardContent>
          </Card>

          <section className="grid gap-4 md:grid-cols-3">
            <Card className="border-slate-700/60 bg-[#173030]">
              <CardHeader>
                <SectionHeading title={t('accounting.vat_1')} icon={ShieldCheck} tone="emerald" />
              </CardHeader>
              <CardContent className="pt-0 text-xl font-bold text-emerald-300">{formatMoney(vatSummary?.outputTax)}</CardContent>
            </Card>
            <Card className="border-slate-700/60 bg-[#173030]">
              <CardHeader>
                <SectionHeading title={t('accounting.vat_2')} icon={ShieldCheck} tone="amber" />
              </CardHeader>
              <CardContent className="pt-0 text-xl font-bold text-amber-300">{formatMoney(vatSummary?.inputTax)}</CardContent>
            </Card>
            <Card className="border-slate-700/60 bg-[#173030]">
              <CardHeader>
                <SectionHeading title={t('accounting.item_9554')} icon={ShieldCheck} tone="cyan" />
              </CardHeader>
              <CardContent className="pt-0 text-xl font-bold text-cyan-300">{formatMoney(vatSummary?.netVatPayable)}</CardContent>
            </Card>
          </section>

          <Card className="border-slate-700/60 bg-[#173030]">
            <CardHeader><SectionHeading title={t('accounting.transactions_vat')} icon={ShieldCheck} tone="emerald" /></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>{t('accounting.type')}</TableHead><TableHead>{t('accounting.source')}</TableHead><TableHead>{t('accounting.value_1')}</TableHead><TableHead>{t('accounting.vat')}</TableHead><TableHead>{t('accounting.date')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {vatTransactions.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.direction === "output" ? t('accounting.item_9505') : t('accounting.item_9527')}</TableCell>
                      <TableCell>{row.source_type}</TableCell>
                      <TableCell>{formatMoney(row.taxable_amount)}</TableCell>
                      <TableCell>{formatMoney(row.tax_amount)}</TableCell>
                      <TableCell>{new Date(row.created_at).toLocaleString("ar-SA")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="einvoice" className="space-y-4">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-slate-700/60 bg-[#173030]">
              <CardHeader className="pb-2"><SectionHeading title={t('accounting.total_documents')} icon={FileCheck2} tone="amber" /></CardHeader>
              <CardContent className="pt-0 text-2xl font-black text-amber-100">{einvoiceStatusCounts.total}</CardContent>
            </Card>
            <Card className="border-slate-700/60 bg-[#173030]">
              <CardHeader className="pb-2"><SectionHeading title={t('accounting.item_17546')} icon={ShieldCheck} tone="emerald" /></CardHeader>
              <CardContent className="pt-0 text-2xl font-black text-emerald-200">{einvoiceStatusCounts.submitted}</CardContent>
            </Card>
            <Card className="border-slate-700/60 bg-[#173030]">
              <CardHeader className="pb-2"><SectionHeading title={t('accounting.pending_waiting')} icon={AlertTriangle} tone="amber" /></CardHeader>
              <CardContent className="pt-0 text-2xl font-black text-amber-200">{einvoiceStatusCounts.pending}</CardContent>
            </Card>
            <Card className="border-slate-700/60 bg-[#173030]">
              <CardHeader className="pb-2"><SectionHeading title={t('accounting.item_17483')} icon={RefreshCw} tone="rose" /></CardHeader>
              <CardContent className="pt-0 text-2xl font-black text-rose-200">{einvoiceStatusCounts.retrying}</CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <Card className="border-slate-700/60 bg-[#173030] xl:col-span-2">
              <CardHeader>
                <SectionHeading title={t('accounting.invoice')} icon={FileCheck2} tone="amber" />
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGenerateEinvoice} className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="ei-type">{t('accounting.type_source')}</Label>
                    <Input id="ei-type" value={einvoiceForm.sourceType} onChange={(e) => setEinvoiceForm((prev) => ({ ...prev, sourceType: e.target.value }))} required />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="ei-source-id">{t('accounting.source_1')}</Label>
                    <Input id="ei-source-id" value={einvoiceForm.sourceId} onChange={(e) => setEinvoiceForm((prev) => ({ ...prev, sourceId: e.target.value }))} placeholder={t('accounting.invoice_sales_1')} required />
                  </div>
                  <div className="md:col-span-3 flex flex-wrap items-center gap-2 pt-1">
                    <Button type="submit" disabled={!canWriteAccounting} className="bg-amber-500/80 text-slate-950 hover:bg-amber-400">
                      <FileCheck2 className="ml-2 h-4 w-4" />
                      {t('accounting.document_1')}
                    </Button>
                    <Button type="button" variant="outline" className="border-cyan-400/40 bg-cyan-500/10 text-cyan-200" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/einvoice?limit=100"] })}>
                      <RefreshCw className="ml-2 h-4 w-4" />
                      {t('accounting.update_1')}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="border-slate-700/60 bg-[#173030]">
              <CardHeader>
                <SectionHeading title={t('accounting.notes')} icon={ShieldCheck} tone="cyan" />
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                <div className="rounded-lg border border-slate-600/60 bg-slate-900/35 px-3 py-2">{t('accounting.status')}<span className="font-semibold text-emerald-200">{t('accounting.posted')}</span>{t('accounting.document_2')}</div>
                <div className="rounded-lg border border-slate-600/60 bg-slate-900/35 px-3 py-2">{t('accounting.status_1')}<span className="font-semibold text-rose-200">Retrying</span>{t('accounting.table')}</div>
                <div className="rounded-lg border border-slate-600/60 bg-slate-900/35 px-3 py-2">{t('accounting.operation_send')}</div>
              </CardContent>
            </Card>
          </section>

          <Card className="border-slate-700/60 bg-[#173030]">
            <CardHeader>
              <SectionHeading title={t('accounting.documents')} icon={FileCheck2} tone="amber" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs">
                <span className="text-cyan-200">{t('accounting.view_documents_status_send')}</span>
                <span className="font-semibold text-slate-300">{t('accounting.total_logs')}{einvoiceDocuments.length}</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-700/60">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700/60 bg-slate-900/30">
                      <TableHead className="whitespace-nowrap">{t('accounting.item_9563')}</TableHead>
                      <TableHead className="whitespace-nowrap">{t('accounting.source')}</TableHead>
                      <TableHead className="whitespace-nowrap">{t('accounting.status_2')}</TableHead>
                      <TableHead className="whitespace-nowrap">{t('accounting.item_12688')}</TableHead>
                      <TableHead className="whitespace-nowrap">{t('accounting.item_11101')}</TableHead>
                      <TableHead className="whitespace-nowrap">{t('accounting.date')}</TableHead>
                      <TableHead className="whitespace-nowrap text-left">{t('accounting.item_11035')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {einvoiceDocuments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-sm text-slate-400">
                          {t('accounting.no_einvoice_docs')}
                        </TableCell>
                      </TableRow>
                    ) : einvoiceDocuments.map((doc) => (
                      <TableRow key={doc.id} className="border-slate-700/60 hover:bg-slate-900/20">
                        <TableCell className="max-w-[160px] truncate" title={doc.id}>{doc.id}</TableCell>
                        <TableCell>{doc.source_type}</TableCell>
                        <TableCell><Badge className={statusClass(doc.zatca_status)}>{statusLabel(doc.zatca_status)}</Badge></TableCell>
                        <TableCell><Badge className={statusClass(doc.clearance_status)}>{statusLabel(doc.clearance_status)}</Badge></TableCell>
                        <TableCell><Badge className={statusClass(doc.reporting_status)}>{statusLabel(doc.reporting_status)}</Badge></TableCell>
                        <TableCell className="whitespace-nowrap">{new Date(doc.created_at).toLocaleString(language === "en" ? "en-US" : "ar-SA")}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="bg-emerald-500/85 text-slate-950 hover:bg-emerald-400"
                              disabled={!canWriteAccounting}
                              onClick={() => submitSimpleAction(`/api/einvoice/${doc.id}/submit`, t('accounting.completed_send_document'), ["/api/einvoice?limit=100"])}
                            >
                              <ShieldCheck className="ml-1.5 h-3.5 w-3.5" />
                              {t('accounting.send')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-rose-400/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
                              disabled={!canWriteAccounting}
                              onClick={() => submitSimpleAction(`/api/einvoice/${doc.id}/retry`, t('accounting.item_25455'), ["/api/einvoice?limit=100"])}
                            >
                              <RefreshCw className="ml-1.5 h-3.5 w-3.5" />
                              {t('accounting.item_20662')}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-slate-700/60 bg-[#173030]">
              <CardHeader className="pb-2"><SectionHeading title={t('accounting.sales_1')} icon={BarChart3} tone="amber" /></CardHeader>
              <CardContent className="pt-0 text-lg font-black text-amber-100">{formatMoney(topTechnicianAmount)}</CardContent>
            </Card>
            <Card className="border-slate-700/60 bg-[#173030]">
              <CardHeader className="pb-2"><SectionHeading title={t('accounting.sales_2')} icon={FileSpreadsheet} tone="cyan" /></CardHeader>
              <CardContent className="pt-0 text-lg font-black text-cyan-100">{formatMoney(topItemAmount)}</CardContent>
            </Card>
            <Card className="border-slate-700/60 bg-[#173030]">
              <CardHeader className="pb-2"><SectionHeading title={t('accounting.item_17578')} icon={BarChart3} tone="emerald" /></CardHeader>
              <CardContent className="pt-0 text-2xl font-black text-emerald-200">{topTechnicians.length}</CardContent>
            </Card>
            <Card className="border-slate-700/60 bg-[#173030]">
              <CardHeader className="pb-2"><SectionHeading title={t('accounting.item_15912')} icon={FileSpreadsheet} tone="violet" /></CardHeader>
              <CardContent className="pt-0 text-2xl font-black text-violet-200">{topItems.length}</CardContent>
            </Card>
          </section>

          <Card className="border-slate-700/60 bg-[#173030]">
            <CardHeader><SectionHeading title={t('accounting.reports')} icon={FileSpreadsheet} tone="cyan" /></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2"><Label htmlFor="rep-from">{t('accounting.date_1')}</Label><Input id="rep-from" type="date" value={reportsFilter.from} onChange={(e) => setReportsFilter((prev) => ({ ...prev, from: e.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="rep-to">{t('accounting.date_2')}</Label><Input id="rep-to" type="date" value={reportsFilter.to} onChange={(e) => setReportsFilter((prev) => ({ ...prev, to: e.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="rep-limit">{t('accounting.item_6343')}</Label><Input id="rep-limit" type="number" min="1" max="100" value={reportsFilter.limit} onChange={(e) => setReportsFilter((prev) => ({ ...prev, limit: e.target.value }))} /></div>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-600/60 bg-slate-900/30 p-3">
                <Button type="button" onClick={refreshAll} className="bg-cyan-500/80 text-slate-950 hover:bg-cyan-400"><RefreshCw className="ml-2 h-4 w-4" />{t('accounting.update_reports')}</Button>
                <Button type="button" variant="outline" className="border-emerald-400/40 bg-emerald-500/10 text-emerald-200" onClick={() => exportReports("top")} disabled={isExporting}><Download className="ml-2 h-4 w-4" />{t('accounting.item_6895')}</Button>
                <Button type="button" variant="outline" className="border-cyan-400/40 bg-cyan-500/10 text-cyan-200" onClick={() => exportReports("summary")} disabled={isExporting}><Download className="ml-2 h-4 w-4" />{t('accounting.item_6901')}</Button>
                <Button type="button" variant="outline" className="border-amber-400/40 bg-amber-500/10 text-amber-200" onClick={() => exportReportsPdf("top")} disabled={isExporting}><Download className="ml-2 h-4 w-4" />{t('accounting.item_6616')}</Button>
                <Button type="button" variant="outline" className="border-violet-400/40 bg-violet-500/10 text-violet-200" onClick={() => exportReportsPdf("summary")} disabled={isExporting}><Download className="ml-2 h-4 w-4" />{t('accounting.item_6622')}</Button>
              </div>
            </CardContent>
          </Card>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card className="border-slate-700/60 bg-[#173030]">
              <CardHeader>
                <SectionHeading title={t('accounting.item_19185')} icon={BarChart3} tone="amber" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-slate-400">{t('accounting.rank_sales')}</div>
                <Table>
                  <TableHeader><TableRow><TableHead>{t('accounting.item_9571')}</TableHead><TableHead>{t('accounting.quantity')}</TableHead><TableHead>{t('accounting.sales')}</TableHead><TableHead>{t('accounting.invoices')}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {topTechnicians.map((row) => (
                      <TableRow key={row.technicianId || row.technicianName}>
                        <TableCell>{row.technicianName || t('accounting.item_11173')}</TableCell>
                        <TableCell>{Number(row.soldQty || 0).toLocaleString("ar-SA")}</TableCell>
                        <TableCell>{formatMoney(Number(row.soldAmount || 0))}</TableCell>
                        <TableCell>{Number(row.invoiceCount || 0).toLocaleString("ar-SA")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-slate-700/60 bg-[#173030]">
              <CardHeader>
                <SectionHeading title={t('accounting.item_27121')} icon={FileSpreadsheet} tone="cyan" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-slate-400">{t('accounting.value_2')}</div>
                <Table>
                  <TableHeader><TableRow><TableHead>{t('accounting.item_7975')}</TableHead><TableHead>{t('accounting.quantity')}</TableHead><TableHead>{t('accounting.sales')}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {topItems.map((row) => (
                      <TableRow key={row.itemTypeId || row.itemTypeName}>
                        <TableCell>{row.itemTypeName || t('accounting.item_11173')}</TableCell>
                        <TableCell>{Number(row.soldQty || 0).toLocaleString("ar-SA")}</TableCell>
                        <TableCell>{formatMoney(Number(row.soldAmount || 0))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>
        </TabsContent>
      </Tabs>

      {!canWriteAccounting && (
        <section className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-cyan-100">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4" />
            {t('accounting.item_28734')}
          </div>
          <p className="mt-1 text-sm text-cyan-200">{t('accounting.reports_finance')}</p>
        </section>
      )}
    </div>
  );
}
