import test from "node:test";
import assert from "node:assert/strict";
import { compensationPlanFor } from "../src/core/workflow-model.js";

test("courier failure triggers the full reverse plan", () => {
  assert.deepEqual(compensationPlanFor("courier"), ["refund", "cancel", "release"]);
});

test("early failures only compensate completed effects", () => {
  assert.deepEqual(compensationPlanFor("reserve"), []);
  assert.deepEqual(compensationPlanFor("escrow"), ["release"]);
});
