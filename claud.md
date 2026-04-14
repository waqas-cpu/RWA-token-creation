# Project Overview: RWA Tokenization Ecosystem

This project implements a secure, compliant infrastructure for tokenizing real-world assets using the ERC-3643 standard. It bridges off-chain legal entities and KYC providers with on-chain identity registries and fractionalized investment tranches.

## 🏗 System Architecture

### 1. Platform Layer (Frontend/Backend)
* **Frontend (React):** User interface for investors and issuers.
* **Issuer Dashboard:** Management console for asset lifecycle and compliance monitoring.
* **Backend:** Orchestrates off-chain logic and signs claims for the Identity Layer.

### 2. Identity & Compliance (The Trust Engine)
* **Identity Layer:** Utilizes **ONCHAINID (ERC-734/735)**. The platform signs claims that are added to the user's on-chain identity.
* **Compliance Core:** Centralized via the **ERC-3643 Token**. It checks the **Identity Registry** and **Compliance Rules** before any transfer can occur.
* **Off-Chain Services:** Includes KYC/AML providers, SPV legal entities for asset valuation, and **Chainlink Oracles** for real-time price feeds.

### 3. Fractional Layer (Investment Tranches)
* **Tranches:** Supports multiple risk profiles (e.g., Token ID 1: Senior Debt, Token ID 2: Junior Equity).
* **Wrapper/Yield Contract:** Handles minting fractions and distributing yields to investors based on their holdings.

### 4. Data & Observation
* **Event Indexer:** Captures logs from ERC-3643 and ERC-1155 contracts for the frontend and dashboards.
* **Compliance Dashboard:** Provides auditors and admins with compliance status and portfolio data.

## 🛠 Tech Stack
* **Smart Contracts:** Solidity (ERC-3643, ERC-20, ERC-1155, ERC-734/735).
* **Oracles:** Chainlink (Price feeds and Proof of Reserve).
* **Indexing:** The Graph or custom Node.js indexer.
* **Identity:** ONCHAINID framework.