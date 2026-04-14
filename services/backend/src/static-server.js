const express = require("express");
const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = Number(process.env.DASHBOARD_PORT || 4173);
const dashboardRoot = path.join(__dirname, "../../../apps/dashboard");

app.use(express.static(dashboardRoot));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Dashboard available at http://localhost:${port}`);
});
