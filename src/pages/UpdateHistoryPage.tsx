import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, LogOut } from "lucide-react";

export default function UpdateHistoryPage() {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
      } else {
        setUser(user);
      }
    };
    getUser();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (!user) {
    return (
      <div className="min-h-screen ylpm-animated-bg flex items-center justify-center">
        <div className="ylpm-glass-card p-8 ylpm-bounce-in">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00BCD4]"></div>
            <div className="text-lg font-medium">読み込み中...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ylpm-animated-bg">
      {/* Header */}
      <header className="ylpm-glass-card shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img
                src="/YLPM.png"
                alt="YLPM Logo"
                className="w-10 h-10 rounded-lg object-cover ylpm-float"
              />
              <div>
                <h1 className="text-xl font-semibold ylpm-section-header">
                  Yell-lab-PostMate{" "}
                  <span className="text-sm text-muted-foreground">Ver.0.4</span>
                </h1>
                <p className="text-sm text-muted-foreground">
                  更新履歴
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => navigate("/")}>
                ホーム
              </Button>
              <span className="text-sm text-muted-foreground">
                {user.email}
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                ログアウト
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => navigate("/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            ダッシュボードに戻る
          </Button>
        </div>

        <Card className="ylpm-glass-card ylpm-slide-in-up">
          <CardHeader>
            <CardTitle className="ylpm-section-header">更新履歴</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* この下に更新履歴を追加してください */}
              <div className="border-l-4 border-blue-500 pl-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">エールラボえひめ内公開</h4>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    Ver.0.5
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  2025年11月
                </p>
                <ul className="text-sm space-y-1">
                  <li>•進捗インジゲータ追加 </li>
                  <li>• プライバシーポリシー、利用規約追加</li>
                  <li>• Webhook即時送信機能送信</li>
                </ul>
              </div>
              <div className="border-l-4 border-blue-500 pl-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">開発中</h4>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    Ver.0.4
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  2025年10月
                </p>
                <ul className="text-sm space-y-1">
                  <li>• google Acsess token 自動リフレッシュ処理</li>
                </ul>
              </div>
              <div className="border-l-4 border-blue-500 pl-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">開発中</h4>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    Ver.0.3
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  2025年9月
                </p>
                <ul className="text-sm space-y-1">
                  <li>• PF事の画像割り当て処理修正</li>
                  <li>• 送信中ステータス追加</li>
                  <li>• 投稿一覧表示更新</li>
                </ul>
              </div>
              <div className="border-l-4 border-blue-500 pl-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">開発中</h4>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    Ver.0.2
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  2025年8月
                </p>
                <ul className="text-sm space-y-1">
                  <li>• AI複数サービス登録機能追加</li>
                  <li>
                    • インスタグラム投稿画像用Dropbox Folder連携機能追加
                  </li>
                </ul>
              </div>
              <div className="border-l-4 border-blue-500 pl-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">開発中</h4>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    Ver.0.1
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  2025年8月
                </p>
                <ul className="text-sm space-y-1">
                  <li>• 画像UPload機能修正</li>
                  <li>• 新規登録・編集ページ修正</li>
                </ul>
              </div>
              {/* 更新履歴フォーマット*/}
              <div className="border-l-4 border-blue-500 pl-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">開発中</h4>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    Ver.0
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  2025年8月
                </p>
                <ul className="text-sm space-y-1">
                  <li>• SNS投稿作成・管理機能</li>
                  <li>• Google Sheets連携</li>
                  <li>• AI生成機能</li>
                  <li>• 複数プラットフォーム対応</li>
                  <li>• スケジュール投稿機能</li>
                </ul>
              </div>
              {/* 更新履歴ここまで */}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
