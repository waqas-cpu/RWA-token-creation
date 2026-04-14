# React Account Abstraction (Biconomy)

This project now includes a proper React AA app with Biconomy SDK integration:

- `apps/dashboard-react`

## Run

1. Fill AA environment variables in `.env`:
   - `VITE_CHAIN_RPC_URL`
   - `VITE_BICONOMY_BUNDLER_URL`
   - `VITE_BICONOMY_PAYMASTER_API_KEY`
   - `VITE_ERC3643_TOKEN_ADDRESS`
2. Start dev server:
   - `npm run dashboard:react:dev`

## What is wired end-to-end

- Wallet connection via `wagmi` (injected wallet)
- Smart account initialization via `createSmartAccountClient` from `@biconomy/account`
- Sponsored ERC-4337 UserOperation via `smartAccountClient.sendTransaction(...)`
- UserOperation / tx confirmation via `waitForTxHash()` and `wait()`
- Encoded call to your contract `mint(address,uint256)` on `ERC3643Token`
- React onboarding + compliance panel calling backend APIs
- Mint route guards that require:
  - `isIssuer(smartAccountAddress) == true`
  - compliance precheck (`/api/compliance/check-transfer`) to pass

## Key files

- `apps/dashboard-react/src/providers.jsx`
- `apps/dashboard-react/src/components/WalletSection.jsx`
- `apps/dashboard-react/src/aa/BiconomyAAMintPanel.jsx`

## Important production note

Sponsored `mint()` succeeds only if:
- connected smart account has issuer permissions in your `ERC3643Token`, and
- compliance checks pass for the recipient.

The UI now enforces this explicitly by disabling mint until guard checks pass.
