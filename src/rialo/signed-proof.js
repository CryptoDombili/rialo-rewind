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

function explorerUrl(signature) {
  return `${EXPLORER_BASE}/transactions/${encodeURIComponent(signature)}?cluster=devnet`;
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

function markFailure(stage) {
  const order = ["wallet", "fund", "sign", "confirm"];
  const failedIndex = Math.max(0, order.indexOf(stage));
  order.forEach((name, index) => {
    if (index < failedIndex) setStep(name, "complete", "COMPLETE");
    else if (index === failedIndex) setStep(name, "failed", "FAILED");
    else setStep(name, "idle", "NOT RUN");
  });
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

  function exposeSignature(payload) {
    if (!payload?.signature) return;
    lastSignature = payload.signature;
    setText("signedProofSignature", payload.signature);
    setText("proofSignatureShort", short(payload.signature, 5, 5));
    const explorer = byId("signedProofExplorer");
    if (explorer) {
      explorer.href = explorerUrl(payload.signature);
      explorer.removeAttribute("aria-disabled");
    }
    if (copyButton) copyButton.disabled = false;
  }

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
    progressTimers.push(window.setTimeout(() => {
      setStep("wallet", "complete", "GENERATED");
      setStep("fund", "running", "FUNDING");
    }, 700));
    progressTimers.push(window.setTimeout(() => setStep("sign", "running", "SIGNING"), 4_500));
    progressTimers.push(window.setTimeout(() => setStep("confirm", "running", "FINALIZING"), 8_500));

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 62_000);
    try {
      const response = await fetch("/api/proof", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-rewind-proof": "v0.7",
        },
        body: JSON.stringify({ intent: "signed-devnet-proof" }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (payload.ok !== true) {
        const error = new Error(payload.error?.message || `Proof runner returned HTTP ${response.status}.`);
        error.stage = payload.stage || "wallet";
        error.payload = payload;
        throw error;
      }

      clearTimers();
      exposeSignature(payload);
      setStep("wallet", "complete", "GENERATED");
      setStep("fund", "complete", "FUNDED");
      setStep("sign", "complete", "SIGNED + SENT");
      setText("proofWalletAddress", payload.sender);
      setText("proofBalanceBefore", payload.balanceBefore);
      setText("proofBalanceAfter", payload.balanceAfter);
      setText("proofRecipientShort", short(payload.recipient));
      setText("proofDuration", `${payload.durationMs} ms`);

      if (payload.status === "submitted") {
        setStep("confirm", "running", "SUBMITTED");
        setText("proofBlockResult", payload.blockHeight ? `Submitted near block ${payload.blockHeight}` : "Submitted to Rialo devnet");
        setText("signedProofBadge", "SUBMITTED");
        setText("proofSignedStatus", "SUBMITTED");
        if (result) result.dataset.state = "pending";
        showToast("PROOF SUBMITTED", "The signature is live. Explorer finality may appear shortly.");
      } else {
        setStep("confirm", "complete", "FINALIZED");
        setText("proofBlockResult", payload.blockHeight ? `Finalized at block ${payload.blockHeight}` : "Confirmed by Rialo devnet");
        setText("signedProofBadge", "CONFIRMED");
        setText("proofSignedStatus", "CONFIRMED");
        if (result) result.dataset.state = "success";
        showToast("SIGNED PROOF CONFIRMED", `Rialo signature ${short(payload.signature)}.`);
      }
    } catch (error) {
      clearTimers();
      const stage = error?.stage || "wallet";
      markFailure(stage);
      if (error?.payload?.sender) setText("proofWalletAddress", error.payload.sender);
      setText("signedProofBadge", "FAILED");
      setText("proofSignedStatus", "FAILED");
      setText("signedProofSignature", error?.name === "AbortError" ? "Proof timed out after 62 seconds." : error.message);
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
      showToast("SIGNATURE COPIED", "The devnet signature is on your clipboard.");
    } catch {
      showToast("COPY FAILED", "Select the signature manually and copy it.");
    }
  });

  resetProofUi();
  return { runProof, resetProofUi };
}
