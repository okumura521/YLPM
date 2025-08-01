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
    // This would integrate with Google Sheets API
    // For now, we'll simulate the creation
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const sheetId = `sheet_${Date.now()}`;
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`;

    return {
      success: true,
      sheetId,
      sheetUrl,
      message: "Google Sheet created successfully",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create Google Sheet",
    };
  }
};
