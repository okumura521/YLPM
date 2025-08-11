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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2,
  CheckCircle,
  XCircle,
  X,
  FileSpreadsheet,
} from "lucide-react";
import {
  saveUserSettings,
  getUserSettings,
  testAIConnection,
} from "@/lib/supabase";

const AI_MODELS = {
  OpenAI: [
    "gpt-3.5-turbo",
    "gpt-4",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-5",
    "gpt-5-mini",
  ],
  Anthropic: [
    "claude-2",
    "claude-instant",
    "claude-3-5-sonnet",
    "claude-4-sonnet",
    "claude-4-opus",
    "claude-4.1-opus",
  ],
  Google: [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-pro",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
  ],
};

export default function UserSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // AI settings
  const [aiService, setAiService] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiApiToken, setAiApiToken] = useState("");
  const [aiConnectionStatus, setAiConnectionStatus] = useState(false);

  // Sheet settings
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [googleDriveFolderId, setGoogleDriveFolderId] = useState("");
  const [googleDriveFolderName, setGoogleDriveFolderName] = useState("");
  const [googleDriveFolderUrl, setGoogleDriveFolderUrl] = useState("");

  // Load existing settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getUserSettings();
        if (settings) {
          setGoogleSheetUrl(settings.google_sheet_url || "");
          setGoogleDriveFolderId(settings.google_drive_folder_id || "");
          setGoogleDriveFolderName(settings.google_drive_folder_name || "");
          setGoogleDriveFolderUrl(settings.google_drive_folder_url || "");
          setAiService(settings.ai_service || "");
          setAiModel(settings.ai_model || "");
          setAiApiToken(settings.ai_api_token || "");
          setAiConnectionStatus(settings.ai_connection_status || false);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };
    loadSettings();
  }, []);

  // Update available models when AI service changes
  useEffect(() => {
    if (aiService && AI_MODELS[aiService as keyof typeof AI_MODELS]) {
      setAiModel(""); // Reset model selection
    }
  }, [aiService]);

  const validateAiForm = () => {
    if (!aiService || !aiModel || !aiApiToken.trim()) {
      toast({
        title: "入力エラー",
        description: "すべてのAI設定項目を入力してください",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleAiConnectionTest = async () => {
    if (!validateAiForm()) return;

    setAiTesting(true);
    try {
      const result = await testAIConnection(aiService, aiModel, aiApiToken);
      setAiConnectionStatus(result.success);

      toast({
        title: result.success ? "接続成功" : "接続失敗",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    } catch (error) {
      setAiConnectionStatus(false);
      toast({
        title: "接続エラー",
        description: "接続テストに失敗しました",
        variant: "destructive",
      });
    } finally {
      setAiTesting(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!validateAiForm()) return;

    setLoading(true);
    try {
      await saveUserSettings({
        aiService,
        aiModel,
        aiApiToken,
        aiConnectionStatus,
      });

      toast({
        title: "保存完了",
        description: "設定が正常に保存されました",
      });
    } catch (error) {
      toast({
        title: "保存エラー",
        description: "設定の保存に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div className="text-center flex-1">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img
                src="https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=48&h=48&fit=crop&crop=center"
                alt="YLPM Logo"
                className="w-12 h-12 rounded-lg"
              />
              <h1 className="text-3xl font-bold">AI設定</h1>
            </div>
            <p className="text-muted-foreground mt-2">AI連携の設定を行います</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/")}
            className="ml-4"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* AI Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              AI連携設定
              {aiConnectionStatus ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </CardTitle>
            <CardDescription>AI サービスの設定</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-service">AIサービス</Label>
              <Select value={aiService} onValueChange={setAiService}>
                <SelectTrigger>
                  <SelectValue placeholder="AIサービスを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OpenAI">OpenAI</SelectItem>
                  <SelectItem value="Anthropic">Anthropic</SelectItem>
                  <SelectItem value="Google">Google</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-model">モデル</Label>
              <Select
                value={aiModel}
                onValueChange={setAiModel}
                disabled={!aiService}
              >
                <SelectTrigger>
                  <SelectValue placeholder="モデルを選択" />
                </SelectTrigger>
                <SelectContent>
                  {aiService &&
                    AI_MODELS[aiService as keyof typeof AI_MODELS]?.map(
                      (model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ),
                    )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-api-token">APIトークン</Label>
              <PasswordInput
                id="ai-api-token"
                value={aiApiToken}
                onChange={(e) => setAiApiToken(e.target.value)}
                placeholder="API トークンを入力"
              />
            </div>
            <Button
              onClick={handleAiConnectionTest}
              disabled={aiTesting}
              variant="outline"
            >
              {aiTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              接続確認
            </Button>
          </CardContent>
        </Card>

        {/* Navigation and Save Button */}
        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            ← ダッシュボードに戻る
          </Button>
          <Button
            onClick={handleSaveSettings}
            disabled={loading}
            size="lg"
            className="px-8"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            設定を保存
          </Button>
        </div>
      </div>
    </div>
  );
}
