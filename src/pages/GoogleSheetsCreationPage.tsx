import { useState, useEffect } from "react";
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
import { useToast } from "@/components/ui/use-toast";
import { Loader2, CheckCircle, XCircle, FileSpreadsheet } from "lucide-react";
import { getUserSettings, createGoogleSheet } from "@/lib/supabase";

export default function GoogleSheetsCreationPage() {
  const [loading, setLoading] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [directoryId, setDirectoryId] = useState("");
  const [createdSheetUrl, setCreatedSheetUrl] = useState("");
  const { toast } = useToast();

  // Check Google connection status
  useEffect(() => {
    const checkGoogleConnection = async () => {
      try {
        const settings = await getUserSettings();
        setGoogleConnected(settings?.google_connection_status || false);
      } catch (error) {
        console.error("Failed to check Google connection:", error);
        setGoogleConnected(false);
      }
    };
    checkGoogleConnection();
  }, []);

  const handleCreateSheet = async () => {
    if (!googleConnected) {
      toast({
        title: "接続エラー",
        description: "Google連携設定を完了してください",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await createGoogleSheet(directoryId || undefined);

      if (result.success) {
        setCreatedSheetUrl(result.sheetUrl || "");
        toast({
          title: "作成完了",
          description: result.message,
        });
      } else {
        toast({
          title: "作成エラー",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "作成エラー",
        description: "Google Sheetの作成に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Google Sheets 新規作成</h1>
          <p className="text-muted-foreground mt-2">
            SNS投稿管理用のGoogle Sheetを作成します
          </p>
        </div>

        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Google連携ステータス
              {googleConnected ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {googleConnected ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Google連携が完了しています</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-4 w-4" />
                  <span>Google連携が完了していません</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  ユーザー設定画面でGoogle連携設定を完了してください。
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sheet Creation Form */}
        <Card>
          <CardHeader>
            <CardTitle>新規シート作成</CardTitle>
            <CardDescription>
              Google
              Driveのディレクトリを指定して、SNS投稿管理用のシートを作成します
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="directory-id">
                Google Drive ディレクトリID（オプション）
              </Label>
              <Input
                id="directory-id"
                value={directoryId}
                onChange={(e) => setDirectoryId(e.target.value)}
                placeholder="ディレクトリIDを入力（空白の場合はルートに作成）"
              />
              <p className="text-xs text-muted-foreground">
                Google
                DriveのURLから取得できるディレクトリIDを入力してください。
                空白の場合は、マイドライブのルートに作成されます。
              </p>
            </div>

            <Button
              onClick={handleCreateSheet}
              disabled={loading || !googleConnected}
              className="w-full"
              size="lg"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Google Sheet を作成
            </Button>
          </CardContent>
        </Card>

        {/* Created Sheet Info */}
        {createdSheetUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="text-green-600">作成完了</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>Google Sheetが正常に作成されました。</p>
              <div className="space-y-2">
                <Label>作成されたシートのURL:</Label>
                <div className="flex gap-2">
                  <Input value={createdSheetUrl} readOnly />
                  <Button
                    variant="outline"
                    onClick={() => window.open(createdSheetUrl, "_blank")}
                  >
                    開く
                  </Button>
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">作成されたシートの構成:</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• 投稿ID</li>
                  <li>• 投稿内容</li>
                  <li>• 送信先プラットフォーム</li>
                  <li>• スケジュール日時</li>
                  <li>• ステータス（pending/sent/failed）</li>
                  <li>• 作成日時</li>
                  <li>• 更新日時</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
