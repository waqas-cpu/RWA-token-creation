# Account Abstraction Template (Web)

Template file:
- `apps/dashboard/account-abstraction-template.html`

Use it as a base for ERC-4337 integration in your app.

## What It Includes

- wallet connect (`window.ethereum`)
- `mint()` callData encoding for `ERC3643Token`
- UserOperation skeleton build
- bundler gas estimation (`eth_estimateUserOperationGas`)
- UserOperation submit (`eth_sendUserOperation`)

## What You Must Plug In

- real bundler RPC URL
- smart account address and nonce strategy
- real signing function in `signUserOperation()`
- optional paymaster flow (`paymasterAndData`)

## Suggested Integration Path

1. Keep this page as a functional prototype.
2. Move logic into your preferred frontend stack.
3. Replace `signUserOperation()` with your AA SDK:
   - Alchemy Account Kit
   - Biconomy
   - ZeroDev
4. Use backend APIs already in this project for compliance checks before building UserOps.

## Notes

- Current template assumes an `execute(address,uint256,bytes)` style smart account call.
- If your smart account uses a different ABI or EntryPoint version, update the template constants accordingly.
