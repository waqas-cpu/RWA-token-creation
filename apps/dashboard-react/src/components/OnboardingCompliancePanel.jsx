import React, { useState } from "react";

const cardStyle = {
  background: "#fff",
  border: "1px solid #dbe4ee",
  borderRadius: 10,
  padding: 16
};

const inputStyle = {
  width: "100%",
  padding: 8,
  marginTop: 4,
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  fontFamily: "monospace"
};

const buttonStyle = {
  marginTop: 10,
  padding: "8px 12px",
  border: "none",
  background: "#2563eb",
  color: "#fff",
  borderRadius: 6,
  cursor: "pointer",
  marginRight: 8
};

const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

async function post(path, body) {
  const res = await fetch(`${backendUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export function OnboardingCompliancePanel({ smartAccountAddress }) {
  const [wallet, setWallet] = useState("");
  const [countryCode, setCountryCode] = useState("840");
  const [category, setCategory] = useState("1");
  const [kycScore, setKycScore] = useState("100");
  const [amlFlagged, setAmlFlagged] = useState("false");
  const [checkTo, setCheckTo] = useState("");
  const [checkAmount, setCheckAmount] = useState("1");
  const [output, setOutput] = useState({});
  const [busy, setBusy] = useState(false);

  const runOnboarding = async () => {
    try {
      setBusy(true);
      const targetWallet = wallet.trim() || smartAccountAddress;
      const result = await post("/api/onboarding/investor", {
        wallet: targetWallet,
        countryCode: Number(countryCode),
        category: Number(category),
        kycScore: Number(kycScore),
        amlFlagged: amlFlagged === "true"
      });
      setOutput({ onboarding: result });
    } catch (error) {
      setOutput({ error: error.message });
    } finally {
      setBusy(false);
    }
  };

  const runComplianceCheck = async () => {
    try {
      setBusy(true);
      const result = await post("/api/compliance/check-transfer", {
        from: "0x0000000000000000000000000000000000000000",
        to: checkTo.trim() || smartAccountAddress,
        amount: checkAmount.trim()
      });
      setOutput({ complianceCheck: result });
    } catch (error) {
      setOutput({ error: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={cardStyle}>
      <h2>Onboarding + Compliance</h2>
      <p style={{ marginTop: 0 }}>
        Backend: <code>{backendUrl}</code>
      </p>

      <label>Wallet (optional, defaults to smart account)</label>
      <input style={inputStyle} value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="0x..." />

      <label style={{ display: "block", marginTop: 8 }}>Country Code</label>
      <input style={inputStyle} value={countryCode} onChange={(e) => setCountryCode(e.target.value)} />

      <label style={{ display: "block", marginTop: 8 }}>Category</label>
      <input style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)} />

      <label style={{ display: "block", marginTop: 8 }}>KYC Score</label>
      <input style={inputStyle} value={kycScore} onChange={(e) => setKycScore(e.target.value)} />

      <label style={{ display: "block", marginTop: 8 }}>AML Flagged (true/false)</label>
      <input style={inputStyle} value={amlFlagged} onChange={(e) => setAmlFlagged(e.target.value)} />

      <button style={buttonStyle} onClick={runOnboarding} disabled={busy}>
        Run Onboarding
      </button>

      <hr style={{ margin: "14px 0", border: "none", borderTop: "1px solid #e5e7eb" }} />
      <label>Compliance Check To (optional, defaults to smart account)</label>
      <input style={inputStyle} value={checkTo} onChange={(e) => setCheckTo(e.target.value)} placeholder="0x..." />

      <label style={{ display: "block", marginTop: 8 }}>Amount</label>
      <input style={inputStyle} value={checkAmount} onChange={(e) => setCheckAmount(e.target.value)} />

      <button style={buttonStyle} onClick={runComplianceCheck} disabled={busy}>
        Run Compliance Precheck
      </button>

      <pre style={{ background: "#0f172a", color: "#e2e8f0", borderRadius: 8, padding: 12, maxHeight: 220, overflow: "auto" }}>
        {JSON.stringify(output, null, 2)}
      </pre>
    </section>
  );
}
