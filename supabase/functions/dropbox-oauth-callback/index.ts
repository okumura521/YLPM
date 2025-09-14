import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      console.error('Dropbox OAuth error:', error);
      return new Response(
        `<html><body><script>window.close();</script><p>認証エラーが発生しました: ${error}</p></body></html>`,
        { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
      );
    }

    if (!code || !state) {
      return new Response(
        '<html><body><script>window.close();</script><p>認証パラメータが不足しています</p></body></html>',
        { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
      );
    }

    // Parse state to get user_id and folder_name
    const stateData = JSON.parse(decodeURIComponent(state));
    const { user_id, folder_name } = stateData;

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code,
        grant_type: 'authorization_code',
        client_id: Deno.env.get('DROPBOX_APP_KEY') ?? '',
        client_secret: Deno.env.get('DROPBOX_APP_SECRET') ?? '',
        redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/dropbox-oauth-callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return new Response(
        '<html><body><script>window.close();</script><p>トークン取得に失敗しました</p></body></html>',
        { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token } = tokenData;

    // Save tokens to database
    const { error: dbError } = await supabaseClient
      .from('user_settings')
      .upsert({
        user_id: user_id,
        dropbox_access_token: access_token,
        dropbox_refresh_token: refresh_token,
        dropbox_folder_name: folder_name,
        dropbox_connected: true,
      }, {
        onConflict: 'user_id'
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        '<html><body><script>window.close();</script><p>データベース保存に失敗しました</p></body></html>',
        { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
      );
    }

    // Return success page that closes the popup
    return new Response(
      `<html>
        <body>
          <script>
            // Send success message to parent window
            if (window.opener) {
              window.opener.postMessage({ type: 'DROPBOX_AUTH_SUCCESS' }, '*');
            }
            window.close();
          </script>
          <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
            <h2>✅ Dropbox連携完了</h2>
            <p>このウィンドウは自動的に閉じられます...</p>
          </div>
        </body>
      </html>`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    console.error('Callback error:', error);
    return new Response(
      '<html><body><script>window.close();</script><p>処理中にエラーが発生しました</p></body></html>',
      { headers: { ...corsHeaders, 'Content-Type': 'text/html' } }
    );
  }
});