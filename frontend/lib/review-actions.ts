"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const BACKEND_URL = process.env.BACKEND_URL;

async function authHeaders() {
  const token = (await cookies()).get("session_token")?.value;
  if (!token) throw new Error("Authentication required");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export type ReviewAuthor = {
  patient_id: string;
  first_name?: string | null;
  last_name?: string | null;
  profile_photo_url?: string | null;
};

export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export type DoctorReview = {
  id: string;
  doctor_id: string;
  rating: number;
  note?: string | null;
  status: ReviewStatus;
  admin_feedback?: string | null;
  created_at: string;
  updated_at: string;
  author?: ReviewAuthor | null;
};

export type ReviewListResponse = {
  reviews: DoctorReview[];
  total: number;
  rating_avg: number;
  rating_count: number;
  page: number;
  limit: number;
  has_more: boolean;
};

export type ReviewEligibility = {
  can_review: boolean;
  has_existing_review: boolean;
  existing_review?: DoctorReview | null;
};

export async function getDoctorReviews(
  doctorId: string,
  page = 1,
  limit = 5,
): Promise<ReviewListResponse> {
  const res = await fetch(
    `${BACKEND_URL}/doctor/${doctorId}/reviews?page=${page}&limit=${limit}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    return { reviews: [], total: 0, rating_avg: 0, rating_count: 0, page, limit, has_more: false };
  }
  return res.json();
}

export async function getReviewEligibility(doctorId: string): Promise<ReviewEligibility> {
  const token = (await cookies()).get("session_token")?.value;
  if (!token) {
    return { can_review: false, has_existing_review: false, existing_review: null };
  }
  const res = await fetch(`${BACKEND_URL}/reviews/doctor/${doctorId}/eligibility`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    return { can_review: false, has_existing_review: false, existing_review: null };
  }
  return res.json();
}

export async function submitDoctorReview(input: {
  doctor_id: string;
  rating: number;
  note?: string;
  appointment_id?: string;
}): Promise<DoctorReview> {
  const res = await fetch(`${BACKEND_URL}/reviews`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || "Failed to submit review");
  }
  revalidatePath(`/patient/doctor/${input.doctor_id}`);
  revalidatePath(`/doctor/profile`);
  return res.json();
}

export async function deleteDoctorReview(reviewId: string, doctorId: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/reviews/${reviewId}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || "Failed to delete review");
  }
  revalidatePath(`/patient/doctor/${doctorId}`);
}
