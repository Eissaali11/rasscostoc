import { describe, expect, it } from 'vitest';
import {
  assertClientFinancialsMatchServerDerived,
  deriveRepresentativeSaleFinancials,
  type ProductFinancialSource,
} from './RepresentativeSaleFinancials';
import { FinancialMismatchError, ValidationError } from '../../../../../core/errors/AppError';

/**
 * DB-R10C.2 / DB-R10C.3 — unit tests for the server-authoritative
 * financial derivation core. These are pure-function tests (no DB, no
 * use-case wiring) covering the calculation/validation logic in
 * isolation; CreateRepresentativeSale.use-case.test.ts covers the same
 * behavior wired through the full use-case.
 *
 * Post-DB-R10C.3: ProductFinancialSource.defaultPrice/defaultTaxRate are
 * exact decimal STRINGS (matching the NUMERIC(14,4)/NUMERIC(5,4)
 * columns), never JS numbers — fixtures below reflect that.
 */
describe('deriveRepresentativeSaleFinancials', () => {
  const canonicalProduct: ProductFinancialSource = { id: 'p1', defaultPrice: '100.0000', defaultTaxRate: '0.1500' };

  it('A. computes a normal canonical sale correctly (price 100, tax 0.15, qty 2)', () => {
    const result = deriveRepresentativeSaleFinancials([
      { productId: 'p1', quantity: 2, product: canonicalProduct },
    ]);
    expect(result.amountBeforeTax).toBe('200.00');
    expect(result.taxAmount).toBe('30.00');
    expect(result.totalAmount).toBe('230.00');
  });

  it('J. decimal boundary: price 33.33 x qty 3, tax 0.15 — exact, no float noise', () => {
    const product: ProductFinancialSource = { id: 'p6', defaultPrice: '33.3300', defaultTaxRate: '0.1500' };
    const result = deriveRepresentativeSaleFinancials([{ productId: 'p6', quantity: 3, product }]);
    // 33.33*3 = 99.99 exactly; 99.99*0.15 = 14.9985 -> rounds to 15.00 (half away from zero)
    expect(result.amountBeforeTax).toBe('99.99');
    expect(result.taxAmount).toBe('15.00');
    expect(result.totalAmount).toBe('114.99');
  });

  it('K. rounding boundary: reproduces the DB-R10A 987 x 12.345 example with zero float noise', () => {
    const product: ProductFinancialSource = { id: 'p7', defaultPrice: '12.3450', defaultTaxRate: '0.0000' };
    const result = deriveRepresentativeSaleFinancials([{ productId: 'p7', quantity: 987, product }]);
    // Exact product is 12184.515 (unlike JS float: 12184.515000000001) -> rounds to 12184.52
    expect(result.amountBeforeTax).toBe('12184.52');
  });

  it('L. large but valid amount', () => {
    const product: ProductFinancialSource = { id: 'p8', defaultPrice: '999999.9900', defaultTaxRate: '0.1500' };
    const result = deriveRepresentativeSaleFinancials([{ productId: 'p8', quantity: 100, product }]);
    expect(result.amountBeforeTax).toBe('99999999.00');
    expect(result.taxAmount).toBe('14999999.85');
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
    const productA: ProductFinancialSource = { id: 'pa', defaultPrice: '33.3300', defaultTaxRate: '0.1500' };
    const productB: ProductFinancialSource = { id: 'pb', defaultPrice: '12.3450', defaultTaxRate: '0.1500' };
    const result = deriveRepresentativeSaleFinancials([
      { productId: 'pa', quantity: 3, product: productA }, // 99.99 + 15.00 tax
      { productId: 'pb', quantity: 987, product: productB }, // 12184.52 + tax
    ]);
    expect(result.amountBeforeTax).toBe('12284.51'); // 99.99 + 12184.52
    expect(result.lines).toHaveLength(2);
  });

  it('rejects a non-decimal-string product price (defensive — DB always supplies exact decimal text)', () => {
    const malformedProduct = { id: 'pbad', defaultPrice: 'not-a-number', defaultTaxRate: '0.1500' } as ProductFinancialSource;
    expect(() =>
      deriveRepresentativeSaleFinancials([{ productId: 'pbad', quantity: 1, product: malformedProduct }])
    ).toThrow(TypeError);
  });
});

describe('assertClientFinancialsMatchServerDerived', () => {
  const server = {
    lines: [{ productId: 'p1', quantity: 2, unitPrice: '100.0000', lineTaxAmount: '30.00' }],
    amountBeforeTax: '200.00',
    taxAmount: '30.00',
    totalAmount: '230.00',
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

/**
 * DB-R10C.3R §6 — required deterministic comparison test matrix, proving
 * the corrected FINANCIAL_VALIDATION comparison (exact decimal-string
 * equality, never a binary-float comparison) behaves correctly at every
 * boundary the reviewer asked for.
 */
describe('DB-R10C.3R §6 — deterministic comparison matrix', () => {
  const makeServer = (amountBeforeTax: string, unitPrice = '100.0000') => ({
    lines: [{ productId: 'p1', quantity: 1, unitPrice, lineTaxAmount: '0.00' }],
    amountBeforeTax,
    taxAmount: '0.00',
    totalAmount: amountBeforeTax,
  });

  it('expected 100.00, client 100 (integer) -> MATCH', () => {
    expect(() =>
      assertClientFinancialsMatchServerDerived({ amountBeforeTax: 100, items: [{ productId: 'p1' }] }, makeServer('100.00'))
    ).not.toThrow();
  });

  it('expected 100.00, client 100.0 -> MATCH', () => {
    expect(() =>
      assertClientFinancialsMatchServerDerived({ amountBeforeTax: 100.0, items: [{ productId: 'p1' }] }, makeServer('100.00'))
    ).not.toThrow();
  });

  it('expected 114.99, client 114.99 -> MATCH', () => {
    expect(() =>
      assertClientFinancialsMatchServerDerived({ amountBeforeTax: 114.99, items: [{ productId: 'p1' }] }, makeServer('114.99'))
    ).not.toThrow();
  });

  it('expected 114.99, client 114.98 -> 409 (FinancialMismatchError)', () => {
    expect(() =>
      assertClientFinancialsMatchServerDerived({ amountBeforeTax: 114.98, items: [{ productId: 'p1' }] }, makeServer('114.99'))
    ).toThrow(FinancialMismatchError);
  });

  it('expected 33.3300 (unit price, scale 4), client 33.33 -> MATCH (33.33 rounds to 33.3300 at scale 4)', () => {
    expect(() =>
      assertClientFinancialsMatchServerDerived(
        { items: [{ productId: 'p1', unitPrice: 33.33 }] },
        makeServer('0.00', '33.3300')
      )
    ).not.toThrow();
  });

  it('expected 33.3300 (unit price, scale 4), client 33.3301 -> mismatch', () => {
    expect(() =>
      assertClientFinancialsMatchServerDerived(
        { items: [{ productId: 'p1', unitPrice: 33.3301 }] },
        makeServer('0.00', '33.3300')
      )
    ).toThrow(FinancialMismatchError);
  });

  it('negative client value mismatches a positive server value (no forbidden-sign special-case needed here — plain mismatch)', () => {
    expect(() =>
      assertClientFinancialsMatchServerDerived({ amountBeforeTax: -100, items: [{ productId: 'p1' }] }, makeServer('100.00'))
    ).toThrow(FinancialMismatchError);
  });

  it('very large valid value near approved NUMERIC(14,2) capacity matches exactly', () => {
    expect(() =>
      assertClientFinancialsMatchServerDerived(
        { amountBeforeTax: 999999999999.99, items: [{ productId: 'p1' }] },
        makeServer('999999999999.99')
      )
    ).not.toThrow();
  });

  it('binary-representation-prone values (0.1, 0.15, 33.33, 114.99) all match their exact decimal server counterparts deterministically', () => {
    const cases: Array<[number, string]> = [
      [0.1, '0.10'],
      [0.15, '0.15'],
      [33.33, '33.33'],
      [114.99, '114.99'],
    ];
    for (const [client, serverExact] of cases) {
      expect(() =>
        assertClientFinancialsMatchServerDerived({ amountBeforeTax: client, items: [{ productId: 'p1' }] }, makeServer(serverExact))
      ).not.toThrow();
    }
  });

  it('comparison is deterministic across repeated calls with the same inputs', () => {
    const results = Array.from({ length: 5 }, () => {
      try {
        assertClientFinancialsMatchServerDerived({ amountBeforeTax: 114.98, items: [{ productId: 'p1' }] }, makeServer('114.99'));
        return 'no-throw';
      } catch (e) {
        return e instanceof FinancialMismatchError ? 'mismatch' : 'other';
      }
    });
    expect(new Set(results).size).toBe(1); // always the same outcome
    expect(results[0]).toBe('mismatch');
  });
});
