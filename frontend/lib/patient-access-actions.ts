"use server";

import { cookies } from "next/headers";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

async function getAuthHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  
  if (!token) {
    throw new Error("Authentication required. Please log in again.");
  }
  
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };
}

/**
 * Fetch patient full medical record for a doctor
 */
export async function getPatientForDoctor(patientId: string) {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${BACKEND_URL}/patient-access/patient/${patientId}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      // Try to parse JSON error, fall back to text
      let errorMessage = "Failed to fetch patient data";
      try {
        const errorData = await response.json();
        errorMessage = typeof errorData.detail === 'string' 
          ? errorData.detail 
          : JSON.stringify(errorData.detail);
      } catch {
        // If JSON parsing fails, try to get text
        try {
          const textError = await response.text();
          errorMessage = textError || `Error ${response.status}: ${response.statusText}`;
        } catch {
          errorMessage = `Error ${response.status}: ${response.statusText}`;
        }
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error: any) {
    console.error("Get patient for doctor error:", error);
    throw error;
  }
}

/**
 * Get patient's access history (for patients)
 */
export async function getMyAccessHistory(limit = 50, offset = 0) {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch(
      `${BACKEND_URL}/patient-access/my-access-history?limit=${limit}&offset=${offset}`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to fetch access history");
    }

    return await response.json();
  } catch (error: any) {
    console.error("Get access history error:", error);
    throw error;
  }
}

/**
 * Get patient's doctor access settings (for patients)
 */
export async function getMyDoctorAccess() {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${BACKEND_URL}/patient-access/my-doctor-access`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to fetch doctor access");
    }

    return await response.json();
  } catch (error: any) {
    console.error("Get doctor access error:", error);
    throw error;
  }
}

/**
 * Revoke a doctor's access to patient data
 */
export async function revokeDoctorAccess(doctorId: string, reason?: string) {
  try {
    const headers = await getAuthHeaders();
    
    const url = reason 
      ? `${BACKEND_URL}/patient-access/revoke-access/${doctorId}?reason=${encodeURIComponent(reason)}`
      : `${BACKEND_URL}/patient-access/revoke-access/${doctorId}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to revoke access");
    }

    return await response.json();
  } catch (error: any) {
    console.error("Revoke access error:", error);
    throw error;
  }
}

/**
 * Restore a doctor's access to patient data
 */
export async function restoreDoctorAccess(doctorId: string) {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${BACKEND_URL}/patient-access/restore-access/${doctorId}`, {
      method: "POST",
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to restore access");
    }

    return await response.json();
  } catch (error: any) {
    console.error("Restore access error:", error);
    throw error;
  }
}
