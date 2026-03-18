export type MediaCategory =
  | "general"
  | "profile_photo"
  | "profile_banner"
  | "medical_document"
  | "doctor_document"
  | "prescription_image";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export type MediaFileRecord = {
  id: string;
  public_url?: string | null;
  storage_path: string;
  category: string;
  content_type?: string | null;
  file_size: number;
  created_at: string;
};

export type UploadMediaResponse = {
  url?: string | null;
  file: MediaFileRecord;
};

export type PrescriptionExtractionResponse = {
  extracted_text: string;
  confidence: number;
  file?: MediaFileRecord | null;
};

function readSessionToken() {
  if (typeof document === "undefined") {
    return null;
  }

  const tokenCookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith("session_token="));

  return tokenCookie ? decodeURIComponent(tokenCookie.split("=")[1] || "") : null;
}

function getAuthHeaders() {
  const token = readSessionToken();
  if (!token) {
    throw new Error("Authentication required. Please log in again.");
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function uploadMediaFile(options: {
  file: File;
  category: MediaCategory;
  entityType?: string;
  entityId?: string;
  visibility?: "public" | "private";
}): Promise<UploadMediaResponse> {
  const formData = new FormData();
  formData.append("file", options.file);
  formData.append("category", options.category);
  formData.append("visibility", options.visibility || "public");

  if (options.entityType) {
    formData.append("entity_type", options.entityType);
  }
  if (options.entityId) {
    formData.append("entity_id", options.entityId);
  }

  const response = await fetch(`${BACKEND_URL}/upload/files`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.detail || "Upload failed.");
  }

  return data as UploadMediaResponse;
}

export async function listMyMediaFiles(query?: {
  category?: string;
  entityType?: string;
  entityId?: string;
}) {
  const params = new URLSearchParams();
  if (query?.category) {
    params.set("category", query.category);
  }
  if (query?.entityType) {
    params.set("entity_type", query.entityType);
  }
  if (query?.entityId) {
    params.set("entity_id", query.entityId);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${BACKEND_URL}/upload/files${suffix}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.detail || "Failed to list files.");
  }

  return data as MediaFileRecord[];
}

export async function deleteMediaFile(fileId: string) {
  const response = await fetch(`${BACKEND_URL}/upload/files/${fileId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.detail || "Failed to delete file.");
  }

  return data;
}

export async function extractPrescriptionFromImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("save_file", "true");

  const response = await fetch(`${BACKEND_URL}/upload/prescription/extract`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.detail || "Failed to extract prescription.");
  }

  return data as PrescriptionExtractionResponse;
}
