/**
 * DB-R10C.2 / DB-R10C.3 — Server-authoritative financial derivation for
 * representative (field/moped) sales.
 *
 * BEFORE DB-R10C.2: CreateRepresentativeSaleUseCase persisted
 * `unitPrice`, `amountBeforeTax`, `taxAmount`, and `totalAmount` exactly
 * as submitted by the client, with no relationship enforced to the
 * product's actual price/tax rate or to the requested quantity — a
 * CLIENT-SIDE FINANCIAL AUTHORITY / TRUST-BOUNDARY VIOLATION.
 *
 * DB-R10C.2 fixed the trust boundary: this module became the only place
 * representative-sale money values are computed, reading price/tax from
 * the authoritative `Product` record and using decimal-safe primitives
 * for the arithmetic. At that point the 7 underlying database columns
 * were still `doublePrecision`, so this module accepted `number` inputs
 * (converted via `toPlainDecimalString`) and produced `number` outputs
 * (via a final, one-time, already-rounded `Number(...)` boundary
 * conversion) — a necessary compatibility shape for a float8 database.
 *
 * DB-R10C.3 migrated all 7 fields (products.defaultPrice/defaultTaxRate,
 * salesOrders.amountBeforeTax/taxAmount/totalAmount,
 * salesOrderItems.unitPrice/lineTaxAmount) to exact NUMERIC storage.
 * drizzle-orm@0.39.1's `numeric()` has no `mode` option and is always
 * inferred as TypeScript `string` (confirmed in DB-R10C.1B) — so this
 * module now takes `Product.defaultPrice`/`defaultTaxRate` as exact
 * decimal STRINGS straight from the database and returns exact decimal
 * STRINGS for direct persistence. `Number()`/`parseFloat()`/
 * `Math.round()`/binary float multiplication or addition do NOT appear
 * anywhere in this authoritative calculation path anymore — the full
 * chain is:
 *
 *   PostgreSQL NUMERIC -> exact decimal string -> decimal-safe
 *   arithmetic (multiplyDecimal/addDecimal/roundHalfAwayFromZero) ->
 *   exact decimal string -> PostgreSQL NUMERIC
 *
 * The DB-R10C.2 legacy tax-rate read-compatibility adapter
 * (classifyLegacyTaxRate-based normalization) is REMOVED from this
 * calculation path: after DB-R10C.3, `products.defaultTaxRate` is
 * database-enforced (CHECK constraint) to already be the canonical
 * fractional representation, so no per-read normalization is needed or
 * performed here anymore.
 *
 * The only remaining `number` in this module is on the CLIENT-SUBMITTED
 * comparison side (`ClientSubmittedSaleFinancials`) — those values still
 * arrive as JSON numbers over HTTP (DB-R10C.3 does not change the public
 * API's JSON representation) and were never authoritative to begin with
 * (DB-R10C.2). DB-R10C.3R CORRECTION: an earlier version of this comment
 * called that conversion "API compatibility only" — that was an
 * inaccurate classification. The client value participates directly in
 * FINANCIAL VALIDATION (it decides accept vs. `FinancialMismatchError`),
 * not mere presentation. See `clientDecimalMatchesServerDecimal`'s doc
 * comment below for the precise, corrected two-step classification:
 * unavoidable CLIENT_INPUT_NORMALIZATION of an already-JSON-parsed float
 * (step 1), followed by exact decimal-string FINANCIAL_VALIDATION
 * comparison — never a binary-float comparison (step 2).
 */
import { FinancialMismatchError, ValidationError } from "../../../../../core/errors/AppError";
import {
  FINANCIAL_SCALE,
  addDecimal,
  multiplyDecimal,
  roundHalfAwayFromZero,
  toPlainDecimalString,
} from "../../../../../core/finance/decimal";

/**
 * The authoritative price/tax fields read from the `products` table —
 * exact decimal strings from NUMERIC(14,4)/NUMERIC(5,4) columns,
 * post-DB-R10C.3. `defaultTaxRate` is database-enforced canonical
 * fractional (0.1500 = 15%); never from client input.
 */
export type ProductFinancialSource = {
  id: string;
  defaultPrice: string;
  defaultTaxRate: string;
};

export type RepresentativeSaleLineInput = {
  productId: string;
  quantity: number;
  product: ProductFinancialSource;
};

export type ServerDerivedLineFinancials = {
  productId: string;
  quantity: number;
  /** Persisted as `sales_order_items.unit_price` (NUMERIC(14,4)) — exact decimal string. */
  unitPrice: string;
  /** Persisted as `sales_order_items.line_tax_amount` (NUMERIC(14,2)) — exact decimal string. */
  lineTaxAmount: string;
};

export type ServerDerivedSaleFinancials = {
  lines: ServerDerivedLineFinancials[];
  /** Persisted as `sales_orders.amount_before_tax` (NUMERIC(14,2)) — exact decimal string. */
  amountBeforeTax: string;
  /** Persisted as `sales_orders.tax_amount` (NUMERIC(14,2)) — exact decimal string. */
  taxAmount: string;
  /** Persisted as `sales_orders.total_amount` (NUMERIC(14,2)) — exact decimal string. */
  totalAmount: string;
};

function assertValidQuantity(quantity: number, productId: string): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new ValidationError(
      `Invalid quantity ${quantity} for product ${productId}: quantity must be a positive integer.`
    );
  }
}

/**
 * Derives the authoritative financial values for one representative
 * sale (one or more line items) purely from product data and validated
 * quantities. Never reads a client-submitted money value. Operates
 * entirely on exact decimal strings — no binary float touches this
 * calculation at any step.
 */
export function deriveRepresentativeSaleFinancials(
  items: RepresentativeSaleLineInput[]
): ServerDerivedSaleFinancials {
  if (items.length === 0) {
    throw new ValidationError("A representative sale requires at least one item.");
  }

  const lines: ServerDerivedLineFinancials[] = [];
  let amountBeforeTaxTotal = "0";
  let taxAmountTotal = "0";

  for (const item of items) {
    assertValidQuantity(item.quantity, item.productId);

    const quantityDecimal = String(item.quantity);
    // DB-R10C.3: defaultPrice/defaultTaxRate arrive already as exact
    // decimal strings from NUMERIC columns — no toPlainDecimalString()
    // conversion and no legacy tax-rate classification needed anymore;
    // the database CHECK constraint already guarantees defaultTaxRate
    // is canonical fractional [0,1].
    const unitPriceDecimal = item.product.defaultPrice;
    const taxRateDecimal = item.product.defaultTaxRate;

    // quantity × unit price -> amount before tax (rounded at the money-amount boundary)
    const exactAmountBeforeTax = multiplyDecimal(quantityDecimal, unitPriceDecimal);
    const amountBeforeTaxDecimal = roundHalfAwayFromZero(exactAmountBeforeTax, FINANCIAL_SCALE.MONEY_AMOUNT);

    // amount before tax × canonical fractional tax rate -> tax amount (rounded at the money-amount boundary)
    const exactTaxAmount = multiplyDecimal(amountBeforeTaxDecimal, taxRateDecimal);
    const taxAmountDecimal = roundHalfAwayFromZero(exactTaxAmount, FINANCIAL_SCALE.MONEY_AMOUNT);

    const roundedUnitPriceDecimal = roundHalfAwayFromZero(unitPriceDecimal, FINANCIAL_SCALE.UNIT_PRICE);

    lines.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: roundedUnitPriceDecimal,
      lineTaxAmount: taxAmountDecimal,
    });

    amountBeforeTaxTotal = addDecimal(amountBeforeTaxTotal, amountBeforeTaxDecimal);
    taxAmountTotal = addDecimal(taxAmountTotal, taxAmountDecimal);
  }

  const totalAmountDecimal = addDecimal(amountBeforeTaxTotal, taxAmountTotal);

  return {
    lines,
    amountBeforeTax: amountBeforeTaxTotal,
    taxAmount: taxAmountTotal,
    totalAmount: totalAmountDecimal,
  };
}

export type ClientSubmittedSaleFinancials = {
  amountBeforeTax?: number;
  taxAmount?: number;
  totalAmount?: number;
  items: Array<{ productId: string; unitPrice?: number; lineTaxAmount?: number }>;
};

/**
 * DB-R10C.3R — corrected classification (the prior comment here mislabeled
 * this as "API compatibility only"; a reviewer correctly rejected that:
 * this function's result directly decides accept-vs-409, which is
 * FINANCIAL VALIDATION AUTHORITY, not mere presentation formatting).
 *
 * This function performs exactly two logically distinct steps, and it is
 * important they are not conflated:
 *
 *  1. CLIENT_INPUT_NORMALIZATION (unavoidable, classification B): the
 *     public HTTP contract is still JSON, and JSON has no decimal type —
 *     `JSON.parse` has ALREADY produced a binary float64 `number` by the
 *     time this code runs, before this module ever sees the value. This
 *     step does not "convert to Number()" as a choice; it canonicalizes
 *     the already-parsed float64 semantic value into an exact decimal
 *     string (`toPlainDecimalString` + `roundHalfAwayFromZero`) — the
 *     earliest point at which the value can be treated as decimal-exact
 *     at all. Nothing here would change even if this function were
 *     rewritten a hundred times; it is a boundary condition of accepting
 *     JSON, not of this module's design.
 *
 *  2. FINANCIAL_VALIDATION (classification C, the actual comparison
 *     decision): once BOTH sides are exact decimal strings, the
 *     comparison itself is plain string equality (`===` on two decimal
 *     strings) — never `Number(a) === Number(b)`, never
 *     `Math.abs(a - b) < epsilon`, never a binary-float comparison of any
 *     kind. This is the part that decides accept vs. `FinancialMismatchError`,
 *     and it is decimal-exact.
 *
 * The server side (`serverExactDecimal`) is NEVER round-tripped through
 * `number` — it arrives here as the exact decimal string
 * `deriveRepresentativeSaleFinancials` produced directly from the
 * database's NUMERIC columns.
 */
function clientDecimalMatchesServerDecimal(clientValue: number, serverExactDecimal: string, scale: number): boolean {
  // Step 1 — CLIENT_INPUT_NORMALIZATION: canonicalize the already-parsed
  // JSON number into the one true decimal representation this module
  // uses everywhere else.
  const clientCanonicalDecimal = roundHalfAwayFromZero(toPlainDecimalString(clientValue), scale);
  // serverExactDecimal is already rounded to `scale` by
  // deriveRepresentativeSaleFinancials; re-rounding here is defensive
  // and produces an identical string for a value already at that scale.
  const serverCanonicalDecimal = roundHalfAwayFromZero(serverExactDecimal, scale);
  // Step 2 — FINANCIAL_VALIDATION: exact decimal-string equality, not a
  // binary-float comparison.
  return clientCanonicalDecimal === serverCanonicalDecimal;
}

/**
 * DB-R10C.2 §9 (unchanged by DB-R10C.3): client-submitted financial
 * fields (where the current API contract still requires their
 * presence) are compared against the server-derived truth and used
 * ONLY to detect a stale/tampered client — never persisted. Any
 * mismatch fails the whole request with `FinancialMismatchError`;
 * nothing is silently corrected or partially accepted.
 */
export function assertClientFinancialsMatchServerDerived(
  client: ClientSubmittedSaleFinancials,
  server: ServerDerivedSaleFinancials
): void {
  if (client.amountBeforeTax !== undefined && !clientDecimalMatchesServerDecimal(client.amountBeforeTax, server.amountBeforeTax, FINANCIAL_SCALE.MONEY_AMOUNT)) {
    throw new FinancialMismatchError("amountBeforeTax", server.amountBeforeTax, String(client.amountBeforeTax));
  }
  if (client.taxAmount !== undefined && !clientDecimalMatchesServerDecimal(client.taxAmount, server.taxAmount, FINANCIAL_SCALE.MONEY_AMOUNT)) {
    throw new FinancialMismatchError("taxAmount", server.taxAmount, String(client.taxAmount));
  }
  if (client.totalAmount !== undefined && !clientDecimalMatchesServerDecimal(client.totalAmount, server.totalAmount, FINANCIAL_SCALE.MONEY_AMOUNT)) {
    throw new FinancialMismatchError("totalAmount", server.totalAmount, String(client.totalAmount));
  }

  for (let i = 0; i < client.items.length; i++) {
    const clientItem = client.items[i];
    const serverLine = server.lines[i];
    if (!serverLine || serverLine.productId !== clientItem.productId) {
      // Defensive — the use-case builds server.lines in the same order
      // it iterates client items, so this should be unreachable; fail
      // closed rather than compare mismatched items if it ever occurs.
      throw new FinancialMismatchError(`items[${i}].productId`, serverLine?.productId ?? "(none)", clientItem.productId);
    }
    if (clientItem.unitPrice !== undefined && !clientDecimalMatchesServerDecimal(clientItem.unitPrice, serverLine.unitPrice, FINANCIAL_SCALE.UNIT_PRICE)) {
      throw new FinancialMismatchError(`items[${i}].unitPrice`, serverLine.unitPrice, String(clientItem.unitPrice));
    }
    if (clientItem.lineTaxAmount !== undefined && !clientDecimalMatchesServerDecimal(clientItem.lineTaxAmount, serverLine.lineTaxAmount, FINANCIAL_SCALE.MONEY_AMOUNT)) {
      throw new FinancialMismatchError(`items[${i}].lineTaxAmount`, serverLine.lineTaxAmount, String(clientItem.lineTaxAmount));
    }
  }
}
