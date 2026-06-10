import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Not logged in", userError }, { status: 401 });
    }

    // Get the profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found", profileError }, { status: 404 });
    }

    const client_id = process.env.GOOGLE_CLIENT_ID;
    const client_secret = process.env.GOOGLE_CLIENT_SECRET;

    const tokenParams = {
      client_id: client_id || "MISSING",
      client_secret: client_secret ? "PRESENT (hidden)" : "MISSING",
      refresh_token: profile.google_drive_refresh_token || "MISSING",
    };

    if (!client_id || !client_secret || !profile.google_drive_refresh_token) {
      return NextResponse.json({
        message: "Missing credentials or refresh token",
        tokenParams,
      });
    }

    // Attempt token refresh
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id,
        client_secret,
        refresh_token: profile.google_drive_refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const status = response.status;
    const statusText = response.statusText;
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (e) {}

    return NextResponse.json({
      success: response.ok,
      status,
      statusText,
      rawBody: text,
      parsedJson: json,
      tokenParams,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
