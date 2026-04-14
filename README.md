# RWA Tokenization Ecosystem

This project bootstraps an ERC-3643-based RWA tokenization stack inspired by your architecture diagram:
- Identity onboarding via ONCHAINID-compatible registry
- Transfer gating via compliance rules
- ERC-3643 issuance with off-chain verification integrations
- Fractional/tranche extension path

## Current Status

Implemented:
- Hardhat project config
- Deployment script in `scripts/deploy.js`
- CI workflow in `.github/workflows/ci.yml`
- Environment template in `.env.example`
- Core contracts:
  - `IdentityRegistry` with trusted issuers and claim topics
  - `DefaultCompliance` with identity/jurisdiction/category/lockup checks
  - `ERC3643Token` with issuer/custodian roles and fixed max supply of `500`
  - `TrancheToken1155` and `WrapperYieldVault` for fractionalization and yield
- Phase 5 security hardening in vault (pause, non-reentrancy, solvency tracking)
- Phase 6 access-control standardization using two-step ownership (`Ownable2Step`)
- Deployment verification script in `scripts/verify-deployment.js`
- Event schema docs in `docs/EVENT_SCHEMA.md`
- Off-chain API docs in `docs/OFFCHAIN_APIS.md`
- Account abstraction web template in `apps/dashboard/account-abstraction-template.html`
- React AA app (Biconomy SDK) in `apps/dashboard-react`
- Backend API service in `services/backend/src/server.js`
- Event indexer service in `services/indexer/src/indexer.js`
- Dashboard UI in `apps/dashboard/index.html`

## Quick Start

1. Install Node.js 20+
2. Install dependencies:
   - `npm install`
3. Copy `.env.example` to `.env` and fill values.
4. Compile:
   - `npm run build`
5. Deploy locally:
   - `npm run deploy:local`
6. Verify deployment wiring:
   - `npm run verify:deployment:local`
7. Start off-chain services:
   - `npm run backend:start`
   - `npm run indexer:start`
   - `npm run dashboard:start`
8. Run React AA dashboard:
   - `npm run dashboard:react:dev`

## Architecture Notes

The provided design connects:
- Platform layer (frontend/backend/dashboard)
- Identity and compliance core (ONCHAINID + ERC-3643 checks)
- Off-chain providers (KYC, AML, legal, custodians)
- Fractional layer (tranches and wrapper/yield logic)

This means contract and backend APIs must be designed together so transfer checks and identity claims remain consistent across off-chain and on-chain state.

## Off-Chain Service Scope

- **Backend APIs**
  - Investor onboarding workflow with KYC/AML checks and on-chain claim issuing
  - Compliance transfer simulation endpoint
  - Admin helper endpoint for supply and required tranche yield
  - Oracle price publish/read endpoints
  - Indexed event feed endpoint
- **Indexer**
  - Polls configured contracts and stores decoded events to `services/indexer/data/events.jsonl`
- **Dashboard**
  - Minimal operational console for onboarding, compliance checks, oracle updates, and event feed viewing

## Notes

- Current KYC/AML providers are mock adapters for integration-safe local testing.
- Replace provider adapters with real vendor SDK/API calls before production rollout.
- Yield distribution is policy-enforced at `10%` of locked principal per tranche distribution call.
