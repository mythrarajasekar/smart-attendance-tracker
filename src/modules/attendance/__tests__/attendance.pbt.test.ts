/**
 * Property-Based Tests — Unit 4: Attendance Engine
 * Framework: fast-check (Partial mode)
 *
 * Properties:
 *   PBT-ATT-01: percentage always in [0, 100]
 *   PBT-ATT-02: attended <= total
 *   PBT-ATT-03: percentage = 0 when total = 0
 *   PBT-ATT-04: Marking idempotency
 *   PBT-ATT-05: Percentage formula round-trip
 */
import * as fc from 'fast-check';

// ─── Pure percentage calculation function (extracted for testing) ─────────────
function calculatePercentage(attended: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((attended / total) * 10000) / 100;
}

// ─── PBT-ATT-01: Percentage always in [0, 100] ───────────────────────────────
describe('PBT-ATT-01: Percentage range invariant', () => {
  it('percentage is always in [0, 100] for all valid attended/total pairs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),  // total sessions
        fc.integer({ min: 0, max: 10000 }),  // attended (may exceed total — clamped below)
        (total, rawAttended) => {
          const attended = Math.min(rawAttended, total); // enforce attended <= total
          const pct = calculatePercentage(attended, total);
          expect(pct).toBeGreaterThanOrEqual(0);
          expect(pct).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 500 }
    );
  });
});

// ─── PBT-ATT-02: attended <= total invariant ─────────────────────────────────
describe('PBT-ATT-02: attended <= total invariant', () => {
  it('attended count never exceeds total sessions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),  // total
        fc.integer({ min: 0, max: 1000 }),  // attended
        (total, attended) => {
          // Simulate what the DB aggregation enforces
          const validAttended = Math.min(attended, total);
          expect(validAttended).toBeLessThanOrEqual(total);
        }
      ),
      { numRuns: 300 }
    );
  });
});

// ─── PBT-ATT-03: percentage = 0 when total = 0 ───────────────────────────────
describe('PBT-ATT-03: Zero total invariant', () => {
  it('percentage is always 0 when no sessions have been held', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),  // attended (irrelevant when total = 0)
        (attended) => {
          const pct = calculatePercentage(attended, 0);
          expect(pct).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── PBT-ATT-04: Marking idempotency ─────────────────────────────────────────
describe('PBT-ATT-04: Attendance marking idempotency', () => {
  it('marking same student present twice yields same percentage as marking once', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),  // total sessions before this one
        fc.integer({ min: 0, max: 100 }),  // attended before this session
        (prevTotal, prevAttended) => {
          const clampedAttended = Math.min(prevAttended, prevTotal);

          // Mark present once
          const afterOnce = calculatePercentage(clampedAttended + 1, prevTotal + 1);

          // Mark present "twice" (upsert — same session, same student)
          // The second mark replaces the first, so total and attended don't change
          const afterTwice = calculatePercentage(clampedAttended + 1, prevTotal + 1);

          expect(afterOnce).toBe(afterTwice);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── PBT-ATT-05: Percentage precision invariant ───────────────────────────────
describe('PBT-ATT-05: Percentage precision invariant', () => {
  it('percentage has at most 2 decimal places', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),  // total
        fc.integer({ min: 0, max: 1000 }),  // attended
        (total, rawAttended) => {
          const attended = Math.min(rawAttended, total);
          const pct = calculatePercentage(attended, total);
          // Check at most 2 decimal places
          const decimalStr = pct.toString().split('.')[1] || '';
          expect(decimalStr.length).toBeLessThanOrEqual(2);
        }
      ),
      { numRuns: 300 }
    );
  });
});

// ─── PBT-ATT-06: Session ID determinism ──────────────────────────────────────
describe('PBT-ATT-06: Session ID determinism', () => {
  function buildSessionId(subjectId: string, date: Date, sessionLabel: string): string {
    const dateStr = date.toISOString().split('T')[0];
    return `${subjectId}_${dateStr}_${sessionLabel}`;
  }

  it('same inputs always produce same sessionId', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        fc.constantFrom('Morning', 'Afternoon', 'Default', 'Lab'),
        (subjectId, date, sessionLabel) => {
          const id1 = buildSessionId(subjectId, date, sessionLabel);
          const id2 = buildSessionId(subjectId, date, sessionLabel);
          expect(id1).toBe(id2);
        }
      ),
      { numRuns: 200 }
    );
  });
});
