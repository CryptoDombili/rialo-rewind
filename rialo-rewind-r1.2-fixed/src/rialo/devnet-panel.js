import {
  RialoRpcClient,
  formatBlockHeight,
  formatRloBalance,
  isLikelyRialoAddress,
  unwrapRpcValue,
} from "./devnet-client.js";


function text(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function setNetworkTone(tone) {
  const state = document.getElementById("networkState");
  if (state) state.dataset.tone = tone;
}

export function initDevnetPanel({ showToast }) {
  const client = new RialoRpcClient();
  const probeButton = document.getElementById("probeDevnet");
  const loadButton = document.getElementById("loadRialoAccount");
  const addressInput = document.getElementById("rialoAddress");
  const explorerLink = document.getElementById("accountExplorerLink");

  let probing = false;

  async function probeNetwork({ quiet = false } = {}) {
    if (probing) return;
    probing = true;
    probeButton?.setAttribute("disabled", "");
    setNetworkTone("probing");
    text("networkLabel", "DEVNET PROBING");
    text("devnetStatus", "CONNECTING");
    text("devnetHeight", "—");
    text("devnetLatency", "—");
    text("devnetError", "");

    try {
      const height = await client.getBlockHeight();
      const formatted = formatBlockHeight(height.result);
      text("networkLabel", `DEVNET · #${formatted}`);
      text("networkBlock", formatted);
      text("devnetStatus", "ONLINE");
      text("devnetHeight", formatted);
      text("devnetLatency", `${height.latencyMs ?? "—"} ms`);
      text("proofNetworkStatus", "LIVE");
      text("devnetError", "");
      text("proofBlockHeight", formatted);
      setNetworkTone("online");
      if (!quiet) showToast("RIALO DEVNET ONLINE", `Live block height ${formatted}.`);
    } catch (error) {
      text("networkLabel", "DEVNET CHECK FAILED");
      text("networkBlock", "—");
      text("devnetStatus", "CHECK FAILED");
      text("devnetHeight", "—");
      text("devnetLatency", "—");
      text("proofNetworkStatus", "CHECK FAILED");
      text("proofBlockHeight", "—");
      text("devnetError", error.message);
      setNetworkTone("offline");
      if (!quiet) showToast("DEVNET CHECK FAILED", error.message);
    } finally {
      probing = false;
      probeButton?.removeAttribute("disabled");
    }
  }

  async function loadAccount() {
    const address = addressInput?.value.trim() || "";
    if (!isLikelyRialoAddress(address)) {
      text("accountStatus", "INVALID ADDRESS");
      showToast("ADDRESS NOT VALID", "Paste a Rialo public address, never a private key.");
      addressInput?.focus();
      return;
    }

    loadButton?.setAttribute("disabled", "");
    text("accountStatus", "LOADING");
    text("accountBalance", "—");
    text("accountHistory", "—");

    try {
      const [balanceResponse, historyResponse] = await Promise.all([
        client.getBalance(address),
        client.getSignaturesForAddress(address, 5).catch(() => ({ result: [] })),
      ]);
      const history = unwrapRpcValue(historyResponse.result);
      const count = Array.isArray(history) ? history.length : 0;
      const balance = formatRloBalance(balanceResponse.result);

      text("accountStatus", "LOADED");
      text("accountBalance", balance);
      text("accountHistory", `${count} recent`);
      text("proofAccountBalance", balance);
      text("proofAccountShort", `${address.slice(0, 6)}…${address.slice(-6)}`);
      showToast("ACCOUNT LOADED", `${balance} confirmed by Rialo devnet.`);
    } catch (error) {
      text("accountStatus", "FAILED");
      text("accountBalance", "—");
      text("accountHistory", "—");
      showToast("ACCOUNT LOOKUP FAILED", error.message);
    } finally {
      loadButton?.removeAttribute("disabled");
    }
  }

  probeButton?.addEventListener("click", () => probeNetwork());
  loadButton?.addEventListener("click", loadAccount);
  addressInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") loadAccount();
  });

  window.setTimeout(() => probeNetwork({ quiet: true }), 450);
  return { probeNetwork, loadAccount };
}
