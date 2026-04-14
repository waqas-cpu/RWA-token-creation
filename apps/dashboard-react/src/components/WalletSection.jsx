import React from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

const cardStyle = {
  background: "#fff",
  border: "1px solid #dbe4ee",
  borderRadius: 10,
  padding: 16
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

export function WalletSection({ smartAccountAddress, initError, isInitializing, onInitializeSmartAccount }) {
  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect, connectors, isPending } = useConnect();

  const injectedConnector = connectors.find((connector) => connector.id === "injected") || connectors[0];

  return (
    <section style={cardStyle}>
      <h2>Wallet + Smart Account</h2>
      <div><strong>EOA:</strong> {address || "Not connected"}</div>
      <div><strong>Chain ID:</strong> {chainId || "-"}</div>
      <div><strong>Smart Account:</strong> {smartAccountAddress || "Not available yet"}</div>
      <div><strong>Loading:</strong> {isInitializing ? "yes" : "no"}</div>
      {initError ? <div style={{ color: "#b91c1c", marginTop: 8 }}>{initError}</div> : null}

      {!isConnected ? (
        <button
          style={buttonStyle}
          onClick={() => connect({ connector: injectedConnector })}
          disabled={!injectedConnector || isPending}
        >
          {isPending ? "Connecting..." : "Connect MetaMask"}
        </button>
      ) : (
        <>
          <button style={buttonStyle} onClick={() => onInitializeSmartAccount()} disabled={isInitializing}>
            {isInitializing ? "Initializing..." : "Initialize Smart Account"}
          </button>
          <button style={buttonStyle} onClick={() => disconnect()}>
            Disconnect
          </button>
        </>
      )}
    </section>
  );
}
