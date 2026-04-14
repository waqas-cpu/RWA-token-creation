const fs = require("node:fs/promises");
const path = require("node:path");
const { runKycCheck } = require("../providers/kycProvider");
const { runAmlScreening } = require("../providers/amlProvider");

const DEFAULT_CLAIM_TOPIC = 1n;

async function appendAuditRecord(record) {
  const filePath = path.join(__dirname, "../../data/onboarding-audit.jsonl");
  await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
}

async function onboardInvestor({ contracts, payload }) {
  const wallet = payload.wallet;
  const countryCode = Number(payload.countryCode || 0);
  const category = Number(payload.category || 0);

  const kycResult = await runKycCheck(payload);
  const amlResult = await runAmlScreening(payload);
  const approved = kycResult.passed && amlResult.passed;

  if (approved) {
    await (await contracts.identityRegistry.setVerified(wallet, true)).wait();
    await (await contracts.identityRegistry.setInvestorProfile(wallet, countryCode, category)).wait();
    await (await contracts.identityRegistry.issueClaim(wallet, DEFAULT_CLAIM_TOPIC, true)).wait();
  }

  const response = {
    wallet,
    approved,
    checks: {
      kyc: kycResult,
      aml: amlResult
    },
    onchain: approved
      ? {
          verified: true,
          claimTopic: Number(DEFAULT_CLAIM_TOPIC),
          countryCode,
          category
        }
      : null
  };

  await appendAuditRecord({
    at: new Date().toISOString(),
    ...response
  });

  return response;
}

module.exports = {
  onboardInvestor
};
