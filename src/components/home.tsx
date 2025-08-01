import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlusIcon, RefreshCcwIcon, Settings, LogOut } from "lucide-react";
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
import PostForm from "./PostForm";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

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
            }
          }, 500);
        } else {
          setUser(user);
        }
      } catch (error) {
        console.error("Authentication check failed:", error);
        navigate("/login", { replace: true });
      }
    };
    getUser();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        navigate("/login", { replace: true });
      } else if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

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

  const handleEditClick = (post: Post) => {
    setCurrentPost(post);
    setIsEditDialogOpen(true);
  };

  const handleRefresh = () => {
    fetchPosts();
  };

  const handleLogout = async () => {
    try {
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

  return (
    <div className="min-h-screen bg-background p-6">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Yell-lab-PostMate</h1>
          <p className="text-muted-foreground">SNS投稿作成＆管理システム</p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <PlusIcon size={16} />
            新規投稿作成
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
            onEdit={handleEditClick}
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
              post={currentPost}
              onSubmit={handleEditPost}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Home;
