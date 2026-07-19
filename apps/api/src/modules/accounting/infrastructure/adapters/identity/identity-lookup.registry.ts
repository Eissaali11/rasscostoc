/**
 * ERP-005A-4 Phase 5 — late-binding registry for accounting's identity
 * lookup port.
 *
 * accountingService is an eager module-level singleton
 * (export const accountingService = new AccountingService();), instantiated
 * before the composition root runs, so it cannot receive the port via
 * constructor injection without accounting importing modules/identity/**
 * directly (forbidden — see ERP-005A-4 Phase 1 rules). composition/
 * accounting-cross-module.adapter.ts calls
 * registerAccountingIdentityLookupPort(...) once, at composition-root init
 * time, before any HTTP request can reach accountingService's methods.
 */
import type { AccountingIdentityLookupPort } from "../../../application/ports/AccountingIdentityLookupPort";

let port: AccountingIdentityLookupPort | null = null;

export function registerAccountingIdentityLookupPort(impl: AccountingIdentityLookupPort): void {
  port = impl;
}

export function getAccountingIdentityLookupPort(): AccountingIdentityLookupPort {
  if (!port) {
    throw new Error(
      "Accounting identity lookup port not registered yet — composition root must call " +
      "registerAccountingIdentityLookupPort() at startup before any accounting code that " +
      "reads technician/user data runs."
    );
  }
  return port;
}
