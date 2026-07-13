import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type SpreadMapPoint = {
  id: string;
  name: string;
  kind: "warehouse" | "technician";
  lat: number;
  lng: number;
  units?: number;
  subtitle?: string;
};

type SaudiSpreadMapProps = {
  points: SpreadMapPoint[];
  emptyLabel: string;
  techniciansLabel: string;
  warehousesLabel: string;
  unitsLabel: string;
  formatNumber: (value: number) => string;
};

function makeDivIcon(kind: "warehouse" | "technician") {
  const color = kind === "warehouse" ? "#18B2B0" : "#5F6368";
  const glyph = kind === "warehouse" ? "W" : "T";
  return L.divIcon({
    className: "rassco-map-marker",
    html: `<div style="
      width:34px;height:34px;border-radius:9999px;
      background:${color};color:#fff;display:flex;align-items:center;justify-content:center;
      font-weight:800;font-size:13px;border:2px solid #fff;
      box-shadow:0 8px 18px rgba(0,0,0,.22);
    ">${glyph}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16],
  });
}

function FitBounds({ points }: { points: SpreadMapPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) {
      map.setView([24.7136, 46.6753], 5.2);
      return;
    }
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 10);
      return;
    }
    const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.25));
  }, [map, points]);

  return null;
}

export function SaudiSpreadMap({
  points,
  emptyLabel,
  techniciansLabel,
  warehousesLabel,
  unitsLabel,
  formatNumber,
}: SaudiSpreadMapProps) {
  const warehouseIcon = useMemo(() => makeDivIcon("warehouse"), []);
  const technicianIcon = useMemo(() => makeDivIcon("technician"), []);

  if (!points.length) {
    return (
      <div className="h-full min-h-[340px] flex items-center justify-center text-sm text-[#6B7280] bg-[#F8FAFB]">
        {emptyLabel}
      </div>
    );
  }

  return (
    <MapContainer
      center={[24.7136, 46.6753]}
      zoom={5.5}
      scrollWheelZoom
      className="h-full min-h-[340px] w-full rounded-2xl z-0"
      style={{ fontFamily: "Noto Kufi Arabic, sans-serif" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains={["a", "b", "c", "d"]}
        maxZoom={19}
      />
      <FitBounds points={points} />
      {points.map((point) => (
        <Marker
          key={point.id}
          position={[point.lat, point.lng]}
          icon={point.kind === "warehouse" ? warehouseIcon : technicianIcon}
        >
          <Popup>
            <div dir="rtl" style={{ minWidth: 160, fontFamily: "Noto Kufi Arabic, sans-serif" }}>
              <div style={{ fontWeight: 800, color: "#2D3135", marginBottom: 4 }}>{point.name}</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6 }}>
                {point.kind === "warehouse" ? warehousesLabel : techniciansLabel}
                {point.subtitle ? ` · ${point.subtitle}` : ""}
              </div>
              {typeof point.units === "number" ? (
                <div style={{ fontSize: 12, color: "#18B2B0", fontWeight: 700 }}>
                  {unitsLabel}: {formatNumber(point.units)}
                </div>
              ) : null}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
