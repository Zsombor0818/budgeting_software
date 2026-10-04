const pages = {};

const token = localStorage.getItem("token");
const page = document.body.dataset.page;
const PROTECTED = document.body.hasAttribute("data-auth");

const MONTHS = [
    "január", "február", "március", "április", "május", "június",
    "július", "augusztus", "szeptember", "október", "november", "december"
];

function $(selector, root = document) {
    return root.querySelector(selector);
}

function pad(n) {
    return String(n).padStart(2, "0");
}

function ymd(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

function ym(y, m) {
    return y + "-" + pad(m + 1);
}

function esc(s) {
    if (s === null || s === undefined) {
        s = "";
    }

    return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function huf(n) {
    return new Intl.NumberFormat("hu-HU").format(Math.round(n)) + " Ft";
}

function dayOf(value) {
    const d = new Date(value);

    if (isNaN(d)) {
        return String(value).slice(0, 10);
    }

    return ymd(d);
}

function sum(list, type) {
    let total = 0;

    for (const x of list) {
        if (x.type === type) {
            total += Number(x.amount);
        }
    }

    return total;
}

const ICONS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    swap: '<path d="M7 4l-4 4 4 4"/><path d="M3 8h14"/><path d="M17 20l4-4-4-4"/><path d="M21 16H7"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14c2.5.6 4 2.6 4 6"/>',
    out: '<path d="M9 4H5v16h4"/><path d="M16 8l4 4-4 4M20 12H9"/>',
    wallet: '<path d="M4 7h14a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"/><path d="M4 7l11-3v3"/>'
};

function icon(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + "</svg>";
}

const BRAND = '<div class="brand"><i>' + icon("wallet") + "</i>Közös Kassza</div>";

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
        headers.Authorization = "Bearer " + token;
    }

    let res;

    try {
        res = await fetch(url, {
            method: method,
            headers: headers,
            body: body ? JSON.stringify(body) : undefined
        });
    } catch (err) {
        return {
            ok: false,
            status: 0,
            data: { message: "A szerver nem érhető el." }
        };
    }

    const raw = await res.text();
    let data;

    try {
        data = JSON.parse(raw);
    } catch (err) {
        data = { text: raw };
    }

    if (res.status === 401 && PROTECTED) {
        logOut();
    }

    if (!res.ok && !data.message) {
        data.message = "Szerverhiba (" + res.status + ").";
    }

    return {
        ok: res.ok,
        status: res.status,
        data: data
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

    setTimeout(function () {
        t.remove();
    }, 3500);
}

function confirmBox(title, okLabel = "Törlés") {
    return new Promise(function (resolve) {
        const d = document.createElement("dialog");

        d.innerHTML = `
            <form method="dialog">
                <h2>${esc(title)}</h2>
                <div class="actions">
                    <button class="btn ghost" value="no">Mégse</button>
                    <button class="btn danger" value="yes">${esc(okLabel)}</button>
                </div>
            </form>
        `;

        d.addEventListener("close", function () {
            resolve(d.returnValue === "yes");
            d.remove();
        });

        document.body.append(d);
        d.showModal();
    });
}

function promptBox(title, label, value = "") {
    return new Promise(function (resolve) {
        const d = document.createElement("dialog");

        d.innerHTML = `
            <form method="dialog">
                <h2>${esc(title)}</h2>
                <label>
                    ${esc(label)}
                    <input required maxlength="255" value="${esc(value)}">
                </label>
                <div class="actions">
                    <button class="btn ghost" value="no" formnovalidate>Mégse</button>
                    <button class="btn primary" value="yes">Mentés</button>
                </div>
            </form>
        `;

        d.addEventListener("close", function () {
            if (d.returnValue === "yes") {
                resolve($("input", d).value.trim());
            } else {
                resolve(null);
            }

            d.remove();
        });

        document.body.append(d);
        d.showModal();
    });
}

let me = null;
let fam = { family: null, members: [] };
let txs = [];
let events = [];

async function loadCore() {
    const user = await api("/api/user");
    me = user.data.user;

    fam = { family: null, members: [] };
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
        txs = transactions.data.sort(function (a, b) {
            return new Date(b.date) - new Date(a.date) || b.transId - a.transId;
        });
    }

    const calendar = await api("/api/calendar");

    if (calendar.ok) {
        if (Array.isArray(calendar.data)) {
            events = calendar.data;
        } else if (calendar.data && Array.isArray(calendar.data.events)) {
            events = calendar.data.events;
        }
    }
}

function renderSidebar() {
    const links = [
        ["/dashboard", "home", "Főoldal"],
        ["/transactions.html", "swap", "Bevétel / Kiadás"],
        ["/calendar.html", "cal", "Naptár"],
        ["/family.html", "users", "Család"]
    ];

    let linkHtml = "";

    for (const link of links) {
        const current = location.pathname === link[0] ? 'aria-current="page"' : "";

        linkHtml += `
            <a href="${link[0]}" ${current}>
                ${icon(link[1])}
                <span>${link[2]}</span>
            </a>
        `;
    }

    $("#side").innerHTML = `
        ${BRAND}
        <nav class="nav" aria-label="Főmenü">
            ${linkHtml}
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
            <a class="btn primary" href="/family.html">Család beállítása</a>
        </div>
    `;
}

let txDialog = null;
let editingId = null;
let onTxSaved = function () {};

function initTxDialog() {
    txDialog = document.createElement("dialog");

    txDialog.innerHTML = `
        <form id="txForm">
            <h2 id="txHeading"></h2>

            <div class="seg">
                <label>
                    <input type="radio" name="type" value="expense" checked>
                    <span>Kiadás</span>
                </label>
                <label>
                    <input type="radio" name="type" value="income">
                    <span>Bevétel</span>
                </label>
            </div>

            <label>
                Megnevezés
                <input name="title" required maxlength="255">
            </label>

            <label>
                Összeg (Ft)
                <input name="amount" type="number" min="1" step="1" required>
            </label>

            <p class="muted" id="txNote" style="font-size:.85rem"></p>

            <label>
                Megjegyzés
                <input name="description" maxlength="255">
            </label>

            <p class="err" id="txErr"></p>

            <div class="actions">
                <button type="button" class="btn ghost" data-act="txCancel">Mégse</button>
                <button class="btn primary">Mentés</button>
            </div>
        </form>
    `;

    document.body.append(txDialog);
    $("#txForm").addEventListener("submit", saveTransaction);
}

async function saveTransaction(e) {
    e.preventDefault();

    const body = Object.fromEntries(new FormData(e.target).entries());
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
        $("#txErr").textContent = result.data.message || "Nem sikerült menteni.";
        return;
    }

    txDialog.close();

    if (editingId) {
        toast("Tétel módosítva");
    } else {
        toast("Tétel hozzáadva");
    }

    await loadCore();
    onTxSaved();
}

function openTx(tx) {
    const form = $("#txForm");

    if (tx) {
        editingId = tx.transId;
        $("#txHeading").textContent = "Tétel módosítása";
        form.type.value = tx.type;
        form.title.value = tx.title;
        form.amount.value = tx.amount;
        form.description.value = tx.description || "";
        $("#txNote").textContent = "A típus és a dátum utólag nem módosítható.";
    } else {
        editingId = null;
        $("#txHeading").textContent = "Új tétel";
        form.type.value = "expense";
        form.title.value = "";
        form.amount.value = "";
        form.description.value = "";
        $("#txNote").textContent = "A tétel a mentés napjával kerül rögzítésre.";
    }

    const radios = form.querySelectorAll('[name="type"]');

    for (const radio of radios) {
        radio.disabled = !!tx;
    }

    $("#txErr").textContent = "";
    txDialog.showModal();
    form.title.focus();
}

function txRow(t) {
    const sign = t.type === "income" ? "+" : "−";
    const date = dayOf(t.date).replaceAll("-", ". ") + ".";

    let user = "";
    if (t.username) {
        user = "<span>" + esc(t.username) + "</span>";
    }

    let desc = "";
    if (t.description) {
        desc = "<span>" + esc(t.description) + "</span>";
    }

    return `
        <li class="tx">
            <span class="dot ${t.type}" aria-hidden="true">${sign}</span>

            <div class="tx-main">
                <strong>${esc(t.title)}</strong>
                <small>
                    <span>${date}</span>
                    ${user}
                    ${desc}
                </small>
            </div>

            <span class="amt ${t.type}">${sign} ${huf(t.amount)}</span>

            <div class="row-actions">
                <button class="btn sm" data-act="editTx" data-id="${t.transId}">Módosítás</button>
                <button class="btn sm" data-act="delTx" data-id="${t.transId}">Törlés</button>
            </div>
        </li>
    `;
}

let eventDialog = null;
let editingEventId = null;
let onEventSaved = function () {};

function initEventDialog() {
    eventDialog = document.createElement("dialog");

    eventDialog.innerHTML = `
        <form id="eventForm">
            <h2 id="eventHeading">Új esemény</h2>

            <label>
                Esemény neve
                <input name="title" required maxlength="255">
            </label>

            <label>
                Dátum
                <input name="date" type="date" required>
            </label>

            <label>
                Megjegyzés
                <input name="description" maxlength="255">
            </label>

            <p class="err" id="eventErr"></p>

            <div class="actions">
                <button type="button" class="btn ghost" data-act="eventCancel">Mégse</button>
                <button class="btn primary">Mentés</button>
            </div>
        </form>
    `;

    document.body.append(eventDialog);
    $("#eventForm").addEventListener("submit", saveEvent);
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
        "/api/calendar",
        editingEventId ? "PUT" : "POST",
        body
    );

    if (!result.ok) {
        $("#eventErr").textContent = result.data.message || "Nem sikerült menteni.";
        return;
    }

    eventDialog.close();

    if (editingEventId) {
        toast("Esemény módosítva");
    } else {
        toast("Esemény hozzáadva");
    }

    await loadCore();
    onEventSaved();
}

function openEvent(event = null, date = "") {
    const form = $("#eventForm");

    if (event) {
        editingEventId = event.eventId;
        $("#eventHeading").textContent = "Esemény módosítása";
        form.title.value = event.title;
        form.date.value = dayOf(event.date);
        form.description.value = event.description || "";
    } else {
        editingEventId = null;
        $("#eventHeading").textContent = "Új esemény";
        form.title.value = "";
        form.date.value = date || ymd(new Date());
        form.description.value = "";
    }

    $("#eventErr").textContent = "";
    eventDialog.showModal();
    form.title.focus();
}

function eventRow(event) {
    const date = dayOf(event.date).replaceAll("-", ". ") + ".";

    let user = "";
    if (event.username) {
        user = "<span>" + esc(event.username) + "</span>";
    }

    let desc = "";
    if (event.description) {
        desc = "<span>" + esc(event.description) + "</span>";
    }

    return `
        <li class="tx">
            <span class="dot" aria-hidden="true">•</span>

            <div class="tx-main">
                <strong>${esc(event.title)}</strong>
                <small>
                    <span>${date}</span>
                    ${user}
                    ${desc}
                </small>
            </div>

            <div class="row-actions">
                <button class="btn sm" data-act="editEvent" data-id="${event.eventId}">Módosítás</button>
                <button class="btn sm" data-act="delEvent" data-id="${event.eventId}">Törlés</button>
            </div>
        </li>
    `;
}

let calState = null;

function drawCalendar() {
    const view = $("#view");
    const today = ymd(new Date());

    const first = new Date(calState.year, calState.month, 1);
    const days = new Date(calState.year, calState.month + 1, 0).getDate();
    const leading = (first.getDay() + 6) % 7;

    let cells = "";

    for (let i = 0; i < leading; i++) {
        cells += '<div class="day off" aria-hidden="true"></div>';
    }

    for (let day = 1; day <= days; day++) {
        const date = ym(calState.year, calState.month) + "-" + pad(day);

        const dayEvents = events.filter(function (event) {
            return dayOf(event.date) === date;
        });

        let classes = "day";
        if (date === today) {
            classes += " today";
        }
        if (date === calState.selected) {
            classes += " sel";
        }

        let count = "";
        if (dayEvents.length) {
            count = '<span class="i">' + dayEvents.length + " esemény</span>";
        }

        cells += `
            <button class="${classes}" data-act="pickDay" data-date="${date}">
                <b>${day}</b>
                ${count}
            </button>
        `;
    }

    const selectedEvents = events.filter(function (event) {
        return dayOf(event.date) === calState.selected;
    });

    let dows = "";
    for (const d of ["H", "K", "Sze", "Cs", "P", "Szo", "V"]) {
        dows += '<div class="dow">' + d + "</div>";
    }

    let eventList = "";
    if (selectedEvents.length) {
        eventList = '<ul class="list">' + selectedEvents.map(eventRow).join("") + "</ul>";
    } else {
        eventList = '<p class="muted" style="margin-bottom:1rem">Ezen a napon nincs esemény.</p>';
    }

    view.innerHTML = `
        <div class="grid g-wide">
            <section class="card">
                <div class="cal-head">
                    <button class="btn sm" data-act="calPrev" aria-label="Előző hónap">‹</button>
                    <h2>${calState.year}. ${MONTHS[calState.month]}</h2>
                    <button class="btn sm" data-act="calNext" aria-label="Következő hónap">›</button>
                </div>

                <div class="cal">
                    ${dows}
                    ${cells}
                </div>
            </section>

            <section class="card">
                <h2>${calState.selected.replaceAll("-", ". ")}.</h2>
                ${eventList}
                <button class="btn primary" data-act="newEvent" data-date="${calState.selected}" style="margin-top:1rem">
                    Új esemény
                </button>
            </section>
        </div>
    `;
}

const actions = {
    logout: logOut,

    txCancel: function () {
        txDialog.close();
    },

    eventCancel: function () {
        eventDialog.close();
    },

    newTx: function () {
        openTx();
    },

    editTx: function (button) {
        const tx = txs.find(function (t) {
            return String(t.transId) === button.dataset.id;
        });

        if (tx) {
            openTx(tx);
        }
    },

    delTx: async function (button) {
        const sure = await confirmBox("Biztosan törlöd ezt a tételt?");

        if (!sure) {
            return;
        }

        const result = await api("/api/transaction", "DELETE", {
            transId: Number(button.dataset.id)
        });

        if (!result.ok) {
            toast(result.data.message || "Nem sikerült törölni.", true);
            return;
        }

        toast("Tétel törölve");
        await loadCore();
        onTxSaved();
    },

    newEvent: function (button) {
        openEvent(null, button.dataset.date);
    },

    editEvent: function (button) {
        const event = events.find(function (e) {
            return String(e.eventId) === button.dataset.id;
        });

        if (event) {
            openEvent(event);
        }
    },

    delEvent: async function (button) {
        const sure = await confirmBox("Biztosan törlöd ezt az eseményt?");

        if (!sure) {
            return;
        }

        const result = await api("/api/calendar", "DELETE", {
            eventId: Number(button.dataset.id)
        });

        if (!result.ok) {
            toast(result.data.message || "Nem sikerült törölni.", true);
            return;
        }

        toast("Esemény törölve");
        await loadCore();
        onEventSaved();
    },

    pickDay: function (button) {
        calState.selected = button.dataset.date;
        drawCalendar();
    },

    calPrev: function () {
        calState.month--;

        if (calState.month < 0) {
            calState.month = 11;
            calState.year--;
        }

        drawCalendar();
    },

    calNext: function () {
        calState.month++;

        if (calState.month > 11) {
            calState.month = 0;
            calState.year++;
        }

        drawCalendar();
    },

    copyId: async function (button) {
        try {
            await navigator.clipboard.writeText(button.dataset.id);
            toast("Azonosító másolva");
        } catch (err) {
            toast("Nem sikerült másolni.", true);
        }
    },

    editFamily: async function () {
        const name = await promptBox("Család módosítása", "Család neve", fam.family.familyName);

        if (!name) {
            return;
        }

        const result = await api("/api/family", "PUT", {
            familyId: fam.family.familyId,
            familyName: name
        });

        if (!result.ok) {
            toast(result.data.message, true);
            return;
        }

        toast("Család módosítva");
        await loadCore();
        pages.family();
    },

    delFamily: async function () {
        const sure = await confirmBox("Biztosan törlöd a családot?", "Család törlése");

        if (!sure) {
            return;
        }

        const result = await api("/api/family", "DELETE", {
            familyId: fam.family.familyId
        });

        if (!result.ok) {
            toast(result.data.message, true);
            return;
        }

        toast("Család törölve");
        await loadCore();
        pages.family();
    },

    leaveFamily: async function () {
        const sure = await confirmBox("Biztosan kilépsz a családból?", "Kilépés");

        if (!sure) {
            return;
        }

        const result = await api("/api/member", "DELETE", {
            familyId: me.familyId
        });

        if (!result.ok) {
            toast(result.data.message, true);
            return;
        }

        toast("Kiléptél a családból");
        await loadCore();
        pages.family();
    }
};

document.addEventListener("click", function (e) {
    const button = e.target.closest("[data-act]");

    if (!button) {
        return;
    }

    const action = actions[button.dataset.act];

    if (action) {
        action(button);
    }
});

function authForm(url, getBody, onOk) {
    if (token) {
        location.href = "/dashboard";
        return;
    }

    const form = $("#authForm");
    const error = $("#errorMsg");

    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const button = $("button", form);
        button.disabled = true;
        error.textContent = "";

        for (const input of form.querySelectorAll("input")) {
            input.classList.remove("input-error");
        }

        const result = await api(url, "POST", getBody());
        button.disabled = false;

        if (result.ok && result.data.text !== undefined) {
            const text = result.data.text.trim();

            if (text === "siker") {
                onOk(result.data);
                return;
            }

            const messages = {
                "foglalt username": ["USERNAME_TAKEN", "Ez a felhasználónév már foglalt."],
                "foglalt email": ["EMAIL_TAKEN", "Ez az email cím már foglalt."],
                "A jelszavak nem egyeznek": ["PASSWORD_MISMATCH", "A jelszavak nem egyeznek."]
            };

            const found = messages[text];

            result.ok = false;

            if (found) {
                result.data = { code: found[0], message: found[1] };
            } else {
                result.data = { code: undefined, message: text };
            }
        }

        if (!result.ok) {
            error.textContent = result.data.message || "Valami hiba történt.";

            const fieldMap = {
                INVALID_CREDENTIALS: ["username", "password"],
                USERNAME_TAKEN: ["username"],
                EMAIL_TAKEN: ["email"],
                PASSWORD_MISMATCH: ["password", "password_again"]
            };

            const fields = fieldMap[result.data.code] || [];

            for (const id of fields) {
                const input = $("#" + id);

                if (input) {
                    input.classList.add("input-error");
                }
            }

            return;
        }

        onOk(result.data);
    });
}

pages.login = function () {
    authForm(
        "/api/login",
        function () {
            return {
                username: $("#username").value,
                password: $("#password").value
            };
        },
        function (data) {
            localStorage.setItem("token", data.token);
            location.href = "/dashboard";
        }
    );
};

pages.register = function () {
    authForm(
        "/api/register",
        function () {
            return {
                username: $("#username").value,
                email: $("#email").value,
                password: $("#password").value,
                password_again: $("#password_again").value
            };
        },
        function () {
            location.href = "/login";
        }
    );
};

let chartOffset = 0;

pages.dashboard = function () {
    const view = $("#view");

    $("#sub").textContent = fam.family ? fam.family.familyName : "";

    if (!fam.family) {
        view.innerHTML = noFamily();
        return;
    }

    $("#actions").innerHTML = '<button class="btn primary" data-act="newTx">Új tétel</button>';

    const now = new Date();
    const key = ym(now.getFullYear(), now.getMonth());

    const month = txs.filter(function (t) {
        return dayOf(t.date).startsWith(key);
    });

    const income = sum(month, "income");
    const expense = sum(month, "expense");
    const balance = sum(txs, "income") - sum(txs, "expense");

    let percent = 0;
    if (income + expense) {
        percent = Math.round(income / (income + expense) * 100);
    }

    const series = [];

    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i - chartOffset, 1);
        const monthKey = ym(d.getFullYear(), d.getMonth());

        const list = txs.filter(function (t) {
            return dayOf(t.date).startsWith(monthKey);
        });

        series.push({
            label: MONTHS[d.getMonth()].slice(0, 3),
            income: sum(list, "income"),
            expense: sum(list, "expense")
        });
    }

    let max = 1;
    for (const s of series) {
        max = Math.max(max, s.income, s.expense);
    }

    let bars = "";

    for (let i = 0; i < series.length; i++) {
        const s = series[i];
        const x = 20 + i * 90;
        const hi = s.income / max * 150;
        const he = s.expense / max * 150;

        bars += `
            <rect class="bi" x="${x}" y="${170 - hi}" width="28" height="${hi}" rx="4">
                <title>Bevétel: ${huf(s.income)}</title>
            </rect>
            <rect class="be" x="${x + 32}" y="${170 - he}" width="28" height="${he}" rx="4">
                <title>Kiadás: ${huf(s.expense)}</title>
            </rect>
            <text x="${x + 30}" y="192" text-anchor="middle">${s.label}</text>
        `;
    }

    const groups = {};

    for (const t of month) {
        if (t.type !== "expense") {
            continue;
        }

        const groupKey = t.title.trim().toLowerCase();

        if (!groups[groupKey]) {
            groups[groupKey] = { title: t.title, sum: 0 };
        }

        groups[groupKey].sum += Number(t.amount);
    }

    const top = Object.values(groups)
        .sort(function (a, b) {
            return b.sum - a.sum;
        })
        .slice(0, 5);

    let topHtml = "";

    if (top.length) {
        let rows = "";

        for (const t of top) {
            const width = Math.max(4, t.sum / top[0].sum * 100);

            rows += `
                <div>
                    <span>
                        <span>${esc(t.title)}</span>
                        <b>${huf(t.sum)}</b>
                    </span>
                    <i style="width:${width}%"></i>
                </div>
            `;
        }

        topHtml = '<div class="bars">' + rows + "</div>";
    } else {
        topHtml = '<p class="muted">Ebben a hónapban még nincs kiadás.</p>';
    }

    let recentHtml = "";

    if (txs.length) {
        recentHtml = '<ul class="list">' + txs.slice(0, 5).map(txRow).join("") + "</ul>";
    } else {
        recentHtml = '<p class="muted">Még nincs rögzített tétel.</p>';
    }

    view.innerHTML = `
        <div class="grid">

            <section class="card hero">
                <div>
                    <small>Közös egyenleg</small>
                    <div class="big">${huf(balance)}</div>
                </div>

                <div>
                    <small>${MONTHS[now.getMonth()]} hónap</small>

                    <div class="split" role="img">
                        <span style="width:${percent}%"></span>
                    </div>

                    <div class="split-legend">
                        <span class="income">+ ${huf(income)}</span>
                        <span class="expense">− ${huf(expense)}</span>
                    </div>
                </div>
            </section>

            <div class="grid g-wide">

                <section class="card">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;">
                        <h2>Az elmúlt 6 hónap</h2>

                        <input
                            id="chartSlider"
                            type="range"
                            min="0"
                            max="12"
                            step="1"
                            value="${chartOffset}"
                            aria-label="Diagram időszaka"
                            style="max-width:180px"
                        >
                    </div>

                    <svg class="chart" viewBox="0 0 560 205">
                        <line x1="10" x2="550" y1="170" y2="170"/>
                        ${bars}
                    </svg>

                    <div class="legend">
                        <span><i style="background:var(--income)"></i>Bevétel</span>
                        <span><i style="background:var(--expense)"></i>Kiadás</span>
                    </div>
                </section>

                <section class="card">
                    <h2>Legnagyobb kiadások</h2>
                    ${topHtml}
                </section>

            </div>

            <section class="card">
                <h2>Legutóbbi tételek</h2>
                ${recentHtml}
            </section>

        </div>
    `;

    const slider = $("#chartSlider");

    slider.addEventListener("input", function () {
        chartOffset = Number(slider.value);
        pages.dashboard();
    });
};

let txFilter = { type: "all", month: "all" };

pages.transactions = function () {
    const view = $("#view");

    if (!fam.family) {
        $("#actions").innerHTML = "";
        view.innerHTML = noFamily();
        return;
    }

    $("#actions").innerHTML = '<button class="btn primary" data-act="newTx">Új tétel</button>';

    const months = [];

    for (const t of txs) {
        const m = dayOf(t.date).slice(0, 7);

        if (!months.includes(m)) {
            months.push(m);
        }
    }

    if (txFilter.month !== "all" && !months.includes(txFilter.month)) {
        txFilter.month = "all";
    }

    const types = [
        ["all", "Mind"],
        ["income", "Bevétel"],
        ["expense", "Kiadás"]
    ];

    let typeHtml = "";

    for (const t of types) {
        const checked = txFilter.type === t[0] ? "checked" : "";

        typeHtml += `
            <label>
                <input type="radio" name="ftype" value="${t[0]}" ${checked}>
                <span>${t[1]}</span>
            </label>
        `;
    }

    let monthHtml = "";

    for (const month of months) {
        const selected = txFilter.month === month ? "selected" : "";
        const name = MONTHS[Number(month.slice(5)) - 1];

        monthHtml += `
            <option value="${month}" ${selected}>
                ${month.slice(0, 4)}. ${name}
            </option>
        `;
    }

    view.innerHTML = `
        <div class="toolbar">
            <div class="seg">
                ${typeHtml}
            </div>

            <label class="sr" for="fMonth">Hónap</label>

            <select id="fMonth">
                <option value="all">Minden hónap</option>
                ${monthHtml}
            </select>
        </div>

        <div class="grid g3" id="sums"></div>

        <section class="card" style="margin-top:1rem">
            <ul class="list" id="txList"></ul>
        </section>
    `;

    function draw() {
        const list = txs.filter(function (t) {
            const typeOk = txFilter.type === "all" || t.type === txFilter.type;
            const monthOk = txFilter.month === "all" || dayOf(t.date).startsWith(txFilter.month);
            return typeOk && monthOk;
        });

        const income = sum(list, "income");
        const expense = sum(list, "expense");

        $("#sums").innerHTML = `
            <div class="card stat">
                <small>Bevétel</small>
                <strong class="income">${huf(income)}</strong>
            </div>

            <div class="card stat">
                <small>Kiadás</small>
                <strong class="expense">${huf(expense)}</strong>
            </div>

            <div class="card stat">
                <small>Különbség</small>
                <strong>${huf(income - expense)}</strong>
            </div>
        `;

        if (list.length) {
            $("#txList").innerHTML = list.map(txRow).join("");
        } else {
            $("#txList").innerHTML = `
                <li class="empty">
                    <p>Nincs a szűrésnek megfelelő tétel.</p>
                </li>
            `;
        }
    }

    for (const radio of view.querySelectorAll('input[name="ftype"]')) {
        radio.addEventListener("change", function () {
            txFilter.type = radio.value;
            draw();
        });
    }

    $("#fMonth").addEventListener("change", function (e) {
        txFilter.month = e.target.value;
        draw();
    });

    draw();
};

pages.calendar = function () {
    if (!fam.family) {
        $("#view").innerHTML = noFamily();
        return;
    }

    if (!calState) {
        calState = {
            year: new Date().getFullYear(),
            month: new Date().getMonth(),
            selected: ymd(new Date())
        };
    }

    onEventSaved = drawCalendar;
    drawCalendar();
};

pages.family = function () {
    const view = $("#view");
    const family = fam.family;

    if (!family && me.familyId) {
        view.innerHTML = `
            <div class="card empty">
                <h2>A családod már nem létezik</h2>
                <p>
                    A tulajdonos törölte.
                    Lépj ki, utána újat hozhatsz létre
                    vagy csatlakozhatsz máshoz.
                </p>
                <button class="btn primary" data-act="leaveFamily">Kilépés</button>
            </div>
        `;
        return;
    }

    if (!family) {
        view.innerHTML = `
            <div class="grid g2">

                <section class="card">
                    <h2>Új család létrehozása</h2>

                    <form id="createForm" class="grid">
                        <label>
                            Család neve
                            <input id="newName" required maxlength="255" placeholder="pl. Kovács család">
                        </label>

                        <p class="err" id="createErr"></p>

                        <button class="btn primary">Család létrehozása</button>
                    </form>
                </section>

                <section class="card">
                    <h2>Csatlakozás meglévő családhoz</h2>

                    <form id="joinForm" class="grid">
                        <label>
                            Család azonosítója
                            <input id="joinId" type="number" required placeholder="5 jegyű szám">
                        </label>

                        <p class="err" id="joinErr"></p>

                        <button class="btn">Csatlakozás</button>
                    </form>
                </section>

            </div>
        `;

        $("#createForm").addEventListener("submit", async function (e) {
            e.preventDefault();

            const result = await api("/api/family", "POST", {
                familyName: $("#newName").value
            });

            if (!result.ok) {
                $("#createErr").textContent = result.data.message;
                return;
            }

            if (!result.data.familyId) {
                $("#createErr").textContent = "A család létrejött, de a szerver nem adta vissza az azonosítót.";
                return;
            }

            const join = await api("/api/member", "POST", {
                familyId: Number(result.data.familyId)
            });

            if (!join.ok) {
                $("#createErr").textContent = join.data.message;
                return;
            }

            toast("Család létrehozva");
            await loadCore();
            pages.family();
        });

        $("#joinForm").addEventListener("submit", async function (e) {
            e.preventDefault();

            const familyId = Number($("#joinId").value);

            const result = await api("/api/member", "POST", {
                familyId: familyId
            });

            if (!result.ok) {
                $("#joinErr").textContent = result.data.message;
                return;
            }

            await loadCore();

            if (!fam.family) {
                await api("/api/member", "DELETE", {
                    familyId: familyId
                });

                await loadCore();
                $("#joinErr").textContent = "Nincs ilyen azonosítójú család.";
                return;
            }

            toast("Csatlakoztál a családhoz");
            pages.family();
        });

        return;
    }

    const owner = String(family.ownerId) === String(me.id);

    let buttons = "";

    if (owner) {
        buttons = `
            <button class="btn" data-act="editFamily">Módosítás</button>
            <button class="btn danger" data-act="delFamily">Törlés</button>
        `;
    } else {
        buttons = '<button class="btn" data-act="leaveFamily">Kilépés a családból</button>';
    }

    let membersHtml = "";

    for (const member of fam.members) {
        let badge = "";

        if (member.owner) {
            badge = '<span class="badge" style="margin-left:auto">tulajdonos</span>';
        }

        membersHtml += `
            <div class="member">
                <span class="avatar">${esc(member.username[0].toUpperCase())}</span>

                <div>
                    <b>${esc(member.username)}</b>
                    <div class="muted" style="font-size:.85rem">${esc(member.email)}</div>
                </div>

                ${badge}
            </div>
        `;
    }

    view.innerHTML = `
        <div class="grid g-wide">

            <section class="card">
                <h2>${esc(family.familyName)}</h2>

                <p class="muted">Azonosító, amivel mások csatlakozhatnak:</p>

                <p class="famid">
                    ${family.familyId}
                    <button class="btn sm" data-act="copyId" data-id="${family.familyId}">Másolás</button>
                </p>

                <div class="actions" style="justify-content:flex-start;margin-top:1.25rem">
                    ${buttons}
                </div>
            </section>

            <section class="card">
                <h2>Tagok (${fam.members.length})</h2>
                <div class="members">
                    ${membersHtml}
                </div>
            </section>

        </div>
    `;
};

async function init() {
    if (!PROTECTED) {
        if (pages[page]) {
            pages[page]();
        }
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

    onTxSaved = function () {
        if (pages[page]) {
            pages[page]();
        }
    };

    onEventSaved = function () {
        if (pages[page]) {
            pages[page]();
        }
    };

    if (pages[page]) {
        pages[page]();
    }
}

init();
