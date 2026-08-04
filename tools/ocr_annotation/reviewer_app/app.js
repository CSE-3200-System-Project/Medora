/* Medora prescription Rx review — blinded independent reviewer client.
 *
 * Deliberately dependency-free and small. The reviewer's machine may be an
 * ordinary clinic laptop with no toolchain, so this is plain ES2018 that any
 * current browser runs directly.
 */
(function () {
  "use strict";

  var FIELDS = ["medicine", "strength", "dose", "frequency", "duration", "route", "quantity", "instructions"];
  var state = {
    records: [],
    index: 0,
    completed: {},
    reviewer: null,
    zoom: 1,
    rotation: 0,
    panX: 0,
    panY: 0,
    dirty: false,
  };

  function $(id) { return document.getElementById(id); }
  function show(el) { el.hidden = false; }
  function hide(el) { el.hidden = true; }

  function api(path, options) {
    return fetch(path, options).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) { throw new Error(body.error || "Request failed"); }
        return body;
      });
    });
  }

  // ---------------- boot ----------------

  Promise.all([
    api("/api/manifest"),
    api("/api/reviewer"),
    api("/api/progress"),
  ]).then(function (results) {
    state.records = results[0].records;
    state.reviewer = results[1].reviewer;
    results[2].completed.forEach(function (id) { state.completed[id] = true; });

    $("gate-count").textContent = String(state.records.length);
    $("total").textContent = String(state.records.length);

    if (state.reviewer) {
      $("r-name").value = state.reviewer.full_name || "";
      $("r-role").value = state.reviewer.credential_role || "";
      $("r-reg").value = state.reviewer.registration_number || "";
      $("r-id").value = state.reviewer.id || "";
      $("r-attest").checked = true;
      enterApp();
    }
  }).catch(function (error) {
    $("gate-error").textContent = error.message;
    show($("gate-error"));
  });

  // ---------------- gate ----------------

  $("gate-start").addEventListener("click", function () {
    var payload = {
      id: $("r-id").value.trim(),
      full_name: $("r-name").value.trim(),
      credential_role: $("r-role").value,
      registration_number: $("r-reg").value.trim(),
      attestation_accepted: $("r-attest").checked,
      role: "independent",
    };
    hide($("gate-error"));
    api("/api/reviewer", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(function () {
      state.reviewer = payload;
      enterApp();
    }).catch(function (error) {
      $("gate-error").textContent = error.message;
      show($("gate-error"));
    });
  });

  function enterApp() {
    hide($("gate"));
    show($("app"));
    // Resume at the first unsaved record so a reviewer returning after a break
    // does not have to hunt for their place.
    var next = state.records.findIndex(function (r) { return !state.completed[r.id]; });
    state.index = next === -1 ? 0 : next;
    load();
  }

  // ---------------- record loading ----------------

  function current() { return state.records[state.index]; }

  function load() {
    var record = current();
    $("record-label").textContent = record.id;
    $("pos").textContent = String(state.index + 1);
    $("image").src = "/images/" + record.image;
    resetView();
    clearForm();
    hide($("form-error"));
    hide($("saved-note"));

    api("/api/annotation?record_id=" + encodeURIComponent(record.id)).then(function (body) {
      if (body.annotation) { fill(body.annotation); }
      state.dirty = false;
    });
    refreshProgress();
  }

  function refreshProgress() {
    var done = Object.keys(state.completed).length;
    $("done-count").textContent = String(done);
    $("progress-fill").style.width = (done / state.records.length * 100).toFixed(1) + "%";
  }

  function clearForm() {
    $("transcription").value = "";
    $("notes").value = "";
    $("f-illegible").checked = false;
    $("f-uncertain").checked = false;
    $("f-norx").checked = false;
    $("med-rows").innerHTML = "";
  }

  function fill(annotation) {
    $("transcription").value = annotation.raw_transcription || "";
    $("notes").value = annotation.reviewer_notes || "";
    var flags = annotation.flags || {};
    $("f-illegible").checked = !!flags.illegible;
    $("f-uncertain").checked = !!flags.uncertain;
    $("f-norx").checked = !!flags.no_rx_section;
    (annotation.medications || []).forEach(addMedRow);
  }

  // ---------------- medication rows ----------------

  function addMedRow(values) {
    var row = document.createElement("div");
    row.className = "med-row";
    FIELDS.forEach(function (field) {
      var input = document.createElement("input");
      input.type = "text";
      input.dataset.field = field;
      input.placeholder = field;
      input.value = (values && values[field]) || "";
      input.addEventListener("input", function () { state.dirty = true; });
      row.appendChild(input);
    });
    var remove = document.createElement("button");
    remove.className = "ghost small";
    remove.textContent = "×";
    remove.title = "Remove this medicine";
    remove.addEventListener("click", function () { row.remove(); state.dirty = true; });
    row.appendChild(remove);
    $("med-rows").appendChild(row);
  }

  $("btn-add-med").addEventListener("click", function () { addMedRow(null); });

  function collectMeds() {
    return Array.prototype.map.call($("med-rows").children, function (row) {
      var values = {};
      Array.prototype.forEach.call(row.querySelectorAll("input"), function (input) {
        values[input.dataset.field] = input.value.trim();
      });
      return values;
    }).filter(function (values) {
      return FIELDS.some(function (field) { return values[field]; });
    });
  }

  // ---------------- save / navigate ----------------

  function save() {
    var record = current();
    var text = $("transcription").value.trim();
    var noRx = $("f-norx").checked;
    if (!text && !noRx) {
      $("form-error").textContent =
        "Enter the Rx transcription, or tick “no readable Rx section” if there is nothing to transcribe.";
      show($("form-error"));
      return Promise.reject(new Error("empty"));
    }
    hide($("form-error"));

    var payload = {
      record_id: record.id,
      raw_transcription: text,
      medications: collectMeds(),
      boxes: [],
      scope: "rx_section_only",
      flags: {
        illegible: $("f-illegible").checked,
        uncertain: $("f-uncertain").checked,
        no_rx_section: noRx,
      },
      omissions: "",
      reviewer_notes: $("notes").value.trim(),
      review_state: "independent_human_review",
    };
    return api("/api/annotation", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(function () {
      state.completed[record.id] = true;
      state.dirty = false;
      refreshProgress();
      var note = $("saved-note");
      show(note);
      setTimeout(function () { hide(note); }, 1200);
    });
  }

  function go(delta) {
    var next = state.index + delta;
    if (next < 0 || next >= state.records.length) { return; }
    state.index = next;
    load();
  }

  $("btn-save").addEventListener("click", function () {
    save().then(function () {
      if (state.index < state.records.length - 1) { go(1); } else { openDone(); }
    }).catch(function () { /* validation already surfaced */ });
  });
  $("btn-prev").addEventListener("click", function () { go(-1); });
  $("btn-skip").addEventListener("click", function () { go(1); });

  window.addEventListener("beforeunload", function (event) {
    if (state.dirty) { event.preventDefault(); event.returnValue = ""; }
  });
  ["transcription", "notes"].forEach(function (id) {
    $(id).addEventListener("input", function () { state.dirty = true; });
  });

  // ---------------- export ----------------

  function openDone() {
    var done = Object.keys(state.completed).length;
    var total = state.records.length;
    $("done-summary").textContent = done === total
      ? "All " + total + " records are saved."
      : done + " of " + total + " records are saved. You can export now and send an updated file later.";
    hide($("app"));
    show($("done"));
  }
  $("btn-export").addEventListener("click", openDone);
  $("btn-back").addEventListener("click", function () { hide($("done")); show($("app")); });

  // ---------------- image view ----------------

  function resetView() {
    state.zoom = 1; state.rotation = 0; state.panX = 0; state.panY = 0;
    applyView();
  }
  function applyView() {
    $("image").style.transform =
      "translate(" + state.panX + "px," + state.panY + "px) scale(" + state.zoom + ") rotate(" + state.rotation + "deg)";
  }
  function zoom(factor) {
    state.zoom = Math.min(8, Math.max(0.2, state.zoom * factor));
    applyView();
  }

  document.querySelectorAll("[data-zoom]").forEach(function (button) {
    button.addEventListener("click", function () {
      var mode = button.dataset.zoom;
      if (mode === "in") { zoom(1.25); }
      else if (mode === "out") { zoom(0.8); }
      else { resetView(); }
    });
  });
  document.querySelectorAll("[data-rotate]").forEach(function (button) {
    button.addEventListener("click", function () {
      state.rotation += button.dataset.rotate === "left" ? -90 : 90;
      applyView();
    });
  });

  var viewport = $("viewport");
  viewport.addEventListener("wheel", function (event) {
    event.preventDefault();
    zoom(event.deltaY < 0 ? 1.12 : 0.89);
  }, { passive: false });

  var dragging = false, startX = 0, startY = 0;
  viewport.addEventListener("mousedown", function (event) {
    dragging = true; startX = event.clientX - state.panX; startY = event.clientY - state.panY;
    viewport.classList.add("grabbing");
  });
  window.addEventListener("mousemove", function (event) {
    if (!dragging) { return; }
    state.panX = event.clientX - startX; state.panY = event.clientY - startY; applyView();
  });
  window.addEventListener("mouseup", function () {
    dragging = false; viewport.classList.remove("grabbing");
  });

  // ---------------- keyboard ----------------

  document.addEventListener("keydown", function (event) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
    if (event.ctrlKey && event.key === "Enter") {
      event.preventDefault();
      $("btn-save").click();
      return;
    }
    if (event.altKey && event.key === "ArrowRight") { event.preventDefault(); go(1); return; }
    if (event.altKey && event.key === "ArrowLeft") { event.preventDefault(); go(-1); return; }
    if (typing) { return; }
    if (event.key === "+" || event.key === "=") { zoom(1.25); }
    else if (event.key === "-") { zoom(0.8); }
    else if (event.key === "0") { resetView(); }
    else if (event.key === "[") { state.rotation -= 90; applyView(); }
    else if (event.key === "]") { state.rotation += 90; applyView(); }
  });
})();
