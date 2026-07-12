import assert from "node:assert/strict";
import test from "node:test";
import { createWeightExperiments } from "../app/weight-experiments.ts";

test("creates four deterministic weight directions", () => {
  const experiments = createWeightExperiments([{ weight: 1 }, { weight: 0.8 }, { weight: 1.2 }], 0.2);
  assert.equal(experiments.length, 4);
  assert.deepEqual(experiments[1].weights, [1.2, 0.6, 1.4]);
  assert.deepEqual(experiments[2].weights, [1.2, 0.7, 1.1]);
});

test("keeps locked artists unchanged and clamps extreme values", () => {
  const experiments = createWeightExperiments([{ weight: 1.3, locked: true }, { weight: 1.95 }], 0.4);
  assert.ok(experiments.every((experiment) => experiment.weights[0] === 1.3));
  assert.equal(experiments[1].weights[1], 1.55);
  assert.equal(experiments[2].weights[0], 1.3);
});

