/** Mirror Cursor editor tabs into the Files strip + search. */

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function renderEditorTabs(tabs, { onFocus } = {}) {
  const strip = document.getElementById("paneTabStrip");
  const empty = document.getElementById("dashEmpty");
  const changes = document.getElementById("dashChanges");
  if (!strip) return;
  const openBtn = document.getElementById("paneOpen");
  strip.querySelectorAll(".et").forEach((n) => n.remove());
  const list = tabs || [];
  for (const t of list) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `et${t.active ? " on" : ""}`;
    btn.title = t.label || t.name;
    btn.innerHTML = `<span class="en">${esc(t.name)}${t.dirty ? " ●" : ""}</span>`;
    btn.addEventListener("click", () => onFocus?.(t.name));
    strip.appendChild(btn);
  }
  if (openBtn) openBtn.disabled = false;
  const pick = document.getElementById("panePickInput");
  const go = document.getElementById("panePickGo");
  const cancel = document.getElementById("panePickCancel");
  for (const el of [pick, go, cancel]) if (el) el.disabled = false;
  if (empty && !changes?.querySelector(".dc") && list.length) {
    empty.textContent = list.some((t) => t.disk)
      ? `${list.length} files in the locked repo.`
      : `${list.length} open on desktop. Tap a tab to focus it in Cursor.`;
  }
}

export function renderChangedFiles(files, { onOpen } = {}) {
  const box = document.getElementById("dashChanges");
  if (!box) return;
  const list = files || [];
  if (!list.length) {
    box.innerHTML = `<div id="dashEmpty">No pending changes.<br>Search the locked repo.</div>`;
    return;
  }
  box.innerHTML = list
    .map(
      (f) =>
        `<div class="dc"><button type="button" class="opt" data-chdiff="${esc(f.name)}"><span class="lbl">${esc(f.name)}<span class="sub"><span class="add">${esc(f.add || "")}</span> <span class="del">${esc(f.del || "")}</span></span></span></button></div>`,
    )
    .join("");
  box.onclick = (ev) => {
    const row = ev.target.closest("[data-chdiff]");
    if (!row) return;
    onOpen?.(row.getAttribute("data-chdiff"));
  };
}

export function showDiff(diff) {
  const pane = document.getElementById("paneView");
  const box = document.getElementById("paneDiff");
  const title = document.getElementById("paneDiffTitle");
  const body = document.getElementById("paneDiffBody");
  const mode = document.getElementById("paneMdMode");
  if (!pane || !box || !body) return;
  pane.classList.add("diffing");
  box.classList.add("show");
  mode?.classList.remove("show");
  if (title) title.textContent = diff?.name || "Diff";
  if (diff?.error) {
    body.className = "";
    body.textContent = diff.error;
    return;
  }
  const lines = String(diff?.text || "").split("\n").slice(0, 4000);
  body.className = "";
  body.innerHTML = `<div class="code">${lines
    .map((line) => {
      const kind = line.startsWith("+") ? "add" : line.startsWith("-") ? "del" : line.startsWith("@@") || line.startsWith("diff") ? "meta" : "";
      return `<div class="l ${kind}"><span>${esc(line) || " "}</span></div>`;
    })
    .join("")}</div>`;
}

let paneFile = null;
let mdPreviewMode = localStorage.getItem("iris.mdPreview") !== "off";

const isMarkdownFile = (name) => /\.(md|markdown|mdx)$/i.test(name || "");
const isHtmlFile = (name) => /\.html?$/i.test(name || "");

const safeUrl = (u) => (/^https?:\/\//i.test(u) ? u : "");
const safeColor = (c) => (/^#[0-9a-f]{3,8}$/i.test(c || "") ? c : "");

/** Keep table markup and badge colors; drop every other attribute. */
function sanitizeTable(html) {
  const table = new DOMParser().parseFromString(html, "text/html").querySelector("table");
  if (!table) return "";
  const allow = new Set(["TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TH", "TD", "A", "IMG", "FONT", "BR", "STRONG", "EM", "CODE"]);
  const walk = (node) => {
    for (const el of [...node.children]) {
      if (!allow.has(el.tagName)) {
        el.replaceWith(...el.childNodes);
        continue;
      }
      const href = el.getAttribute("href") || "";
      const src = el.getAttribute("src") || "";
      const alt = el.getAttribute("alt") || "";
      const bg = el.getAttribute("bgcolor") || "";
      const color = el.getAttribute("color") || "";
      for (const a of [...el.attributes]) el.removeAttribute(a.name);
      if (el.tagName === "A" && safeUrl(href)) {
        el.setAttribute("href", href);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener");
      }
      if (el.tagName === "IMG" && safeUrl(src)) {
        el.setAttribute("src", src);
        el.setAttribute("alt", alt);
      }
      if ((el.tagName === "TD" || el.tagName === "TH") && safeColor(bg)) el.style.background = bg;
      if (el.tagName === "FONT" && safeColor(color)) el.style.color = color;
      walk(el);
    }
  };
  walk(table);
  return table.outerHTML;
}

/** Compact markdown → safe HTML. Images, badges, and HTML tables stay rendered. */
function renderMarkdown(src) {
  const text = String(src || "").replace(/\r\n/g, "\n").replace(/<!--[\s\S]*?-->/g, "");
  const slots = [];
  const slot = (html) => `\u0000S${slots.push(html) - 1}\u0000`;
  let s = text.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_, _lang, code) =>
    slot(`<pre><code>${esc(code.replace(/\n$/, ""))}</code></pre>`));
  s = s.replace(/\[!\[([^\]]*)\]\(([^)\s]+)\)\]\(([^)\s]+)\)/g, (_, alt, img, href) =>
    slot(`<a href="${esc(safeUrl(href))}" target="_blank" rel="noopener"><img alt="${esc(alt)}" src="${esc(safeUrl(img))}"></a>`));
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, img) =>
    slot(`<img alt="${esc(alt)}" src="${esc(safeUrl(img))}">`));
  s = s.replace(/<table[\s\S]*?<\/table>/gi, (block) => slot(sanitizeTable(block)));
  s = s.replace(/(?:^|\n)((?:\|.*\|\n?)+)/g, (block) => {
    const lines = block.trim().split("\n").filter((line) => line.trim().startsWith("|"));
    if (lines.length < 2) return block;
    const cells = (line) =>
      line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
    if (!cells(lines[1]).every((cell) => /^:?-+:?$/.test(cell))) return block;
    const head = cells(lines[0]).map((cell) => `<th>${esc(cell)}</th>`).join("");
    const body = lines.slice(2).map((line) => `<tr>${cells(line).map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("");
    return `\n${slot(`<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`)}\n`;
  });
  s = esc(s)
    .replace(/^######\s+(.+)$/gm, "<h6>$1</h6>")
    .replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>")
    .replace(/^####\s+(.+)$/gm, "<h4>$1</h4>")
    .replace(/^###\s+(.+)$/gm, "<h3>$1</h3>")
    .replace(/^##\s+(.+)$/gm, "<h2>$1</h2>")
    .replace(/^#\s+(.+)$/gm, "<h1>$1</h1>")
    .replace(/^&gt;\s?(.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^---+$/gm, "<hr>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/(?:^|\n)((?:[\t ]*[-*+]\s+.+\n?)+)/g, (block) => {
    const items = block.trim().split("\n").map((l) => l.replace(/^[\t ]*[-*+]\s+/, ""));
    return `\n<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>\n`;
  });
  s = s.split(/\n{2,}/).map((chunk) => {
    const t = chunk.trim();
    if (!t || /^<(h[1-6]|ul|ol|pre|blockquote|hr)\b/i.test(t)) return t;
    if (/^\u0000S\d+\u0000$/.test(t)) return t;
    return `<p>${t.replace(/\n/g, "<br>")}</p>`;
  }).join("\n");
  return s.replace(/\u0000S(\d+)\u0000/g, (_, i) => slots[Number(i)] || "");
}

async function exportChartPng(file) {
  const text = String(file?.text || "");
  const svg = text.match(/<svg[\s\S]*?<\/svg>/)?.[0];
  if (!svg) return;
  const name = "iris-model-ladder.png";
  let handle = null;
  if (window.showSaveFilePicker) {
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: "PNG", accept: { "image/png": [".png"] } }],
      });
    } catch (err) {
      if (err?.name === "AbortError") return;
    }
  }
  const marked = svg.includes("xmlns=") ? svg : svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  const img = new Image();
  const url = URL.createObjectURL(new Blob([marked], { type: "image/svg+xml" }));
  const blob = await new Promise((resolve) => {
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1400;
      canvas.height = 900;
      const g = canvas.getContext("2d");
      const plot = { x: 40, y: 64, w: 1320, h: 770 };
      g.fillStyle = "#0b1020";
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.drawImage(img, plot.x, plot.y, plot.w, plot.h);
      const legend = [["#ff5d6c", "Grok"], ["#c084fc", "Anthropic"], ["#2dd4bf", "Google"], ["#4ade80", "OpenAI"], ["#94a3b8", "Other"]];
      g.font = "14px Segoe UI, sans-serif";
      let lx = 40;
      legend.forEach(([color, label]) => {
        g.fillStyle = color;
        g.beginPath();
        g.arc(lx + 6, 28, 6, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#e7eefc";
        g.fillText(label, lx + 18, 33);
        lx += g.measureText(label).width + 40;
      });
      g.strokeStyle = "#d7e3f8";
      g.setLineDash([5, 4]);
      g.beginPath();
      g.moveTo(lx, 28);
      g.lineTo(lx + 22, 28);
      g.stroke();
      g.setLineDash([]);
      g.fillText("Frontier", lx + 28, 33);
      for (const hit of text.matchAll(/class="dot"[^>]*style="left:([\d.]+)%;top:([\d.]+)%;background:(#[0-9a-fA-F]+)"/g)) {
        const x = plot.x + (Number(hit[1]) / 100) * plot.w;
        const y = plot.y + (Number(hit[2]) / 100) * plot.h;
        g.beginPath();
        g.fillStyle = hit[3];
        g.arc(x, y, 5.5, 0, Math.PI * 2);
        g.fill();
        g.lineWidth = 1;
        g.strokeStyle = "rgba(0,0,0,.45)";
        g.stroke();
      }
      const taken = [];
      g.font = "12px Segoe UI, sans-serif";
      for (const card of text.split('<div class="card"').slice(1)) {
        const head = card.slice(0, 420);
        if (!/Frontier:\s*Yes/.test(head)) continue;
        const left = /left:([\d.]+)%/.exec(head);
        const top = /top:([\d.]+)%/.exec(head);
        const title = /<b>([^<]+)<\/b>/.exec(head);
        if (!left || !top || !title) continue;
        const x = plot.x + (Number(left[1]) / 100) * plot.w;
        const y = plot.y + (Number(top[1]) / 100) * plot.h;
        const label = title[1].replace(" · ", " ");
        const wide = g.measureText(label).width;
        let ly = y - 16;
        const toLeft = x > plot.x + plot.w * 0.72;
        while (taken.some((row) => Math.abs(row - ly) < 15)) ly -= 15;
        taken.push(ly);
        const tx = toLeft ? x - wide - 12 : x + 12;
        g.strokeStyle = "#d7e3f8";
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(toLeft ? x - 8 : x + 8, ly - 4);
        g.stroke();
        g.fillStyle = "#e7eefc";
        g.fillText(label, tx, ly);
      }
      g.fillStyle = "#9fb0cc";
      g.font = "13px Segoe UI, sans-serif";
      g.fillText("https://github.com/edwardlthompson/iris/blob/main/docs/model-ladder.html", 40, 880);
      URL.revokeObjectURL(url);
      canvas.toBlob(resolve);
    };
    img.src = url;
  });
  if (!blob) return;
  if (handle) {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }
  const save = new File([blob], name, { type: "image/png" });
  if (navigator.canShare?.({ files: [save] })) {
    await navigator.share({ files: [save] });
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

function bindPngSave() {
  if (bindPngSave.done) return;
  bindPngSave.done = true;
  document.getElementById("paneSharePng")?.addEventListener("click", () => exportChartPng(paneFile));
  window.addEventListener("message", (event) => {
    if (event.data?.type === "iris-save-begin") exportChartPng(paneFile);
  });
}

function paintFile(file) {
  const body = document.getElementById("paneDiffBody");
  const mode = document.getElementById("paneMdMode");
  const preview = document.getElementById("paneMdPreview");
  const source = document.getElementById("paneMdSource");
  if (!body) return;
  bindPngSave();
  const md = isMarkdownFile(file?.name || file?.path) && !file?.error;
  const html = isHtmlFile(file?.name || file?.path) && !file?.error;
  mode?.classList.toggle("show", md || html);
  document.getElementById("paneSharePng")?.toggleAttribute("hidden", !html);
  preview?.classList.toggle("on", mdPreviewMode);
  source?.classList.toggle("on", !mdPreviewMode);
  if (file?.error) {
    body.className = "";
    body.textContent = file.error;
    return;
  }
  if ((md || html) && mdPreviewMode) {
    if (html) {
      body.className = "html-preview";
      body.replaceChildren();
      const frame = document.createElement("iframe");
      frame.setAttribute("sandbox", "allow-scripts allow-downloads");
      frame.title = file?.path || file?.name || "Preview";
      frame.srcdoc = file?.text || "";
      body.appendChild(frame);
      return;
    }
    body.className = "md-preview";
    body.innerHTML = renderMarkdown(file?.text || "");
    return;
  }
  const lines = String(file?.text || "").split("\n").slice(0, 4000);
  body.className = "";
  body.innerHTML = `<div class="code">${lines
    .map((line, i) => `<div class="l"><i>${i + 1}</i><span>${esc(line) || " "}</span></div>`)
    .join("")}</div>`;
}

function bindMdToggle() {
  const preview = document.getElementById("paneMdPreview");
  const source = document.getElementById("paneMdSource");
  if (!preview || preview.dataset.bound) return;
  preview.dataset.bound = "1";
  preview.addEventListener("click", () => {
    mdPreviewMode = true;
    localStorage.setItem("iris.mdPreview", "on");
    if (paneFile) paintFile(paneFile);
  });
  source?.addEventListener("click", () => {
    mdPreviewMode = false;
    localStorage.setItem("iris.mdPreview", "off");
    if (paneFile) paintFile(paneFile);
  });
}

export function showWorkspaceFile(file) {
  const pane = document.getElementById("paneView");
  const diff = document.getElementById("paneDiff");
  const title = document.getElementById("paneDiffTitle");
  if (!pane || !diff) return;
  paneFile = file;
  bindMdToggle();
  pane.classList.add("diffing");
  diff.classList.add("show");
  if (title) title.textContent = file?.path || file?.name || "File";
  paintFile(file);
}

export function hideWorkspaceFile() {
  document.getElementById("paneView")?.classList.remove("diffing");
  document.getElementById("paneDiff")?.classList.remove("show");
}

function fuzzy(q, s) {
  let i = 0;
  for (const ch of s) if (ch === q[i] && ++i === q.length) return true;
  return false;
}

/** Predictive ranking over the full repo inventory (same order as the host). */
export function rankFiles(files, query, limit = 60) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return files.slice(0, limit);
  const scored = [];
  for (const f of files) {
    const lower = f.toLowerCase();
    const base = lower.slice(lower.lastIndexOf("/") + 1);
    const s = base.startsWith(q) ? 0 : base.includes(q) ? 1 : lower.includes(q) ? 2 : fuzzy(q, base) ? 3 : -1;
    if (s >= 0) scored.push([s * 1000 + f.length, f]);
  }
  return scored.sort((a, b) => a[0] - b[0]).slice(0, limit).map((x) => x[1]);
}

export function renderFileHits(tabs, query, { onFocus, inventory = [] } = {}) {
  const box = document.getElementById("panePickHits");
  if (!box) return;
  const q = (query || "").trim();
  const open = new Map((tabs || []).map((t) => [t.name, t]));
  const names = q || !inventory.length
    ? [...new Set([...rankFiles([...open.keys()], q), ...rankFiles(inventory, q)])].slice(0, 60)
    : [...open.keys(), ...inventory.filter((f) => !open.has(f))].slice(0, 60);
  box.classList.toggle("show", names.length > 0);
  box.innerHTML = (inventory.length ? `<div class="dh"><span>${names.length} of ${inventory.length} files</span></div>` : "") + names
    .map((name) => {
      const t = open.get(name);
      return `<button type="button" class="opt" data-file="${esc(name)}"><span class="lbl">${esc(name)}${t?.active ? '<span class="sub">active on desktop</span>' : ""}</span></button>`;
    })
    .join("");
  box.onclick = (ev) => {
    const row = ev.target.closest("[data-file]");
    if (!row) return;
    onFocus?.(row.getAttribute("data-file"));
  };
}
