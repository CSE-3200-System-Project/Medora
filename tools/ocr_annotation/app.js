const $ = (selector) => document.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const rowFields = [
  ["medicine", "Medicine"], ["strength", "Strength"], ["dose", "Dose"],
  ["frequency", "Frequency"], ["duration", "Duration"], ["route", "Route"],
  ["quantity", "Quantity"], ["instructions", "Instructions"],
];

const state = {
  manifest: null,
  records: [],
  current: null,
  annotation: null,
  comparison: null,
  image: new Image(),
  imageScale: 1,
  boxTool: "rx",
  drawing: null,
  saveTimer: null,
  saving: false,
};

function blankAnnotation(record) {
  return {
    schema_version: "1.0.0",
    record_id: record.id,
    source_sha256: record.sha256,
    reviewer: { id: reviewerId(), role: reviewerRole(), credential_role: credentialRole() },
    annotation_version: 1,
    raw_transcription: "",
    boxes: [],
    medications: [],
    language: record.language,
    script: record.script,
    writer_or_template_group: record.writer_or_template_group,
    image_quality: { ...record.image_quality },
    flags: { uncertain: false, illegible: false },
    omissions: "",
    reviewer_notes: "",
    assisted_from: [],
    adjudication: { state: "not_started", disagreement: "", unresolved_fields: [] },
    updated_at: null,
  };
}

function reviewerId() { return $("#reviewerId").value.trim(); }
function reviewerRole() { return $("#reviewerRole").value; }
function credentialRole() { return $("#credentialRole").value; }
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}

async function fetchJson(url, options) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.detail?.message || `Request failed (${response.status})`);
  return payload;
}

async function initialize() {
  state.manifest = await fetchJson("/api/manifest");
  $("#reviewerId").value = localStorage.getItem("medora_annotation_reviewer") || "";
  $("#reviewerRole").value = localStorage.getItem("medora_annotation_role") || "primary";
  $("#credentialRole").value = localStorage.getItem("medora_annotation_credential") || "trained_author";
  bindEvents();
  updateRoleView();
  filterRecords();
  if (state.records.length) await selectRecord(state.records[0].id);
}

function bindEvents() {
  $("#reviewerId").addEventListener("change", () => {
    localStorage.setItem("medora_annotation_reviewer", reviewerId());
    if (state.annotation) state.annotation.reviewer.id = reviewerId();
    scheduleSave();
  });
  $("#reviewerRole").addEventListener("change", async () => {
    localStorage.setItem("medora_annotation_role", reviewerRole());
    updateRoleView();
    if (state.current) await selectRecord(state.current.id);
  });
  $("#credentialRole").addEventListener("change", () => {
    localStorage.setItem("medora_annotation_credential", credentialRole());
    if (state.annotation) state.annotation.reviewer.credential_role = credentialRole();
    scheduleSave();
  });
  ["#splitFilter", "#difficultyFilter", "#metricsOnly"].forEach((selector) => $(selector).addEventListener("change", filterRecords));
  $("#previousRecord").addEventListener("click", () => navigate(-1));
  $("#nextRecord").addEventListener("click", () => navigate(1));
  $("#saveNow").addEventListener("click", saveAnnotation);
  $("#addRow").addEventListener("click", () => addMedicationRow({}));
  $("#loadPrelabel").addEventListener("click", loadPrelabel);
  $("#undoBox").addEventListener("click", () => { state.annotation.boxes.pop(); renderCanvas(); renderBoxes(); scheduleSave(); });
  $$('[data-box-tool]').forEach((button) => button.addEventListener("click", () => setBoxTool(button.dataset.boxTool)));
  $("#shortcuts").addEventListener("click", () => $("#shortcutDialog").showModal());
  $("#closeShortcuts").addEventListener("click", () => $("#shortcutDialog").close());
  $("#sourceCanvas").addEventListener("pointerdown", startBox);
  $("#sourceCanvas").addEventListener("pointermove", moveBox);
  $("#sourceCanvas").addEventListener("pointerup", endBox);
  $("#sourceCanvas").addEventListener("pointercancel", endBox);
  document.addEventListener("input", handleFormInput);
  document.addEventListener("change", handleFormInput);
  document.addEventListener("keydown", handleKeyboard);
  window.addEventListener("resize", () => { if (state.current) drawImage(); });
}

function updateRoleView() {
  const independent = reviewerRole() === "independent";
  const adjudication = reviewerRole() === "adjudication";
  $("#blindNotice").classList.toggle("hidden", !independent);
  $("#loadPrelabel").classList.toggle("hidden", independent || adjudication);
  $("#adjudicationFields").classList.toggle("hidden", !adjudication);
}

function filterRecords() {
  const split = $("#splitFilter").value;
  const difficulty = $("#difficultyFilter").value;
  const metricsOnly = $("#metricsOnly").checked;
  state.records = state.manifest.records.filter((record) =>
    (!metricsOnly || record.included_in_metrics) &&
    (split === "all" || record.split === split) &&
    (difficulty === "all" || record.difficulty === difficulty));
  $("#queueSummary").textContent = `${state.records.length} shown · ${state.manifest.counts.unique} unique · ${state.manifest.counts.files} archived`;
  renderQueue();
}

function renderQueue() {
  const list = $("#recordQueue");
  list.innerHTML = "";
  state.records.forEach((record) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.recordId = record.id;
    button.setAttribute("aria-current", String(state.current?.id === record.id));
    button.innerHTML = `<strong>${escapeHtml(record.id)}</strong><span class="state-dot" aria-hidden="true"></span><small>${escapeHtml(record.difficulty)} · ${escapeHtml(record.split || "duplicate")}</small>`;
    button.addEventListener("click", () => selectRecord(record.id));
    item.append(button);
    list.append(item);
  });
}

async function selectRecord(recordId) {
  if (state.saving) return;
  const record = state.manifest.records.find((item) => item.id === recordId);
  if (!record) return;
  if (state.annotation && reviewerId()) await saveAnnotation();
  state.current = record;
  state.comparison = null;
  $("#recordTitle").textContent = `${record.id} · ${record.file.split("/").pop()}`;
  $("#recordDifficulty").textContent = `${record.difficulty} / ${record.split || "duplicate"}`;
  $("#recordHash").textContent = record.sha256;
  renderQueue();
  const query = new URLSearchParams({ record_id: record.id, role: reviewerRole() });
  const response = await fetchJson(`/api/annotation?${query}`);
  state.annotation = response.annotation || blankAnnotation(record);
  state.annotation.reviewer = { ...(state.annotation.reviewer || {}), id: reviewerId(), role: reviewerRole(), credential_role: credentialRole() };
  state.comparison = { primary: response.primary, independent: response.independent };
  populateForm();
  await loadImage(record);
  markSaveState(response.annotation ? "Loaded" : "New label", false);
}

function populateForm() {
  const annotation = state.annotation;
  $("#rawTranscription").value = annotation.raw_transcription || "";
  $("#language").value = annotation.language || "unreviewed";
  $("#script").value = annotation.script || "unreviewed";
  $("#writerTemplateGroup").value = annotation.writer_or_template_group === "unassigned" ? "" : (annotation.writer_or_template_group || "");
  $("#uncertain").checked = Boolean(annotation.flags?.uncertain);
  $("#illegible").checked = Boolean(annotation.flags?.illegible);
  $("#omissions").value = annotation.omissions || "";
  $("#reviewerNotes").value = annotation.reviewer_notes || "";
  $("#adjudicationState").value = annotation.adjudication?.state || "not_started";
  $("#disagreement").value = annotation.adjudication?.disagreement || "";
  $$('[data-quality]').forEach((select) => { select.value = annotation.image_quality?.[select.dataset.quality] || "unreviewed"; });
  $("#medicationRows").innerHTML = "";
  (annotation.medications || []).forEach(addMedicationRow);
  renderBoxes();
  renderComparison();
}

function addMedicationRow(values = {}) {
  const fragment = $("#rowTemplate").content.cloneNode(true);
  const article = fragment.querySelector("article");
  rowFields.forEach(([key, label]) => {
    const field = document.createElement("label");
    field.className = `field${key === "instructions" ? " full" : ""}`;
    field.innerHTML = `${label}<input data-row-key="${key}" value="${escapeHtml(values[key] || "")}" />`;
    article.querySelector(".row-fields").append(field);
  });
  article.querySelector('[data-row-key="uncertain"]').checked = Boolean(values.uncertain);
  article.querySelector(".remove-row").addEventListener("click", () => { article.remove(); renumberRows(); syncForm(); scheduleSave(); });
  $("#medicationRows").append(fragment);
  renumberRows();
  scheduleSave();
}

function renumberRows() { $$(".med-row .row-number").forEach((node, index) => { node.textContent = String(index + 1).padStart(2, "0"); }); }

function syncForm() {
  if (!state.annotation) return;
  state.annotation.reviewer = { ...(state.annotation.reviewer || {}), id: reviewerId(), role: reviewerRole(), credential_role: credentialRole() };
  state.annotation.raw_transcription = $("#rawTranscription").value;
  state.annotation.language = $("#language").value;
  state.annotation.script = $("#script").value;
  state.annotation.writer_or_template_group = $("#writerTemplateGroup").value.trim();
  state.annotation.flags = { uncertain: $("#uncertain").checked, illegible: $("#illegible").checked };
  state.annotation.omissions = $("#omissions").value;
  state.annotation.reviewer_notes = $("#reviewerNotes").value;
  state.annotation.image_quality = Object.fromEntries($$('[data-quality]').map((select) => [select.dataset.quality, select.value]));
  state.annotation.medications = $$(".med-row").map((row) => Object.fromEntries($$('[data-row-key]', row).map((input) => [input.dataset.rowKey, input.type === "checkbox" ? input.checked : input.value])));
  state.annotation.adjudication = {
    ...(state.annotation.adjudication || {}),
    state: $("#adjudicationState").value,
    disagreement: $("#disagreement").value,
    unresolved_fields: state.annotation.adjudication?.unresolved_fields || [],
  };
}

function handleFormInput(event) {
  if (!state.annotation || !event.target.closest(".labels-pane, .session-fields")) return;
  syncForm();
  scheduleSave();
}

function scheduleSave() {
  if (!state.annotation) return;
  clearTimeout(state.saveTimer);
  markSaveState("Unsaved", false);
  state.saveTimer = setTimeout(saveAnnotation, 700);
}

async function saveAnnotation() {
  clearTimeout(state.saveTimer);
  if (!state.annotation) return;
  if (!reviewerId()) { markSaveState("Reviewer required", true); $("#reviewerId").focus(); return; }
  syncForm();
  state.annotation.annotation_version = Number(state.annotation.annotation_version || 0) + 1;
  state.annotation.updated_at = new Date().toISOString();
  if (reviewerRole() === "independent") state.annotation.assisted_from = [];
  state.saving = true;
  markSaveState("Saving…", false);
  try {
    await fetchJson("/api/annotation", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state.annotation) });
    markSaveState(`Saved v${state.annotation.annotation_version}`, false, true);
    const active = $(`[data-record-id="${state.current.id}"] .state-dot`);
    if (active) active.classList.add("done");
  } catch (error) {
    markSaveState(error.message, true);
  } finally { state.saving = false; }
}

function markSaveState(message, error = false, saved = false) {
  const node = $("#saveState");
  node.textContent = message;
  node.title = message;
  node.classList.toggle("error", error);
  node.classList.toggle("saved", saved);
}

async function loadPrelabel() {
  if (!state.current || reviewerRole() !== "primary") return;
  try {
    const query = new URLSearchParams({ record_id: state.current.id, role: reviewerRole() });
    const response = await fetchJson(`/api/prelabel?${query}`);
    if (!response.prelabel) throw new Error("No cached assisted draft exists for this record.");
    const reviewer = state.annotation.reviewer;
    state.annotation = { ...blankAnnotation(state.current), ...response.prelabel, reviewer, record_id: state.current.id, source_sha256: state.current.sha256 };
    state.annotation.assisted_from = response.prelabel.assisted_from || ["cached-pipeline-draft"];
    populateForm();
    scheduleSave();
  } catch (error) { markSaveState(error.message, true); }
}

function loadImage(record) {
  return new Promise((resolve, reject) => {
    state.image = new Image();
    state.image.onload = () => { drawImage(); resolve(); };
    state.image.onerror = reject;
    state.image.src = `/${encodeURI(record.file)}`;
  });
}

function drawImage() {
  const canvas = $("#sourceCanvas");
  const shellWidth = Math.max(320, $(".canvas-shell").clientWidth - 2);
  state.imageScale = Math.min(1, shellWidth / state.image.naturalWidth);
  canvas.width = Math.round(state.image.naturalWidth * state.imageScale);
  canvas.height = Math.round(state.image.naturalHeight * state.imageScale);
  renderCanvas();
}

function renderCanvas() {
  const canvas = $("#sourceCanvas");
  const context = canvas.getContext("2d");
  if (!state.image.complete) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(state.image, 0, 0, canvas.width, canvas.height);
  [...(state.annotation?.boxes || []), ...(state.drawing ? [state.drawing] : [])].forEach((box) => {
    context.strokeStyle = box.type === "rx" ? "#00a56f" : "#e18315";
    context.lineWidth = 3;
    context.setLineDash(box.type === "rx" ? [] : [6, 4]);
    context.strokeRect(box.x * canvas.width, box.y * canvas.height, box.width * canvas.width, box.height * canvas.height);
    context.fillStyle = context.strokeStyle;
    context.font = "700 12px system-ui";
    context.fillText(box.type.toUpperCase(), box.x * canvas.width + 4, box.y * canvas.height + 15);
  });
  context.setLineDash([]);
  renderCrop();
}

function pointOnCanvas(event) {
  const rect = $("#sourceCanvas").getBoundingClientRect();
  return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
}
function startBox(event) {
  if (!state.annotation) return;
  event.currentTarget.setPointerCapture(event.pointerId);
  const point = pointOnCanvas(event);
  state.drawing = { id: crypto.randomUUID(), type: state.boxTool, x: point.x, y: point.y, width: 0, height: 0, transcription: "" };
}
function moveBox(event) {
  if (!state.drawing) return;
  const point = pointOnCanvas(event);
  const startX = state.drawing.x;
  const startY = state.drawing.y;
  state.drawing.width = point.x - startX;
  state.drawing.height = point.y - startY;
  renderCanvas();
}
function endBox() {
  if (!state.drawing) return;
  let box = state.drawing;
  if (box.width < 0) box = { ...box, x: box.x + box.width, width: -box.width };
  if (box.height < 0) box = { ...box, y: box.y + box.height, height: -box.height };
  state.drawing = null;
  if (box.width > .005 && box.height > .005) state.annotation.boxes.push(box);
  renderCanvas(); renderBoxes(); scheduleSave();
}

function renderCrop() {
  const crop = $("#cropCanvas");
  const box = state.annotation?.boxes?.find((item) => item.type === "rx");
  if (!box) { crop.width = 1; crop.height = 1; return; }
  const sx = box.x * state.image.naturalWidth, sy = box.y * state.image.naturalHeight;
  const sw = box.width * state.image.naturalWidth, sh = box.height * state.image.naturalHeight;
  const maxWidth = 900;
  const scale = Math.min(1, maxWidth / sw);
  crop.width = Math.max(1, Math.round(sw * scale)); crop.height = Math.max(1, Math.round(sh * scale));
  crop.getContext("2d").drawImage(state.image, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
}

function renderBoxes() {
  const container = $("#boxList");
  container.innerHTML = "";
  (state.annotation?.boxes || []).forEach((box, index) => {
    const node = document.createElement("div"); node.className = "box-item";
    node.innerHTML = `<strong>${escapeHtml(box.type)} ${index + 1}</strong><code>x ${box.x.toFixed(3)} · y ${box.y.toFixed(3)} · w ${box.width.toFixed(3)} · h ${box.height.toFixed(3)}</code><button aria-label="Delete box ${index + 1}">Delete</button>${box.type === "line" ? `<input aria-label="Line ${index + 1} transcription" placeholder="Exact line transcription" value="${escapeHtml(box.transcription || "")}" />` : ""}`;
    node.querySelector("button").addEventListener("click", () => { state.annotation.boxes.splice(index, 1); renderCanvas(); renderBoxes(); scheduleSave(); });
    const input = node.querySelector("input");
    if (input) input.addEventListener("input", () => { box.transcription = input.value; scheduleSave(); });
    container.append(node);
  });
}

function setBoxTool(tool) {
  state.boxTool = tool;
  $$('[data-box-tool]').forEach((button) => button.classList.toggle("active", button.dataset.boxTool === tool));
}

function renderComparison() {
  const container = $("#comparison");
  container.innerHTML = "";
  if (reviewerRole() !== "adjudication") return;
  [["Primary", state.comparison?.primary], ["Independent", state.comparison?.independent]].forEach(([label, data]) => {
    const block = document.createElement("div");
    const heading = document.createElement("strong"); heading.textContent = label;
    const pre = document.createElement("pre");
    pre.textContent = data ? JSON.stringify({ raw_transcription: data.raw_transcription, medications: data.medications, flags: data.flags }, null, 2) : "Label not submitted";
    block.append(heading, pre); container.append(block);
  });
}

function navigate(delta) {
  const index = state.records.findIndex((record) => record.id === state.current?.id);
  const target = state.records[index + delta];
  if (target) selectRecord(target.id);
}

function handleKeyboard(event) {
  const editing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); saveAnnotation(); return; }
  if (editing) return;
  const key = event.key.toLowerCase();
  if (key === "j") navigate(1);
  else if (key === "k") navigate(-1);
  else if (key === "r") setBoxTool("rx");
  else if (key === "l") setBoxTool("line");
  else if (key === "n") addMedicationRow({});
  else if (key === "s") saveAnnotation();
  else if (key === "?") $("#shortcutDialog").showModal();
}

initialize().catch((error) => { markSaveState(error.message, true); console.error(error); });
