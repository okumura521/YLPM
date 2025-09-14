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
import { Loader2, CheckCircle, XCircle, Sheet } from "lucide-react";
import {
  getUserSettings,
  getGoogleAccessToken,
  createGoogleSheetWithOAuth,
  openGoogleDrivePicker,
  createGoogleDriveImageFolder,
  checkDropboxConnection,
} from "@/lib/supabase";
import DropboxConnectionForm from "@/components/DropboxConnectionForm";

export default function GoogleSheetsCreationPage() {
  const [loading, setLoading] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [dropboxConnected, setDropboxConnected] = useState(false);
  const [directoryId, setDirectoryId] = useState("");
  const [createdSheetUrl, setCreatedSheetUrl] = useState("");
  const [settings, setSettings] = useState<any>(null);
  const { toast } = useToast();

  // Check Google connection status
  useEffect(() => {
    const checkConnections = async () => {
      try {
        const userSettings = await getUserSettings();
        setSettings(userSettings);
        
        // Check Google connection
        try {
          await getGoogleAccessToken();
          setGoogleConnected(true);
        } catch (error) {
          setGoogleConnected(false);
        }

        // Check Dropbox connection
        const dropboxStatus = await checkDropboxConnection();
        setDropboxConnected(dropboxStatus.connected);
      } catch (error) {
        console.error("Failed to check connections:", error);
        setGoogleConnected(false);
        setDropboxConnected(false);
      }
    };
    checkConnections();
  }, []);

  const handleDropboxConnectionSuccess = () => {
    setDropboxConnected(true);
    // Refresh settings
    getUserSettings().then(setSettings);
  };

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
      const accessToken = await getGoogleAccessToken();
      const result = await createGoogleSheetWithOAuth(
        accessToken,
        directoryId || undefined,
      );

      if (result.success) {
        setCreatedSheetUrl(result.sheetUrl || "");
        // Refresh settings to show updated sheet info
        const updatedSettings = await getUserSettings();
        setSettings(updatedSettings);
        // Force a page refresh to update the display
        window.location.reload();
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

  const handleChangeSheet = async () => {
    toast({
      title: "機能準備中",
      description: "シート変更機能は準備中です",
    });
  };

  const handleCreateFolder = async () => {
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
      const accessToken = await getGoogleAccessToken();
      const result = await createGoogleDriveImageFolder(
        accessToken,
        directoryId || undefined,
      );

      if (result.success) {
        // Refresh settings to show updated folder info
        const updatedSettings = await getUserSettings();
        setSettings(updatedSettings);
        // Force a page refresh to update the display
        window.location.reload();
        toast({
          title: "フォルダ作成完了",
          description: result.message,
        });
      } else {
        toast({
          title: "フォルダ作成エラー",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "フォルダ作成エラー",
        description: "Google Driveフォルダの作成に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangeFolder = async () => {
    toast({
      title: "機能準備中",
      description: "フォルダ変更機能は準���中です",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/dashboard")}
            >
              ← ダッシュボード
            </Button>
            <div className="flex-1">
              <div className="flex items-center justify-center gap-3 mb-4">
                <img
                  src="/logo.jpg"
                  alt="YLPM Logo"
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <h1 className="text-3xl font-bold">Google Sheets 作成・管理</h1>
              </div>
              <p className="text-muted-foreground mt-2">
                SNS投稿管理用のGoogle Sheetを作成します
              </p>
            </div>
            <div className="w-20"></div>
          </div>
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
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>Google連携が完了しています</span>
                </div>

                {/* Google Sheet Information */}
                {settings?.google_sheet_url && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm font-medium text-green-800 mb-2">
                      現在のGoogle Sheet:
                    </p>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-700">
                        ファイル名:{" "}
                        {settings.google_sheet_url.includes("YLPM Posts")
                          ? settings.google_sheet_url
                              .split("/")
                              .pop()
                              ?.split("#")[0] || "YLPM Posts Sheet"
                          : "YLPM Posts Sheet"}
                      </p>
                      <a
                        href={settings.google_sheet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 underline break-all inline-flex items-center gap-2"
                      >
                        <Sheet className="h-4 w-4" />
                        {settings.google_sheet_url}
                      </a>
                    </div>
                  </div>
                )}

                {/* Google Drive Folder Information */}
                {settings?.google_drive_folder_url && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm font-medium text-blue-800 mb-2">
                      現在の画像フォルダ:
                    </p>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-700">
                        フォルダ名: {settings.google_drive_folder_name}
                      </p>
                      <a
                        href={settings.google_drive_folder_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 underline break-all inline-flex items-center gap-2"
                      >
                        <Sheet className="h-4 w-4" />
                        {settings.google_drive_folder_url}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-4 w-4" />
                  <span>Google連携が完了していません</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Googleアカウントでログインしてください。
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dropbox Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Dropbox連携ステータス
              {dropboxConnected ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dropboxConnected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>Dropbox連携が完了しています</span>
                </div>
                {settings?.dropbox_folder_name && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm font-medium text-green-800 mb-2">
                      保存フォルダ名:
                    </p>
                    <p className="text-sm text-gray-700">
                      {settings.dropbox_folder_name}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-4 w-4" />
                  <span>Dropbox連携が完了していません</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Instagram投稿にはDropbox連携が必要です。
                </p>
                <DropboxConnectionForm onConnectionSuccess={handleDropboxConnectionSuccess} />
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
              <div className="text-xs text-muted-foreground space-y-2">
                <p>
                  Google
                  DriveのURLから取得できるディレクトリIDを入力してください。
                  空白の場合は、マイドライブのルートに作成されます。
                </p>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="font-medium mb-1">フォルダIDの取得方法：</p>
                  <p>
                    URLの「https://drive.google.com/drive/folders/」の後に続く文字列が、そのフォルダのIDです。
                  </p>
                  <p className="mt-1">
                    例：https://drive.google.com/drive/folders/1a2B3cD4EfGhIjKlmNOpQRstuVWxyz
                    というURLの場合、
                    <span className="font-mono bg-white px-1 rounded">
                      1a2B3cD4EfGhIjKlmNOpQRstuVWxyz
                    </span>{" "}
                    がフォルダIDとなります。
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={handleCreateSheet}
                disabled={loading || !googleConnected}
                className="w-full"
                size="lg"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Sheet className="mr-2 h-4 w-4" />
                Google Sheet を作成
              </Button>

              <Button
                onClick={handleChangeSheet}
                disabled={loading || !googleConnected}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <Sheet className="mr-2 h-4 w-4" />
                シート変更
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Button
                onClick={handleCreateFolder}
                disabled={loading || !googleConnected}
                variant="secondary"
                className="w-full"
                size="lg"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Sheet className="mr-2 h-4 w-4" />
                新規フォルダ作成
              </Button>

              <Button
                onClick={handleChangeFolder}
                disabled={loading || !googleConnected}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <Sheet className="mr-2 h-4 w-4" />
                フォルダ変更
              </Button>
            </div>
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