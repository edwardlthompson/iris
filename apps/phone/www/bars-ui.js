/** Approval, questionnaire, and queue bars (Cursor Remote chrome). */

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const PRIMARY = /^(allow|approve|accept|yes|submit|continue|run|ok)$/i;

export function renderActionBar(bar, labels, onTap) {
  if (!bar) return;
  const list = labels || [];
  bar.classList.toggle("show", list.length > 0);
  bar.innerHTML = list
    .map((label, n) => {
      const cls = PRIMARY.test(label) ? "primary" : /stop/i.test(label) ? "stop-gen" : "";
      return `<button type="button" class="${cls}" data-n="${n}">${esc(label)}</button>`;
    })
    .join("");
  bar.onclick = (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;
    onTap?.(list[Number(btn.dataset.n)], Number(btn.dataset.n));
  };
}

export function renderQuestions(bar, qs, onSend) {
  if (!bar) return;
  if (!qs?.list?.length) {
    bar.classList.remove("show");
    bar.innerHTML = "";
    return;
  }
  bar.classList.add("show");
  bar.innerHTML =
    `<div class="qnHead">The Agent is asking you${qs.list.length > 1 ? ` (${qs.list.length})` : ""}</div>` +
    qs.list
      .map((q, qi) => {
        const opts = (q.options || [])
          .map((o, oi) =>
            o.free
              ? `<div class="qnFree"><input data-qi="${qi}" data-oi="${oi}" placeholder="Other…" value="${esc(o.value || "")}"><button type="button" data-qfree="${qi}:${oi}">Set</button></div>`
              : `<button type="button" class="qnOpt${o.sel ? " on" : ""}" data-qi="${qi}" data-oi="${oi}"><b>${String.fromCharCode(65 + oi)}</b><span>${esc(o.label)}</span></button>`,
          )
          .join("");
        return `<div class="qnQ">${esc(q.text)}</div><div class="qnOpts">${opts}</div>`;
      })
      .join("") +
    `<div class="qnAct"><button type="button" data-qpart="skip">Skip</button><button type="button" class="primary" data-qpart="submit">Submit</button></div>`;
  bar.onclick = (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;
    if (btn.dataset.qpart) return onSend?.({ part: btn.dataset.qpart });
    if (btn.dataset.qfree) {
      const [qi, oi] = btn.dataset.qfree.split(":").map(Number);
      return onSend?.({ part: "option", qi, oi, text: btn.previousElementSibling?.value || "" });
    }
    if (btn.dataset.qi != null) {
      onSend?.({ part: "option", qi: Number(btn.dataset.qi), oi: Number(btn.dataset.oi) });
    }
  };
}

export function renderQueue(bar, { busy = false, queued = [] } = {}, onAction) {
  if (!bar) return;
  let html = "";
  if (busy) {
    html += `<div class="run"><i></i><span>${
      queued.length
        ? "Agent is running; the messages below are sent in order when this turn ends"
        : "Agent is running; new messages will be queued"
    }</span><button type="button" data-stop class="stop-gen">Stop</button></div>`;
  }
  if (queued.length) {
    html += `<div class="qh">Queued: ${queued.length}</div>`;
    html += queued
      .map(
        (q) =>
          `<div class="q"><span class="qt">${esc(q.t || "")}</span><button type="button" data-q="${esc(q.id)}" data-a="remove">Delete</button></div>`,
      )
      .join("");
  }
  bar.innerHTML = html;
  bar.classList.toggle("show", Boolean(html));
  bar.onclick = (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;
    if ("stop" in btn.dataset) return onAction?.({ action: "stop" });
    if (btn.dataset.a) onAction?.({ action: btn.dataset.a, id: btn.dataset.q });
  };
}
