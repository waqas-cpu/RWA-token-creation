const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Phase 4 - Lockups, roles, and compliance logging", function () {
  async function deployFixture() {
    const [owner, issuer, custodian, alice, bob] = await ethers.getSigners();

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

    await identityRegistry.setVerified(owner.address, true);
    await identityRegistry.setVerified(issuer.address, true);
    await identityRegistry.setVerified(custodian.address, true);
    await identityRegistry.setVerified(alice.address, true);
    await identityRegistry.setVerified(bob.address, true);

    return { owner, issuer, custodian, alice, bob, identityRegistry, compliance, token };
  }

  it("enforces sender lockup until unlock time", async function () {
    const { alice, bob, compliance, token } = await deployFixture();

    await token.mint(alice.address, 500n);
    const latest = await ethers.provider.getBlock("latest");
    await compliance.setAddressLockup(alice.address, BigInt(latest.timestamp + 3600));

    await expect(token.connect(alice).transfer(bob.address, 10n)).to.be.revertedWith("Transfer not compliant");

    await ethers.provider.send("evm_increaseTime", [3601]);
    await ethers.provider.send("evm_mine", []);

    await expect(token.connect(alice).transfer(bob.address, 10n)).to.not.be.reverted;
  });

  it("allows authorized issuer to mint", async function () {
    const { issuer, alice, token } = await deployFixture();

    await token.setIssuer(issuer.address, true);
    await expect(token.connect(issuer).mint(alice.address, 123n)).to.not.be.reverted;

    expect(await token.balanceOf(alice.address)).to.equal(123n);
  });

  it("allows custodian transfer for managed movements", async function () {
    const { custodian, alice, bob, token } = await deployFixture();

    await token.mint(alice.address, 200n);
    await token.setCustodian(custodian.address, true);

    await expect(token.connect(custodian).custodianTransfer(alice.address, bob.address, 50n)).to.not.be.reverted;
    expect(await token.balanceOf(alice.address)).to.equal(150n);
    expect(await token.balanceOf(bob.address)).to.equal(50n);
  });

  it("logs transfer checks for dashboard/indexer consumption", async function () {
    const { alice, bob, compliance, token } = await deployFixture();

    await token.mint(alice.address, 100n);
    await expect(compliance.connect(alice).logTransferCheck(await token.getAddress(), alice.address, bob.address, 10n))
      .to.emit(compliance, "TransferCheckLogged")
      .withArgs(
        alice.address,
        await token.getAddress(),
        alice.address,
        bob.address,
        10n,
        true,
        0
      );
  });
});
