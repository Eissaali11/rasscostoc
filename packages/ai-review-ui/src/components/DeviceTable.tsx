import type { DeviceRowView } from "../types.js";
import { ConfidenceBadge, Panel } from "./ui-bits.js";

export function DeviceTable(props: {
  devices: DeviceRowView[];
  selectedDeviceId: string | null;
  onSelect: (deviceId: string) => void;
}) {
  return (
    <Panel title={`جدول الأجهزة (${props.devices.length})`}>
      <div style={{ overflowX: "auto" }}>
        <table className="air-table" role="grid" aria-label="الأجهزة المستخرجة">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">device_id</th>
              <th scope="col">SN</th>
              <th scope="col">TID</th>
              <th scope="col">الحالة</th>
              <th scope="col">استخراج</th>
              <th scope="col">مطابقة</th>
            </tr>
          </thead>
          <tbody>
            {props.devices.map((d) => (
              <tr
                key={d.device_id}
                aria-selected={props.selectedDeviceId === d.device_id}
                tabIndex={0}
                onClick={() => props.onSelect(d.device_id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    props.onSelect(d.device_id);
                  }
                }}
              >
                <td>{d.device_index}</td>
                <td>{d.device_id}</td>
                <td>{d.serial_number ?? "—"}</td>
                <td>{d.tid ?? "—"}</td>
                <td>{d.status}</td>
                <td>
                  <ConfidenceBadge value={d.extraction_confidence} />
                </td>
                <td>
                  <ConfidenceBadge value={d.match_confidence} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
