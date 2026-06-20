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
    settings: { dailyGoalMl: 2000, cupColor: "#4aa3df" },
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
  }

  let state = load();

  // ---------- derived ----------
  function todayEntries() {
    return state.log[todayKey()] || [];
  }
  function todayMl() {
    return todayEntries().reduce((s, e) => s + e.ml, 0);
  }
  function todayCal() {
    return Math.round(todayEntries().reduce((s, e) => s + e.calories, 0));
  }
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
    renderAll();
  }

  // ---------- navigation ----------
  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("is-active", s.id === id));
    document.querySelectorAll(".nav-btn").forEach((b) =>
      b.classList.toggle("is-active", b.dataset.target === id));
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

    $("#saveSettingsBtn").addEventListener("click", saveSettings);
    $("#resetBtn").addEventListener("click", resetAll);

    loadSettingsForm();
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);

  // register service worker (best-effort; only over http/https)
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
