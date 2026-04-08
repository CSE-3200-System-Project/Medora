import type { FullPrescriptionResponse } from "@/lib/prescription-actions";

type BuildClinicalPrescriptionDocumentOptions = {
  consultationId: string;
  generatedAtIso?: string;
};

function escapeHtml(value: unknown): string {
  const text = typeof value === "string" ? value : value == null ? "" : String(value);
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateTime(value?: string): string {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return escapeHtml(
    date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  );
}

function buildDigitalHash(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return `MDR-${Math.abs(hash).toString(16).toUpperCase().padStart(8, "0")}`;
}

function titleCaseWords(value?: string): string {
  if (!value?.trim()) return "N/A";
  return value
    .trim()
    .replaceAll("_", " ")
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function buildClinicalPrescriptionDocumentHtml(
  data: FullPrescriptionResponse,
  options: BuildClinicalPrescriptionDocumentOptions
): string {
  const generatedAtIso = options.generatedAtIso || new Date().toISOString();
  const documentHash = buildDigitalHash(`${options.consultationId}:${data.consultation?.date || ""}`);

  const medicationsHtml =
    data.medications.length === 0
      ? `
        <tr>
          <td colspan="4" class="mcrx-empty-row">No medications prescribed.</td>
        </tr>
      `
      : data.medications
          .map((medication) => {
            const nameStrength = `${escapeHtml(medication.medicine_name)}${
              medication.strength ? ` ${escapeHtml(medication.strength)}` : ""
            }`;
            const dosage = escapeHtml(medication.dosage_pattern || medication.frequency_text || "As directed");
            const route = escapeHtml(medication.route || "As directed");
            const meal = medication.meal_instruction
              ? `<div class="mcrx-subline">${escapeHtml(titleCaseWords(medication.meal_instruction))}</div>`
              : "";
            const duration = escapeHtml(medication.duration || "As advised");
            const quantity =
              typeof medication.quantity === "number"
                ? `<div class="mcrx-subline">Qty: ${escapeHtml(medication.quantity)}</div>`
                : "";

            return `
              <tr>
                <td>${nameStrength}</td>
                <td>${dosage}</td>
                <td>${route}${meal}</td>
                <td>${duration}${quantity}</td>
              </tr>
            `;
          })
          .join("");

  const testsHtml =
    data.tests.length === 0
      ? `<p class="mcrx-muted">No tests requested.</p>`
      : data.tests
          .map(
            (test) => `
            <div class="mcrx-item">
              <p class="mcrx-item-title">${escapeHtml(test.test_name)}</p>
              ${test.urgency ? `<p class="mcrx-item-urgency">${escapeHtml(String(test.urgency).toUpperCase())}</p>` : ""}
              ${test.instructions ? `<p class="mcrx-item-note">${escapeHtml(test.instructions)}</p>` : ""}
            </div>
          `
          )
          .join("");

  const proceduresHtml =
    data.procedures.length === 0
      ? `<p class="mcrx-muted">No procedures advised.</p>`
      : data.procedures
          .map(
            (procedure) => `
            <div class="mcrx-item">
              <p class="mcrx-item-title">${escapeHtml(procedure.procedure_name)}</p>
              ${procedure.urgency ? `<p class="mcrx-item-urgency">${escapeHtml(String(procedure.urgency).toUpperCase())}</p>` : ""}
              ${procedure.notes ? `<p class="mcrx-item-note">${escapeHtml(procedure.notes)}</p>` : ""}
              ${procedure.reason ? `<p class="mcrx-item-note">${escapeHtml(procedure.reason)}</p>` : ""}
            </div>
          `
          )
          .join("");

  return `
    <article class="mcrx-document">
      <style>
        .mcrx-document {
          font-family: "Times New Roman", Georgia, serif;
          color: #101828;
          background: #ffffff;
          border: 1px solid #d0d5dd;
          padding: 24px;
        }
        .mcrx-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 1px solid #d0d5dd;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .mcrx-brand {
          color: #0a4cc5;
          font-size: 30px;
          line-height: 1.1;
          margin: 0;
          font-weight: 700;
        }
        .mcrx-brand-sub {
          margin: 2px 0 0;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #344054;
        }
        .mcrx-provider {
          text-align: right;
          max-width: 320px;
        }
        .mcrx-provider p {
          margin: 0;
          line-height: 1.35;
        }
        .mcrx-provider .mcrx-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-weight: 700;
        }
        .mcrx-provider .mcrx-value {
          font-size: 14px;
          font-weight: 600;
        }
        .mcrx-provider .mcrx-sub {
          font-size: 12px;
          color: #475467;
        }
        .mcrx-title {
          border: 1px solid #d0d5dd;
          background: #f9fafb;
          text-align: center;
          padding: 10px;
          margin-bottom: 16px;
          font-size: 16px;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          font-weight: 700;
        }
        .mcrx-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
          border-bottom: 1px solid #d0d5dd;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .mcrx-grid p {
          margin: 4px 0;
          font-size: 14px;
        }
        .mcrx-grid .mcrx-col-title {
          margin: 0 0 8px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #0a4cc5;
          font-weight: 700;
        }
        .mcrx-table-wrap {
          border: 1px solid #d0d5dd;
          overflow-x: auto;
        }
        .mcrx-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 640px;
          font-size: 14px;
        }
        .mcrx-table thead {
          background: #f2f4f7;
          color: #475467;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .mcrx-table th,
        .mcrx-table td {
          padding: 10px 12px;
          text-align: left;
          vertical-align: top;
        }
        .mcrx-table tbody tr {
          border-top: 1px solid #eaecf0;
        }
        .mcrx-empty-row {
          color: #667085;
        }
        .mcrx-subline {
          margin-top: 2px;
          font-size: 12px;
          color: #667085;
        }
        .mcrx-section-label {
          margin: 0 0 8px;
          font-size: 15px;
          font-weight: 700;
        }
        .mcrx-dual-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-top: 16px;
        }
        .mcrx-panel {
          border: 1px solid #d0d5dd;
          padding: 12px;
        }
        .mcrx-item {
          border: 1px solid #eaecf0;
          border-radius: 4px;
          padding: 6px 8px;
          margin-bottom: 8px;
          font-size: 14px;
        }
        .mcrx-item-title {
          margin: 0;
          font-weight: 600;
        }
        .mcrx-item-urgency {
          margin: 2px 0 0;
          font-size: 11px;
          color: #b42318;
          letter-spacing: 0.05em;
        }
        .mcrx-item-note {
          margin: 2px 0 0;
          font-size: 12px;
          color: #667085;
        }
        .mcrx-muted {
          margin: 0;
          font-size: 14px;
          color: #667085;
        }
        .mcrx-notes {
          border: 1px solid #d0d5dd;
          padding: 12px;
          margin-top: 16px;
          font-size: 14px;
          line-height: 1.55;
          white-space: pre-wrap;
        }
        .mcrx-footer {
          border-top: 1px solid #d0d5dd;
          margin-top: 16px;
          padding-top: 12px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          font-size: 12px;
          color: #667085;
        }
        .mcrx-hash-label {
          margin: 0;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-weight: 700;
          color: #475467;
        }
        .mcrx-hash-value {
          margin: 4px 0 0;
          display: inline-block;
          border: 1px solid #eaecf0;
          background: #f9fafb;
          padding: 4px 8px;
          font-size: 11px;
          color: #344054;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }
        .mcrx-sign {
          text-align: right;
        }
        .mcrx-sign .mcrx-sign-name {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: #101828;
        }
        .mcrx-sign p {
          margin: 2px 0 0;
        }
        @media (max-width: 768px) {
          .mcrx-document {
            padding: 14px;
          }
          .mcrx-header {
            flex-direction: column;
          }
          .mcrx-provider {
            text-align: left;
          }
          .mcrx-grid,
          .mcrx-dual-grid,
          .mcrx-footer {
            grid-template-columns: 1fr;
          }
          .mcrx-sign {
            text-align: left;
          }
        }
      </style>

      <header class="mcrx-header">
        <div>
          <p class="mcrx-brand">Medora Clinical</p>
          <p class="mcrx-brand-sub">Advanced Medical Systems</p>
        </div>
        <div class="mcrx-provider">
          <p class="mcrx-label">Provider Chamber</p>
          <p class="mcrx-value">${escapeHtml(data.doctor.name || "N/A")}</p>
          <p class="mcrx-sub">${escapeHtml(data.doctor.chamber_info || data.doctor.address || "")}</p>
          ${data.doctor.address && data.doctor.address !== data.doctor.chamber_info ? `<p class="mcrx-sub">${escapeHtml(data.doctor.address)}</p>` : ""}
          ${data.doctor.phone ? `<p class="mcrx-sub">Contact: ${escapeHtml(data.doctor.phone)}</p>` : ""}
        </div>
      </header>

      <section class="mcrx-title">Clinical Prescription</section>

      <section class="mcrx-grid">
        <div>
          <p class="mcrx-col-title">Patient Information</p>
          <p><strong>Name:</strong> ${escapeHtml(data.patient.name || "N/A")}</p>
          <p><strong>Patient ID:</strong> ${escapeHtml(data.patient.patient_id || "N/A")}</p>
          <p><strong>Age / Gender:</strong> ${escapeHtml(data.patient.age ?? "N/A")} / ${escapeHtml(data.patient.gender || "N/A")}</p>
          <p><strong>Blood Group:</strong> ${escapeHtml(data.patient.blood_group || "N/A")}</p>
        </div>
        <div>
          <p class="mcrx-col-title">Provider Information</p>
          <p><strong>Practitioner:</strong> ${escapeHtml(data.doctor.name || "N/A")}</p>
          <p><strong>Qualification:</strong> ${escapeHtml(data.doctor.qualification || "N/A")}</p>
          <p><strong>Specialization:</strong> ${escapeHtml(data.doctor.specialization || "N/A")}</p>
          <p><strong>Reg. No:</strong> ${escapeHtml(data.doctor.registration_number || "N/A")}</p>
        </div>
      </section>

      <section>
        <p class="mcrx-section-label">Prescribed Medications</p>
        <div class="mcrx-table-wrap">
          <table class="mcrx-table">
            <thead>
              <tr>
                <th>Medicine Name + Strength</th>
                <th>Dosage</th>
                <th>Route</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>${medicationsHtml}</tbody>
          </table>
        </div>
      </section>

      <section class="mcrx-dual-grid">
        <div class="mcrx-panel">
          <p class="mcrx-section-label">Laboratory Investigations</p>
          ${testsHtml}
        </div>
        <div class="mcrx-panel">
          <p class="mcrx-section-label">Scheduled Procedures</p>
          ${proceduresHtml}
        </div>
      </section>

      <section class="mcrx-notes">
        <p><strong>Clinical Observations and Notes</strong></p>
        <p><strong>Chief Complaint:</strong> ${escapeHtml(data.consultation.chief_complaint || "N/A")}</p>
        <p><strong>Diagnosis:</strong> ${escapeHtml(data.consultation.diagnosis || "N/A")}</p>
        <p><strong>Notes:</strong> ${escapeHtml(data.consultation.notes || "N/A")}</p>
      </section>

      <footer class="mcrx-footer">
        <div>
          <p class="mcrx-hash-label">Digital Authentication Hash</p>
          <p class="mcrx-hash-value">${escapeHtml(documentHash)}</p>
          <p>Generated via Medora Clinical EMR. Timestamp: ${formatDateTime(data.consultation.date)}</p>
        </div>
        <div class="mcrx-sign">
          <p class="mcrx-sign-name">${escapeHtml(data.doctor.name || "N/A")}</p>
          <p>Physician Signature and Stamp</p>
          <p>Print Date: ${formatDateTime(generatedAtIso)}</p>
        </div>
      </footer>
    </article>
  `;
}

