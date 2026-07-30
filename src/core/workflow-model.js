export const FORWARD_STEPS = Object.freeze([
  "reserve",
  "escrow",
  "merchant",
  "courier",
  "settle",
]);

export const COMPENSATION_STEPS = Object.freeze([
  "refund",
  "cancel",
  "release",
]);

export function compensationPlanFor(failedStep) {
  if (!FORWARD_STEPS.includes(failedStep)) throw new Error(`Unknown workflow step: ${failedStep}`);
  if (failedStep === "reserve") return [];
  if (failedStep === "escrow") return ["release"];
  if (failedStep === "merchant") return ["refund", "release"];
  return [...COMPENSATION_STEPS];
}
