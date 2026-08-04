/* Identifier redaction marking. Boxes are stored in normalized 0-1 coordinates so
 * the marks stay valid regardless of display scale or zoom. */
(function () {
  "use strict";

  var state = {
    records: [],
    categories: [],
    index: 0,
    completed: {},
    boxes: [],
    absent: {},
    activeCategory: null,
    zoom: 1,
  };

  function $(id) { return document.getElementById(id); }

  function api(path, options) {
    return fetch(path, options).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok) { throw new Error(body.error || "Request failed"); }
        return body;
      });
    });
  }

  Promise.all([api("/api/records"), api("/api/progress")]).then(function (results) {
    state.records = results[0].records;
    state.categories = results[0].categories;
    state.outOfScope = results[0].out_of_scope || [];
    state.activeCategory = state.categories[0];
    results[1].completed.forEach(function (id) { state.completed[id] = true; });
    $("total").textContent = String(state.records.length);
    buildChecklist();
    var next = state.records.findIndex(function (r) { return !state.completed[r.id]; });
    state.index = next === -1 ? 0 : next;
    load();
  });

  // ---------------- checklist ----------------

  function buildChecklist() {
    var host = $("checklist");
    host.innerHTML = "";
    state.categories.forEach(function (category) {
      var row = document.createElement("div");
      row.className = "cat-row";
      row.dataset.category = category;

      var pick = document.createElement("button");
      pick.className = "cat-name";
      pick.textContent = category.replace(/_/g, " ");
      pick.addEventListener("click", function () {
        state.activeCategory = category;
        $("active-cat").textContent = category;
        renderChecklist();
      });

      var count = document.createElement("span");
      count.className = "cat-count";

      var absent = document.createElement("label");
      absent.className = "cat-absent";
      var box = document.createElement("input");
      box.type = "checkbox";
      box.addEventListener("change", function () {
        state.absent[category] = box.checked;
        renderChecklist();
      });
      absent.appendChild(box);
      absent.appendChild(document.createTextNode(" not present"));

      row.appendChild(pick);
      row.appendChild(count);
      row.appendChild(absent);
      host.appendChild(row);
    });

    // State the retained fields on screen. If a marker sees "doctor name" missing from
    // the checklist they may assume it was forgotten; it was not.
    if (state.outOfScope.length) {
      var note = document.createElement("p");
      note.className = "scope-note";
      note.textContent =
        "Deliberately published, do not box: " +
        state.outOfScope.join(", ").replace(/_/g, " ") +
        ".";
      host.appendChild(note);
    }
    renderChecklist();
  }

  function renderChecklist() {
    Array.prototype.forEach.call($("checklist").children, function (row) {
      var category = row.dataset.category;
      var count = state.boxes.filter(function (b) { return b.category === category; }).length;
      var absent = !!state.absent[category];
      row.querySelector(".cat-count").textContent = count ? count + " box" + (count > 1 ? "es" : "") : "";
      row.querySelector("input").checked = absent;
      row.querySelector("input").disabled = count > 0;
      row.classList.toggle("resolved", count > 0 || absent);
      row.classList.toggle("active", category === state.activeCategory);
    });
    $("active-cat").textContent = state.activeCategory;
  }

  // ---------------- record ----------------

  function current() { return state.records[state.index]; }

  function load() {
    var record = current();
    $("record-label").textContent = record.id;
    $("pos").textContent = String(state.index + 1);
    $("image").src = "/image/" + record.id;
    state.boxes = [];
    state.absent = {};
    $("notes").value = "";
    hide($("error")); hide($("saved"));

    api("/api/marks?record_id=" + encodeURIComponent(record.id)).then(function (body) {
      if (body.marks) {
        state.boxes = body.marks.boxes || [];
        (body.marks.categories_absent || []).forEach(function (c) { state.absent[c] = true; });
        $("notes").value = body.marks.notes || "";
      }
      drawBoxes();
      renderChecklist();
    });
    refreshProgress();
  }

  function refreshProgress() {
    var done = Object.keys(state.completed).length;
    $("done-count").textContent = String(done);
    $("progress-fill").style.width = (done / state.records.length * 100).toFixed(1) + "%";
  }

  function hide(el) { el.hidden = true; }
  function show(el) { el.hidden = false; }

  // ---------------- drawing ----------------

  var overlay = $("overlay");
  var wrap = $("canvas-wrap");
  var drawing = false, startX = 0, startY = 0, ghost = null;

  function relative(event) {
    var rect = $("image").getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  wrap.addEventListener("mousedown", function (event) {
    if (event.button !== 0) { return; }
    event.preventDefault();
    drawing = true;
    var point = relative(event);
    startX = point.x; startY = point.y;
    ghost = document.createElement("div");
    ghost.className = "box ghost";
    overlay.appendChild(ghost);
  });

  window.addEventListener("mousemove", function (event) {
    if (!drawing) { return; }
    var point = relative(event);
    place(ghost, Math.min(startX, point.x), Math.min(startY, point.y),
      Math.abs(point.x - startX), Math.abs(point.y - startY));
  });

  window.addEventListener("mouseup", function (event) {
    if (!drawing) { return; }
    drawing = false;
    var point = relative(event);
    var box = {
      x: Math.min(startX, point.x),
      y: Math.min(startY, point.y),
      w: Math.abs(point.x - startX),
      h: Math.abs(point.y - startY),
      category: state.activeCategory,
    };
    if (ghost) { ghost.remove(); ghost = null; }
    // Ignore stray clicks that produce a sliver.
    if (box.w < 0.005 || box.h < 0.005) { return; }
    state.boxes.push(box);
    drawBoxes();
    renderChecklist();
  });

  function place(el, x, y, w, h) {
    el.style.left = (x * 100) + "%";
    el.style.top = (y * 100) + "%";
    el.style.width = (w * 100) + "%";
    el.style.height = (h * 100) + "%";
  }

  function drawBoxes() {
    overlay.innerHTML = "";
    state.boxes.forEach(function (box, index) {
      var el = document.createElement("div");
      el.className = "box";
      el.title = box.category + " — click to remove";
      place(el, box.x, box.y, box.w, box.h);
      var tag = document.createElement("span");
      tag.textContent = box.category.replace(/_/g, " ");
      el.appendChild(tag);
      el.addEventListener("click", function (event) {
        event.stopPropagation();
        state.boxes.splice(index, 1);
        drawBoxes();
        renderChecklist();
      });
      overlay.appendChild(el);
    });
  }

  $("btn-undo").addEventListener("click", function () {
    state.boxes.pop();
    drawBoxes();
    renderChecklist();
  });

  // ---------------- zoom ----------------

  function applyZoom() { wrap.style.width = (state.zoom * 100) + "%"; }
  document.querySelectorAll("[data-zoom]").forEach(function (button) {
    button.addEventListener("click", function () {
      var mode = button.dataset.zoom;
      if (mode === "in") { state.zoom = Math.min(4, state.zoom * 1.25); }
      else if (mode === "out") { state.zoom = Math.max(0.4, state.zoom * 0.8); }
      else { state.zoom = 1; }
      applyZoom();
    });
  });

  // ---------------- save / navigate ----------------

  function save() {
    var absent = Object.keys(state.absent).filter(function (c) { return state.absent[c]; });
    var payload = {
      record_id: current().id,
      boxes: state.boxes,
      categories_absent: absent,
      notes: $("notes").value.trim(),
    };
    return api("/api/marks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(function () {
      state.completed[current().id] = true;
      hide($("error"));
      show($("saved"));
      setTimeout(function () { hide($("saved")); }, 1000);
      refreshProgress();
    }).catch(function (error) {
      $("error").textContent = error.message;
      show($("error"));
      throw error;
    });
  }

  function go(delta) {
    var next = state.index + delta;
    if (next < 0 || next >= state.records.length) { return; }
    state.index = next;
    load();
  }

  $("btn-save").addEventListener("click", function () {
    save().then(function () { go(1); }).catch(function () {});
  });
  $("btn-prev").addEventListener("click", function () { go(-1); });
  $("btn-next").addEventListener("click", function () { go(1); });

  document.addEventListener("keydown", function (event) {
    if (/^(INPUT|TEXTAREA)$/.test(event.target.tagName)) { return; }
    if (event.ctrlKey && event.key === "Enter") { $("btn-save").click(); }
    else if (event.key === "ArrowRight") { go(1); }
    else if (event.key === "ArrowLeft") { go(-1); }
    else if (event.key === "z") { $("btn-undo").click(); }
    else if (/^[0-9]$/.test(event.key)) {
      var idx = (parseInt(event.key, 10) + 9) % 10;
      if (state.categories[idx]) { state.activeCategory = state.categories[idx]; renderChecklist(); }
    }
  });
})();
