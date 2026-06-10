import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data?.session?.provider_refresh_token) {
        // Save the Google Drive refresh token to the database profile
        await supabase
          .from("profiles")
          .update({ google_drive_refresh_token: data.session.provider_refresh_token })
          .eq("id", data.session.user.id);
      }
    } catch (error) {
      console.error("Error exchanging code for session:", error);
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
