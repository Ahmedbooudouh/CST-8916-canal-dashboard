const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const { CosmosClient } = require("@azure/cosmos");

const app = express();

// ----- CONFIG -----
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// ----- STATIC FRONTEND (public/) -----
app.use(express.static(path.join(__dirname, "public")));

// ----- COSMOS DB CONFIG -----
const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const dbName = process.env.COSMOS_DB || "RideauCanalDB";
const containerName = process.env.COSMOS_CONTAINER || "SensorAggregations";

if (!endpoint || !key) {
  console.error("❌ Missing COSMOS_ENDPOINT or COSMOS_KEY in .env");
  process.exit(1);
}

const client = new CosmosClient({ endpoint, key });
const database = client.database(dbName);
const container = database.container(containerName);

// Locations (pour info, mais /api/latest est robuste)
const LOCATIONS = ["Dow's Lake", "Fifth Avenue", "NAC"];

// ----- ROUTES API -----
// 1) API AVANT le catch-all

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Latest data par location
app.get("/api/latest", async (req, res) => {
  try {
    // On récupère les 100 derniers documents, triés par date décroissante
    const querySpec = {
      query: "SELECT TOP 100 * FROM c ORDER BY c.windowEnd DESC"
    };

    const { resources } = await container.items.query(querySpec).fetchAll();

    // On garde le document le plus récent par location
    const results = {};
    for (const doc of resources) {
      const loc = doc.location;
      if (!loc) continue;
      if (!results[loc]) {
        results[loc] = doc;
      }
    }

    res.json(results);
  } catch (err) {
    console.error("❌ /api/latest error:", err.message);
    res.status(500).json({ error: "Failed to fetch latest data" });
  }
});

// History – 12 derniers points (toutes locations confondues)
app.get("/api/history", async (req, res) => {
  try {
    const querySpec = {
      query: "SELECT TOP 12 * FROM c ORDER BY c.windowEnd DESC"
    };

    const { resources } = await container.items.query(querySpec).fetchAll();

    const sorted = resources.sort(
      (a, b) => new Date(a.windowEnd) - new Date(b.windowEnd)
    );

    res.json(sorted);
  } catch (err) {
    console.error("❌ /api/history error:", err.message);
    // Pour la démo, on ne casse pas le dashboard : on renvoie un tableau vide
    res.json([]);
  }
});

// ----- CATCH-ALL POUR LE FRONTEND -----
// 2) DOIT ÊTRE APRÈS TOUTES LES ROUTES /api
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ----- START SERVER -----
app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});
