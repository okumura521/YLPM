import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
      status: 200,
    });
  }
  try {
    // Get user from authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: "No authorization header",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Get user from JWT
    const jwt = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      console.error("User authentication error:", userError);
      return new Response(
        JSON.stringify({
          error: "User not authenticated",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
    console.log("Refreshing token for user:", user.id);
    // Get encrypted refresh token from database
    const { data: settings, error: settingsError } = await supabase
      .from("user_settings")
      .select("google_refresh_token_encrypted")
      .eq("user_id", user.id)
      .single();
    if (settingsError || !settings?.google_refresh_token_encrypted) {
      console.error("No refresh token found:", settingsError);
      return new Response(
        JSON.stringify({
          error: "No refresh token found",
          shouldReauth: true,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
    // Decrypt the refresh token (stored as base64)
    const refreshToken = atob(settings.google_refresh_token_encrypted);
    console.log("Calling Google OAuth2 API to refresh token");
    // Call Google OAuth2 API to refresh the access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Google token refresh error:", errorData);
      // Check if refresh token is invalid
      if (errorData.error === "invalid_grant") {
        return new Response(
          JSON.stringify({
            error: "Refresh token expired or invalid",
            shouldReauth: true,
            details: errorData,
          }),
          {
            status: 401,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }
      return new Response(
        JSON.stringify({
          error: "Failed to refresh token",
          details: errorData,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
    const tokenData = await tokenResponse.json();
    console.log(
      "Token refreshed successfully, expires in:",
      tokenData.expires_in,
    );
    return new Response(
      JSON.stringify({
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in,
        token_type: tokenData.token_type,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
