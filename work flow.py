name: RWA Platform CI/CD

on:
  push:
    branches: [ main, develop ]

jobs:
  smart-contracts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Slither Security Scan
        run: slither .
      - name: Run Tests
        run: forge test # If using Foundry

  deploy-testnet:
    needs: smart-contracts
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Sepolia
        run: npx hardhat run scripts/deploy.js --network sepolia