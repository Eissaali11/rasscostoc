import {useTranslation}from "@/lib/language";
export function DashboardSkeleton() {
  const { t } = useTranslation();
  return (
    <div dir="rtl" className="space-y-8 em-page-reveal" aria-busy="true" aria-label={t('dashboard.loading_dashboard_control')}>
      <div className="em-skeleton h-28 w-full rounded-2xl" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}className="rounded-2xl border-2 border-[#18B2B0] bg-white p-6 space-y-4 shadow-card">
            <div className="flex justify-between">
              <div className="em-skeleton h-5 w-32" />
              <div className="em-skeleton size-12 rounded-2xl" />
            </div>
            <div className="em-skeleton h-10 w-28" />
            <div className="em-skeleton h-7 w-24" />
            <div className="em-skeleton h-px w-full" />
            <div className="em-skeleton h-4 w-full" />
            <div className="em-skeleton h-4 w-3/4" />
          </div>
        ))}
      </div>

      <div className="em-skeleton h-14 w-full md:w-[36rem] rounded-2xl" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border-2 border-[#18B2B0] bg-white p-6 space-y-4 shadow-card">
          <div className="em-skeleton h-7 w-64" />
          <div className="em-skeleton h-4 w-80" />
          <div className="em-skeleton h-[300px] w-full rounded-xl" />
        </div>
        <div className="rounded-2xl border-2 border-[#18B2B0] bg-white p-6 space-y-4 shadow-card">
          <div className="em-skeleton h-7 w-48" />
          <div className="em-skeleton h-[260px] w-full rounded-full mx-auto max-w-[260px]" />
          <div className="space-y-3">
            <div className="em-skeleton h-4 w-full" />
            <div className="em-skeleton h-4 w-full" />
            <div className="em-skeleton h-4 w-2/3" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-[#18B2B0] bg-white p-6 space-y-4 shadow-card">
        <div className="em-skeleton h-7 w-56" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}className="em-skeleton h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
