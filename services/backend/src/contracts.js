const { ethers } = require("ethers");

const identityRegistryAbi = [
  "function setVerified(address user, bool status) external",
  "function setInvestorProfile(address user, uint16 countryCode, uint8 category) external",
  "function issueClaim(address user, uint256 topic, bool status) external",
  "function isVerified(address user) external view returns (bool)"
];

const complianceAbi = [
  "function getTransferCheck(address token, address from, address to, uint256 amount) external view returns (bool allowed, uint8 reasonCode)"
];

const tokenAbi = [
  "function totalSupply() external view returns (uint256)",
  "function MAX_TOTAL_SUPPLY() external view returns (uint256)"
];

const vaultAbi = [
  "function principalLockedByTranche(uint256 trancheId) external view returns (uint256)",
  "function FIXED_YIELD_BPS() external view returns (uint256)",
  "function BPS_DENOMINATOR() external view returns (uint256)"
];

function buildContracts({ rpcUrl, privateKey, addresses }) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);

  return {
    provider,
    signer,
    identityRegistry: new ethers.Contract(addresses.identityRegistry, identityRegistryAbi, signer),
    compliance: new ethers.Contract(addresses.compliance, complianceAbi, signer),
    token: addresses.token ? new ethers.Contract(addresses.token, tokenAbi, signer) : null,
    vault: addresses.vault ? new ethers.Contract(addresses.vault, vaultAbi, signer) : null
  };
}

module.exports = {
  buildContracts
};
