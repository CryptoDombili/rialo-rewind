const DEFAULT_ENDPOINT = "/api/rialo";

export class RialoRpcClient {
  constructor(endpoint = DEFAULT_ENDPOINT) {
    this.endpoint = endpoint;
  }

  async call(method, params = []) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method, params }),
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) {
        const message = payload.error?.message || payload.error || `RPC proxy returned HTTP ${response.status}`;
        throw new Error(message);
      }
      return payload;
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("Rialo devnet probe timed out after 12 seconds.");
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  getBlockHeight() {
    return this.call("getBlockHeight");
  }

  getEpochInfo() {
    return this.call("getEpochInfo");
  }

  getBalance(address) {
    return this.call("getBalance", [address]);
  }

  getSignaturesForAddress(address, limit = 5) {
    return this.call("getSignaturesForAddress", [address, { limit }]);
  }
}

export function unwrapRpcValue(value) {
  if (value && typeof value === "object" && "value" in value) return value.value;
  return value;
}

export function formatBlockHeight(value) {
  const raw = unwrapRpcValue(value);
  if (raw === null || raw === undefined || raw === "") return "—";
  try {
    return BigInt(raw).toLocaleString("en-US");
  } catch {
    return String(raw);
  }
}

export function formatRloBalance(value) {
  const raw = unwrapRpcValue(value);
  if (raw === null || raw === undefined || raw === "") return "—";
  try {
    const kelvin = BigInt(raw);
    const whole = kelvin / 1_000_000_000n;
    const fraction = (kelvin % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
    return `${whole.toString()}${fraction ? `.${fraction.slice(0, 6)}` : ""} RLO`;
  } catch {
    return `${String(raw)} RLO`;
  }
}

export function isLikelyRialoAddress(value) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(value.trim());
}
