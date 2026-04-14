const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Phase 6 - Access standardization (two-step ownership)", function () {
  async function deployFixture() {
    const [owner, newOwner, issuer, investor] = await ethers.getSigners();

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
    await identityRegistry.setVerified(newOwner.address, true);
    await identityRegistry.setVerified(issuer.address, true);
    await identityRegistry.setVerified(investor.address, true);

    return { owner, newOwner, issuer, investor, token };
  }

  it("requires pending owner acceptance before admin rights change", async function () {
    const { owner, newOwner, issuer, investor, token } = await deployFixture();

    await token.setIssuer(issuer.address, true);
    await token.connect(issuer).mint(investor.address, 1n);

    await token.connect(owner).transferOwnership(newOwner.address);
    expect(await token.pendingOwner()).to.equal(newOwner.address);

    await expect(token.connect(newOwner).setIssuer(issuer.address, false)).to.be.revertedWithCustomError(
      token,
      "NotOwner"
    );

    await token.connect(newOwner).acceptOwnership();
    expect(await token.owner()).to.equal(newOwner.address);
    expect(await token.pendingOwner()).to.equal(ethers.ZeroAddress);

    await token.connect(newOwner).setIssuer(issuer.address, false);
    await expect(token.connect(issuer).mint(investor.address, 1n)).to.be.revertedWith("Only issuer");
  });
});
