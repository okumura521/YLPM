import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const createHtmlResponse = (message: string, script = "") => {
  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <title>Dropbox連携</title>
    <style>
      body {
        text-align: center;
        padding: 50px;
        font-family: Arial, sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        margin: 0;
      }
      .container {
        border: 1px solid #ddd;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h2>${message}</h2>
      <p>このウィンドウは自動的に閉じられます...</p>
    </div>
    <script>
      document.addEventListener('DOMContentLoaded', (event) => {
        ${script}
      });
    </script>
  </body>
</html>`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const commonHeaders = { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" };

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    const closeWindowScript = `setTimeout(() => window.close(), 1000);`;

    if (error) {
      console.error("Dropbox OAuth error:", error);
      const html = createHtmlResponse(`認証エラー: ${error}`, closeWindowScript);
      return new Response(html, { headers: commonHeaders });
    }

    if (!code || !state) {
      const html = createHtmlResponse("認証パラメータが不足しています", closeWindowScript);
      return new Response(html, { headers: commonHeaders });
    }

    const stateData = JSON.parse(decodeURIComponent(state));
    const { user_id, folder_name } = stateData;

    const tokenResponse = await fetch(
      "https://api.dropboxapi.com/oauth2/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code,
          grant_type: "authorization_code",
          client_id: Deno.env.get("DROPBOX_APP_KEY") ?? "",
          client_secret: Deno.env.get("DROPBOX_APP_SECRET") ?? "",
          redirect_uri: `${Deno.env.get("SUPABASE_URL")}/functions/v1/dropbox-oauth-callback`,
        }),
      },
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      const html = createHtmlResponse("トークン取得に失敗しました", closeWindowScript);
      return new Response(html, { headers: commonHeaders });
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token } = tokenData;

    const { error: dbError } = await supabaseClient
      .from("user_settings")
      .upsert(
        {
          user_id: user_id,
          dropbox_access_token: access_token,
          dropbox_refresh_token: refresh_token,
          dropbox_folder_name: folder_name,
          dropbox_connected: true,
        },
        { onConflict: "user_id" },
      );

    if (dbError) {
      console.error("Database error:", dbError);
      const html = createHtmlResponse("データベース保存に失敗しました", closeWindowScript);
      return new Response(html, { headers: commonHeaders });
    }

    const successScript = `
      try {
        if (window.opener) {
          window.opener.postMessage({ type: 'DROPBOX_AUTH_SUCCESS' }, '*');
        }
      } catch(e) {
        console.error('postMessage error:', e);
      } finally {
        setTimeout(() => window.close(), 1000);
      }
    `;
    const successHtml = createHtmlResponse("✅ Dropbox連携完了", successScript);
    return new Response(successHtml, { headers: commonHeaders });

  } catch (error) {
    console.error("Callback error:", error);
    const errorHtml = createHtmlResponse("処理中にエラーが発生しました", `setTimeout(() => window.close(), 1000);`);
    return new Response(errorHtml, { headers: commonHeaders });
  }
});