const fs = require("node:fs/promises");
const path = require("node:path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { buildContracts } = require("./contracts");
const { onboardInvestor } = require("./workflows/onboardInvestor");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = Number(process.env.BACKEND_PORT || 4000);
const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL;
const privateKey = process.env.PRIVATE_KEY;

const addresses = {
  identityRegistry: process.env.DEPLOYED_IDENTITY_REGISTRY || "",
  compliance: process.env.DEPLOYED_COMPLIANCE || "",
  token: process.env.DEPLOYED_TOKEN || "",
  vault: process.env.DEPLOYED_VAULT || ""
};

const hasChainConfig = Boolean(
  rpcUrl &&
    privateKey &&
    addresses.identityRegistry &&
    addresses.compliance &&
    addresses.token
);

const contracts = hasChainConfig
  ? buildContracts({
      rpcUrl,
      privateKey,
      addresses
    })
  : null;
const hasAdminHelperConfig = Boolean(hasChainConfig && addresses.vault);

const oracleStorePath = path.join(__dirname, "../data/oracle-prices.json");
const indexerEventsPath = path.join(__dirname, "../../indexer/data/events.jsonl");

async function writeOraclePrice(symbol, value) {
  let prices = {};
  try {
    const current = await fs.readFile(oracleStorePath, "utf8");
    prices = JSON.parse(current);
  } catch (error) {
    prices = {};
  }

  prices[symbol] = {
    value: Number(value),
    updatedAt: new Date().toISOString()
  };
  await fs.writeFile(oracleStorePath, JSON.stringify(prices, null, 2), "utf8");
  return prices[symbol];
}

async function readOraclePrices() {
  try {
    const content = await fs.readFile(oracleStorePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    return {};
  }
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    chainConfigured: hasChainConfig,
    adminHelperConfigured: hasAdminHelperConfig
  });
});

app.post("/api/onboarding/investor", async (req, res) => {
  try {
    if (!contracts) {
      return res.status(503).json({
        error: "Chain config missing. Set RPC/PRIVATE_KEY and deployed contract addresses."
      });
    }
    const result = await onboardInvestor({
      contracts,
      payload: req.body
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/identity/issue-claim", async (req, res) => {
  try {
    if (!contracts) {
      return res.status(503).json({ error: "Chain config missing" });
    }
    const { wallet, topic, status } = req.body;
    const tx = await contracts.identityRegistry.issueClaim(wallet, BigInt(topic), Boolean(status));
    await tx.wait();
    return res.json({ ok: true, txHash: tx.hash });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/compliance/check-transfer", async (req, res) => {
  try {
    if (!contracts) {
      return res.status(503).json({ error: "Chain config missing" });
    }
    const { from, to, amount } = req.body;
    const result = await contracts.compliance.getTransferCheck(addresses.token, from, to, BigInt(amount));
    return res.json({
      allowed: result[0],
      reasonCode: Number(result[1])
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/oracle/price", async (req, res) => {
  try {
    const { symbol, value } = req.body;
    if (!symbol) {
      return res.status(400).json({ error: "symbol is required" });
    }
    const saved = await writeOraclePrice(symbol, value);
    return res.json({ symbol, ...saved });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/oracle/prices", async (_req, res) => {
  try {
    const prices = await readOraclePrices();
    return res.json(prices);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/indexer/events", async (_req, res) => {
  try {
    const content = await fs.readFile(indexerEventsPath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);
    const events = lines.slice(-200).map((line) => JSON.parse(line));
    return res.json(events);
  } catch (error) {
    return res.json([]);
  }
});

app.get("/api/admin/supply-yield-metrics", async (req, res) => {
  try {
    if (!contracts || !contracts.token || !contracts.vault || !hasAdminHelperConfig) {
      return res.status(503).json({
        error: "Admin helper config missing. Set RPC/PRIVATE_KEY, DEPLOYED_TOKEN and DEPLOYED_VAULT."
      });
    }

    const trancheId = BigInt(req.query.trancheId ?? "1");
    const [totalSupply, maxSupply, tranchePrincipal, fixedYieldBps, bpsDenominator] = await Promise.all([
      contracts.token.totalSupply(),
      contracts.token.MAX_TOTAL_SUPPLY(),
      contracts.vault.principalLockedByTranche(trancheId),
      contracts.vault.FIXED_YIELD_BPS(),
      contracts.vault.BPS_DENOMINATOR()
    ]);

    const remainingSupply = maxSupply - totalSupply;
    const requiredYieldAmount = (tranchePrincipal * fixedYieldBps) / bpsDenominator;

    return res.json({
      trancheId: trancheId.toString(),
      tokenSupply: {
        mintedSupply: totalSupply.toString(),
        maxSupply: maxSupply.toString(),
        remainingSupply: remainingSupply.toString()
      },
      yieldPolicy: {
        fixedYieldBps: fixedYieldBps.toString(),
        bpsDenominator: bpsDenominator.toString(),
        percentage: Number(fixedYieldBps) / 100
      },
      tranche: {
        principalLocked: tranchePrincipal.toString(),
        requiredYieldAmount: requiredYieldAmount.toString()
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Backend service running on http://localhost:${port}`);
});
