import { type NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get("session_token")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Call backend to check verification status
    const response = await fetch(
      `${process.env.BACKEND_URL || "http://localhost:8000"}/profile/verification-status`,
      {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to check verification" },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      verification_status: data.verification_status,
      role: data.role,
    });
  } catch (error) {
    console.error("Verification check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
