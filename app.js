/* ===== Sip — water & liquid tracker ===== */
(function () {
  "use strict";

  const STORE_KEY = "sip-data-v1";

  // Seeded defaults (calories per 100 ml). User can edit/delete all of these.
  const DEFAULT_DRINKS = [
    { id: "water",   name: "Water",          caloriesPer100ml: 0 },
    { id: "sparkl",  name: "Sparkling water", caloriesPer100ml: 0 },
    { id: "coffee",  name: "Coffee (black)", caloriesPer100ml: 1 },
    { id: "tea",     name: "Tea (plain)",    caloriesPer100ml: 1 },
    { id: "milk",    name: "Milk",           caloriesPer100ml: 62 },
    { id: "juice",   name: "Orange juice",   caloriesPer100ml: 45 },
    { id: "soda",    name: "Soda / cola",    caloriesPer100ml: 42 },
  ];

  const DEFAULT_STATE = {
    settings: { dailyGoalMl: 2000, cupColor: "#4aa3df", theme: "light" },
    drinks: DEFAULT_DRINKS.slice(),
    log: {},          // { "YYYY-MM-DD": [ {drinkId, name, ml, calories, time} ] }
    awardedDates: [], // days the goal was reached
    gifts: [],        // { id, name, cost }
    claims: [],       // { giftName, cost, date }
  };

  // ---------- helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const uid = () => Math.random().toString(36).slice(2, 9);

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return structuredClone(DEFAULT_STATE);
      const parsed = JSON.parse(raw);
      // shallow-merge so new fields survive upgrades
      return Object.assign(structuredClone(DEFAULT_STATE), parsed, {
        settings: Object.assign({}, DEFAULT_STATE.settings, parsed.settings),
      });
    } catch (e) {
      return structuredClone(DEFAULT_STATE);
    }
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    schedulePush(); // mirror to the cloud when logged in (no-op for guests)
  }

  let state = load();

  // ---------- account / cloud sync ----------
  // `account` is runtime-only (derived from the live session), never stored in
  // localStorage or pushed to the cloud — so we never show "logged in" stale.
  let account = { mode: "guest" };

  function cloud() { return window.SipCloud || null; }

  // The slice of state we sync. Deliberately excludes `account`.
  function currentPayload() {
    return {
      settings: state.settings,
      drinks: state.drinks,
      log: state.log,
      awardedDates: state.awardedDates,
      gifts: state.gifts,
      claims: state.claims,
    };
  }

  // Replace local state with a payload pulled from the cloud, surviving upgrades
  // the same way load() does.
  function adoptPayload(payload) {
    state = Object.assign(structuredClone(DEFAULT_STATE), payload, {
      settings: Object.assign({}, DEFAULT_STATE.settings, payload.settings),
    });
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  let pushTimer = null;
  function schedulePush() {
    const C = cloud();
    if (!C || account.mode !== "user") return;
    setSyncStatus("syncing");
    clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      try { await C.push(currentPayload()); setSyncStatus("synced"); }
      catch (_) { setSyncStatus("error"); }
    }, 800);
  }

  async function onAuthChanged(user) {
    if (user) {
      account = { mode: "user", userId: user.$id, email: user.email };
    } else {
      account = { mode: "guest" };
    }
    renderLoginUI();
    if (!user) return;

    // Just signed in: decide between adopting cloud data or copying ours up.
    const C = cloud();
    setSyncStatus("syncing");
    try {
      const remote = await C.pull();
      if (remote) {
        adoptPayload(remote);            // returning user → cloud is the truth
      } else {
        await C.push(currentPayload());  // first login → copy this device up
      }
      setSyncStatus("synced");
      loadSettingsForm();
      applyTheme();
      renderAll();
    } catch (_) {
      setSyncStatus("error");
    }
  }

  // ---------- theme ----------
  function applyTheme() {
    const dark = state.settings.theme === "dark";
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    const sw = $("#themeSwitch");
    if (sw) sw.setAttribute("aria-checked", dark ? "true" : "false");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#16202e" : "#dceaf7");
  }
  function toggleTheme() {
    state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
    save();
    applyTheme();
  }
  // apply immediately so there's no flash of the wrong theme
  applyTheme();

  // ---------- derived ----------
  // Per-date helpers so the calendar/history view can reuse the same math.
  function entriesFor(key) {
    return state.log[key] || [];
  }
  function mlFor(key) {
    return entriesFor(key).reduce((s, e) => s + e.ml, 0);
  }
  function calFor(key) {
    return Math.round(entriesFor(key).reduce((s, e) => s + e.calories, 0));
  }
  function todayEntries() { return entriesFor(todayKey()); }
  function todayMl() { return mlFor(todayKey()); }
  function todayCal() { return calFor(todayKey()); }
  function currentPoints() {
    const spent = state.claims.reduce((s, c) => s + c.cost, 0);
    return state.awardedDates.length - spent;
  }

  // award a point once when today crosses the goal
  function checkAward() {
    const key = todayKey();
    if (todayMl() >= state.settings.dailyGoalMl && !state.awardedDates.includes(key)) {
      state.awardedDates.push(key);
      return true; // newly awarded
    }
    return false;
  }

  // ---------- rendering ----------
  function renderCup(justReached) {
    const goal = state.settings.dailyGoalMl;
    const ml = todayMl();
    const pct = goal > 0 ? Math.min(ml / goal, 1) : 0;

    // SVG fill region runs roughly y=20 (top) to y=252 (bottom) => height 232
    const top = 20, bottom = 252, span = bottom - top;
    const fillTopY = bottom - pct * span;

    const rect = $("#liquidRect");
    rect.setAttribute("y", fillTopY);
    rect.setAttribute("height", bottom - fillTopY + 10);
    rect.setAttribute("fill", state.settings.cupColor);

    // simple wave sitting on top of the liquid
    const wave = $("#liquidWave");
    if (pct > 0 && pct < 1) {
      const y = fillTopY;
      wave.setAttribute("d",
        `M0 ${y} q 25 -8 50 0 t 50 0 t 50 0 t 50 0 V ${bottom + 10} H0 Z`);
      wave.setAttribute("fill", state.settings.cupColor);
    } else {
      wave.setAttribute("d", "");
    }

    $("#todayMl").textContent = ml.toLocaleString();
    $("#goalMl").textContent = goal.toLocaleString();
    $("#todayPct").textContent = Math.round(pct * 100) + "%";
    $("#todayCal").textContent = todayCal().toLocaleString();
    $("#goalMsg").hidden = !(ml >= goal);
    if (justReached) {
      const msg = $("#goalMsg");
      msg.hidden = false;
      msg.animate(
        [{ transform: "scale(0.6)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }],
        { duration: 450, easing: "cubic-bezier(.34,1.4,.5,1)" }
      );
    }
  }

  function renderPoints() {
    const p = currentPoints();
    $("#pointsHome").textContent = p;
    $("#pointsRewards").textContent = p;
    renderGifts(); // claim buttons depend on points
  }

  function renderLog() {
    const list = $("#logList");
    const entries = todayEntries();
    list.innerHTML = "";
    $("#logEmpty").hidden = entries.length > 0;
    entries.forEach((e, i) => {
      const li = document.createElement("li");
      li.className = "log-item";
      li.innerHTML = `
        <div class="li-main">
          <div class="li-name">${escapeHtml(e.name)}</div>
          <div class="li-sub">${e.ml} ml · ${Math.round(e.calories)} kcal</div>
        </div>
        <button class="icon-btn" title="Remove" data-i="${i}">↩</button>`;
      li.querySelector("button").addEventListener("click", () => removeEntry(i));
      list.appendChild(li);
    });
  }

  function renderDrinkManage() {
    const list = $("#drinkManageList");
    list.innerHTML = "";
    state.drinks.forEach((d) => {
      const li = document.createElement("li");
      li.className = "drink-manage-item";
      li.innerHTML = `
        <div class="li-main">
          <div class="li-name">${escapeHtml(d.name)}</div>
          <div class="li-sub">${d.caloriesPer100ml} kcal / 100 ml</div>
        </div>
        <button class="icon-btn" title="Edit">✎</button>
        <button class="icon-btn" title="Delete">✕</button>`;
      const [editBtn, delBtn] = li.querySelectorAll("button");
      editBtn.addEventListener("click", () => editDrink(d.id));
      delBtn.addEventListener("click", () => deleteDrink(d.id));
      list.appendChild(li);
    });
  }

  function renderGifts() {
    const list = $("#giftList");
    list.innerHTML = "";
    $("#giftEmpty").hidden = state.gifts.length > 0;
    const pts = currentPoints();
    state.gifts.forEach((g) => {
      const li = document.createElement("li");
      li.className = "gift-item";
      const can = pts >= g.cost;
      li.innerHTML = `
        <div class="li-main">
          <div class="li-name">${escapeHtml(g.name)}</div>
          <div class="li-sub">${g.cost} point${g.cost === 1 ? "" : "s"}</div>
        </div>
        <button class="btn btn-claim" ${can ? "" : "disabled"}>Claim</button>
        <button class="icon-btn" title="Delete">✕</button>`;
      const [claimBtn, delBtn] = li.querySelectorAll("button");
      claimBtn.addEventListener("click", () => claimGift(g.id));
      delBtn.addEventListener("click", () => deleteGift(g.id));
      list.appendChild(li);
    });
  }

  function renderClaims() {
    const list = $("#claimList");
    list.innerHTML = "";
    $("#claimEmpty").hidden = state.claims.length > 0;
    state.claims.slice().reverse().forEach((c) => {
      const li = document.createElement("li");
      li.className = "claim-item";
      li.innerHTML = `
        <div class="li-main">
          <div class="li-name">${escapeHtml(c.giftName)}</div>
          <div class="li-sub">${c.date} · ${c.cost} point${c.cost === 1 ? "" : "s"}</div>
        </div>`;
      list.appendChild(li);
    });
  }

  // ---------- history calendar ----------
  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  let calYear, calMonth; // calMonth is 0-based
  function initCalView() {
    const d = new Date();
    calYear = d.getFullYear();
    calMonth = d.getMonth();
  }
  function changeMonth(delta) {
    calMonth += delta;
    if (calMonth < 0) { calMonth = 11; calYear -= 1; }
    if (calMonth > 11) { calMonth = 0; calYear += 1; }
    renderCalendar();
  }

  function renderCalendar() {
    if (calYear == null) initCalView();
    $("#calMonthLabel").textContent = `${MONTH_NAMES[calMonth]} ${calYear}`;
    const grid = $("#calGrid");
    grid.innerHTML = "";

    const startDow = new Date(calYear, calMonth, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const tKey = todayKey();

    for (let i = 0; i < startDow; i++) {
      const blank = document.createElement("div");
      blank.className = "cal-cell cal-blank";
      grid.appendChild(blank);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const ml = mlFor(key);
      const reached = state.awardedDates.includes(key);
      const cell = document.createElement("button");
      cell.className = "cal-cell";
      if (key === tKey) cell.classList.add("is-today");
      if (ml > 0) cell.classList.add("has-data");
      if (reached) cell.classList.add("reached");
      cell.innerHTML =
        `<span class="cal-day">${day}</span>` +
        (ml > 0 ? `<span class="cal-ml">${ml >= 1000 ? (ml / 1000).toFixed(1) + "L" : ml + "ml"}</span>` : "") +
        (reached ? `<span class="cal-dot" aria-hidden="true"></span>` : "");
      cell.addEventListener("click", () => showDayDetail(key));
      grid.appendChild(cell);
    }
  }

  function showDayDetail(key) {
    const entries = entriesFor(key);
    $("#dayDetailDate").textContent = key === todayKey() ? `Today · ${key}` : key;
    $("#dayDetailTotals").textContent =
      `${mlFor(key).toLocaleString()} ml · ${calFor(key).toLocaleString()} kcal`;
    const list = $("#dayDetailList");
    list.innerHTML = "";
    $("#dayDetailEmpty").hidden = entries.length > 0;
    entries.forEach((e) => {
      const li = document.createElement("li");
      li.className = "log-item";
      li.innerHTML = `
        <div class="li-main">
          <div class="li-name">${escapeHtml(e.name)}</div>
          <div class="li-sub">${e.ml} ml · ${Math.round(e.calories)} kcal</div>
        </div>`;
      list.appendChild(li);
    });
    $("#dayDetail").hidden = false;
  }

  function renderAll(justReached) {
    renderCup(justReached);
    renderLog();
    renderDrinkManage();
    renderGifts();
    renderClaims();
    renderPoints();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------- actions ----------
  function addEntry(name, ml, caloriesPer100ml) {
    const key = todayKey();
    if (!state.log[key]) state.log[key] = [];
    const calories = (ml * caloriesPer100ml) / 100;
    state.log[key].push({ name, ml, calories, time: Date.now() });
    const newlyAwarded = checkAward();
    save();
    renderAll(newlyAwarded);
  }

  function removeEntry(i) {
    const key = todayKey();
    if (!state.log[key]) return;
    state.log[key].splice(i, 1);
    // if today no longer meets the goal, take the point back for today only
    if (todayMl() < state.settings.dailyGoalMl) {
      state.awardedDates = state.awardedDates.filter((d) => d !== key);
    }
    save();
    renderAll();
  }

  function addDrinkPreset(name, cal) {
    state.drinks.push({ id: uid(), name, caloriesPer100ml: cal });
    save();
    renderDrinkManage();
    populateDrinkSelect();
  }

  function editDrink(id) {
    const d = state.drinks.find((x) => x.id === id);
    if (!d) return;
    const name = prompt("Drink name:", d.name);
    if (name === null) return;
    const calStr = prompt("Calories per 100 ml:", d.caloriesPer100ml);
    if (calStr === null) return;
    d.name = name.trim() || d.name;
    const cal = parseFloat(calStr);
    if (!isNaN(cal) && cal >= 0) d.caloriesPer100ml = cal;
    save();
    renderDrinkManage();
    populateDrinkSelect();
  }

  function deleteDrink(id) {
    if (!confirm("Delete this drink?")) return;
    state.drinks = state.drinks.filter((d) => d.id !== id);
    save();
    renderDrinkManage();
    populateDrinkSelect();
  }

  function addGift(name, cost) {
    state.gifts.push({ id: uid(), name, cost });
    save();
    renderGifts();
  }

  function deleteGift(id) {
    if (!confirm("Delete this reward?")) return;
    state.gifts = state.gifts.filter((g) => g.id !== id);
    save();
    renderGifts();
  }

  function claimGift(id) {
    const g = state.gifts.find((x) => x.id === id);
    if (!g) return;
    if (currentPoints() < g.cost) return;
    if (!confirm(`Claim "${g.name}" for ${g.cost} point(s)?`)) return;
    state.claims.push({ giftName: g.name, cost: g.cost, date: todayKey() });
    save();
    renderPoints();
    renderClaims();
  }

  // ---------- add-drink modal ----------
  function populateDrinkSelect() {
    const sel = $("#addDrinkSelect");
    sel.innerHTML = "";
    state.drinks.forEach((d) => {
      const o = document.createElement("option");
      o.value = d.id;
      o.textContent = d.name;
      sel.appendChild(o);
    });
    const other = document.createElement("option");
    other.value = "__other__";
    other.textContent = "Other (custom)…";
    sel.appendChild(other);
  }

  function openAddModal() {
    $("#addError").hidden = true;
    $("#addMl").value = "";
    $("#customName").value = "";
    $("#customCal").value = "";
    $("#saveCustom").checked = false;
    populateDrinkSelect();
    toggleCustom();
    $("#addModal").hidden = false;
  }
  function closeAddModal() { $("#addModal").hidden = true; }

  function toggleCustom() {
    const isOther = $("#addDrinkSelect").value === "__other__";
    $("#customFields").hidden = !isOther;
  }

  function confirmAdd() {
    const sel = $("#addDrinkSelect").value;
    const ml = parseInt($("#addMl").value, 10);
    const err = $("#addError");

    if (!ml || ml <= 0) {
      err.textContent = "Please enter an amount in ml.";
      err.hidden = false;
      return;
    }

    let name, cal;
    if (sel === "__other__") {
      name = $("#customName").value.trim();
      cal = parseFloat($("#customCal").value);
      if (!name) { err.textContent = "Please enter a drink name."; err.hidden = false; return; }
      if (isNaN(cal) || cal < 0) { err.textContent = "Please enter calories per 100 ml."; err.hidden = false; return; }
      if ($("#saveCustom").checked) addDrinkPreset(name, cal);
    } else {
      const d = state.drinks.find((x) => x.id === sel);
      if (!d) { err.textContent = "Pick a drink."; err.hidden = false; return; }
      name = d.name;
      cal = d.caloriesPer100ml;
    }

    addEntry(name, ml, cal);
    closeAddModal();
  }

  // ---------- settings ----------
  function loadSettingsForm() {
    $("#goalInput").value = state.settings.dailyGoalMl;
    $("#colorInput").value = state.settings.cupColor;
  }
  function saveSettings() {
    const goal = parseInt($("#goalInput").value, 10);
    if (goal && goal >= 100) state.settings.dailyGoalMl = goal;
    state.settings.cupColor = $("#colorInput").value;
    // re-check award in case goal lowered below today's intake
    checkAward();
    save();
    renderAll();
    const note = $("#savedNote");
    note.hidden = false;
    setTimeout(() => (note.hidden = true), 1500);
  }
  function resetAll() {
    if (!confirm("This clears ALL data on this device. Continue?")) return;
    localStorage.removeItem(STORE_KEY);
    state = load();
    loadSettingsForm();
    applyTheme();
    renderAll();
  }

  // ---------- login UI (Settings) ----------
  function renderLoginUI() {
    const C = cloud();
    const ready = !!(C && C.isConfigured());
    const isUser = account.mode === "user";
    $("#cloudUnavailable").hidden = ready;
    $("#guestView").hidden = !ready || isUser;
    $("#userView").hidden = !isUser;
    if (isUser) $("#accountEmail").textContent = account.email || "";
  }

  function setSyncStatus(s) {
    const el = $("#syncStatus");
    if (!el) return;
    el.textContent =
      s === "syncing" ? "Syncing…" :
      s === "synced"  ? "Synced ✓" :
      s === "error"   ? "Sync issue — will retry when you're back online" : "";
    el.dataset.state = s || "";
  }

  let authMode = "login"; // "login" | "signup"
  function openAuth(mode) {
    authMode = mode;
    $("#authError").hidden = true;
    $("#authEmail").value = "";
    $("#authPassword").value = "";
    $("#authTitle").textContent = mode === "signup" ? "Create your account" : "Log in";
    $("#authSubmitBtn").textContent = mode === "signup" ? "Create account" : "Log in";
    $("#authPassword").autocomplete = mode === "signup" ? "new-password" : "current-password";
    $("#authSwitch").innerHTML = mode === "signup"
      ? 'Already have an account? <button type="button" class="linklike">Log in</button>'
      : 'New to Sip? <button type="button" class="linklike">Sign up</button>';
    $("#authSwitch").querySelector("button")
      .addEventListener("click", () => openAuth(mode === "signup" ? "login" : "signup"));
    $("#authModal").hidden = false;
    $("#authEmail").focus();
  }
  function closeAuth() { $("#authModal").hidden = true; }

  function friendlyAuthError(e) {
    const t = e && e.type;
    if (t === "user_already_exists") return "An account with that email already exists. Try logging in.";
    if (t === "user_invalid_credentials") return "Email or password doesn't match. Please try again.";
    if (t === "general_argument_invalid") return "Please enter a valid email and a password of at least 8 characters.";
    if (e && e.message && /network|fetch|failed/i.test(e.message)) return "Couldn't reach the server. Check your connection and try again.";
    return (e && e.message) || "Something went wrong. Please try again.";
  }

  async function submitAuth() {
    const C = cloud();
    if (!C) return;
    const email = $("#authEmail").value.trim();
    const pw = $("#authPassword").value;
    const err = $("#authError");
    if (!email || !pw) { err.textContent = "Please enter your email and password."; err.hidden = false; return; }
    if (authMode === "signup" && pw.length < 8) {
      err.textContent = "Password must be at least 8 characters."; err.hidden = false; return;
    }
    const btn = $("#authSubmitBtn");
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = "Please wait…";
    try {
      if (authMode === "signup") await C.signUp(email, pw);
      else await C.logIn(email, pw);
      closeAuth(); // onAuthChanged (fired by cloud.js) finishes the sync
    } catch (e) {
      err.textContent = friendlyAuthError(e); err.hidden = false;
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  }

  async function logOut() {
    const C = cloud();
    if (C) await C.logOut(); // onAuthChanged reverts us to guest
  }

  // ---------- navigation ----------
  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("is-active", s.id === id));
    document.querySelectorAll(".nav-btn").forEach((b) =>
      b.classList.toggle("is-active", b.dataset.target === id));
    if (id === "screen-history") {
      initCalView();
      renderCalendar();
      showDayDetail(todayKey()); // open on today by default
    }
  }

  // ---------- wire up ----------
  function init() {
    document.querySelectorAll(".nav-btn").forEach((b) =>
      b.addEventListener("click", () => showScreen(b.dataset.target)));

    $("#openAddBtn").addEventListener("click", openAddModal);
    $("#cancelAddBtn").addEventListener("click", closeAddModal);
    $("#confirmAddBtn").addEventListener("click", confirmAdd);
    $("#addDrinkSelect").addEventListener("change", toggleCustom);
    $("#addModal").addEventListener("click", (e) => { if (e.target.id === "addModal") closeAddModal(); });
    document.querySelectorAll(".quick-ml button").forEach((b) =>
      b.addEventListener("click", () => { $("#addMl").value = b.dataset.ml; }));

    $("#addDrinkBtn").addEventListener("click", () => {
      const name = $("#newDrinkName").value.trim();
      const cal = parseFloat($("#newDrinkCal").value);
      if (!name || isNaN(cal) || cal < 0) { alert("Enter a name and calories per 100 ml."); return; }
      addDrinkPreset(name, cal);
      $("#newDrinkName").value = "";
      $("#newDrinkCal").value = "";
    });

    $("#addGiftBtn").addEventListener("click", () => {
      const name = $("#newGiftName").value.trim();
      const cost = parseInt($("#newGiftCost").value, 10);
      if (!name || !cost || cost < 1) { alert("Enter a reward and a point cost (1 or more)."); return; }
      addGift(name, cost);
      $("#newGiftName").value = "";
      $("#newGiftCost").value = "";
    });

    $("#calPrev").addEventListener("click", () => changeMonth(-1));
    $("#calNext").addEventListener("click", () => changeMonth(1));

    // account / login
    $("#openLoginBtn").addEventListener("click", () => openAuth("login"));
    $("#openSignupBtn").addEventListener("click", () => openAuth("signup"));
    $("#authCancelBtn").addEventListener("click", closeAuth);
    $("#authSubmitBtn").addEventListener("click", submitAuth);
    $("#authModal").addEventListener("click", (e) => { if (e.target.id === "authModal") closeAuth(); });
    $("#logoutBtn").addEventListener("click", logOut);
    window.addEventListener("sip-auth-changed", (e) => onAuthChanged(e.detail.user));
    // reflect whatever cloud.js already knows (it may resolve before/after init)
    if (cloud()) { account = cloud().getUser()
      ? { mode: "user", userId: cloud().getUser().$id, email: cloud().getUser().email }
      : { mode: "guest" }; }
    renderLoginUI();

    $("#saveSettingsBtn").addEventListener("click", saveSettings);
    $("#resetBtn").addEventListener("click", resetAll);
    $("#themeSwitch").addEventListener("click", toggleTheme);

    loadSettingsForm();
    applyTheme();
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);

  // ---------- service worker: register + auto-update with no user action ----------
  // The SW is network-first, so an online open always loads the latest files.
  // On top of that, when a NEW service worker takes control we reload once so the
  // page and its assets are guaranteed to match — no manual cache-clearing ever.
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    // Was a SW already controlling this page when it loaded? If so, a later
    // controllerchange means a genuine UPDATE (reload). On a first-ever install
    // there's no prior controller, so we must NOT reload (avoids a needless refresh).
    const hadControllerAtLoad = !!navigator.serviceWorker.controller;
    let reloadedForUpdate = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadedForUpdate || !hadControllerAtLoad) return;
      reloadedForUpdate = true;
      window.location.reload();
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").then((reg) => {
        reg.update();                          // check for a new version on each load
        setInterval(() => reg.update(), 60 * 60 * 1000); // and hourly while open
      }).catch(() => {});
    });
  }
})();
