import React, { useEffect, useMemo, useRef, useState } from "react";
import { encodeFunctionData, parseAbi } from "viem";
import { ethers } from "ethers";

const GUARD_DEBOUNCE_MS = 500;

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
  cursor: "pointer"
};

export function BiconomyAAMintPanel({ smartAccountClient, smartAccountAddress }) {
  const [tokenAddress, setTokenAddress] = useState(import.meta.env.VITE_ERC3643_TOKEN_ADDRESS || "");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState(import.meta.env.VITE_DEFAULT_MINT_AMOUNT || "1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingGuard, setIsCheckingGuard] = useState(false);
  const [guardState, setGuardState] = useState({
    checked: false,
    issuerAllowed: false,
    complianceAllowed: false,
    complianceReasonCode: null,
    error: null
  });
  const [result, setResult] = useState({
    userOpHash: null,
    txHash: null,
    userOpStatus: null,
    error: null
  });

  const resolvedRecipient = useMemo(() => {
    if (recipient.trim()) return recipient.trim();
    return smartAccountAddress || "";
  }, [recipient, smartAccountAddress]);

  const envOk = Boolean(
    import.meta.env.VITE_BICONOMY_BUNDLER_URL &&
      import.meta.env.VITE_BICONOMY_PAYMASTER_API_KEY &&
      tokenAddress &&
      resolvedRecipient &&
      smartAccountClient
  );

  const mintEnabled = envOk && guardState.checked && guardState.issuerAllowed && guardState.complianceAllowed;
  const latestGuardRunRef = useRef(0);

  const runMintGuards = async () => {
    const runId = latestGuardRunRef.current + 1;
    latestGuardRunRef.current = runId;

    if (!tokenAddress || !smartAccountAddress || !resolvedRecipient) {
      setGuardState({
        checked: true,
        issuerAllowed: false,
        complianceAllowed: false,
        complianceReasonCode: null,
        error: "Token address, smart account, and recipient are required."
      });
      return;
    }
    try {
      setIsCheckingGuard(true);
      const provider = new ethers.JsonRpcProvider(
        import.meta.env.VITE_CHAIN_RPC_URL || "https://rpc.ankr.com/eth_sepolia"
      );
      const token = new ethers.Contract(
        tokenAddress,
        ["function isIssuer(address) view returns (bool)"],
        provider
      );
      const issuerAllowed = await token.isIssuer(smartAccountAddress);

      const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";
      const precheckResponse = await fetch(`${backendUrl}/api/compliance/check-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "0x0000000000000000000000000000000000000000",
          to: resolvedRecipient,
          amount: amount.trim()
        })
      });
      const precheckJson = await precheckResponse.json();
      if (!precheckResponse.ok) {
        throw new Error(precheckJson.error || "Compliance precheck failed");
      }

      if (runId !== latestGuardRunRef.current) {
        return;
      }

      setGuardState({
        checked: true,
        issuerAllowed: Boolean(issuerAllowed),
        complianceAllowed: Boolean(precheckJson.allowed),
        complianceReasonCode: Number(precheckJson.reasonCode),
        error: null
      });
    } catch (error) {
      if (runId !== latestGuardRunRef.current) {
        return;
      }
      setGuardState({
        checked: true,
        issuerAllowed: false,
        complianceAllowed: false,
        complianceReasonCode: null,
        error: error.message || "Guard precheck failed"
      });
    } finally {
      if (runId === latestGuardRunRef.current) {
        setIsCheckingGuard(false);
      }
    }
  };

  useEffect(() => {
    setGuardState((prev) => ({
      ...prev,
      checked: false
    }));

    if (!envOk) {
      return;
    }

    const handle = setTimeout(() => {
      runMintGuards();
    }, GUARD_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [tokenAddress, resolvedRecipient, amount, smartAccountAddress, smartAccountClient]);

  const submitMintViaAA = async () => {
    if (!mintEnabled) return;
    try {
      setIsSubmitting(true);
      setResult({ userOpHash: null, txHash: null, userOpStatus: null, error: null });
      const data = encodeFunctionData({
        abi: parseAbi(["function mint(address to, uint256 amount)"]),
        functionName: "mint",
        args: [resolvedRecipient, BigInt(amount)]
      });

      const userOpResponse = await smartAccountClient.sendTransaction({
        to: tokenAddress,
        data
      });

      const hashPayload = await userOpResponse.waitForTxHash();
      const receiptPayload = await userOpResponse.wait();

      setResult({
        userOpHash: userOpResponse?.userOpHash || null,
        txHash: hashPayload?.transactionHash || receiptPayload?.receipt?.transactionHash || null,
        userOpStatus: receiptPayload?.success || null,
        error: null
      });
    } catch (error) {
      setResult({
        userOpHash: null,
        txHash: null,
        userOpStatus: null,
        error: error.message || "Failed to send UserOperation"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section style={cardStyle}>
      <h2>Biconomy Sponsored Mint (ERC-4337)</h2>

      <label>ERC3643 Token Address</label>
      <input style={inputStyle} value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} placeholder="0x..." />

      <label style={{ display: "block", marginTop: 8 }}>Recipient (optional; defaults to smart account)</label>
      <input style={inputStyle} value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x..." />

      <label style={{ display: "block", marginTop: 8 }}>Amount</label>
      <input style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1" />

      <button style={buttonStyle} onClick={submitMintViaAA} disabled={!mintEnabled || isSubmitting}>
        {isSubmitting ? "Submitting..." : "Send Sponsored Mint"}
      </button>

      {!envOk && (
        <p style={{ color: "#b91c1c" }}>
          Configure <code>VITE_BICONOMY_BUNDLER_URL</code>, <code>VITE_BICONOMY_PAYMASTER_API_KEY</code>, token address,
          recipient/smart account, and initialize smart account.
        </p>
      )}
      {envOk && (
        <p style={{ color: mintEnabled ? "#166534" : "#b91c1c" }}>
          Guard status: {isCheckingGuard ? "CHECKING..." : mintEnabled ? "PASS" : "BLOCKED"} | issuer:{" "}
          {guardState.issuerAllowed ? "ok" : "fail"} |
          compliance: {guardState.complianceAllowed ? "ok" : "fail"}
        </p>
      )}

      <pre style={{ background: "#0f172a", color: "#e2e8f0", borderRadius: 8, padding: 12, maxHeight: 240, overflow: "auto" }}>
        {JSON.stringify(
          {
            smartAccountAddress,
            mintEnabled,
            guardState,
            userOpHash: result.userOpHash,
            txHash: result.txHash,
            userOpStatus: result.userOpStatus,
            error: result.error
          },
          null,
          2
        )}
      </pre>
    </section>
  );
}
