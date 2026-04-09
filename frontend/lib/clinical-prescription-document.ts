import type { FullPrescriptionResponse } from "@/lib/prescription-actions";

type BuildClinicalPrescriptionDocumentOptions = {
  consultationId: string;
  generatedAtIso?: string;
  labels?: Partial<ClinicalPrescriptionDocumentLabels>;
};

type ClinicalPrescriptionDocumentLabels = {
  brandSub: string;
  providerChamber: string;
  contact: string;
  title: string;
  patientInformation: string;
  providerInformation: string;
  name: string;
  patientId: string;
  ageGender: string;
  bloodGroup: string;
  practitioner: string;
  qualification: string;
  specialization: string;
  registrationNumber: string;
  prescribedMedications: string;
  medicineStrength: string;
  dosage: string;
  route: string;
  duration: string;
  laboratoryInvestigations: string;
  scheduledProcedures: string;
  clinicalObservations: string;
  chiefComplaint: string;
  diagnosis: string;
  notes: string;
  digitalHash: string;
  generatedVia: string;
  physicianSign: string;
  printDate: string;
  qty: string;
  noMedication: string;
  noTests: string;
  noProcedures: string;
  asDirected: string;
  asAdvised: string;
  na: string;
};

const DEFAULT_LABELS: ClinicalPrescriptionDocumentLabels = {
  brandSub: "Advanced Medical Systems",
  providerChamber: "Provider Chamber",
  contact: "Contact",
  title: "Clinical Prescription",
  patientInformation: "Patient Information",
  providerInformation: "Provider Information",
  name: "Name",
  patientId: "Patient ID",
  ageGender: "Age / Gender",
  bloodGroup: "Blood Group",
  practitioner: "Practitioner",
  qualification: "Qualification",
  specialization: "Specialization",
  registrationNumber: "Reg. No",
  prescribedMedications: "Prescribed Medications",
  medicineStrength: "Medicine Name + Strength",
  dosage: "Dosage",
  route: "Route",
  duration: "Duration",
  laboratoryInvestigations: "Laboratory Investigations",
  scheduledProcedures: "Scheduled Procedures",
  clinicalObservations: "Clinical Observations and Notes",
  chiefComplaint: "Chief Complaint",
  diagnosis: "Diagnosis",
  notes: "Notes",
  digitalHash: "Digital Authentication Hash",
  generatedVia: "Generated via Medora Clinical EMR. Timestamp: {value}",
  physicianSign: "Physician Signature and Stamp",
  printDate: "Print Date: {value}",
  qty: "Qty",
  noMedication: "No medications prescribed.",
  noTests: "No tests requested.",
  noProcedures: "No procedures advised.",
  asDirected: "As directed",
  asAdvised: "As advised",
  na: "N/A",
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
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const labels: ClinicalPrescriptionDocumentLabels = {
    ...DEFAULT_LABELS,
    ...(options.labels || {}),
  };

  const generatedAtIso = options.generatedAtIso || new Date().toISOString();
  const documentHash = buildDigitalHash(`${options.consultationId}:${data.consultation?.date || ""}`);

  const medicationsHtml =
    data.medications.length === 0
      ? `
        <tr>
          <td colspan="4" class="mcrx-empty-row">${escapeHtml(labels.noMedication)}</td>
        </tr>
      `
      : data.medications
          .map((medication) => {
            const nameStrength = `${escapeHtml(medication.medicine_name)}${
              medication.strength ? ` ${escapeHtml(medication.strength)}` : ""
            }`;
            const dosage = escapeHtml(medication.dosage_pattern || medication.frequency_text || labels.asDirected);
            const route = escapeHtml(medication.route || labels.asDirected);
            const meal = medication.meal_instruction
              ? `<div class="mcrx-subline">${escapeHtml(titleCaseWords(medication.meal_instruction))}</div>`
              : "";
            const duration = escapeHtml(medication.duration || labels.asAdvised);
            const quantity =
              typeof medication.quantity === "number"
                ? `<div class="mcrx-subline">${escapeHtml(labels.qty)}: ${escapeHtml(medication.quantity)}</div>`
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
      ? `<p class="mcrx-muted">${escapeHtml(labels.noTests)}</p>`
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
      ? `<p class="mcrx-muted">${escapeHtml(labels.noProcedures)}</p>`
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
          <p class="mcrx-brand-sub">${escapeHtml(labels.brandSub)}</p>
        </div>
        <div class="mcrx-provider">
          <p class="mcrx-label">${escapeHtml(labels.providerChamber)}</p>
          <p class="mcrx-value">${escapeHtml(data.doctor.name || labels.na)}</p>
          <p class="mcrx-sub">${escapeHtml(data.doctor.chamber_info || data.doctor.address || "")}</p>
          ${data.doctor.address && data.doctor.address !== data.doctor.chamber_info ? `<p class="mcrx-sub">${escapeHtml(data.doctor.address)}</p>` : ""}
          ${data.doctor.phone ? `<p class="mcrx-sub">${escapeHtml(labels.contact)}: ${escapeHtml(data.doctor.phone)}</p>` : ""}
        </div>
      </header>

      <section class="mcrx-title">${escapeHtml(labels.title)}</section>

      <section class="mcrx-grid">
        <div>
          <p class="mcrx-col-title">${escapeHtml(labels.patientInformation)}</p>
          <p><strong>${escapeHtml(labels.name)}:</strong> ${escapeHtml(data.patient.name || labels.na)}</p>
          <p><strong>${escapeHtml(labels.patientId)}:</strong> ${escapeHtml(data.patient.patient_id || labels.na)}</p>
          <p><strong>${escapeHtml(labels.ageGender)}:</strong> ${escapeHtml(data.patient.age ?? labels.na)} / ${escapeHtml(data.patient.gender || labels.na)}</p>
          <p><strong>${escapeHtml(labels.bloodGroup)}:</strong> ${escapeHtml(data.patient.blood_group || labels.na)}</p>
        </div>
        <div>
          <p class="mcrx-col-title">${escapeHtml(labels.providerInformation)}</p>
          <p><strong>${escapeHtml(labels.practitioner)}:</strong> ${escapeHtml(data.doctor.name || labels.na)}</p>
          <p><strong>${escapeHtml(labels.qualification)}:</strong> ${escapeHtml(data.doctor.qualification || labels.na)}</p>
          <p><strong>${escapeHtml(labels.specialization)}:</strong> ${escapeHtml(data.doctor.specialization || labels.na)}</p>
          <p><strong>${escapeHtml(labels.registrationNumber)}:</strong> ${escapeHtml(data.doctor.registration_number || labels.na)}</p>
        </div>
      </section>

      <section>
        <p class="mcrx-section-label">${escapeHtml(labels.prescribedMedications)}</p>
        <div class="mcrx-table-wrap">
          <table class="mcrx-table">
            <thead>
              <tr>
                <th>${escapeHtml(labels.medicineStrength)}</th>
                <th>${escapeHtml(labels.dosage)}</th>
                <th>${escapeHtml(labels.route)}</th>
                <th>${escapeHtml(labels.duration)}</th>
              </tr>
            </thead>
            <tbody>${medicationsHtml}</tbody>
          </table>
        </div>
      </section>

      <section class="mcrx-dual-grid">
        <div class="mcrx-panel">
          <p class="mcrx-section-label">${escapeHtml(labels.laboratoryInvestigations)}</p>
          ${testsHtml}
        </div>
        <div class="mcrx-panel">
          <p class="mcrx-section-label">${escapeHtml(labels.scheduledProcedures)}</p>
          ${proceduresHtml}
        </div>
      </section>

      <section class="mcrx-notes">
        <p><strong>${escapeHtml(labels.clinicalObservations)}</strong></p>
        <p><strong>${escapeHtml(labels.chiefComplaint)}:</strong> ${escapeHtml(data.consultation.chief_complaint || labels.na)}</p>
        <p><strong>${escapeHtml(labels.diagnosis)}:</strong> ${escapeHtml(data.consultation.diagnosis || labels.na)}</p>
        <p><strong>${escapeHtml(labels.notes)}:</strong> ${escapeHtml(data.consultation.notes || labels.na)}</p>
      </section>

      <footer class="mcrx-footer">
        <div>
          <p class="mcrx-hash-label">${escapeHtml(labels.digitalHash)}</p>
          <p class="mcrx-hash-value">${escapeHtml(documentHash)}</p>
          <p>${escapeHtml(labels.generatedVia.replace("{value}", formatDateTime(data.consultation.date)))}</p>
        </div>
        <div class="mcrx-sign">
          <p class="mcrx-sign-name">${escapeHtml(data.doctor.name || labels.na)}</p>
          <p>${escapeHtml(labels.physicianSign)}</p>
          <p>${escapeHtml(labels.printDate.replace("{value}", formatDateTime(generatedAtIso)))}</p>
        </div>
      </footer>
    </article>
  `;
}
