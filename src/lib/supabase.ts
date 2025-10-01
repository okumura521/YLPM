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

    addLogEntry("INFO", "Testing AI connection", {
      service,
      model,
    });

    // Import AI providers dynamically to avoid circular imports
    const { callOpenAI, callAnthropic, callGoogleAI } = await import(
      "./aiProviders"
    );

    // Test prompt for connection verification
    const testPrompt = "Hello";

    let result;
    switch (service.toLowerCase()) {
      case "openai":
        result = await callOpenAI(testPrompt, model, apiToken);
        break;
      case "anthropic":
        result = await callAnthropic(testPrompt, model, apiToken);
        break;
      case "google":
        result = await callGoogleAI(testPrompt, model, apiToken);
        break;
      default:
        throw new Error(`サポートされていないAIサービス: ${service}`);
    }

    if (result.success) {
      addLogEntry("INFO", "AI connection test successful", {
        service,
        model,
      });
      return { success: true, message: `${service} connection successful` };
    } else {
      addLogEntry("ERROR", "AI connection test failed", {
        service,
        model,
        error: result.error,
      });
      return {
        success: false,
        message: result.error || "Connection failed",
      };
    }
  } catch (error) {
    addLogEntry("ERROR", "AI connection test error", {
      service,
      model,
      error,
    });
    return {
      success: false,
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
};

// Save user settings (Google Sheets related only)
export const saveUserSettings = async (settings: {
  googleSheetId?: string;
  googleSheetUrl?: string;
  googleDriveFolderId?: string;
  googleDriveFolderName?: string;
  googleDriveFolderUrl?: string;
  dropboxAccessToken?: string;
  dropboxRefreshToken?: string;
  dropboxFolderName?: string;
  dropboxConnected?: boolean;
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
    if (settings.dropboxAccessToken !== undefined)
      updateData.dropbox_access_token = settings.dropboxAccessToken;
    if (settings.dropboxRefreshToken !== undefined)
      updateData.dropbox_refresh_token = settings.dropboxRefreshToken;
    if (settings.dropboxFolderName !== undefined)
      updateData.dropbox_folder_name = settings.dropboxFolderName;
    if (settings.dropboxConnected !== undefined)
      updateData.dropbox_connected = settings.dropboxConnected;

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
        dropbox_access_token: settings.dropboxAccessToken,
        dropbox_refresh_token: settings.dropboxRefreshToken,
        dropbox_folder_name: settings.dropboxFolderName,
        dropbox_connected: settings.dropboxConnected,
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

  // Clear cache when settings are updated
  clearUserSettingsCache();

  addLogEntry("INFO", "User settings saved successfully", data);
  return data;
};

// Cache for user settings to prevent redundant API calls
let userSettingsCache: any = null;
let userSettingsCacheTime: number = 0;
const CACHE_DURATION = 30000; // 30 seconds

// Get user settings with caching
export const getUserSettings = async (forceRefresh = false) => {
  const now = Date.now();

  // Return cached data if available and not expired
  if (
    !forceRefresh &&
    userSettingsCache &&
    now - userSettingsCacheTime < CACHE_DURATION
  ) {
    addLogEntry("INFO", "Returning cached user settings");
    return userSettingsCache;
  }

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

  // Update cache
  userSettingsCache = data;
  userSettingsCacheTime = now;

  addLogEntry("INFO", "User settings fetched from database");
  return data;
};

// Clear user settings cache
export const clearUserSettingsCache = () => {
  userSettingsCache = null;
  userSettingsCacheTime = 0;
  addLogEntry("INFO", "User settings cache cleared");
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
                        { userEnteredValue: { stringValue: "画像ID" } },
                        { userEnteredValue: { stringValue: "予備" } },
                        { userEnteredValue: { stringValue: "予備" } },
                        { userEnteredValue: { stringValue: "削除フラグ" } },
                        { userEnteredValue: { stringValue: "作成日時" } },
                        { userEnteredValue: { stringValue: "更新日時" } },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              properties: {
                title: "画像アップロードリスト",
              },
              data: [
                {
                  rowData: [
                    {
                      values: [
                        { userEnteredValue: { stringValue: "画像ID" } },
                        { userEnteredValue: { stringValue: "ファイル名" } },
                        { userEnteredValue: { stringValue: "Googledrive画像URL" } },
                        { userEnteredValue: { stringValue: "アップロード日時" },},
                        { userEnteredValue: { stringValue: "Dropbox画像URL" } },
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

    // 画像アップロードリストシートを初期化
    await initializeImageUploadListSheet();

    // 新しい画像をアップロードして画像IDを生成
    // PostForm.tsxで画像のアップロード処理を一元化したため、ここでは行わない
    // post.images は PostForm.tsx から空の配列として渡されるはず
    let finalImageIds: string[] = post.imageIds || [];

    // 念のため重複を除去 (PostForm.tsx側で既にユニークになっているはずだが、安全のため)
    finalImageIds = [...new Set(finalImageIds)];

    addLogEntry("DEBUG", "Image IDs received by addPostToGoogleSheet", {
      postId: post.id,
      receivedPostImageIds: post.imageIds, // 受け取ったそのままの post.imageIds
      finalUniqueImageIds: finalImageIds, // 重複除去後の画像ID
      imageIdsStringPrepared: finalImageIds.join(","), // シートに書き込む文字列
    });

    const imageIdsString = finalImageIds.join(",");
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

    // Convert schedule time to JST for storage in yyyy-mm-dd HH:MM format
    let scheduleTimeJST = new Date()
      .toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" })
      .slice(0, 16);
    if (post.scheduleTime) {
      const scheduleTime =
        post.scheduleTime instanceof Date
          ? post.scheduleTime
          : new Date(post.scheduleTime);
      // Store as JST in yyyy-mm-dd HH:MM format
      scheduleTimeJST = scheduleTime
        .toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" })
        .slice(0, 16);
    } else {
      // For immediate posts, use current JST time
      const now = new Date();
      scheduleTimeJST = now
        .toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" })
        .slice(0, 16);
    }

    // Create and update timestamps in JST
//    const now = new Date();
//    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
//    const jstTimestamp = jstNow.toISOString();

    // 予定時刻と同じ処理
    const now = new Date();
    const jstTimestamp = now
      .toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" })
      .slice(0, 16);

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
              imageIdsString, // 画像ID（カンマ区切り）
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
      imageIds: finalImageIds, // 修正
      imageCount: finalImageIds.length, // 修正
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
        // Convert to JST for storage in yyyy-mm-dd HH:MM format
        const scheduleTime =
          updates.scheduleTime instanceof Date
            ? updates.scheduleTime
            : new Date(updates.scheduleTime);
        updatedRow[3] = scheduleTime
          .toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" })
          .slice(0, 16);
      }
      if (updates.status !== undefined) updatedRow[4] = updates.status;
      if (updates.imageIds !== undefined) {
        updatedRow[5] = updates.imageIds.join(",");
      }
      if (updates.deleted !== undefined) {
        updatedRow[8] = updates.deleted ? "TRUE" : "FALSE"; // Delete flag is at index 8
      }
      // Update timestamp in JST
//      const now = new Date();
//      const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
//      updatedRow[10] = jstNow.toISOString(); // Updated at is at index 10

            // Update timestamp in JST
      const now = new Date();
      const jstTimestamp = now
        .toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" })
        .slice(0, 16);
      updatedRow[10] = jstTimestamp; // Updated at is at index 10

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
        // Parse schedule time - if it's in yyyy-mm-dd HH:MM format, use it directly
        // If it's in ISO format, convert to JST
        let scheduleTimeForDisplay =
          row[3] ||
          new Date()
            .toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" })
            .slice(0, 16);
        if (row[3] && row[3].includes("T")) {
          // Old ISO format, convert to JST
          const utcTime = new Date(row[3]);
          scheduleTimeForDisplay = utcTime
            .toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" })
            .slice(0, 16);
        }

        // 画像IDを解析
        const imageIdsString = row[5] || "";
        const imageIds = imageIdsString
          ? imageIdsString
              .split(",")
              .map((id) => id.trim())
              .filter((id) => id)
          : [];

        postsMap.set(baseId, {
          id: baseId,
          content: row[1] || "",
          platforms: [], // Use platforms instead of channels
          scheduleTime: scheduleTimeForDisplay,
          status:
            (row[4] as "pending" | "sent" | "failed" | "draft") || "pending",
          imageIds: imageIds, // 画像IDの配列
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

// ===== Dropbox連携機能 =====

// Dropbox OAuth認証を開始
export const initiateDropboxAuth = async (folderName: string) => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    // State parameter with user info
    const state = encodeURIComponent(
      JSON.stringify({
        user_id: user.id,
        folder_name: folderName,
      }),
    );

    // Dropbox OAuth URL
    const dropboxAuthUrl = `https://www.dropbox.com/oauth2/authorize?` +
      `client_id=${import.meta.env.VITE_DROPBOX_APP_KEY}&` +
      `response_type=code&` +
      `token_access_type=offline&` + // refresh_tokenを取得するためにこの行を追加
      `redirect_uri=${encodeURIComponent(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dropbox-oauth-callback`)}&` +
      `state=${state}`;

    addLogEntry("INFO", "Initiating Dropbox OAuth", {
      folderName,
      userId: user.id,
    });

    // Open popup window for OAuth
    const popup = window.open(
      dropboxAuthUrl,
      "dropbox-auth",
      "width=600,height=700,scrollbars=yes,resizable=yes",
    );

    return new Promise((resolve, reject) => {
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          reject(new Error("認証がキャンセルされました"));
        }
      }, 1000);

      // Listen for success message
      const messageHandler = (event: MessageEvent) => {
        if (event.data?.type === "DROPBOX_AUTH_SUCCESS") {
          clearInterval(checkClosed);
          window.removeEventListener("message", messageHandler);
          popup?.close();
          resolve({ success: true });
        }
      };

      window.addEventListener("message", messageHandler);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(checkClosed);
        window.removeEventListener("message", messageHandler);
        popup?.close();
        reject(new Error("認証がタイムアウトしました"));
      }, 5 * 60 * 1000);
    });
  } catch (error) {
    console.error("Error initiating Dropbox auth:", error);
    addLogEntry("ERROR", "Error initiating Dropbox auth", error);
    throw error;
  }
};

// Dropbox接続状態を確認
export const checkDropboxConnection = async () => {
  try {
    const settings = await getUserSettings();
    return {
      connected: !!settings?.dropbox_connected,
      folderName: settings?.dropbox_folder_name || "",
    };
  } catch (error) {
    console.error("Error checking Dropbox connection:", error);
    addLogEntry("ERROR", "Error checking Dropbox connection", error);
    return { connected: false, folderName: "" };
  }
};

// Dropbox設定を保存
export const saveDropboxSettings = async (settings: {
  dropboxAccessToken?: string;
  dropboxRefreshToken?: string;
  dropboxFolderName?: string;
  dropboxConnected?: boolean;
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
    if (settings.dropboxAccessToken !== undefined)
      updateData.dropbox_access_token = settings.dropboxAccessToken;
    if (settings.dropboxRefreshToken !== undefined)
      updateData.dropbox_refresh_token = settings.dropboxRefreshToken;
    if (settings.dropboxFolderName !== undefined)
      updateData.dropbox_folder_name = settings.dropboxFolderName;
    if (settings.dropboxConnected !== undefined)
      updateData.dropbox_connected = settings.dropboxConnected;

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
        dropbox_access_token: settings.dropboxAccessToken,
        dropbox_refresh_token: settings.dropboxRefreshToken,
        dropbox_folder_name: settings.dropboxFolderName,
        dropbox_connected: settings.dropboxConnected,
      })
      .select()
      .single();

    data = result.data;
    error = result.error;
  }

  if (error) {
    addLogEntry("ERROR", "Error saving Dropbox settings", error);
    throw error;
  }

  // Clear cache when settings are updated
  clearUserSettingsCache();

  addLogEntry("INFO", "Dropbox settings saved successfully", data);
  return data;
};

// Dropboxに画像をアップロード
export const uploadImageToDropbox = async (file: File, imageId: string) => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const settings = await getUserSettings();
    if (!settings?.dropbox_connected) {
      throw new Error("Dropbox not connected");
    }

    // Convert file to base64
    const reader = new FileReader();
    const fileData = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;

    // Call Supabase Edge Function for upload
    const { data, error } = await supabase.functions.invoke(
      'supabase-functions-dropbox-upload',
      {
        body: {
          user_id: user.id,
          file_data: fileData,
          file_name: fileName,
          folder_name: settings.dropbox_folder_name || 'YLPM Images',
        },
      }
    );

    if (error) {
      throw error;
    }

    if (!data.success) {
      throw new Error(data.error || 'Upload failed');
    }

    addLogEntry("INFO", "Image uploaded to Dropbox successfully", {
      imageId,
      fileName: data.file_name,
      fileUrl: data.file_url,
    });

    return {
      success: true,
      fileId: data.file_id,
      fileName: data.file_name,
      fileUrl: data.file_url,
      directUrl: data.direct_url,
      path: data.path,
    };
  } catch (error) {
    console.error("Error uploading image to Dropbox:", error);
    addLogEntry("ERROR", "Error uploading image to Dropbox", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to upload image to Dropbox",
    };
  }
};

// 画像アップロードリストシートにDropbox URLカラムを追加
export const addDropboxColumnToImageSheet = async () => {
  try {
    const settings = await getUserSettings();
    if (!settings?.google_sheet_id) {
      throw new Error("Google Sheet not configured");
    }

    const accessToken = await getGoogleAccessToken();
    const sheetId = settings.google_sheet_id;

    // 画像アップロードリストシートを初期化
    await initializeImageUploadListSheet();

    // 現在のヘッダーを取得
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/画像アップロードリスト!1:1`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch current headers");
    }

    const data = await response.json();
    const currentHeaders = data.values?.[0] || [];

    // Dropbox URLカラムが既に存在するかチェック
    if (!currentHeaders.includes("Dropbox画像URL")) {
      // D列にDropbox URLカラムを追加
      const newHeaders = [...currentHeaders];
      if (newHeaders.length >= 4) {
        newHeaders.splice(4, 0, "Dropbox画像URL"); // D列の後に挿入
      } else {
        newHeaders.push("Dropbox画像URL");
      }

      const updateResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/画像アップロードリスト!1:1?valueInputOption=RAW`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: [newHeaders],
          }),
        },
      );

      if (!updateResponse.ok) {
        throw new Error("Failed to add Dropbox URL column");
      }

      addLogEntry("INFO", "Dropbox URL column added to image sheet");
    }

    return { success: true };
  } catch (error) {
    console.error("Error adding Dropbox column to image sheet:", error);
    addLogEntry("ERROR", "Error adding Dropbox column to image sheet", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// 画像IDに対してDropbox URLを更新
export const updateImageDropboxUrl = async (imageId: string, dropboxUrl: string) => {
  try {
    const settings = await getUserSettings();
    if (!settings?.google_sheet_id) {
      throw new Error("Google Sheet not configured");
    }

    const accessToken = await getGoogleAccessToken();
    const sheetId = settings.google_sheet_id;

    // 画像アップロードリストから該当する画像IDの行を検索
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/画像アップロードリスト!A:E`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch image upload list");
    }

    const data = await response.json();
    const rows = data.values || [];

    // ヘッダーをスキップして画像IDで検索
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[0] === imageId) {
        // 該当行のE列（Dropbox URL）を更新
        const rowIndex = i + 1;
        const updateResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/画像アップロードリスト!E${rowIndex}?valueInputOption=RAW`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              values: [[dropboxUrl]],
            }),
          },
        );

        if (!updateResponse.ok) {
          throw new Error("Failed to update Dropbox URL");
        }

        addLogEntry("INFO", "Dropbox URL updated for image", {
          imageId,
          dropboxUrl,
        });
        return { success: true };
      }
    }

    throw new Error("Image ID not found");
  } catch (error) {
    console.error("Error updating image Dropbox URL:", error);
    addLogEntry("ERROR", "Error updating image Dropbox URL", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// ===== AI設定管理機能（Google Sheets） =====

// AI設定シートを初期化
export const initializeAISettingsSheet = async () => {
  try {
    const settings = await getUserSettings();
    if (!settings?.google_sheet_id) {
      throw new Error("Google Sheet not configured");
    }

    const accessToken = await getGoogleAccessToken();
    const sheetId = settings.google_sheet_id;

    // AI設定シートのヘッダーを設定
    const headers = [
      "ai_service",
      "ai_model",
      "ai_api_token",
      "ai_connection_status",
      "is_selected",
    ];

    // シートが存在するかチェック
    const checkResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!checkResponse.ok) {
      throw new Error("Failed to check sheet existence");
    }

    const sheetsData = await checkResponse.json();
    const aiSettingsSheetExists = sheetsData.sheets.some(
      (sheet: any) => sheet.properties.title === "ユーザ設定",
    );

    if (!aiSettingsSheetExists) {
      // 新しいシートを作成
      const createResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: {
                    title: "ユーザ設定",
                  },
                },
              },
            ],
          }),
        },
      );

      if (!createResponse.ok) {
        throw new Error("Failed to create AI settings sheet");
      }

      // ヘッダーを設定
      const headerResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/ユーザ設定!A1:E1?valueInputOption=RAW`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: [headers],
          }),
        },
      );

      if (!headerResponse.ok) {
        throw new Error("Failed to set AI settings headers");
      }
    }

    addLogEntry("INFO", "AI settings sheet initialized successfully");
    return { success: true };
  } catch (error) {
    console.error("Error initializing AI settings sheet:", error);
    addLogEntry("ERROR", "Error initializing AI settings sheet", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// AI設定を取得
export const getAISettings = async () => {
  try {
    const settings = await getUserSettings();
    if (!settings?.google_sheet_id) {
      return { success: true, aiSettings: [] };
    }

    const accessToken = await getGoogleAccessToken();
    const sheetId = settings.google_sheet_id;

    // AI設定シートを初期化
    await initializeAISettingsSheet();

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/ユーザ設定!A:E`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch AI settings");
    }

    const data = await response.json();
    const rows = data.values || [];

    // ヘッダーをスキップしてAI設定を取得
    const aiSettings = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[0]) {
        // ai_serviceが存在する場合のみ
        aiSettings.push({
          ai_service: row[0],
          ai_model: row[1] || "",
          ai_api_token: row[2] || "",
          ai_connection_status: row[3] === "TRUE",
          is_selected: row[4] === "TRUE",
        });
      }
    }

    addLogEntry("INFO", "AI settings fetched successfully", {
      count: aiSettings.length,
    });
    return { success: true, aiSettings };
  } catch (error) {
    console.error("Error getting AI settings:", error);
    addLogEntry("ERROR", "Error getting AI settings", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      aiSettings: [],
    };
  }
};

// AI設定を保存/更新
export const saveAISettings = async (aiSettings: {
  ai_service: string;
  ai_model: string;
  ai_api_token: string;
  ai_connection_status: boolean;
  is_selected: boolean;
}) => {
  try {
    const settings = await getUserSettings();
    if (!settings?.google_sheet_id) {
      throw new Error("Google Sheet not configured");
    }

    const accessToken = await getGoogleAccessToken();
    const sheetId = settings.google_sheet_id;

    // AI設定シートを初期化
    await initializeAISettingsSheet();

    // 既存の設定を取得
    const existingSettings = await getAISettings();
    if (!existingSettings.success) {
      throw new Error("Failed to get existing AI settings");
    }

    // 既存の設定から該当するサービスを探す
    const existingIndex = existingSettings.aiSettings.findIndex(
      (setting: any) => setting.ai_service === aiSettings.ai_service,
    );

    if (existingIndex >= 0) {
      // 既存の設定を更新
      const rowIndex = existingIndex + 2; // ヘッダー行 + 1-based indexing
      const updateResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/ユーザ設定!A${rowIndex}:E${rowIndex}?valueInputOption=RAW`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: [
              [
                aiSettings.ai_service,
                aiSettings.ai_model,
                aiSettings.ai_api_token,
                aiSettings.ai_connection_status ? "TRUE" : "FALSE",
                aiSettings.is_selected ? "TRUE" : "FALSE",
              ],
            ],
          }),
        },
      );

      if (!updateResponse.ok) {
        throw new Error("Failed to update AI settings");
      }
    } else {
      // 新しい設定を追加
      const appendResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/ユーザ設定!A:E:append?valueInputOption=RAW`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: [
              [
                aiSettings.ai_service,
                aiSettings.ai_model,
                aiSettings.ai_api_token,
                aiSettings.ai_connection_status ? "TRUE" : "FALSE",
                aiSettings.is_selected ? "TRUE" : "FALSE",
              ],
            ],
          }),
        },
      );

      if (!appendResponse.ok) {
        throw new Error("Failed to add AI settings");
      }
    }

    addLogEntry("INFO", "AI settings saved successfully", aiSettings);
    return { success: true };
  } catch (error) {
    console.error("Error saving AI settings:", error);
    addLogEntry("ERROR", "Error saving AI settings", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// 選択されたAI設定を更新（他の設定のis_selectedをfalseにする）
export const updateSelectedAIService = async (selectedService: string) => {
  try {
    const existingSettings = await getAISettings();
    if (!existingSettings.success) {
      throw new Error("Failed to get existing AI settings");
    }

    // 全ての設定のis_selectedを更新
    for (const setting of existingSettings.aiSettings) {
      const updatedSetting = {
        ...setting,
        is_selected: setting.ai_service === selectedService,
      };
      await saveAISettings(updatedSetting);
    }

    addLogEntry("INFO", "Selected AI service updated", { selectedService });
    return { success: true };
  } catch (error) {
    console.error("Error updating selected AI service:", error);
    addLogEntry("ERROR", "Error updating selected AI service", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// 選択されたAI設定を取得
export const getSelectedAISettings = async () => {
  try {
    const result = await getAISettings();
    if (!result.success) {
      return { success: false, error: result.error };
    }

    const selectedSetting = result.aiSettings.find(
      (setting: any) => setting.is_selected,
    );

    if (!selectedSetting) {
      return { success: true, aiSettings: null };
    }

    return { success: true, aiSettings: selectedSetting };
  } catch (error) {
    console.error("Error getting selected AI settings:", error);
    addLogEntry("ERROR", "Error getting selected AI settings", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// ===== 画像管理機能 =====

// 画像アップロードリストシートを作成・初期化
export const initializeImageUploadListSheet = async () => {
  try {
    const settings = await getUserSettings();
    if (!settings?.google_sheet_id) {
      addLogEntry(
        "ERROR",
        "Google Sheet not configured for image upload list initialization",
      );
      throw new Error("Google Sheet not configured");
    }

    const accessToken = await getGoogleAccessToken();
    const sheetId = settings.google_sheet_id;

    // 画像アップロードリストシートのヘッダーを設定
    const headers = ["画像ID", "ファイル名", "画像URL", "アップロード日時"];

    // シートが存在するかチェック
    const checkResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!checkResponse.ok) {
      throw new Error("Failed to check sheet existence");
    }

    const sheetsData = await checkResponse.json();
    const imageSheetExists = sheetsData.sheets.some(
      (sheet: any) => sheet.properties.title === "画像アップロードリスト",
    );

    if (!imageSheetExists) {
      // 新しいシートを作成
      const createResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: {
                    title: "画像アップロードリスト",
                  },
                },
              },
            ],
          }),
        },
      );

      if (!createResponse.ok) {
        throw new Error("Failed to create image upload list sheet");
      }

      // ヘッダーを設定
      const headerResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/画像アップロードリスト!A1:D1?valueInputOption=RAW`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: [headers],
          }),
        },
      );

      if (!headerResponse.ok) {
        throw new Error("Failed to set image upload list headers");
      }
    }

    addLogEntry("INFO", "Image upload list sheet initialized successfully");
    return { success: true };
  } catch (error) {
    console.error("Error initializing image upload list sheet:", error);
    addLogEntry("ERROR", "Error initializing image upload list sheet", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// 画像をアップロードして画像IDを生成
export const uploadImageAndGenerateId = async (file: File) => {
  try {
    const settings = await getUserSettings();
    if (!settings?.google_drive_folder_id) {
      addLogEntry(
        "ERROR",
        "Google Drive folder not configured for image upload",
      );
      throw new Error("Google Drive folder not configured");
    }

    if (!settings?.google_sheet_id) {
      addLogEntry("ERROR", "Google Sheet not configured for image upload");
      throw new Error("Google Sheet not configured");
    }

    const accessToken = await getGoogleAccessToken();

    // 画像アップロードリストシートを初期化
    await initializeImageUploadListSheet();

    // 画像IDを生成（タイムスタンプ + ランダム文字列）
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const imageId = `img_${timestamp}_${randomString}`;

    // Google Driveにアップロード
    const uploadResult = await uploadImageToGoogleDrive(
      accessToken,
      file,
      settings.google_drive_folder_id,
    );

    if (!uploadResult.success) {
      addLogEntry("ERROR", "Google Drive upload failed", {
        fileName: file.name,
        error: uploadResult.message || "Unknown error",
      });
      throw new Error(uploadResult.message || "Failed to upload image");
    }

    // 画像アップロードリストに追加
    const sheetId = settings.google_sheet_id;
    const uploadTime = new Date().toISOString();

    const addImageResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/画像アップロードリスト!A:D:append?valueInputOption=RAW`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values: [
            [
              imageId,
              file.name,
              uploadResult.directUrl || uploadResult.fileUrl,
              uploadTime,
            ],
          ],
        }),
      },
    );

    if (!addImageResponse.ok) {
      const errorData = await addImageResponse.json().catch(() => ({}));
      addLogEntry("ERROR", "Failed to add image to upload list", {
        fileName: file.name,
        imageId,
        responseStatus: addImageResponse.status,
        errorData,
      });
      throw new Error("Failed to add image to upload list");
    }

    addLogEntry("INFO", "Image uploaded and ID generated successfully", {
      imageId,
      fileName: file.name,
      fileUrl: uploadResult.directUrl || uploadResult.fileUrl,
    });

    return {
      success: true,
      imageId,
      fileName: file.name,
      imageUrl: uploadResult.directUrl || uploadResult.fileUrl,
      uploadTime,
    };
  } catch (error) {
    console.error("Error uploading image and generating ID:", error);
    addLogEntry("ERROR", "Error uploading image and generating ID", {
      error: error instanceof Error ? error.message : "Unknown error",
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// 画像IDから画像情報を取得
export const getImageInfoById = async (imageId: string) => {
  try {
    const settings = await getUserSettings();
    if (!settings?.google_sheet_id) {
      throw new Error("Google Sheet not configured");
    }

    const accessToken = await getGoogleAccessToken();
    const sheetId = settings.google_sheet_id;

    // 画像アップロードリストから画像IDで検索
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/画像アップロードリスト!A:D`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch image upload list");
    }

    const data = await response.json();
    const rows = data.values || [];

    // ヘッダーをスキップして画像IDで検索
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[0] === imageId) {
        return {
          success: true,
          imageId: row[0],
          fileName: row[1],
          imageUrl: row[2],
          uploadTime: row[3],
        };
      }
    }

    return {
      success: false,
      error: "Image not found",
    };
  } catch (error) {
    console.error("Error getting image info by ID:", error);
    addLogEntry("ERROR", "Error getting image info by ID", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// 複数の画像IDから画像情報を取得
export const getImagesInfoByIds = async (imageIds: string[]) => {
  try {
    const settings = await getUserSettings();
    if (!settings?.google_sheet_id) {
      throw new Error("Google Sheet not configured");
    }

    const accessToken = await getGoogleAccessToken();
    const sheetId = settings.google_sheet_id;

    // 画像アップロードリストを取得
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/画像アップロードリスト!A:D`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch image upload list");
    }

    const data = await response.json();
    const rows = data.values || [];
    const imageMap = new Map();

    // ヘッダーをスキップして画像情報をマップに格納
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      imageMap.set(row[0], {
        imageId: row[0],
        fileName: row[1],
        imageUrl: row[2],
        uploadTime: row[3],
      });
    }

    // 要求された画像IDの情報を取得
    const results = imageIds.map((id) => {
      const info = imageMap.get(id);
      return info || { imageId: id, error: "Image not found" };
    });

    return {
      success: true,
      images: results,
    };
  } catch (error) {
    console.error("Error getting images info by IDs:", error);
    addLogEntry("ERROR", "Error getting images info by IDs", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};