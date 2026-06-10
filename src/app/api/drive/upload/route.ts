import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { tripId, fileName, fileUrl } = await request.json();
    console.log('[Drive Upload] Request received:', { tripId, fileName, fileUrl: fileUrl?.substring(0, 50) + '...' });

    if (!tripId || !fileName || !fileUrl) {
      return NextResponse.json(
        { error: "Missing required parameters: tripId, fileName, fileUrl" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Get the trip details
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("name, created_by, google_drive_folder_id")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) {
      console.error("Error fetching trip:", tripError);
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    console.log('[Drive Upload] Trip found:', trip.name, 'Admin:', trip.created_by);

    // 2. Get the trip admin's refresh token
    const { data: adminProfile, error: profileError } = await supabase
      .from("profiles")
      .select("google_drive_refresh_token")
      .eq("id", trip.created_by)
      .single();

    console.log('[Drive Upload] Admin has refresh token:', !!adminProfile?.google_drive_refresh_token);

    if (profileError || !adminProfile || !adminProfile.google_drive_refresh_token) {
      // It's not a fatal error, it just means the admin hasn't linked their Google Drive
      return NextResponse.json(
        { message: "Google Drive is not linked by the trip admin. Skipping backup." },
        { status: 200 }
      );
    }

    // 3. Refresh Google OAuth Access Token
    const client_id = process.env.GOOGLE_CLIENT_ID;
    const client_secret = process.env.GOOGLE_CLIENT_SECRET;

    if (!client_id || !client_secret) {
      console.error("Missing Google Client environment variables.");
      return NextResponse.json(
        { error: "Server configuration error: missing client credentials" },
        { status: 500 }
      );
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id,
        client_secret,
        refresh_token: adminProfile.google_drive_refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log('[Drive Upload] Token refresh status:', tokenResponse.status, JSON.stringify(tokenData));

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Failed to refresh Google access token:", tokenData);
      return NextResponse.json(
        { error: "Failed to authenticate with Google Drive" },
        { status: 401 }
      );
    }

    const accessToken = tokenData.access_token;

    // 4. Create folder if it doesn't exist
    let folderId = trip.google_drive_folder_id;

    if (!folderId) {
      const folderMetadata = {
        name: `TripSquad - ${trip.name}`,
        mimeType: "application/vnd.google-apps.folder",
      };

      const folderResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(folderMetadata),
      });

      const folderData = await folderResponse.json();

      if (!folderResponse.ok || !folderData.id) {
        console.error("Failed to create Google Drive folder:", folderData);
        return NextResponse.json(
          { error: "Failed to create Google Drive backup folder" },
          { status: 500 }
        );
      }

      folderId = folderData.id;

      // Save folder ID to database
      const { error: updateError } = await supabase
        .from("trips")
        .update({ google_drive_folder_id: folderId })
        .eq("id", tripId);

      if (updateError) {
        console.error("Failed to save folder ID to database:", updateError);
      }
    }

    console.log('[Drive Upload] Using folder ID:', folderId);

    // 5. Download the file from Supabase storage (try SDK first for auth, fallback to fetch)
    let fileBuffer: Buffer;
    let fileType = "image/jpeg";

    try {
      const url = new URL(fileUrl);
      const pathParts = url.pathname.split("/trip-photos/");
      const storagePath = decodeURIComponent(pathParts[pathParts.length - 1]);

      const { data: fileData, error: downloadError } = await supabase.storage
        .from("trip-photos")
        .download(storagePath);

      if (downloadError || !fileData) {
        console.warn("Failed to download file from Supabase storage via SDK, trying fallback fetch:", downloadError);
        const fileResponse = await fetch(fileUrl);
        if (!fileResponse.ok) {
          throw new Error(`Fallback fetch failed with status ${fileResponse.status}`);
        }
        const fileBlob = await fileResponse.blob();
        fileType = fileBlob.type || "image/jpeg";
        fileBuffer = Buffer.from(await fileBlob.arrayBuffer());
      } else {
        fileType = fileData.type || "image/jpeg";
        fileBuffer = Buffer.from(await fileData.arrayBuffer());
      }
      console.log('[Drive Upload] File downloaded, size:', fileBuffer.length, 'bytes');
    } catch (err) {
      console.error("Failed to download file from Supabase storage:", err);
      return NextResponse.json(
        { error: "Failed to retrieve photo content" },
        { status: 500 }
      );
    }

    // 6. Upload file to Google Drive (Multipart upload)
    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: fileName,
      parents: [folderId],
    };

    // Construct multipart/related body
    const multipartBody = Buffer.concat([
      Buffer.from(delimiter),
      Buffer.from("Content-Type: application/json; charset=UTF-8\r\n\r\n"),
      Buffer.from(JSON.stringify(metadata)),
      Buffer.from(delimiter),
      Buffer.from(`Content-Type: ${fileType}\r\n`),
      Buffer.from("Content-Transfer-Encoding: base64\r\n\r\n"),
      Buffer.from(fileBuffer.toString("base64")),
      Buffer.from(closeDelimiter),
    ]);

    const uploadResponse = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
          "Content-Length": multipartBody.length.toString(),
        },
        body: multipartBody,
      }
    );

    const uploadData = await uploadResponse.json();
    console.log('[Drive Upload] Upload response:', uploadResponse.status, JSON.stringify(uploadData));

    if (!uploadResponse.ok) {
      console.error("Failed to upload file to Google Drive:", uploadData);
      return NextResponse.json(
        { error: "Failed to upload file to Google Drive" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, googleDriveFileId: uploadData.id },
      { status: 200 }
    );
  } catch (error) {
    console.error("Drive upload handler error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
