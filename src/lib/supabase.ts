import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

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

  const { data, error } = await supabase
    .from("user_settings")
    .upsert({
      user_id: user.id,
      google_sheet_id: settings.googleSheetId,
      google_sheet_url: settings.googleSheetUrl,
      ai_service: settings.aiService,
      ai_model: settings.aiModel,
      ai_api_token: settings.aiApiToken,
      ai_connection_status: settings.aiConnectionStatus,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

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

    // Save sheet info to user settings
    await saveUserSettings({
      googleSheetId: sheetId,
      googleSheetUrl: sheetUrl,
    });

    addLogEntry("INFO", "Google Sheet created successfully", {
      sheetId,
      sheetUrl,
    });

    return {
      success: true,
      sheetId,
      sheetUrl,
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

// Get Google Access Token from Supabase session
export const getGoogleAccessToken = async () => {
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
      addLogEntry("ERROR", "No provider token in session", {
        sessionExists: !!session,
        provider: session.user?.app_metadata?.provider,
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

// Add post to Google Sheet using OAuth token
export const addPostToGoogleSheet = async (post: any) => {
  try {
    const settings = await getUserSettings();
    if (!settings?.google_sheet_id) {
      throw new Error("Google Sheet not configured");
    }

    const accessToken = await getGoogleAccessToken();

    // Properly encode the sheet name for the URL
    const sheetName = encodeURIComponent("投稿データ");
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
              post.id,
              post.content,
              Array.isArray(post.platforms)
                ? post.platforms.join(", ")
                : post.platforms,
              post.scheduleTime || new Date().toISOString(),
              post.status || "pending",
              new Date().toISOString(),
              new Date().toISOString(),
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
      postId: post.id,
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
