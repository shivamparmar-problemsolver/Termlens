const form = document.getElementById("settings-form");
const backendUrl = document.getElementById("backend-url");
const preferLocal = document.getElementById("prefer-local");
const status = document.getElementById("status");

async function load() {
  const stored = await chrome.storage.sync.get({
    backendUrl: "http://127.0.0.1:8787",
    preferLocal: false
  });
  backendUrl.value = stored.backendUrl;
  preferLocal.checked = stored.preferLocal;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await chrome.storage.sync.set({
    backendUrl: backendUrl.value.trim(),
    preferLocal: preferLocal.checked
  });
  status.hidden = false;
});

load();
