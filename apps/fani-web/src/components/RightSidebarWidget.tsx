import React from 'react';
import { ItemProductAvatar } from './ItemProductAvatar';
import { ChevronLeft } from 'lucide-react';

export const RightSidebarWidget: React.FC = () => {
  const popularProducts = [
    { key: 'A960', title: 'A960', category: 'أجهزة', count: '542', pillBg: 'bg-cyan-500 text-white' },
    { key: 'i9100', title: 'i9100', category: 'أجهزة', count: '368', pillBg: 'bg-[#00A896] text-white' },
    { key: 'i9000s', title: 'i9000S', category: 'أجهزة', count: '204', pillBg: 'bg-[#00A896] text-white' },
    { key: 'n950', title: 'N950', category: 'أجهزة', count: '176', pillBg: 'bg-[#00A896] text-white' },
    { key: 'stcSim', title: 'شرائح STC', category: 'شريحة', count: '1,246', pillBg: 'bg-purple-600 text-white' },
  ];

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4 text-right">
      <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-3">أكثر المنتجات حركة</h3>

      <div className="space-y-3">
        {popularProducts.map((p) => (
          <div key={p.key} className="flex items-center justify-between p-2 rounded-2xl hover:bg-slate-50 transition-colors">
            <ItemProductAvatar itemTypeKey={p.key} size="sm" showSubtext={false} />
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs font-bold text-slate-900">{p.title}</span>
              <span className="text-[10px] text-slate-400 font-semibold">{p.category}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${p.pillBg}`}>
                {p.count}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-slate-100 text-center">
        <button className="text-xs font-extrabold text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1 cursor-pointer">
          <span>عرض جميع المنتجات</span>
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
