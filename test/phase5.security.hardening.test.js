const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Phase 5 - Security hardening", function () {
  async function deployFixture() {
    const [owner, issuer, custodian, investorA, investorB] = await ethers.getSigners();

    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    const identityRegistry = await IdentityRegistry.deploy();
    await identityRegistry.waitForDeployment();

    const DefaultCompliance = await ethers.getContractFactory("DefaultCompliance");
    const compliance = await DefaultCompliance.deploy(await identityRegistry.getAddress());
    await compliance.waitForDeployment();

    const ERC3643Token = await ethers.getContractFactory("ERC3643Token");
    const token = await ERC3643Token.deploy(
      "Tokenized Real Estate",
      "TRET",
      await identityRegistry.getAddress(),
      await compliance.getAddress()
    );
    await token.waitForDeployment();

    const TrancheToken1155 = await ethers.getContractFactory("TrancheToken1155");
    const trancheToken = await TrancheToken1155.deploy();
    await trancheToken.waitForDeployment();

    const WrapperYieldVault = await ethers.getContractFactory("WrapperYieldVault");
    const vault = await WrapperYieldVault.deploy(await token.getAddress(), await trancheToken.getAddress());
    await vault.waitForDeployment();
    await trancheToken.setMinter(await vault.getAddress(), true);

    await identityRegistry.setVerified(owner.address, true);
    await identityRegistry.setVerified(issuer.address, true);
    await identityRegistry.setVerified(custodian.address, true);
    await identityRegistry.setVerified(investorA.address, true);
    await identityRegistry.setVerified(investorB.address, true);
    await identityRegistry.setVerified(await vault.getAddress(), true);

    await token.mint(owner.address, 100n);
    await token.mint(investorA.address, 100n);
    await token.mint(investorB.address, 100n);

    return { owner, issuer, custodian, investorA, investorB, token, vault };
  }

  it("pauses and blocks vault mutating operations", async function () {
    const { owner, investorA, token, vault } = await deployFixture();

    await vault.configureTranche(1n, 100n);
    await token.connect(investorA).approve(await vault.getAddress(), 100n);

    await expect(vault.connect(investorA).depositAndMint(1n, 100n)).to.not.be.reverted;
    await vault.connect(owner).setPaused(true);

    await expect(vault.connect(investorA).depositAndMint(1n, 100n)).to.be.revertedWithCustomError(vault, "VaultPaused");
    await expect(vault.connect(investorA).redeemAndBurn(1n, 1n)).to.be.revertedWithCustomError(vault, "VaultPaused");
    await expect(vault.connect(investorA).claimYield(1n)).to.be.revertedWithCustomError(vault, "VaultPaused");
  });

  it("maintains solvency invariant over deposit/yield/claim/redeem lifecycle", async function () {
    const { owner, investorA, investorB, token, vault } = await deployFixture();

    await vault.configureTranche(7n, 100n);

    await token.connect(investorA).approve(await vault.getAddress(), 100n);
    await token.connect(investorB).approve(await vault.getAddress(), 100n);
    await vault.connect(investorA).depositAndMint(7n, 100n);
    await vault.connect(investorB).depositAndMint(7n, 100n);

    expect(await vault.totalPrincipalLocked()).to.equal(200n);
    expect(await vault.isSolvent()).to.equal(true);

    await token.connect(owner).approve(await vault.getAddress(), 20n);
    await vault.distributeYield(7n, 20n);

    await vault.connect(investorA).claimYield(7n);
    await vault.connect(investorB).claimYield(7n);
    await expect(await vault.isSolvent()).to.equal(true);

    await vault.connect(investorA).redeemAndBurn(7n, 1n); // redeem 100
    await vault.connect(investorB).redeemAndBurn(7n, 1n); // redeem 100

    expect(await vault.totalPrincipalLocked()).to.equal(0n);
    expect(await vault.isSolvent()).to.equal(true);
    expect(await token.balanceOf(await vault.getAddress())).to.be.gte(0n);
  });

  it("supports role revocation for issuer and custodian separation", async function () {
    const { issuer, custodian, investorA, investorB, token } = await deployFixture();

    await token.setIssuer(issuer.address, true);
    await token.connect(issuer).mint(investorA.address, 100n);
    await token.setIssuer(issuer.address, false);
    await expect(token.connect(issuer).mint(investorA.address, 100n)).to.be.revertedWith("Only issuer");

    await token.setCustodian(custodian.address, true);
    await token.connect(custodian).custodianTransfer(investorA.address, investorB.address, 50n);
    await token.setCustodian(custodian.address, false);
    await expect(token.connect(custodian).custodianTransfer(investorA.address, investorB.address, 10n)).to.be.revertedWith(
      "Only custodian"
    );
  });
});
