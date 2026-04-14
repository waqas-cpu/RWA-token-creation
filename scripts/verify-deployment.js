const { ethers } = require("hardhat");

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function assertEqual(actual, expected, label) {
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`${label} mismatch. Expected ${expected}, got ${actual}`);
  }
}

async function main() {
  const addresses = {
    identityRegistry: requiredEnv("DEPLOYED_IDENTITY_REGISTRY"),
    compliance: requiredEnv("DEPLOYED_COMPLIANCE"),
    token: requiredEnv("DEPLOYED_TOKEN"),
    trancheToken: requiredEnv("DEPLOYED_TRANCHE_TOKEN"),
    vault: requiredEnv("DEPLOYED_VAULT"),
  };

  const identityRegistry = await ethers.getContractAt("IdentityRegistry", addresses.identityRegistry);
  const compliance = await ethers.getContractAt("DefaultCompliance", addresses.compliance);
  const token = await ethers.getContractAt("ERC3643Token", addresses.token);
  const trancheToken = await ethers.getContractAt("TrancheToken1155", addresses.trancheToken);
  const vault = await ethers.getContractAt("WrapperYieldVault", addresses.vault);

  assertEqual(await compliance.identityRegistry(), addresses.identityRegistry, "compliance.identityRegistry");
  assertEqual(await token.identityRegistry(), addresses.identityRegistry, "token.identityRegistry");
  assertEqual(await token.compliance(), addresses.compliance, "token.compliance");
  assertEqual(await vault.underlyingToken(), addresses.token, "vault.underlyingToken");
  assertEqual(await vault.trancheToken(), addresses.trancheToken, "vault.trancheToken");

  const vaultMinter = await trancheToken.minters(addresses.vault);
  if (!vaultMinter) {
    throw new Error("trancheToken.minters(vault) should be true");
  }

  console.log("Deployment wiring verified successfully:");
  console.log(JSON.stringify(addresses, null, 2));

  const ownerSnapshot = {
    identityRegistryOwner: await identityRegistry.owner(),
    complianceOwner: await compliance.owner(),
    tokenOwner: await token.owner(),
    trancheTokenOwner: await trancheToken.owner(),
    vaultOwner: await vault.owner(),
  };
  console.log("Owner snapshot:");
  console.log(JSON.stringify(ownerSnapshot, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
