// scripts/deploy.js
const { ethers } = require("hardhat");

async function main() {
  // 1. Deploy Identity Registry (The 'Identity Layer' in your diagram)
  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy();
  await identityRegistry.deployed();
  console.log("Identity Registry deployed to:", identityRegistry.address);

  // 2. Deploy Compliance Rules (The 'Compliance Core')
  const Compliance = await ethers.getContractFactory("DefaultCompliance");
  const compliance = await Compliance.deploy();
  await compliance.deployed();

  // 3. Deploy the ERC-3643 Token
  const Token = await ethers.getContractFactory("ERC3643Token");
  const rwaToken = await Token.deploy("Tokenized Real Estate", "TRET", identityRegistry.address, compliance.address);
  
  console.log("RWA Token deployed to:", rwaToken.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});