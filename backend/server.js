const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve the frontend (static files) from ../frontend
app.use(express.static(path.join(__dirname, "..", "frontend")));

// In-memory data store (resets on restart — fine for a demo)
const messages = [];

// --- API routes ---

// Health check — Jenkins / load balancers use this to confirm the app is up
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Return all messages
app.get("/api/messages", (req, res) => {
  res.json(messages);
});

// Add a new message
app.post("/api/messages", (req, res) => {
  const text = (req.body && req.body.text || "").trim();
  if (!text) {
    return res.status(400).json({ error: "text is required" });
  }
  const message = { id: messages.length + 1, text, createdAt: new Date().toISOString() };
  messages.push(message);
  res.status(201).json(message);
});

// Only listen when run directly (so tests can import the app without binding a port)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
