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
    empty.textContent = `${list.length} open on desktop. Tap a tab to focus it in Cursor.`;
  }
}

export function renderChangedFiles(files, { onDiff } = {}) {
  const box = document.getElementById("dashChanges");
  if (!box) return;
  const list = files || [];
  if (!list.length) {
    box.innerHTML = `<div id="dashEmpty">No pending changes.<br>When the Agent edits files, they show up here.</div>`;
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
    onDiff?.(row.getAttribute("data-chdiff"));
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

function paintFile(file) {
  const body = document.getElementById("paneDiffBody");
  const mode = document.getElementById("paneMdMode");
  const preview = document.getElementById("paneMdPreview");
  const source = document.getElementById("paneMdSource");
  if (!body) return;
  const md = isMarkdownFile(file?.name || file?.path) && !file?.error;
  mode?.classList.toggle("show", md);
  preview?.classList.toggle("on", mdPreviewMode);
  source?.classList.toggle("on", !mdPreviewMode);
  if (file?.error) {
    body.className = "";
    body.textContent = file.error;
    return;
  }
  if (md && mdPreviewMode) {
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

export function renderFileHits(tabs, query, { onFocus } = {}) {
  const box = document.getElementById("panePickHits");
  if (!box) return;
  const q = (query || "").trim().toLowerCase();
  const hits = (tabs || []).filter((t) => !q || t.name.toLowerCase().includes(q));
  box.innerHTML = hits
    .map(
      (t) =>
        `<button type="button" class="opt" data-file="${esc(t.name)}"><span class="lbl">${esc(t.name)}${t.active ? '<span class="sub">active on desktop</span>' : ""}</span></button>`,
    )
    .join("");
  box.onclick = (ev) => {
    const row = ev.target.closest("[data-file]");
    if (!row) return;
    onFocus?.(row.getAttribute("data-file"));
  };
}
