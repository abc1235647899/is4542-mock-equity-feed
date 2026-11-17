const DATA = {};
const $ = (id) => document.getElementById(id);

const files = {
  meta: "data/meta.json",
  counts: "data/counts.json",
  watchlists: "data/watchlists.json",
  quotes: "data/quotes.json",
  news: "data/news_items.json",
  profiles: "data/company_profiles.json",
  iis: "data/iis_announcements.json",
  ohlc: "data/ohlc_daily_tail.json",
  ma50: "data/ma50_latest.json",
};

function fmt(n, d = 2) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("en-HK", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function pct(n) {
  if (n === null || n === undefined) return "—";
  const v = Number(n);
  const sign = v > 0 ? "+" : "";
  return sign + (Math.abs(v) >= 1 && Math.abs(v) <= 2 && Number.isInteger(v * 100) === false && Math.abs(v) < 1 ? (v * 100).toFixed(2) : (Math.abs(v) <= 2 && Math.abs(v) < 1 ? (v * 100).toFixed(2) : v.toFixed(2))) + "%";
}
function pctSmart(n) {
  if (n === null || n === undefined) return "—";
  const v = Number(n);
  // ytd_return is a fraction (0.1513); change_pct is already in percent (-3.2)
  const shown = Math.abs(v) <= 2 ? v * 100 : v;
  const sign = shown > 0 ? "+" : "";
  return sign + shown.toFixed(2) + "%";
}
function cls(n) {
  const v = Number(n);
  return v > 0 ? "up" : v < 0 ? "down" : "";
}
function tickersOf(item) {
  const raw = item.mentioned_tickers;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}
function byTicker(ticker) {
  return DATA.quotes.find((q) => q.ticker === ticker);
}
function label(q) {
  if (!q) return "";
  return `${q.display_ticker || q.ticker} ${q.name_zh || q.name_en}`;
}

function showPanel(id) {
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === id));
  document.querySelectorAll("nav button").forEach((b) => {
    if (b.dataset.panel === id) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
}

function fillSelects() {
  const wsel = $("watch-select");
  DATA.watchlists.forEach((w, i) => {
    const o = document.createElement("option");
    o.value = w.id;
    o.textContent = `${w.name} / ${w.name_zh}`;
    if (i === 1) o.selected = true; // demo_short first if present
    wsel.appendChild(o);
  });
  if (![...wsel.options].some((o) => o.selected) && wsel.options.length) wsel.selectedIndex = 0;

  const quotesSorted = [...DATA.quotes].sort((a, b) => a.ticker.localeCompare(b.ticker));
  for (const id of ["quote-select", "profile-select", "iis-select"]) {
    const sel = $(id);
    if (id === "iis-select") {
      const all = sel.querySelector("option") || document.createElement("option");
    }
    quotesSorted.forEach((q) => {
      const o = document.createElement("option");
      o.value = q.ticker;
      o.textContent = label(q);
      sel.appendChild(o);
    });
  }
}

function renderWatch() {
  const id = $("watch-select").value;
  const wl = DATA.watchlists.find((w) => w.id === id) || DATA.watchlists[0];
  $("watch-note").textContent = wl ? `${wl.description} · ${wl.tickers.length} names` : "";
  const body = document.querySelector("#watch-table tbody");
  body.innerHTML = "";
  (wl?.tickers || []).forEach((t) => {
    const q = byTicker(t);
    if (!q) return;
    const tr = document.createElement("tr");
    tr.className = "clickable";
    tr.innerHTML = `
      <td>${label(q)}</td>
      <td>${fmt(q.last)}</td>
      <td>${fmt(q.high)}</td>
      <td>${fmt(q.low)}</td>
      <td class="${cls(q.change_value)}">${q.change_value > 0 ? "+" : ""}${fmt(q.change_value)}</td>
      <td class="${cls(q.change_pct)}">${q.change_pct > 0 ? "+" : ""}${fmt(q.change_pct)}%</td>
      <td>${q.turnover_display || "—"}</td>`;
    tr.addEventListener("click", () => {
      $("quote-select").value = q.ticker;
      renderQuote();
      showPanel("quote");
    });
    body.appendChild(tr);
  });
}

function metric(labelText, value) {
  return `<div class="metric"><b>${labelText}</b>${value}</div>`;
}

function renderQuote() {
  const t = $("quote-select").value;
  const q = byTicker(t);
  const ma = DATA.ma50[t];
  const el = $("quote-card");
  if (!q) { el.innerHTML = "<p class='empty'>No quote.</p>"; return; }
  el.innerHTML = `
    <div class="meta">${q.delay_badge} · 截至 ${q.as_of.replace("T", " ").replace("+08:00", " HKT")} · MOCK</div>
    <div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:8px;margin-top:6px;">
      <h2 style="margin:0">${label(q)}</h2>
      <span class="price">${fmt(q.last)}</span>
      <span class="${cls(q.change_value)}">${q.change_value > 0 ? "+" : ""}${fmt(q.change_value)} (${q.change_pct > 0 ? "+" : ""}${fmt(q.change_pct)}%)</span>
    </div>
    <canvas id="spark" width="1000" height="180"></canvas>
    <div class="quote-grid">
      ${metric("開市價 Open", fmt(q.open))}
      ${metric("最高 High", fmt(q.high))}
      ${metric("最低 Low", fmt(q.low))}
      ${metric("上日收市 Previous", fmt(q.prev_close))}
      ${metric("成交額 Turnover", q.turnover_display || "—")}
      ${metric("成交量 Volume", q.volume_display || "—")}
      ${metric("市值 Market cap", q.market_cap_display || "—")}
      ${metric("市盈率 PE", fmt(q.pe, 1))}
      ${metric("市賬率 PB", fmt(q.pb, 2))}
      ${metric("股息率 Yield", pctSmart(q.dividend_yield))}
      ${metric("每股盈利 EPS", fmt(q.eps))}
      ${metric("每股淨值 Book", fmt(q.book_value_per_share))}
      ${metric("每手股數 Lot", q.lot_size)}
      ${metric("五天平均成交額", q.turnover_5d_avg_display || "—")}
      ${metric("Beta", fmt(q.beta, 2))}
      ${metric("波幅 Volatility", pctSmart(q.volatility))}
      ${metric("年初至今 YTD", pctSmart(q.ytd_return))}
      ${metric("恒指年初至今", pctSmart(q.hsi_ytd_return))}
      ${metric("1個月高/低", `${fmt(q.high_1m)} / ${fmt(q.low_1m)}`)}
      ${metric("3個月高/低", `${fmt(q.high_3m)} / ${fmt(q.low_3m)}`)}
      ${metric("52週高/低", `${fmt(q.high_52w)} / ${fmt(q.low_52w)}`)}
      ${metric("50-day MA (educational)", ma ? fmt(ma.ma50) : "—")}
    </div>
    <p class="cite">PE, PB, EPS and similar figures are stylised teaching values. The chart shows the last 180 mock daily closes, corporate-action-adjusted in this feed.</p>
  `;
  drawSpark("spark", DATA.ohlc[t] || []);
}

function drawSpark(id, rows) {
  const c = document.getElementById(id);
  if (!c || !rows.length) return;
  const ctx = c.getContext("2d");
  const w = c.width, h = c.height;
  ctx.clearRect(0, 0, w, h);
  const closes = rows.map((r) => r.c);
  const min = Math.min(...closes), max = Math.max(...closes);
  const pad = 16;
  const x = (i) => pad + (i * (w - pad * 2)) / Math.max(closes.length - 1, 1);
  const y = (v) => pad + (1 - (v - min) / (max - min || 1)) * (h - pad * 2);
  ctx.strokeStyle = closes[closes.length - 1] >= closes[0] ? "#0B6E4F" : "#B42318";
  ctx.lineWidth = 2;
  ctx.beginPath();
  closes.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
  ctx.stroke();
  ctx.fillStyle = "#5C6570";
  ctx.font = "16px sans-serif";
  ctx.fillText(rows[0].d, pad, h - 2);
  ctx.textAlign = "right";
  ctx.fillText(rows[rows.length - 1].d, w - pad, h - 2);
}

function renderNews() {
  const q = ($("news-filter").value || "").trim().toLowerCase();
  const items = DATA.news.filter((n) => {
    if (!q) return true;
    const ticks = tickersOf(n).join(" ").toLowerCase();
    return (n.headline || "").toLowerCase().includes(q)
      || (n.body || "").toLowerCase().includes(q)
      || ticks.includes(q)
      || (n.source_label || "").toLowerCase().includes(q);
  }).sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""));
  $("news-count").textContent = `${items.length} items`;
  $("news-list").innerHTML = items.map((n) => {
    const ticks = tickersOf(n);
    const out = n.in_passing_scope ? "" : `<span class="tag out">not in passing scope</span>`;
    const overlap = (n.source_label || "").includes("重疊") || (n.source_type || "") === "overlap" || (n.source_label || "").includes("模擬重疊")
      ? `<span class="tag warn">${n.source_label}</span>`
      : `<span class="tag">${n.source_label || n.source_type}</span>`;
    return `<article class="news-item card">
      <div class="meta">${n.published_at?.replace("T", " ").replace("+08:00", " HKT") || ""} · ${n.id}${n.reporter_initials ? " · (" + n.reporter_initials + ")" : ""}</div>
      <h3>${n.headline}</h3>
      <div>${overlap}${out}${ticks.map((t) => `<span class="tag">${t}</span>`).join("")}</div>
      <p>${(n.body || "").replace(/</g, "&lt;")}</p>
    </article>`;
  }).join("") || `<p class="empty">No matching news.</p>`;
}

function renderIis() {
  const t = $("iis-select").value;
  const items = DATA.iis
    .filter((a) => !t || a.ticker === t)
    .sort((a, b) => (b.announcement_date || "").localeCompare(a.announcement_date || ""));
  $("iis-count").textContent = `${items.length} announcements`;
  $("iis-list").innerHTML = items.map((a) => `
    <article class="news-item card">
      <div class="meta">${a.announcement_date} · ${a.ticker} · <span class="tag">${a.category_zh || a.category}</span></div>
      <h3 style="font-size:15px">${a.headline}</h3>
    </article>
  `).join("") || `<p class="empty">No announcements.</p>`;
}

function renderProfile() {
  const t = $("profile-select").value;
  const p = DATA.profiles.find((x) => x.ticker === t);
  const el = $("profile-card");
  if (!p) { el.innerHTML = "<p class='empty'>No profile.</p>"; return; }
  el.innerHTML = `
    <h2 style="margin-top:0">${p.display_ticker || p.ticker} ${p.name_zh} / ${p.name_en}</h2>
    <p class="meta">Updated ${p.updated_at || "—"} · MOCK educational profile</p>
    ${metric("MAIN SECTORS", p.main_sectors || "—")}
    ${metric("Sub Sector(s)", p.sub_sectors || "—")}
    <h3>Principal activities</h3>
    <p>${p.principal_activities || "—"}</p>
    <h3>Latest results <span class="meta">${p.latest_results_period_end || ""} · ${p.latest_results_announcement_date || ""}</span></h3>
    <p>${p.latest_results_text || "—"}</p>
    <h3>Business review <span class="meta">${p.business_review_period || ""}</span></h3>
    <p>${p.business_review_text || "—"}</p>
  `;
}

function searchRag() {
  const q = ($("rag-q").value || "").trim().toLowerCase();
  const out = $("rag-out");
  if (q.length < 2) { out.innerHTML = `<p class="empty">Type at least two characters.</p>`; return; }
  const hits = [];
  DATA.news.forEach((n) => {
    const blob = `${n.headline} ${n.body} ${tickersOf(n).join(" ")}`.toLowerCase();
    if (blob.includes(q)) hits.push({ kind: "News · 新聞", title: n.headline, src: `${n.source_label} · ${n.id} · ${n.published_at || ""}`, body: n.body, id: n.id });
  });
  DATA.iis.forEach((a) => {
    const blob = `${a.headline} ${a.ticker} ${a.category} ${a.category_zh}`.toLowerCase();
    if (blob.includes(q)) hits.push({ kind: "IIS · 披露易", title: a.headline, src: `${a.ticker} · ${a.announcement_date} · ${a.id}`, body: "", id: a.id });
  });
  DATA.profiles.forEach((p) => {
    const blob = `${p.name_zh} ${p.name_en} ${p.ticker} ${p.principal_activities} ${p.latest_results_text} ${p.business_review_text}`.toLowerCase();
    if (blob.includes(q)) hits.push({ kind: "Profile · 公司資料", title: `${p.ticker} ${p.name_zh}`, src: `profile · ${p.ticker}`, body: p.principal_activities, id: "P-" + p.ticker });
  });
  out.innerHTML = `<p class="meta">${hits.length} cited sources</p>` + (hits.slice(0, 30).map((h) => `
    <article class="card">
      <span class="tag">${h.kind}</span>
      <h3 style="margin:6px 0 4px">${h.title}</h3>
      ${h.body ? `<p>${h.body.slice(0, 280)}${h.body.length > 280 ? "…" : ""}</p>` : ""}
      <div class="cite">Source: ${h.src}</div>
    </article>
  `).join("") || `<p class="empty">No matches in the mock corpus.</p>`);
}

async function boot() {
  const entries = await Promise.all(Object.entries(files).map(async ([k, path]) => {
    const res = await fetch(path);
    if (!res.ok) throw new Error("Failed to load " + path);
    return [k, await res.json()];
  }));
  entries.forEach(([k, v]) => { DATA[k] = v; });
  $("asof-badge").textContent = `as-of ${DATA.meta.as_of_date} 15:12 HKT`;
  fillSelects();
  const short = DATA.watchlists.find((w) => w.id === "demo_short");
  if (short) $("watch-select").value = "demo_short";
  renderWatch();
  renderQuote();
  renderNews();
  renderIis();
  renderProfile();
}

document.getElementById("nav").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-panel]");
  if (b) showPanel(b.dataset.panel);
});
$("watch-select").addEventListener("change", renderWatch);
$("quote-select").addEventListener("change", renderQuote);
$("news-filter").addEventListener("input", renderNews);
$("iis-select").addEventListener("change", renderIis);
$("profile-select").addEventListener("change", renderProfile);
$("rag-go").addEventListener("click", searchRag);
$("rag-q").addEventListener("keydown", (e) => { if (e.key === "Enter") searchRag(); });

boot().catch((err) => {
  document.querySelector("main").insertAdjacentHTML("afterbegin", `<p class="card" style="color:#7A1F2B">${err.message}</p>`);
});
