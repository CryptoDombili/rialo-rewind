import { initDevnetPanel } from "./rialo/devnet-panel.js";
import { createWorkflowReceipt, serializeReceipt } from "./core/receipt.js";

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
      const walletModal = $("#walletModal");
      const toast = $("#toast");
      const receiptButton = $('[data-action="receipt"]');

      const inspector = {
        code: $("#inspectorCode"), kicker: $("#inspectorKicker"), title: $("#inspectorTitle"),
        description: $("#inspectorDescription"), status: $("#inspectorStatus"), executor: $("#inspectorExecutor"),
        timeout: $("#inspectorTimeout"), retries: $("#inspectorRetries"), trace: $("#inspectorTrace"), policy: $("#policyCode")
      };
      const receipt = {
        badge: $("#receiptBadge"), result: $("#receiptResult"), failed: $("#receiptFailed"),
        retries: $("#receiptRetries"), refund: $("#receiptRefund")
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
      let toastTimer = null;

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
          const labels = { flow: "Node inspector opened.", proof: "Workflow proof opened.", rules: "Recovery rules opened." };
          showToast(view.toUpperCase(), labels[view]);
        }
      }

      function lockControls(locked) { $$('[data-action="clean"], [data-action="failure"]').forEach((button) => { button.disabled = locked; }); }

      function resetReceipt() {
        lastReceipt = null;
        receipt.badge.textContent = "UNISSUED";
        receipt.result.textContent = "NO RESULT";
        receipt.result.style.color = "";
        receipt.failed.textContent = "—";
        receipt.retries.textContent = "0";
        receipt.refund.textContent = "0.00 RLO";
        receiptButton.disabled = true;
        $("#proofStatus").textContent = "WAITING";
        $("#proofTitle").textContent = "No receipt issued";
        $("#proofText").textContent = "Run a clean flow or inject a failure. The console will produce a portable execution receipt.";
        $("#proofManual").textContent = "—";
      }

      function issueReceipt(result, failed, retries, refund) {
        receipt.badge.textContent = "ISSUED";
        receipt.result.textContent = result;
        receipt.result.style.color = result === "COMPENSATED" ? "var(--acid)" : "var(--cyan)";
        receipt.failed.textContent = failed;
        receipt.retries.textContent = retries;
        receipt.refund.textContent = refund;
        lastReceipt = { workflowId: "RW-0247", result, failedStep: failed, retries: Number(retries), refund, manualIntervention: "NOT REQUIRED" };
        receiptButton.disabled = false;
        $("#proofStatus").textContent = "ISSUED";
        $("#proofTitle").textContent = result === "COMPENSATED" ? "Recovery receipt ready" : "Settlement receipt ready";
        $("#proofText").textContent = result === "COMPENSATED" ? "Three compensating actions restored the business state and returned the protected balance." : "All five forward steps completed and the compensation stack was discarded.";
        $("#proofManual").textContent = "NOT REQUIRED";
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

      async function cleanFlow() {
        resetUI();
        const token = ++runToken;
        lockControls(true);
        app.dataset.flow = "running";
        engineState.textContent = "EXECUTING";
        modeState.textContent = "FORWARD";
        forwardCaption.textContent = "LIVE EXECUTION";
        log("WORKFLOW", "RW-0247 forward execution started.");
        try {
          await runForward(token, "reserve", 0, "INVENTORY", "Requesting reservation for SKU-RL/01.", "Inventory reservation confirmed.");
          await runForward(token, "escrow", 1, "ESCROW", "Locking 50.00 RLO in protected escrow.", "Escrow lock confirmed.");
          await runForward(token, "merchant", 2, "MERCHANT", "Creating idempotent merchant order.", "Order ORD-0247 created.");
          await runForward(token, "courier", 3, "COURIER", "Requesting verified courier label.", "Shipment SHP-0247 created.", 820);
          await runForward(token, "settle", 4, "SETTLEMENT", "Releasing escrow to merchant.", "50.00 RLO settlement confirmed.", 780);
          if (token !== runToken) return;
          forwardPacket.classList.remove("is-live");
          app.dataset.flow = "complete";
          engineState.textContent = "COMPLETE";
          modeState.textContent = "SETTLED";
          forwardCaption.textContent = "WORKFLOW SETTLED";
          reverseCaption.textContent = "COMPENSATION DISCARDED";
          log("WORKFLOW", "Execution completed. Recovery stack safely discarded.", "success");
          issueReceipt("SETTLED", "NONE", "0", "0.00 RLO");
          $("#resultTitle").textContent = "SETTLED";
          $("#resultText").textContent = "All five forward actions completed. No recovery action was required.";
          $("#resultRefund").textContent = "0.00 RLO";
          $("#resultRetries").textContent = "0";
          $("#resultActions").textContent = "0";
          resultBanner.classList.add("is-visible");
          showToast("FLOW SETTLED", "All five steps completed successfully.");
        } catch (error) {
          if (error.message !== "cancelled") console.error(error);
        } finally {
          if (token === runToken) lockControls(false);
        }
      }

      async function failureFlow() {
        resetUI();
        const token = ++runToken;
        lockControls(true);
        app.dataset.flow = "running";
        engineState.textContent = "EXECUTING";
        modeState.textContent = "FORWARD";
        forwardCaption.textContent = "FAILURE INJECTION ARMED";
        log("WORKFLOW", "RW-0247 started with controlled failure injection.");
        try {
          await runForward(token, "reserve", 0, "INVENTORY", "Requesting reservation for SKU-RL/01.", "Inventory reservation confirmed.");
          await runForward(token, "escrow", 1, "ESCROW", "Locking 50.00 RLO in protected escrow.", "Escrow lock confirmed.");
          await runForward(token, "merchant", 2, "MERCHANT", "Creating idempotent merchant order.", "Order ORD-0247 created.");

          selectNode("courier");
          forwardPacket.classList.add("is-live");
          forwardPacket.style.left = "73%";
          for (let attempt = 1; attempt <= 3; attempt += 1) {
            if (token !== runToken) return;
            setNode("courier", "is-running", `TRY ${attempt}/3`);
            data.courier.retries = `${attempt - 1} / 3`;
            faultAttempt.textContent = `ATTEMPT ${attempt} / 3`;
            updateInspector("courier");
            log("COURIER", `Shipment request attempt ${attempt}/3.`);
            await sleep(720);
            if (token !== runToken) return;
            setNode("courier", "is-failed", attempt === 3 ? "FAILED" : `RETRY ${attempt}/3`);
            data.courier.retries = `${attempt} / 3`;
            data.courier.trace = `http_503_attempt_${attempt}`;
            updateInspector("courier");
            log("COURIER", `HTTP 503 — attempt ${attempt}/3 failed.`, "error");
            if (attempt < 3) await sleep(560);
          }

          forwardPacket.classList.remove("is-live");
          app.dataset.flow = "failed";
          forwardFill.style.width = "73%";
          setNode("settle", "is-blocked", "BLOCKED");
          engineState.textContent = "FAULT";
          modeState.textContent = "HALTED";
          forwardCaption.textContent = "FORWARD PATH INTERRUPTED";
          reverseCaption.textContent = "OPENING COMPENSATION STACK";
          log("ENGINE", "Retry ceiling reached. Forward settlement blocked.", "error");
          phaseFlash.classList.add("is-visible");
          await sleep(1150);
          phaseFlash.classList.remove("is-visible");

          app.dataset.flow = "compensating";
          engineState.textContent = "RECOVERING";
          modeState.textContent = "REWIND";
          reverseCaption.textContent = "REVERSE EXECUTION LIVE";
          log("ENGINE", "Compensation sequence started in reverse order.", "error");

          await runCompensation(token, "refund", 0, "ESCROW", "Submitting protected refund.", "50.00 RLO returned to customer.", 880);
          await runCompensation(token, "cancel", 1, "MERCHANT", "Cancelling order ORD-0247.", "Merchant order cancelled.");
          await runCompensation(token, "release", 2, "INVENTORY", "Releasing SKU-RL/01 reservation.", "Inventory returned to available stock.");

          if (token !== runToken) return;
          reversePacket.classList.remove("is-live");
          app.dataset.flow = "recovered";
          engineState.textContent = "SAFE";
          modeState.textContent = "RECOVERED";
          reverseCaption.textContent = "BUSINESS STATE RESTORED";
          log("WORKFLOW", "Recovery complete. No manual intervention required.", "success");
          issueReceipt("COMPENSATED", "CREATE SHIPMENT", "3", "50.00 RLO");
          $("#resultTitle").textContent = "RECOVERED";
          $("#resultText").textContent = "Business state restored without manual intervention.";
          $("#resultRefund").textContent = "50.00 RLO";
          $("#resultRetries").textContent = "3";
          $("#resultActions").textContent = "3";
          resultBanner.classList.add("is-visible");
          selectNode("release");
          showToast("RECOVERY COMPLETE", "50.00 RLO returned and external state reversed.");
        } catch (error) {
          if (error.message !== "cancelled") console.error(error);
        } finally {
          if (token === runToken) lockControls(false);
        }
      }

      function exportReceipt() {
        if (!lastReceipt) { showToast("NO RECEIPT", "Run a workflow before exporting."); return; }
        const payload = createWorkflowReceipt({
          result: lastReceipt.result,
          failedStep: lastReceipt.failedStep,
          retries: lastReceipt.retries,
          refund: lastReceipt.refund,
          traces: Object.values(data).map((item) => item.trace).filter((trace) => trace && trace !== "—"),
        });
        const blob = new Blob([serializeReceipt(payload)], { type: "application/json" });
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

      function openWalletModal() {
        walletModal.classList.add("is-visible");
        walletModal.setAttribute("aria-hidden", "false");
        $(".modal-close", walletModal).focus();
      }
      function closeWalletModal() {
        walletModal.classList.remove("is-visible");
        walletModal.setAttribute("aria-hidden", "true");
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
        else if (action === "wallet") openWalletModal();
        else if (action === "close-modal") closeWalletModal();
        else if (action === "home") { resetUI({ notify: true }); }
      });

      walletModal.addEventListener("click", (event) => { if (event.target === walletModal) closeWalletModal(); });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeWalletModal();
        if (event.target.matches("input, textarea, select")) return;
        if (event.key === "1") cleanFlow();
        if (event.key === "2") failureFlow();
        if (event.key.toLowerCase() === "r") resetUI({ notify: true });
      });

      resetUI({ keepLogs: true });
      initDevnetPanel({ showToast });
      setTimeout(() => showToast("CONSOLE READY", "Local recovery engine ready. Live Rialo devnet probe started."), 350);
    })();
