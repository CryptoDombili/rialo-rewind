import {
  MAX_RECEIPT_BYTES,
  assertReceiptShape,
  buildVerificationReport,
  classifyReceiptVerification,
  createTamperedReceiptCopy,
  formatVerificationSummary,
  shortVerifierValue,
  verifyAnchorBinding,
  verifyReceiptIntegrity,
} from "./core/receipt-verifier-model.js";
import { verifyReceiptAnchor } from "./rialo/receipt-anchor.js";

export function initReceiptVerifier({ showToast = () => {} } = {}) {
  const modal = document.querySelector("#receiptVerifierModal");
  if (!modal) return;

  const fileInput = modal.querySelector("#verifierFileInput");
  const dropzone = modal.querySelector("#verifierDropzone");
  const loadButton = modal.querySelector("#verifierLoadButton");
  const resetButton = modal.querySelector("#verifierResetButton");
  const tamperButton = modal.querySelector("#verifierTamperButton");
  const copyButton = modal.querySelector("#verifierCopyButton");
  const downloadButton = modal.querySelector("#verifierDownloadButton");
  const closeButtons = modal.querySelectorAll("[data-verifier-close]");
  const result = modal.querySelector("#verifierResult");
  const badge = modal.querySelector("#verifierBadge");
  const headline = modal.querySelector("#verifierHeadline");
  const description = modal.querySelector("#verifierDescription");
  const fileName = modal.querySelector("#verifierFileName");
  const suppliedHash = modal.querySelector("#verifierSuppliedHash");
  const computedHash = modal.querySelector("#verifierComputedHash");
  const commitment = modal.querySelector("#verifierCommitment");
  const signature = modal.querySelector("#verifierSignature");
  const block = modal.querySelector("#verifierBlock");
  const mode = modal.querySelector("#verifierMode");
  const workflow = modal.querySelector("#verifierWorkflow");
  const execution = modal.querySelector("#verifierExecution");
  const summaryStatus = document.querySelector("#publicVerifierStatus");
  const summaryHash = document.querySelector("#publicVerifierHash");
  const summaryAnchor = document.querySelector("#publicVerifierAnchor");
  const steps = {
    json: modal.querySelector('[data-verifier-step="json"]'),
    hash: modal.querySelector('[data-verifier-step="hash"]'),
    binding: modal.querySelector('[data-verifier-step="binding"]'),
    chain: modal.querySelector('[data-verifier-step="chain"]'),
  };

  const required = { fileInput, dropzone, loadButton, resetButton, tamperButton, copyButton, downloadButton, result, badge, headline, description, fileName, suppliedHash, computedHash, commitment, signature, block, mode, workflow, execution, ...steps };
  const missing = Object.entries(required).filter(([, element]) => !element).map(([name]) => name);
  if (missing.length) throw new Error(`Receipt verifier DOM is incomplete: ${missing.join(", ")}`);

  let busy = false;
  let verifiedReceipt = null;
  let verifiedFileName = "";
  let lastReport = null;
  let opener = null;

  function setStep(name, state, label) {
    const element = steps[name];
    element.dataset.state = state;
    element.querySelector("strong").textContent = label;
  }

  function reset() {
    busy = false;
    fileInput.value = "";
    fileName.textContent = "No receipt selected";
    result.dataset.state = "idle";
    badge.textContent = "NOT RUN";
    headline.textContent = "Load a receipt to verify it.";
    description.textContent = "The file stays in your browser. Only its public Rialo anchor evidence is queried.";
    suppliedHash.textContent = "—";
    computedHash.textContent = "—";
    commitment.textContent = "—";
    signature.textContent = "—";
    block.textContent = "—";
    mode.textContent = "—";
    workflow.textContent = "—";
    execution.textContent = "—";
    Object.keys(steps).forEach((name) => setStep(name, "idle", "WAITING"));
    loadButton.disabled = false;
    resetButton.disabled = false;
    tamperButton.disabled = true;
    copyButton.disabled = true;
    downloadButton.disabled = true;
    lastReport = null;
    verifiedReceipt = null;
    verifiedFileName = "";
  }

  function open(event) {
    opener = event?.currentTarget || document.activeElement;
    modal.classList.add("is-visible");
    modal.setAttribute("aria-hidden", "false");
    loadButton.focus();
  }

  function close() {
    modal.classList.remove("is-visible");
    modal.setAttribute("aria-hidden", "true");
    if (opener && typeof opener.focus === "function") opener.focus();
  }

  function setFinal(state, text, detail, reportContext = null) {
    result.dataset.state = state.toLowerCase();
    badge.textContent = state;
    headline.textContent = text;
    description.textContent = detail;
    if (summaryStatus) {
      summaryStatus.textContent = state;
      summaryStatus.dataset.tone = state.toLowerCase();
    }
    if (summaryHash) summaryHash.textContent = computedHash.textContent;
    if (summaryAnchor) summaryAnchor.textContent = commitment.textContent;
    lastReport = reportContext ? buildVerificationReport({ verdict: state, detail, ...reportContext }) : null;
    copyButton.disabled = !lastReport;
    downloadButton.disabled = !lastReport;
  }

  async function verifyFile(file) {
    if (busy || !file) return;
    busy = true;
    loadButton.disabled = true;
    resetButton.disabled = true;
    reset();
    busy = true;
    loadButton.disabled = true;
    fileName.textContent = file.name;

    try {
      if (file.size > MAX_RECEIPT_BYTES) throw new Error("Receipt file is larger than 2 MB.");
      setStep("json", "running", "READING");
      const text = await file.text();
      const receipt = JSON.parse(text);
      let integrity = null;
      let binding = null;
      let chain = null;
      assertReceiptShape(receipt);
      setStep("json", "complete", "PARSED");
      workflow.textContent = receipt.workflowId;
      execution.textContent = shortVerifierValue(receipt.executionId, 8);

      setStep("hash", "running", "HASHING");
      integrity = await verifyReceiptIntegrity(receipt);
      suppliedHash.textContent = shortVerifierValue(integrity.suppliedHash, 12);
      computedHash.textContent = shortVerifierValue(integrity.computedHash, 12);
      if (!integrity.ok) {
        setStep("hash", "failed", "MISMATCH");
        setStep("binding", "blocked", "BLOCKED");
        setStep("chain", "blocked", "BLOCKED");
        setFinal("TAMPERED", "Receipt contents were changed.", "The locally recomputed SHA-256 hash does not match the supplied receipt hash.", { receipt, sourceFile: file.name, integrity, binding: { ok: false }, chain: null, chainQueried: false });
        showToast("TAMPERED RECEIPT", "Local hash mismatch detected.");
        return;
      }
      setStep("hash", "complete", "MATCHED");

      setStep("binding", "running", "CHECKING");
      binding = verifyAnchorBinding(receipt);
      if (!binding.ok) {
        setStep("binding", "failed", "INVALID");
        setStep("chain", "blocked", "BLOCKED");
        setFinal("TAMPERED", "Anchor evidence does not bind this receipt.", binding.error, { receipt, sourceFile: file.name, integrity, binding, chain: null, chainQueried: false });
        showToast("INVALID BINDING", binding.error);
        return;
      }
      commitment.textContent = shortVerifierValue(binding.anchor.commitmentAddress, 12);
      signature.textContent = shortVerifierValue(binding.anchor.signature, 12);
      setStep("binding", "complete", "BOUND");

      setStep("chain", "running", "QUERYING RIALO");
      try {
        chain = await verifyReceiptAnchor(binding.anchor);
      } catch (error) {
        setStep("chain", "failed", "UNAVAILABLE");
        setFinal("UNVERIFIED", "Receipt integrity is valid, but Rialo could not be queried.", error.message, { receipt, sourceFile: file.name, integrity, binding, chain: null, chainQueried: true });
        showToast("VERIFIER UNAVAILABLE", error.message);
        return;
      }

      block.textContent = chain.blockHeight || binding.anchor.blockHeight || "—";
      mode.textContent = chain.verificationMode || "—";
      const classification = classifyReceiptVerification({ integrity, binding, chain });
      if (classification === "VALID") {
        setStep("chain", "complete", "CONFIRMED");
        setFinal("VALID", "Receipt and Rialo anchor are valid.", "The workflow hash recomputes locally and its commitment is confirmed on Rialo devnet. Run the tamper test to prove altered data is rejected.", { receipt, sourceFile: file.name, integrity, binding, chain, chainQueried: true });
        verifiedReceipt = receipt;
        verifiedFileName = file.name;
        tamperButton.disabled = false;
        showToast("VALID RECEIPT", `${receipt.workflowId} is cryptographically intact and anchored.`);
      } else if (classification === "PENDING") {
        setStep("chain", "running", "SUBMITTED");
        setFinal("PENDING", "Receipt is intact; anchor finality is pending.", "The commitment was submitted but is not yet visible through final Rialo evidence.", { receipt, sourceFile: file.name, integrity, binding, chain, chainQueried: true });
        showToast("ANCHOR PENDING", "Receipt is intact; Rialo finality is still pending.");
      } else {
        setStep("chain", "failed", "NOT PROVEN");
        setFinal("UNVERIFIED", "Receipt is intact, but anchor evidence is incomplete.", "No confirmed Rialo transaction or account-state proof was returned.", { receipt, sourceFile: file.name, integrity, binding, chain, chainQueried: true });
      }
    } catch (error) {
      console.error(error);
      setStep("json", "failed", "INVALID");
      setStep("hash", "blocked", "BLOCKED");
      setStep("binding", "blocked", "BLOCKED");
      setStep("chain", "blocked", "BLOCKED");
      setFinal("INVALID", "This file is not a valid Rewind receipt.", error.message);
      showToast("INVALID RECEIPT", error.message);
    } finally {
      busy = false;
      loadButton.disabled = false;
      resetButton.disabled = false;
    }
  }

  async function runTamperTest() {
    if (busy || !verifiedReceipt) return;
    busy = true;
    loadButton.disabled = true;
    resetButton.disabled = true;
    tamperButton.disabled = true;
    try {
      const challenge = createTamperedReceiptCopy(verifiedReceipt);
      const receipt = challenge.receipt;
      fileName.textContent = `${verifiedFileName || "verified-receipt.json"} · simulated edit`;
      workflow.textContent = receipt.workflowId;
      execution.textContent = shortVerifierValue(receipt.executionId, 8);
      setStep("json", "complete", "PARSED");
      setStep("hash", "running", "REHASHING");
      integrity = await verifyReceiptIntegrity(receipt);
      suppliedHash.textContent = shortVerifierValue(integrity.suppliedHash, 12);
      computedHash.textContent = shortVerifierValue(integrity.computedHash, 12);
      setStep("hash", "failed", "MISMATCH");
      setStep("binding", "blocked", "BLOCKED");
      setStep("chain", "blocked", "NOT QUERIED");
      commitment.textContent = shortVerifierValue(receipt.onchainAnchor?.commitmentAddress, 12);
      signature.textContent = shortVerifierValue(receipt.onchainAnchor?.signature, 12);
      block.textContent = receipt.onchainAnchor?.blockHeight || "—";
      mode.textContent = "local-tamper-challenge";
      const binding = { ok: false, anchor: receipt.onchainAnchor || null };
      setFinal("TAMPERED", "Altered receipt rejected before any chain query.", `Protected field ${challenge.mutation.field} changed from ${challenge.mutation.before} to ${challenge.mutation.after}. The original receipt hash and Rialo anchor no longer match the payload.`, { receipt, sourceFile: `${verifiedFileName || "verified-receipt.json"} · simulated edit`, integrity, binding, chain: null, chainQueried: false });
      showToast("TAMPER TEST PASSED", "The simulated edit was detected locally and Rialo was not queried.");
    } catch (error) {
      console.error(error);
      setFinal("INVALID", "Tamper challenge could not run.", error.message);
      showToast("TAMPER TEST ERROR", error.message);
    } finally {
      busy = false;
      loadButton.disabled = false;
      resetButton.disabled = false;
    }
  }

  async function copySummary() {
    if (!lastReport) return;
    const summary = formatVerificationSummary(lastReport);
    try {
      await navigator.clipboard.writeText(summary);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = summary;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    showToast("SUMMARY COPIED", `${lastReport.verdict} verification summary copied.`);
  }

  function downloadReport() {
    if (!lastReport) return;
    const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const workflowPart = String(lastReport.workflowId || "receipt").toLowerCase();
    anchor.href = url;
    anchor.download = `rialo-rewind-${workflowPart}-verification.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast("REPORT DOWNLOADED", `${lastReport.verdict} verification report saved.`);
  }

  document.querySelectorAll('[data-action="receipt-verifier"]').forEach((button) => button.addEventListener("click", open));
  closeButtons.forEach((button) => button.addEventListener("click", close));
  loadButton.addEventListener("click", () => fileInput.click());
  resetButton.addEventListener("click", reset);
  tamperButton.addEventListener("click", runTamperTest);
  copyButton.addEventListener("click", copySummary);
  downloadButton.addEventListener("click", downloadReport);
  fileInput.addEventListener("change", () => verifyFile(fileInput.files?.[0]));
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (event) => {
    if (["Enter", " "].includes(event.key)) { event.preventDefault(); fileInput.click(); }
  });
  ["dragenter", "dragover"].forEach((type) => dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragging");
  }));
  ["dragleave", "drop"].forEach((type) => dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
  }));
  dropzone.addEventListener("drop", (event) => verifyFile(event.dataTransfer?.files?.[0]));
  modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-visible")) close();
  });
  reset();
  return Object.freeze({ open, close, reset, verifyFile });
}
