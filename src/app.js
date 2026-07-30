import { initDevnetPanel } from "./rialo/devnet-panel.js";
import { initSignedProof } from "./rialo/signed-proof.js";
import { serializeReceipt } from "./core/receipt.js";
import { executeServerWorkflow } from "./core/workflow-client.js";
import { createReceiptAnchor, verifyReceiptAnchor } from "./rialo/receipt-anchor.js";
import { shortAnchorValue } from "./core/anchor-model.js";
import { initReceiptVerifier } from "./receipt-verifier.js";

(() => {
      "use strict";

      const $ = (selector, root = document) => root.querySelector(selector);
      const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
      const app = $("#app");
      const engineState = $("#engineState");
      const modeState = $("#modeState");
      const forwardCaption = $("#forwardCaption");
      const reverseCaption = $("#reverseCaption");
      const forwardFill = $("#forwardFill");
      const reverseFill = $("#reverseFill");
      const forwardPacket = $("#forwardPacket");
      const reversePacket = $("#reversePacket");
      const eventLog = $("#eventLog");
      const faultAttempt = $("#faultAttempt");
      const phaseFlash = $("#phaseFlash");
      const resultBanner = $("#resultBanner");
      const proofLabModal = $("#proofLabModal");
      const toast = $("#toast");
      const receiptButton = $('[data-action="receipt"]');
      const anchorButton = $('[data-action="anchor"]');

      const inspector = {
        code: $("#inspectorCode"), kicker: $("#inspectorKicker"), title: $("#inspectorTitle"),
        description: $("#inspectorDescription"), status: $("#inspectorStatus"), executor: $("#inspectorExecutor"),
        timeout: $("#inspectorTimeout"), retries: $("#inspectorRetries"), trace: $("#inspectorTrace"), policy: $("#policyCode")
      };
      const receipt = {
        badge: $("#receiptBadge"), result: $("#receiptResult"), failed: $("#receiptFailed"),
        retries: $("#receiptRetries"), refund: $("#receiptRefund"), engine: $("#receiptEngine"), hash: $("#receiptHash"),
        anchorStatus: $("#receiptAnchorStatus"), commitment: $("#receiptCommitment"), anchorSignature: $("#receiptAnchorSignature")
      };

      const data = {
        reserve: { code: "01 / 05", kicker: "INVENTORY", title: "Reserve inventory", description: "Hold SKU-RL/01 while the remaining workflow completes.", executor: "inventory.reserve", timeout: "90 sec", retries: "0 / 0", trace: "—", policy: "ON downstream.failure\n→ releaseInventory(SKU-RL/01)\n→ preserve idempotency key" },
        escrow: { code: "02 / 05", kicker: "PAYMENT", title: "Lock escrow", description: "Protect 50.00 RLO until the physical workflow reaches settlement.", executor: "escrow.lock", timeout: "180 sec", retries: "0 / 1", trace: "—", policy: "ON workflow.compensate\n→ refundEscrow(customer)\n→ require exact amount match" },
        merchant: { code: "03 / 05", kicker: "MERCHANT", title: "Create order", description: "Create an idempotent merchant order that can be safely cancelled.", executor: "merchant.createOrder", timeout: "45 sec", retries: "0 / 2", trace: "—", policy: "ON downstream.failure\n→ cancelOrder(ORD-0247)\n→ reject duplicate cancellation" },
        courier: { code: "04 / 05", kicker: "EXTERNAL SERVICE", title: "Create shipment", description: "Request a verified courier label. This is the controlled failure boundary.", executor: "courier.createLabel", timeout: "30 sec", retries: "0 / 3", trace: "—", policy: "ON HTTP 503 × 3\n→ stop forward execution\n→ begin reverse compensation" },
        settle: { code: "05 / 05", kicker: "SETTLEMENT", title: "Settle payment", description: "Release protected funds only after the real-world workflow completes.", executor: "escrow.settle", timeout: "60 sec", retries: "0 / 1", trace: "—", policy: "REQUIRES shipment.confirmed\n→ release 50.00 RLO\n→ close workflow receipt" },
        release: { code: "C3 / 03", kicker: "COMPENSATION", title: "Release inventory", description: "Return the reserved item to available stock after failure.", executor: "inventory.release", timeout: "30 sec", retries: "0 / 3", trace: "—", policy: "COMPENSATES reserveInventory\n→ release SKU-RL/01\n→ mark reversal complete" },
        cancel: { code: "C2 / 03", kicker: "COMPENSATION", title: "Cancel order", description: "Reverse the merchant-side order after the protected refund is issued.", executor: "merchant.cancelOrder", timeout: "45 sec", retries: "0 / 3", trace: "—", policy: "COMPENSATES createOrder\n→ cancel ORD-0247\n→ preserve audit trail" },
        refund: { code: "C1 / 03", kicker: "COMPENSATION", title: "Refund customer", description: "Return the complete protected balance before reversing external reservations.", executor: "escrow.refund", timeout: "60 sec", retries: "0 / 3", trace: "—", policy: "COMPENSATES lockEscrow\n→ return 50.00 RLO\n→ prevent duplicate refund" }
      };

      const forwardOrder = ["reserve", "escrow", "merchant", "courier", "settle"];
      const forwardPositions = [7, 29, 51, 73, 100];
      const reverseOrder = ["refund", "cancel", "release"];
      const reversePositions = [17, 50, 83];
      let runToken = 0;
      let startedAt = performance.now();
      let selectedNode = "reserve";
      let lastReceipt = null;
      let lastAnchor = null;
      let toastTimer = null;
      let receiptVerifierController = null;

      const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
      const getNode = (name) => $(`[data-node="${name}"]`);
      const getStatus = (name) => $(".node-status", getNode(name));

      function showToast(title, text) {
        $("#toastTitle").textContent = title;
        $("#toastText").textContent = text;
        toast.classList.add("is-visible");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2800);
      }

      function elapsed() {
        const ms = performance.now() - startedAt;
        const sec = Math.floor(ms / 1000);
        const milli = Math.floor(ms % 1000).toString().padStart(3, "0");
        return `00:${sec.toString().padStart(2, "0")}.${milli}`;
      }

      function log(source, message, tone = "") {
        const row = document.createElement("div");
        row.className = `log-row${tone ? ` log-${tone}` : ""}`;
        row.innerHTML = `<time>${elapsed()}</time><span>${source}</span><p>${message}</p>`;
        eventLog.appendChild(row);
        eventLog.scrollTop = eventLog.scrollHeight;
      }

      function clearDynamicLogs() { $$(".log-row", eventLog).slice(3).forEach((row) => row.remove()); }

      function setNode(name, state, label) {
        const el = getNode(name);
        el.classList.remove("is-running", "is-complete", "is-failed", "is-blocked");
        if (state) el.classList.add(state);
        getStatus(name).textContent = label;
        if (selectedNode === name) updateInspector(name);
      }

      function selectNode(name) {
        $$(".workflow-node").forEach((el) => el.classList.toggle("is-selected", el.dataset.node === name));
        selectedNode = name;
        updateInspector(name);
        setView("flow", false);
      }

      function updateInspector(name) {
        const d = data[name];
        const el = getNode(name);
        const state = getStatus(name).textContent;
        inspector.code.textContent = d.code;
        inspector.kicker.textContent = d.kicker;
        inspector.title.textContent = d.title;
        inspector.description.textContent = d.description;
        inspector.executor.textContent = d.executor;
        inspector.timeout.textContent = d.timeout;
        inspector.retries.textContent = d.retries;
        inspector.trace.textContent = d.trace;
        inspector.policy.textContent = d.policy;
        inspector.status.className = "inspector-status";
        if (el.classList.contains("is-running")) inspector.status.classList.add("is-running");
        if (el.classList.contains("is-complete")) inspector.status.classList.add("is-complete");
        if (el.classList.contains("is-failed")) inspector.status.classList.add("is-failed");
        $("strong", inspector.status).textContent = state;
      }

      function setView(view, notify = true) {
        $$('[data-view]').forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
        $$('[data-panel]').forEach((panel) => panel.classList.toggle("is-visible", panel.dataset.panel === view));
        if (notify) {
          const labels = { flow: "Node inspector opened.", proof: "Workflow proof opened.", rules: "Recovery rules opened.", verify: "Public receipt verifier opened." };
          showToast(view.toUpperCase(), labels[view]);
        }
      }

      function lockControls(locked) { $$('[data-action="clean"], [data-action="failure"]').forEach((button) => { button.disabled = locked; }); }

      function resetReceipt() {
        lastReceipt = null;
        lastAnchor = null;
        receipt.badge.textContent = "UNISSUED";
        receipt.result.textContent = "NO RESULT";
        receipt.result.style.color = "";
        receipt.failed.textContent = "—";
        receipt.retries.textContent = "0";
        receipt.refund.textContent = "0.00 RLO";
        receipt.engine.textContent = "—";
        receipt.hash.textContent = "—";
        receipt.anchorStatus.textContent = "NOT ANCHORED";
        receipt.anchorStatus.style.color = "";
        receipt.commitment.textContent = "—";
        receipt.anchorSignature.textContent = "—";
        anchorButton.disabled = true;
        anchorButton.dataset.mode = "anchor";
        anchorButton.firstChild.textContent = "ANCHOR RECEIPT ";
        receiptButton.disabled = true;
        $("#proofStatus").textContent = "WAITING";
        $("#proofTitle").textContent = "No receipt issued";
        $("#proofText").textContent = "Run a clean flow or inject a failure. The console will produce a portable execution receipt.";
        $("#proofManual").textContent = "—";
        $("#proofEngine").textContent = "—";
        $("#proofReceiptHash").textContent = "—";
        $("#proofAnchorStatus").textContent = "NOT ANCHORED";
        $("#proofCommitment").textContent = "—";
      }

      function issueReceipt(serverReceipt) {
        const result = serverReceipt.result;
        receipt.badge.textContent = "ISSUED";
        receipt.result.textContent = result;
        receipt.result.style.color = result === "COMPENSATED" ? "var(--acid)" : "var(--cyan)";
        receipt.failed.textContent = serverReceipt.failedStep;
        receipt.retries.textContent = String(serverReceipt.retries);
        receipt.refund.textContent = serverReceipt.refund;
        receipt.engine.textContent = "SERVER R1.4.4";
        receipt.hash.textContent = `${serverReceipt.receiptHash.slice(0, 12)}…`;
        lastReceipt = serverReceipt;
        anchorButton.disabled = false;
        receiptButton.disabled = false;
        $("#proofStatus").textContent = "ISSUED";
        $("#proofTitle").textContent = result === "COMPENSATED" ? "Recovery receipt ready" : "Settlement receipt ready";
        $("#proofText").textContent = result === "COMPENSATED" ? "The server state machine retried the courier boundary and executed three idempotent compensations." : "The server state machine completed all five forward actions and discarded the compensation stack.";
        $("#proofManual").textContent = serverReceipt.manualIntervention;
        $("#proofEngine").textContent = "SERVER R1.4.4";
        $("#proofReceiptHash").textContent = `${serverReceipt.receiptHash.slice(0, 12)}…`;
      }

      function resetUI({ keepLogs = false, notify = false } = {}) {
        runToken += 1;
        startedAt = performance.now();
        app.dataset.flow = "idle";
        engineState.textContent = "ARMED";
        modeState.textContent = "STANDBY";
        forwardCaption.textContent = "WAITING FOR OPERATOR";
        reverseCaption.textContent = "COMPENSATION STACK ARMED";
        forwardFill.style.width = "0%";
        reverseFill.style.width = "0%";
        forwardPacket.classList.remove("is-live");
        reversePacket.classList.remove("is-live");
        forwardPacket.style.left = "0%";
        reversePacket.style.right = "0%";
        faultAttempt.textContent = "";
        phaseFlash.classList.remove("is-visible");
        resultBanner.classList.remove("is-visible");
        forwardOrder.forEach((name) => setNode(name, "", "PENDING"));
        ["release", "cancel", "refund"].forEach((name) => setNode(name, "", "ARMED"));
        Object.keys(data).forEach((name) => { data[name].trace = "—"; });
        data.courier.retries = "0 / 3";
        resetReceipt();
        lockControls(false);
        if (!keepLogs) clearDynamicLogs();
        selectedNode = "reserve";
        $$(".workflow-node").forEach((el) => el.classList.toggle("is-selected", el.dataset.node === "reserve"));
        updateInspector("reserve");
        setView("flow", false);
        if (notify) showToast("RESET COMPLETE", "Console returned to standby.");
      }

      async function runForward(token, name, index, source, start, done, delay = 690) {
        if (token !== runToken) throw new Error("cancelled");
        selectNode(name);
        setNode(name, "is-running", "RUNNING");
        forwardPacket.classList.add("is-live");
        forwardPacket.style.left = `${forwardPositions[index]}%`;
        log(source, start);
        await sleep(delay);
        if (token !== runToken) throw new Error("cancelled");
        setNode(name, "is-complete", "COMPLETE");
        forwardFill.style.width = `${forwardPositions[index]}%`;
        data[name].trace = `trace_${String(index + 1).padStart(2, "0")}_rw0247`;
        updateInspector(name);
        log(source, done, "success");
      }

      async function runCompensation(token, name, index, source, start, done, delay = 760) {
        if (token !== runToken) throw new Error("cancelled");
        selectNode(name);
        setNode(name, "is-running", "REVERSING");
        reversePacket.classList.add("is-live");
        reversePacket.style.right = `${reversePositions[index]}%`;
        log(source, start);
        await sleep(delay);
        if (token !== runToken) throw new Error("cancelled");
        setNode(name, "is-complete", "COMPLETE");
        reverseFill.style.width = `${reversePositions[index]}%`;
        data[name].trace = `comp_${String(index + 1).padStart(2, "0")}_rw0247`;
        updateInspector(name);
        log(source, done, "success");
      }

      function serverEventLabel(event) {
        const labels = {
          reserve: ["INVENTORY", "Inventory reservation"],
          escrow: ["ESCROW", "Protected escrow lock"],
          merchant: ["MERCHANT", "Merchant order"],
          courier: ["COURIER", "Courier shipment"],
          settle: ["SETTLEMENT", "Merchant settlement"],
          refund: ["ESCROW", "Customer refund"],
          cancel: ["MERCHANT", "Order cancellation"],
          release: ["INVENTORY", "Inventory release"],
        };
        return labels[event.name] || [event.source || "ENGINE", event.name || "Workflow action"];
      }

      async function replayServerExecution(payload, token) {
        const events = payload.execution.events;
        let previousOffset = 0;
        for (const event of events) {
          if (token !== runToken) throw new Error("cancelled");
          const delta = Math.max(0, Number(event.offsetMs || 0) - previousOffset);
          previousOffset = Number(event.offsetMs || previousOffset);
          if (delta > 0) await sleep(Math.max(120, Math.min(360, delta * 2)));

          const [source, label] = serverEventLabel(event);
          if (event.type === "workflow.started") {
            log("SERVER", `Execution ${event.executionId.slice(0, 8)} accepted by the R1.4.4 state machine.`);
          } else if (event.type === "action.started") {
            selectNode(event.name);
            setNode(event.name, "is-running", event.attempt ? `TRY ${event.attempt}/3` : (event.compensation ? "REVERSING" : "RUNNING"));
            data[event.name].trace = event.traceId || "—";
            if (event.name === "courier" && event.attempt) {
              data.courier.retries = `${event.attempt - 1} / 3`;
              faultAttempt.textContent = `ATTEMPT ${event.attempt} / 3`;
            }
            if (event.compensation) {
              reversePacket.classList.add("is-live");
              const index = reverseOrder.indexOf(event.name);
              reversePacket.style.right = `${reversePositions[index]}%`;
            } else {
              forwardPacket.classList.add("is-live");
              const index = forwardOrder.indexOf(event.name);
              forwardPacket.style.left = `${forwardPositions[index]}%`;
            }
            updateInspector(event.name);
            log(source, `${label} started on the server.`);
          } else if (event.type === "action.completed") {
            setNode(event.name, "is-complete", "COMPLETE");
            data[event.name].trace = event.traceId || data[event.name].trace;
            if (event.compensation) {
              const index = reverseOrder.indexOf(event.name);
              reverseFill.style.width = `${reversePositions[index]}%`;
            } else {
              const index = forwardOrder.indexOf(event.name);
              forwardFill.style.width = `${forwardPositions[index]}%`;
            }
            updateInspector(event.name);
            log(source, `${label} committed by the server engine.`, "success");
          } else if (event.type === "action.failed") {
            selectNode(event.name);
            setNode(event.name, "is-failed", event.attempt === event.maxAttempts ? "FAILED" : `RETRY ${event.attempt}/3`);
            data.courier.retries = `${event.attempt} / 3`;
            data.courier.trace = event.traceId;
            updateInspector(event.name);
            log(source, `${event.error.code} — server attempt ${event.attempt}/${event.maxAttempts} failed.`, "error");
          } else if (event.type === "retry.scheduled") {
            log("ENGINE", `Retry ${event.attempt}/3 scheduled by policy.`);
          } else if (event.type === "workflow.halted") {
            forwardPacket.classList.remove("is-live");
            app.dataset.flow = "failed";
            forwardFill.style.width = "73%";
            setNode("settle", "is-blocked", "BLOCKED");
            engineState.textContent = "FAULT";
            modeState.textContent = "HALTED";
            forwardCaption.textContent = "SERVER HALTED FORWARD PATH";
            reverseCaption.textContent = "OPENING COMPENSATION STACK";
            phaseFlash.classList.add("is-visible");
            log("ENGINE", event.reason, "error");
            await sleep(720);
            phaseFlash.classList.remove("is-visible");
          } else if (event.type === "compensation.started") {
            app.dataset.flow = "compensating";
            engineState.textContent = "RECOVERING";
            modeState.textContent = "REWIND";
            reverseCaption.textContent = "SERVER COMPENSATION LIVE";
            log("ENGINE", `Server compensation plan: ${event.plan.join(" → ")}.`, "error");
          } else if (event.type === "workflow.completed") {
            forwardPacket.classList.remove("is-live");
            reversePacket.classList.remove("is-live");
            const compensated = event.result === "COMPENSATED";
            app.dataset.flow = compensated ? "recovered" : "complete";
            engineState.textContent = compensated ? "SAFE" : "COMPLETE";
            modeState.textContent = compensated ? "RECOVERED" : "SETTLED";
            forwardCaption.textContent = compensated ? "FORWARD PATH COMPENSATED" : "SERVER WORKFLOW SETTLED";
            reverseCaption.textContent = compensated ? "BUSINESS STATE RESTORED" : "COMPENSATION DISCARDED";
            log("SERVER", compensated ? "Recovery state committed. No manual intervention required." : "Settlement state committed. Compensation stack discarded.", "success");
          }
        }
      }

      async function runServerFlow(mode) {
        resetUI();
        const token = ++runToken;
        lockControls(true);
        app.dataset.flow = "running";
        engineState.textContent = "SERVER";
        modeState.textContent = mode === "failure" ? "FAULT TEST" : "CLEAN RUN";
        forwardCaption.textContent = "WAITING FOR SERVER EXECUTION";
        log("CLIENT", `Submitting ${mode} workflow to /api/workflow.`);
        try {
          const payload = await executeServerWorkflow(mode);
          if (token !== runToken) return;
          startedAt = performance.now();
          log("SERVER", `Execution receipt returned in ${payload.execution.durationMs} ms. Replaying verified events.`);
          await replayServerExecution(payload, token);
          if (token !== runToken) return;
          issueReceipt(payload.receipt);
          const compensated = payload.execution.result === "COMPENSATED";
          $("#resultTitle").textContent = compensated ? "RECOVERED" : "SETTLED";
          $("#resultText").textContent = compensated ? "Server state restored through three idempotent compensations." : "Server state completed all five forward actions.";
          $("#resultRefund").textContent = payload.receipt.refund;
          $("#resultRetries").textContent = String(payload.receipt.retries);
          $("#resultActions").textContent = compensated ? "3" : "0";
          resultBanner.classList.add("is-visible");
          if (compensated) selectNode("release");
          showToast(compensated ? "SERVER RECOVERY COMPLETE" : "SERVER FLOW SETTLED", `${payload.receipt.receiptHash.slice(0, 12)}… receipt issued.`);
        } catch (error) {
          if (error.message !== "cancelled") {
            console.error(error);
            app.dataset.flow = "idle";
            engineState.textContent = "ERROR";
            modeState.textContent = "RETRY";
            forwardCaption.textContent = "SERVER EXECUTION FAILED";
            log("SERVER", error.message, "error");
            showToast("WORKFLOW ERROR", error.message);
          }
        } finally {
          if (token === runToken) lockControls(false);
        }
      }

      async function cleanFlow() { return runServerFlow("clean"); }
      async function failureFlow() { return runServerFlow("failure"); }


      function updateAnchorUI(anchor) {
        lastAnchor = anchor;
        const confirmed = ["confirmed", "state-confirmed"].includes(anchor.status);
        const label = anchor.status === "confirmed" ? "ANCHORED" : anchor.status === "state-confirmed" ? "STATE VERIFIED" : "SUBMITTED";
        receipt.anchorStatus.textContent = label;
        receipt.anchorStatus.style.color = confirmed ? "var(--acid)" : "var(--amber)";
        receipt.commitment.textContent = shortAnchorValue(anchor.commitmentAddress, 8);
        receipt.anchorSignature.textContent = shortAnchorValue(anchor.signature, 8);
        $("#proofAnchorStatus").textContent = label;
        $("#proofCommitment").textContent = shortAnchorValue(anchor.commitmentAddress, 8);
        anchorButton.dataset.mode = confirmed ? "verify" : "verify";
        anchorButton.firstChild.textContent = confirmed ? "VERIFY ANCHOR " : "VERIFY ANCHOR ";
        anchorButton.disabled = false;
        lastReceipt = { ...lastReceipt, onchainAnchor: anchor };
      }

      async function anchorReceipt() {
        if (!lastReceipt) { showToast("NO RECEIPT", "Run a workflow before anchoring."); return; }
        anchorButton.disabled = true;
        receipt.anchorStatus.textContent = lastAnchor ? "VERIFYING" : "ANCHORING";
        receipt.anchorStatus.style.color = "var(--amber)";
        log("RIALO", lastAnchor ? "Verifying receipt commitment on Rialo devnet." : "Creating receipt-hash commitment on Rialo devnet.");
        try {
          const anchor = lastAnchor ? await verifyReceiptAnchor(lastAnchor) : await createReceiptAnchor(lastReceipt.receiptHash);
          updateAnchorUI(anchor);
          const label = anchor.status === "confirmed" ? "RIALO ANCHOR CONFIRMED" : anchor.status === "state-confirmed" ? "RIALO ANCHOR STATE VERIFIED" : "RIALO ANCHOR SUBMITTED";
          log("RIALO", `${label}. Commitment ${shortAnchorValue(anchor.commitmentAddress, 8)}.`, anchor.status === "submitted" ? "" : "success");
          showToast(label, `${shortAnchorValue(anchor.signature, 8)} binds the receipt hash to Rialo devnet.`);
        } catch (error) {
          console.error(error);
          receipt.anchorStatus.textContent = "ANCHOR ERROR";
          receipt.anchorStatus.style.color = "var(--red-2)";
          log("RIALO", error.message, "error");
          showToast("ANCHOR ERROR", error.message);
          anchorButton.disabled = false;
        }
      }

      function exportReceipt() {
        if (!lastReceipt) { showToast("NO RECEIPT", "Run a workflow before exporting."); return; }
        const blob = new Blob([serializeReceipt(lastReceipt)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "rialo-rewind-rw-0247-receipt.json";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 250);
        showToast("RECEIPT EXPORTED", "JSON proof saved to your downloads.");
      }

      function openProofLab() {
        proofLabModal.classList.add("is-visible");
        proofLabModal.setAttribute("aria-hidden", "false");
        $(".modal-close", proofLabModal).focus();
      }
      function closeProofLab() {
        proofLabModal.classList.remove("is-visible");
        proofLabModal.setAttribute("aria-hidden", "true");
      }

      document.addEventListener("click", (event) => {
        const nodeButton = event.target.closest("[data-node]");
        if (nodeButton) { selectNode(nodeButton.dataset.node); return; }

        const viewButton = event.target.closest("[data-view]");
        if (viewButton) { setView(viewButton.dataset.view); return; }

        const actionButton = event.target.closest("[data-action]");
        if (!actionButton) return;
        event.preventDefault();
        const action = actionButton.dataset.action;
        if (action === "clean") cleanFlow();
        else if (action === "failure") failureFlow();
        else if (action === "reset") resetUI({ notify: true });
        else if (action === "receipt") exportReceipt();
        else if (action === "anchor") anchorReceipt();
        else if (action === "receipt-verifier") {
          if (receiptVerifierController?.open) receiptVerifierController.open();
          else {
            const verifierModal = $("#receiptVerifierModal");
            verifierModal?.classList.add("is-visible");
            verifierModal?.setAttribute("aria-hidden", "false");
            $("#verifierLoadButton")?.focus();
          }
        }
        else if (action === "proof-lab") openProofLab();
        else if (action === "close-modal") closeProofLab();
        else if (action === "home") { resetUI({ notify: true }); }
      });

      proofLabModal.addEventListener("click", (event) => { if (event.target === proofLabModal) closeProofLab(); });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeProofLab();
        if (event.target.matches("input, textarea, select")) return;
        if (event.key === "1") cleanFlow();
        if (event.key === "2") failureFlow();
        if (event.key.toLowerCase() === "r") resetUI({ notify: true });
      });

      try {
        receiptVerifierController = initReceiptVerifier({ showToast });
      } catch (error) {
        console.error("Receipt verifier initialization failed:", error);
      }
      try {
        resetUI({ keepLogs: true });
      } catch (error) {
        console.error("Console reset initialization failed:", error);
      }
      try {
        initDevnetPanel({ showToast });
      } catch (error) {
        console.error("Devnet panel initialization failed:", error);
      }
      try {
        initSignedProof({ showToast });
      } catch (error) {
        console.error("Signed proof initialization failed:", error);
      }
      setTimeout(() => showToast("CONSOLE READY", "Recovery engine ready. Rialo devnet health check started."), 350);
    })();
