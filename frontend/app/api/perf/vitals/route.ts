import { NextRequest, NextResponse } from "next/server";

const MAX_PAYLOAD_BYTES = 8 * 1024;
const ENABLE_RUM_LOG = process.env.PERF_LOG_RUM === "true";

type VitalsPayload = {
  id?: string;
  name?: string;
  value?: number;
  delta?: number;
  rating?: string;
  navigationType?: string;
  path?: string;
  ts?: number;
  sessionId?: string;
  userAgent?: string;
};

function noStoreResponse(status = 204) {
  return new NextResponse(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return noStoreResponse(413);
  }

  let payload: VitalsPayload;
  try {
    payload = (await request.json()) as VitalsPayload;
  } catch {
    return noStoreResponse(400);
  }

  if (!payload?.name || typeof payload.value !== "number" || !payload.path) {
    return noStoreResponse(400);
  }

  if (ENABLE_RUM_LOG) {
    console.info(
      "[RUM]",
      JSON.stringify({
        name: payload.name,
        value: payload.value,
        rating: payload.rating,
        path: payload.path,
        navigationType: payload.navigationType,
      }),
    );
  }

  return noStoreResponse(204);
}
