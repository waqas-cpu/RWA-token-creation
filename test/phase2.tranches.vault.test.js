const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Phase 2 - Tranches and Wrapper/Yield Vault", function () {
  async function deployFixture() {
    const [owner, investorA, investorB] = await ethers.getSigners();

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

    // Compliance setup: investors + vault must be verified for ERC3643 moves.
    await identityRegistry.setVerified(owner.address, true);
    await identityRegistry.setVerified(investorA.address, true);
    await identityRegistry.setVerified(investorB.address, true);
    await identityRegistry.setVerified(await vault.getAddress(), true);

    await token.mint(investorA.address, 150n);
    await token.mint(investorB.address, 150n);
    await token.mint(owner.address, 150n);

    return { owner, investorA, investorB, token, trancheToken, vault };
  }

  it("mints tranche shares against underlying deposits", async function () {
    const { investorA, token, trancheToken, vault } = await deployFixture();

    await vault.configureTranche(1n, 100n); // 100 underlying = 1 share
    await token.connect(investorA).approve(await vault.getAddress(), 100n);
    await vault.connect(investorA).depositAndMint(1n, 100n);

    expect(await trancheToken.balanceOf(investorA.address, 1n)).to.equal(1n);
    expect(await token.balanceOf(await vault.getAddress())).to.equal(100n);
  });

  it("redeems underlying by burning tranche shares", async function () {
    const { investorA, token, trancheToken, vault } = await deployFixture();

    await vault.configureTranche(2n, 50n); // 50 underlying = 1 share
    await token.connect(investorA).approve(await vault.getAddress(), 100n);
    await vault.connect(investorA).depositAndMint(2n, 100n);
    await vault.connect(investorA).redeemAndBurn(2n, 1n);

    expect(await trancheToken.balanceOf(investorA.address, 2n)).to.equal(1n);
    // Deposited 100, redeemed 50 => vault retains 50
    expect(await token.balanceOf(await vault.getAddress())).to.equal(50n);
  });

  it("distributes and claims yield proportionally", async function () {
    const { owner, investorA, investorB, token, vault } = await deployFixture();

    await vault.configureTranche(10n, 100n);

    await token.connect(investorA).approve(await vault.getAddress(), 100n);
    await vault.connect(investorA).depositAndMint(10n, 100n); // 1 share

    await token.connect(investorB).approve(await vault.getAddress(), 100n);
    await vault.connect(investorB).depositAndMint(10n, 100n); // 1 share

    await token.connect(owner).approve(await vault.getAddress(), 20n);
    await vault.distributeYield(10n, 20n); // 10% on 200 principal => 10 each claim

    expect(await vault.previewClaimable(investorA.address, 10n)).to.equal(10n);
    expect(await vault.previewClaimable(investorB.address, 10n)).to.equal(10n);

    const beforeA = await token.balanceOf(investorA.address);
    await vault.connect(investorA).claimYield(10n);
    const afterA = await token.balanceOf(investorA.address);

    expect(afterA - beforeA).to.equal(10n);
    expect(await vault.previewClaimable(investorA.address, 10n)).to.equal(0n);
  });

  it("rejects deposits that don't match tranche ratio", async function () {
    const { investorA, token, vault } = await deployFixture();

    await vault.configureTranche(3n, 200n);
    await token.connect(investorA).approve(await vault.getAddress(), 99n);

    await expect(vault.connect(investorA).depositAndMint(3n, 99n)).to.be.revertedWithCustomError(
      vault,
      "InvalidAmount"
    );
  });

  it("enforces fixed 10 percent yield distribution per tranche principal", async function () {
    const { investorA, owner, token, vault } = await deployFixture();

    await vault.configureTranche(11n, 100n);
    await token.connect(investorA).approve(await vault.getAddress(), 100n);
    await vault.connect(investorA).depositAndMint(11n, 100n);

    await token.connect(owner).approve(await vault.getAddress(), 9n);
    await expect(vault.distributeYield(11n, 9n)).to.be.revertedWithCustomError(vault, "InvalidYieldAmount");

    await token.connect(owner).approve(await vault.getAddress(), 10n);
    await expect(vault.distributeYield(11n, 10n)).to.not.be.reverted;
  });
});
