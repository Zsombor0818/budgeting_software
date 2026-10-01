/* Közös Kassza – közös frontend logika (minden oldal ezt tölti be) */
const $ = (s, r = document) => r.querySelector(s);
const token = localStorage.getItem("token");
const page = document.body.dataset.page;
const PROTECTED = document.body.hasAttribute("data-auth");
const MONTHS = ["január","február","március","április","május","június","július","augusztus","szeptember","október","november","december"];

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const huf = n => new Intl.NumberFormat("hu-HU").format(Math.round(n)) + " Ft";
const short = n => n >= 1000 ? Math.round(n / 1000) + "e" : String(n);
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ym = (y, m) => `${y}-${pad(m + 1)}`;
const sum = (list, type) => list.filter(t => t.type === type).reduce((a, t) => a + t.amount, 0);
const dayOf = t => { const d = new Date(t.date); return isNaN(d) ? String(t.date).slice(0, 10) : ymd(d); };

const ICONS = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  swap: '<path d="M7 4l-4 4 4 4"/><path d="M3 8h14"/><path d="M17 20l4-4-4-4"/><path d="M21 16H7"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14c2.5.6 4 2.6 4 6"/>',
  out: '<path d="M9 4H5v16h4"/><path d="M16 8l4 4-4 4M20 12H9"/>',
  wallet: '<path d="M4 7h14a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"/><path d="M4 7l11-3v3"/>'
};
const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;
const BRAND = `<div class="brand"><i>${icon("wallet")}</i>Közös Kassza</div>`;

/* ---------- általános segédek ---------- */
function logOut() {
  localStorage.removeItem("token");
  window.location.href = "/login";
}

async function api(url, method = "GET", body) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    return { ok: false, status: 0, data: { message: "A szerver nem érhető el." } };
  }
  const raw = await res.text();
  let data = {};
  try { data = JSON.parse(raw); } catch { data = { text: raw }; } // a /register sima szöveggel válaszol
  if (res.status === 401 && PROTECTED) logOut();
  if (!res.ok && !data.message) data.message = `Szerverhiba (${res.status}).`;
  return { ok: res.ok, status: res.status, data };
}

function toast(msg, bad = false) {
  let box = $(".toasts");
  if (!box) { box = document.createElement("div"); box.className = "toasts"; box.setAttribute("role", "status"); document.body.append(box); }
  const t = document.createElement("div");
  t.className = "toast" + (bad ? " bad" : "");
  t.textContent = msg;
  box.append(t);
  setTimeout(() => t.remove(), 3500);
}

function confirmBox(title, okLabel = "Törlés") {
  return new Promise(resolve => {
    const d = document.createElement("dialog");
    d.innerHTML = `<form method="dialog"><h2>${esc(title)}</h2><div class="actions">
      <button class="btn ghost" value="no">Mégse</button><button class="btn danger" value="yes">${esc(okLabel)}</button></div></form>`;
    d.addEventListener("close", () => { resolve(d.returnValue === "yes"); d.remove(); });
    document.body.append(d); d.showModal();
  });
}

function promptBox(title, label, value = "") {
  return new Promise(resolve => {
    const d = document.createElement("dialog");
    d.innerHTML = `<form method="dialog"><h2>${esc(title)}</h2>
      <label>${esc(label)}<input required maxlength="255" value="${esc(value)}"></label>
      <div class="actions"><button class="btn ghost" value="no" formnovalidate>Mégse</button><button class="btn primary" value="yes">Mentés</button></div></form>`;
    d.addEventListener("close", () => { resolve(d.returnValue === "yes" ? $("input", d).value.trim() : null); d.remove(); });
    document.body.append(d); d.showModal();
  });
}

/* ---------- állapot ---------- */
let me = null, fam = { family: null, members: [] }, txs = [];

async function loadCore() {
  const u = await api("/api/user");
  me = u.data.user;
  fam = { family: null, members: [] }; txs = [];
  if (!me || !me.familyId) return;
  const f = await api("/api/family");
  if (f.ok && f.data.family) fam = f.data;
  if (fam.family) {
    const t = await api("/api/transactions");
    if (t.ok && Array.isArray(t.data)) txs = t.data.sort((a, b) => new Date(b.date) - new Date(a.date) || b.transId - a.transId);
  }
}

function renderSidebar() {
  const links = [
    ["/dashboard", "home", "Főoldal"],
    ["/transactions.html", "swap", "Bevétel / Kiadás"],
    ["/calendar.html", "cal", "Naptár"],
    ["/family.html", "users", "Család"]
  ];
  $("#side").innerHTML = `${BRAND}
    <nav class="nav" aria-label="Főmenü">
      ${links.map(([h, i, t]) => `<a href="${h}" ${location.pathname === h ? 'aria-current="page"' : ""}>${icon(i)}<span>${t}</span></a>`).join("")}
      <button data-act="logout">${icon("out")}<span>Kijelentkezés</span></button>
    </nav>
    <div class="who"><b>${esc(me.username)}</b>${esc(me.email)}</div>`;
}

function noFamily() {
  return `<div class="card empty"><h2>Még nincs családod</h2>
    <p>A költségek és bevételek családon belül közösek. Hozz létre egyet, vagy csatlakozz egy meglévőhöz az azonosítóval.</p>
    <a class="btn primary" href="/family.html">Család beállítása</a></div>`;
}

/* ---------- tétel felvitele / szerkesztése ---------- */
let txDialog, editingId = null, onTxSaved = () => {};

function initTxDialog() {
  txDialog = document.createElement("dialog");
  txDialog.innerHTML = `<form id="txForm"><h2 id="txHeading"></h2>
    <div class="seg" role="radiogroup" aria-label="Típus">
      <label><input type="radio" name="type" value="expense" checked><span>Kiadás</span></label>
      <label><input type="radio" name="type" value="income"><span>Bevétel</span></label></div>
    <label>Megnevezés<input name="title" required maxlength="255"></label>
    <label>Összeg (Ft)<input name="amount" type="number" min="1" step="1" required></label>
    <p class="muted" id="txNote" style="font-size:.85rem"></p>
    <label>Megjegyzés (nem kötelező)<input name="description" maxlength="255"></label>
    <p class="err" id="txErr"></p>
    <div class="actions"><button type="button" class="btn ghost" data-act="txCancel">Mégse</button><button class="btn primary">Mentés</button></div></form>`;
  document.body.append(txDialog);
  $("#txForm").addEventListener("submit", async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const body = Object.fromEntries(f.entries());
    body.amount = Number(body.amount);
    body.description = body.description || "";
    if (editingId) body.transId = editingId;
    const r = await api("/api/transaction", editingId ? "PUT" : "POST", body);
    if (!r.ok) { $("#txErr").textContent = r.data.message || "Nem sikerült menteni."; return; }
    txDialog.close();
    toast(editingId ? "Tétel módosítva" : "Tétel hozzáadva");
    await loadCore();
    onTxSaved();
  });
}

function openTx(tx, date) {
  editingId = tx ? tx.transId : null;
  const f = $("#txForm");
  $("#txHeading").textContent = tx ? "Tétel módosítása" : "Új tétel";
  f.type.value = tx ? tx.type : "expense";
  f.title.value = tx ? tx.title : "";
  f.amount.value = tx ? tx.amount : "";
  f.querySelectorAll('[name="type"]').forEach(r => r.disabled = !!tx);
  $("#txNote").textContent = tx ? "A típus és a dátum utólag nem módosítható." : "A tétel a mentés napjával kerül rögzítésre.";
  f.description.value = tx ? tx.description : "";
  $("#txErr").textContent = "";
  txDialog.showModal();
  f.title.focus();
}

function txRow(t) {
  const sign = t.type === "income" ? "+" : "−";
  return `<li class="tx">
    <span class="dot ${t.type}" aria-hidden="true">${sign}</span>
    <div class="tx-main"><strong>${esc(t.title)}</strong>
      <small><span>${dayOf(t).replaceAll("-", ". ")}.</span>${t.username ? `<span>${esc(t.username)}</span>` : ""}${t.description ? `<span>${esc(t.description)}</span>` : ""}</small></div>
    <span class="amt ${t.type}">${sign} ${huf(t.amount)}</span>
    <div class="row-actions"><button class="btn sm" data-act="editTx" data-id="${t.transId}">Módosítás</button><button class="btn sm" data-act="delTx" data-id="${t.transId}">Törlés</button></div>
  </li>`;
}

/* ---------- gombok (eseménydelegálás) ---------- */
const actions = {
  logout: logOut,
  txCancel: () => txDialog.close(),
  newTx: b => openTx(null, b.dataset.date),
  editTx: b => openTx(txs.find(t => String(t.transId) === b.dataset.id)),
  async delTx(b) {
    if (!(await confirmBox("Biztosan törlöd ezt a tételt?"))) return;
    const r = await api("/api/transaction", "DELETE", { transId: Number(b.dataset.id) });
    if (!r.ok) return toast(r.data.message || "Nem sikerült törölni.", true);
    toast("Tétel törölve");
    await loadCore(); onTxSaved();
  },
  async copyId(b) {
    try { await navigator.clipboard.writeText(b.dataset.id); toast("Azonosító másolva"); } catch { toast("Nem sikerült másolni.", true); }
  },
  async editFamily() {
    const name = await promptBox("Család módosítása", "Család neve", fam.family.familyName);
    if (!name) return;
    const r = await api("/api/family", "PUT", { familyId: fam.family.familyId, familyName: name });
    if (!r.ok) return toast(r.data.message, true);
    toast("Család módosítva"); await loadCore(); pages.family();
  },
  async delFamily() {
    if (!(await confirmBox("Biztosan törlöd a családot?", "Család törlése"))) return;
    const r = await api("/api/family", "DELETE", { familyId: fam.family.familyId });
    if (!r.ok) return toast(r.data.message, true);
    toast("Család törölve"); await loadCore(); pages.family();
  },
  async leaveFamily() {
    if (!(await confirmBox("Biztosan kilépsz a családból?", "Kilépés"))) return;
    const r = await api("/api/member", "DELETE", { familyId: me.familyId });
    if (!r.ok) return toast(r.data.message, true);
    toast("Kiléptél a családból"); await loadCore(); pages.family();
  }
};
document.addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (b && actions[b.dataset.act]) actions[b.dataset.act](b);
});

/* ---------- oldalak ---------- */
const pages = {};

pages.login = () => authForm("/api/login", () => ({
  username: $("#username").value, password: $("#password").value
}), data => { localStorage.setItem("token", data.token); location.href = "/dashboard"; });

pages.register = () => authForm("/api/register", () => ({
  username: $("#username").value, email: $("#email").value,
  password: $("#password").value, password_again: $("#password_again").value
}), () => { location.href = "/login"; });

function authForm(url, getBody, onOk) {
  if (token) { location.href = "/dashboard"; return; }
  const form = $("#authForm"), err = $("#errorMsg");
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("button", form);
    btn.disabled = true; err.textContent = "";
    form.querySelectorAll("input").forEach(i => i.classList.remove("input-error"));
    const r = await api(url, "POST", getBody());
    btn.disabled = false;
    if (r.ok && r.data.text !== undefined) {
      const t = r.data.text.trim();
      if (t === "siker") return onOk(r.data);
      const M = { "foglalt username": ["USERNAME_TAKEN", "Ez a felhasználónév már foglalt."], "foglalt email": ["EMAIL_TAKEN", "Ez az email cím már foglalt."], "A jelszavak nem egyeznek": ["PASSWORD_MISMATCH", "A jelszavak nem egyeznek."] };
      r.ok = false; r.data = { code: M[t]?.[0], message: M[t]?.[1] || t };
    }
    if (!r.ok) {
      err.textContent = r.data.message || "Valami hiba történt.";
      const bad = { INVALID_CREDENTIALS: ["username", "password"], USERNAME_TAKEN: ["username"], EMAIL_TAKEN: ["email"], PASSWORD_MISMATCH: ["password", "password_again"] }[r.data.code] || [];
      bad.forEach(id => $("#" + id).classList.add("input-error"));
      return;
    }
    onOk(r.data);
  });
}

pages.dashboard = () => {
  const view = $("#view");
  $("#sub").textContent = fam.family ? fam.family.familyName : "";
  if (!fam.family) { view.innerHTML = noFamily(); return; }
  $("#actions").innerHTML = `<button class="btn primary" data-act="newTx">Új tétel</button>`;

  const now = new Date(), key = ym(now.getFullYear(), now.getMonth());
  const month = txs.filter(t => dayOf(t).startsWith(key));
  const inc = sum(month, "income"), exp = sum(month, "expense");
  const balance = sum(txs, "income") - sum(txs, "expense");
  const pct = inc + exp ? Math.round(inc / (inc + exp) * 100) : 0;

  // utolsó 6 hónap
  const series = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1), k = ym(d.getFullYear(), d.getMonth());
    const l = txs.filter(t => dayOf(t).startsWith(k));
    series.push({ label: MONTHS[d.getMonth()].slice(0, 3), inc: sum(l, "income"), exp: sum(l, "expense") });
  }
  const max = Math.max(1, ...series.flatMap(s => [s.inc, s.exp]));
  const bars = series.map((s, i) => {
    const x = 20 + i * 90, hi = s.inc / max * 150, he = s.exp / max * 150;
    return `<rect class="bi" x="${x}" y="${170 - hi}" width="28" height="${hi}" rx="4"><title>Bevétel: ${huf(s.inc)}</title></rect>
      <rect class="be" x="${x + 32}" y="${170 - he}" width="28" height="${he}" rx="4"><title>Kiadás: ${huf(s.exp)}</title></rect>
      <text x="${x + 30}" y="192" text-anchor="middle">${s.label}</text>`;
  }).join("");

  // legnagyobb kiadások a hónapban
  const groups = {};
  month.filter(t => t.type === "expense").forEach(t => { const k = t.title.trim().toLowerCase(); groups[k] = groups[k] || { title: t.title, sum: 0 }; groups[k].sum += t.amount; });
  const top = Object.values(groups).sort((a, b) => b.sum - a.sum).slice(0, 5);

  view.innerHTML = `<div class="grid">
    <section class="card hero"><div><small>Közös egyenleg</small><div class="big">${huf(balance)}</div></div>
      <div><small>${MONTHS[now.getMonth()]} hónap</small><div class="split" role="img" aria-label="Bevétel és kiadás aránya"><span style="width:${pct}%"></span></div>
      <div class="split-legend"><span class="income">+ ${huf(inc)}</span><span class="expense">− ${huf(exp)}</span></div></div></section>
    <div class="grid g-wide">
      <section class="card"><h2>Az elmúlt 6 hónap</h2>
        <svg class="chart" viewBox="0 0 560 205" role="img" aria-label="Havi bevételek és kiadások"><line x1="10" x2="550" y1="170" y2="170"/>${bars}</svg>
        <div class="legend"><span><i style="background:var(--income)"></i>Bevétel</span><span><i style="background:var(--expense)"></i>Kiadás</span></div></section>
      <section class="card"><h2>Legnagyobb kiadások</h2>
        ${top.length ? `<div class="bars">${top.map(t => `<div><span><span>${esc(t.title)}</span><b>${huf(t.sum)}</b></span><i style="width:${Math.max(4, t.sum / top[0].sum * 100)}%"></i></div>`).join("")}</div>` : `<p class="muted">Ebben a hónapban még nincs kiadás.</p>`}</section>
    </div>
    <section class="card"><h2>Legutóbbi tételek</h2>
      ${txs.length ? `<ul class="list">${txs.slice(0, 5).map(txRow).join("")}</ul>` : `<p class="muted">Még nincs rögzített tétel. Az „Új tétel” gombbal kezdheted.</p>`}</section></div>`;
};

pages.transactions = () => {
  const view = $("#view");
  if (!fam.family) { $("#actions").innerHTML = ""; view.innerHTML = noFamily(); return; }
  $("#actions").innerHTML = `<button class="btn primary" data-act="newTx">Új tétel</button>`;
  const months = [...new Set(txs.map(t => dayOf(t).slice(0, 7)))];
  const state = pages.transactions.state = pages.transactions.state || { type: "all", month: "all" };
  if (state.month !== "all" && !months.includes(state.month)) state.month = "all";

  view.innerHTML = `<div class="toolbar">
      <div class="seg" role="radiogroup" aria-label="Szűrés típus szerint">
        ${[["all", "Mind"], ["income", "Bevétel"], ["expense", "Kiadás"]].map(([v, l]) => `<label><input type="radio" name="ftype" value="${v}" ${state.type === v ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>
      <label class="sr" for="fMonth">Hónap</label>
      <select id="fMonth"><option value="all">Minden hónap</option>${months.map(m => `<option value="${m}" ${state.month === m ? "selected" : ""}>${m.slice(0, 4)}. ${MONTHS[Number(m.slice(5)) - 1]}</option>`).join("")}</select></div>
    <div class="grid g3" id="sums"></div>
    <section class="card" style="margin-top:1rem"><ul class="list" id="txList"></ul></section>`;

  const draw = () => {
    const l = txs.filter(t => (state.type === "all" || t.type === state.type) && (state.month === "all" || dayOf(t).startsWith(state.month)));
    const i = sum(l, "income"), e = sum(l, "expense");
    $("#sums").innerHTML = `<div class="card stat"><small>Bevétel</small><strong class="income">${huf(i)}</strong></div>
      <div class="card stat"><small>Kiadás</small><strong class="expense">${huf(e)}</strong></div>
      <div class="card stat"><small>Különbség</small><strong>${huf(i - e)}</strong></div>`;
    $("#txList").innerHTML = l.length ? l.map(txRow).join("") : `<li class="empty"><p>Nincs a szűrésnek megfelelő tétel.</p></li>`;
  };
  view.querySelectorAll('input[name="ftype"]').forEach(r => r.addEventListener("change", () => { state.type = r.value; draw(); }));
  $("#fMonth").addEventListener("change", e => { state.month = e.target.value; draw(); });
  draw();
};

pages.calendar = () => {
  const view = $("#view");
  if (!fam.family) { view.innerHTML = noFamily(); return; }
  const st = pages.calendar.st = pages.calendar.st || { y: new Date().getFullYear(), m: new Date().getMonth(), sel: ymd(new Date()) };
  const today = ymd(new Date());

  const draw = () => {
    const first = new Date(st.y, st.m, 1), days = new Date(st.y, st.m + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // hétfő az első nap
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(`<div class="day off" aria-hidden="true"></div>`);
    for (let d = 1; d <= days; d++) {
      const key = `${ym(st.y, st.m)}-${pad(d)}`, l = txs.filter(t => dayOf(t) === key);
      const i = sum(l, "income"), e = sum(l, "expense");
      cells.push(`<button class="day${key === today ? " today" : ""}${key === st.sel ? " sel" : ""}" data-act="pickDay" data-date="${key}" aria-label="${st.y}. ${MONTHS[st.m]} ${d}.">
        <b>${d}</b>${i ? `<span class="i">+${short(i)}</span>` : ""}${e ? `<span class="e">−${short(e)}</span>` : ""}</button>`);
    }
    const selList = txs.filter(t => dayOf(t) === st.sel);
    view.innerHTML = `<div class="grid g-wide">
      <section class="card"><div class="cal-head"><button class="btn sm" data-act="calPrev" aria-label="Előző hónap">‹</button>
        <h2>${st.y}. ${MONTHS[st.m]}</h2><button class="btn sm" data-act="calNext" aria-label="Következő hónap">›</button></div>
        <div class="cal">${["H", "K", "Sze", "Cs", "P", "Szo", "V"].map(n => `<div class="dow">${n}</div>`).join("")}${cells.join("")}</div></section>
      <section class="card"><h2>${st.sel.replaceAll("-", ". ")}.</h2>
        ${selList.length ? `<ul class="list">${selList.map(txRow).join("")}</ul>` : `<p class="muted" style="margin-bottom:1rem">Ezen a napon nincs tétel.</p>`}
        <button class="btn primary" data-act="newTx" style="margin-top:1rem">Új tétel</button><p class="muted" style="margin-top:.5rem;font-size:.85rem">Az új tétel a rögzítés napjára kerül.</p></section></div>`;
  };
  actions.pickDay = b => { st.sel = b.dataset.date; draw(); };
  actions.calPrev = () => { st.m--; if (st.m < 0) { st.m = 11; st.y--; } draw(); };
  actions.calNext = () => { st.m++; if (st.m > 11) { st.m = 0; st.y++; } draw(); };
  draw();
};

pages.family = () => {
  const view = $("#view"), f = fam.family;
  if (!f && me.familyId) {
    view.innerHTML = `<div class="card empty"><h2>A családod már nem létezik</h2><p>A tulajdonos törölte. Lépj ki, utána újat hozhatsz létre vagy csatlakozhatsz máshoz.</p><button class="btn primary" data-act="leaveFamily">Kilépés</button></div>`;
    return;
  }
  if (!f) {
    view.innerHTML = `<div class="grid g2">
      <section class="card"><h2>Új család létrehozása</h2><form id="createForm" class="grid">
        <label>Család neve<input id="newName" required maxlength="255" placeholder="pl. Kovács család"></label>
        <p class="err" id="createErr"></p><button class="btn primary">Család létrehozása</button></form></section>
      <section class="card"><h2>Csatlakozás meglévő családhoz</h2><form id="joinForm" class="grid">
        <label>Család azonosítója<input id="joinId" type="number" required placeholder="5 jegyű szám"></label>
        <p class="err" id="joinErr"></p><button class="btn">Csatlakozás</button></form></section></div>`;
    $("#createForm").addEventListener("submit", async e => {
      e.preventDefault();
      const r = await api("/api/family", "POST", { familyName: $("#newName").value });
      if (!r.ok) { $("#createErr").textContent = r.data.message; return; }
      if (!r.data.familyId) { $("#createErr").textContent = "A család létrejött, de a szerver nem adta vissza az azonosítóját, ezért nem tudtam belépni (backend hiba). Az azonosítót az adatbázis families táblájában találod, azzal a Csatlakozás űrlapon beléphetsz."; return; }
      const j = await api("/api/member", "POST", { familyId: Number(r.data.familyId) });
      if (!j.ok) { $("#createErr").textContent = j.data.message; return; }
      toast("Család létrehozva"); await loadCore(); pages.family();
    });
    $("#joinForm").addEventListener("submit", async e => {
      e.preventDefault();
      const r = await api("/api/member", "POST", { familyId: Number($("#joinId").value) });
      if (!r.ok) { $("#joinErr").textContent = r.data.message; return; }
      await loadCore();
      if (!fam.family) { await api("/api/member", "DELETE", { familyId: Number($("#joinId").value) }); await loadCore(); $("#joinErr").textContent = "Nincs ilyen azonosítójú család."; return; }
      toast("Csatlakoztál a családhoz"); pages.family();
    });
    return;
  }
  const owner = String(f.ownerId) === String(me.id);
  view.innerHTML = `<div class="grid g-wide">
    <section class="card"><h2>${esc(f.familyName)}</h2>
      <p class="muted">Azonosító, amivel mások csatlakozhatnak:</p>
      <p class="famid">${f.familyId} <button class="btn sm" data-act="copyId" data-id="${f.familyId}">Másolás</button></p>
      <div class="actions" style="justify-content:flex-start;margin-top:1.25rem">
        ${owner ? `<button class="btn" data-act="editFamily">Módosítás</button><button class="btn danger" data-act="delFamily">Törlés</button>`
                : `<button class="btn" data-act="leaveFamily">Kilépés a családból</button>`}</div></section>
    <section class="card"><h2>Tagok (${fam.members.length})</h2><div class="members">
      ${fam.members.map(m => `<div class="member"><span class="avatar">${esc(m.username[0].toUpperCase())}</span>
        <div><b>${esc(m.username)}</b><div class="muted" style="font-size:.85rem">${esc(m.email)}</div></div>
        ${m.owner ? `<span class="badge" style="margin-left:auto">tulajdonos</span>` : ""}</div>`).join("")}</div></section></div>`;
};

/* ---------- indítás ---------- */
(async function init() {
  if (!PROTECTED) { pages[page]?.(); return; }
  if (!token) { location.href = "/login"; return; }
  await loadCore();
  if (!me) return;
  renderSidebar();
  initTxDialog();
  onTxSaved = () => pages[page]();
  pages[page]();
})();
