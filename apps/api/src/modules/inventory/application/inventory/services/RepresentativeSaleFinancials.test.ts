import { describe, expect, it } from 'vitest';
import {
  assertClientFinancialsMatchServerDerived,
  deriveRepresentativeSaleFinancials,
  type ProductFinancialSource,
} from './RepresentativeSaleFinancials';
import { FinancialMismatchError, InvalidProductTaxConfigurationError, ValidationError } from '../../../../../core/errors/AppError';

/**
 * DB-R10C.2 — unit tests for the server-authoritative financial
 * derivation core. These are pure-function tests (no DB, no use-case
 * wiring) covering the calculation/validation logic in isolation;
 * CreateRepresentativeSale.use-case.test.ts covers the same behavior
 * wired through the full use-case.
 */
describe('deriveRepresentativeSaleFinancials', () => {
  const canonicalProduct: ProductFinancialSource = { id: 'p1', defaultPrice: 100, defaultTaxRate: 0.15 };
  const legacyProduct: ProductFinancialSource = { id: 'p2', defaultPrice: 100, defaultTaxRate: 15.0 };

  it('A. computes a normal canonical sale correctly (price 100, tax 0.15, qty 2)', () => {
    const result = deriveRepresentativeSaleFinancials([
      { productId: 'p1', quantity: 2, product: canonicalProduct },
    ]);
    expect(result.amountBeforeTax).toBe(200);
    expect(result.taxAmount).toBe(30);
    expect(result.totalAmount).toBe(230);
    expect(result.lines[0].unitPrice).toBe(100);
    expect(result.lines[0].lineTaxAmount).toBe(30);
  });

  it('H. legacy stored tax rate 15 (percentage-points) is temporarily converted to 0.15 for calculation', () => {
    const result = deriveRepresentativeSaleFinancials([
      { productId: 'p2', quantity: 2, product: legacyProduct },
    ]);
    // Identical result to the canonical 0.15 product — proves the
    // temporary read-compatibility adapter works transparently.
    expect(result.amountBeforeTax).toBe(200);
    expect(result.taxAmount).toBe(30);
    expect(result.totalAmount).toBe(230);
  });

  it('I. rejects invalid stored tax rate (negative) — fails closed, no silent default', () => {
    const badProduct: ProductFinancialSource = { id: 'p3', defaultPrice: 100, defaultTaxRate: -5 };
    expect(() =>
      deriveRepresentativeSaleFinancials([{ productId: 'p3', quantity: 1, product: badProduct }])
    ).toThrow(InvalidProductTaxConfigurationError);
  });

  it('I. rejects invalid stored tax rate (>100) — fails closed', () => {
    const badProduct: ProductFinancialSource = { id: 'p4', defaultPrice: 100, defaultTaxRate: 150 };
    expect(() =>
      deriveRepresentativeSaleFinancials([{ productId: 'p4', quantity: 1, product: badProduct }])
    ).toThrow(InvalidProductTaxConfigurationError);
  });

  it('I. rejects non-finite stored tax rate — fails closed', () => {
    const badProduct: ProductFinancialSource = { id: 'p5', defaultPrice: 100, defaultTaxRate: NaN };
    expect(() =>
      deriveRepresentativeSaleFinancials([{ productId: 'p5', quantity: 1, product: badProduct }])
    ).toThrow(InvalidProductTaxConfigurationError);
  });

  it('J. decimal boundary: price 33.33 x qty 3, tax 0.15 — exact, no float noise', () => {
    const product: ProductFinancialSource = { id: 'p6', defaultPrice: 33.33, defaultTaxRate: 0.15 };
    const result = deriveRepresentativeSaleFinancials([{ productId: 'p6', quantity: 3, product }]);
    // 33.33*3 = 99.99 exactly; 99.99*0.15 = 14.9985 -> rounds to 15.00 (half away from zero)
    expect(result.amountBeforeTax).toBe(99.99);
    expect(result.taxAmount).toBe(15);
    expect(result.totalAmount).toBe(114.99);
  });

  it('K. rounding boundary: reproduces the DB-R10A 987 x 12.345 example with zero float noise', () => {
    const product: ProductFinancialSource = { id: 'p7', defaultPrice: 12.345, defaultTaxRate: 0 };
    const result = deriveRepresentativeSaleFinancials([{ productId: 'p7', quantity: 987, product }]);
    // Exact product is 12184.515 (unlike JS float: 12184.515000000001) -> rounds to 12184.52
    expect(result.amountBeforeTax).toBe(12184.52);
  });

  it('L. large but valid amount', () => {
    const product: ProductFinancialSource = { id: 'p8', defaultPrice: 999999.99, defaultTaxRate: 0.15 };
    const result = deriveRepresentativeSaleFinancials([{ productId: 'p8', quantity: 100, product }]);
    expect(result.amountBeforeTax).toBe(99999999);
    expect(result.taxAmount).toBe(14999999.85);
  });

  it('M. rejects zero quantity', () => {
    expect(() =>
      deriveRepresentativeSaleFinancials([{ productId: 'p1', quantity: 0, product: canonicalProduct }])
    ).toThrow(ValidationError);
  });

  it('M. rejects negative quantity', () => {
    expect(() =>
      deriveRepresentativeSaleFinancials([{ productId: 'p1', quantity: -2, product: canonicalProduct }])
    ).toThrow(ValidationError);
  });

  it('M. rejects non-integer quantity', () => {
    expect(() =>
      deriveRepresentativeSaleFinancials([{ productId: 'p1', quantity: 2.5, product: canonicalProduct }])
    ).toThrow(ValidationError);
  });

  it('rejects an empty items list', () => {
    expect(() => deriveRepresentativeSaleFinancials([])).toThrow(ValidationError);
  });

  it('sums multiple line items into order-level totals without float drift', () => {
    const productA: ProductFinancialSource = { id: 'pa', defaultPrice: 33.33, defaultTaxRate: 0.15 };
    const productB: ProductFinancialSource = { id: 'pb', defaultPrice: 12.345, defaultTaxRate: 0.15 };
    const result = deriveRepresentativeSaleFinancials([
      { productId: 'pa', quantity: 3, product: productA }, // 99.99 + 15.00 tax
      { productId: 'pb', quantity: 987, product: productB }, // 12184.52 + 1827.68 tax (0.15*12184.515 exact=1827.6772...5 -> check separately)
    ]);
    expect(result.amountBeforeTax).toBe(99.99 + 12184.52);
    expect(result.lines).toHaveLength(2);
  });
});

describe('assertClientFinancialsMatchServerDerived', () => {
  const server = {
    lines: [{ productId: 'p1', quantity: 2, unitPrice: 100, lineTaxAmount: 30, amountBeforeTaxDecimal: '200.00', taxAmountDecimal: '30.00' }],
    amountBeforeTax: 200,
    taxAmount: 30,
    totalAmount: 230,
  };

  it('passes when client values match server-derived values exactly', () => {
    expect(() =>
      assertClientFinancialsMatchServerDerived(
        { amountBeforeTax: 200, taxAmount: 30, totalAmount: 230, items: [{ productId: 'p1', unitPrice: 100, lineTaxAmount: 30 }] },
        server
      )
    ).not.toThrow();
  });

  it('passes when client omits all financial fields (undefined = nothing to compare)', () => {
    expect(() =>
      assertClientFinancialsMatchServerDerived({ items: [{ productId: 'p1' }] }, server)
    ).not.toThrow();
  });

  it('B. rejects a malicious/stale client unitPrice', () => {
    expect(() =>
      assertClientFinancialsMatchServerDerived(
        { items: [{ productId: 'p1', unitPrice: 1 }] }, // real price is 100
        server
      )
    ).toThrow(FinancialMismatchError);
  });

  it('C. rejects a malicious/stale client amountBeforeTax', () => {
    expect(() =>
      assertClientFinancialsMatchServerDerived({ amountBeforeTax: 2, items: [{ productId: 'p1' }] }, server)
    ).toThrow(FinancialMismatchError);
  });

  it('D. rejects a malicious/stale client taxAmount', () => {
    expect(() =>
      assertClientFinancialsMatchServerDerived({ taxAmount: 0, items: [{ productId: 'p1' }] }, server)
    ).toThrow(FinancialMismatchError);
  });

  it('E. rejects a malicious/stale client totalAmount', () => {
    expect(() =>
      assertClientFinancialsMatchServerDerived({ totalAmount: 2, items: [{ productId: 'p1' }] }, server)
    ).toThrow(FinancialMismatchError);
  });

  it('tolerates values that differ only in binary float representation, not in decimal value', () => {
    expect(() =>
      assertClientFinancialsMatchServerDerived(
        { amountBeforeTax: 0.1 + 0.2 + 199.7, items: [{ productId: 'p1' }] }, // = 200.00000000000003 in raw float
        server
      )
    ).not.toThrow();
  });
});
