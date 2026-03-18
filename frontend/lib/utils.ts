import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns a local date key in YYYY-MM-DD for a given Date or ISO date string.
 * This avoids timezone shifts caused by toISOString().
 */
export function localDateKey(dateInput: string | Date) {
  if (typeof dateInput === 'string') {
    const dateOnlyMatch = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (dateOnlyMatch) {
      return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`
    }
  }

  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// --- Appointment display helpers ---
export function humanizeConsultationType(value?: string | null) {
  if (!value) return ''
  const v = value.toLowerCase()
  if (v === 'face-to-face' || v === 'in-person') return 'Face‑to‑Face Consultation'
  if (v === 'online' || v === 'telemedicine') return 'Video Consultation'
  return v.replace(/(^|\s)\S/g, t => t.toUpperCase())
}

export function humanizeAppointmentType(value?: string | null) {
  if (!value) return ''
  const v = value.toLowerCase()
  if (v === 'new') return 'New patient'
  if (v === 'follow-up' || v === 'follow_up') return 'Follow‑up'
  if (v === 'report') return 'Report'
  return v.replace(/(^|\s)\S/g, t => t.toUpperCase())
}

/**
 * Parse a composite reason string created by the booking flow: "consultationType - appointmentType"
 * Returns { consultationType, appointmentType }
 */
export function parseCompositeReason(reason?: string | null) {
  if (!reason) return { consultationType: '', appointmentType: '' }
  const parts = reason.split(' - ').map(p => p.trim())
  return {
    consultationType: parts[0] || '',
    appointmentType: parts[1] || '',
  }
}
