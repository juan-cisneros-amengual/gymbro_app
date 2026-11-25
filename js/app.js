/* GymBro functional prototype - app logic (vanilla JS, no build step).
   Screens follow the "Gymbro Final model" Figma file:
   Home, Facilities (occupancy map + zone modal + report sheet + thanks modal),
   Partners, Chats (list, conversation, propose-session form) and Profile. */

(function () {
  "use strict";

  var D = window.GYM_DATA;

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */

  var now = Date.now();
  var state = {
    zones: D.zones.map(function (z) {
      return Object.assign({}, z, { updatedAt: now - 2 * 60 * 1000, reported: null });
    }),
    gymReport: null,
    lastReportAt: {},          // target id -> timestamp, for the 2-minute anti-spam rule
    live: true,                // simulated live updates (can be paused, WCAG 2.2.2)
    filters: D.filters.slice(),
    invited: {},
    chats: JSON.parse(JSON.stringify(D.chats)),
    reportsSent: 0,
    sessionsProposed: 0,
    reportTarget: null,
    returnFocus: null,
    currentChat: null,
    undo: null                 // last report, can be undone for 5 seconds (iteration 2)
  };

  var REPORT_COOLDOWN_MS = 2 * 60 * 1000;
  var LABEL = { free: "Free", moderate: "Moderate", full: "Full" };

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var METER = { free: 34, moderate: 67, full: 100 };
  function pct(z) { return Math.round((z.people / z.capacity) * 100); }

  function levelOf(p) {
    if (p >= D.thresholds.full) return "full";
    if (p >= D.thresholds.moderate) return "moderate";
    return "free";
  }

  function zoneById(id) {
    for (var i = 0; i < state.zones.length; i++) if (state.zones[i].id === id) return state.zones[i];
    return null;
  }

  function overall() {
    var people = 0, cap = 0, latest = 0;
    state.zones.forEach(function (z) { people += z.people; cap += z.capacity; latest = Math.max(latest, z.updatedAt); });
    var p = Math.round((people / cap) * 100);
    return { pct: p, level: levelOf(p), updatedAt: latest };
  }

  function ago(t) {
    var s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 10) return "just now";
    if (s < 60) return s + " s ago";
    var m = Math.round(s / 60);
    return m + " min ago";
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hhmm(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function isoDate(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseIsoDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d) ? null : d;
  }
  function toMinutes(t) {
    var m = /^(\d{2}):(\d{2})$/.exec(t || "");
    return m ? (+m[1]) * 60 + (+m[2]) : null;
  }
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function niceDate(d) {
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  }

  /* Small inline icon set (Lucide-style strokes), always aria-hidden */
  var ICONS = {
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    pause: '<path d="M10 4H6v16h4zM18 4h-4v16h4z"/>',
    dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'
  };

  function icon(name) {
    return '<span data-icon="' + name + '">' + svg(name) + "</span>";
  }
  function svg(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONS[name] || "") + "</svg>";
  }
  function hydrateIcons(root) {
    $all("[data-icon]", root).forEach(function (el) {
      if (!el.firstChild) el.innerHTML = svg(el.getAttribute("data-icon"));
    });
  }

  var toastTimer = null;
  // P1/P2 requirement: confirmations combine visual feedback with vibration (noisy gym)
  function buzz(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern || 80); } catch (e) {}
  }

  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("is-visible"); }, 3200);
  }

  /* ------------------------------------------------------------------ */
  /* Dialog helpers: native <dialog> gives focus trapping + Escape;      */
  /* we add focus return to the control that opened the flow.            */
  /* ------------------------------------------------------------------ */

  function openDialog(dlg, opener) {
    if (opener !== undefined && opener !== null) state.returnFocus = opener;
    if (!dlg.open) dlg.showModal();
  }

  function closeDialog(dlg, keepFocusTarget) {
    if (dlg.open) dlg.close();
    if (!keepFocusTarget) restoreFocus();
  }

  function restoreFocus() {
    var el = state.returnFocus;
    state.returnFocus = null;
    if (el && document.body.contains(el)) el.focus();
  }

  $all("dialog").forEach(function (dlg) {
    dlg.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) closeDialog(dlg);
      else if (e.target === dlg) {                           // click on backdrop (outside the box)
        var r = dlg.getBoundingClientRect();
        var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!inside) closeDialog(dlg);
      }
    });
    dlg.addEventListener("cancel", function (e) {            // Escape key
      e.preventDefault();
      closeDialog(dlg);
    });
  });

  /* ------------------------------------------------------------------ */
  /* Views                                                               */
  /* ------------------------------------------------------------------ */

  function view(name) { return $('.view[data-view="' + name + '"]'); }

  function bars(level) {
    var on = level === "free" ? 2 : level === "moderate" ? 3 : 5;
    var heights = [20, 30, 40, 54, 46];
    return heights.map(function (h, i) {
      return '<span style="height:' + h + 'px" class="' + (i < on ? "on" : "") + '"></span>';
    }).join("");
  }

  /* ---------- Home ---------- */

  function renderHome() {
    var o = overall();
    var today = new Date();
    var w = D.plannedWorkout;
    var favs = D.favourites.map(function (f) {
      var z = zoneById(f.zone);
      var lv = levelOf(pct(z));
      return '<button type="button" class="fav-zone" data-open-zone="' + z.id + '" data-zone-ref="' + z.id + '" ' +
        'aria-label="' + esc(f.label) + ', ' + LABEL[lv] + '. Open details">' +
        '<div class="fav-zone__img fav-zone__img--' + f.img + '">' + esc(f.label) + "</div>" +
        '<div class="fav-zone__foot"><span class="status is-' + lv + '" data-status><span class="dot"></span>' + LABEL[lv] + "</span>" +
        '<span class="chev">' + icon("chevronRight") + "</span></div></button>";
    }).join("");

    view("home").innerHTML =
      '<a class="crowd-card" href="#facilities" aria-label="Overall gym crowd: ' + LABEL[o.level] + '. Open the facilities map">' +
        '<span class="crowd-card__label">Overall Gym Crowd</span>' +
        '<span class="crowd-card__level is-' + o.level + '" id="home-level"><span class="ring" aria-hidden="true"></span>' + LABEL[o.level] + "</span>" +
        '<span class="bars" aria-hidden="true" id="home-bars">' + bars(o.level) + "</span>" +
        '<span class="crowd-card__meta">' + icon("clock") + '<span id="home-updated">Last updated ' + ago(o.updatedAt) + "</span></span>" +
      "</a>" +
      '<h2 class="section-title">Planned Workouts</h2>' +
      '<a class="workout-card" href="#chat/' + w.chat + '">' +
        '<span class="date-box" aria-hidden="true"><span><strong>' + today.getDate() + "</strong><small>" +
          today.toLocaleDateString("en-GB", { month: "short" }) + "</small></span></span>" +
        '<span><h3>' + esc(w.title) + "</h3><p>with " + esc(w.partner) + '</p><p class="when">Today - ' + w.time + "</p></span>" +
        '<span class="chev" aria-hidden="true">' + icon("chevronRight") + "</span>" +
        '<span class="sr-only">Open chat with ' + esc(w.partner) + "</span>" +
      "</a>" +
      '<h2 class="section-title">Favourite Zones <button type="button" class="link-btn" id="edit-favs">Edit</button></h2>' +
      '<div class="zone-strip">' + favs + "</div>";
  }

  /* ---------- Facilities ---------- */

  function zoneCard(z) {
    var p = pct(z), lv = levelOf(p);
    return '<button type="button" class="zone is-' + lv + '" style="grid-area:' + z.area + '" data-open-zone="' + z.id + '" data-zone-ref="' + z.id + '">' +
      "<h3>" + esc(z.name) + "</h3>" +
      '<span class="status is-' + lv + '" data-status><span class="dot"></span>' + LABEL[lv] + "</span>" +
      '<span class="zone__time" data-time>Updated ' + ago(z.updatedAt) + "</span>" +
      '<span class="zone__report" data-reported' + (z.reported ? "" : " hidden") + ">" + (z.reported ? "You reported " + LABEL[z.reported] : "") + "</span>" +
      '<span class="sr-only">Open details</span>' +
      "</button>";
  }

  function renderFacilities() {
    view("facilities").innerHTML =
      '<div class="fac-head"><div><p class="eyebrow">Live occupancy</p><h2>Facilities Occupancy</h2></div>' +
        '<button type="button" class="toggle" id="live-toggle" aria-pressed="' + state.live + '"><span class="toggle__dot" aria-hidden="true"></span><span>Live updates</span></button>' +
      "</div>" +
      '<ul class="legend" aria-label="Colour legend">' +
        '<li><span class="dot is-free"></span>Free</li>' +
        '<li><span class="dot is-moderate"></span>Moderate</li>' +
        '<li><span class="dot is-full"></span>Full</li>' +
      "</ul>" +
      '<div class="plan" role="group" aria-label="Gym floor plan, entrance at the bottom">' +
        '<div class="plan__grid">' + state.zones.map(zoneCard).join("") + "</div>" +
        '<p class="plan__entrance" aria-hidden="true">ENTRANCE</p>' +
      "</div>" +
      '<p style="margin-top:12px"><span class="badge-sim">Simulated data</span></p>' +
      '<div class="fac-actions"><button type="button" class="btn btn--primary" id="report-gym-btn">' + icon("flag") + "Report Gym Status</button></div>";
  }

  /* Update numbers in place so keyboard focus is never lost during live updates */
  function refreshZoneRefs() {
    $all("[data-zone-ref]").forEach(function (el) {
      var z = zoneById(el.getAttribute("data-zone-ref"));
      var p = pct(z), lv = levelOf(p);
      if (el.classList.contains("zone")) {
        el.className = "zone is-" + lv;
        $("[data-time]", el).textContent = "Updated " + ago(z.updatedAt);
        var rep = $("[data-reported]", el);
        rep.hidden = !z.reported;
        rep.textContent = z.reported ? "You reported " + LABEL[z.reported] : "";
      } else {
        el.setAttribute("aria-label", el.querySelector(".fav-zone__img").textContent + ", " + LABEL[lv] + ". Open details");
      }
      var st = $("[data-status]", el);
      st.className = "status is-" + lv;
      st.innerHTML = '<span class="dot"></span>' + LABEL[lv];
    });
    var o = overall();
    var hl = $("#home-level");
    if (hl) {
      hl.className = "crowd-card__level is-" + o.level;
      hl.innerHTML = '<span class="ring" aria-hidden="true"></span>' + LABEL[o.level];
      $("#home-bars").innerHTML = bars(o.level);
      $("#home-updated").textContent = "Last updated " + ago(o.updatedAt);
      hl.parentNode.setAttribute("aria-label", "Overall gym crowd: " + LABEL[o.level] + ". Open the facilities map");
    }
    if ($("#zone-dialog").open && state.openZone) fillZoneDialog(state.openZone);
  }

  /* ---------- Zone modal ---------- */

  function fillZoneDialog(id) {
    var z = zoneById(id), p = pct(z), lv = levelOf(p);
    $("#zone-title").textContent = z.name;
    $("#zone-body").innerHTML =
      '<div class="zone-status is-' + lv + '" style="border-color:currentColor"><span class="zone-status__level"><span class="dot"></span>' + LABEL[lv] + "</span></div>" +
      // Iteration 2: no percentages. The bar shows the level in three steps, the word says it.
      '<div class="meter is-' + lv + '" aria-hidden="true"><span style="width:' + METER[lv] + '%"></span></div>' +
      '<div class="info-box"><small>' + icon("clock") + "Last update</small><strong>" + ago(z.updatedAt) + "</strong></div>" +
      (z.reported ? '<div class="info-box"><small>' + icon("flag") + "Your last report</small><strong>" + LABEL[z.reported] + "</strong></div>" : "");
  }

  function openZone(id, opener) {
    state.openZone = id;
    fillZoneDialog(id);
    openDialog($("#zone-dialog"), opener);
  }

  /* ---------- Report sheet + validation ---------- */

  function openReport(target, opener) {
    state.reportTarget = target;
    var form = $("#report-form");
    form.reset();
    setReportError("");
    if (target.type === "zone") {
      var z = zoneById(target.id);
      $("#report-title").textContent = "Report Zone Status";
      $("#report-sub").textContent = z.name + " - currently shown as " + LABEL[levelOf(pct(z))];
    } else {
      $("#report-title").textContent = "Report Gym Status";
      $("#report-sub").textContent = D.gym + " - pick the current level";
    }
    openDialog($("#report-dialog"), opener);
    var first = $('input[name="level"]', form);
    if (first) first.focus();
  }

  function setReportError(msg) {
    $("#report-error").textContent = msg;
    $("#report-form .levels").classList.toggle("is-invalid", !!msg);
  }

  $("#report-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var target = state.reportTarget;
    var checked = $('#report-form input[name="level"]:checked');

    // Rule 1: a level must be chosen
    if (!checked) {
      setReportError("Choose Free, Moderate or Full before sending.");
      $('#report-form input[name="level"]').focus();
      return;
    }

    // Rule 2: the same zone (or the whole gym) can be reported once every 2 minutes
    var key = target.type === "zone" ? target.id : "gym";
    var last = state.lastReportAt[key];
    if (last && Date.now() - last < REPORT_COOLDOWN_MS) {
      var wait = Math.ceil((REPORT_COOLDOWN_MS - (Date.now() - last)) / 1000);
      setReportError("You already reported this " + (key === "gym" ? "gym" : "zone") + " recently. You can report again in " + wait + " s.");
      checked.focus();
      return;
    }

    // Valid: store the report and give feedback
    var lv = checked.value;
    var zPrev = target.type === "zone" ? zoneById(target.id) : null;
    var undoInfo = {
      target: target, key: key, lastReportAt: state.lastReportAt[key],
      reported: zPrev ? zPrev.reported : null, updatedAt: zPrev ? zPrev.updatedAt : null, gymReport: state.gymReport
    };
    state.lastReportAt[key] = Date.now();
    state.reportsSent++;
    if (target.type === "zone") {
      var z = zoneById(target.id);
      z.reported = lv;
      z.updatedAt = Date.now();
    } else {
      state.gymReport = { level: lv, at: Date.now() };
    }
    closeDialog($("#report-dialog"), true);
    $("#thanks-text").textContent = "Your report (" + LABEL[lv] + ") for " +
      (target.type === "zone" ? zoneById(target.id).name : "the whole gym") + " has been sent successfully.";
    openDialog($("#thanks-dialog"));
    buzz([60, 40, 60]);
    startUndo(undoInfo);
    refreshZoneRefs();
    if (target.type === "zone") {
      var card = $('.zone[data-zone-ref="' + target.id + '"]');
      if (card) { card.classList.remove("pulse"); void card.offsetWidth; card.classList.add("pulse"); }
    }
  });

  /* ---------- Undo report (iteration 2, Figma "Facilities - Thanks Modal") ---------- */

  var UNDO_SECONDS = 5;
  var undoTimer = null;

  function startUndo(info) {
    stopUndo();
    state.undo = info;
    var left = UNDO_SECONDS;
    var btn = $("#undo-btn");
    btn.hidden = false;
    $("#undo-label").textContent = "Undo Report (" + left + " seconds)";
    undoTimer = setInterval(function () {
      left--;
      if (left <= 0) { stopUndo(); return; }
      $("#undo-label").textContent = "Undo Report (" + left + (left === 1 ? " second)" : " seconds)");
    }, 1000);
  }

  function stopUndo() {
    clearInterval(undoTimer);
    undoTimer = null;
    state.undo = null;
    var btn = $("#undo-btn");
    if (document.activeElement === btn) $("#thanks-dialog [data-close]").focus();   // never strand focus
    btn.hidden = true;
  }

  $("#undo-btn").addEventListener("click", function () {
    var u = state.undo;
    if (!u) return;
    if (u.lastReportAt) state.lastReportAt[u.key] = u.lastReportAt; else delete state.lastReportAt[u.key];
    if (u.target.type === "zone") {
      var z = zoneById(u.target.id);
      z.reported = u.reported;
      z.updatedAt = u.updatedAt;
    } else {
      state.gymReport = u.gymReport;
    }
    state.reportsSent--;
    stopUndo();
    closeDialog($("#thanks-dialog"));
    refreshZoneRefs();
    toast("Report undone");
  });

  $("#thanks-dialog").addEventListener("close", stopUndo);

  $("#zone-report-btn").addEventListener("click", function () {
    var id = state.openZone;
    closeDialog($("#zone-dialog"), true);
    openReport({ type: "zone", id: id });
  });

  /* ---------- Partners ---------- */

  function renderPartners() {
    var chips = state.filters.map(function (f, i) {
      return '<li class="chip">' + esc(f) +
        '<button type="button" data-remove-filter="' + i + '" aria-label="Remove filter ' + esc(f) + '">' + icon("x") + "</button></li>";
    }).join("");
    var matches = D.matches.map(function (m) {
      var sent = state.invited[m.id];
      return '<article class="match" aria-labelledby="m-' + m.id + '">' +
        '<div class="match__top"><span class="avatar avatar--photo" aria-hidden="true">' + esc(m.name.charAt(0)) + "</span>" +
          '<div><h3 class="match__name" id="m-' + m.id + '">' + esc(m.name) + '</h3><p class="avail"><span class="dot"></span>Available this week</p></div>' +
          '<div class="score" aria-label="' + m.score + ' percent match">' + m.score + "%<small>MATCH</small></div></div>" +
        "<p>" + esc(m.reason) + "</p>" +
        '<ul class="tags">' + m.tags.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" +
        (sent
          ? '<button type="button" class="btn btn--done" disabled>' + icon("check") + "Invitation sent</button>"
          : '<button type="button" class="btn btn--primary" data-invite="' + m.id + '">' + icon("message") + "Send Chat Invitation</button>") +
        "</article>";
    }).join("");

    view("partners").innerHTML =
      '<form class="search" id="filter-form" role="search" novalidate>' + icon("search") +
        '<label for="filter-input" class="sr-only">Add a search filter</label>' +
        '<input id="filter-input" placeholder="Search filters (e.g. Wednesday, Hypertrophy, 14:00)" autocomplete="off" aria-describedby="filter-error">' +
      "</form>" +
      '<p class="field-error" id="filter-error" role="alert"></p>' +
      '<ul class="chips" aria-label="Active filters">' + chips + "</ul>" +
      '<p class="eyebrow" style="margin-top:22px">' + D.matches.length + " people found</p>" +
      '<h2 class="section-title" style="margin-top:4px">Best matches <span style="font-size:.8rem;color:var(--muted);font-family:var(--font-body)">Best fit</span></h2>' +
      matches;
  }

  /* ---------- Chats ---------- */

  function chatAvatar(c) {
    return '<span class="avatar ' + (c.photo ? "avatar--photo" : "") + '" aria-hidden="true" style="border-radius:14px">' + esc(c.name.charAt(0)) + "</span>";
  }

  function renderChats() {
    var items = state.chats.map(function (c) {
      var last = c.messages[c.messages.length - 1];
      return '<li><a class="chat-item" href="#chat/' + c.id + '">' + chatAvatar(c) +
        "<span><strong>" + esc(c.name) + "</strong><p>" + esc(last.text) + "</p></span>" +
        '<span class="chat-item__meta"><span>' + esc(c.when) + "</span>" +
        (c.unread ? '<span class="unread" aria-label="' + c.unread + ' unread">' + c.unread + "</span>" : "") +
        "</span></a></li>";
    }).join("");
    view("chats").innerHTML = '<p class="eyebrow">' + state.chats.length + ' active chats</p><ul class="chat-list" style="margin-top:12px">' + items + "</ul>";
  }

  function chatById(id) {
    for (var i = 0; i < state.chats.length; i++) if (state.chats[i].id === id) return state.chats[i];
    return null;
  }

  function messageHtml(m) {
    if (m.type === "proposal") {
      var accepted = m.status === "accepted";
      return '<li class="msg msg--proposal"><strong>Session proposal</strong>' +
        esc(m.dateLabel) + " - " + esc(m.time) + "<br>" + esc(m.workout) +
        '<br><span class="proposal-state ' + (accepted ? "is-free" : "is-moderate") + '"><span class="dot"></span>' +
        (accepted ? "Accepted" : "Waiting for reply") + "</span><time>" + esc(m.sentAt) + "</time></li>";
    }
    return '<li class="msg msg--' + m.from + '">' + esc(m.text) + "<time>" + esc(m.time) + "</time></li>";
  }

  function renderChat(id) {
    var c = chatById(id);
    if (!c) { location.hash = "#chats"; return; }
    c.unread = 0;
    state.currentChat = id;
    view("chat").innerHTML =
      '<div class="chat-head"><a class="icon-btn" href="#chats" aria-label="Back to messages">' + icon("chevronLeft") + "</a>" +
        chatAvatar(c) + '<div><h2>' + esc(c.name) + '</h2><p class="avail"><span class="dot"></span>Available this week</p></div></div>' +
      '<span class="day-pill">Today</span>' +
      '<ul class="messages" id="messages" role="log" aria-live="polite" aria-label="Conversation with ' + esc(c.name) + '">' +
        c.messages.map(messageHtml).join("") + "</ul>" +
      '<div class="composer">' +
        '<button type="button" class="btn btn--primary" id="propose-btn">' + icon("calendar") + "Propose Session</button>" +
        '<form id="message-form" novalidate><label for="message-input" class="sr-only">Message to ' + esc(c.name) + "</label>" +
          '<input id="message-input" placeholder="Message" maxlength="500" autocomplete="off">' +
          '<button type="submit" class="icon-btn icon-btn--accent" aria-label="Send message">' + icon("arrow") + "</button></form>" +
      "</div>";
  }

  function appendMessage(m) {
    var c = chatById(state.currentChat);
    c.messages.push(m);
    var list = $("#messages");
    if (list) {
      list.insertAdjacentHTML("beforeend", messageHtml(m));
      list.lastElementChild.scrollIntoView({ block: "end", behavior: "smooth" });
    }
  }

  /* ---------- Propose session form + validation ---------- */

  function nextWednesday() {
    var d = startOfDay(new Date());
    do { d.setDate(d.getDate() + 1); } while (d.getDay() !== 3);
    return d;
  }

  function openPropose(opener) {
    var c = chatById(state.currentChat);
    var form = $("#propose-form");
    form.reset();
    ["date", "time", "workout"].forEach(function (f) { setFieldError(f, ""); });
    $("#propose-sub").textContent = "with " + c.name;
    var today = startOfDay(new Date());
    var max = new Date(today); max.setDate(max.getDate() + 30);
    $("#p-date").min = isoDate(today);
    $("#p-date").max = isoDate(max);
    if (c.id === "jason") {
      // Flexibility: pre-fill the slot both users share (from the match reason)
      $("#p-date").value = isoDate(nextWednesday());
      $("#p-time").value = "14:00";
      $("#propose-hint").textContent = "Suggested: your shared Wednesday 14:00 slot. You can change it.";
    } else {
      $("#propose-hint").textContent = "";
    }
    openDialog($("#propose-dialog"), opener);
    $("#p-date").focus();
  }

  var FIELD_IDS = { date: "p-date", time: "p-time", workout: "p-workout" };

  function setFieldError(field, msg) {
    var input = $("#" + FIELD_IDS[field]);
    $("#err-" + field).textContent = msg;
    if (msg) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  function validateProposal(values) {
    var errors = {};
    var today = startOfDay(new Date());
    var max = new Date(today); max.setDate(max.getDate() + 30);
    var date = parseIsoDate(values.date);

    if (!values.date) errors.date = "Pick a date for the session.";
    else if (!date) errors.date = "Enter a valid date.";
    else if (date < today) errors.date = "The date cannot be in the past.";
    else if (date > max) errors.date = "Sessions can be planned up to 30 days ahead.";

    var mins = toMinutes(values.time);
    var open = toMinutes(D.gymHours.open), close = toMinutes(D.gymHours.close);
    if (!values.time) errors.time = "Pick a start time.";
    else if (mins === null) errors.time = "Enter a valid time (HH:MM).";
    else if (mins < open || mins > close - 30) errors.time = "The gym is open 07:00 - 22:00, so start between 07:00 and 21:30.";
    else if (date && !errors.date && date.getTime() === today.getTime()) {
      var n = new Date();
      if (mins < n.getHours() * 60 + n.getMinutes() + 15) errors.time = "For today, pick a time at least 15 minutes from now.";
    }

    if (!values.workout) errors.workout = "Choose what you will train.";
    return errors;
  }

  $("#propose-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var values = { date: $("#p-date").value, time: $("#p-time").value, workout: $("#p-workout").value };
    var errors = validateProposal(values);
    var firstBad = null;
    ["date", "time", "workout"].forEach(function (f) {
      setFieldError(f, errors[f] || "");
      if (errors[f] && !firstBad) firstBad = $("#" + FIELD_IDS[f]);
    });
    if (firstBad) { firstBad.focus(); return; }

    var c = chatById(state.currentChat);
    var d = parseIsoDate(values.date);
    var msg = { type: "proposal", dateLabel: niceDate(d), time: values.time, workout: values.workout, status: "pending", sentAt: hhmm(new Date()) };
    closeDialog($("#propose-dialog"));
    appendMessage(msg);
    state.sessionsProposed++;
    toast("Proposal sent to " + c.name);
    buzz(80);

    // Simulated reply so the user sees the state change (pending -> accepted)
    var chatId = c.id;
    setTimeout(function () {
      msg.status = "accepted";
      if (state.currentChat === chatId && $("#messages")) {
        var list = $("#messages");
        list.innerHTML = chatById(chatId).messages.map(messageHtml).join("");
      }
      var reply = { from: "them", text: "Works for me, see you at " + values.time + "!", time: hhmm(new Date()) };
      if (state.currentChat === chatId) appendMessage(reply);
      else chatById(chatId).messages.push(reply);
      toast(c.name + " accepted your session");
      buzz([60, 40, 60]);
    }, 2500);
  });

  /* ---------- Profile ---------- */

  function renderProfile() {
    var acc = ONB.account();
    view("profile").innerHTML =
      '<div class="profile-card"><span class="avatar" aria-hidden="true">' + esc(D.user.initial) + "</span>" +
        "<div><h2>" + esc(D.user.name) + "</h2><p>" + esc(D.user.profile) + "</p>" +
        '<p class="profile-gym">' + icon("building") + esc(D.gym) + "</p></div></div>" +
      '<div class="profile-actions"><button type="button" class="btn btn--outline" id="edit-profile">' + icon("edit") + "Edit profile</button></div>" +
      '<div class="stat-row"><div class="stat"><strong>' + state.reportsSent + "</strong><span>Reports sent this session</span></div>" +
        '<div class="stat"><strong>' + state.sessionsProposed + "</strong><span>Sessions proposed</span></div></div>" +
      '<div class="setting"><div><strong>Live occupancy updates</strong><p>Pause if the changing numbers are distracting.</p></div>' +
        '<button type="button" class="toggle" id="live-toggle" aria-pressed="' + state.live + '"><span class="toggle__dot" aria-hidden="true"></span><span>' + (state.live ? "On" : "Off") + "</span></button></div>" +
      '<div class="setting"><div><strong>Log out</strong><p>' + (acc && acc.demo ? "Leave the demo account." : "Your profile is removed from this device.") + " Starts the app again from the welcome screen.</p></div>" +
        '<button type="button" class="toggle" id="logout-btn">' + icon("logout") + "<span>Log out</span></button></div>" +
      '<p class="hint" style="margin-top:16px">Prototype for the IPO course. All occupancy, people and chats are simulated.</p>';
  }

  /* ------------------------------------------------------------------ */
  /* Router (hash based, works from file://)                             */
  /* ------------------------------------------------------------------ */

  var TITLES = { home: D.gym, facilities: D.gym, partners: D.gym, chats: "Messages", chat: "Messages", profile: "Profile" };

  /* Onboarding (T01) lives outside the main app frame: no top bar, no tab bar */
  function showOnboarding(on) {
    $("#onb").hidden = !on;
    $("#app").hidden = on;
  }

  function route() {
    var hash = (location.hash || "#home").slice(1);
    var parts = hash.split("/");
    var name = parts[0];

    if (ONB.handles(name)) {
      if ($("#textsize-menu") && !$("#textsize-menu").hidden) menuOpen(false);
      showOnboarding(true);
      if (ONB.render(name, parts)) {
        window.scrollTo(0, 0);
        var h = $("#onb-main .onb-title");
        if (route.started && h) h.focus({ preventScroll: true });
        route.started = true;
      }
      return;
    }
    if (!ONB.hasAccount()) { location.replace("#welcome"); return; }   // first visit: register or log in
    showOnboarding(false);
    if (!TITLES[name]) name = "home";

    $all(".view").forEach(function (v) { v.hidden = v.getAttribute("data-view") !== name; });
    $("#app").classList.toggle("is-chat", name === "chat");
    $("#app").classList.toggle("is-home", name === "home");
    if (!$("#textsize-menu").hidden) menuOpen(false);
    if (name !== "chat") state.currentChat = null;

    if (name === "home") renderHome();
    else if (name === "facilities") renderFacilities();
    else if (name === "partners") renderPartners();
    else if (name === "chats") renderChats();
    else if (name === "chat") renderChat(parts[1]);
    else if (name === "profile") renderProfile();

    var tabName = name === "chat" ? "chats" : name;
    $all(".tab").forEach(function (t) {
      if (t.getAttribute("data-tab") === tabName) t.setAttribute("aria-current", "page");
      else t.removeAttribute("aria-current");
    });
    $("#page-title").textContent = TITLES[name];
    document.title = (name === "home" ? "Home" : name.charAt(0).toUpperCase() + name.slice(1)) + " - GymBro";
    hydrateIcons(view(name));
    window.scrollTo(0, 0);
    // Move focus to the content on navigation so screen readers announce the new screen
    if (route.started) $("#main").focus({ preventScroll: true });
    route.started = true;
  }

  /* ------------------------------------------------------------------ */
  /* Theme and text size (iteration 2, Figma "Home - Text size menu")    */
  /* ------------------------------------------------------------------ */

  var SIZE_LABEL = { small: "Small", medium: "Medium", big: "Big" };
  var root = document.documentElement;

  function savePref(k, v) { try { localStorage.setItem("gymbro." + k, v); } catch (e) {} }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    var b = $("#theme-btn");
    // A sun is shown in dark mode (tap for light), a moon in light mode (tap for dark)
    b.innerHTML = icon(theme === "dark" ? "sun" : "moon");
    b.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  }

  function applyTextSize(size) {
    root.setAttribute("data-textsize", size);
    $all(".ts-opt").forEach(function (o) { o.setAttribute("aria-pressed", String(o.getAttribute("data-size") === size)); });
    $("#textsize-btn").setAttribute("aria-label", "Text size: " + SIZE_LABEL[size]);
  }

  function menuOpen(open, focusButton) {
    $("#textsize-menu").hidden = !open;
    $("#textsize-btn").setAttribute("aria-expanded", String(open));
    if (open) $('.ts-opt[aria-pressed="true"]').focus();
    else if (focusButton) $("#textsize-btn").focus();
  }

  applyTheme(root.getAttribute("data-theme") === "light" ? "light" : "dark");
  applyTextSize(SIZE_LABEL[root.getAttribute("data-textsize")] ? root.getAttribute("data-textsize") : "medium");

  $("#theme-btn").addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    savePref("theme", next);
    toast(next === "light" ? "Light mode on" : "Dark mode on");
  });

  $("#textsize-btn").addEventListener("click", function () {
    menuOpen($("#textsize-menu").hidden);
  });

  $("#textsize-menu").addEventListener("click", function (e) {
    var o = e.target.closest(".ts-opt");
    if (!o) return;
    var size = o.getAttribute("data-size");
    applyTextSize(size);
    savePref("textsize", size);
    menuOpen(false, true);
    toast("Text size: " + SIZE_LABEL[size]);
  });

  $("#textsize-menu").addEventListener("keydown", function (e) {
    var opts = $all(".ts-opt"), i = opts.indexOf(document.activeElement);
    if (e.key === "Escape") { e.preventDefault(); menuOpen(false, true); }
    else if (e.key === "ArrowDown" && i > -1) { e.preventDefault(); opts[(i + 1) % opts.length].focus(); }
    else if (e.key === "ArrowUp" && i > -1) { e.preventDefault(); opts[(i + opts.length - 1) % opts.length].focus(); }
  });

  // Close the menu when clicking or tabbing anywhere else
  document.addEventListener("pointerdown", function (e) {
    if (!$("#textsize-menu").hidden && !e.target.closest(".topbar__actions")) menuOpen(false);
  });
  document.addEventListener("focusin", function (e) {
    if (!$("#textsize-menu").hidden && !e.target.closest(".topbar__actions")) menuOpen(false);
  });

  /* ------------------------------------------------------------------ */
  /* Event delegation                                                    */
  /* ------------------------------------------------------------------ */

  document.addEventListener("click", function (e) {
    var t;
    if ((t = e.target.closest("[data-open-zone]"))) {
      openZone(t.getAttribute("data-open-zone"), t);
    } else if ((t = e.target.closest("#report-gym-btn"))) {
      openReport({ type: "gym" }, t);
    } else if ((t = e.target.closest("#live-toggle"))) {
      state.live = !state.live;
      t.setAttribute("aria-pressed", String(state.live));
      var label = t.querySelector("span:last-child");
      if (label.textContent === "On" || label.textContent === "Off") label.textContent = state.live ? "On" : "Off";
      toast(state.live ? "Live updates on" : "Live updates paused");
    } else if ((t = e.target.closest("[data-remove-filter]"))) {
      var i = +t.getAttribute("data-remove-filter");
      var removed = state.filters.splice(i, 1)[0];
      renderPartners(); hydrateIcons(view("partners"));
      toast("Filter " + removed + " removed");
      var next = $("[data-remove-filter]") || $("#filter-input");
      next.focus();
    } else if ((t = e.target.closest("[data-invite]"))) {
      var id = t.getAttribute("data-invite");
      state.invited[id] = true;
      renderPartners(); hydrateIcons(view("partners"));
      var who = D.matches.filter(function (m) { return m.id === id; })[0];
      toast("Chat invitation sent to " + who.name);
      var art = $("#m-" + id);
      if (art) art.closest(".match").querySelector(".btn").focus();
    } else if ((t = e.target.closest("#propose-btn"))) {
      openPropose(t);
    } else if ((t = e.target.closest("#edit-profile"))) {
      ONB.startEdit();
    } else if ((t = e.target.closest("#logout-btn"))) {
      ONB.logout();
      toast("Logged out");
      location.hash = "#welcome";
    } else if ((t = e.target.closest(".skip-link"))) {
      // Do not change the hash (the router would treat "#main" as a page): just move focus
      e.preventDefault();
      var m = $("#onb").hidden ? $("#main") : $("#onb-main .onb-title") || $("#onb-main");
      m.focus();
    } else if ((t = e.target.closest("#edit-favs"))) {
      toast("Editing favourites is planned for the next iteration");
    }
  });

  document.addEventListener("submit", function (e) {
    if (e.target.id === "filter-form") {
      e.preventDefault();
      var input = $("#filter-input");
      var v = input.value.trim();
      var err = $("#filter-error");
      if (!v) { err.textContent = "Type a filter first, for example Thursday."; return; }
      var dup = state.filters.some(function (f) { return f.toLowerCase() === v.toLowerCase(); });
      if (dup) { err.textContent = "“" + v + "” is already a filter."; return; }
      if (state.filters.length >= 6) { err.textContent = "Up to 6 filters. Remove one to add another."; return; }
      state.filters.push(v);
      renderPartners(); hydrateIcons(view("partners"));
      toast("Filter " + v + " added");
      $("#filter-input").focus();
    } else if (e.target.id === "message-form") {
      e.preventDefault();
      var mi = $("#message-input");
      var text = mi.value.trim();
      if (!text) { mi.focus(); return; }
      appendMessage({ from: "me", text: text, time: hhmm(new Date()) });
      mi.value = "";
      mi.focus();
    }
  });

  document.addEventListener("input", function (e) {
    if (e.target.id === "filter-input") $("#filter-error").textContent = "";
    if (e.target.name === "level") setReportError("");
    if (e.target.closest && e.target.closest("#propose-form")) {
      var f = e.target.name;
      if (FIELD_IDS[f]) setFieldError(f, "");
    }
  });

  /* ------------------------------------------------------------------ */
  /* Simulated live data                                                 */
  /* ------------------------------------------------------------------ */

  setInterval(function () {
    if (state.live) {
      state.zones.forEach(function (z) {
        if (Math.random() < 0.5) return;                   // not every zone changes every tick
        var delta = Math.random() < 0.5 ? -1 : 1;
        z.people = Math.min(z.capacity, Math.max(0, z.people + delta));
        z.updatedAt = Date.now();
      });
    }
    refreshZoneRefs();
  }, 8000);

  /* ------------------------------------------------------------------ */
  /* Start                                                               */
  /* ------------------------------------------------------------------ */

  /* Shared helpers for js/onboarding.js and applying the registered profile */
  var ONB = window.GymOnboarding;

  function applyAccount(a) {
    D.user.name = a.name;
    D.user.initial = a.name.charAt(0).toUpperCase();
    D.user.profile = ONB.describe(a);
    D.gym = ONB.gymName(a.gym);
    var f = ONB.filtersFor(a);
    state.filters = f ? f : D.filters.slice();
    state.invited = {};
    TITLES.home = TITLES.facilities = TITLES.partners = D.gym;
    $("#zone-dialog .modal__sub").textContent = D.gym;
    var av = $(".avatar--button");
    av.textContent = D.user.initial;
    av.setAttribute("aria-label", "Open your profile (" + D.user.name + ")");
  }

  window.GymUI = { esc: esc, icon: icon, toast: toast, buzz: buzz, hydrateIcons: hydrateIcons, applyAccount: applyAccount };
  if (ONB.hasAccount()) applyAccount(ONB.account());

  hydrateIcons(document);
  window.addEventListener("hashchange", route);
  route();
})();
