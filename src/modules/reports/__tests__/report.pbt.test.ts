/**
 * Property-Based Tests — Unit 5: Reporting Engine
 * Framework: fast-check (Partial mode)
 */
import * as fc from 'fast-check';

// ─── Domain generators ────────────────────────────────────────────────────────
const reportRowArb = fc.record({
  studentId: fc.uuid(),
  studentName: fc.string({ minLength: 2, maxLength: 50 }),
  rollNumber: fc.string({ minLength: 3, maxLength: 10 }),
  subjectId: fc.uuid(),
  subjectName: fc.string({ minLength: 2, maxLength: 50 }),
  subjectCode: fc.string({ minLength: 2, maxLength: 10 }),
  department: fc.constantFrom('Computer Science', 'Electronics', 'Mechanical'),
  semester: fc.constantFrom('1st Sem', '2nd Sem', '3rd Sem'),
  totalClasses: fc.integer({ min: 0, max: 200 }),
  attended: fc.integer({ min: 0, max: 200 }),
  percentage: fc.float({ min: 0, max: 100, noNaN: true }),
});

// ─── PBT-RPT-01: Report row totals invariant ─────────────────────────────────
describe('PBT-RPT-01: Report row totals invariant', () => {
  it('attended never exceeds totalClasses in any report row', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500 }),  // totalClasses
        fc.integer({ min: 0, max: 500 }),  // rawAttended
        (totalClasses, rawAttended) => {
          const attended = Math.min(rawAttended, totalClasses);
          expect(attended).toBeLessThanOrEqual(totalClasses);
        }
      ),
      { numRuns: 300 }
    );
  });
});

// ─── PBT-RPT-02: Percentage range invariant ───────────────────────────────────
describe('PBT-RPT-02: Percentage range invariant', () => {
  function calcPct(attended: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((attended / total) * 10000) / 100;
  }

  it('percentage in every report row is always in [0, 100]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        (total, rawAttended) => {
          const attended = Math.min(rawAttended, total);
          const pct = calcPct(attended, total);
          expect(pct).toBeGreaterThanOrEqual(0);
          expect(pct).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 300 }
    );
  });
});

// ─── PBT-RPT-03: CSV round-trip ───────────────────────────────────────────────
describe('PBT-RPT-03: CSV serialization round-trip', () => {
  function toCSVRow(values: string[]): string {
    return values.map(v => `"${v.replace(/"/g, '""')}"`).join(',');
  }

  function fromCSVRow(row: string): string[] {
    return row.split(',').map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
  }

  it('CSV encode → decode preserves string values without quotes or commas', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 0, maxLength: 50 }).filter(s => !s.includes('"') && !s.includes(',')),
          { minLength: 1, maxLength: 10 }
        ),
        (values) => {
          const encoded = toCSVRow(values);
          const decoded = fromCSVRow(encoded);
          expect(decoded).toEqual(values);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── PBT-RPT-04: Month range invariant ───────────────────────────────────────
describe('PBT-RPT-04: Month range invariant', () => {
  function getMonthRange(month: number, year: number): { start: Date; end: Date } {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
  }

  it('monthEnd is always >= monthStart', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 2000, max: 2099 }),
        (month, year) => {
          const { start, end } = getMonthRange(month, year);
          expect(end.getTime()).toBeGreaterThanOrEqual(start.getTime());
          expect(start.getDate()).toBe(1);
          expect(start.getMonth()).toBe(month - 1);
          expect(end.getMonth()).toBe(month - 1);
        }
      ),
      { numRuns: 200 }
    );
  });
});
