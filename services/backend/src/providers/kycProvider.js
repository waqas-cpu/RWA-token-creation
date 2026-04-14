async function runKycCheck(input) {
  if (!input.wallet) {
    return { passed: false, reason: "Missing wallet address" };
  }

  const score = Number(input.kycScore || 100);
  const passed = score >= 70;
  return {
    passed,
    provider: "mock-kyc-provider",
    reason: passed ? "KYC passed" : "KYC score too low",
    raw: { score }
  };
}

module.exports = {
  runKycCheck
};
