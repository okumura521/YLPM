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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, CheckCircle, XCircle, Edit, Plus } from "lucide-react";
import {
  getAISettings,
  saveAISettings,
  updateSelectedAIService,
  testAIConnection,
} from "@/lib/supabase";

const AI_MODELS = {
  OpenAI: [
    "gpt-3.5-turbo",
    "gpt-4",
    "gpt-4-turbo",
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-5-chat",
  ],
  Anthropic: [
    "claude-3-5-sonnet-20241022",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
    "claude-sonnet-4-20250514",
  ],
  Google: [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-pro",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
  ],
};

interface AISettingItem {
  ai_service: string;
  ai_model: string;
  ai_api_token: string;
  ai_connection_status: boolean;
  is_selected: boolean;
}

export default function UserSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  // AI settings list
  const [aiSettingsList, setAiSettingsList] = useState<AISettingItem[]>([]);

  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<AISettingItem | null>(
    null,
  );
  const [editAiModel, setEditAiModel] = useState("");
  const [editAiApiToken, setEditAiApiToken] = useState("");

  // Add new service dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newAiService, setNewAiService] = useState("");
  const [newAiModel, setNewAiModel] = useState("");
  const [newAiApiToken, setNewAiApiToken] = useState("");

  // Load AI settings from Google Sheets
  const loadAISettings = async () => {
    try {
      setLoadingSettings(true);
      const result = await getAISettings();
      if (result.success) {
        setAiSettingsList(result.aiSettings);
      } else {
        toast({
          title: "設定読み込みエラー",
          description: result.error || "AI設定の読み込みに失敗しました",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to load AI settings:", error);
      toast({
        title: "設定読み込みエラー",
        description: "AI設定の読み込みに失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    loadAISettings();
  }, []);

  // Handle service toggle
  const handleServiceToggle = async (service: string, isSelected: boolean) => {
    if (isSelected) {
      try {
        setLoading(true);
        const result = await updateSelectedAIService(service);
        if (result.success) {
          await loadAISettings(); // Reload to get updated state
          toast({
            title: "設定更新完了",
            description: `${service}が選択されました`,
          });
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        toast({
          title: "設定更新エラー",
          description: "AI設定の更新に失敗しました",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    } else {
      // If turning off, update only this service
      const currentSetting = aiSettingsList.find(
        (s) => s.ai_service === service,
      );
      if (currentSetting) {
        try {
          setLoading(true);
          const result = await saveAISettings({
            ...currentSetting,
            is_selected: false,
          });
          if (result.success) {
            await loadAISettings();
            toast({
              title: "設定更新完了",
              description: `${service}の選択が解除されました`,
            });
          } else {
            throw new Error(result.error);
          }
        } catch (error) {
          toast({
            title: "設定更新エラー",
            description: "AI設定の更新に失敗しました",
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      }
    }
  };

  // Handle edit button click
  const handleEditClick = (setting: AISettingItem) => {
    setEditingService(setting);
    setEditAiModel(setting.ai_model);
    setEditAiApiToken(setting.ai_api_token);
    setIsEditDialogOpen(true);
  };

  // Handle edit save
  const handleEditSave = async () => {
    if (!editingService) return;

    if (!editAiModel.trim() || !editAiApiToken.trim()) {
      toast({
        title: "入力エラー",
        description: "モデルとAPIトークンを入力してください",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      setAiTesting(true);

      // Show testing toast
      toast({
        title: "接続テスト中",
        description: `${editingService.ai_service} APIへの接続をテストしています...`,
      });

      // Test connection first with timeout
      const testResult = await Promise.race([
        testAIConnection(
          editingService.ai_service,
          editAiModel,
          editAiApiToken,
        ),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("接続テストがタイムアウトしました")),
            30000,
          ),
        ),
      ]);

      // Show test result
      if (testResult.success) {
        toast({
          title: "接続テスト成功",
          description: `${editingService.ai_service} APIへの接続が確認されました`,
        });
      } else {
        toast({
          title: "接続テスト失敗",
          description: testResult.message || "API接続に失敗しました",
          variant: "destructive",
        });
      }

      const result = await saveAISettings({
        ...editingService,
        ai_model: editAiModel,
        ai_api_token: editAiApiToken,
        ai_connection_status: testResult.success,
      });

      if (result.success) {
        await loadAISettings();
        setIsEditDialogOpen(false);
        setEditingService(null);
        toast({
          title: "設定更新完了",
          description: `${editingService.ai_service}の設定が更新されました`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "AI設定の更新に失敗しました";
      toast({
        title: "設定更新エラー",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setAiTesting(false);
    }
  };

  // Handle add new service
  const handleAddService = async () => {
    if (!newAiService || !newAiModel.trim() || !newAiApiToken.trim()) {
      toast({
        title: "入力エラー",
        description: "すべての項目を入力してください",
        variant: "destructive",
      });
      return;
    }

    // Check if service already exists
    if (aiSettingsList.some((s) => s.ai_service === newAiService)) {
      toast({
        title: "設定エラー",
        description: "このAIサービスは既に設定されています",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      setAiTesting(true);

      // Show testing toast
      toast({
        title: "接続テスト中",
        description: `${newAiService} APIへの接続をテストしています...`,
      });

      // Test connection first with timeout
      const testResult = await Promise.race([
        testAIConnection(newAiService, newAiModel, newAiApiToken),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("接続テストがタイムアウトしました")),
            30000,
          ),
        ),
      ]);

      // Show test result
      if (testResult.success) {
        toast({
          title: "接続テスト成功",
          description: `${newAiService} APIへの接続が確認されました`,
        });
      } else {
        toast({
          title: "接続テスト失敗",
          description: testResult.message || "API接続に失敗しました",
          variant: "destructive",
        });
      }

      const result = await saveAISettings({
        ai_service: newAiService,
        ai_model: newAiModel,
        ai_api_token: newAiApiToken,
        ai_connection_status: testResult.success,
        is_selected: false,
      });

      if (result.success) {
        await loadAISettings();
        setIsAddDialogOpen(false);
        setNewAiService("");
        setNewAiModel("");
        setNewAiApiToken("");
        toast({
          title: "設定追加完了",
          description: `${newAiService}の設定が追加されました`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "AI設定の追加に失敗しました";
      toast({
        title: "設定追加エラー",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setAiTesting(false);
    }
  };

  // Update available models when AI service changes
  useEffect(() => {
    if (newAiService && AI_MODELS[newAiService as keyof typeof AI_MODELS]) {
      setNewAiModel(""); // Reset model selection
    }
  }, [newAiService]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center">
          <Button
            variant="outline"
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 mr-4"
          >
            ← ダッシュボード
          </Button>
          <div className="text-center flex-1">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img
                src="/logo.jpg"
                alt="YLPM Logo"
                className="w-12 h-12 rounded-lg object-cover"
              />
              <h1 className="text-3xl font-bold">ユーザ設定</h1>
            </div>
            <p className="text-muted-foreground mt-2">ユーザ設定を行います</p>
          </div>
        </div>

        {/* AI Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  AI連携設定
                </CardTitle>
                <CardDescription>AI サービスの設定と管理</CardDescription>
              </div>
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                新規追加
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingSettings ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                設定を読み込み中...
              </div>
            ) : aiSettingsList.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                AI設定がありません。新規追加ボタンから設定を追加してください。
              </div>
            ) : (
              <div className="space-y-4">
                {aiSettingsList.map((setting, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={setting.is_selected}
                            onCheckedChange={(checked) =>
                              handleServiceToggle(setting.ai_service, checked)
                            }
                            disabled={loading}
                          />
                          <Badge
                            variant={
                              setting.is_selected ? "default" : "outline"
                            }
                            className={setting.is_selected ? "bg-blue-600" : ""}
                          >
                            {setting.ai_service}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {setting.ai_connection_status ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm text-muted-foreground">
                            {setting.ai_connection_status
                              ? "接続確認済み"
                              : "接続未確認"}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditClick(setting)}
                        className="flex items-center gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        編集
                      </Button>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      <p>モデル: {setting.ai_model}</p>
                      <p>
                        APIトークン:{" "}
                        {setting.ai_api_token ? "設定済み" : "未設定"}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Button */}
        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            ← ダッシュボードに戻る
          </Button>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>AI設定編集 - {editingService?.ai_service}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-ai-model">モデル</Label>
              <Select value={editAiModel} onValueChange={setEditAiModel}>
                <SelectTrigger>
                  <SelectValue placeholder="モデルを選択" />
                </SelectTrigger>
                <SelectContent>
                  {editingService &&
                    AI_MODELS[
                      editingService.ai_service as keyof typeof AI_MODELS
                    ]?.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ai-api-token">APIトークン</Label>
              <PasswordInput
                id="edit-ai-api-token"
                value={editAiApiToken}
                onChange={(e) => setEditAiApiToken(e.target.value)}
                placeholder="API トークンを入力"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                キャンセル
              </Button>
              <Button onClick={handleEditSave} disabled={loading || aiTesting}>
                {(loading || aiTesting) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {aiTesting ? "接続テスト中..." : "保存"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add New Service Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新しいAI設定を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-ai-service">AIサービス</Label>
              <Select value={newAiService} onValueChange={setNewAiService}>
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
              <Label htmlFor="new-ai-model">モデル</Label>
              <Select
                value={newAiModel}
                onValueChange={setNewAiModel}
                disabled={!newAiService}
              >
                <SelectTrigger>
                  <SelectValue placeholder="モデルを選択" />
                </SelectTrigger>
                <SelectContent>
                  {newAiService &&
                    AI_MODELS[newAiService as keyof typeof AI_MODELS]?.map(
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
              <Label htmlFor="new-ai-api-token">APIトークン</Label>
              <PasswordInput
                id="new-ai-api-token"
                value={newAiApiToken}
                onChange={(e) => setNewAiApiToken(e.target.value)}
                placeholder="API トークンを入力"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setNewAiService("");
                  setNewAiModel("");
                  setNewAiApiToken("");
                }}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleAddService}
                disabled={loading || aiTesting}
              >
                {(loading || aiTesting) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {aiTesting ? "接続テスト中..." : "追加"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
