const form = document.getElementById("message-form");
const input = document.getElementById("message-input");
const list = document.getElementById("messages");
const status = document.getElementById("status");

// Load existing messages from the backend on page load
async function loadMessages() {
  try {
    const res = await fetch("/api/messages");
    const messages = await res.json();
    render(messages);
  } catch (err) {
    status.textContent = "Could not reach the backend.";
  }
}

function render(messages) {
  list.innerHTML = "";

  if (messages.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No messages yet — add the first one!";
    list.appendChild(li);
    status.textContent = "";
    return;
  }

  for (const m of messages) {
    const li = document.createElement("li");

    const text = document.createElement("span");
    text.className = "msg-text";
    text.textContent = m.text;

    const time = document.createElement("span");
    time.className = "msg-time";
    time.textContent = new Date(m.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    li.append(text, time);
    list.appendChild(li);
  }
  status.textContent = `${messages.length} message(s)`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  try {
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error("request failed");
    input.value = "";
    await loadMessages();
  } catch (err) {
    status.textContent = "Failed to add message.";
  }
});

loadMessages();
