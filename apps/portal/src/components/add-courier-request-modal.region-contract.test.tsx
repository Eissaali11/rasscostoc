/**
 * OPS-PERM-S0-B1-B.P1 — Admin single-create region-selector contract.
 *
 * Proves the Portal-side half of the mandatory targetRegionId contract:
 * the trusted region list (already returned by GET /api/courier/lookups)
 * renders as options, submission is blocked without a selection, and the
 * submitted payload uses `targetRegionId` — never `regionId`/`region_id`.
 */
import { describe, expect, it } from "vitest";
import { screen, waitFor, fireEvent, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import { mockApiServer, http, HttpResponse } from "@/test/mock-api-server";
import { AddCourierRequestModal } from "./add-courier-request-modal";

const LOOKUPS_FIXTURE = {
  cities: [{ id: 1, name_ar: "الرياض", name_en: "Riyadh" }],
  simTypes: [],
  vendorTypes: [],
  technicians: [],
  regions: [
    { id: "region-1", name: "المنطقة الأولى", isActive: true },
    { id: "region-2", name: "المنطقة الثانية", isActive: true },
  ],
};

function mockLookups() {
  mockApiServer.use(
    http.get("/api/courier/lookups", () => HttpResponse.json(LOOKUPS_FIXTURE))
  );
}

/** Finds the <select> whose <option>s include the known region name — avoids
 * relying on accessible-label wiring the existing markup doesn't have. */
function findRegionSelect(): HTMLSelectElement {
  const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
  const match = selects.find((s) => within(s).queryByText("المنطقة الأولى"));
  if (!match) throw new Error("region select not found");
  return match;
}

describe("OPS-PERM-S0-B1-B.P1 — AddCourierRequestModal region contract", () => {
  it("0. an inactive region is excluded from the selector even though the API returns it", async () => {
    mockApiServer.use(
      http.get("/api/courier/lookups", () =>
        HttpResponse.json({
          ...LOOKUPS_FIXTURE,
          regions: [
            ...LOOKUPS_FIXTURE.regions,
            { id: "region-inactive", name: "منطقة متوقفة", isActive: false },
          ],
        })
      )
    );
    renderWithProviders(
      <AddCourierRequestModal open={true} onOpenChange={() => {}} />,
      { authOverrides: { role: "admin" } }
    );
    await waitFor(() => expect(screen.getByText("المنطقة الأولى")).toBeInTheDocument());
    expect(screen.queryByText("منطقة متوقفة")).not.toBeInTheDocument();
  });

  it("1. trusted region options render from the lookups response", async () => {
    mockLookups();
    renderWithProviders(
      <AddCourierRequestModal open={true} onOpenChange={() => {}} />,
      { authOverrides: { role: "admin" } }
    );
    await waitFor(() => expect(screen.getByText("المنطقة الأولى")).toBeInTheDocument());
    expect(screen.getByText("المنطقة الثانية")).toBeInTheDocument();
  });

  it("2. submitting without selecting a region never sends the create request", async () => {
    mockLookups();
    let requestSent = false;
    mockApiServer.use(
      http.post("/api/courier/requests", () => {
        requestSent = true;
        return HttpResponse.json({ id: 1 });
      })
    );
    renderWithProviders(
      <AddCourierRequestModal open={true} onOpenChange={() => {}} />,
      { authOverrides: { role: "admin" } }
    );
    await waitFor(() => expect(screen.getByText("المنطقة الأولى")).toBeInTheDocument());

    const form = document.querySelector("form")!;
    fireEvent.submit(form);
    await new Promise((r) => setTimeout(r, 50));
    expect(requestSent).toBe(false);
  });

  it("3. selecting a region and submitting sends targetRegionId, never regionId/region_id", async () => {
    mockLookups();
    let capturedBody: any = null;
    mockApiServer.use(
      http.post("/api/courier/requests", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: 42 });
      })
    );
    renderWithProviders(
      <AddCourierRequestModal open={true} onOpenChange={() => {}} />,
      { authOverrides: { role: "admin" } }
    );
    await waitFor(() => expect(screen.getByText("المنطقة الأولى")).toBeInTheDocument());

    fireEvent.change(findRegionSelect(), { target: { value: "region-1" } });

    // Fill the two other required fields (tid, customerName) — this modal's
    // markup has no accessible label association, so query generically.
    const textInputs = document.querySelectorAll("input[type=text], input:not([type])");
    textInputs.forEach((input) => fireEvent.change(input, { target: { value: "x" } }));

    const form = document.querySelector("form")!;
    fireEvent.submit(form);

    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody.targetRegionId).toBe("region-1");
    expect(capturedBody.regionId).toBeUndefined();
    expect(capturedBody.region_id).toBeUndefined();
  });
});
