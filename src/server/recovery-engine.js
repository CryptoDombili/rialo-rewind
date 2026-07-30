import { createHash, randomUUID } from "node:crypto";

export const ENGINE_VERSION = "r1.3";
export const WORKFLOW_ID = "RW-0247";
export const ESCROW_AMOUNT_RLO = 50;

const ACTION_DELAY_MS = Object.freeze({
  reserve: 55,
  escrow: 60,
  merchant: 65,
  courier: 70,
  settle: 60,
  refund: 70,
  cancel: 60,
  release: 55,
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function initialState() {
  return {
    inventory: { available: 10, reserved: 0 },
    escrow: { lockedRlo: 0, refundedRlo: 0, settledRlo: 0 },
    merchant: { orderId: null, status: "NONE" },
    courier: { shipmentId: null, status: "NONE" },
  };
}

function receiptHash(receiptWithoutHash) {
  return createHash("sha256").update(JSON.stringify(receiptWithoutHash)).digest("hex");
}

function makeTraceId(executionId, name, ordinal) {
  return `${name}_${executionId.slice(0, 8)}_${String(ordinal).padStart(2, "0")}`;
}

export async function executeRecoveryWorkflow({ mode = "failure", now = () => Date.now() } = {}) {
  if (!['clean', 'failure'].includes(mode)) throw new Error(`Unsupported workflow mode: ${mode}`);

  const executionId = randomUUID();
  const startedAtMs = now();
  const state = initialState();
  const stateBefore = clone(state);
  const events = [];
  const effects = new Map();
  let sequence = 0;
  let retries = 0;
  let failedStep = "NONE";

  const push = (type, detail = {}) => {
    events.push(Object.freeze({
      sequence: ++sequence,
      type,
      offsetMs: Math.max(0, now() - startedAtMs),
      ...detail,
    }));
  };

  const runIdempotent = async ({ name, source, key, compensation = false, mutate }) => {
    if (effects.has(key)) {
      const cached = effects.get(key);
      push("action.idempotent", { name, source, key, compensation, traceId: cached.traceId });
      return cached;
    }

    const traceId = makeTraceId(executionId, name, sequence + 1);
    push("action.started", { name, source, key, compensation, traceId });
    await sleep(ACTION_DELAY_MS[name] ?? 50);
    const result = await mutate();
    const record = Object.freeze({ traceId, result: clone(result) });
    effects.set(key, record);
    push("action.completed", { name, source, key, compensation, traceId, result: clone(result) });
    return record;
  };

  push("workflow.started", { mode, workflowId: WORKFLOW_ID, executionId });

  await runIdempotent({
    name: "reserve",
    source: "INVENTORY",
    key: `${executionId}:reserve:SKU-RL-01`,
    mutate: async () => {
      if (state.inventory.available < 1) throw new Error("Inventory unavailable.");
      state.inventory.available -= 1;
      state.inventory.reserved += 1;
      return { sku: "SKU-RL/01", reserved: 1 };
    },
  });

  await runIdempotent({
    name: "escrow",
    source: "ESCROW",
    key: `${executionId}:escrow:lock`,
    mutate: async () => {
      state.escrow.lockedRlo = ESCROW_AMOUNT_RLO;
      return { lockedRlo: ESCROW_AMOUNT_RLO };
    },
  });

  await runIdempotent({
    name: "merchant",
    source: "MERCHANT",
    key: `${executionId}:merchant:create:ORD-0247`,
    mutate: async () => {
      state.merchant.orderId = "ORD-0247";
      state.merchant.status = "CREATED";
      return { orderId: "ORD-0247", status: "CREATED" };
    },
  });

  if (mode === "failure") {
    failedStep = "CREATE SHIPMENT";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const traceId = makeTraceId(executionId, "courier", sequence + 1);
      push("action.started", {
        name: "courier",
        source: "COURIER",
        key: `${executionId}:courier:attempt:${attempt}`,
        compensation: false,
        traceId,
        attempt,
        maxAttempts: 3,
      });
      await sleep(ACTION_DELAY_MS.courier);
      retries = attempt;
      push("action.failed", {
        name: "courier",
        source: "COURIER",
        traceId,
        attempt,
        maxAttempts: 3,
        error: { code: "HTTP_503", message: "Courier sandbox unavailable." },
      });
      if (attempt < 3) push("retry.scheduled", { name: "courier", attempt: attempt + 1, delayMs: 120 });
      if (attempt < 3) await sleep(120);
    }

    push("workflow.halted", { failedStep, reason: "Retry ceiling reached." });
    push("compensation.started", { plan: ["refund", "cancel", "release"] });

    await runIdempotent({
      name: "refund",
      source: "ESCROW",
      key: `${executionId}:compensate:refund`,
      compensation: true,
      mutate: async () => {
        const amount = state.escrow.lockedRlo;
        state.escrow.lockedRlo = 0;
        state.escrow.refundedRlo += amount;
        return { refundedRlo: amount };
      },
    });

    await runIdempotent({
      name: "cancel",
      source: "MERCHANT",
      key: `${executionId}:compensate:cancel:ORD-0247`,
      compensation: true,
      mutate: async () => {
        state.merchant.status = "CANCELLED";
        return { orderId: "ORD-0247", status: "CANCELLED" };
      },
    });

    await runIdempotent({
      name: "release",
      source: "INVENTORY",
      key: `${executionId}:compensate:release:SKU-RL-01`,
      compensation: true,
      mutate: async () => {
        if (state.inventory.reserved > 0) {
          state.inventory.reserved -= 1;
          state.inventory.available += 1;
        }
        return { sku: "SKU-RL/01", released: 1 };
      },
    });
  } else {
    await runIdempotent({
      name: "courier",
      source: "COURIER",
      key: `${executionId}:courier:create:SHP-0247`,
      mutate: async () => {
        state.courier.shipmentId = "SHP-0247";
        state.courier.status = "CREATED";
        return { shipmentId: "SHP-0247", status: "CREATED" };
      },
    });

    await runIdempotent({
      name: "settle",
      source: "SETTLEMENT",
      key: `${executionId}:escrow:settle`,
      mutate: async () => {
        const amount = state.escrow.lockedRlo;
        state.escrow.lockedRlo = 0;
        state.escrow.settledRlo += amount;
        return { settledRlo: amount };
      },
    });
  }

  const result = mode === "failure" ? "COMPENSATED" : "SETTLED";
  push("workflow.completed", {
    result,
    failedStep,
    retries,
    refundRlo: state.escrow.refundedRlo,
    manualIntervention: false,
  });

  const completedAtMs = now();
  const receiptBase = {
    schema: "rialo-rewind.receipt.v2",
    engineVersion: ENGINE_VERSION,
    engine: "vercel-server-state-machine",
    workflowId: WORKFLOW_ID,
    executionId,
    mode,
    result,
    failedStep,
    retries,
    refund: `${state.escrow.refundedRlo.toFixed(2)} RLO`,
    manualIntervention: "NOT REQUIRED",
    stateBefore,
    stateAfter: clone(state),
    idempotencyKeys: [...effects.keys()],
    traces: events.filter((event) => event.traceId).map((event) => event.traceId),
    events,
    startedAt: new Date(startedAtMs).toISOString(),
    issuedAt: new Date(completedAtMs).toISOString(),
    durationMs: Math.max(0, completedAtMs - startedAtMs),
  };

  const hash = receiptHash(receiptBase);
  const receipt = Object.freeze({ ...receiptBase, receiptHash: hash });

  return Object.freeze({
    ok: true,
    execution: {
      workflowId: WORKFLOW_ID,
      executionId,
      mode,
      result,
      failedStep,
      retries,
      refundRlo: state.escrow.refundedRlo,
      durationMs: receipt.durationMs,
      events,
      stateAfter: clone(state),
    },
    receipt,
  });
}

export function verifyReceiptHash(receipt) {
  if (!receipt || typeof receipt !== "object" || typeof receipt.receiptHash !== "string") return false;
  const { receiptHash: supplied, ...base } = receipt;
  return receiptHash(base) === supplied;
}
