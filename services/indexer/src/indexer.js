const fs = require("node:fs/promises");
const path = require("node:path");
const dotenv = require("dotenv");
const { ethers } = require("ethers");

dotenv.config();

const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL || "";
const provider = rpcUrl ? new ethers.JsonRpcProvider(rpcUrl) : null;
const pollIntervalMs = Number(process.env.INDEXER_POLL_INTERVAL_MS || 5000);
const maxBlockRange = Number(process.env.INDEXER_MAX_BLOCK_RANGE || 10);

const contracts = [
  {
    name: "IdentityRegistry",
    address: process.env.DEPLOYED_IDENTITY_REGISTRY,
    abi: [
      "event IdentityStatusUpdated(address indexed user, bool isVerified)",
      "event ClaimUpdated(address indexed issuer, address indexed user, uint256 indexed topic, bool status)",
      "event InvestorProfileUpdated(address indexed user, uint16 countryCode, uint8 category)"
    ]
  },
  {
    name: "DefaultCompliance",
    address: process.env.DEPLOYED_COMPLIANCE,
    abi: [
      "event TransferCheckLogged(address indexed caller, address indexed token, address indexed from, address to, uint256 amount, bool allowed, uint8 reasonCode)"
    ]
  },
  {
    name: "ERC3643Token",
    address: process.env.DEPLOYED_TOKEN,
    abi: [
      "event Transfer(address indexed from, address indexed to, uint256 value)",
      "event IssuerUpdated(address indexed account, bool allowed)",
      "event CustodianUpdated(address indexed account, bool allowed)"
    ]
  },
  {
    name: "TrancheToken1155",
    address: process.env.DEPLOYED_TRANCHE_TOKEN,
    abi: ["event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)"]
  },
  {
    name: "WrapperYieldVault",
    address: process.env.DEPLOYED_VAULT,
    abi: [
      "event Deposited(address indexed investor, uint256 indexed trancheId, uint256 underlyingAmount, uint256 shares)",
      "event Redeemed(address indexed investor, uint256 indexed trancheId, uint256 shares, uint256 underlyingAmount)",
      "event YieldDistributed(uint256 indexed trancheId, uint256 yieldAmount)",
      "event YieldClaimed(address indexed investor, uint256 indexed trancheId, uint256 amount)"
    ]
  }
].filter((item) => Boolean(item.address));

const eventsFile = path.join(__dirname, "../data/events.jsonl");
const stateFile = path.join(__dirname, "../data/state.json");

async function ensureStateFile() {
  try {
    await fs.access(stateFile);
  } catch (error) {
    await fs.writeFile(stateFile, JSON.stringify({ lastIndexedBlock: 0 }, null, 2), "utf8");
  }
}

async function readState() {
  const content = await fs.readFile(stateFile, "utf8");
  return JSON.parse(content);
}

async function writeState(state) {
  await fs.writeFile(stateFile, JSON.stringify(state, null, 2), "utf8");
}

async function appendEvent(record) {
  await fs.appendFile(eventsFile, `${JSON.stringify(record)}\n`, "utf8");
}

async function indexOnce() {
  if (!provider) {
    console.log("Indexer idle: set SEPOLIA_RPC_URL or RPC_URL in .env");
    return;
  }
  if (contracts.length === 0) {
    console.log("Indexer idle: set deployed contract addresses in .env");
    return;
  }

  const state = await readState();
  const latestBlock = await provider.getBlockNumber();
  const fromBlock = state.lastIndexedBlock + 1;
  const toBlock = Math.min(fromBlock + maxBlockRange - 1, latestBlock);

  if (fromBlock > toBlock) {
    return;
  }

  for (const contractDef of contracts) {
    const iface = new ethers.Interface(contractDef.abi);

    for (const fragment of iface.fragments) {
      if (fragment.type !== "event") continue;

      const topic = iface.getEvent(fragment.name).topicHash;
      const logs = await provider.getLogs({
        address: contractDef.address,
        fromBlock,
        toBlock,
        topics: [topic]
      });

      for (const log of logs) {
        const parsed = iface.parseLog(log);
        await appendEvent({
          at: new Date().toISOString(),
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          contract: contractDef.name,
          event: parsed.name,
          args: Object.fromEntries(
            parsed.fragment.inputs.map((input, index) => [input.name || `arg${index}`, String(parsed.args[index])])
          )
        });
      }
    }
  }

  state.lastIndexedBlock = toBlock;
  await writeState(state);
}

async function start() {
  await ensureStateFile();
  console.log("Indexer started");
  setInterval(async () => {
    try {
      await indexOnce();
    } catch (error) {
      console.error("Indexer error:", error.message);
    }
  }, pollIntervalMs);
}

start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
