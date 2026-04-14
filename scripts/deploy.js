const { ethers } = require("hardhat");

async function main() {
  // 1) Identity Registry (Identity Layer)
  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy();
  await identityRegistry.waitForDeployment();
  const identityRegistryAddress = await identityRegistry.getAddress();
  console.log("Identity Registry deployed to:", identityRegistryAddress);

  // 2) Compliance module (Compliance Core)
  const Compliance = await ethers.getContractFactory("DefaultCompliance");
  const compliance = await Compliance.deploy(identityRegistryAddress);
  await compliance.waitForDeployment();
  const complianceAddress = await compliance.getAddress();
  console.log("Compliance deployed to:", complianceAddress);

  // 3) ERC-3643 token deployment
  const Token = await ethers.getContractFactory("ERC3643Token");
  const rwaToken = await Token.deploy(
    "Tokenized Real Estate",
    "TRET",
    identityRegistryAddress,
    complianceAddress
  );
  await rwaToken.waitForDeployment();
  const tokenAddress = await rwaToken.getAddress();
  console.log("RWA Token deployed to:", tokenAddress);

  // 4) Deploy tranche ERC-1155-like token
  const TrancheToken = await ethers.getContractFactory("TrancheToken1155");
  const trancheToken = await TrancheToken.deploy();
  await trancheToken.waitForDeployment();
  const trancheTokenAddress = await trancheToken.getAddress();
  console.log("Tranche token deployed to:", trancheTokenAddress);

  // 5) Deploy wrapper/yield vault and grant mint/burn role
  const WrapperYieldVault = await ethers.getContractFactory("WrapperYieldVault");
  const vault = await WrapperYieldVault.deploy(tokenAddress, trancheTokenAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("Wrapper/Yield vault deployed to:", vaultAddress);

  await trancheToken.setMinter(vaultAddress, true);
  console.log("Vault granted tranche minter role");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
