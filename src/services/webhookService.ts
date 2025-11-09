// ===== Webhook Service =====
// Make Webhook関連の共通処理

import {
  getUserSettings,
  getGoogleAccessToken,
  initializeAISettingsSheet,
  addLogEntry,
} from "@/lib/supabase";

/**
 * Make Webhook URLを取得
 */
export const getMakeWebhookUrl = async () => {
  try {
    const settings = await getUserSettings();
    if (!settings?.google_sheet_id) {
      return { success: false, error: "Google Sheet not configured" };
    }

    const accessToken = await getGoogleAccessToken();
    const sheetId = settings.google_sheet_id;

    // AI設定シートを初期化
    await initializeAISettingsSheet();

    // F1:G1からWebhook URL設定を取得
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/ユーザ設定!F1:G1`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch webhook URL");
    }

    const data = await response.json();
    const rows = data.values || [];

    // F1が"make_webhook_url"で、G1にURLがある場合
    if (rows.length > 0 && rows[0][0] === "make_webhook_url") {
      const webhookUrl = rows[0][1] || "";
      addLogEntry("INFO", "Make Webhook URL fetched", {
        hasUrl: !!webhookUrl,
      });
      return { success: true, webhookUrl };
    }

    return { success: true, webhookUrl: "" };
  } catch (error) {
    console.error("Error getting Make Webhook URL:", error);
    addLogEntry("ERROR", "Error getting Make Webhook URL", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Make Webhook URLを保存
 */
export const saveMakeWebhookUrl = async (webhookUrl: string) => {
  try {
    const settings = await getUserSettings();
    if (!settings?.google_sheet_id) {
      throw new Error("Google Sheet not configured");
    }

    const accessToken = await getGoogleAccessToken();
    const sheetId = settings.google_sheet_id;

    // AI設定シートを初期化
    await initializeAISettingsSheet();

    // F1:G1にWebhook URL設定を保存
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/ユーザ設定!F1:G1?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values: [["make_webhook_url", webhookUrl]],
        }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to save webhook URL");
    }

    addLogEntry("INFO", "Make Webhook URL saved successfully", {
      urlPreview: webhookUrl ? `${webhookUrl.substring(0, 50)}...` : "",
    });
    return { success: true };
  } catch (error) {
    console.error("Error saving Make Webhook URL:", error);
    addLogEntry("ERROR", "Error saving Make Webhook URL", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Webhookを送信（クエリパラメータ方式）
 */
export const sendWebhook = async (
  webhookUrl: string,
  trigger: string,
  additionalParams?: Record<string, string>,
) => {
  try {
    // クエリパラメータを構築
    let url = webhookUrl;
    const separator = url.includes("?") ? "&" : "?";
    const params = new URLSearchParams({
      trigger,
      timestamp: new Date().toISOString(),
      ...additionalParams,
    });

    url = `${url}${separator}${params.toString()}`;

    addLogEntry("INFO", "Sending webhook", { trigger, url: url.substring(0, 80) });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      addLogEntry("ERROR", "Webhook request failed", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(
        `Webhook request failed: ${response.status} ${errorText}`,
      );
    }

    addLogEntry("INFO", "Webhook sent successfully", { trigger });
    return { success: true };
  } catch (error) {
    console.error("Error sending webhook:", error);
    addLogEntry("ERROR", "Error sending webhook", { trigger, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Webhookをテスト送信
 */
export const testWebhook = async (webhookUrl: string) => {
  return sendWebhook(webhookUrl, "test", { source: "settings_page" });
};
