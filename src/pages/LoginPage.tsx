import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      // Check for test user first
      const testUser = localStorage.getItem("testUser");
      if (testUser) {
        navigate("/", { replace: true });
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        navigate("/dashboard", { replace: true });
      }
    };
    checkUser();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        // Wait a bit to ensure the session is fully established
        setTimeout(() => {
          navigate("/dashboard", { replace: true });
        }, 100);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleEmailLogin = async () => {
    if (!email || !password) {
      toast({
        title: "入力エラー",
        description: "メールアドレスとパスワードを入力してください",
        variant: "destructive",
      });
      return;
    }

    // Test user login
    if (email === "admin" && password === "ylpm") {
      try {
        setLoading(true);
        // Store test user session in localStorage
        localStorage.setItem(
          "testUser",
          JSON.stringify({
            id: "test-user-id",
            email: "admin@ylpm.test",
            user_metadata: {
              full_name: "Test User",
              avatar_url:
                "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
            },
            created_at: new Date().toISOString(),
          }),
        );

        toast({
          title: "ログイン成功",
          description: "テストユーザーでログインしました",
        });

        // Navigate to dashboard page
        navigate("/dashboard", { replace: true });
        return;
      } catch (error) {
        toast({
          title: "ログインエラー",
          description: "予期しないエラーが発生しました",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "ログインエラー",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "ログインエラー",
        description: "予期しないエラーが発生しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          scopes:
            "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets",
        },
      });

      if (error) {
        toast({
          title: "ログインエラー",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "ログインエラー",
        description: "予期しないエラーが発生しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <img
              src="/logo.jpg"
              alt="YLPM Logo"
              className="w-16 h-16 rounded-lg"
            />
          </div>
          <CardTitle className="text-2xl font-bold">YLPM</CardTitle>
          <CardDescription>SNS投稿管理システムにログイン</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">ID・パスワード</TabsTrigger>
              <TabsTrigger value="google">Google</TabsTrigger>
            </TabsList>
            <TabsContent value="email" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="メールアドレスを入力"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">パスワード</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="パスワードを入力"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button
                onClick={handleEmailLogin}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? "ログイン中..." : "ログイン"}
              </Button>
            </TabsContent>
            <TabsContent value="google" className="space-y-4 mt-4">
              <Button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? "ログイン中..." : "Googleでログイン"}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Googleアカウントでログインして、SNS投稿を一元管理しましょう
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
