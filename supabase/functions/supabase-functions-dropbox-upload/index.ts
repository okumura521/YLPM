import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id, file_data, file_name, folder_name } = await req.json();

    const { data: userSettings, error: settingsError } = await supabaseClient
      .from('user_settings')
      .select('dropbox_access_token, dropbox_refresh_token')
      .eq('user_id', user_id)
      .single();

    if (settingsError || !userSettings?.dropbox_access_token || !userSettings.dropbox_refresh_token) {
      return new Response(
        JSON.stringify({ error: 'Dropbox not connected or refresh token is missing' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    let accessToken = userSettings.dropbox_access_token;
    const refreshToken = userSettings.dropbox_refresh_token;

    const callDropboxApi = async (url: string, options: RequestInit) => {
      const performFetch = async (token: string) => {
        const headers = new Headers(options.headers);
        headers.set('Authorization', `Bearer ${token}`);
        
        return await fetch(url, {
          ...options,
          headers: headers,
        });
      };

      let response = await performFetch(accessToken);

      if (response.status === 401) {
        console.log('Dropbox access token expired. Refreshing...');
        const clientId = Deno.env.get('DROPBOX_APP_KEY');
        const clientSecret = Deno.env.get('DROPBOX_APP_SECRET');

        if (!clientId || !clientSecret) {
          throw new Error('Missing Dropbox app credentials in environment variables.');
        }

        const refreshResponse = await fetch('https://api.dropbox.com/oauth2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`),
          },
          body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
        });

        if (!refreshResponse.ok) {
          const errorText = await refreshResponse.text();
          console.error('Failed to refresh Dropbox token:', errorText);
          throw new Error(`Failed to refresh Dropbox token: ${errorText}`);
        }

        const tokenData = await refreshResponse.json();
        accessToken = tokenData.access_token;

        await supabaseClient
          .from('user_settings')
          .update({ dropbox_access_token: accessToken })
          .eq('user_id', user_id);
        
        console.log('Token refreshed. Retrying API call...');
        response = await performFetch(accessToken);
      }
      return response;
    };

    const binaryData = Uint8Array.from(atob(file_data), c => c.charCodeAt(0));

    if (!accessToken || !folder_name || !file_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Helper function to escape non-ASCII characters for the Dropbox API header.
    const escapeNonAscii = (str: string) => {
      return str.replace(/[\u0080-\uFFFF]/g, (c) => {
        return "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4);
      });
    };

    const uploadHeaders = {
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': escapeNonAscii(JSON.stringify({
        path: `/${folder_name}/${file_name}`,
        mode: 'add',
        autorename: true,
      })),
    };

    const uploadResponse = await callDropboxApi('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: uploadHeaders,
      body: binaryData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Dropbox upload failed:', errorText);
      return new Response(JSON.stringify({ error: 'Upload failed', details: errorText }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      });
    }

    const uploadResult = await uploadResponse.json();

    let shareResult;
    const shareResponse = await callDropboxApi('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: uploadResult.path_display,
        settings: { requested_visibility: 'public' },
      }),
    });

    if (shareResponse.ok) {
      shareResult = await shareResponse.json();
    } else if (shareResponse.status === 409) {
      const errorBody = await shareResponse.json();
      if (errorBody?.error?.['.tag'] === 'shared_link_already_exists') {
        console.log('Shared link already exists. Fetching existing link.');
        const listResponse = await callDropboxApi('https://api.dropboxapi.com/2/sharing/list_shared_links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: uploadResult.path_display }),
        });

        if (!listResponse.ok) {
          const errorText = await listResponse.text();
          throw new Error(`Failed to retrieve existing share link: ${errorText}`);
        }

        const listResult = await listResponse.json();
        if (listResult.links && listResult.links.length > 0) {
          shareResult = listResult.links[0];
        } else {
          throw new Error('Share link was supposed to exist but not found.');
        }
      } else {
        throw new Error(`Share link creation failed with 409: ${JSON.stringify(errorBody)}`);
      }
    } else {
      const errorText = await shareResponse.text();
      throw new Error(`Share link creation failed: ${errorText}`);
    }

    if (!shareResult || typeof shareResult.url !== 'string') {
      console.error("Invalid share result from Dropbox:", shareResult);
      throw new Error('Failed to get a valid share URL from Dropbox');
    }

    const directUrl = shareResult.url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');

    return new Response(
      JSON.stringify({
        success: true,
        file_id: uploadResult.id,
        file_name: uploadResult.name,
        file_url: shareResult.url,
        direct_url: directUrl,
        path: uploadResult.path_display,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('--- Full Upload Error ---');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('--------------------------');
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message,
        stack: error.stack, // For debugging
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});