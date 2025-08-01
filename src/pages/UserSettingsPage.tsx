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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import {
  saveUserSettings,
  getUserSettings,
  testGoogleConnection,
  testAIConnection,
} from "@/lib/supabase";

const AI_MODELS = {
  OpenAI: ["gpt-3.5-turbo", "gpt-4"],
  Anthropic: ["claude-2", "claude-instant"],
  Gemini: [
    "Gemini 2.5 Pro",
    "Gemini 2.5 Flash",
    "Gemini 2.0 Pro",
    "Gemini 1.5 Pro",
  ],
};

export default function UserSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [googleTesting, setGoogleTesting] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const { toast } = useToast();

  // Google settings
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [googleRedirectUri, setGoogleRedirectUri] = useState("");
  const [googleConnectionStatus, setGoogleConnectionStatus] = useState(false);

  // AI settings
  const [aiService, setAiService] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiApiToken, setAiApiToken] = useState("");
  const [aiConnectionStatus, setAiConnectionStatus] = useState(false);

  // Load existing settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getUserSettings();
        if (settings) {
          setGoogleClientId(settings.google_client_id || "");
          setGoogleClientSecret(settings.google_client_secret || "");
          setGoogleRedirectUri(settings.google_redirect_uri || "");
          setGoogleConnectionStatus(settings.google_connection_status || false);
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

  const validateGoogleForm = () => {
    if (
      !googleClientId.trim() ||
      !googleClientSecret.trim() ||
      !googleRedirectUri.trim()
    ) {
      toast({
        title: "入力エラー",
        description: "すべてのGoogle設定項目を入力してください",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

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

  const handleGoogleConnectionTest = async () => {
    if (!validateGoogleForm()) return;

    setGoogleTesting(true);
    try {
      const result = await testGoogleConnection(
        googleClientId,
        googleClientSecret,
        googleRedirectUri,
      );
      setGoogleConnectionStatus(result.success);

      toast({
        title: result.success ? "接続成功" : "接続失敗",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    } catch (error) {
      setGoogleConnectionStatus(false);
      toast({
        title: "接続エラー",
        description: "接続テストに失敗しました",
        variant: "destructive",
      });
    } finally {
      setGoogleTesting(false);
    }
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
    if (!validateGoogleForm() || !validateAiForm()) return;

    setLoading(true);
    try {
      await saveUserSettings({
        googleClientId,
        googleClientSecret,
        googleRedirectUri,
        googleConnectionStatus,
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
        <div className="text-center">
          <h1 className="text-3xl font-bold">ユーザー設定</h1>
          <p className="text-muted-foreground mt-2">
            Google連携とAI連携の設定を行います
          </p>
        </div>

        {/* Google Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Google連携設定
              {googleConnectionStatus ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </CardTitle>
            <CardDescription>
              Google Sheets API、Google Drive API の設定
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="google-client-id">クライアント ID</Label>
              <PasswordInput
                id="google-client-id"
                value={googleClientId}
                onChange={(e) => setGoogleClientId(e.target.value)}
                placeholder="Google Client ID を入力"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="google-client-secret">
                クライアントシークレット
              </Label>
              <PasswordInput
                id="google-client-secret"
                value={googleClientSecret}
                onChange={(e) => setGoogleClientSecret(e.target.value)}
                placeholder="Google Client Secret を入力"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="google-redirect-uri">リダイレクト URI</Label>
              <Input
                id="google-redirect-uri"
                value={googleRedirectUri}
                onChange={(e) => setGoogleRedirectUri(e.target.value)}
                placeholder="https://example.com/callback"
              />
            </div>
            <Button
              onClick={handleGoogleConnectionTest}
              disabled={googleTesting}
              variant="outline"
            >
              {googleTesting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              接続確認
            </Button>
          </CardContent>
        </Card>

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
                  <SelectItem value="Gemini">Gemini</SelectItem>
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

        {/* Save Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleSaveSettings}
            disabled={loading}
            size="lg"
            className="w-full max-w-md"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            設定を保存
          </Button>
        </div>
      </div>
    </div>
  );
}
