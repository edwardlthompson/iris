/** DOM helpers for Iris chat transcript. */
export function renderChat(items, itemsEl, emptyEl) {
  if (!itemsEl) return;
  const sig = (items || []).map((it) => `${it.k}\u0001${it.t}`).join("\u0002");
  if (itemsEl.dataset.sig === sig) return;
  itemsEl.dataset.sig = sig;
  const list = itemsEl.closest("#list");
  const nearBottom =
    !list || list.scrollHeight - list.scrollTop - list.clientHeight < 80;
  const keep = list ? list.scrollTop : 0;
  itemsEl.replaceChildren();
  if (!items?.length) {
    emptyEl?.removeAttribute("hidden");
    return;
  }
  emptyEl?.setAttribute("hidden", "");
  for (const it of items) {
    const row = document.createElement("div");
    row.className = `msg ${it.k === "human" ? "human" : it.k === "tool" ? "" : "assistant"}`;
    if (it.k === "human") {
      const bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.textContent = it.t;
      row.appendChild(bubble);
    } else if (it.k === "tool") {
      const tool = document.createElement("div");
      tool.className = "tool";
      const txt = document.createElement("div");
      txt.className = "txt";
      txt.textContent = it.t;
      tool.appendChild(txt);
      row.appendChild(tool);
    } else {
      const p = document.createElement("div");
      p.className = "assistant";
      p.textContent = it.t;
      row.appendChild(p);
    }
    itemsEl.appendChild(row);
  }
  if (!list) return;
  list.scrollTop = nearBottom ? list.scrollHeight : keep;
}

export function setQueue(queueBar, running) {
  if (!queueBar) return;
  if (!running) {
    queueBar.classList.remove("show");
    queueBar.replaceChildren();
    return;
  }
  queueBar.classList.add("show");
  queueBar.innerHTML =
    '<div class="run"><i></i><span>Agent is running; new messages will be queued.</span>' +
    '<button type="button" data-stop class="stop-gen">Stop</button></div>';
}
