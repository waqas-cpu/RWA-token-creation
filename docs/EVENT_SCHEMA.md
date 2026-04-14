# Event Schema (Indexer Guide)

This document defines the normalized event surface to consume in indexers/dashboards.

## Ownership / Access

All contracts using `Ownable2Step` emit:
- `OwnershipTransferStarted(previousOwner, pendingOwner)`
- `OwnershipTransferred(previousOwner, newOwner)`

## Identity Layer

`IdentityRegistry`:
- `IdentityStatusUpdated(user, isVerified)`
- `TrustedIssuerUpdated(issuer, allowed)`
- `ClaimUpdated(issuer, user, topic, status)`
- `RequiredClaimTopicUpdated(topic, required)`
- `InvestorProfileUpdated(user, countryCode, category)`

## Compliance Layer

`DefaultCompliance`:
- `IdentityRegistryUpdated(newRegistry)`
- `EnforceIdentityUpdated(enforceIdentity)`
- `EnforceJurisdictionUpdated(enforceJurisdiction)`
- `EnforceCategoryUpdated(enforceCategory)`
- `TransfersPausedUpdated(transfersPaused)`
- `AddressLockupUpdated(account, unlockTimestamp)`
- `AllowedCountryUpdated(countryCode, allowed)`
- `AllowedInvestorCategoryUpdated(category, allowed)`
- `TransferCheckLogged(caller, token, from, to, amount, allowed, reasonCode)`

### Transfer Check Reason Codes

- `0`: OK
- `1`: transfers paused
- `2`: recipient is zero address
- `3`: sender is under lockup
- `4`: sender not verified
- `5`: recipient not verified
- `6`: jurisdiction restriction failure
- `7`: investor category restriction failure
- `8`: max wallet balance exceeded

## Token Layer

`ERC3643Token`:
- `Transfer(from, to, value)`
- `Approval(owner, spender, value)`
- `ComplianceUpdated(compliance)`
- `IdentityRegistryUpdated(identityRegistry)`
- `IssuerUpdated(account, allowed)`
- `CustodianUpdated(account, allowed)`

## Fractional Layer

`TrancheToken1155`:
- `MinterUpdated(account, allowed)`
- `TransferSingle(operator, from, to, id, value)`

`WrapperYieldVault`:
- `TrancheConfigured(trancheId, underlyingPerShare)`
- `Deposited(investor, trancheId, underlyingAmount, shares)`
- `Redeemed(investor, trancheId, shares, underlyingAmount)`
- `YieldDistributed(trancheId, yieldAmount)`
- `YieldClaimed(investor, trancheId, amount)`
- `PausedUpdated(paused)`
