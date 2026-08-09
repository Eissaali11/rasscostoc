/**
 * DB-R10C.2 — Server-authoritative financial derivation for
 * representative (field/moped) sales.
 *
 * BEFORE this slice: CreateRepresentativeSaleUseCase persisted
 * `unitPrice`, `amountBeforeTax`, `taxAmount`, and `totalAmount` exactly
 * as submitted by the client, with no relationship enforced to the
 * product's actual price/tax rate or to the requested quantity. A client
 * (or a compromised/buggy client) could submit any total it wanted and
 * the server would store it verbatim — a CLIENT-SIDE FINANCIAL AUTHORITY
 * / TRUST-BOUNDARY VIOLATION, not a remote-code-execution or
 * SQL-injection class of bug: the attack surface is "the server accepts
 * unverified monetary claims from the caller", not arbitrary code
 * execution or database escape.
 *
 * AFTER this slice: this module is the ONLY place representative-sale
 * money values are computed. It reads price/tax rate from the
 * authoritative `Product` record (never from client input) and performs
 * every calculation via the decimal-safe primitives from
 * `@core/finance/decimal` — no JS `number` multiplication, `Math.round`,
 * or EPSILON tricks touch the core arithmetic. `CreateRepresentativeSale.use-case.ts`
 * persists exactly what this module returns and nothing else.
 */
import { FinancialMismatchError, InvalidProductTaxConfigurationError, ValidationError } from "../../../../../core/errors/AppError";
import {
  FINANCIAL_SCALE,
  addDecimal,
  multiplyDecimal,
  roundHalfAwayFromZero,
  toPlainDecimalString,
} from "../../../../../core/finance/decimal";
import { classifyLegacyTaxRate } from "../../../../../core/finance/taxRate";

/** The authoritative price/tax fields read from the `products` table — never from client input. */
export type ProductFinancialSource = {
  id: string;
  defaultPrice: number;
  defaultTaxRate: number;
};

export type RepresentativeSaleLineInput = {
  productId: string;
  quantity: number;
  product: ProductFinancialSource;
};

export type ServerDerivedLineFinancials = {
  productId: string;
  quantity: number;
  /** Persisted as `sales_order_items.unit_price` — always the product's authoritative price, never the client's. */
  unitPrice: number;
  /** Persisted as `sales_order_items.line_tax_amount`. */
  lineTaxAmount: number;
  /** Exact decimal string, MONEY_AMOUNT-rounded — used internally to sum order-level totals without float drift. */
  amountBeforeTaxDecimal: string;
  /** Exact decimal string, MONEY_AMOUNT-rounded. */
  taxAmountDecimal: string;
};

export type ServerDerivedSaleFinancials = {
  lines: ServerDerivedLineFinancials[];
  /** Persisted as `sales_orders.amount_before_tax`. */
  amountBeforeTax: number;
  /** Persisted as `sales_orders.tax_amount`. */
  taxAmount: number;
  /** Persisted as `sales_orders.total_amount`. */
  totalAmount: number;
};

/**
 * DB-R10C.1 established the canonical fractional tax-rate semantic
 * (0.15 = 15%) but explicitly did NOT migrate `products.defaultTaxRate`,
 * which still carries its legacy default of `15.0` (percentage-points)
 * for existing/unmigrated rows. This function is a TEMPORARY
 * read-compatibility adapter — it exists only so C.2 can calculate
 * correctly against both old (15.0) and new (0.15) stored rows without
 * the client ever being allowed to submit a value in the legacy format.
 * It must be removed once DB-R10C.3 migrates all stored tax-rate values
 * to the canonical fractional representation.
 */
function resolveCanonicalTaxRateForCalculation(product: ProductFinancialSource): number {
  const classification = classifyLegacyTaxRate(product.defaultTaxRate);
  switch (classification.kind) {
    case "CANONICAL_FRACTIONAL":
      return classification.value;
    case "LEGACY_PERCENTAGE_POINTS":
      return classification.impliedFractional;
    case "INVALID_OR_AMBIGUOUS":
      throw new InvalidProductTaxConfigurationError(
        product.id,
        `stored defaultTaxRate=${String(product.defaultTaxRate)} is neither a valid canonical fraction [0,1] nor a legacy percentage-points value (0,100]`
      );
  }
}

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
 * quantities. Never reads a client-submitted money value.
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

    const taxRate = resolveCanonicalTaxRateForCalculation(item.product);

    const quantityDecimal = String(item.quantity);
    const unitPriceDecimal = toPlainDecimalString(item.product.defaultPrice);
    const taxRateDecimal = toPlainDecimalString(taxRate);

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
      unitPrice: Number(roundedUnitPriceDecimal),
      lineTaxAmount: Number(taxAmountDecimal),
      amountBeforeTaxDecimal,
      taxAmountDecimal,
    });

    amountBeforeTaxTotal = addDecimal(amountBeforeTaxTotal, amountBeforeTaxDecimal);
    taxAmountTotal = addDecimal(taxAmountTotal, taxAmountDecimal);
  }

  const totalAmountDecimal = addDecimal(amountBeforeTaxTotal, taxAmountTotal);

  return {
    lines,
    // Number(...) here is the one unavoidable compatibility boundary
    // (DB-R10C.1B §11): these values are already exact, scale-2 decimal
    // strings, so the conversion to `number` for persistence into the
    // current doublePrecision columns cannot reintroduce the class of
    // drift DB-R10A documented — it is the same boundary round2Compat
    // uses, applied here to an already-exact value instead of an
    // already-imprecise one.
    amountBeforeTax: Number(amountBeforeTaxTotal),
    taxAmount: Number(taxAmountTotal),
    totalAmount: Number(totalAmountDecimal),
  };
}

export type ClientSubmittedSaleFinancials = {
  amountBeforeTax?: number;
  taxAmount?: number;
  totalAmount?: number;
  items: Array<{ productId: string; unitPrice?: number; lineTaxAmount?: number }>;
};

/** Compares a value at a given financial scale using decimal-string equality — never float `===`. */
function scaledDecimalsMatch(a: number, b: number, scale: number): boolean {
  return roundHalfAwayFromZero(toPlainDecimalString(a), scale) === roundHalfAwayFromZero(toPlainDecimalString(b), scale);
}

/**
 * DB-R10C.2 §9: client-submitted financial fields (where the current API
 * contract still requires their presence) are compared against the
 * server-derived truth and used ONLY to detect a stale/tampered client —
 * never persisted. Any mismatch fails the whole request with
 * `FinancialMismatchError`; nothing is silently corrected or partially
 * accepted.
 */
export function assertClientFinancialsMatchServerDerived(
  client: ClientSubmittedSaleFinancials,
  server: ServerDerivedSaleFinancials
): void {
  if (client.amountBeforeTax !== undefined && !scaledDecimalsMatch(client.amountBeforeTax, server.amountBeforeTax, FINANCIAL_SCALE.MONEY_AMOUNT)) {
    throw new FinancialMismatchError("amountBeforeTax", String(server.amountBeforeTax), String(client.amountBeforeTax));
  }
  if (client.taxAmount !== undefined && !scaledDecimalsMatch(client.taxAmount, server.taxAmount, FINANCIAL_SCALE.MONEY_AMOUNT)) {
    throw new FinancialMismatchError("taxAmount", String(server.taxAmount), String(client.taxAmount));
  }
  if (client.totalAmount !== undefined && !scaledDecimalsMatch(client.totalAmount, server.totalAmount, FINANCIAL_SCALE.MONEY_AMOUNT)) {
    throw new FinancialMismatchError("totalAmount", String(server.totalAmount), String(client.totalAmount));
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
    if (clientItem.unitPrice !== undefined && !scaledDecimalsMatch(clientItem.unitPrice, serverLine.unitPrice, FINANCIAL_SCALE.UNIT_PRICE)) {
      throw new FinancialMismatchError(`items[${i}].unitPrice`, String(serverLine.unitPrice), String(clientItem.unitPrice));
    }
    if (clientItem.lineTaxAmount !== undefined && !scaledDecimalsMatch(clientItem.lineTaxAmount, serverLine.lineTaxAmount, FINANCIAL_SCALE.MONEY_AMOUNT)) {
      throw new FinancialMismatchError(`items[${i}].lineTaxAmount`, String(serverLine.lineTaxAmount), String(clientItem.lineTaxAmount));
    }
  }
}
