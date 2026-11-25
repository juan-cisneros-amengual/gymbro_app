/* GymBro - T01 Register and Onboarding (added in Practice 3).
   Follows the T01 task analysis and the "Sign up and onboarding" storyboard from P2:
     1. Create account (name, email, age, password, privacy terms + optional consent)
     2. Confirm email (simulated 4-digit code)
     3. Gym profile in 4 short steps: gym, usual days/times, goal + level, privacy
     4. Review (every section editable) and finish -> Partners with first suggestions
   Also used for "Edit profile" (T02, light): Profile -> Review -> Save changes.
   Everything is simulated and stays on this device. The password is never stored. */

(function () {
  "use strict";

  var KEY = "gymbro.account";
  var ROUTES = ["welcome", "signup", "verify", "setup", "review", "done"];
  var DEMO_CODE = "1234";
  var STEPS = 4;

  /* Invented gyms. Two similar branch names on purpose: the address is shown so the
     "wrong branch" slip from the P2 task analysis can be avoided. */
  var GYMS = [
    { id: "campus", name: "Campus Gym (UFV)", address: "UFV campus, Pozuelo de Alarcón", km: "0.2 km" },
    { id: "fz-centro", name: "FitZone Pozuelo Centro", address: "Calle Mayor 14, Pozuelo de Alarcón", km: "2.3 km" },
    { id: "fz-estacion", name: "FitZone Pozuelo Estación", address: "Av. de la Estación 3, Pozuelo de Alarcón", km: "3.1 km" },
    { id: "iron", name: "Iron Club Majadahonda", address: "Gran Vía 41, Majadahonda", km: "5.8 km" },
    { id: "aqua", name: "AquaGym Aravaca", address: "Calle Golondrina 7, Aravaca", km: "6.4 km" }
  ];

  var DAYS = [
    { id: "mon", short: "Mon", long: "Monday" }, { id: "tue", short: "Tue", long: "Tuesday" },
    { id: "wed", short: "Wed", long: "Wednesday" }, { id: "thu", short: "Thu", long: "Thursday" },
    { id: "fri", short: "Fri", long: "Friday" }, { id: "sat", short: "Sat", long: "Saturday" },
    { id: "sun", short: "Sun", long: "Sunday" }
  ];

  var SLOTS = [
    { id: "morning", label: "Morning", range: "07:00-12:00" },
    { id: "midday", label: "Midday", range: "12:00-16:00" },
    { id: "afternoon", label: "Afternoon", range: "16:00-20:00" },
    { id: "evening", label: "Evening", range: "20:00-22:00" }
  ];

  var GOALS = [
    { id: "hypertrophy", label: "Build muscle", desc: "Hypertrophy: more volume, muscle growth", tag: "Hypertrophy" },
    { id: "strength", label: "Get stronger", desc: "Heavy compound lifts, lower reps", tag: "Strength" },
    { id: "weight", label: "Lose weight", desc: "Mix of cardio and strength", tag: "Weight loss" },
    { id: "health", label: "Improve cardio and health", desc: "Endurance, feeling better day to day", tag: "Cardio" },
    { id: "consistency", label: "Be more consistent", desc: "Build the habit, any type of training", tag: "Consistency" }
  ];

  var LEVELS = [
    { id: "beginner", label: "Beginner", desc: "Less than 6 months. Still learning the basic exercises." },
    { id: "intermediate", label: "Intermediate", desc: "6 months to 2 years. You follow a routine and know the main lifts." },
    { id: "advanced", label: "Advanced", desc: "More than 2 years. You plan your own programme." }
  ];

  var USES = [
    { id: "partners", label: "Find training partners" },
    { id: "occupancy", label: "Check how busy the gym is" },
    { id: "report", label: "Report occupancy to help others" }
  ];

  var VISIBILITY = [
    { id: "gym", label: "Members of my gym only", desc: "Recommended. Only people at your gym can find you in Partners." },
    { id: "hidden", label: "Nobody for now", desc: "You stay hidden in Partners. You can still check occupancy and answer chats." }
  ];

  var DEMO = {
    name: "Juan", email: "juan@example.com", age: 21, gym: "campus",
    days: ["wed", "fri"], slots: ["midday"], goal: "hypertrophy", level: "intermediate",
    uses: ["partners", "occupancy"], visibility: "gym", tips: false, demo: true
  };

  /* ---------------- state ---------------- */

  var account = load();
  var draft = null;           // account being created or edited (memory only)
  var password = "";          // kept in memory only so "Change email" does not wipe it
  var editing = false;        // true when opened from Profile > Edit profile
  var backToReview = false;   // true when a step was opened from the Review screen

  function load() {
    try { var a = JSON.parse(localStorage.getItem(KEY)); return a && a.name ? a : null; } catch (e) { return null; }
  }
  function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function UI() { return window.GymUI; }
  function esc(s) { return UI().esc(s); }
  function icon(n) { return UI().icon(n); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  /* ---------------- descriptions used by the rest of the app ---------------- */

  function gymName(id) { var g = find(GYMS, id); return g ? g.name : GYMS[0].name; }

  function describe(a) {
    var lv = find(LEVELS, a.level), goal = find(GOALS, a.goal);
    var days = (a.days || []).map(function (d) { return find(DAYS, d).short; }).join(", ");
    var slots = (a.slots || []).map(function (s) { return find(SLOTS, s).label; }).join(", ");
    return [lv && lv.label, goal && goal.label, days, slots].filter(Boolean).join(" · ");
  }

  /* Partners filters come from the profile, so the first suggestions match it */
  function filtersFor(a) {
    if (a.demo) return null;   // keep the original demo filters
    var f = [];
    (a.days || []).slice(0, 2).forEach(function (d) { f.push(find(DAYS, d).long); });
    if (a.slots && a.slots.length) f.push(find(SLOTS, a.slots[0]).range);
    var goal = find(GOALS, a.goal); if (goal) f.push(goal.tag);
    var lv = find(LEVELS, a.level); if (lv) f.push(lv.label);
    return f.slice(0, 6);
  }

  /* ---------------- shared markup ---------------- */

  function top(backHref, step) {
    var back = backHref
      ? '<a class="icon-btn" href="' + backHref + '" aria-label="Back">' + icon("chevronLeft") + "</a>"
      : '<span class="onb-top__spacer"></span>';
    var progress = step
      ? '<div class="progress"><p class="eyebrow" id="progress-label">Step ' + step + " of " + STEPS + "</p>" +
        '<div class="progress__bar" role="progressbar" aria-labelledby="progress-label" aria-valuemin="1" aria-valuemax="' + STEPS +
        '" aria-valuenow="' + step + '"><span style="width:' + Math.round(step / STEPS * 100) + '%"></span></div></div>'
      : "";
    return '<div class="onb-top">' + back + progress + "</div>";
  }

  function heading(title, sub) {
    return '<h1 class="onb-title" tabindex="-1">' + title + "</h1>" + (sub ? '<p class="onb-sub">' + sub + "</p>" : "");
  }

  function field(id, label, type, value, why, attrs) {
    return '<div class="field"><label for="f-' + id + '">' + label + "</label>" +
      '<input id="f-' + id + '" name="' + id + '" type="' + type + '" value="' + esc(value == null ? "" : value) + '" ' +
      'aria-describedby="why-' + id + " err-" + id + '" ' + (attrs || "") + ">" +
      '<p class="hint hint--small" id="why-' + id + '">' + why + "</p>" +
      '<p class="field-error" id="err-' + id + '"></p></div>';
  }

  /* A group of radio or checkbox cards inside a fieldset with its own error message */
  function group(name, legend, type, items, selected, opts) {
    opts = opts || {};
    var sel = [].concat(selected || []);
    var cards = items.map(function (it) {
      var on = sel.indexOf(it.id) > -1;
      return '<label class="choice' + (opts.chips ? " choice--chip" : "") + '">' +
        '<input type="' + type + '" name="' + name + '" value="' + it.id + '"' + (on ? " checked" : "") + ">" +
        '<span class="choice__text"><strong>' + esc(opts.chips ? it.short : (it.label || it.name)) + "</strong>" +
          (it.desc || it.range || it.address ? "<small>" + esc(it.desc || it.range || it.address) + "</small>" : "") + "</span>" +
        (it.km ? '<span class="choice__km">' + esc(it.km) + "</span>" : "") +
        (opts.chips ? "" : '<span class="choice__mark choice__mark--' + type + '" aria-hidden="true"></span>') +
        "</label>";
    }).join("");
    return '<fieldset class="group" id="g-' + name + '" aria-describedby="err-' + name + (opts.hint ? " why-" + name : "") + '">' +
      '<legend class="group__legend">' + legend + "</legend>" +
      (opts.hint ? '<p class="hint hint--small" id="why-' + name + '">' + opts.hint + "</p>" : "") +
      '<div class="group__items' + (opts.chips ? " group__items--chips" : "") + '">' + cards + "</div>" +
      '<p class="field-error" id="err-' + name + '"></p></fieldset>';
  }

  function nextLabel(def) { return backToReview ? "Save and return to review" : def; }
  function stepBack(n) { return backToReview ? "#review" : (n > 1 ? "#setup/" + (n - 1) : null); }

  /* ---------------- screens ---------------- */

  var SCREENS = {
    welcome: function () {
      return '<div class="onb-hero">' +
        '<div class="logo" aria-hidden="true">' + icon("dumbbell") + "</div>" +
        '<h1 class="onb-title onb-title--hero" tabindex="-1">GymBro</h1>' +
        '<p class="onb-sub">Find a training partner. Skip the crowded zones.</p>' +
        '<ul class="perks">' +
          "<li>" + icon("users") + "<span>Meet people at your gym who train when you do</span></li>" +
          "<li>" + icon("building") + "<span>See how busy each zone is before you go</span></li>" +
          "<li>" + icon("lock") + "<span>Chat without sharing your phone or location</span></li>" +
        "</ul>" +
        '<div class="onb-actions">' +
          '<a class="btn btn--primary" href="#signup">Sign up</a>' +
          '<button type="button" class="btn btn--outline" id="demo-login">Log in with the demo account</button>' +
        "</div>" +
        '<p class="hint hint--small onb-note">Prototype for the IPO course. Everything you enter stays on this device.</p>' +
        "</div>";
    },

    signup: function () {
      var d = draft || {};
      return top("#welcome") +
        heading("Create your account", "It takes about 2 minutes. We only ask for what we need to find you partners.") +
        '<form id="onb-form" data-screen="signup" novalidate>' +
          '<p class="form-summary" id="form-summary" role="alert"></p>' +
          field("name", "Name", "text", d.name, "Shown to the partners you match with.", 'autocomplete="given-name" maxlength="40"') +
          field("email", "Email", "email", d.email, "Used to confirm your account. Never shown to other users.", 'autocomplete="email" inputmode="email"') +
          field("age", "Age", "number", d.age, "You must be 18 or older: GymBro arranges meetups with people you don't know.", 'inputmode="numeric" min="18" max="99"') +
          '<div class="field"><label for="f-password">Password</label>' +
            '<div class="pw"><input id="f-password" name="password" type="password" value="' + esc(password) + '" autocomplete="new-password" aria-describedby="why-password err-password">' +
            '<button type="button" class="pw__toggle" id="pw-toggle" aria-pressed="false" aria-controls="f-password">Show</button></div>' +
            '<p class="hint hint--small" id="why-password">At least 8 characters, with letters and numbers.</p>' +
            '<p class="field-error" id="err-password"></p></div>' +
          '<div class="consent" id="g-terms">' +
            '<label class="check"><input type="checkbox" name="terms" id="f-terms" aria-describedby="err-terms"' + (d.terms ? " checked" : "") + ">" +
              "<span>I accept the Terms and the Privacy Policy <em>(required)</em></span></label>" +
            '<details class="details"><summary>What we do with your data</summary><ul>' +
              "<li>We only use the data needed to match you with partners.</li>" +
              "<li>We never share your real-time location. Only the gym you pick is used.</li>" +
              "<li>You can edit or delete all your data at any time (GDPR).</li>" +
            "</ul></details>" +
            '<p class="field-error" id="err-terms"></p>' +
            '<label class="check"><input type="checkbox" name="tips"' + (d.tips ? " checked" : "") + ">" +
              "<span>Email me training tips and news <em>(optional)</em></span></label>" +
          "</div>" +
          '<button type="submit" class="btn btn--primary">Create account ' + icon("arrow") + "</button>" +
        "</form>";
    },

    verify: function () {
      return top("#signup") +
        heading("Confirm your email", "We sent a 4-digit code to <strong>" + esc(draft.email) + "</strong>.") +
        '<form id="onb-form" data-screen="verify" novalidate>' +
          field("code", "Verification code", "text", "", "Prototype: the code is always " + DEMO_CODE + ".",
            'inputmode="numeric" autocomplete="one-time-code" maxlength="4" pattern="[0-9]*"') +
          '<button type="submit" class="btn btn--primary">Confirm email ' + icon("arrow") + "</button>" +
          '<div class="onb-links"><button type="button" class="link-btn" id="resend-code">Resend code</button>' +
            '<a class="link-btn" href="#signup">Wrong email? Change it</a></div>' +
        "</form>";
    },

    setup1: function () {
      var d = draft;
      return top(stepBack(1), 1) +
        heading("Select your gym", "We use it to show you its occupancy and people who train there.") +
        '<form id="onb-form" data-screen="setup1" novalidate>' +
          '<div class="search">' + icon("search") + '<label for="gym-search" class="sr-only">Search gyms by name or area</label>' +
            '<input id="gym-search" placeholder="Search by name or area" autocomplete="off" aria-controls="g-gym"></div>' +
          '<p class="hint hint--small onb-count" id="gym-count" aria-live="polite"></p>' +
          group("gym", "Gyms near you", "radio", GYMS, d.gym) +
          '<p class="notice">' + icon("lock") + "<span>Only the gym you choose is used for matching. GymBro never shares your real-time location.</span></p>" +
          '<button type="submit" class="btn btn--primary">' + nextLabel("Continue") + " " + icon("arrow") + "</button>" +
        "</form>";
    },

    setup2: function () {
      var d = draft;
      return top(stepBack(2), 2) +
        heading("When do you usually train?", "We match you with people who share your days and times. You can change this later.") +
        '<form id="onb-form" data-screen="setup2" novalidate>' +
          group("days", "Days", "checkbox", DAYS, d.days, { chips: true, hint: "Choose one or more." }) +
          group("slots", "Times", "checkbox", SLOTS, d.slots, { hint: "Choose one or more." }) +
          '<button type="submit" class="btn btn--primary">' + nextLabel("Continue") + " " + icon("arrow") + "</button>" +
        "</form>";
    },

    setup3: function () {
      var d = draft;
      return top(stepBack(3), 3) +
        heading("Your goal and level", "Partners with a similar goal and level appear first.") +
        '<form id="onb-form" data-screen="setup3" novalidate>' +
          group("goal", "What is your main goal?", "radio", GOALS, d.goal) +
          group("level", "What is your experience level?", "radio", LEVELS, d.level) +
          '<button type="submit" class="btn btn--primary">' + nextLabel("Continue") + " " + icon("arrow") + "</button>" +
        "</form>";
    },

    setup4: function () {
      var d = draft;
      return top(stepBack(4), 4) +
        heading("Almost there!", "Tell us what you want from GymBro and who can see your profile.") +
        '<form id="onb-form" data-screen="setup4" novalidate>' +
          group("uses", "What will you use GymBro for?", "checkbox", USES, d.uses, { hint: "Optional. It helps us order your Home screen." }) +
          group("visibility", "Who can see your profile?", "radio", VISIBILITY, d.visibility || "gym") +
          '<button type="submit" class="btn btn--primary">' + nextLabel("Review my profile") + " " + icon("arrow") + "</button>" +
          (backToReview ? "" : '<button type="button" class="btn btn--ghost" id="skip-step">Skip this step</button>') +
        "</form>";
    },

    review: function () {
      var d = draft;
      function row(title, value, step) {
        return '<div class="review-row"><div><p class="eyebrow">' + title + "</p><p>" + value + "</p></div>" +
          (step ? '<a class="link-btn" href="#setup/' + step + '" data-edit aria-label="Edit ' + title + '">Edit</a>' : "") + "</div>";
      }
      var g = find(GYMS, d.gym);
      var days = d.days.map(function (x) { return find(DAYS, x).short; }).join(", ");
      var slots = d.slots.map(function (x) { var s = find(SLOTS, x); return s.label + " (" + s.range + ")"; }).join(", ");
      var uses = (d.uses || []).map(function (x) { return find(USES, x).label; }).join(", ") || "Not specified";
      return top(editing ? "#profile" : "#setup/4") +
        heading(editing ? "Edit your profile" : "Review your profile", editing ? "Change any section, then save." : "Check everything is right. You can edit any section.") +
        '<div class="review">' +
          row("Account", esc(d.name) + " · " + esc(d.email) + " · " + esc(d.age) + " years", null) +
          row("Gym", esc(g.name) + '<br><small>' + esc(g.address) + "</small>", 1) +
          row("Schedule", esc(days) + "<br><small>" + esc(slots) + "</small>", 2) +
          row("Goal and level", esc(find(GOALS, d.goal).label) + " · " + esc(find(LEVELS, d.level).label), 3) +
          row("Uses and privacy", esc(uses) + "<br><small>Visible to: " + esc(find(VISIBILITY, d.visibility).label) + "</small>", 4) +
        "</div>" +
        '<button type="button" class="btn btn--primary" id="onb-finish">' + (editing ? "Save changes" : "Create my profile") + " " + icon("check") + "</button>";
    },

    done: function () {
      var a = account;
      return '<div class="onb-hero">' +
        '<div class="logo logo--ok" aria-hidden="true">' + icon("check") + "</div>" +
        '<h1 class="onb-title" tabindex="-1">You\'re all set, ' + esc(a.name) + "!</h1>" +
        '<p class="onb-sub">Your profile at ' + esc(gymName(a.gym)) + " is ready.</p>" +
        '<ul class="perks">' +
          "<li>" + icon("users") + "<span><strong>Find training partners.</strong> We already have suggestions that match your schedule.</span></li>" +
          "<li>" + icon("building") + "<span><strong>Check occupancy</strong> of each zone before you go.</span></li>" +
          "<li>" + icon("flag") + "<span><strong>Report how busy it is</strong> to help other members.</span></li>" +
        "</ul>" +
        '<div class="onb-actions"><a class="btn btn--primary" href="#partners">See my first matches ' + icon("arrow") + "</a></div>" +
        "</div>";
    }
  };

  /* ---------------- validation ---------------- */

  function setErr(name, msg) {
    var err = $("#err-" + name);
    if (err) err.textContent = msg || "";
    var input = $("#f-" + name);
    if (input) { if (msg) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid"); }
    var g = $("#g-" + name);
    if (g) g.classList.toggle("is-invalid", !!msg);
  }

  function firstFocusable(name) {
    return $("#f-" + name) || $('#g-' + name + ' input');
  }

  /* Shows all errors, moves focus to the first one. Returns true when valid. */
  function report(errors, order) {
    var first = null, count = 0;
    order.forEach(function (n) {
      setErr(n, errors[n]);
      if (errors[n]) { count++; if (!first) first = n; }
    });
    var sum = $("#form-summary");
    if (sum) sum.textContent = count > 1 ? count + " fields need your attention." : "";
    if (first) { var el = firstFocusable(first); if (el) el.focus(); }
    return !first;
  }

  function values(form, name) {
    return $all('input[name="' + name + '"]:checked', form).map(function (i) { return i.value; });
  }

  var SUBMIT = {
    signup: function (form) {
      var v = {
        name: form.name.value.trim(), email: form.email.value.trim().toLowerCase(), age: form.age.value.trim(),
        password: form.password.value, terms: form.terms.checked, tips: form.tips.checked
      };
      var e = {};
      if (!v.name) e.name = "Enter your name.";
      else if (v.name.length < 2) e.name = "Your name needs at least 2 characters.";
      if (!v.email) e.email = "Enter your email.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) e.email = "Check your email. It should look like name@example.com.";
      var n = Number(v.age);
      if (!v.age) e.age = "Enter your age.";
      else if (!/^\d{1,3}$/.test(v.age) || n < 1 || n > 120) e.age = "Enter your age as a number, for example 21.";
      else if (n < 18) e.age = "You must be 18 or older to use GymBro, because it arranges meetups with people you don't know.";
      if (!v.password) e.password = "Create a password.";
      else if (v.password.length < 8 || !/[A-Za-z]/.test(v.password) || !/\d/.test(v.password)) e.password = "Use at least 8 characters, with letters and numbers.";
      if (!v.terms) e.terms = "Accept the Terms and Privacy Policy to create your account.";
      if (!report(e, ["name", "email", "age", "password", "terms"])) return;

      var emailChanged = !draft || draft.email !== v.email;
      draft = Object.assign(draft || { days: [], slots: [], uses: [], visibility: "gym" },
        { name: v.name, email: v.email, age: n, terms: true, tips: v.tips });
      if (emailChanged) draft.verified = false;
      password = v.password;
      if (draft.verified) { location.hash = "#setup/1"; return; }
      UI().toast("Code sent to " + v.email);
      location.hash = "#verify";
    },

    verify: function (form) {
      var c = form.code.value.trim();
      var e = {};
      if (!c) e.code = "Enter the 4-digit code.";
      else if (!/^\d{4}$/.test(c)) e.code = "The code has 4 digits.";
      else if (c !== DEMO_CODE) e.code = "That code is not correct. Check the email sent to " + draft.email + " or tap Resend code.";
      if (!report(e, ["code"])) return;
      draft.verified = true;
      UI().toast("Email confirmed");
      UI().buzz(80);
      location.hash = "#setup/1";
    },

    setup1: function (form) {
      var g = values(form, "gym")[0];
      if (!report({ gym: g ? "" : "Choose your gym to continue." }, ["gym"])) {
        var s = $("#gym-search");
        if (s && s.value && !$all('#g-gym .choice:not([hidden])').length) { s.value = ""; filterGyms(""); }
        return;
      }
      draft.gym = g;
      next(2);
    },

    setup2: function (form) {
      var days = values(form, "days"), slots = values(form, "slots");
      if (!report({ days: days.length ? "" : "Choose at least one day.", slots: slots.length ? "" : "Choose at least one time." }, ["days", "slots"])) return;
      draft.days = days; draft.slots = slots;
      next(3);
    },

    setup3: function (form) {
      var goal = values(form, "goal")[0], level = values(form, "level")[0];
      if (!report({ goal: goal ? "" : "Choose your main goal.", level: level ? "" : "Choose your experience level." }, ["goal", "level"])) return;
      draft.goal = goal; draft.level = level;
      next(4);
    },

    setup4: function (form) {
      draft.uses = values(form, "uses");
      draft.visibility = values(form, "visibility")[0] || "gym";
      next(5);
    }
  };

  function next(step) {
    if (backToReview || step > STEPS) { backToReview = false; location.hash = "#review"; return; }
    location.hash = "#setup/" + step;
  }

  function filterGyms(q) {
    q = q.trim().toLowerCase();
    var shown = 0;
    $all("#g-gym .choice").forEach(function (lab) {
      var g = find(GYMS, $("input", lab).value);
      var match = !q || (g.name + " " + g.address).toLowerCase().indexOf(q) > -1;
      lab.hidden = !match;
      if (match) shown++;
    });
    $("#gym-count").textContent = q ? (shown ? shown + (shown === 1 ? " gym found" : " gyms found") : "No gyms match “" + q + "”. Try another name or area.") : "";
  }

  function finish() {
    var a = clone(draft);
    delete a.verified; delete a.terms;
    a.demo = false;
    account = a;
    save(a);
    UI().applyAccount(a);
    UI().buzz([60, 40, 60]);
    if (editing) {
      editing = false; draft = null;
      UI().toast("Profile updated");
      location.hash = "#profile";
    } else {
      draft = null; password = "";
      location.hash = "#done";
    }
  }

  /* ---------------- render + guards ---------------- */

  function render(name, parts) {
    var key = name;
    if (name === "setup") {
      var n = +parts[1];
      if (!(n >= 1 && n <= STEPS)) return redirect("#setup/1");
      key = "setup" + n;
    }
    // Guards: the flow can only be entered in order
    if ((name === "welcome" || name === "signup" || name === "verify") && account && !editing) return redirect("#home");
    if (name === "verify" && !draft) return redirect("#signup");
    if ((name === "setup" || name === "review") && !(draft && (draft.verified || editing))) return redirect(account ? "#profile" : "#welcome");
    if (name === "review" && !(draft.gym && draft.days.length && draft.goal && draft.level)) return redirect("#setup/1");
    if (name === "done" && !account) return redirect("#welcome");

    var main = $("#onb-main");
    main.innerHTML = SCREENS[key]();
    UI().hydrateIcons(main);
    var titles = { welcome: "Welcome", signup: "Sign up", verify: "Confirm email", setup: "Set up your profile", review: editing ? "Edit profile" : "Review", done: "All set" };
    document.title = titles[name] + " - GymBro";
    return true;
  }

  function redirect(hash) { location.replace(hash); return false; }

  /* ---------------- events ---------------- */

  document.addEventListener("submit", function (e) {
    if (e.target.id !== "onb-form") return;
    e.preventDefault();
    SUBMIT[e.target.getAttribute("data-screen")](e.target);
  });

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t.closest("#demo-login")) {
      account = clone(DEMO); save(account);
      UI().applyAccount(account);
      UI().toast("Logged in as Juan (demo)");
      location.hash = "#home";
    } else if (t.closest("#pw-toggle")) {
      var b = t.closest("#pw-toggle"), pw = $("#f-password"), show = pw.type === "password";
      pw.type = show ? "text" : "password";
      b.textContent = show ? "Hide" : "Show";
      b.setAttribute("aria-pressed", String(show));
    } else if (t.closest("#resend-code")) {
      UI().toast("New code sent to " + draft.email + " (prototype: " + DEMO_CODE + ")");
    } else if (t.closest("[data-edit]")) {
      backToReview = true;
    } else if (t.closest("#skip-step")) {
      draft.uses = draft.uses || []; draft.visibility = draft.visibility || "gym";
      next(5);
    } else if (t.closest("#onb-finish")) {
      finish();
    }
  });

  /* Keep choices as soon as they are made, so Back never loses data (P2 requirement) */
  var CAPTURE = {
    setup1: ["gym"], setup2: ["days", "slots"], setup3: ["goal", "level"], setup4: ["uses", "visibility"]
  };
  var SINGLE = { gym: 1, goal: 1, level: 1, visibility: 1 };
  function capture(form) {
    var names = CAPTURE[form.getAttribute("data-screen")];
    if (!names || !draft) return;
    names.forEach(function (n) {
      var v = values(form, n);
      draft[n] = SINGLE[n] ? v[0] : v;
    });
  }

  document.addEventListener("change", function (e) {
    var form = e.target.closest && e.target.closest("#onb-form");
    if (form) capture(form);
  });

  document.addEventListener("input", function (e) {
    var t = e.target;
    if (!t.closest || !t.closest("#onb-main")) return;
    if (t.id === "gym-search") { filterGyms(t.value); return; }
    if (t.name) setErr(t.name, "");
    var sum = $("#form-summary"); if (sum) sum.textContent = "";
  });

  /* ---------------- public API for app.js ---------------- */

  window.GymOnboarding = {
    handles: function (name) { return ROUTES.indexOf(name) > -1; },
    hasAccount: function () { return !!account; },
    account: function () { return account; },
    render: render,
    gymName: gymName,
    describe: describe,
    filtersFor: filtersFor,
    startEdit: function () { editing = true; backToReview = false; draft = clone(account); draft.verified = true; location.hash = "#review"; },
    logout: function () {
      account = null; draft = null; password = ""; editing = false; backToReview = false;
      try { localStorage.removeItem(KEY); } catch (e) {}
    }
  };
})();
