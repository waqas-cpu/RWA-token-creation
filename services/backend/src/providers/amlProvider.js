async function runAmlScreening(input) {
  const flagged = Boolean(input.amlFlagged);
  return {
    passed: !flagged,
    provider: "mock-aml-provider",
    reason: flagged ? "AML screening flagged the wallet" : "AML passed"
  };
}

module.exports = {
  runAmlScreening
};
