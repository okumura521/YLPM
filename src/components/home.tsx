import React, { useState, useEffect } from "react";
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
} from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

import { handleGoogleSheetCreationFlow } from "@/lib/supabase";

interface Post {
  id: string;
  content: string;
  scheduleTime: string;
  channels: string[];
  status: "pending" | "sent" | "failed";
  updatedAt: string;
}

const Home = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([
    {
      id: "1",
      content:
        "エールラボえひめの新しいイベントが開催されます！詳細はプロフィールリンクから確認してください。",
      scheduleTime: "2023-06-15T10:00:00",
      channels: ["X", "Facebook", "Instagram"],
      status: "sent",
      updatedAt: "2023-06-15T10:01:23",
    },
    {
      id: "2",
      content:
        "今週末のワークショップの参加者募集中です。興味のある方はDMでご連絡ください！",
      scheduleTime: "2023-06-16T15:30:00",
      channels: ["X", "LINE", "Discord"],
      status: "pending",
      updatedAt: "2023-06-14T09:45:12",
    },
    {
      id: "3",
      content: "先日のセミナーの様子をブログにまとめました。ぜひご覧ください。",
      scheduleTime: "2023-06-14T18:00:00",
      channels: ["WordPress", "Facebook"],
      status: "failed",
      updatedAt: "2023-06-14T18:01:05",
    },
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentPost, setCurrentPost] = useState<Post | null>(null);
  const [isLogsDialogOpen, setIsLogsDialogOpen] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [sheetError, setSheetError] = useState<string>("");

  // Simulate fetching posts from Google Sheets
  const fetchPosts = () => {
    setIsLoading(true);
    // In a real implementation, this would be an API call to fetch data from Google Sheets
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  useEffect(() => {
    fetchPosts();

    // Check authentication status with retry logic
    const getUser = async () => {
      try {
        // Check for test user first
        const testUser = localStorage.getItem("testUser");
        if (testUser) {
          setUser(JSON.parse(testUser));
          // Check Google Sheet existence for test user too
          await checkSheetExistence();
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          // Wait a bit and try again in case the session is still being established
          setTimeout(async () => {
            const {
              data: { user: retryUser },
            } = await supabase.auth.getUser();
            if (!retryUser) {
              navigate("/login", { replace: true });
            } else {
              setUser(retryUser);
              await handleSheetCreationOnLogin();
            }
          }, 500);
        } else {
          setUser(user);
          await handleSheetCreationOnLogin();
        }
      } catch (error) {
        console.error("Authentication check failed:", error);
        addLogEntry("ERROR", "Authentication check failed", error);
        navigate("/login", { replace: true });
      }
    };
    getUser();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        // Clear test user session
        localStorage.removeItem("testUser");
        navigate("/login", { replace: true });
      } else if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Handle Google Sheet creation flow on login
  const handleSheetCreationOnLogin = async () => {
    try {
      // Only run this for Google OAuth users, not test users
      const testUser = localStorage.getItem("testUser");
      if (testUser) {
        return;
      }

      addLogEntry("INFO", "Starting Google Sheet creation flow on login");

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
      } catch (error) {
        const errorMsg = `Google Sheetの作成に失敗しました: ${error instanceof Error ? error.message : "Unknown error"}`;
        setSheetError(errorMsg);
        addLogEntry("ERROR", "Error in Google Sheet creation flow", error);
        toast({
          title: "Google Sheetエラー",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error in sheet creation flow:", error);
      addLogEntry("ERROR", "Error in sheet creation flow", error);
    }
  };

  const handleCreatePost = (post: Omit<Post, "id" | "updatedAt">) => {
    const newPost: Post = {
      ...post,
      id: Date.now().toString(),
      updatedAt: new Date().toISOString(),
    };
    setPosts([newPost, ...posts]);
    setIsCreateDialogOpen(false);
  };

  const handleEditPost = (post: Post) => {
    setPosts(posts.map((p) => (p.id === post.id ? post : p)));
    setIsEditDialogOpen(false);
    setCurrentPost(null);
  };

  const handleDeletePost = (id: string) => {
    setPosts(posts.filter((post) => post.id !== id));
  };

  const handleEditClick = (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (post) {
      // Convert the post data to match PostForm expectations
      const postForEdit = {
        ...post,
        platforms: post.channels || [],
        scheduleTime: post.scheduleTime
          ? new Date(post.scheduleTime)
          : undefined,
        isScheduled: !!post.scheduleTime,
      };
      setCurrentPost(postForEdit);
      setIsEditDialogOpen(true);
    }
  };

  const handleRefresh = () => {
    fetchPosts();
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
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              <p className="font-medium">{sheetError}</p>
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
            onSubmit={handleCreatePost}
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
              onCancel={() => setIsEditDialogOpen(false)}
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
