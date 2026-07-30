export async function executeServerWorkflow(mode) {
  const response = await fetch("/api/workflow", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-rewind-engine": "r1.4.5",
    },
    body: JSON.stringify({ mode }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    const error = new Error(payload?.error?.message || `Workflow API returned HTTP ${response.status}.`);
    error.status = response.status;
    error.code = payload?.error?.code || "WORKFLOW_API_ERROR";
    throw error;
  }
  return payload;
}
