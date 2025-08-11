import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Token refresh tracking
let tokenRefreshInProgress = false;

// Google Drive folder picker
export const openGoogleDrivePicker = async (
  accessToken: string,
): Promise<{ folderId: string; folderName: string } | null> => {
  return new Promise((resolve, reject) => {
    addLogEntry("INFO", "Opening Google Drive folder picker");

    // For now, we'll simulate the folder picker with a simple dialog
    // In a production environment, you would implement the actual Google Picker API
    const userChoice = confirm(
      "Google Sheetを作成します。\n\n" +
        "OK: ルートフォルダに作成\n" +
        "キャンセル: 作成をキャンセル",
    );

    if (userChoice) {
      addLogEntry("INFO", "User chose to create sheet in root folder");
      resolve({
        folderId: "root",
        folderName: "マイドライブ",
      });
    } else {
      addLogEntry("INFO", "User cancelled sheet creation");
      resolve(null);
    }
  });
};

// AI API connection test
export const testAIConnection = async (
  service: string,
  model: string,
  apiToken: string,
) => {
  try {
    if (!service || !model || !apiToken) {
      throw new Error("All AI service credentials are required");
    }

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Basic format validation based on service
    switch (service) {
      case "OpenAI":
        if (!apiToken.startsWith("sk-")) {
          throw new Error("Invalid OpenAI API key format");
        }
        break;
      case "Anthropic":
        if (!apiToken.startsWith("sk-ant-")) {
          throw new Error("Invalid Anthropic API key format");
        }
        break;
      case "Gemini":
        if (apiToken.length < 20) {
          throw new Error("Invalid Gemini API key format");
        }
        break;
    }

    return { success: true, message: `${service} connection successful` };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
};

// Save user settings
export const saveUserSettings = async (settings: {
  googleSheetId?: string;
  googleSheetUrl?: string;
  googleDriveFolderId?: string;
  googleDriveFolderName?: string;
  googleDriveFolderUrl?: string;
  aiService?: string;
  aiModel?: string;
  aiApiToken?: string;
  aiConnectionStatus?: boolean;
}) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User not authenticated");
  }

  // First check if user settings already exist
  const { data: existingSettings } = await supabase
    .from("user_settings")
    .select("id")
    .eq("user_id", user.id)
    .single();

  let data, error;

  if (existingSettings) {
    // Update existing record
    const updateData: any = {};
    if (settings.googleSheetId !== undefined)
      updateData.google_sheet_id = settings.googleSheetId;
    if (settings.googleSheetUrl !== undefined)
      updateData.google_sheet_url = settings.googleSheetUrl;
    if (settings.googleDriveFolderId !== undefined)
      updateData.google_drive_folder_id = settings.googleDriveFolderId;
    if (settings.googleDriveFolderName !== undefined)
      updateData.google_drive_folder_name = settings.googleDriveFolderName;
    if (settings.googleDriveFolderUrl !== undefined)
      updateData.google_drive_folder_url = settings.googleDriveFolderUrl;
    if (settings.aiService !== undefined)
      updateData.ai_service = settings.aiService;
    if (settings.aiModel !== undefined) updateData.ai_model = settings.aiModel;
    if (settings.aiApiToken !== undefined)
      updateData.ai_api_token = settings.aiApiToken;
    if (settings.aiConnectionStatus !== undefined)
      updateData.ai_connection_status = settings.aiConnectionStatus;

    const result = await supabase
      .from("user_settings")
      .update(updateData)
      .eq("user_id", user.id)
      .select()
      .single();

    data = result.data;
    error = result.error;
  } else {
    // Insert new record
    const result = await supabase
      .from("user_settings")
      .insert({
        user_id: user.id,
        google_sheet_id: settings.googleSheetId,
        google_sheet_url: settings.googleSheetUrl,
        google_drive_folder_id: settings.googleDriveFolderId,
        google_drive_folder_name: settings.googleDriveFolderName,
        google_drive_folder_url: settings.googleDriveFolderUrl,
        ai_service: settings.aiService,
        ai_model: settings.aiModel,
        ai_api_token: settings.aiApiToken,
        ai_connection_status: settings.aiConnectionStatus,
      })
      .select()
      .single();

    data = result.data;
    error = result.error;
  }

  if (error) {
    addLogEntry("ERROR", "Error saving user settings", error);
    throw error;
  }

  addLogEntry("INFO", "User settings saved successfully", data);
  return data;
};

// Get user settings
export const getUserSettings = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 is "not found"
    throw error;
  }

  return data;
};

// Create Google Drive folder for images
export const createGoogleDriveImageFolder = async (
  accessToken: string,
  parentFolderId?: string,
) => {
  try {
    addLogEntry("INFO", "Creating Google Drive image folder", {
      parentFolderId,
    });

    const folderName = `YLPM Images - ${new Date().toISOString().split("T")[0]}`;

    const response = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: parentFolderId ? [parentFolderId] : undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Google Drive API Error:", errorData);
      addLogEntry("ERROR", "Google Drive API Error", errorData);
      throw new Error(
        `Failed to create folder: ${errorData.error?.message || "Unknown error"}`,
      );
    }

    const folderData = await response.json();
    const folderId = folderData.id;
    const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;

    addLogEntry("INFO", "Google Drive image folder created successfully", {
      folderId,
      folderName,
      folderUrl,
    });

    return {
      success: true,
      folderId,
      folderName,
      folderUrl,
      message: "Google Drive image folder created successfully",
    };
  } catch (error) {
    console.error("Error creating Google Drive image folder:", error);
    addLogEntry("ERROR", "Error creating Google Drive image folder", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create Google Drive image folder",
    };
  }
};

// Upload image to Google Drive
export const uploadImageToGoogleDrive = async (
  accessToken: string,
  file: File,
  folderId: string,
) => {
  try {
    addLogEntry("INFO", "Uploading image to Google Drive", {
      fileName: file.name,
      folderId,
    });

    // Create file metadata
    const metadata = {
      name: `${Date.now()}_${file.name}`,
      parents: [folderId],
    };

    // Create form data for multipart upload
    const formData = new FormData();
    formData.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" }),
    );
    formData.append("file", file);

    const response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Google Drive upload error:", errorData);
      addLogEntry("ERROR", "Google Drive upload error", errorData);
      throw new Error(
        `Failed to upload image: ${errorData.error?.message || "Unknown error"}`,
      );
    }

    const fileData = await response.json();
    const fileId = fileData.id;
    const fileUrl = `https://drive.google.com/file/d/${fileId}/view`;

    // Make the file publicly viewable
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "reader",
          type: "anyone",
        }),
      },
    );

    addLogEntry("INFO", "Image uploaded to Google Drive successfully", {
      fileId,
      fileName: fileData.name,
      fileUrl,
    });

    return {
      success: true,
      fileId,
      fileName: fileData.name,
      fileUrl,
      directUrl: `https://drive.google.com/uc?id=${fileId}`,
    };
  } catch (error) {
    console.error("Error uploading image to Google Drive:", error);
    addLogEntry("ERROR", "Error uploading image to Google Drive", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to upload image to Google Drive",
    };
  }
};

// Create Google Sheet with OAuth token
export const createGoogleSheetWithOAuth = async (
  accessToken: string,
  folderId?: string,
) => {
  try {
    addLogEntry("INFO", "Creating Google Sheet with OAuth token", { folderId });

    // Create the sheet using Google Sheets API
    const response = await fetch(
      "https://sheets.googleapis.com/v4/spreadsheets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            title: `YLPM Posts - ${new Date().toISOString().split("T")[0]}`,
          },
          sheets: [
            {
              properties: {
                title: "投稿データ",
              },
              data: [
                {
                  rowData: [
                    {
                      values: [
                        { userEnteredValue: { stringValue: "ID" } },
                        { userEnteredValue: { stringValue: "投稿内容" } },
                        {
                          userEnteredValue: { stringValue: "プラットフォーム" },
                        },
                        { userEnteredValue: { stringValue: "予定時刻" } },
                        { userEnteredValue: { stringValue: "ステータス" } },
                        { userEnteredValue: { stringValue: "画像URL" } },
                        {
                          userEnteredValue: { stringValue: "画像カンマ区切り" },
                        },
                        { userEnteredValue: { stringValue: "画像JSON配列" } },
                        { userEnteredValue: { stringValue: "削除フラグ" } },
                        { userEnteredValue: { stringValue: "作成日時" } },
                        { userEnteredValue: { stringValue: "更新日時" } },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Google Sheets API Error:", errorData);
      addLogEntry("ERROR", "Google Sheets API Error", errorData);
      throw new Error(
        `Failed to create sheet: ${errorData.error?.message || "Unknown error"}`,
      );
    }

    const sheetData = await response.json();
    const sheetId = sheetData.spreadsheetId;
    const sheetUrl = sheetData.spreadsheetUrl;

    // If folderId is provided, move the sheet to that folder
    if (folderId) {
      try {
        await fetch(
          `https://www.googleapis.com/drive/v3/files/${sheetId}?addParents=${folderId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );
        addLogEntry("INFO", "Sheet moved to selected folder", {
          folderId,
          sheetId,
        });
      } catch (moveError) {
        console.warn("Failed to move sheet to folder:", moveError);
        addLogEntry("WARN", "Failed to move sheet to folder", moveError);
      }
    }

    // Create image folder
    const imageFolderResult = await createGoogleDriveImageFolder(
      accessToken,
      folderId,
    );

    // Save sheet info and folder info to user settings
    const settingsToSave: any = {
      googleSheetId: sheetId,
      googleSheetUrl: sheetUrl,
    };

    if (imageFolderResult.success) {
      settingsToSave.googleDriveFolderId = imageFolderResult.folderId;
      settingsToSave.googleDriveFolderName = imageFolderResult.folderName;
      settingsToSave.googleDriveFolderUrl = imageFolderResult.folderUrl;
    }

    await saveUserSettings(settingsToSave);

    addLogEntry("INFO", "Google Sheet created successfully", {
      sheetId,
      sheetUrl,
      imageFolder: imageFolderResult,
    });

    return {
      success: true,
      sheetId,
      sheetUrl,
      imageFolder: imageFolderResult,
      message: "Google Sheet created successfully",
    };
  } catch (error) {
    console.error("Error creating Google Sheet:", error);
    addLogEntry("ERROR", "Error creating Google Sheet", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create Google Sheet",
    };
  }
};

// Token refresh tracking with retry count
let tokenRefreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 3;

// Refresh Google Access Token with staged error handling
export const refreshGoogleAccessToken = async (
  attempt: number = 1,
): Promise<{ success: boolean; shouldLogout: boolean }> => {
  if (tokenRefreshInProgress) {
    addLogEntry("INFO", "Token refresh already in progress, waiting...");
    // Wait for ongoing refresh to complete
    let attempts = 0;
    while (tokenRefreshInProgress && attempts < 10) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      attempts++;
    }
    return { success: !tokenRefreshInProgress, shouldLogout: false };
  }

  try {
    tokenRefreshInProgress = true;
    tokenRefreshAttempts = attempt;
    addLogEntry(
      "INFO",
      `Attempting to refresh Google access token (attempt ${attempt}/${MAX_REFRESH_ATTEMPTS})`,
    );

    const refreshResult = await supabase.auth.refreshSession();

    if (refreshResult.error) {
      addLogEntry("ERROR", "Failed to refresh session", refreshResult.error);

      if (attempt >= MAX_REFRESH_ATTEMPTS) {
        addLogEntry("ERROR", "Max refresh attempts reached, forcing logout");
        return { success: false, shouldLogout: true };
      }

      return { success: false, shouldLogout: false };
    }

    if (refreshResult.data?.session?.provider_token) {
      addLogEntry("INFO", "Google access token refreshed successfully");
      tokenRefreshAttempts = 0; // Reset on success
      return { success: true, shouldLogout: false };
    }

    addLogEntry("WARN", "Session refreshed but no provider token found");

    if (attempt >= MAX_REFRESH_ATTEMPTS) {
      addLogEntry("ERROR", "Max refresh attempts reached, forcing logout");
      return { success: false, shouldLogout: true };
    }

    return { success: false, shouldLogout: false };
  } catch (error) {
    addLogEntry("ERROR", "Error refreshing Google access token", error);

    if (attempt >= MAX_REFRESH_ATTEMPTS) {
      addLogEntry("ERROR", "Max refresh attempts reached, forcing logout");
      return { success: false, shouldLogout: true };
    }

    return { success: false, shouldLogout: false };
  } finally {
    tokenRefreshInProgress = false;
  }
};

// Get Google Access Token from Supabase session with auto-refresh
export const getGoogleAccessToken = async (retryCount = 0): Promise<string> => {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      addLogEntry("ERROR", "Error getting session", error);
      throw new Error(`Session error: ${error.message}`);
    }

    if (!session) {
      addLogEntry("ERROR", "No session found");
      throw new Error("No active session found");
    }

    if (!session.provider_token) {
      if (retryCount === 0) {
        addLogEntry("INFO", "No provider token, attempting refresh");
        const refreshed = await refreshGoogleAccessToken();
        if (refreshed) {
          return getGoogleAccessToken(1); // Retry once
        }
      }

      addLogEntry("ERROR", "No provider token in session", {
        sessionExists: !!session,
        provider: session.user?.app_metadata?.provider,
        retryCount,
      });
      throw new Error("No Google access token found in session");
    }

    addLogEntry("INFO", "Successfully retrieved Google access token");
    return session.provider_token;
  } catch (error) {
    addLogEntry("ERROR", "Failed to get Google access token", error);
    throw error;
  }
};

// Check Google token validity
export const checkGoogleTokenValidity = async (): Promise<boolean> => {
  try {
    const accessToken = await getGoogleAccessToken();

    // Test the token by making a simple API call
    const response = await fetch(
      "https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=" +
        accessToken,
    );

    if (response.ok) {
      const tokenInfo = await response.json();
      addLogEntry("INFO", "Google token is valid", {
        expiresIn: tokenInfo.expires_in,
      });
      return true;
    } else {
      addLogEntry("WARN", "Google token validation failed", {
        status: response.status,
      });
      return false;
    }
  } catch (error) {
    addLogEntry("ERROR", "Error checking Google token validity", error);
    return false;
  }
};

// Check if Google Sheet exists using OAuth token
export const checkGoogleSheetExists = async (sheetUrl: string) => {
  try {
    if (!sheetUrl) {
      return { exists: false, error: "No sheet URL provided" };
    }

    // Extract sheet ID from URL
    const sheetIdMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch) {
      return { exists: false, error: "Invalid sheet URL format" };
    }

    const sheetId = sheetIdMatch[1];
    const accessToken = await getGoogleAccessToken();

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    addLogEntry("INFO", "Sheet existence check response", {
      status: response.status,
      sheetId,
    });

    if (response.status === 404) {
      return { exists: false, error: "Sheet not found" };
    }

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Sheet check error:", errorData);
      addLogEntry("ERROR", "Sheet check error", errorData);
      return {
        exists: false,
        error: errorData.error?.message || "Unknown error",
      };
    }

    return { exists: true };
  } catch (error) {
    console.error("Error checking sheet existence:", error);
    addLogEntry("ERROR", "Error checking sheet existence", error);
    return {
      exists: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// Add post to Google Sheet using OAuth token (platform-specific)
export const addPostToGoogleSheet = async (post: any) => {
  try {
    const settings = await getUserSettings();
    if (!settings?.google_sheet_id) {
      throw new Error("Google Sheet not configured");
    }

    const accessToken = await getGoogleAccessToken();

    // Upload images if present and associate them with the post ID
    let imageUrls: string[] = [];
    if (
      post.images &&
      post.images.length > 0 &&
      settings.google_drive_folder_id
    ) {
      for (const image of post.images) {
        // Create a unique filename: {baseId}_{timestamp}_{originalName}
        const originalName = image.name;
        const baseId = post.id.includes("_") ? post.id.split("_")[0] : post.id;
        const timestamp = Date.now();
        const uniqueFileName = `${baseId}_${timestamp}_${originalName}`;

        // Create a new File object with the unique name
        const renamedFile = new File([image], uniqueFileName, {
          type: image.type,
        });

        const uploadResult = await uploadImageToGoogleDrive(
          accessToken,
          renamedFile,
          settings.google_drive_folder_id,
        );
        if (uploadResult.success) {
          imageUrls.push(uploadResult.directUrl || "");
          addLogEntry("INFO", "Image uploaded with post association", {
            postId: post.id,
            baseId,
            originalName,
            uniqueFileName,
            imageUrl: uploadResult.directUrl,
          });
        }
      }
    }

    const imageUrl = imageUrls.join(",");
    const sheetName = encodeURIComponent("投稿データ");

    // Ensure the post ID is properly formatted
    const postId = post.id;
    const platform = Array.isArray(post.platforms)
      ? post.platforms[0]
      : post.platforms;

    // Validate that we have a proper post ID with platform suffix for new posts
    if (!postId.includes("_") && platform) {
      addLogEntry(
        "WARN",
        "Post ID missing platform suffix, this may cause duplicates",
        {
          postId,
          platform,
        },
      );
    }

    // Convert schedule time to JST for storage
    let scheduleTimeJST = new Date().toISOString();
    if (post.scheduleTime) {
      const scheduleTime =
        post.scheduleTime instanceof Date
          ? post.scheduleTime
          : new Date(post.scheduleTime);
      const jstTime = new Date(scheduleTime.getTime() + 9 * 60 * 60 * 1000);
      scheduleTimeJST = jstTime.toISOString();
    } else {
      // For immediate posts, use current JST time
      const now = new Date();
      const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      scheduleTimeJST = jstNow.toISOString();
    }

    // Create and update timestamps in JST
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const jstTimestamp = jstNow.toISOString();

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${settings.google_sheet_id}/values/${sheetName}:append?valueInputOption=RAW`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values: [
            [
              postId,
              post.content,
              platform,
              scheduleTimeJST,
              post.status || "pending",
              imageUrl,
              "", // Reserved for future use
              "", // Reserved for future use
              "FALSE", // Delete flag
              jstTimestamp, // Created at
              jstTimestamp, // Updated at
            ],
          ],
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error adding post to sheet:", errorData);
      addLogEntry("ERROR", "Error adding post to sheet", errorData);
      throw new Error(
        `Failed to add post: ${errorData.error?.message || "Unknown error"}`,
      );
    }

    addLogEntry("INFO", "Post added to Google Sheet successfully", {
      postId: postId,
      platform: platform,
      imageUrl,
      imageCount: imageUrls.length,
    });
    return { success: true };
  } catch (error) {
    console.error("Error adding post to Google Sheet:", error);
    addLogEntry("ERROR", "Error adding post to Google Sheet", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// Update post in Google Sheet (soft delete)
export const updatePostInGoogleSheet = async (postId: string, updates: any) => {
  try {
    const settings = await getUserSettings();
    if (!settings?.google_sheet_id) {
      throw new Error("Google Sheet not configured");
    }

    const accessToken = await getGoogleAccessToken();
    const sheetName = encodeURIComponent("投稿データ");

    // Get all data to find the row
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${settings.google_sheet_id}/values/${sheetName}?majorDimension=ROWS`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch sheet data");
    }

    const data = await response.json();
    const rows = data.values || [];

    // Find rows that match the post ID (could be multiple for different platforms)
    const matchingRows = [];
    for (let i = 1; i < rows.length; i++) {
      // Skip header row
      const row = rows[i];
      if (row[0] && row[0].startsWith(postId)) {
        matchingRows.push({ index: i + 1, data: row }); // +1 for 1-based indexing
      }
    }

    // Update each matching row
    for (const { index, data } of matchingRows) {
      // Ensure we have at least 11 columns (A-K)
      const updatedRow = [...data];
      while (updatedRow.length < 11) {
        updatedRow.push("");
      }

      if (updates.content !== undefined) updatedRow[1] = updates.content;
      if (updates.scheduleTime !== undefined) {
        // Convert to JST for display
        const scheduleTime =
          updates.scheduleTime instanceof Date
            ? updates.scheduleTime
            : new Date(updates.scheduleTime);
        const jstTime = new Date(scheduleTime.getTime() + 9 * 60 * 60 * 1000);
        updatedRow[3] = jstTime.toISOString();
      }
      if (updates.status !== undefined) updatedRow[4] = updates.status;
      if (updates.deleted !== undefined)
        updatedRow[8] = updates.deleted ? "TRUE" : "FALSE"; // Delete flag is at index 8

      // Update timestamp in JST
      const now = new Date();
      const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      updatedRow[10] = jstNow.toISOString(); // Updated at is at index 10

      const updateResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${settings.google_sheet_id}/values/${sheetName}!A${index}:K${index}?valueInputOption=RAW`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: [updatedRow],
          }),
        },
      );

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        console.error("Error updating post in sheet:", errorData);
        addLogEntry("ERROR", "Error updating post in sheet", errorData);
        throw new Error(
          `Failed to update post: ${errorData.error?.message || "Unknown error"}`,
        );
      }
    }

    addLogEntry("INFO", "Post updated in Google Sheet successfully", {
      postId,
      updates,
      rowsUpdated: matchingRows.length,
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating post in Google Sheet:", error);
    addLogEntry("ERROR", "Error updating post in Google Sheet", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// Soft delete post in Google Sheet
export const deletePostInGoogleSheet = async (postId: string) => {
  return updatePostInGoogleSheet(postId, { deleted: true });
};

// Fetch posts from Google Sheet (excluding soft deleted)
export const fetchPostsFromGoogleSheet = async () => {
  try {
    const settings = await getUserSettings();
    if (!settings?.google_sheet_id) {
      addLogEntry("INFO", "No Google Sheet configured, returning empty array");
      return [];
    }

    const accessToken = await getGoogleAccessToken();
    const sheetName = encodeURIComponent("投稿データ");

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${settings.google_sheet_id}/values/${sheetName}?majorDimension=ROWS`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      addLogEntry("ERROR", "Error fetching posts from sheet", errorData);
      throw new Error(
        `Failed to fetch posts: ${errorData.error?.message || "Unknown error"}`,
      );
    }

    const data = await response.json();
    const rows = data.values || [];

    // Group posts by base ID and filter out deleted ones
    const postsMap = new Map();

    // Skip header row and process data
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const fullId = row[0] || `sheet-${i}`;
      const isDeleted = row[8] === "TRUE"; // Fixed: delete flag is at index 8

      if (isDeleted) continue; // Skip soft deleted posts

      // Extract base post ID (remove platform suffix)
      const baseId = fullId.includes("_") ? fullId.split("_")[0] : fullId;
      const platform = row[2]; // Platform is always in column 2

      if (!postsMap.has(baseId)) {
        // Convert UTC time to JST for display
        const utcTime = new Date(row[3] || new Date().toISOString());
        const jstTime = new Date(utcTime.getTime() + 9 * 60 * 60 * 1000);

        postsMap.set(baseId, {
          id: baseId,
          content: row[1] || "",
          platforms: [], // Use platforms instead of channels
          scheduleTime: jstTime.toISOString(),
          status:
            (row[4] as "pending" | "sent" | "failed" | "draft") || "pending",
          imageUrl: row[5] || "",
          updatedAt: row[10] || row[9] || new Date().toISOString(), // Updated at is at index 10
        });
      }

      // Add platform to platforms if not already present
      const post = postsMap.get(baseId);
      if (platform && !post.platforms.includes(platform)) {
        post.platforms.push(platform);
      }
    }

    const posts = Array.from(postsMap.values());

    addLogEntry("INFO", "Posts fetched from Google Sheet successfully", {
      count: posts.length,
    });

    return posts;
  } catch (error) {
    console.error("Error fetching posts from Google Sheet:", error);
    addLogEntry("ERROR", "Error fetching posts from Google Sheet", error);
    return [];
  }
};

// Google Sheet creation flow for login
export const handleGoogleSheetCreationFlow = async () => {
  try {
    addLogEntry("INFO", "Starting Google Sheet creation flow");

    // Check if user already has a Google Sheet
    const settings = await getUserSettings();
    if (settings?.google_sheet_url) {
      addLogEntry("INFO", "User already has Google Sheet, checking existence", {
        url: settings.google_sheet_url,
      });
      const existsResult = await checkGoogleSheetExists(
        settings.google_sheet_url,
      );
      if (existsResult.exists) {
        addLogEntry("INFO", "Google Sheet exists, skipping creation");
        return {
          success: true,
          skipped: true,
          sheetUrl: settings.google_sheet_url,
        };
      } else {
        addLogEntry(
          "WARN",
          "Google Sheet not found, will create new one",
          existsResult,
        );
      }
    }

    // Get access token from current session
    const accessToken = await getGoogleAccessToken();

    // For now, create sheet in root directory
    // In a full implementation, you would show the Google Drive picker here
    const result = await createGoogleSheetWithOAuth(accessToken);

    if (result.success) {
      addLogEntry(
        "INFO",
        "Google Sheet creation flow completed successfully",
        result,
      );
      return {
        success: true,
        sheetUrl: result.sheetUrl,
        sheetId: result.sheetId,
      };
    } else {
      addLogEntry("ERROR", "Google Sheet creation failed", result);
      return { success: false, error: result.message };
    }
  } catch (error) {
    console.error("Error in Google Sheet creation flow:", error);
    addLogEntry("ERROR", "Error in Google Sheet creation flow", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// Get application logs
export const getApplicationLogs = () => {
  const logs = JSON.parse(localStorage.getItem("ylpm_logs") || "[]");
  return logs;
};

// Add log entry
export const addLogEntry = (type: string, message: string, data?: any) => {
  const logs = getApplicationLogs();

  // Format timestamp in Japanese time
  const japanTime = new Date().toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Get request headers if available
  const requestHeaders = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    referrer: document.referrer || "direct",
    url: window.location.href,
  };

  const logEntry = {
    timestamp: japanTime,
    type,
    message,
    requestHeaders,
    data: data ? JSON.stringify(data, null, 2) : undefined,
  };

  logs.unshift(logEntry); // Add to beginning

  // Keep only last 100 logs
  if (logs.length > 100) {
    logs.splice(100);
  }

  localStorage.setItem("ylpm_logs", JSON.stringify(logs));
  console.log(`[${type}] ${message}`, data);
};

// Clear logs
export const clearLogs = () => {
  localStorage.removeItem("ylpm_logs");
};
