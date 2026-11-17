/* Client-side generator for a new mock teaching snapshot.
   It does not call a server and does not scrape live market data. */
const FEED_STORE_KEY = "is4542-mock-equity-feed:generated-v1";

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text) {
  let h = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function gauss(rand) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function nextTradingDay(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  do {
    dt.setUTCDate(dt.getUTCDate() + 1);
  } while (dt.getUTCDay() === 0 || dt.getUTCDay() === 6);
  return dt.toISOString().slice(0, 10);
}

function weekdayZh(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return ["週日", "週一", "週二", "週三", "週四", "週五", "週六"][dt.getUTCDay()];
}

function tickSize(price) {
  const p = Math.abs(price);
  if (p < 0.25) return 0.001;
  if (p < 0.5) return 0.005;
  if (p < 10) return 0.01;
  if (p < 20) return 0.02;
  if (p < 50) return 0.05;
  if (p < 100) return 0.1;
  if (p < 200) return 0.2;
  if (p < 500) return 0.5;
  if (p < 1000) return 1;
  if (p < 2000) return 2;
  return 5;
}

function roundTick(price) {
  const t = tickSize(price);
  return Math.max(t, Math.round(price / t) * t);
}

function hkAmt(n, unit) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  if (unit === "shares") {
    if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(2)}萬`;
    return String(Math.round(v));
  }
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(2)}億`;
  if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(2)}萬`;
  return v.toFixed(2);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function atTime(date, hour, minute, second) {
  return `${date}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}+08:00`;
}

function initials(rand) {
  const letters = "ABCDEFGHJKLMNPRSTWXYZ";
  return letters[Math.floor(rand() * letters.length)] + letters[Math.floor(rand() * letters.length)];
}

function stockPhrase(q) {
  const dir = q.change_value > 0 ? "升" : q.change_value < 0 ? "跌" : "平市";
  const pct = `${q.change_pct > 0 ? "升" : q.change_pct < 0 ? "跌" : "變"} ${Math.abs(q.change_pct).toFixed(2)}%`;
  return `${q.name_zh}(${q.ticker})報${Number(q.last).toFixed(tickSize(q.last) < 0.1 ? 3 : 2)}元，${dir === "平市" ? "與上日收市相若" : pct}`;
}

function rangeHighLow(rows, days, todayHigh, todayLow) {
  const slice = rows.slice(Math.max(0, rows.length - days));
  const highs = slice.map((r) => r.h).concat([todayHigh]);
  const lows = slice.map((r) => r.l).concat([todayLow]);
  return { high: Math.max(...highs), low: Math.min(...lows) };
}

function ma50Of(rows) {
  const closes = rows.slice(-50).map((r) => r.c);
  if (!closes.length) return null;
  const sum = closes.reduce((a, b) => a + b, 0);
  return sum / closes.length;
}

function buildQuotesAndBars(data, date, asOf, rand) {
  const marketShock = clamp(gauss(rand) * 0.007, -0.025, 0.025);
  const quotes = data.quotes.map((src) => {
    const q = { ...src };
    const prev = Number(src.last);
    const beta = Number(src.beta) || 1;
    const vol = Number(src.volatility) || 0.25;
    const dailySigma = vol / Math.sqrt(252);
    const ret = clamp(marketShock * beta + gauss(rand) * dailySigma, -0.08, 0.08);
    const last = roundTick(prev * (1 + ret));
    const open = roundTick(prev * (1 + ret * (0.25 + rand() * 0.4) + gauss(rand) * dailySigma * 0.25));
    const rawHigh = Math.max(open, last, prev) * (1 + Math.abs(gauss(rand)) * dailySigma * 0.6);
    const rawLow = Math.min(open, last, prev) * (1 - Math.abs(gauss(rand)) * dailySigma * 0.6);
    const high = roundTick(Math.max(open, last, rawHigh));
    const low = roundTick(Math.min(open, last, rawLow));
    const changeValue = Number((last - prev).toFixed(4));
    const changePct = Number(((last / prev - 1) * 100).toFixed(2));
    const volFactor = clamp(0.7 + Math.abs(ret) * 8 + rand() * 0.5, 0.55, 2.2);
    const volume = Math.max(1000, Math.round(Number(src.volume || 1e6) * volFactor));
    const turnover = Number((volume * ((high + low + last) / 3)).toFixed(2));
    const shares = src.market_cap && src.last ? Number(src.market_cap) / Number(src.last) : null;
    const marketCap = shares ? shares * last : src.market_cap;
    const avg5 = src.turnover_5d_avg
      ? Number(src.turnover_5d_avg) * 0.8 + turnover * 0.2
      : turnover;
    const series = [...(data.ohlc[src.ticker] || [])];
    const r1m = rangeHighLow(series, 21, high, low);
    const r3m = rangeHighLow(series, 63, high, low);
    const r52 = rangeHighLow(series, 252, high, low);
    const ytd = (Number(src.ytd_return) || 0) + 1;
    const hsiYtd = (Number(src.hsi_ytd_return) || 0) + 1;
    q.prev_close = prev;
    q.last = last;
    q.open = open;
    q.high = high;
    q.low = low;
    q.change_value = changeValue;
    q.change_pct = changePct;
    q.volume = volume;
    q.volume_display = hkAmt(volume, "shares");
    q.turnover = turnover;
    q.turnover_display = hkAmt(turnover);
    q.turnover_5d_avg = avg5;
    q.turnover_5d_avg_display = hkAmt(avg5);
    if (marketCap != null) {
      q.market_cap = marketCap;
      q.market_cap_display = hkAmt(marketCap);
    }
    if (q.eps) q.pe = Number((last / Number(q.eps)).toFixed(1));
    if (q.book_value_per_share) q.pb = Number((last / Number(q.book_value_per_share)).toFixed(2));
    q.ytd_return = Number((ytd * (last / prev) - 1).toFixed(4));
    q.hsi_ytd_return = Number((hsiYtd * (1 + marketShock) - 1).toFixed(4));
    q.high_1m = r1m.high;
    q.low_1m = r1m.low;
    q.high_3m = r3m.high;
    q.low_3m = r3m.low;
    q.high_52w = r52.high;
    q.low_52w = r52.low;
    q.as_of = asOf;
    q.delay_minutes = 15;
    q.delay_badge = "延時15分鐘";
    q.is_mock = 1;
    return q;
  });

  const ohlc = {};
  const ma50 = {};
  quotes.forEach((q) => {
    const rows = [...(data.ohlc[q.ticker] || [])];
    rows.push({ d: date, o: q.open, h: q.high, l: q.low, c: q.last, v: q.volume });
    ohlc[q.ticker] = rows.slice(-180);
    const ma = ma50Of(ohlc[q.ticker]);
    ma50[q.ticker] = {
      ticker: q.ticker,
      trade_date: date,
      ma50: ma == null ? null : ma.toFixed(4),
      close: String(q.last),
      is_mock: "1",
    };
  });
  return { quotes, ohlc, ma50, marketShock };
}

function buildNews(quotes, date, rand, startSeq) {
  const wd = weekdayZh(date);
  const sorted = [...quotes].sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));
  const gainers = [...quotes].filter((q) => q.change_pct > 0).sort((a, b) => b.change_pct - a.change_pct);
  const losers = [...quotes].filter((q) => q.change_pct < 0).sort((a, b) => a.change_pct - b.change_pct);
  const tech = quotes.filter((q) => ["00700", "09988", "01810", "00981", "03690", "01024"].includes(q.ticker));
  const banks = quotes.filter((q) => ["00005", "00011", "02318", "01299"].includes(q.ticker));
  const pick = (arr, n) => arr.slice(0, Math.max(1, n));
  const reporter = () => initials(rand);
  const items = [];
  let seq = startSeq;

  function stamp() {
    const h = 8 + Math.floor(rand() * 8); // 08-15
    const m = Math.floor(rand() * 60);
    const s = Math.floor(rand() * 60);
    const hh = Math.min(h, 15);
    const mm = hh === 15 ? Math.min(m, 12) : m;
    return atTime(date, hh, mm, s);
  }

  function add({ source_type, source_label, headline, body, tickers, is_multi, in_scope }) {
    seq += 1;
    const id = `NEWS-${date.replace(/-/g, "")}-${String(seq).padStart(4, "0")}`;
    const r = reporter();
    items.push({
      id,
      source_type,
      source_label,
      headline,
      body: `${body}(${r})\n\n〈${source_label}〉`,
      language: "zh-Hant",
      published_at: stamp(),
      reporter_initials: r,
      mentioned_tickers: JSON.stringify(tickers),
      is_raw: 1,
      is_multi_ticker: is_multi ? 1 : 0,
      in_passing_scope: in_scope ? 1 : 0,
      replay_batch: 0,
      is_mock: 1,
    });
  }

  const lead = sorted[0];
  const up = gainers[0];
  const down = losers[0];
  const t1 = pick(tech, 3);
  const b1 = pick(banks, 2);
  add({
    source_type: "infocast",
    source_label: "匯港通訊",
    headline: `港股${wd}模擬市況 ${lead ? lead.name_zh + "較為波動" : "交投一般"}`,
    body:
      `〈匯港通訊〉【教學模擬電訊，並非真實市場稿】${wd}港股模擬延時數據顯示，` +
      (down ? `${stockPhrase(down)}；` : "") +
      (up ? `${stockPhrase(up)}。` : "個別股份上落互見。") +
      `報價為延時十五分鐘的課堂數據，並非投資建議。`,
    tickers: [down, up].filter(Boolean).map((q) => q.ticker),
    is_multi: true,
    in_scope: true,
  });

  if (t1.length) {
    add({
      source_type: "infocast",
      source_label: "匯港通訊",
      headline: `科技股${wd}${t1[0].change_pct < 0 ? "偏軟" : "個別造好"} ${t1.map((q) => q.name_zh).join("、")}`,
      body:
        `〈匯港通訊〉【教學模擬電訊，並非真實市場稿】${t1.map(stockPhrase).join("；")}。` +
        `同學可練習按代碼拆條、去重及註明截稿時間。`,
      tickers: t1.map((q) => q.ticker),
      is_multi: t1.length > 1,
      in_scope: true,
    });
  }

  if (b1.length) {
    add({
      source_type: "infocast",
      source_label: "匯港通訊",
      headline: `金融股${wd}表現分化`,
      body:
        `〈匯港通訊〉【教學模擬電訊，並非真實市場稿】${b1.map(stockPhrase).join("；")}。` +
        `相對強弱只反映當日模擬走勢，不能推論後市。`,
      tickers: b1.map((q) => q.ticker),
      is_multi: b1.length > 1,
      in_scope: true,
    });
  }

  pick(sorted, 3).forEach((q) => {
    add({
      source_type: "infocast",
      source_label: "匯港通訊",
      headline: `${q.name_zh}(${q.ticker})${q.change_pct < 0 ? "回軟" : q.change_pct > 0 ? "向好" : "近乎持平"}`,
      body:
        `〈匯港通訊〉【教學模擬電訊，並非真實市場稿】${stockPhrase(q)}。` +
        `高低位分別為${q.high}元及${q.low}元，成交額約${q.turnover_display}。本則只供課堂引用練習。`,
      tickers: [q.ticker],
      is_multi: false,
      in_scope: true,
    });
  });

  if (rand() < 0.75 && sorted.length >= 2) {
    const a = sorted[0];
    const b = sorted[1];
    add({
      source_type: "other_wire",
      source_label: "模擬重疊通訊",
      headline: `【重疊練習】${a.name_zh}及${b.name_zh}見於第二條模擬電訊`,
      body:
        `〈模擬重疊通訊〉【教學模擬，只供去重練習】內容與匯港通訊可能重疊：` +
        `${stockPhrase(a)}；${stockPhrase(b)}。摘要時應保留兩則來源並分別引用。`,
      tickers: [a.ticker, b.ticker],
      is_multi: true,
      in_scope: true,
    });
  }

  items.sort((a, b) => a.published_at.localeCompare(b.published_at));
  return items;
}

function buildGeneratedFeed(data, seed) {
  const rand = mulberry32(hashSeed(seed));
  const fromDate = (data.meta && data.meta.as_of_date) || "2026-11-13";
  const date = nextTradingDay(fromDate);
  const asOf = atTime(date, 15, 12, 0);
  const moved = buildQuotesAndBars(data, date, asOf, rand);
  const existingIds = (data.news || []).map((n) => n.id);
  const sameDay = existingIds.filter((id) => id && id.startsWith(`NEWS-${date.replace(/-/g, "")}-`));
  const startSeq = sameDay.length;
  const freshNews = buildNews(moved.quotes, date, rand, startSeq);
  const news = [...freshNews, ...(data.news || [])].slice(0, 100);
  const meta = {
    ...(data.meta || {}),
    as_of: asOf,
    as_of_date: date,
    delay_minutes: "15",
    delay_badge: "延時15分鐘",
    is_mock: "true",
    seed: String(seed),
    generated_locally: true,
    generated_note: "This snapshot was generated in the browser from the previous mock session. It is not a live market feed and is stored only on this device.",
  };
  return {
    version: 1,
    seed: String(seed),
    generated_at: new Date().toISOString(),
    meta,
    quotes: moved.quotes,
    news,
    ohlc: moved.ohlc,
    ma50: moved.ma50,
  };
}

function loadStoredFeed() {
  try {
    const raw = localStorage.getItem(FEED_STORE_KEY);
    if (!raw) return null;
    const bundle = JSON.parse(raw);
    if (!bundle || !bundle.quotes || !bundle.meta) return null;
    return bundle;
  } catch (err) {
    return null;
  }
}

function saveStoredFeed(bundle) {
  localStorage.setItem(FEED_STORE_KEY, JSON.stringify(bundle));
}

function clearStoredFeed() {
  localStorage.removeItem(FEED_STORE_KEY);
}

function newFeedSeed() {
  return String((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
}
