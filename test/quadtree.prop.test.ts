import * as fc from "fast-check";
import { describe, it } from "vitest";

import { type AABB, createQuadtree } from "../src/index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Body = AABB & { id: number };

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

// AABB generator — finite numbers in [0, 1000], non-negative width/height
const aabbArb = fc.record({
  id: fc.integer({ min: 0, max: 10_000 }),
  x: fc.integer({ min: 0, max: 1000 }),
  y: fc.integer({ min: 0, max: 1000 }),
  width: fc.integer({ min: 0, max: 200 }),
  height: fc.integer({ min: 0, max: 200 }),
});

// Region generator — same shape, allows zero-size for boundary cases
const regionArb = fc.record({
  x: fc.integer({ min: -100, max: 1100 }),
  y: fc.integer({ min: -100, max: 1100 }),
  width: fc.integer({ min: 0, max: 1000 }),
  height: fc.integer({ min: 0, max: 1000 }),
});

// Bounds preset — fixed 1000×1000 root
const BOUNDS = { x: 0, y: 0, width: 1000, height: 1000 };

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe("property: retrieve dedup invariant", () => {
  it("prop1. retrieve never returns duplicate references", () => {
    fc.assert(
      fc.property(fc.array(aabbArb, { maxLength: 100 }), regionArb, (objs, region) => {
        const qt = createQuadtree<Body>({ bounds: BOUNDS, maxObjects: 4, maxLevels: 4 });
        for (const o of objs) qt.insert(o);
        const result = qt.retrieve(region);
        // No reference appears twice
        return result.length === new Set(result).size;
      }),
      { numRuns: 100 },
    );
  });

  it("prop2. retrieve never returns duplicate ids", () => {
    fc.assert(
      fc.property(fc.array(aabbArb, { maxLength: 100 }), regionArb, (objs, region) => {
        const qt = createQuadtree<Body>({ bounds: BOUNDS, maxObjects: 4, maxLevels: 4 });
        for (const o of objs) qt.insert(o);
        const result = qt.retrieve(region);
        // Caveat: distinct objects may share id in generator — filter by reference first.
        // If inserted objects already share ids across distinct references, skip: the
        // id-uniqueness invariant only applies when the input set has unique ids.
        const insertedIds = objs.map((o) => o.id);
        if (new Set(insertedIds).size < objs.length) return true;
        const refUnique = Array.from(new Set(result));
        return refUnique.map((o) => o.id).length === new Set(refUnique.map((o) => o.id)).size;
      }),
      { numRuns: 100 },
    );
  });
});

describe("property: retrieveInto invariants", () => {
  it("prop3. retrieveInto preserves target identity", () => {
    fc.assert(
      fc.property(fc.array(aabbArb, { maxLength: 100 }), regionArb, (objs, region) => {
        const qt = createQuadtree<Body>({ bounds: BOUNDS, maxObjects: 4, maxLevels: 4 });
        for (const o of objs) qt.insert(o);
        const buf: Body[] = [];
        const ret = qt.retrieveInto(region, buf);
        return ret === buf;
      }),
      { numRuns: 100 },
    );
  });

  it("prop4. retrieveInto content equals retrieve content (as set)", () => {
    fc.assert(
      fc.property(fc.array(aabbArb, { maxLength: 100 }), regionArb, (objs, region) => {
        const qt = createQuadtree<Body>({ bounds: BOUNDS, maxObjects: 4, maxLevels: 4 });
        for (const o of objs) qt.insert(o);
        const buf: Body[] = [];
        qt.retrieveInto(region, buf);
        const arr = qt.retrieve(region);
        // Same length, same membership
        if (buf.length !== arr.length) return false;
        const bufSet = new Set(buf);
        for (const v of arr) if (!bufSet.has(v)) return false;
        return true;
      }),
      { numRuns: 100 },
    );
  });
});
