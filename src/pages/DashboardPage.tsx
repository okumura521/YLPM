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
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Settings, FileSpreadsheet, PlusCircle, LogOut, History } from "lucide-react";
import { OnboardingGuide } from "@/components/OnboardingGuide";
import { HelpButton } from "@/components/ui/HelpButton";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;

    const getUser = async () => {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (!user) {
          navigate("/login");
        } else {
          setUser(user);
        }
      } catch (error) {
        console.error("Error getting user:", error);
        if (isMounted) {
          toast({
            title: "エラー",
            description: "ユーザー情報の取得に失敗しました",
            variant: "destructive",
          });
          navigate("/login");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    getUser();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 初回マウント時のみ実行

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

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          <div>読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Onboarding Guide */}
      <OnboardingGuide />

      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img
                src="/YLPM.png"
                alt="YLPM Logo"
                className="w-10 h-10 rounded-lg object-cover"
              />
              <div>
                <h1 className="text-xl font-semibold">
                  Yell-lab-PostMate{" "}
                  <span className="text-sm text-muted-foreground">Ver.0.4</span>
                </h1>
                <p className="text-sm text-muted-foreground">
                  SNS投稿管理システム
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => navigate("/")}>
                ホーム
              </Button>
              <HelpButton
                pageTitle="ダッシュボード"
                sections={[
                  {
                    title: 'ユーザー設定',
                    content: 'AIサービスの設定とWebhook URLを設定できます。AI機能を使用する場合は、ここでAPIキーを設定してください。',
                  },
                  {
                    title: 'Google Sheets作成・管理',
                    content: '投稿データを保存するGoogle Sheetを作成します。初回利用時に必ず作成してください。',
                  },
                  {
                    title: '投稿作成・管理',
                    content: 'SNS投稿を作成・編集・削除できます。複数のプラットフォームに一括投稿が可能です。',
                  },
                ]}
              />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* User Settings */}
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate("/settings")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                ユーザー設定
              </CardTitle>
              <CardDescription>ユーザ関連の設定</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                AI API の設定を行います。
              </p>
            </CardContent>
          </Card>

          {/* Google Sheets Creation */}
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate("/create-sheet")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Google Sheets,Dropbox Folder 作成・管理
              </CardTitle>
              <CardDescription>投稿管理シートの作成・管理</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                SNS投稿管理用のGoogle Sheet,Dropbox Folderを新規作成します。
              </p>
            </CardContent>
          </Card>

          {/* Post Creation */}
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate("/")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle className="h-5 w-5" />
                投稿作成・管理
              </CardTitle>
              <CardDescription>新しいSNS投稿を作成</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                複数のSNSプラットフォームへの投稿を作成・スケジュール設定します。
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Welcome Message */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>ようこそ、YLPM へ</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                SNS投稿管理システムへようこそ。まずはGoogle Sheet・Google Drive
                Folderの作成から初めてください。
                <br />
                AI設定は、ユーザ設定ページで行います。
                <br />
                Instagramへ投稿する場合はDropbox Folderの作成が必要です。
                <br />
              </p>
              {/* YLPM Support Status */}

              {/* Usage Restrictions */}
              <div className="mt-6 p-6 bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-200 rounded-lg">
                <h3 className="text-xl font-bold mb-4 text-orange-800">
                  利用制限事項
                </h3>
                <div className="space-y-3">
                  <div className="p-3 bg-white rounded border border-orange-200">
                    <p className="font-medium text-orange-800">
                      送信できる画像の枚数
                    </p>
                    <p className="text-sm text-gray-700">
                      最大6枚まで（※Xのみ4枚まで）
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded border border-orange-200">
                    <p className="font-medium text-orange-800">WordPress</p>
                    <p className="text-sm text-gray-700">
                      Makeのシナリオに未実装なので使えません。
                    </p>
                  </div>
                </div>
              </div>
              {/* Update History Link */}
              <div className="mt-6">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => navigate("/update-history")}
                >
                  <History className="h-5 w-5" />
                  更新履歴を見る
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
