const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Phase 3 - Identity claims and advanced compliance", function () {
  async function deployFixture() {
    const [owner, issuer, alice, bob] = await ethers.getSigners();

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

    return { owner, issuer, alice, bob, identityRegistry, compliance, token };
  }

  it("requires configured claim topics before verification passes", async function () {
    const { issuer, alice, identityRegistry, token } = await deployFixture();

    await identityRegistry.setTrustedIssuer(issuer.address, true);
    await identityRegistry.setRequiredClaimTopic(1n, true); // e.g., KYC passed claim
    await identityRegistry.setVerified(alice.address, true);

    await expect(token.mint(alice.address, 100n)).to.be.revertedWith("Transfer not compliant");

    await identityRegistry.connect(issuer).issueClaim(alice.address, 1n, true);
    await expect(token.mint(alice.address, 100n)).to.not.be.reverted;
  });

  it("enforces jurisdiction restrictions", async function () {
    const { alice, bob, identityRegistry, compliance, token } = await deployFixture();

    await identityRegistry.setVerified(alice.address, true);
    await identityRegistry.setVerified(bob.address, true);
    await identityRegistry.setInvestorProfile(alice.address, 840, 1); // US, retail
    await identityRegistry.setInvestorProfile(bob.address, 124, 1); // CA, retail

    await compliance.setEnforceJurisdiction(true);
    await compliance.setAllowedCountry(840, true);

    await token.mint(alice.address, 100n);
    await expect(token.connect(alice).transfer(bob.address, 100n)).to.be.revertedWith("Transfer not compliant");

    await compliance.setAllowedCountry(124, true);
    await expect(token.connect(alice).transfer(bob.address, 100n)).to.not.be.reverted;
  });

  it("enforces investor category restrictions", async function () {
    const { alice, bob, identityRegistry, compliance, token } = await deployFixture();

    await identityRegistry.setVerified(alice.address, true);
    await identityRegistry.setVerified(bob.address, true);
    await identityRegistry.setInvestorProfile(alice.address, 840, 2); // accredited
    await identityRegistry.setInvestorProfile(bob.address, 840, 1); // retail

    await compliance.setEnforceCategory(true);
    await compliance.setAllowedInvestorCategory(2, true);

    await token.mint(alice.address, 100n);
    await expect(token.connect(alice).transfer(bob.address, 100n)).to.be.revertedWith("Transfer not compliant");

    await compliance.setAllowedInvestorCategory(1, true);
    await expect(token.connect(alice).transfer(bob.address, 100n)).to.not.be.reverted;
  });
});
