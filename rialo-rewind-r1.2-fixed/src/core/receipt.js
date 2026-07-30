export function createWorkflowReceipt({ result, failedStep, retries, refund, traces = [] }) {
  return Object.freeze({
    schema: "rialo-rewind.receipt.v1",
    workflowId: "RW-0247",
    result,
    failedStep,
    retries: Number(retries),
    refund,
    traces: [...traces],
    issuedAt: new Date().toISOString(),
  });
}

export function serializeReceipt(receipt) {
  return JSON.stringify(receipt, null, 2);
}
