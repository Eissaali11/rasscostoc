import fs from 'fs';

function normalizeNewlines(str) {
  return str.replace(/\r\n/g, '\n').trim();
}

// 1. withdrawn-devices.tsx
{
  const file = 'apps/portal/src/pages/withdrawn-devices.tsx';
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/\r\n/g, '\n');

  const outerConfig = `const statusConfig: Record<
  DeviceReviewStatus,
  {
    text: string;
    badgeClass: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  pending: {
    text: t('reports.pending_review_1'),
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    icon: TriangleAlert,
  },
  approved: {
    text: t('reports.ok_1'),
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    icon: CheckCircle2,
  },
  rejected: {
    text: t('reports.item_9566'),
    badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    icon: XCircle,
  },
};

const reasonLabels: Record<ReasonKey, string> = {
  damaged: t('reports.item_12759'),
  mismatch: t('reports.item_12735'),
  warranty: t('reports.item_15976'),
};`;

  content = content.replace(normalizeNewlines(outerConfig), '');

  content = content.replace(
    `const getDeviceFamily = (terminalId: string): string => {
  const value = String(terminalId || "").trim();
  if (!value) return t('reports.item_11222');
  const family = value.split(/[-_\\s]/)[0]?.trim();
  return family ? family.toUpperCase() : t('reports.item_11222');
};`,
    `const getDeviceFamily = (terminalId: string, t: any): string => {
  const value = String(terminalId || "").trim();
  if (!value) return t('reports.item_11222');
  const family = value.split(/[-_\\s]/)[0]?.trim();
  return family ? family.toUpperCase() : t('reports.item_11222');
};`
  );

  content = content.replace(
    `const family = getDeviceFamily(device.terminalId);`,
    `const family = getDeviceFamily(device.terminalId, t);`
  );

  const target = `export default function WithdrawnDevicesPage() {
  const { t } = useTranslation();`;

  const replacement = `export default function WithdrawnDevicesPage() {
  const { t } = useTranslation();

  const statusConfig: Record<
    DeviceReviewStatus,
    {
      text: string;
      badgeClass: string;
      icon: React.ComponentType<{ className?: string }>;
    }
  > = {
    pending: {
      text: t('reports.pending_review_1'),
      badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      icon: TriangleAlert,
    },
    approved: {
      text: t('reports.ok_1'),
      badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      icon: CheckCircle2,
    },
    rejected: {
      text: t('reports.item_9566'),
      badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      icon: XCircle,
    },
  };

  const reasonLabels: Record<ReasonKey, string> = {
    damaged: t('reports.item_12759'),
    mismatch: t('reports.item_12735'),
    warranty: t('reports.item_15976'),
  };`;

  content = content.replace(target, replacement);

  fs.writeFileSync(file, content, 'utf-8');
  console.log(`Reconciled: ${file}`);
}

// 2. withdrawn-devices-all.tsx
{
  const file = 'apps/portal/src/pages/withdrawn-devices-all.tsx';
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/\r\n/g, '\n');

  const outerConfig = `const statusConfig: Record<
  DeviceReviewStatus,
  {
    text: string;
    borderClass: string;
    badgeClass: string;
    icon: React.ComponentType<{ className?: string }>;
    cardBg: string;
  }
> = {
  pending: {
    text: t('reports.pending_review_1'),
    borderClass: "border-r-4 border-r-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    icon: TriangleAlert,
    cardBg: "bg-slate-900/40",
  },
  approved: {
    text: t('reports.ok_1'),
    borderClass: "border-r-4 border-r-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    icon: CheckCircle2,
    cardBg: "bg-slate-900/40",
  },
  rejected: {
    text: t('reports.item_9566'),
    borderClass: "border-r-4 border-r-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    icon: XCircle,
    cardBg: "bg-slate-900/40",
  },
};`;

  content = content.replace(normalizeNewlines(outerConfig), '');

  const target = `export default function WithdrawnDevicesAllPage() {
  const { t } = useTranslation();`;

  const replacement = `export default function WithdrawnDevicesAllPage() {
  const { t } = useTranslation();

  const statusConfig: Record<
    DeviceReviewStatus,
    {
      text: string;
      borderClass: string;
      badgeClass: string;
      icon: React.ComponentType<{ className?: string }>;
      cardBg: string;
    }
  > = {
    pending: {
      text: t('reports.pending_review_1'),
      borderClass: "border-r-4 border-r-amber-500",
      badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      icon: TriangleAlert,
      cardBg: "bg-slate-900/40",
    },
    approved: {
      text: t('reports.ok_1'),
      borderClass: "border-r-4 border-r-emerald-500",
      badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      icon: CheckCircle2,
      cardBg: "bg-slate-900/40",
    },
    rejected: {
      text: t('reports.item_9566'),
      borderClass: "border-r-4 border-r-rose-500",
      badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      icon: XCircle,
      cardBg: "bg-slate-900/40",
    },
  };`;

  content = content.replace(target, replacement);

  fs.writeFileSync(file, content, 'utf-8');
  console.log(`Reconciled: ${file}`);
}

// 3. withdrawn-devices-management.tsx
{
  const file = 'apps/portal/src/pages/withdrawn-devices-management.tsx';
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/\r\n/g, '\n');

  const outerConfig = `const statusConfig: Record<
  DeviceReviewStatus,
  {
    text: string;
    borderClass: string;
    badgeClass: string;
    icon: React.ComponentType<{ className?: string }>;
    progressClass: string;
    progressWidth: string;
  }
> = {
  pending: {
    text: t('reports.pending_review_1'),
    borderClass: "border-r-4 border-r-amber-400",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    icon: TriangleAlert,
    progressClass: "bg-amber-400",
    progressWidth: "w-1/3",
  },
  approved: {
    text: t('reports.ok_1'),
    borderClass: "border-r-4 border-r-emerald-400",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    icon: CheckCircle2,
    progressClass: "bg-emerald-400",
    progressWidth: "w-2/3",
  },
  rejected: {
    text: t('reports.item_9566'),
    borderClass: "border-r-4 border-r-rose-400",
    badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    icon: XCircle,
    progressClass: "bg-rose-400",
    progressWidth: "w-full",
  },
};`;

  content = content.replace(normalizeNewlines(outerConfig), '');

  const target = `export default function WithdrawnDevicesManagementPage() {
  const { t } = useTranslation();`;

  const replacement = `export default function WithdrawnDevicesManagementPage() {
  const { t } = useTranslation();

  const statusConfig: Record<
    DeviceReviewStatus,
    {
      text: string;
      borderClass: string;
      badgeClass: string;
      icon: React.ComponentType<{ className?: string }>;
      progressClass: string;
      progressWidth: string;
    }
  > = {
    pending: {
      text: t('reports.pending_review_1'),
      borderClass: "border-r-4 border-r-amber-400",
      badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      icon: TriangleAlert,
      progressClass: "bg-amber-400",
      progressWidth: "w-1/3",
    },
    approved: {
      text: t('reports.ok_1'),
      borderClass: "border-r-4 border-r-emerald-400",
      badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      icon: CheckCircle2,
      progressClass: "bg-emerald-400",
      progressWidth: "w-2/3",
    },
    rejected: {
      text: t('reports.item_9566'),
      borderClass: "border-r-4 border-r-rose-400",
      badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      icon: XCircle,
      progressClass: "bg-rose-400",
      progressWidth: "w-full",
    },
  };`;

  content = content.replace(target, replacement);

  fs.writeFileSync(file, content, 'utf-8');
  console.log(`Reconciled: ${file}`);
}

// 4. WithdrawnDeviceDetails.tsx
{
  const file = 'apps/portal/src/pages/WithdrawnDeviceDetails.tsx';
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/\r\n/g, '\n');

  const outerConfig = `const statusConfig: Record<
  DeviceStatus,
  { text: string; badgeClass: string; footerHint: string }
> = {
  pending: {
    text: t('reports.pending_review_1'),
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    footerHint: t('reports.review_details'),
  },
  approved: {
    text: t('reports.ok_1'),
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    footerHint: t('reports.returned_inventory'),
  },
  rejected: {
    text: t('reports.item_9566'),
    badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    footerHint: t('reports.completed_reject_returned_resu'),
  },
  maintenance: {
    text: t('reports.item_17595'),
    badgeClass: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    footerHint: t('reports.completed_transfer_device_rout'),
  },
};`;

  content = content.replace(normalizeNewlines(outerConfig), '');

  const target = `export default function WithdrawnDeviceDetailsPage() {
  const { t } = useTranslation();`;

  const replacement = `export default function WithdrawnDeviceDetailsPage() {
  const { t } = useTranslation();

  const statusConfig: Record<
    DeviceStatus,
    { text: string; badgeClass: string; footerHint: string }
  > = {
    pending: {
      text: t('reports.pending_review_1'),
      badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      footerHint: t('reports.review_details'),
    },
    approved: {
      text: t('reports.ok_1'),
      badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      footerHint: t('reports.returned_inventory'),
    },
    rejected: {
      text: t('reports.item_9566'),
      badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      footerHint: t('reports.completed_reject_returned_resu'),
    },
    maintenance: {
      text: t('reports.item_17595'),
      badgeClass: "bg-orange-500/15 text-orange-300 border-orange-500/30",
      footerHint: t('reports.completed_transfer_device_rout'),
    },
  };`;

  content = content.replace(target, replacement);

  fs.writeFileSync(file, content, 'utf-8');
  console.log(`Reconciled: ${file}`);
}
