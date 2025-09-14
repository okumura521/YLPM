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

    const { user_id, file_data, file_name, folder_name } = await req.json();

    // Get user's Dropbox tokens
    const { data: userSettings, error: settingsError } = await supabaseClient
      .from('user_settings')
      .select('dropbox_access_token, dropbox_refresh_token')
      .eq('user_id', user_id)
      .single();

    if (settingsError || !userSettings?.dropbox_access_token) {
      return new Response(
        JSON.stringify({ error: 'Dropbox not connected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Convert base64 to binary
    const binaryData = Uint8Array.from(atob(file_data), c => c.charCodeAt(0));

    // Upload to Dropbox
    const uploadResponse = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userSettings.dropbox_access_token}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: `/${folder_name}/${file_name}`,
          mode: 'add',
          autorename: true
        })
      },
      body: binaryData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Dropbox upload failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'Upload failed', details: errorText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const uploadResult = await uploadResponse.json();

    // Create shared link
    const shareResponse = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userSettings.dropbox_access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: uploadResult.path_display,
        settings: {
          requested_visibility: 'public'
        }
      })
    });

    if (!shareResponse.ok) {
      const errorText = await shareResponse.text();
      console.error('Dropbox share failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'Share link creation failed', details: errorText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const shareResult = await shareResponse.json();
    
    // Convert to direct download URL
    const directUrl = shareResult.url.replace('?dl=0', '?dl=1');

    return new Response(
      JSON.stringify({
        success: true,
        file_id: uploadResult.id,
        file_name: uploadResult.name,
        file_url: shareResult.url,
        direct_url: directUrl,
        path: uploadResult.path_display
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Upload error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});