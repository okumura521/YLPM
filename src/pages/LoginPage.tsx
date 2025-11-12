import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
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

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          scopes:
            "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
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
    <div className="min-h-screen ylpm-animated-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-md ylpm-glass-card ylpm-bounce-in">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <img
              src="/YLPM.png"
              alt="YLPM Logo"
              className="w-16 h-16 rounded-lg ylpm-float"
            />
          </div>
          <div className="text-2xl font-bold ylpm-section-header">YLPM</div>
          <CardDescription>SNS投稿管理システムにログイン</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full ylpm-btn-gradient ylpm-glow"
            size="lg"
          >
            {loading ? "ログイン中..." : "Googleでログイン"}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Googleアカウントでログインして、SNS投稿を一元管理しましょう
          </p>
        </CardContent>
              <div className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/privacy-policy" className="hover:underline">
          プライバシーポリシー
        </Link>
        {" | "}
        <Link to="/terms-of-service" className="hover:underline">
          利用規約
        </Link>
      </div>
      </Card>

    </div>
  );
}
