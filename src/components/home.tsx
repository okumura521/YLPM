import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  PlusIcon,
  RefreshCcwIcon,
  Settings,
  LogOut,
  FileText,
  Trash2,
  FileSpreadsheet,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import PostTable from "./PostTable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertTriangle } from "lucide-react";
import PostForm from "./PostForm";
import {
  supabase,
  checkGoogleSheetExists,
  getUserSettings,
  addLogEntry,
  getApplicationLogs,
  clearLogs,
  getGoogleAccessToken,
  openGoogleDrivePicker,
  createGoogleSheetWithOAuth,
  fetchPostsFromGoogleSheet,
  addPostToGoogleSheet,
  updatePostInGoogleSheet,
  deletePostInGoogleSheet,
  checkGoogleTokenValidity,
  refreshGoogleAccessToken,
  saveGoogleRefreshToken,
} from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

import { handleGoogleSheetCreationFlow } from "@/lib/supabase";

interface Post {
  id: string;
  content: string;
  scheduleTime: string;
  platforms: string[] | Record<string, any>;
  channels?: string[];
  status: "pending" | "sent" | "failed" | "draft";
  updatedAt: string;
  imageIds?: string[];
  scheduleTimeData?: Record<string, string>;
  // Google Sheetから取得したステータスデータ（{postId}_{platform} = status形式）
  statusData?: Record<string, "pending" | "sent" | "failed" | "draft">;
}

const Home = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentPost, setCurrentPost] = useState<Post | null>(null);
  const [isLogsDialogOpen, setIsLogsDialogOpen] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [sheetError, setSheetError] = useState<string>("");
  const [lastRefreshTime, setLastRefreshTime] = useState<string>("");
  const sheetCreationHandled = useRef(false);
  const tokenRefreshAttempted = useRef(false);
  const fetchRetryAttempted = useRef(false);

  // Check Google token validity
  const checkGoogleTokenValidityLocal = async (): Promise<boolean> => {
    try {
      return await checkGoogleTokenValidity();
    } catch (error) {
      addLogEntry("ERROR", "Error checking Google token validity", error);
      return false;
    }
  };

  // Refresh Google token with staged error handling
  const refreshGoogleToken = async (
    attempt: number = 1,
  ): Promise<{ success: boolean; shouldLogout: boolean }> => {
    if (tokenRefreshAttempted.current && attempt === 1) {
      addLogEntry("INFO", "Token refresh already attempted, skipping");
      return { success: false, shouldLogout: false };
    }

    try {
      tokenRefreshAttempted.current = true;
      addLogEntry(
        "INFO",
        `Attempting to refresh Google token (attempt ${attempt})`,
      );

      const result = await refreshGoogleAccessToken(attempt);

      if (result.success) {
        addLogEntry("INFO", "Google token refreshed successfully");
        setSheetError(""); // Clear any existing errors
        tokenRefreshAttempted.current = false; // Reset on success
        return { success: true, shouldLogout: false };
      } else if (result.shouldLogout) {
        addLogEntry("ERROR", "Max refresh attempts reached, forcing logout");
        setSheetError("認証の期限が切れました。再ログインが必要です。");
        return { success: false, shouldLogout: true };
      } else {
        addLogEntry("ERROR", "Failed to refresh Google token");

        if (attempt === 1) {
          // Show user notification for manual retry
          setSheetError("認証の更新に失敗しました。もう一度お試しください。");
          toast({
            title: "認証エラー",
            description: "認証の更新に失敗しました。もう一度お試しください。",
            variant: "destructive",
          });
        }

        return { success: false, shouldLogout: false };
      }
    } catch (error) {
      addLogEntry("ERROR", "Error refreshing Google token", error);
      return { success: false, shouldLogout: false };
    }
  };

  // Update last refresh time
  const updateLastRefreshTime = () => {
    const now = new Date();
    setLastRefreshTime(
      now.toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    );
  };

  // Fetch posts from Google Sheets with retry logic
  const fetchPosts = async (retryOnTokenError = true) => {
    setIsLoading(true);
    try {
      // Check if it's a test user
      const testUser = localStorage.getItem("testUser");
      if (testUser) {
        addLogEntry("INFO", "Test user detected, using mock data");
        setPosts([]);
        updateLastRefreshTime();
        return;
      }

      const postsFromSheet = await fetchPostsFromGoogleSheet();

      // Google Sheetから全ス���ータスデータを取得
      const settings = await getUserSettings();
      if (settings?.google_sheet_id) {
        try {
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

          if (response.ok) {
            const data = await response.json();
            const rows = data.values || [];

            // ステータスデータを収集（{postId}_{platform} = status形式）
            const statusDataMap: Record<string, Record<string, string>> = {};

            for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              const fullId = row[0] || "";
              const status = row[4] || "pending";
              const isDeleted = row[8] === "TRUE";

              if (isDeleted) continue;

              // fullIdから baseId と platform を抽出
              const parts = fullId.split("_");
              if (parts.length >= 2) {
                const baseId = parts[0];
                const platform = parts.slice(1).join("_").toLowerCase();

                if (!statusDataMap[baseId]) {
                  statusDataMap[baseId] = {};
                }

                // {postId}_{platform} = status の形式で保存
                statusDataMap[baseId][`${baseId}_${platform}`] = status;
              }
            }

            // postsにstatusDataを追加
            const postsWithStatus = postsFromSheet.map((post) => ({
              ...post,
              statusData: statusDataMap[post.id] || {},
            }));

            setPosts(postsWithStatus);
            addLogEntry("INFO", "Posts fetched with status data", {
              count: postsWithStatus.length,
              statusDataCount: Object.keys(statusDataMap).length,
            });
          } else {
            // ステータスデータ取得失敗時は通常のpostsを使用
            setPosts(postsFromSheet);
            addLogEntry(
              "WARN",
              "Failed to fetch status data, using default posts",
            );
          }
        } catch (error) {
          // エラー時は通常のpostsを使用
          setPosts(postsFromSheet);
          addLogEntry("ERROR", "Error fetching status data", error);
        }
      } else {
        setPosts(postsFromSheet);
      }

      setSheetError(""); // Clear any existing errors
      fetchRetryAttempted.current = false; // Reset retry flag on success
      updateLastRefreshTime();
      addLogEntry("INFO", "Posts fetched successfully", {
        count: postsFromSheet.length,
      });
    } catch (error: any) {
      console.error("Error fetching posts:", error);
      addLogEntry("ERROR", "Error fetching posts", error);

      const errorMessage = error?.message || "Unknown error";

      // Check if it's a token-related error and retry once
      if (
        retryOnTokenError &&
        !fetchRetryAttempted.current &&
        (errorMessage.includes("access token") ||
          errorMessage.includes("401") ||
          errorMessage.includes("403"))
      ) {
        fetchRetryAttempted.current = true;
        addLogEntry(
          "INFO",
          "Token error detected, attempting refresh and retry",
        );

        const result = await refreshGoogleToken(1);
        if (result.success) {
          // Retry fetching posts
          setTimeout(() => fetchPosts(false), 1000);
          return;
        } else if (result.shouldLogout) {
          // Force logout
          await handleLogout();
          return;
        } else {
          // リフレッシュ失敗時もエラーメッセージを表示
          setSheetError(
            "Google認証の期限が切れています。再ログインまたは設定の確認をお願いします。",
          );
        }
      }

      // Set user-friendly error message
      if (errorMessage.includes("access token")) {
        setSheetError(
          "Google認証の期限が切れています。再ログインをお願いします。",
        );
      } else {
        setSheetError(`データ取得エラー: ${errorMessage}`);
      }

      toast({
        title: "データ取得エラー",
        description: "投稿データの取得に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initializeComponent = async () => {
      if (!isMounted) return;

      await fetchPosts();

      // Check initial authentication state
      const checkInitialAuth = async () => {
        try {
          // Check for test user first
          const testUser = localStorage.getItem("testUser");
          if (testUser && isMounted) {
            setUser(JSON.parse(testUser));
            return;
          }

          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!isMounted) return;

          if (!user) {
            navigate("/login", { replace: true });
          } else {
            setUser(user);

            // Save Google refresh token on login
            const {
              data: { session },
            } = await supabase.auth.getSession();

            addLogEntry(
              "INFO",
              "LOGIN - Session Check START / Save Google refresh token on login",
              {
                hasSession: !!session,
                hasUser: !!session?.user,
                provider: session?.user?.app_metadata?.provider,
                timestamp: new Date().toISOString(),
              },
            );

            addLogEntry(
              "INFO",
              "LOGIN - supabase_session_Provider tokens check",
              {
                supabase_session_hasProviderToken: !!session?.provider_token,
                supabase_session_hasProviderRefreshToken:
                  !!session?.provider_refresh_token,
                supabase_session_providerTokenPreview: session?.provider_token
                  ? `${session.provider_token.substring(0, 30)}...`
                  : "undefined...",
                supabase_session_providerRefreshTokenPreview:
                  session?.provider_refresh_token
                    ? `${session.provider_refresh_token.substring(0, 30)}...`
                    : "undefined...",
                supabase_session_providerTokenLength: session?.provider_token
                  ? session.provider_token.length
                  : 0,
                supabase_session_providerRefreshTokenLength:
                  session?.provider_refresh_token
                    ? session.provider_refresh_token.length
                    : 0,
                supabase_session_expiresAt: session?.expires_at,
                supabase_session_expiresIn: session?.expires_at
                  ? `${session.expires_at - Math.floor(Date.now() / 1000)} seconds`
                  : "unknown",
              },
            );

            if (session?.provider_refresh_token) {
              addLogEntry(
                "INFO",
                "LOGIN - Attempting to save refresh token to DB",
                session.provider_refresh_token,
              );

              try {
                await saveGoogleRefreshToken(session.provider_refresh_token);

                addLogEntry(
                  "INFO",
                  "LOGIN - Refresh token saved to DB successfully",
                  {
                    userId: user.id,
                    timestamp: new Date().toISOString(),
                  },
                );
              } catch (error) {
                addLogEntry(
                  "ERROR",
                  "LOGIN - Failed to save refresh token to DB",
                  error,
                );
              }
            } else {
              addLogEntry(
                "WARN",
                "LOGIN - No provider_refresh_token in session",
                {
                  supabase_session_hasProviderToken: !!session?.provider_token,
                  supabase_session_expiresAt: session?.expires_at,
                },
              );
            }
          }
        } catch (error) {
          if (isMounted) {
            console.error("Authentication check failed:", error);
            addLogEntry("ERROR", "Authentication check failed", error);
            navigate("/login", { replace: true });
          }
        }
      };

      await checkInitialAuth();
    };

    initializeComponent();

    // Auto refresh every 5 minutes
    const autoRefreshInterval = setInterval(
      () => {
        fetchPosts();
      },
      5 * 60 * 1000,
    ); // 5 minutes

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === "SIGNED_OUT") {
        addLogEntry("INFO", "SIGN OUT - Clearing session");

        localStorage.removeItem("testUser");
        sheetCreationHandled.current = false;
        tokenRefreshAttempted.current = false;
        fetchRetryAttempted.current = false;
        navigate("/login", { replace: true });
      } else if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user);

        addLogEntry(
          "INFO",
          "SIGN IN - Session Check START / Listen for auth state changes",
          {
            hasSession: !!session,
            hasUser: !!session?.user,
            provider: session?.user?.app_metadata?.provider,
            timestamp: new Date().toISOString(),
          },
        );

        addLogEntry(
          "INFO",
          "SIGN IN - supabase_session_Provider tokens check",
          {
            supabase_session_hasProviderToken: !!session.provider_token,
            supabase_session_hasProviderRefreshToken:
              !!session.provider_refresh_token,
            supabase_session_providerTokenPreview: session.provider_token
              ? `${session.provider_token.substring(0, 30)}...`
              : "undefined...",
            supabase_session_providerRefreshTokenPreview:
              session.provider_refresh_token
                ? `${session.provider_refresh_token.substring(0, 30)}...`
                : "undefined...",
            supabase_session_providerTokenLength: session.provider_token
              ? session.provider_token.length
              : 0,
            supabase_session_providerRefreshTokenLength:
              session.provider_refresh_token
                ? session.provider_refresh_token.length
                : 0,
            supabase_session_expiresAt: session.expires_at,
            supabase_session_expiresIn: session.expires_at
              ? `${session.expires_at - Math.floor(Date.now() / 1000)} seconds`
              : "unknown",
          },
        );

        // Save Google refresh token on sign in
        if (session.provider_refresh_token) {
          addLogEntry(
            "INFO",
            "SIGN IN - Attempting to save refresh token to DB",
            session.provider_refresh_token,
          );

          try {
            const { saveGoogleRefreshToken } = await import("@/lib/supabase");
            await saveGoogleRefreshToken(session.provider_refresh_token);

            addLogEntry(
              "INFO",
              "SIGN IN - Refresh token saved to DB successfully",
              {
                userId: session.user.id,
                timestamp: new Date().toISOString(),
              },
            );
          } catch (error) {
            addLogEntry(
              "ERROR",
              "SIGN IN - Failed to save refresh token to DB",
              error,
            );
          }
        } else {
          addLogEntry(
            "WARN",
            "SIGN IN - No provider_refresh_token in session",
            {
              supabase_session_hasProviderToken: !!session.provider_token,
              supabase_session_expiresAt: session.expires_at,
            },
          );
        }
      }
    });

    return () => {
      isMounted = false;
      clearInterval(autoRefreshInterval);
      subscription.unsubscribe();
    };
  }, [navigate]);

  // Periodic token check and logging (every 5 minutes)
  useEffect(() => {
    const interval = setInterval(
      async () => {
        if (
          user?.app_metadata?.provider === "google" &&
          !localStorage.getItem("testUser")
        ) {
          // Log current token status
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const now = Math.floor(Date.now() / 1000);

          addLogEntry("INFO", "PERIODIC CHECK (5min) - Token status", {
            timestamp: new Date().toISOString(),
            supabase_session_hasProviderToken: !!session?.provider_token,
            supabase_session_expiresAt: session?.expires_at,
            supabase_session_expiresIn: session?.expires_at
              ? `${session.expires_at - now} seconds`
              : "unknown",
            supabase_session_isExpired: session?.expires_at
              ? session.expires_at < now
              : "unknown",
          });

          // Check if token is expired or about to expire (within 5 minutes)
          if (session?.expires_at && session.expires_at < now + 300) {
            addLogEntry(
              "INFO",
              "PERIODIC CHECK - Token expired or expiring soon, refreshing",
            );

            const result = await refreshGoogleToken(1);
            if (result.shouldLogout) {
              await handleLogout();
            } else if (!result.success) {
              setSheetError(
                "Google認証の期限が切れています。再ログインしてください。",
              );
            } else {
              addLogEntry(
                "INFO",
                "PERIODIC CHECK - Token refreshed successfully",
              );
            }
          }
        }
      },
      5 * 60 * 1000,
    ); // 5 minutes

    return () => clearInterval(interval);
  }, [user]);

  // 1-hour check for testing
  useEffect(() => {
    const oneHourCheck = setTimeout(
      async () => {
        if (
          user?.app_metadata?.provider === "google" &&
          !localStorage.getItem("testUser")
        ) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const now = Math.floor(Date.now() / 1000);

          addLogEntry("INFO", "1-HOUR CHECK - Token status after 1 hour", {
            timestamp: new Date().toISOString(),
            supabase_session_hasProviderToken: !!session?.provider_token,
            supabase_session_hasProviderRefreshToken:
              !!session?.provider_refresh_token,
            supabase_session_expiresAt: session?.expires_at,
            supabase_session_expiresIn: session?.expires_at
              ? `${session.expires_at - now} seconds`
              : "unknown",
            supabase_session_isExpired: session?.expires_at
              ? session.expires_at < now
              : "unknown",
          });

          // Try to refresh token
          addLogEntry(
            "INFO",
            "1-HOUR CHECK - Attempting token refresh via Edge Function",
          );
          const result = await refreshGoogleToken(1);

          if (result.success) {
            addLogEntry("INFO", "1-HOUR CHECK - Token refresh SUCCESS", {
              timestamp: new Date().toISOString(),
            });

            toast({
              title: "トークン更新成功",
              description: "1時間後のトークン更新に成功しました",
            });
          } else if (result.shouldLogout) {
            addLogEntry(
              "ERROR",
              "1-HOUR CHECK - Token refresh FAILED - Logout required",
              {
                timestamp: new Date().toISOString(),
              },
            );

            toast({
              title: "認証エラー",
              description: "認証の期限が切れました。再ログインしてください。",
              variant: "destructive",
            });

            await handleLogout();
          } else {
            addLogEntry("ERROR", "1-HOUR CHECK - Token refresh FAILED", {
              timestamp: new Date().toISOString(),
            });

            toast({
              title: "トークン更新失敗",
              description: "トークンの更新に失敗しました",
              variant: "destructive",
            });
          }
        }
      },
      60 * 60 * 1000,
    ); // 1 hour

    return () => clearTimeout(oneHourCheck);
  }, [user]);

  // Handle Google Sheet creation flow on login with enhanced error handling
  const handleSheetCreationOnLogin = async () => {
    try {
      // Only run this for Google OAuth users, not test users
      const testUser = localStorage.getItem("testUser");
      if (testUser) {
        return;
      }

      addLogEntry("INFO", "Starting Google Sheet creation flow on login");

      // Check token validity first
      const tokenValid = await checkGoogleTokenValidityLocal();
      if (!tokenValid) {
        addLogEntry("WARN", "Google token invalid, attempting refresh");
        const result = await refreshGoogleToken(1);
        if (result.shouldLogout) {
          await handleLogout();
          return;
        } else if (!result.success) {
          setSheetError(
            "Google認証の期限が切れています。再ログインしてください。",
          );
          return;
        }
      }

      // Check if user already has a Google Sheet
      const settings = await getUserSettings();
      if (settings?.google_sheet_url) {
        addLogEntry(
          "INFO",
          "User already has Google Sheet, checking existence",
          {
            url: settings.google_sheet_url,
          },
        );
        const existsResult = await checkGoogleSheetExists(
          settings.google_sheet_url,
        );
        if (existsResult.exists) {
          addLogEntry("INFO", "Google Sheet exists, skipping creation");
          setSheetError("");
          return;
        } else {
          addLogEntry(
            "WARN",
            "Google Sheet not found, will show creation flow",
            existsResult,
          );
        }
      }

      // Show Google Drive folder picker and create sheet
      try {
        const accessToken = await getGoogleAccessToken();

        // Show folder picker dialog
        const folderResult = await openGoogleDrivePicker(accessToken);

        let folderId = undefined;
        if (folderResult) {
          folderId = folderResult.folderId;
          addLogEntry(
            "INFO",
            "User selected Google Drive folder",
            folderResult,
          );
          toast({
            title: "フォルダ選択完了",
            description: `選択されたフォルダ: ${folderResult.folderName}`,
          });
        } else {
          addLogEntry(
            "INFO",
            "User cancelled folder selection, creating in root",
          );
        }

        // Create the Google Sheet
        const result = await createGoogleSheetWithOAuth(accessToken, folderId);

        if (result.success) {
          addLogEntry(
            "INFO",
            "Google Sheet created successfully on login",
            result,
          );
          setSheetError("");
          toast({
            title: "Google Sheet作成完了",
            description: "SNS投稿管理用のGoogle Sheetが作成されました",
          });
        } else {
          const errorMsg = `Google Sheetの作成に失敗しました: ${result.message}`;
          setSheetError(errorMsg);
          addLogEntry("ERROR", "Google Sheet creation failed on login", result);
          toast({
            title: "Google Sheetエラー",
            description: errorMsg,
            variant: "destructive",
          });
        }
      } catch (error: any) {
        const errorMessage = error?.message || "Unknown error";
        let userFriendlyMessage = "Google Sheetの作成に失敗しました";

        if (errorMessage.includes("access token")) {
          userFriendlyMessage =
            "Google認証の期限が切れています。再ログインしてください。";
        }

        setSheetError(userFriendlyMessage);
        addLogEntry("ERROR", "Error in Google Sheet creation flow", error);
        toast({
          title: "Google Sheetエラー",
          description: userFriendlyMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error in sheet creation flow:", error);
      addLogEntry("ERROR", "Error in sheet creation flow", error);
    }
  };

  const handleCreatePost = async (post: Omit<Post, "id" | "updatedAt">) => {
    try {
      // Don't create a new post here - the PostForm will handle the ID generation
      // and call this function for each platform
      const newPost: Post = {
        ...post,
        id: post.id || Date.now().toString(), // Use provided ID or generate new one
        updatedAt: new Date().toISOString(),
      };

      addLogEntry("INFO", "Creating post", {
        postId: newPost.id,
        platforms: newPost.platforms,
      });

      // Add to Google Sheet with enhanced error handling
      const result = await addPostToGoogleSheet({
        ...newPost,
        platforms: newPost.platforms, // Use platforms directly
      });

      if (result.success) {
        addLogEntry("INFO", "Post created successfully", {
          postId: newPost.id,
        });
        // Don't refresh immediately for each platform - wait for all to complete
      } else {
        const errorMessage = result.error || "Failed to save post";

        // Check if it's a token error and attempt refresh
        if (
          errorMessage.includes("access token") &&
          !tokenRefreshAttempted.current
        ) {
          const result = await refreshGoogleToken(1);
          if (result.shouldLogout) {
            await handleLogout();
            return;
          } else if (result.success) {
            // Retry saving the post
            const retryResult = await addPostToGoogleSheet({
              ...newPost,
              platforms: newPost.platforms,
            });

            if (retryResult.success) {
              addLogEntry("INFO", "Post created successfully after retry", {
                postId: newPost.id,
              });
              return;
            }
          }
        }

        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error("Error saving post:", error);
      addLogEntry("ERROR", "Error creating post", { error, postId: post.id });
      const errorMessage = error?.message || "Unknown error";

      let userFriendlyMessage = "投稿の保存に失敗しました";
      if (errorMessage.includes("access token")) {
        userFriendlyMessage =
          "Google認証の期限が切れています。設定を確認してください。";
      }

      toast({
        title: "投稿保存エラー",
        description: userFriendlyMessage,
        variant: "destructive",
      });
      throw error; // Re-throw to let PostForm handle it
    }
  };

  const handleEditPost = async (post: Post) => {
    try {
      // Update in Google Sheet
      const result = await updatePostInGoogleSheet(post.id, {
        content: post.content,
        scheduleTime: post.scheduleTime,
        status: post.status,
        imageIds: post.imageIds,
      });

      if (result.success) {
        // Refresh posts from Google Sheet
        await fetchPosts();
        toast({
          title: "投稿更新完了",
          description: "投稿が正常に更新されました",
        });
      } else {
        throw new Error(result.error || "Failed to update post");
      }
    } catch (error: any) {
      console.error("Error updating post:", error);
      const errorMessage = error?.message || "Unknown error";

      let userFriendlyMessage = "投稿の更新に失敗しました";
      if (errorMessage.includes("access token")) {
        userFriendlyMessage =
          "Google認証の期限が切れています。設定を確認してください。";
      }

      toast({
        title: "投稿更新エラー",
        description: userFriendlyMessage,
        variant: "destructive",
      });
      // Update local state as fallback
      setPosts(posts.map((p) => (p.id === post.id ? post : p)));
    }

    setIsEditDialogOpen(false);
    setCurrentPost(null);
  };

  const handleDeletePost = async (id: string) => {
    try {
      // Soft delete in Google Sheet
      const result = await deletePostInGoogleSheet(id);

      if (result.success) {
        // Refresh posts from Google Sheet
        await fetchPosts();
        toast({
          title: "投稿削除完了",
          description: "投稿が削除されました",
        });
      } else {
        throw new Error(result.error || "Failed to delete post");
      }
    } catch (error: any) {
      console.error("Error deleting post:", error);
      const errorMessage = error?.message || "Unknown error";

      let userFriendlyMessage = "投稿の削除に失敗しました";
      if (errorMessage.includes("access token")) {
        userFriendlyMessage =
          "Google認証の期限が切れています。設定を確認してください。";
      }

      toast({
        title: "投稿削除エラー",
        description: userFriendlyMessage,
        variant: "destructive",
      });
      // Remove from local state as fallback
      setPosts(posts.filter((post) => post.id !== id));
    }
  };

  const handleEditClick = async (postId: string) => {
    // 投稿IDからベースIDを抽出
    // 例: "1756238641981_x" -> "1756238641981"
    const baseId = postId.includes("_") ? postId.split("_")[0] : postId;

    addLogEntry("INFO", "Starting edit click handler", {
      postId,
      baseId,
      allPosts: posts.map((p) => ({ id: p.id, platforms: p.platforms })),
    });

    try {
      // Google Sheetから直接プラットフォーム別のデータを取得
      const settings = await getUserSettings();
      if (!settings?.google_sheet_id) {
        throw new Error("Google Sheet not configured");
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
        throw new Error("Failed to fetch sheet data");
      }

      const data = await response.json();
      const rows = data.values || [];

      // ベースIDに一致するすべての行を取得
      const matchingRows = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const fullId = row[0] || "";
        const isDeleted = row[8] === "TRUE";

        if (isDeleted) continue;

        const currentBaseId = fullId.includes("_")
          ? fullId.split("_")[0]
          : fullId;
        if (currentBaseId === baseId) {
          matchingRows.push({
            id: fullId,
            content: row[1] || "",
            platform: row[2] || "",
            scheduleTime: row[3] || "",
            status: row[4] || "pending",
            imageUrl: row[5] || "",
          });
        }
      }

      if (matchingRows.length === 0) {
        addLogEntry("WARN", "No posts found for editing", {
          baseId,
          postId,
        });
        toast({
          title: "エラー",
          description: "編集する投稿が見つかりませんでした。",
          variant: "destructive",
        });
        return;
      }

      // プラットフォーム別のデータ構造を作成
      const platformData: Record<string, any> = {};
      const allPlatforms = [
        "x",
        "instagram",
        "facebook",
        "line",
        "discord",
        "wordpress",
      ];
      const allImageUrls: string[] = [];

      // 各プラットフォームのデータを初期化
      allPlatforms.forEach((platform) => {
        platformData[platform] = {
          content: "",
          hasImageUrl: false,
          imageUrls: [],
          imageUrlLength: 0,
        };
      });

      // マッチした行からプラットフォーム別データを構築
      matchingRows.forEach((row) => {
        if (row.platform && platformData[row.platform]) {
          platformData[row.platform] = {
            content: row.content,
            hasImageUrl: !!row.imageUrl,
            imageUrls: row.imageUrl
              ? row.imageUrl.split(",").filter((url) => url.trim())
              : [],
            imageUrlLength: row.imageUrl ? row.imageUrl.length : 0,
          };

          // 全体の画像URLリストに追加
          if (row.imageUrl) {
            const urls = row.imageUrl.split(",").filter((url) => url.trim());
            allImageUrls.push(...urls);
          }
        }
      });

      // 重複を除去
      const uniqueImageUrls = [...new Set(allImageUrls)];

      const scheduleTimeData: Record<string, string> = {};
      matchingRows.forEach((row) => {
        if (row.platform) {
          const platformScheduleKey = `${baseId}_${row.platform.toLowerCase()}`;
          scheduleTimeData[platformScheduleKey] = row.scheduleTime;
        }
      });

      const editData = {
        id: baseId,
        platforms: platformData,
        scheduleTime: matchingRows[0]?.scheduleTime || "",
        status: matchingRows[0]?.status || "pending",
        imageUrls: uniqueImageUrls,
        isScheduled: !!matchingRows[0]?.scheduleTime,
        scheduleTimeData: scheduleTimeData,
      };

      addLogEntry("INFO", "Setting platform-specific edit data for PostForm", {
        baseId,
        editDataCount: 1,
        editData: [
          {
            id: baseId,
            platforms: Object.keys(platformData).reduce(
              (acc, platform) => {
                acc[platform] = {
                  content:
                    platformData[platform].content.substring(0, 50) + "...",
                  hasImageUrl: platformData[platform].hasImageUrl,
                  imageUrls: platformData[platform].imageUrls,
                  imageUrlLength: platformData[platform].imageUrlLength,
                };
                return acc;
              },
              {} as Record<string, any>,
            ),
          },
        ],
        totalImageUrls: uniqueImageUrls.length,
      });

      setCurrentPost(editData);
      setIsEditDialogOpen(true);
    } catch (error) {
      console.error("Error fetching platform-specific data:", error);
      addLogEntry("ERROR", "Error fetching platform-specific data", error);
      toast({
        title: "エラー",
        description: "投稿データの取得に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const handleRefresh = async () => {
    tokenRefreshAttempted.current = false; // Reset retry flags
    fetchRetryAttempted.current = false;
    await fetchPosts();
  };

  const handleLogout = async () => {
    try {
      // Check if it's a test user
      const testUser = localStorage.getItem("testUser");
      if (testUser) {
        localStorage.removeItem("testUser");
        navigate("/login");
        return;
      }

      await supabase.auth.signOut();
      navigate("/login");
    } catch (error) {
      toast({
        title: "ログアウトエラー",
        description: "ログアウトに失敗しました",
        variant: "destructive",
      });
    }
  };

  const handleUserSettings = () => {
    navigate("/create-sheet");
  };

  const handleShowLogs = () => {
    const currentLogs = getApplicationLogs();
    setLogs(currentLogs);
    setIsLogsDialogOpen(true);
  };

  const handleClearLogs = () => {
    clearLogs();
    setLogs([]);
    toast({
      title: "ログクリア",
      description: "ログが削除されました",
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate("/dashboard")}
            variant="outline"
            className="flex items-center gap-2"
          >
            ダッシュボード
          </Button>
          <img
            src="/logo.jpg"
            alt="YLPM Logo"
            className="w-12 h-12 rounded-lg object-cover"
          />
          <div>
            <h1 className="text-3xl font-bold">投稿作成・管理</h1>
            <p className="text-muted-foreground">SNS投稿作成＆管理システム</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-[#62a891]"
          >
            <PlusIcon size={16} className=" w-[30px] h-[30px]" />
            新規投稿作成
          </Button>
          <Button
            onClick={handleShowLogs}
            variant="outline"
            className="flex items-center gap-2"
          >
            <FileText size={16} />
            ログ確認
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="cursor-pointer hover:opacity-80">
                <AvatarImage
                  src={
                    user?.user_metadata?.avatar_url ||
                    "https://api.dicebear.com/7.x/avataaars/svg?seed=user123"
                  }
                  alt="User"
                />
                <AvatarFallback>ユ</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                AI設定
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/create-sheet")}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Google Sheets 作成・管理
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                ログアウト
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {sheetError && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-800 flex-1">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                <p className="font-medium">{sheetError}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUserSettings}
                  className="text-red-700 border-red-300 hover:bg-red-100"
                >
                  設定を確認
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  className="text-red-700 border-red-300 hover:bg-red-100"
                >
                  再試行
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSheetError("")}
                  className="text-red-700 hover:bg-red-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>投稿一覧</CardTitle>
          <div className="flex flex-col items-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCcwIcon
                size={16}
                className={isLoading ? "animate-spin" : ""}
              />
              更新
            </Button>
            {lastRefreshTime && (
              <div className="text-xs text-muted-foreground">
                最終更新: {lastRefreshTime}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <PostTable
            posts={posts}
            onEdit={(postId) => handleEditClick(postId)}
            onDelete={handleDeletePost}
          />
        </CardContent>
      </Card>
      {/* Create Post Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新規投稿作成</DialogTitle>
          </DialogHeader>
          <PostForm
            onSubmit={async (postData) => {
              await handleCreatePost(postData);
              // Refresh posts after all platforms are processed
              setTimeout(() => {
                fetchPosts();
                setIsCreateDialogOpen(false);
              }, 1000);
            }}
            onCancel={() => setIsCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
      {/* Edit Post Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>投稿編集</DialogTitle>
          </DialogHeader>
          {currentPost && (
            <PostForm
              post={Array.isArray(currentPost) ? currentPost : [currentPost]}
              isEditing={true}
              onSubmit={handleEditPost}
              onCancel={() => {
                setIsEditDialogOpen(false);
                setCurrentPost(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      {/* Logs Dialog */}
      <Dialog open={isLogsDialogOpen} onOpenChange={setIsLogsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>アプリケーションログ</span>
              <Button
                onClick={handleClearLogs}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Trash2 size={16} />
                ログクリア
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                ログがありません
              </p>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-md border text-sm ${
                    log.type === "ERROR"
                      ? "bg-red-50 border-red-200"
                      : log.type === "INFO"
                        ? "bg-blue-50 border-blue-200"
                        : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Badge
                      variant={log.type === "ERROR" ? "destructive" : "outline"}
                    >
                      {log.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="font-medium">{log.message}</p>
                  {log.data && (
                    <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-x-auto">
                      {log.data}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Home;
