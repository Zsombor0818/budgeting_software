/* Közös Kassza – közös frontend logika */

const pages = {};

const $ = (s, r = document) => r.querySelector(s);

const token = localStorage.getItem("token");
const page = document.body.dataset.page;
const PROTECTED = document.body.hasAttribute("data-auth");

const MONTHS = [
    "január", "február", "március", "április", "május", "június",
    "július", "augusztus", "szeptember", "október", "november", "december"
];

const pad = n => String(n).padStart(2, "0");

const ymd = d =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const ym = (y, m) =>
    `${y}-${pad(m + 1)}`;

const esc = s =>
    String(s ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));

const huf = n =>
    new Intl.NumberFormat("hu-HU").format(Math.round(n)) + " Ft";

const short = n =>
    n >= 1000 ? Math.round(n / 1000) + "e" : String(n);

const dayOf = value => {
    const d = new Date(value);

    if (isNaN(d)) {
        return String(value).slice(0, 10);
    }

    return ymd(d);
};

const sum = (list, type) =>
    list
        .filter(x => x.type === type)
        .reduce((total, x) => total + Number(x.amount), 0);


/* ---------- ikonok ---------- */

const ICONS = {
    home:
        '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',

    swap:
        '<path d="M7 4l-4 4 4 4"/><path d="M3 8h14"/>' +
        '<path d="M17 20l4-4-4-4"/><path d="M21 16H7"/>',

    cal:
        '<rect x="3" y="5" width="18" height="16" rx="2"/>' +
        '<path d="M3 10h18M8 3v4M16 3v4"/>',

    users:
        '<circle cx="9" cy="8" r="3.5"/>' +
        '<path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/>' +
        '<path d="M16 4.5a3.5 3.5 0 010 7M18 14c2.5.6 4 2.6 4 6"/>',

    out:
        '<path d="M9 4H5v16h4"/>' +
        '<path d="M16 8l4 4-4 4M20 12H9"/>',

    wallet:
        '<path d="M4 7h14a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"/>' +
        '<path d="M4 7l11-3v3"/>'
};

const icon = name =>
    `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

const BRAND =
    `<div class="brand"><i>${icon("wallet")}</i>Közös Kassza</div>`;


/* ---------- általános ---------- */

function logOut() {
    localStorage.removeItem("token");
    location.href = "/login";
}

async function api(url, method = "GET", body) {
    const headers = {};

    if (body) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    let res;

    try {
        res = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });
    } catch {
        return {
            ok: false,
            status: 0,
            data: {
                message: "A szerver nem érhető el."
            }
        };
    }

    const raw = await res.text();

    let data;

    try {
        data = JSON.parse(raw);
    } catch {
        data = {
            text: raw
        };
    }

    if (res.status === 401 && PROTECTED) {
        logOut();
    }

    if (!res.ok && !data.message) {
        data.message = `Szerverhiba (${res.status}).`;
    }

    return {
        ok: res.ok,
        status: res.status,
        data
    };
}

function toast(message, bad = false) {
    let box = $(".toasts");

    if (!box) {
        box = document.createElement("div");
        box.className = "toasts";
        box.setAttribute("role", "status");
        document.body.append(box);
    }

    const t = document.createElement("div");

    t.className = "toast" + (bad ? " bad" : "");
    t.textContent = message;

    box.append(t);

    setTimeout(() => t.remove(), 3500);
}

function confirmBox(title, okLabel = "Törlés") {
    return new Promise(resolve => {
        const d = document.createElement("dialog");

        d.innerHTML = `
            <form method="dialog">
                <h2>${esc(title)}</h2>

                <div class="actions">
                    <button class="btn ghost" value="no">
                        Mégse
                    </button>

                    <button class="btn danger" value="yes">
                        ${esc(okLabel)}
                    </button>
                </div>
            </form>
        `;

        d.addEventListener("close", () => {
            resolve(d.returnValue === "yes");
            d.remove();
        });

        document.body.append(d);
        d.showModal();
    });
}

function promptBox(title, label, value = "") {
    return new Promise(resolve => {
        const d = document.createElement("dialog");

        d.innerHTML = `
            <form method="dialog">
                <h2>${esc(title)}</h2>

                <label>
                    ${esc(label)}

                    <input
                        required
                        maxlength="255"
                        value="${esc(value)}"
                    >
                </label>

                <div class="actions">
                    <button
                        class="btn ghost"
                        value="no"
                        formnovalidate
                    >
                        Mégse
                    </button>

                    <button class="btn primary" value="yes">
                        Mentés
                    </button>
                </div>
            </form>
        `;

        d.addEventListener("close", () => {
            resolve(
                d.returnValue === "yes"
                    ? $("input", d).value.trim()
                    : null
            );

            d.remove();
        });

        document.body.append(d);
        d.showModal();
    });
}


/* ---------- állapot ---------- */

let me = null;

let fam = {
    family: null,
    members: []
};

let txs = [];
let events = [];


/* ---------- adatok betöltése ---------- */

async function loadCore() {
    const user = await api("/api/user");

    me = user.data.user;

    fam = {
        family: null,
        members: []
    };

    txs = [];
    events = [];

    if (!me || !me.familyId) {
        return;
    }

    const family = await api("/api/family");

    if (family.ok && family.data.family) {
        fam = family.data;
    }

    if (!fam.family) {
        return;
    }

    const transactions = await api("/api/transactions");

    if (transactions.ok && Array.isArray(transactions.data)) {
        txs = transactions.data.sort(
            (a, b) =>
                new Date(b.date) - new Date(a.date) ||
                b.transId - a.transId
        );
    }

    const calendar = await api("/calendar");

    if (calendar.ok) {
        if (Array.isArray(calendar.data)) {
            events = calendar.data;
        } else if (Array.isArray(calendar.data?.events)) {
            events = calendar.data.events;
        }
    }
}


/* ---------- sidebar ---------- */

function renderSidebar() {
    const links = [
        ["/dashboard", "home", "Főoldal"],
        ["/transactions.html", "swap", "Bevétel / Kiadás"],
        ["/calendar.html", "cal", "Naptár"],
        ["/family.html", "users", "Család"]
    ];

    $("#side").innerHTML = `
        ${BRAND}

        <nav class="nav" aria-label="Főmenü">

            ${links.map(([href, iconName, title]) => `
                <a
                    href="${href}"
                    ${location.pathname === href
                        ? 'aria-current="page"'
                        : ""}
                >
                    ${icon(iconName)}
                    <span>${title}</span>
                </a>
            `).join("")}

            <button data-act="logout">
                ${icon("out")}
                <span>Kijelentkezés</span>
            </button>

        </nav>

        <div class="who">
            <b>${esc(me.username)}</b>
            ${esc(me.email)}
        </div>
    `;
}

function noFamily() {
    return `
        <div class="card empty">
            <h2>Még nincs családod</h2>

            <p>
                A költségek és bevételek családon belül közösek.
                Hozz létre egyet, vagy csatlakozz egy meglévőhöz.
            </p>

            <a class="btn primary" href="/family.html">
                Család beállítása
            </a>
        </div>
    `;
}


/* =========================================================
   TRANZAKCIÓK
   ========================================================= */

let txDialog = null;
let editingId = null;
let onTxSaved = () => {};


/* ---------- tranzakciós ablak ---------- */

function initTxDialog() {
    txDialog = document.createElement("dialog");

    txDialog.innerHTML = `
        <form id="txForm">

            <h2 id="txHeading"></h2>

            <div class="seg">

                <label>
                    <input
                        type="radio"
                        name="type"
                        value="expense"
                        checked
                    >

                    <span>Kiadás</span>
                </label>

                <label>
                    <input
                        type="radio"
                        name="type"
                        value="income"
                    >

                    <span>Bevétel</span>
                </label>

            </div>

            <label>
                Megnevezés

                <input
                    name="title"
                    required
                    maxlength="255"
                >
            </label>

            <label>
                Összeg (Ft)

                <input
                    name="amount"
                    type="number"
                    min="1"
                    step="1"
                    required
                >
            </label>

            <p
                class="muted"
                id="txNote"
                style="font-size:.85rem"
            ></p>

            <label>
                Megjegyzés

                <input
                    name="description"
                    maxlength="255"
                >
            </label>

            <p class="err" id="txErr"></p>

            <div class="actions">

                <button
                    type="button"
                    class="btn ghost"
                    data-act="txCancel"
                >
                    Mégse
                </button>

                <button class="btn primary">
                    Mentés
                </button>

            </div>

        </form>
    `;

    document.body.append(txDialog);

    $("#txForm").addEventListener(
        "submit",
        saveTransaction
    );
}

async function saveTransaction(e) {
    e.preventDefault();

    const form = new FormData(e.target);

    const body = Object.fromEntries(form.entries());

    body.amount = Number(body.amount);
    body.description = body.description || "";

    if (editingId) {
        body.transId = editingId;
    }

    const result = await api(
        "/api/transaction",
        editingId ? "PUT" : "POST",
        body
    );

    if (!result.ok) {
        $("#txErr").textContent =
            result.data.message ||
            "Nem sikerült menteni.";

        return;
    }

    txDialog.close();

    toast(
        editingId
            ? "Tétel módosítva"
            : "Tétel hozzáadva"
    );

    await loadCore();

    onTxSaved();
}

function openTx(tx) {
    editingId = tx ? tx.transId : null;

    const form = $("#txForm");

    $("#txHeading").textContent =
        tx ? "Tétel módosítása" : "Új tétel";

    form.type.value =
        tx ? tx.type : "expense";

    form.title.value =
        tx ? tx.title : "";

    form.amount.value =
        tx ? tx.amount : "";

    form.description.value =
        tx ? tx.description || "" : "";

    form.querySelectorAll('[name="type"]')
        .forEach(radio => {
            radio.disabled = !!tx;
        });

    $("#txNote").textContent = tx
        ? "A típus és a dátum utólag nem módosítható."
        : "A tétel a mentés napjával kerül rögzítésre.";

    $("#txErr").textContent = "";

    txDialog.showModal();

    form.title.focus();
}

function txRow(t) {
    const sign =
        t.type === "income"
            ? "+"
            : "−";

    return `
        <li class="tx">

            <span
                class="dot ${t.type}"
                aria-hidden="true"
            >
                ${sign}
            </span>

            <div class="tx-main">

                <strong>
                    ${esc(t.title)}
                </strong>

                <small>

                    <span>
                        ${dayOf(t.date).replaceAll("-", ". ")}.
                    </span>

                    ${t.username
                        ? `<span>${esc(t.username)}</span>`
                        : ""}

                    ${t.description
                        ? `<span>${esc(t.description)}</span>`
                        : ""}

                </small>

            </div>

            <span class="amt ${t.type}">
                ${sign} ${huf(t.amount)}
            </span>

            <div class="row-actions">

                <button
                    class="btn sm"
                    data-act="editTx"
                    data-id="${t.transId}"
                >
                    Módosítás
                </button>

                <button
                    class="btn sm"
                    data-act="delTx"
                    data-id="${t.transId}"
                >
                    Törlés
                </button>

            </div>

        </li>
    `;
}


/* =========================================================
   NAPTÁR ESEMÉNYEK
   ========================================================= */

let eventDialog = null;
let editingEventId = null;
let onEventSaved = () => {};


/* ---------- esemény ablak ---------- */

function initEventDialog() {
    eventDialog = document.createElement("dialog");

    eventDialog.innerHTML = `
        <form id="eventForm">

            <h2 id="eventHeading">
                Új esemény
            </h2>

            <label>
                Esemény neve

                <input
                    name="title"
                    required
                    maxlength="255"
                >
            </label>

            <label>
                Dátum

                <input
                    name="date"
                    type="date"
                    required
                >
            </label>

            <label>
                Megjegyzés

                <input
                    name="description"
                    maxlength="255"
                >
            </label>

            <p class="err" id="eventErr"></p>

            <div class="actions">

                <button
                    type="button"
                    class="btn ghost"
                    data-act="eventCancel"
                >
                    Mégse
                </button>

                <button class="btn primary">
                    Mentés
                </button>

            </div>

        </form>
    `;

    document.body.append(eventDialog);

    $("#eventForm").addEventListener(
        "submit",
        saveEvent
    );
}

async function saveEvent(e) {
    e.preventDefault();

    const form = new FormData(e.target);

    const body = {
        title: form.get("title").trim(),
        date: form.get("date"),
        description: form.get("description").trim()
    };

    if (editingEventId) {
        body.eventId = editingEventId;
    }

    const result = await api(
        "/calendar",
        editingEventId ? "PUT" : "POST",
        body
    );

    if (!result.ok) {
        $("#eventErr").textContent =
            result.data.message ||
            "Nem sikerült menteni.";

        return;
    }

    eventDialog.close();

    toast(
        editingEventId
            ? "Esemény módosítva"
            : "Esemény hozzáadva"
    );

    await loadCore();

    onEventSaved();
}

function openEvent(event = null, date = "") {
    editingEventId =
        event ? event.eventId : null;

    const form = $("#eventForm");

    $("#eventHeading").textContent =
        event
            ? "Esemény módosítása"
            : "Új esemény";

    form.title.value =
        event ? event.title : "";

    form.date.value =
        event
            ? dayOf(event.date)
            : date || ymd(new Date());

    form.description.value =
        event
            ? event.description || ""
            : "";

    $("#eventErr").textContent = "";

    eventDialog.showModal();

    form.title.focus();
}

function eventRow(event) {
    return `
        <li class="tx">

            <span
                class="dot"
                aria-hidden="true"
            >
                •
            </span>

            <div class="tx-main">

                <strong>
                    ${esc(event.title)}
                </strong>

                <small>

                    <span>
                        ${dayOf(event.date).replaceAll("-", ". ")}.
                    </span>

                    ${event.username
                        ? `<span>${esc(event.username)}</span>`
                        : ""}

                    ${event.description
                        ? `<span>${esc(event.description)}</span>`
                        : ""}

                </small>

            </div>

            <div class="row-actions">

                <button
                    class="btn sm"
                    data-act="editEvent"
                    data-id="${event.eventId}"
                >
                    Módosítás
                </button>

                <button
                    class="btn sm"
                    data-act="delEvent"
                    data-id="${event.eventId}"
                >
                    Törlés
                </button>

            </div>

        </li>
    `;
}


/* =========================================================
   GOMBOK
   ========================================================= */

const actions = {

    logout: logOut,

    txCancel: () => {
        txDialog.close();
    },

    eventCancel: () => {
        eventDialog.close();
    },

    newTx: () => {
        openTx();
    },

    editTx: button => {
        const tx = txs.find(
            t => String(t.transId) === button.dataset.id
        );

        if (tx) {
            openTx(tx);
        }
    },

    async delTx(button) {
        if (
            !(await confirmBox(
                "Biztosan törlöd ezt a tételt?"
            ))
        ) {
            return;
        }

        const result = await api(
            "/api/transaction",
            "DELETE",
            {
                transId: Number(button.dataset.id)
            }
        );

        if (!result.ok) {
            toast(
                result.data.message ||
                "Nem sikerült törölni.",
                true
            );

            return;
        }

        toast("Tétel törölve");

        await loadCore();

        onTxSaved();
    },

    newEvent: button => {
        openEvent(
            null,
            button.dataset.date
        );
    },

    editEvent: button => {
        const event = events.find(
            e =>
                String(e.eventId) ===
                button.dataset.id
        );

        if (event) {
            openEvent(event);
        }
    },

    async delEvent(button) {
        if (
            !(await confirmBox(
                "Biztosan törlöd ezt az eseményt?"
            ))
        ) {
            return;
        }

        const result = await api(
            "/calendar",
            "DELETE",
            {
                eventId: Number(button.dataset.id)
            }
        );

        if (!result.ok) {
            toast(
                result.data.message ||
                "Nem sikerült törölni.",
                true
            );

            return;
        }

        toast("Esemény törölve");

        await loadCore();

        onEventSaved();
    },

    async copyId(button) {
        try {
            await navigator.clipboard.writeText(
                button.dataset.id
            );

            toast("Azonosító másolva");

        } catch {
            toast(
                "Nem sikerült másolni.",
                true
            );
        }
    },

    async editFamily() {
        const name = await promptBox(
            "Család módosítása",
            "Család neve",
            fam.family.familyName
        );

        if (!name) {
            return;
        }

        const result = await api(
            "/api/family",
            "PUT",
            {
                familyId: fam.family.familyId,
                familyName: name
            }
        );

        if (!result.ok) {
            toast(
                result.data.message,
                true
            );

            return;
        }

        toast("Család módosítva");

        await loadCore();

        pages.family();
    },

    async delFamily() {
        if (
            !(await confirmBox(
                "Biztosan törlöd a családot?",
                "Család törlése"
            ))
        ) {
            return;
        }

        const result = await api(
            "/api/family",
            "DELETE",
            {
                familyId: fam.family.familyId
            }
        );

        if (!result.ok) {
            toast(
                result.data.message,
                true
            );

            return;
        }

        toast("Család törölve");

        await loadCore();

        pages.family();
    },

    async leaveFamily() {
        if (
            !(await confirmBox(
                "Biztosan kilépsz a családból?",
                "Kilépés"
            ))
        ) {
            return;
        }

        const result = await api(
            "/api/member",
            "DELETE",
            {
                familyId: me.familyId
            }
        );

        if (!result.ok) {
            toast(
                result.data.message,
                true
            );

            return;
        }

        toast("Kiléptél a családból");

        await loadCore();

        pages.family();
    }
};


document.addEventListener("click", e => {
    const button =
        e.target.closest("[data-act]");

    if (!button) {
        return;
    }

    const action =
        actions[button.dataset.act];

    if (action) {
        action(button);
    }
});


/* =========================================================
   LOGIN / REGISZTRÁCIÓ
   ========================================================= */

pages.login = () =>
    authForm(
        "/api/login",

        () => ({
            username: $("#username").value,
            password: $("#password").value
        }),

        data => {
            localStorage.setItem(
                "token",
                data.token
            );

            location.href = "/dashboard";
        }
    );

pages.register = () =>
    authForm(
        "/api/register",

        () => ({
            username: $("#username").value,
            email: $("#email").value,
            password: $("#password").value,
            password_again:
                $("#password_again").value
        }),

        () => {
            location.href = "/login";
        }
    );

function authForm(url, getBody, onOk) {
    if (token) {
        location.href = "/dashboard";
        return;
    }

    const form = $("#authForm");
    const error = $("#errorMsg");

    form.addEventListener(
        "submit",
        async e => {
            e.preventDefault();

            const button = $("button", form);

            button.disabled = true;
            error.textContent = "";

            form
                .querySelectorAll("input")
                .forEach(input =>
                    input.classList.remove(
                        "input-error"
                    )
                );

            const result = await api(
                url,
                "POST",
                getBody()
            );

            button.disabled = false;

            if (
                result.ok &&
                result.data.text !== undefined
            ) {
                const text =
                    result.data.text.trim();

                if (text === "siker") {
                    onOk(result.data);
                    return;
                }

                const messages = {
                    "foglalt username": [
                        "USERNAME_TAKEN",
                        "Ez a felhasználónév már foglalt."
                    ],

                    "foglalt email": [
                        "EMAIL_TAKEN",
                        "Ez az email cím már foglalt."
                    ],

                    "A jelszavak nem egyeznek": [
                        "PASSWORD_MISMATCH",
                        "A jelszavak nem egyeznek."
                    ]
                };

                result.ok = false;

                result.data = {
                    code:
                        messages[result.data.text]?.[0],

                    message:
                        messages[result.data.text]?.[1] ||
                        result.data.text
                };
            }

            if (!result.ok) {
                error.textContent =
                    result.data.message ||
                    "Valami hiba történt.";

                const fields = {
                    INVALID_CREDENTIALS: [
                        "username",
                        "password"
                    ],

                    USERNAME_TAKEN: [
                        "username"
                    ],

                    EMAIL_TAKEN: [
                        "email"
                    ],

                    PASSWORD_MISMATCH: [
                        "password",
                        "password_again"
                    ]
                }[result.data.code] || [];

                fields.forEach(id => {
                    $("#" + id)?.classList.add(
                        "input-error"
                    );
                });

                return;
            }

            onOk(result.data);
        }
    );
}


/* =========================================================
   DASHBOARD
   ========================================================= */

pages.dashboard = () => {
    const view = $("#view");

    $("#sub").textContent =
        fam.family
            ? fam.family.familyName
            : "";

    if (!fam.family) {
        view.innerHTML = noFamily();
        return;
    }

    $("#actions").innerHTML = `
        <button
            class="btn primary"
            data-act="newTx"
        >
            Új tétel
        </button>
    `;

    const now = new Date();

    const key = ym(
        now.getFullYear(),
        now.getMonth()
    );

    /* aktuális hónap */

    const month = txs.filter(
        t => dayOf(t.date).startsWith(key)
    );

    const income = sum(
        month,
        "income"
    );

    const expense = sum(
        month,
        "expense"
    );

    const balance =
        sum(txs, "income") -
        sum(txs, "expense");

    const percent =
        income + expense
            ? Math.round(
                income /
                (income + expense) *
                100
            )
            : 0;


    /* ---------- diagram állapota ---------- */

    const chartState =
        pages.dashboard.chartState ||= {
            offset: 0
        };


    /* ---------- 6 hónapos diagram ---------- */

    const series = [];

    for (let i = 5; i >= 0; i--) {
        const d = new Date(
            now.getFullYear(),
            now.getMonth() -
                i -
                chartState.offset,
            1
        );

        const monthKey = ym(
            d.getFullYear(),
            d.getMonth()
        );

        const list = txs.filter(
            t =>
                dayOf(t.date)
                    .startsWith(monthKey)
        );

        series.push({
            label:
                MONTHS[d.getMonth()]
                    .slice(0, 3),

            income:
                sum(list, "income"),

            expense:
                sum(list, "expense")
        });
    }

    const max = Math.max(
        1,
        ...series.flatMap(s => [
            s.income,
            s.expense
        ])
    );

    const bars = series
        .map((s, i) => {
            const x = 20 + i * 90;

            const hi =
                s.income / max * 150;

            const he =
                s.expense / max * 150;

            return `
                <rect
                    class="bi"
                    x="${x}"
                    y="${170 - hi}"
                    width="28"
                    height="${hi}"
                    rx="4"
                >
                    <title>
                        Bevétel: ${huf(s.income)}
                    </title>
                </rect>

                <rect
                    class="be"
                    x="${x + 32}"
                    y="${170 - he}"
                    width="28"
                    height="${he}"
                    rx="4"
                >
                    <title>
                        Kiadás: ${huf(s.expense)}
                    </title>
                </rect>

                <text
                    x="${x + 30}"
                    y="192"
                    text-anchor="middle"
                >
                    ${s.label}
                </text>
            `;
        })
        .join("");


    /* ---------- legnagyobb kiadások ---------- */

    const groups = {};

    month
        .filter(t => t.type === "expense")
        .forEach(t => {
            const groupKey =
                t.title.trim().toLowerCase();

            if (!groups[groupKey]) {
                groups[groupKey] = {
                    title: t.title,
                    sum: 0
                };
            }

            groups[groupKey].sum +=
                Number(t.amount);
        });

    const top =
        Object.values(groups)
            .sort(
                (a, b) =>
                    b.sum - a.sum
            )
            .slice(0, 5);


    /* ---------- HTML ---------- */

    view.innerHTML = `
        <div class="grid">

            <section class="card hero">

                <div>
                    <small>
                        Közös egyenleg
                    </small>

                    <div class="big">
                        ${huf(balance)}
                    </div>
                </div>

                <div>

                    <small>
                        ${MONTHS[now.getMonth()]} hónap
                    </small>

                    <div
                        class="split"
                        role="img"
                    >
                        <span
                            style="width:${percent}%"
                        ></span>
                    </div>

                    <div class="split-legend">

                        <span class="income">
                            + ${huf(income)}
                        </span>

                        <span class="expense">
                            − ${huf(expense)}
                        </span>

                    </div>

                </div>

            </section>


            <div class="grid g-wide">

                <section class="card">

                    <div
                        style="
                            display:flex;
                            align-items:center;
                            justify-content:space-between;
                            gap:1rem;
                        "
                    >

                        <h2>
                            Az elmúlt 6 hónap
                        </h2>

                        <input
                            id="chartSlider"
                            type="range"
                            min="0"
                            max="12"
                            step="1"
                            value="${chartState.offset}"
                            aria-label="Diagram időszaka"
                            style="max-width:180px"
                        >

                    </div>

                    <svg
                        class="chart"
                        viewBox="0 0 560 205"
                    >

                        <line
                            x1="10"
                            x2="550"
                            y1="170"
                            y2="170"
                        />

                        ${bars}

                    </svg>

                    <div class="legend">

                        <span>
                            <i style="background:var(--income)"></i>
                            Bevétel
                        </span>

                        <span>
                            <i style="background:var(--expense)"></i>
                            Kiadás
                        </span>

                    </div>

                </section>


                <section class="card">

                    <h2>
                        Legnagyobb kiadások
                    </h2>

                    ${
                        top.length
                            ? `
                                <div class="bars">

                                    ${top.map(t => `
                                        <div>

                                            <span>

                                                <span>
                                                    ${esc(t.title)}
                                                </span>

                                                <b>
                                                    ${huf(t.sum)}
                                                </b>

                                            </span>

                                            <i
                                                style="
                                                    width:${Math.max(
                                                        4,
                                                        t.sum /
                                                        top[0].sum *
                                                        100
                                                    )}%
                                                "
                                            ></i>

                                        </div>
                                    `).join("")}

                                </div>
                            `
                            : `
                                <p class="muted">
                                    Ebben a hónapban még nincs kiadás.
                                </p>
                            `
                    }

                </section>

            </div>


            <section class="card">

                <h2>
                    Legutóbbi tételek
                </h2>

                ${
                    txs.length
                        ? `
                            <ul class="list">

                                ${txs
                                    .slice(0, 5)
                                    .map(txRow)
                                    .join("")}

                            </ul>
                        `
                        : `
                            <p class="muted">
                                Még nincs rögzített tétel.
                            </p>
                        `
                }

            </section>

        </div>
    `;


    /* ---------- csúszka ---------- */

    const slider = $("#chartSlider");

    if (slider) {
        slider.addEventListener(
            "input",
            () => {
                pages.dashboard.chartState.offset =
                    Number(slider.value);

                pages.dashboard();
            }
        );
    }
};


/* =========================================================
   TRANZAKCIÓK OLDAL
   ========================================================= */

pages.transactions = () => {
    const view = $("#view");

    if (!fam.family) {
        $("#actions").innerHTML = "";
        view.innerHTML = noFamily();
        return;
    }

    $("#actions").innerHTML = `
        <button
            class="btn primary"
            data-act="newTx"
        >
            Új tétel
        </button>
    `;

    const months = [
        ...new Set(
            txs.map(t =>
                dayOf(t.date).slice(0, 7)
            )
        )
    ];

    const state =
        pages.transactions.state ||= {
            type: "all",
            month: "all"
        };

    if (
        state.month !== "all" &&
        !months.includes(state.month)
    ) {
        state.month = "all";
    }

    view.innerHTML = `
        <div class="toolbar">

            <div class="seg">

                ${[
                    ["all", "Mind"],
                    ["income", "Bevétel"],
                    ["expense", "Kiadás"]
                ].map(([value, label]) => `
                    <label>

                        <input
                            type="radio"
                            name="ftype"
                            value="${value}"
                            ${state.type === value
                                ? "checked"
                                : ""}
                        >

                        <span>
                            ${label}
                        </span>

                    </label>
                `).join("")}

            </div>

            <label
                class="sr"
                for="fMonth"
            >
                Hónap
            </label>

            <select id="fMonth">

                <option value="all">
                    Minden hónap
                </option>

                ${months.map(month => `
                    <option
                        value="${month}"
                        ${state.month === month
                            ? "selected"
                            : ""}
                    >
                        ${month.slice(0, 4)}.
                        ${MONTHS[
                            Number(month.slice(5)) - 1
                        ]}
                    </option>
                `).join("")}

            </select>

        </div>

        <div
            class="grid g3"
            id="sums"
        ></div>

        <section
            class="card"
            style="margin-top:1rem"
        >

            <ul
                class="list"
                id="txList"
            ></ul>

        </section>
    `;

    const draw = () => {
        const list = txs.filter(t =>
            (
                state.type === "all" ||
                t.type === state.type
            ) &&
            (
                state.month === "all" ||
                dayOf(t.date)
                    .startsWith(state.month)
            )
        );

        const income =
            sum(list, "income");

        const expense =
            sum(list, "expense");

        $("#sums").innerHTML = `
            <div class="card stat">
                <small>Bevétel</small>

                <strong class="income">
                    ${huf(income)}
                </strong>
            </div>

            <div class="card stat">
                <small>Kiadás</small>

                <strong class="expense">
                    ${huf(expense)}
                </strong>
            </div>

            <div class="card stat">
                <small>Különbség</small>

                <strong>
                    ${huf(income - expense)}
                </strong>
            </div>
        `;

        $("#txList").innerHTML =
            list.length
                ? list.map(txRow).join("")
                : `
                    <li class="empty">
                        <p>
                            Nincs a szűrésnek megfelelő tétel.
                        </p>
                    </li>
                `;
    };

    view
        .querySelectorAll(
            'input[name="ftype"]'
        )
        .forEach(radio => {
            radio.addEventListener(
                "change",
                () => {
                    state.type = radio.value;
                    draw();
                }
            );
        });

    $("#fMonth").addEventListener(
        "change",
        e => {
            state.month = e.target.value;
            draw();
        }
    );

    draw();
};


/* =========================================================
   NAPTÁR
   ========================================================= */

pages.calendar = () => {
    const view = $("#view");

    if (!fam.family) {
        view.innerHTML = noFamily();
        return;
    }

    const state =
        pages.calendar.state ||= {
            year: new Date().getFullYear(),
            month: new Date().getMonth(),
            selected: ymd(new Date())
        };

    const today = ymd(new Date());

    const draw = () => {
        const first = new Date(
            state.year,
            state.month,
            1
        );

        const days = new Date(
            state.year,
            state.month + 1,
            0
        ).getDate();

        const leading =
            (first.getDay() + 6) % 7;

        const cells = [];


        /* üres cellák */

        for (let i = 0; i < leading; i++) {
            cells.push(`
                <div
                    class="day off"
                    aria-hidden="true"
                ></div>
            `);
        }


        /* napok */

        for (
            let day = 1;
            day <= days;
            day++
        ) {
            const date =
                `${ym(state.year, state.month)}-${pad(day)}`;

            const dayEvents =
                events.filter(
                    event =>
                        dayOf(event.date) === date
                );

            cells.push(`
                <button
                    class="
                        day
                        ${date === today ? "today" : ""}
                        ${date === state.selected ? "sel" : ""}
                    "
                    data-act="pickDay"
                    data-date="${date}"
                >

                    <b>${day}</b>

                    ${
                        dayEvents.length
                            ? `
                                <span class="i">
                                    ${dayEvents.length} esemény
                                </span>
                            `
                            : ""
                    }

                </button>
            `);
        }


        /* kiválasztott nap eseményei */

        const selectedEvents =
            events.filter(
                event =>
                    dayOf(event.date) ===
                    state.selected
            );


        view.innerHTML = `
            <div class="grid g-wide">

                <section class="card">

                    <div class="cal-head">

                        <button
                            class="btn sm"
                            data-act="calPrev"
                            aria-label="Előző hónap"
                        >
                            ‹
                        </button>

                        <h2>
                            ${state.year}.
                            ${MONTHS[state.month]}
                        </h2>

                        <button
                            class="btn sm"
                            data-act="calNext"
                            aria-label="Következő hónap"
                        >
                            ›
                        </button>

                    </div>


                    <div class="cal">

                        ${
                            ["H", "K", "Sze", "Cs", "P", "Szo", "V"]
                                .map(day => `
                                    <div class="dow">
                                        ${day}
                                    </div>
                                `)
                                .join("")
                        }

                        ${cells.join("")}

                    </div>

                </section>


                <section class="card">

                    <h2>
                        ${state.selected.replaceAll("-", ". ")}.
                    </h2>

                    ${
                        selectedEvents.length
                            ? `
                                <ul class="list">

                                    ${selectedEvents
                                        .map(eventRow)
                                        .join("")}

                                </ul>
                            `
                            : `
                                <p
                                    class="muted"
                                    style="margin-bottom:1rem"
                                >
                                    Ezen a napon nincs esemény.
                                </p>
                            `
                    }

                    <button
                        class="btn primary"
                        data-act="newEvent"
                        data-date="${state.selected}"
                        style="margin-top:1rem"
                    >
                        Új esemény
                    </button>

                </section>

            </div>
        `;
    };


    actions.pickDay = button => {
        state.selected =
            button.dataset.date;

        draw();
    };

    actions.calPrev = () => {
        state.month--;

        if (state.month < 0) {
            state.month = 11;
            state.year--;
        }

        draw();
    };

    actions.calNext = () => {
        state.month++;

        if (state.month > 11) {
            state.month = 0;
            state.year++;
        }

        draw();
    };

    onEventSaved = draw;

    draw();
};


/* =========================================================
   CSALÁD
   ========================================================= */

pages.family = () => {
    const view = $("#view");
    const family = fam.family;


    /* család törölve */

    if (!family && me.familyId) {
        view.innerHTML = `
            <div class="card empty">

                <h2>
                    A családod már nem létezik
                </h2>

                <p>
                    A tulajdonos törölte.
                    Lépj ki, utána újat hozhatsz létre
                    vagy csatlakozhatsz máshoz.
                </p>

                <button
                    class="btn primary"
                    data-act="leaveFamily"
                >
                    Kilépés
                </button>

            </div>
        `;

        return;
    }


    /* nincs család */

    if (!family) {
        view.innerHTML = `
            <div class="grid g2">

                <section class="card">

                    <h2>
                        Új család létrehozása
                    </h2>

                    <form
                        id="createForm"
                        class="grid"
                    >

                        <label>
                            Család neve

                            <input
                                id="newName"
                                required
                                maxlength="255"
                                placeholder="pl. Kovács család"
                            >
                        </label>

                        <p
                            class="err"
                            id="createErr"
                        ></p>

                        <button class="btn primary">
                            Család létrehozása
                        </button>

                    </form>

                </section>


                <section class="card">

                    <h2>
                        Csatlakozás meglévő családhoz
                    </h2>

                    <form
                        id="joinForm"
                        class="grid"
                    >

                        <label>
                            Család azonosítója

                            <input
                                id="joinId"
                                type="number"
                                required
                                placeholder="5 jegyű szám"
                            >
                        </label>

                        <p
                            class="err"
                            id="joinErr"
                        ></p>

                        <button class="btn">
                            Csatlakozás
                        </button>

                    </form>

                </section>

            </div>
        `;


        $("#createForm").addEventListener(
            "submit",
            async e => {
                e.preventDefault();

                const result = await api(
                    "/api/family",
                    "POST",
                    {
                        familyName:
                            $("#newName").value
                    }
                );

                if (!result.ok) {
                    $("#createErr").textContent =
                        result.data.message;

                    return;
                }

                if (!result.data.familyId) {
                    $("#createErr").textContent =
                        "A család létrejött, de a szerver nem adta vissza az azonosítót.";

                    return;
                }

                const join = await api(
                    "/api/member",
                    "POST",
                    {
                        familyId:
                            Number(
                                result.data.familyId
                            )
                    }
                );

                if (!join.ok) {
                    $("#createErr").textContent =
                        join.data.message;

                    return;
                }

                toast("Család létrehozva");

                await loadCore();

                pages.family();
            }
        );


        $("#joinForm").addEventListener(
            "submit",
            async e => {
                e.preventDefault();

                const familyId =
                    Number($("#joinId").value);

                const result = await api(
                    "/api/member",
                    "POST",
                    {
                        familyId
                    }
                );

                if (!result.ok) {
                    $("#joinErr").textContent =
                        result.data.message;

                    return;
                }

                await loadCore();

                if (!fam.family) {
                    await api(
                        "/api/member",
                        "DELETE",
                        {
                            familyId
                        }
                    );

                    await loadCore();

                    $("#joinErr").textContent =
                        "Nincs ilyen azonosítójú család.";

                    return;
                }

                toast(
                    "Csatlakoztál a családhoz"
                );

                pages.family();
            }
        );

        return;
    }


    /* család megjelenítése */

    const owner =
        String(family.ownerId) ===
        String(me.id);

    view.innerHTML = `
        <div class="grid g-wide">

            <section class="card">

                <h2>
                    ${esc(family.familyName)}
                </h2>

                <p class="muted">
                    Azonosító, amivel mások csatlakozhatnak:
                </p>

                <p class="famid">

                    ${family.familyId}

                    <button
                        class="btn sm"
                        data-act="copyId"
                        data-id="${family.familyId}"
                    >
                        Másolás
                    </button>

                </p>


                <div
                    class="actions"
                    style="
                        justify-content:flex-start;
                        margin-top:1.25rem
                    "
                >

                    ${
                        owner
                            ? `
                                <button
                                    class="btn"
                                    data-act="editFamily"
                                >
                                    Módosítás
                                </button>

                                <button
                                    class="btn danger"
                                    data-act="delFamily"
                                >
                                    Törlés
                                </button>
                            `
                            : `
                                <button
                                    class="btn"
                                    data-act="leaveFamily"
                                >
                                    Kilépés a családból
                                </button>
                            `
                    }

                </div>

            </section>


            <section class="card">

                <h2>
                    Tagok (${fam.members.length})
                </h2>

                <div class="members">

                    ${fam.members.map(member => `
                        <div class="member">

                            <span class="avatar">
                                ${esc(
                                    member.username[0]
                                        .toUpperCase()
                                )}
                            </span>

                            <div>

                                <b>
                                    ${esc(member.username)}
                                </b>

                                <div
                                    class="muted"
                                    style="font-size:.85rem"
                                >
                                    ${esc(member.email)}
                                </div>

                            </div>

                            ${
                                member.owner
                                    ? `
                                        <span
                                            class="badge"
                                            style="margin-left:auto"
                                        >
                                            tulajdonos
                                        </span>
                                    `
                                    : ""
                            }

                        </div>
                    `).join("")}

                </div>

            </section>

        </div>
    `;
};


/* =========================================================
   INDÍTÁS
   ========================================================= */

(async function init() {

    if (!PROTECTED) {
        pages[page]?.();
        return;
    }

    if (!token) {
        location.href = "/login";
        return;
    }

    await loadCore();

    if (!me) {
        return;
    }

    renderSidebar();

    initTxDialog();
    initEventDialog();

    onTxSaved = () => {
        pages[page]?.();
    };

    onEventSaved = () => {
        pages[page]?.();
    };

    pages[page]?.();

})();