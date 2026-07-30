import test from "node:test";
import assert from "node:assert/strict";

const KELVIN_PER_RLO = 1_000_000_000n;
function formatRlo(value) {
  const kelvin = BigInt(value);
  const whole = kelvin / KELVIN_PER_RLO;
  const fraction = (kelvin % KELVIN_PER_RLO).toString().padStart(9, "0").slice(0, 6);
  return `${whole}.${fraction} RLO`;
}

test("signed proof constants format to the intended devnet amounts", () => {
  assert.equal(formatRlo(50_000_000n), "0.050000 RLO");
  assert.equal(formatRlo(1_000_000n), "0.001000 RLO");
});
