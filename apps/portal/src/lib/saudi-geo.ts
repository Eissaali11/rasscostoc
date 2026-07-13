/** Approximate lat/lng for Saudi cities and common districts used in warehouse/technician locations. */

export type LatLng = { lat: number; lng: number };

const SAUDI_GEO: Array<{ keys: string[]; lat: number; lng: number }> = [
  { keys: ["الرياض", "رياض", "riyadh", "السلي", "الملز", "النسيم", "العليا"], lat: 24.7136, lng: 46.6753 },
  { keys: ["جدة", "جده", "jeddah", "الخمرة", "أبحر", "ابحر", "الحمدانية"], lat: 21.4858, lng: 39.1925 },
  { keys: ["الدمام", "dammam"], lat: 26.4207, lng: 50.0888 },
  { keys: ["الخبر", "khobar", "alkhobar"], lat: 26.2172, lng: 50.1971 },
  { keys: ["الجبيل", "jubail"], lat: 27.0046, lng: 49.646 },
  { keys: ["الأحساء", "الاحساء", "الهفوف", "ahsa", "hofuf"], lat: 25.3832, lng: 49.5866 },
  { keys: ["مكة", "مكه", "المكرمة", "makkah", "mecca"], lat: 21.3891, lng: 39.8579 },
  { keys: ["المدينة", "المدينه", "المنورة", "madinah", "medina"], lat: 24.5247, lng: 39.5692 },
  { keys: ["الطائف", "taif"], lat: 21.2703, lng: 40.4158 },
  { keys: ["ينبع", "yanbu"], lat: 24.0232, lng: 38.19 },
  { keys: ["تبوك", "tabuk"], lat: 28.3838, lng: 36.555 },
  { keys: ["حائل", "hail"], lat: 27.5114, lng: 41.7208 },
  { keys: ["القصيم", "بريدة", "بريده", "qassim", "buraidah"], lat: 26.3592, lng: 43.9818 },
  { keys: ["أبها", "ابها", "abha"], lat: 18.2164, lng: 42.5053 },
  { keys: ["خميس مشيط", "خميس", "khamis"], lat: 18.3, lng: 42.7333 },
  { keys: ["جازان", "جيزان", "jazan", "jizan"], lat: 16.8892, lng: 42.5706 },
  { keys: ["نجران", "najran"], lat: 17.5656, lng: 44.2289 },
  { keys: ["الباحة", "الباحـه", "albaha"], lat: 20.0129, lng: 41.4677 },
  { keys: ["سكاكا", "الجوف", "sakaka", "jouf"], lat: 29.9697, lng: 40.2064 },
  { keys: ["عرعر", "arar"], lat: 30.9753, lng: 41.0381 },
  { keys: ["حفر الباطن", "الباطن", "hafr"], lat: 28.4342, lng: 45.9708 },
  { keys: ["نجيل", "رابغ", "rabigh"], lat: 22.7986, lng: 39.0349 },
];

function normalizeLocation(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[-_/|,]/g, " ")
    .replace(/\s+/g, " ");
}

/** Resolve a free-text Saudi location to approximate coordinates. */
export function resolveSaudiLatLng(raw: string | null | undefined): LatLng | null {
  if (!raw) return null;
  const normalized = normalizeLocation(raw);
  if (!normalized) return null;

  for (const entry of SAUDI_GEO) {
    if (entry.keys.some((key) => normalized.includes(normalizeLocation(key)))) {
      return { lat: entry.lat, lng: entry.lng };
    }
  }
  return null;
}

/** Tiny deterministic offset so overlapping markers don't stack perfectly. */
export function offsetLatLng(base: LatLng, seed: string, kind: "warehouse" | "technician"): LatLng {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  const angle = ((hash % 360) * Math.PI) / 180;
  const radius = kind === "warehouse" ? 0.035 : 0.055;
  return {
    lat: base.lat + Math.cos(angle) * radius,
    lng: base.lng + Math.sin(angle) * radius,
  };
}
