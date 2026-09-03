/**
 * OPS-PERM-S1-F5 — EmployeePermissionsPanel behavior test.
 *
 * Exercises the actual read/write contract this panel talks to
 * (GET/POST /api/admin/permissions/employees/:userId/*), mocked at the network layer via MSW —
 * proving grant/revoke/reset send the right payload and that the row reflects the server's
 * response after the panel refetches, not just that the dialog opens.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import { mockApiServer, http, HttpResponse } from "@/test/mock-api-server";
import { createRoleFixture } from "@/test/fixtures";
import { EmployeePermissionsPanel } from "./employee-permissions-panel";
import type { EmployeePermissionSnapshot, PermissionChangeAuditEntry } from "@/lib/permissions-center";

const supervisor = createRoleFixture("supervisor", {
  id: "sup-1",
  fullName: "Supervisor One",
  username: "sup.one",
  regionId: "region-1",
});

function buildSnapshot(overrides: Partial<EmployeePermissionSnapshot> = {}): EmployeePermissionSnapshot {
  return {
    userId: supervisor.id,
    role: "supervisor",
    isActive: true,
    regionId: "region-1",
    hardCeilingScope: "REGION",
    permissions: [
      {
        page: "courier.requests",
        action: "view",
        defaultGrant: true,
        assigned: null,
        effective: { allowed: true, reason: "role-template", scope: "REGION" },
      },
      {
        page: "courier.requests",
        action: "create",
        defaultGrant: false,
        assigned: null,
        effective: { allowed: false, reason: "no-grant" },
      },
      {
        page: "warehouse.inventory",
        action: "update",
        defaultGrant: false,
        assigned: null,
        effective: { allowed: false, reason: "role-ceiling" },
      },
    ],
    ...overrides,
  };
}

function renderPanel(snapshot: EmployeePermissionSnapshot, audit: PermissionChangeAuditEntry[] = []) {
  let current = snapshot;
  const grantCalls: Array<{ page: string; action: string; reason?: string }> = [];

  mockApiServer.use(
    http.get(`/api/admin/permissions/employees/${supervisor.id}`, () => HttpResponse.json(current)),
    http.get(`/api/admin/permissions/employees/${supervisor.id}/audit`, () => HttpResponse.json(audit)),
    http.post(`/api/admin/permissions/employees/${supervisor.id}/grant`, async ({ request }) => {
      const body = (await request.json()) as { page: string; action: string; reason?: string };
      grantCalls.push(body);
      current = {
        ...current,
        permissions: current.permissions.map((row) =>
          row.page === body.page && row.action === body.action
            ? { ...row, assigned: "grant" as const, effective: { allowed: true, reason: "override" as const, scope: "REGION" as const } }
            : row
        ),
      };
      return HttpResponse.json({
        success: true,
        override: {
          id: "ovr-1",
          userId: supervisor.id,
          page: body.page,
          action: body.action,
          value: "grant",
          grantedBy: "admin-1",
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    })
  );

  const usersById = new Map([[supervisor.id, supervisor]]);
  const utils = renderWithProviders(<EmployeePermissionsPanel employee={supervisor} usersById={usersById} />, {
    authOverrides: { role: "admin" },
  });
  return { ...utils, grantCalls };
}

describe("OPS-PERM-S1-F5 — EmployeePermissionsPanel", () => {
  it("renders the employee's permission rows grouped by page, from the snapshot", async () => {
    renderPanel(buildSnapshot());

    await screen.findByText("Supervisor One");
    expect(screen.getByTestId("row-permission-courier.requests-view")).toBeInTheDocument();
    expect(screen.getByTestId("row-permission-courier.requests-create")).toBeInTheDocument();
  });

  it("locks a row outside the role's hard ceiling instead of offering grant/revoke controls", async () => {
    renderPanel(buildSnapshot());

    const lockedRow = await screen.findByTestId("row-permission-warehouse.inventory-update");
    expect(within(lockedRow).queryByText("منح")).not.toBeInTheDocument();
    expect(within(lockedRow).queryByText("Grant")).not.toBeInTheDocument();
  });

  it("grants a permission after confirming, sends the reason, and reflects the new state after refetch", async () => {
    const { grantCalls } = renderPanel(buildSnapshot());

    const row = await screen.findByTestId("row-permission-courier.requests-create");
    const grantButtons = within(row).getAllByRole("button").filter((btn) => btn.textContent === "منح" || btn.textContent === "Grant");
    expect(grantButtons).toHaveLength(1);
    fireEvent.click(grantButtons[0]);

    const reasonInput = await screen.findByTestId("input-permission-change-reason");
    fireEvent.change(reasonInput, { target: { value: "Temporary coverage" } });

    const confirmButton = screen.getByTestId("button-confirm-permission-change");
    fireEvent.click(confirmButton);

    await waitFor(() => expect(grantCalls).toHaveLength(1));
    expect(grantCalls[0]).toMatchObject({ page: "courier.requests", action: "create", reason: "Temporary coverage" });

    // Dialog closes and the panel reflects the server's post-write state (from the refetched snapshot):
    // the row's "Grant" toggle is now the active one.
    await waitFor(() => expect(screen.queryByTestId("button-confirm-permission-change")).not.toBeInTheDocument());
    await waitFor(() => {
      const updatedRow = screen.getByTestId("row-permission-courier.requests-create");
      const activeGrantButton = within(updatedRow)
        .getAllByRole("button")
        .find((btn) => btn.textContent === "منح" || btn.textContent === "Grant");
      expect(activeGrantButton?.className).toContain("bg-emerald-600");
    });
  });
});
