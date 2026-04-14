# Off-Chain API Reference

Base URL: `http://localhost:4000`

## Health

- `GET /health`

## Investor Onboarding

- `POST /api/onboarding/investor`
- Body:
  - `wallet` (string)
  - `countryCode` (number)
  - `category` (number)
  - `kycScore` (number, mock provider threshold >= 70)
  - `amlFlagged` (boolean)

When checks pass, backend writes on-chain:
- `setVerified(wallet, true)`
- `setInvestorProfile(wallet, countryCode, category)`
- `issueClaim(wallet, topic=1, true)`

## Identity Claims

- `POST /api/identity/issue-claim`
- Body:
  - `wallet` (string)
  - `topic` (number)
  - `status` (boolean)

## Compliance Simulation

- `POST /api/compliance/check-transfer`
- Body:
  - `from` (address)
  - `to` (address)
  - `amount` (string or number in token units)

Response:
- `allowed` (boolean)
- `reasonCode` (number)

## Oracle Data

- `POST /api/oracle/price`
- Body:
  - `symbol` (string, e.g. `RWA/USD`)
  - `value` (number)

- `GET /api/oracle/prices`

## Indexed Events

- `GET /api/indexer/events`

Returns up to the latest 200 indexed events from:
- `services/indexer/data/events.jsonl`

## Admin Helper

- `GET /api/admin/supply-yield-metrics?trancheId=<id>`

Returns:
- minted and remaining token supply:
  - `mintedSupply`
  - `maxSupply`
  - `remainingSupply`
- fixed yield policy:
  - `fixedYieldBps` (expected `1000`)
  - `percentage` (expected `10`)
- tranche-specific required yield amount before distribution:
  - `principalLocked`
  - `requiredYieldAmount` (`principalLocked * 10%`)
