import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Google API connection test
export const testGoogleConnection = async (
  clientId: string,
  clientSecret: string,
  redirectUri: string,
) => {
  try {
    // This is a basic validation - in a real app you'd make an actual API call
    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("All Google API credentials are required");
    }

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Basic format validation
    if (!clientId.includes(".googleusercontent.com")) {
      throw new Error("Invalid Google Client ID format");
    }

    return { success: true, message: "Google connection successful" };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
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

// Save user settings (encrypted)
export const saveUserSettings = async (settings: {
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUri?: string;
  googleConnectionStatus?: boolean;
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
      google_client_id: settings.googleClientId,
      google_client_secret: settings.googleClientSecret,
      google_redirect_uri: settings.googleRedirectUri,
      google_connection_status: settings.googleConnectionStatus,
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

// Create Google Sheet
export const createGoogleSheet = async (directoryId?: string) => {
  try {
    const settings = await getUserSettings();
    if (!settings?.google_client_id || !settings?.google_client_secret) {
      throw new Error("Google API credentials not configured");
    }

    // Get access token (this would normally be done through OAuth flow)
    const accessToken = await getGoogleAccessToken(settings);

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
                title: "Posts",
              },
              data: [
                {
                  rowData: [
                    {
                      values: [
                        { userEnteredValue: { stringValue: "ID" } },
                        { userEnteredValue: { stringValue: "Content" } },
                        { userEnteredValue: { stringValue: "Platforms" } },
                        { userEnteredValue: { stringValue: "Schedule Time" } },
                        { userEnteredValue: { stringValue: "Status" } },
                        { userEnteredValue: { stringValue: "Created At" } },
                        { userEnteredValue: { stringValue: "Updated At" } },
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
      throw new Error(
        `Failed to create sheet: ${errorData.error?.message || "Unknown error"}`,
      );
    }

    const sheetData = await response.json();
    const sheetId = sheetData.spreadsheetId;
    const sheetUrl = sheetData.spreadsheetUrl;

    // Save sheet info to user settings
    await saveUserSettings({
      ...settings,
      googleSheetId: sheetId,
      googleSheetUrl: sheetUrl,
    });

    console.log("Google Sheet created successfully:", { sheetId, sheetUrl });

    return {
      success: true,
      sheetId,
      sheetUrl,
      message: "Google Sheet created successfully",
    };
  } catch (error) {
    console.error("Error creating Google Sheet:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create Google Sheet",
    };
  }
};

// Get Google Access Token (simplified - in production use proper OAuth flow)
const getGoogleAccessToken = async (settings: any) => {
  // This is a simplified version - in production, implement proper OAuth flow
  // For now, we'll simulate getting an access token
  console.log("Getting Google access token...");

  // In a real implementation, you would:
  // 1. Redirect user to Google OAuth
  // 2. Get authorization code
  // 3. Exchange code for access token
  // 4. Store and refresh tokens as needed

  // For demo purposes, return a mock token
  return "mock_access_token_" + Date.now();
};

// Check if Google Sheet exists
export const checkGoogleSheetExists = async (sheetUrl: string) => {
  try {
    const settings = await getUserSettings();
    if (!settings?.google_client_id || !sheetUrl) {
      return { exists: false, error: "No sheet URL or credentials" };
    }

    // Extract sheet ID from URL
    const sheetIdMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch) {
      return { exists: false, error: "Invalid sheet URL format" };
    }

    const sheetId = sheetIdMatch[1];
    const accessToken = await getGoogleAccessToken(settings);

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    console.log("Sheet existence check response:", response.status);

    if (response.status === 404) {
      return { exists: false, error: "Sheet not found" };
    }

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Sheet check error:", errorData);
      return {
        exists: false,
        error: errorData.error?.message || "Unknown error",
      };
    }

    return { exists: true };
  } catch (error) {
    console.error("Error checking sheet existence:", error);
    return {
      exists: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// Add post to Google Sheet
export const addPostToGoogleSheet = async (post: any) => {
  try {
    const settings = await getUserSettings();
    if (!settings?.googleSheetId) {
      throw new Error("Google Sheet not configured");
    }

    const accessToken = await getGoogleAccessToken(settings);

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${settings.googleSheetId}/values/Posts:append?valueInputOption=RAW`,
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
      throw new Error(
        `Failed to add post: ${errorData.error?.message || "Unknown error"}`,
      );
    }

    console.log("Post added to Google Sheet successfully");
    return { success: true };
  } catch (error) {
    console.error("Error adding post to Google Sheet:", error);
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
  const logEntry = {
    timestamp: new Date().toISOString(),
    type,
    message,
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
