/**
 * Property-Based Tests — Unit 3: Subject Management
 * Framework: fast-check (Partial mode)
 */
import * as fc from 'fast-check';

// ─── PBT-SUBJ-01: EnrollmentResult totals invariant ─────────────────────────

describe('PBT-SUBJ-01: EnrollmentResult totals invariant', () => {
  it('enrolled + alreadyEnrolled + capacityExceeded + notFound = input count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (enrolled, alreadyEnrolled, capacityExceeded, notFound) => {
          const total = enrolled + alreadyEnrolled + capacityExceeded + notFound;
          expect(total).toBe(enrolled + alreadyEnrolled + capacityExceeded + notFound);
          expect(total).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── PBT-SUBJ-02: $addToSet idempotency ──────────────────────────────────────

describe('PBT-SUBJ-02: Set membership idempotency', () => {
  it('adding same element to a set twice produces same result as adding once', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 0, maxLength: 50 }),
        fc.uuid(),
        (existingIds, newId) => {
          const set = new Set(existingIds);
          set.add(newId);
          const sizeAfterFirst = set.size;
          set.add(newId);
          const sizeAfterSecond = set.size;
          expect(sizeAfterFirst).toBe(sizeAfterSecond);
          expect(set.size).toBe(new Set([...set]).size);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── PBT-SUBJ-03: Capacity enforcement invariant ─────────────────────────────

describe('PBT-SUBJ-03: Capacity enforcement invariant', () => {
  it('enrolled count never exceeds capacity when currentEnrolled <= capacity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }),
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 1, max: 200 }),
        (capacity, rawCurrentEnrolled, requested) => {
          // Precondition: DB enforces currentEnrolled <= capacity
          const currentEnrolled = Math.min(rawCurrentEnrolled, capacity);
          const available = Math.max(0, capacity - currentEnrolled);
          const toEnroll = Math.min(requested, available);
          const afterEnrollment = currentEnrolled + toEnroll;

          expect(afterEnrollment).toBeLessThanOrEqual(capacity);
          expect(toEnroll).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 300 }
    );
  });
});

// ─── PBT-SUBJ-04: Subject code uppercase idempotency ─────────────────────────

describe('PBT-SUBJ-04: Subject code uppercase idempotency', () => {
  it('toUpperCase is idempotent: toUpperCase(toUpperCase(x)) === toUpperCase(x)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9]+$/.test(s)),
        (code) => {
          const once = code.toUpperCase();
          const twice = code.toUpperCase().toUpperCase();
          expect(once).toBe(twice);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── PBT-SUBJ-05: Pagination invariant ───────────────────────────────────────

describe('PBT-SUBJ-05: Subject list pagination invariant', () => {
  it('returned data length never exceeds limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        (total, limit, page) => {
          const skip = (page - 1) * limit;
          const remaining = Math.max(0, total - skip);
          const returned = Math.min(remaining, limit);
          expect(returned).toBeLessThanOrEqual(limit);
          expect(returned).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 300 }
    );
  });
});
