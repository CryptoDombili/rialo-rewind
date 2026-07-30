const EXPLORER_BASE = "https://explorer.rialo.io";

function byId(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const node = byId(id);
  if (node) node.textContent = value;
}

function setStep(name, state, label) {
  const card = document.querySelector(`[data-proof-step="${name}"]`);
  if (card) card.dataset.state = state;
  const id = `proofStep${name[0].toUpperCase()}${name.slice(1)}`;
  setText(id, label);
}

function short(value, head = 7, tail = 7) {
  if (!value || value.length <= head + tail + 1) return value || "—";
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function resetProofUi() {
  ["wallet", "fund", "sign", "confirm"].forEach((name) => setStep(name, "idle", "WAITING"));
  setText("proofWalletAddress", "No address generated");
  setText("proofBlockResult", "Awaiting confirmation");
  setText("signedProofBadge", "NOT RUN");
  setText("signedProofSignature", "—");
  setText("proofBalanceBefore", "—");
  setText("proofBalanceAfter", "—");
  setText("proofRecipientShort", "—");
  setText("proofDuration", "—");
  setText("proofSignedStatus", "NOT RUN");
  setText("proofSignatureShort", "—");
  const result = byId("signedProofResult");
  if (result) result.dataset.state = "idle";
  const explorer = byId("signedProofExplorer");
  if (explorer) {
    explorer.href = "#";
    explorer.setAttribute("aria-disabled", "true");
  }
  const copy = byId("copyProofSignature");
  if (copy) copy.disabled = true;
}

export function initSignedProof({ showToast }) {
  const runButton = byId("runSignedProof");
  const copyButton = byId("copyProofSignature");
  let active = false;
  let lastSignature = "";
  let progressTimers = [];

  const clearTimers = () => {
    progressTimers.forEach((timer) => window.clearTimeout(timer));
    progressTimers = [];
  };

  async function runProof() {
    if (active) return;
    active = true;
    lastSignature = "";
    clearTimers();
    resetProofUi();
    runButton?.setAttribute("disabled", "");
    setText("signedProofBadge", "EXECUTING");
    setText("proofSignedStatus", "EXECUTING");
    const result = byId("signedProofResult");
    if (result) result.dataset.state = "running";

    setStep("wallet", "running", "GENERATING");
    progressTimers.push(window.setTimeout(() => setStep("fund", "running", "REQUESTING"), 900));
    progressTimers.push(window.setTimeout(() => setStep("sign", "running", "PREPARING"), 2400));
    progressTimers.push(window.setTimeout(() => setStep("confirm", "running", "WAITING"), 4200));

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 65_000);
    try {
      const response = await fetch("/api/proof", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: "signed-devnet-proof" }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok !== true) {
        throw new Error(payload.error?.message || `Proof runner returned HTTP ${response.status}.`);
      }

      clearTimers();
      lastSignature = payload.signature;
      setStep("wallet", "complete", "GENERATED");
      setStep("fund", "complete", "CONFIRMED");
      setStep("sign", "complete", "SIGNED + SENT");
      setStep("confirm", "complete", "FINALIZED");
      setText("proofWalletAddress", payload.sender);
      setText("proofBlockResult", payload.blockHeight ? `Finalized at block ${payload.blockHeight}` : "Confirmed by Rialo devnet");
      setText("signedProofBadge", "CONFIRMED");
      setText("signedProofSignature", payload.signature);
      setText("proofBalanceBefore", payload.balanceBefore);
      setText("proofBalanceAfter", payload.balanceAfter);
      setText("proofRecipientShort", short(payload.recipient));
      setText("proofDuration", `${payload.durationMs} ms`);
      setText("proofSignedStatus", "CONFIRMED");
      setText("proofSignatureShort", short(payload.signature, 5, 5));
      if (result) result.dataset.state = "success";

      const explorer = byId("signedProofExplorer");
      if (explorer) {
        explorer.href = `${EXPLORER_BASE}/transactions/${encodeURIComponent(payload.signature)}?cluster=devnet`;
        explorer.removeAttribute("aria-disabled");
      }
      if (copyButton) copyButton.disabled = false;
      showToast("SIGNED PROOF CONFIRMED", `Rialo signature ${short(payload.signature)}.`);
    } catch (error) {
      clearTimers();
      ["wallet", "fund", "sign", "confirm"].forEach((name) => {
        const card = document.querySelector(`[data-proof-step="${name}"]`);
        if (card?.dataset.state === "running") setStep(name, "failed", "FAILED");
      });
      setText("signedProofBadge", "FAILED");
      setText("proofSignedStatus", "FAILED");
      setText("signedProofSignature", error?.name === "AbortError" ? "Proof timed out after 65 seconds." : error.message);
      if (result) result.dataset.state = "failed";
      showToast("SIGNED PROOF FAILED", error?.name === "AbortError" ? "The devnet proof timed out." : error.message);
    } finally {
      window.clearTimeout(timeout);
      active = false;
      runButton?.removeAttribute("disabled");
    }
  }

  runButton?.addEventListener("click", runProof);
  copyButton?.addEventListener("click", async () => {
    if (!lastSignature) return;
    try {
      await navigator.clipboard.writeText(lastSignature);
      showToast("SIGNATURE COPIED", "The confirmed devnet signature is on your clipboard.");
    } catch {
      showToast("COPY FAILED", "Select the signature manually and copy it.");
    }
  });

  resetProofUi();
  return { runProof, resetProofUi };
}
