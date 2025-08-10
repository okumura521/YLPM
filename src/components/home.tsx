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
} from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

import { handleGoogleSheetCreationFlow } from "@/lib/supabase";

interface Post {
  id: string;
  content: string;
  scheduleTime: string;
  platforms: string[];
  channels?: string[];
  status: "pending" | "sent" | "failed";
  updatedAt: string;
  imageUrl?: string;
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

  // Refresh Google token
  const refreshGoogleToken = async (): Promise<boolean> => {
    if (tokenRefreshAttempted.current) {
      addLogEntry("INFO", "Token refresh already attempted, skipping");
      return false;
    }

    try {
      tokenRefreshAttempted.current = true;
      addLogEntry("INFO", "Attempting to refresh Google token");

      const refreshed = await refreshGoogleAccessToken();
      if (refreshed) {
        addLogEntry("INFO", "Google token refreshed successfully");
        setSheetError(""); // Clear any existing errors
        return true;
      } else {
        addLogEntry("ERROR", "Failed to refresh Google token");
        return false;
      }
    } catch (error) {
      addLogEntry("ERROR", "Error refreshing Google token", error);
      return false;
    }
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
        return;
      }

      const postsFromSheet = await fetchPostsFromGoogleSheet();
      setPosts(postsFromSheet);
      setSheetError(""); // Clear any existing errors
      fetchRetryAttempted.current = false; // Reset retry flag on success
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

        const refreshed = await refreshGoogleToken();
        if (refreshed) {
          // Retry fetching posts
          setTimeout(() => fetchPosts(false), 1000);
          return;
        }
      }

      // Set user-friendly error message
      if (errorMessage.includes("access token")) {
        setSheetError(
          "Google認証の期限が切れています。再ログインまたは設定の確認をお願いします。",
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
    fetchPosts();

    // Check initial authentication state
    const checkInitialAuth = async () => {
      try {
        // Check for test user first
        const testUser = localStorage.getItem("testUser");
        if (testUser) {
          setUser(JSON.parse(testUser));
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          navigate("/login", { replace: true });
        } else {
          setUser(user);
          // Handle sheet creation for Google OAuth users only once
          if (
            !sheetCreationHandled.current &&
            user.app_metadata?.provider === "google"
          ) {
            sheetCreationHandled.current = true;
            await handleSheetCreationOnLogin();
          }
        }
      } catch (error) {
        console.error("Authentication check failed:", error);
        addLogEntry("ERROR", "Authentication check failed", error);
        navigate("/login", { replace: true });
      }
    };

    checkInitialAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        // Clear test user session
        localStorage.removeItem("testUser");
        sheetCreationHandled.current = false;
        tokenRefreshAttempted.current = false;
        fetchRetryAttempted.current = false;
        navigate("/login", { replace: true });
      } else if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user);
        // Handle sheet creation for Google OAuth users only once
        if (
          !sheetCreationHandled.current &&
          session.user.app_metadata?.provider === "google"
        ) {
          sheetCreationHandled.current = true;
          await handleSheetCreationOnLogin();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Periodic token check (every 5 minutes)
  useEffect(() => {
    const interval = setInterval(
      async () => {
        if (
          user?.app_metadata?.provider === "google" &&
          !localStorage.getItem("testUser")
        ) {
          const isValid = await checkGoogleTokenValidityLocal();
          if (!isValid && !tokenRefreshAttempted.current) {
            const refreshed = await refreshGoogleToken();
            if (!refreshed) {
              setSheetError(
                "Google認証の期限が切れています。再ログインしてください。",
              );
            }
          }
        }
      },
      5 * 60 * 1000,
    ); // 5 minutes

    return () => clearInterval(interval);
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
        const refreshed = await refreshGoogleToken();
        if (!refreshed) {
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
          const refreshed = await refreshGoogleToken();
          if (refreshed) {
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

  const handleEditClick = (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (post) {
      addLogEntry("INFO", "Opening post for editing", { postId, post });

      // Convert the post data to match PostForm expectations
      const postForEdit = {
        ...post,
        platforms: post.platforms || [],
        channels: post.platforms || [],
        scheduleTime: post.scheduleTime
          ? new Date(post.scheduleTime)
          : undefined,
        isScheduled: !!post.scheduleTime,
        // Add image data if available
        images: [], // Will be populated from imageUrl if available
        imageUrl: post.imageUrl || "",
      };

      // If there are image URLs, we should note them for the user
      if (post.imageUrl) {
        addLogEntry("INFO", "Post has associated images", {
          postId,
          imageUrl: post.imageUrl,
        });
      }

      setCurrentPost(postForEdit);
      setIsEditDialogOpen(true);
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
    navigate("/settings");
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
          <img
            src="https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=48&h=48&fit=crop&crop=center"
            alt="YLPM Logo"
            className="w-12 h-12 rounded-lg"
          />
          <div>
            <h1 className="text-3xl font-bold">Yell-lab-PostMate</h1>
            <p className="text-muted-foreground">SNS投稿作成＆管理システム</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <PlusIcon size={16} />
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
              <DropdownMenuItem onClick={handleUserSettings}>
                <Settings className="mr-2 h-4 w-4" />
                ユーザー設定
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
              <div className="flex items-center gap-2 text-red-800">
                <AlertTriangle className="h-5 w-5" />
                <p className="font-medium">{sheetError}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUserSettings}
                className="text-red-700 border-red-300 hover:bg-red-100"
              >
                設定を確認
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>投稿一覧</CardTitle>
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
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Badge variant="outline" className="bg-muted">
              全て
            </Badge>
            <Badge variant="outline">
              予定: {posts.filter((post) => post.status === "pending").length}
            </Badge>
            <Badge variant="outline" className="bg-green-100">
              送信済: {posts.filter((post) => post.status === "sent").length}
            </Badge>
            <Badge variant="outline" className="bg-red-100">
              失敗: {posts.filter((post) => post.status === "failed").length}
            </Badge>
          </div>
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
              initialData={currentPost}
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
