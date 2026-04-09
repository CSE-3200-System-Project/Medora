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

export function parseSlotLabelToTime(slotLabel: string) {
  const match = slotLabel.trim().match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i)
  if (!match) return null

  let hour = Number(match[1]) % 12
  const minute = Number(match[2] || '0')
  if (match[3].toUpperCase() === 'PM') {
    hour += 12
  }

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return null
  }

  return { hour, minute }
}

/**
 * Build a canonical UTC ISO string from a date key and slot label without relying on browser local timezone.
 */
export function toUtcIsoFromDateAndSlot(dateKey: string, slotLabel: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!dateMatch) {
    throw new Error('Invalid appointment date')
  }

  const parsedSlot = parseSlotLabelToTime(slotLabel)
  if (!parsedSlot) {
    throw new Error('Invalid appointment time slot')
  }

  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])

  return new Date(Date.UTC(year, month - 1, day, parsedSlot.hour, parsedSlot.minute, 0, 0)).toISOString()
}

function normalizeSlotLabel(slotTime?: string | null) {
  if (!slotTime) return null
  const trimmed = slotTime.trim()
  if (!trimmed) return null

  const twentyFour = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(trimmed)
  if (twentyFour) {
    const hour24 = Number(twentyFour[1])
    const minute = twentyFour[2]
    const period = hour24 >= 12 ? 'PM' : 'AM'
    const hour12 = hour24 % 12 || 12
    return `${hour12}:${minute} ${period}`
  }

  const parsed = parseSlotLabelToTime(trimmed)
  if (!parsed) return trimmed

  const period = parsed.hour >= 12 ? 'PM' : 'AM'
  const hour12 = parsed.hour % 12 || 12
  return `${hour12}:${String(parsed.minute).padStart(2, '0')} ${period}`
}

export function formatAppointmentTime(appointmentIso: string, slotTime?: string | null) {
  const normalizedSlot = normalizeSlotLabel(slotTime)
  if (normalizedSlot) return normalizedSlot

  const value = new Date(appointmentIso)
  if (Number.isNaN(value.getTime())) return ''

  return value.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function formatAppointmentDateTime(appointmentIso: string, slotTime?: string | null) {
  const value = new Date(appointmentIso)
  if (Number.isNaN(value.getTime())) {
    return formatAppointmentTime(appointmentIso, slotTime)
  }

  const dateLabel = value.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const timeLabel = formatAppointmentTime(appointmentIso, slotTime)

  return timeLabel ? `${dateLabel}, ${timeLabel}` : dateLabel
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
