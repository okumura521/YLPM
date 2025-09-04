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
import { Settings, FileSpreadsheet, PlusCircle, LogOut } from "lucide-react";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

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

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img
                src="/logo.jpg"
                alt="YLPM Logo"
                className="w-10 h-10 rounded-lg object-cover"
              />
              <div>
                <h1 className="text-xl font-semibold">
                  Yell-lab-PostMate{" "}
                  <span className="text-sm text-muted-foreground">Ver.0</span>
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
                Google Sheets 作成・管理
              </CardTitle>
              <CardDescription>投稿管理シートの作成・管理</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                SNS投稿管理用のGoogle Sheetを新規作成します。
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
                Folderの作成から初めてください。AI設定は、ユーザ設定ページで行います。（AI設定は任意です。）
                設定完了後、投稿管理を開始できます。
              </p>

              {/* YLPM Support Status */}
              <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg">
                <h3 className="text-xl font-bold mb-4 text-blue-800">
                  YLPM対応状況
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-white rounded border">
                      <span className="font-medium">X (Twitter)</span>
                      <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        make側の送信処理開発中
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-white rounded border">
                      <span className="font-medium">Instagram</span>
                      <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        make側の送信処理開発中
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-white rounded border">
                      <span className="font-medium">Facebook</span>
                      <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                        利用可能
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-white rounded border">
                      <span className="font-medium">LINE</span>
                      <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                        利用可能
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-white rounded border">
                      <span className="font-medium">Discord</span>
                      <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                        利用可能
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-white rounded border">
                      <span className="font-medium">WordPress</span>
                      <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        make側の送信処理開発中
                      </span>
                    </div>
                  </div>
                </div>
              </div>

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
                    <p className="font-medium text-orange-800">
                      画像設定について
                    </p>
                    <p className="text-sm text-gray-700">
                      画像は最低1枚は設定してください。※画像0だと送信エラーになります
                    </p>
                  </div>
                </div>
              </div>

              {/* Update History Section */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">更新履歴</h3>
                <div className="space-y-4">
                  <div className="border-l-4 border-blue-500 pl-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">更新</h4>
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
                  <div className="border-l-4 border-blue-500 pl-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">初版リリース</h4>
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
                  {/* 更新履歴は手動で更新されます。新しいバージョンの情報をここにコピー＆ペーストしてください。 */}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
