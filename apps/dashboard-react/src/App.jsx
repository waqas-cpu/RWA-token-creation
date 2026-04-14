import React, { useState } from "react";
import { createSmartAccountClient } from "@biconomy/account";
import { useWalletClient } from "wagmi";
import { WalletSection } from "./components/WalletSection";
import { BiconomyAAMintPanel } from "./aa/BiconomyAAMintPanel";
import { OnboardingCompliancePanel } from "./components/OnboardingCompliancePanel";

export function App() {
  const { data: walletClient } = useWalletClient();
  const [smartAccountClient, setSmartAccountClient] = useState(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState("");
  const [initError, setInitError] = useState("");
  const [isInitializing, setIsInitializing] = useState(false);

  const initializeSmartAccount = async () => {
    if (!walletClient) {
      setInitError("Connect wallet first.");
      return;
    }
    const bundlerUrl = import.meta.env.VITE_BICONOMY_BUNDLER_URL;
    const biconomyPaymasterApiKey = import.meta.env.VITE_BICONOMY_PAYMASTER_API_KEY;
    if (!bundlerUrl || !biconomyPaymasterApiKey) {
      setInitError("Missing VITE_BICONOMY_BUNDLER_URL or VITE_BICONOMY_PAYMASTER_API_KEY");
      return;
    }

    try {
      setIsInitializing(true);
      setInitError("");
      const client = await createSmartAccountClient({
        signer: walletClient,
        bundlerUrl,
        biconomyPaymasterApiKey
      });
      const address = await client.getAccountAddress();
      setSmartAccountClient(client);
      setSmartAccountAddress(address);
    } catch (error) {
      setInitError(error.message || "Failed to initialize smart account");
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", margin: 24, background: "#f6f8fb", color: "#1f2937" }}>
      <h1>RWA Account Abstraction Dashboard</h1>
      <p style={{ marginTop: 0 }}>
        Powered by <code>@biconomy/account</code>. Configure env values before sending sponsored UserOps.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <WalletSection
          smartAccountAddress={smartAccountAddress}
          initError={initError}
          isInitializing={isInitializing}
          onInitializeSmartAccount={initializeSmartAccount}
        />
        <BiconomyAAMintPanel smartAccountClient={smartAccountClient} smartAccountAddress={smartAccountAddress} />
        <OnboardingCompliancePanel smartAccountAddress={smartAccountAddress} />
      </div>
    </div>
  );
}
