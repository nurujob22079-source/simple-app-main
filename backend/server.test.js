const { test } = require("node:test");
const assert = require("node:assert");
const app = require("./server");

// Start the app on a random free port for testing
const { createServer } = require("node:http");

function listen() {
  return new Promise((resolve) => {
    const server = createServer(app).listen(0, () => resolve(server));
  });
}

function url(server, path) {
  return `http://localhost:${server.address().port}${path}`;
}

test("GET /api/health returns ok", async () => {
  const server = await listen();
  const res = await fetch(url(server, "/api/health"));
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(body.status, "ok");
  server.close();
});

test("POST /api/messages creates a message", async () => {
  const server = await listen();
  const res = await fetch(url(server, "/api/messages"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "hello" }),
  });
  const body = await res.json();
  assert.strictEqual(res.status, 201);
  assert.strictEqual(body.text, "hello");
  server.close();
});

test("POST /api/messages rejects empty text", async () => {
  const server = await listen();
  const res = await fetch(url(server, "/api/messages"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "  " }),
  });
  assert.strictEqual(res.status, 400);
  server.close();
});
