const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC3643 core flow", function () {
  async function deployFixture() {
    const [owner, alice, bob, charlie] = await ethers.getSigners();

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

    return { owner, alice, bob, charlie, identityRegistry, compliance, token };
  }

  it("mints only to verified investors", async function () {
    const { alice, charlie, identityRegistry, token } = await deployFixture();

    await identityRegistry.setVerified(alice.address, true);
    await expect(token.mint(alice.address, 100n)).to.not.be.reverted;

    await expect(token.mint(charlie.address, 100n)).to.be.revertedWith("Transfer not compliant");
  });

  it("allows transfer between verified holders", async function () {
    const { alice, bob, identityRegistry, token } = await deployFixture();

    await identityRegistry.setVerified(alice.address, true);
    await identityRegistry.setVerified(bob.address, true);

    await token.mint(alice.address, 100n);
    await expect(token.connect(alice).transfer(bob.address, 40n))
      .to.emit(token, "Transfer")
      .withArgs(alice.address, bob.address, 40n);

    expect(await token.balanceOf(alice.address)).to.equal(60n);
    expect(await token.balanceOf(bob.address)).to.equal(40n);
  });

  it("blocks transfer to unverified recipient", async function () {
    const { alice, charlie, identityRegistry, token } = await deployFixture();

    await identityRegistry.setVerified(alice.address, true);
    await token.mint(alice.address, 100n);

    await expect(token.connect(alice).transfer(charlie.address, 1n)).to.be.revertedWith(
      "Transfer not compliant"
    );
  });

  it("blocks all transfers when compliance is paused", async function () {
    const { alice, bob, identityRegistry, compliance, token } = await deployFixture();

    await identityRegistry.setVerified(alice.address, true);
    await identityRegistry.setVerified(bob.address, true);

    await token.mint(alice.address, 100n);
    await compliance.setTransfersPaused(true);

    await expect(token.connect(alice).transfer(bob.address, 10n)).to.be.revertedWith(
      "Transfer not compliant"
    );
  });

  it("enforces max balance per wallet", async function () {
    const { alice, bob, identityRegistry, compliance, token } = await deployFixture();

    await identityRegistry.setVerified(alice.address, true);
    await identityRegistry.setVerified(bob.address, true);

    await token.mint(alice.address, 300n);
    await compliance.setMaxBalancePerWallet(200n);

    await expect(token.connect(alice).transfer(bob.address, 150n)).to.not.be.reverted;
    await expect(token.connect(alice).transfer(bob.address, 60n)).to.be.revertedWith(
      "Transfer not compliant"
    );
  });

  it("enforces fixed max total supply of 500", async function () {
    const { alice, bob, identityRegistry, token } = await deployFixture();

    await identityRegistry.setVerified(alice.address, true);
    await identityRegistry.setVerified(bob.address, true);

    await expect(token.mint(alice.address, 500n)).to.not.be.reverted;
    await expect(token.mint(bob.address, 1n)).to.be.revertedWith("Max supply exceeded");
  });
});
