import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  Send,
  Sparkles,
  Image,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Import PlatformSelector directly
import PlatformSelector from "./PlatformSelector";
import {
  addPostToGoogleSheet,
  addLogEntry,
  getUserSettings,
} from "@/lib/supabase";
import { callAI, buildPrompt } from "@/lib/aiProviders";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";

interface PostFormProps {
  initialData?: PostData;
  onSubmit?: (data: PostData) => void;
  onCancel?: () => void;
  post?: any;
  isEditing?: boolean;
}

interface PostData {
  id?: string;
  content: string;
  scheduleTime?: Date;
  platforms: string[];
  channels?: string[];
  isScheduled: boolean;
  image?: File | null;
  images?: File[];
  platformContent?: Record<string, string>;
  platformImages?: Record<string, File[]>;
  platformSchedules?: Record<
    string,
    { date: string; time: string; enabled: boolean }
  >;
  imagesCommaSeparated?: string;
  imagesJsonArray?: string;
  status?: "pending" | "sent" | "failed" | "draft";
}

const PostForm: React.FC<PostFormProps> = ({
  initialData,
  post,
  onSubmit = () => {},
  onCancel = () => {},
  isEditing = false,
}) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  // Initialize from post prop or initialData or defaults
  const initData = post ||
    initialData || {
      content: "",
      platforms: [],
      channels: [],
      isScheduled: false,
    };

  // Initialize schedule date and time from initData
  React.useEffect(() => {
    if (initData.scheduleTime) {
      const scheduleDate = new Date(initData.scheduleTime);
      // Convert to JST for display
      const jstDate = new Date(scheduleDate.getTime() + 9 * 60 * 60 * 1000);
      setScheduleDate(jstDate.toISOString().split("T")[0]);
      setScheduleTime(jstDate.toTimeString().slice(0, 5));
      setIsScheduled(true);
    }
  }, [initData.scheduleTime]);

  const [activeTab, setActiveTab] = useState<string>("ai");
  const [content, setContent] = useState<string>(initData.content || "");
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    initData.platforms || initData.channels || [],
  );
  const [isScheduled, setIsScheduled] = useState<boolean>(
    initData.isScheduled || false,
  );
  const [scheduleDate, setScheduleDate] = useState<string>("");
  const [scheduleTime, setScheduleTime] = useState<string>("");
  const [isGeneratingDraft, setIsGeneratingDraft] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [platformContent, setPlatformContent] = useState<
    Record<string, string>
  >({});
  const [platformImages, setPlatformImages] = useState<Record<string, File[]>>(
    {},
  );
  const [platformSchedules, setPlatformSchedules] = useState<
    Record<string, { date: string; time: string; enabled: boolean }>
  >({});
  const [generatedContent, setGeneratedContent] = useState<
    Record<string, string>
  >({});
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string[]>
  >({});
  const [aiSettings, setAiSettings] = useState<any>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean>(false);
  const [loadingAiSettings, setLoadingAiSettings] = useState<boolean>(true);
  const [imageLoadError, setImageLoadError] = useState<string>("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PostData>({
    defaultValues: initialData,
  });

  // Load AI settings on component mount
  React.useEffect(() => {
    const loadAiSettings = async () => {
      try {
        setLoadingAiSettings(true);
        const settings = await getUserSettings();
        setAiSettings(settings);

        // Check if AI is properly configured
        const isConfigured = !!(
          settings?.ai_service &&
          settings?.ai_model &&
          settings?.ai_api_token &&
          settings?.ai_connection_status
        );
        setAiConfigured(isConfigured);

        addLogEntry("INFO", "AI settings loaded", { isConfigured, settings });
      } catch (error) {
        addLogEntry("ERROR", "Failed to load AI settings", error);
        setAiConfigured(false);
      } finally {
        setLoadingAiSettings(false);
      }
    };

    loadAiSettings();
  }, []);

  // Platform-specific validation rules
  const platformValidations = {
    x: { maxLength: 280, name: "X (Twitter)" },
    instagram: { maxLength: 2200, name: "Instagram" },
    facebook: { maxLength: 63206, name: "Facebook" },
    line: { maxLength: 1000, name: "LINE" },
    discord: { maxLength: 2000, name: "Discord" },
    wordpress: { maxLength: 100000, name: "WordPress" },
  };

  const validateContent = (textToValidate?: string) => {
    const errors: Record<string, string[]> = {};
    const contentToCheck = textToValidate || content;

    selectedPlatforms.forEach((platform) => {
      const validation =
        platformValidations[platform as keyof typeof platformValidations];
      if (validation && contentToCheck.length > validation.maxLength) {
        if (!errors[platform]) errors[platform] = [];
        errors[platform].push(
          `TargetPlatforms「${validation.name}」の文字数を超えています。`,
        );
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setSelectedImages((prev) => [...prev, ...files]);

      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreviews((prev) => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleImageForPlatform = (imageIndex: number, platform: string) => {
    setPlatformImages((prev) => {
      const current = prev[platform] || [];
      const image = selectedImages[imageIndex];
      const exists = current.some((img) => img.name === image.name);

      if (exists) {
        return {
          ...prev,
          [platform]: current.filter((img) => img.name !== image.name),
        };
      } else {
        return {
          ...prev,
          [platform]: [...current, image],
        };
      }
    });
  };

  const updatePlatformContent = (platform: string, content: string) => {
    setPlatformContent((prev) => ({
      ...prev,
      [platform]: content,
    }));
  };

  const updatePlatformSchedule = (
    platform: string,
    field: string,
    value: string | boolean,
  ) => {
    setPlatformSchedules((prev) => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [field]: value,
      },
    }));
  };

  const generateAIDraft = async () => {
    if (!content || !aiPrompt || selectedPlatforms.length === 0) {
      toast({
        title: "入力エラー",
        description:
          "投稿内容、AI指示、プラットフォームをすべて入力してください",
        variant: "destructive",
      });
      return;
    }

    if (!aiConfigured) {
      toast({
        title: "AI設定エラー",
        description: "AI機能を使用するには設定が必要です",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingDraft(true);
    addLogEntry("INFO", "Starting AI draft generation", {
      content,
      aiPrompt,
      platforms: selectedPlatforms,
      aiSettings: {
        service: aiSettings?.ai_service,
        model: aiSettings?.ai_model,
        hasToken: !!aiSettings?.ai_api_token,
      },
    });

    try {
      // Build the prompt for AI
      const prompt = buildPrompt(
        content,
        aiPrompt,
        selectedPlatforms,
        platformValidations,
      );

      // Call AI API
      const aiResponse = await callAI(prompt, {
        service: aiSettings.ai_service,
        model: aiSettings.ai_model,
        apiToken: aiSettings.ai_api_token,
      });

      if (!aiResponse.success) {
        throw new Error(aiResponse.error || "AI API呼び出しに失敗しました");
      }

      if (!aiResponse.content) {
        throw new Error("AIからの応答が空です");
      }

      // Clear the generated content display (as requested)
      setGeneratedContent({});

      // Update platform content with generated content
      const newPlatformContent = { ...platformContent };
      Object.entries(aiResponse.content).forEach(([platform, content]) => {
        if (selectedPlatforms.includes(platform)) {
          newPlatformContent[platform] = content as string;
        }
      });
      setPlatformContent(newPlatformContent);

      addLogEntry("INFO", "AI draft generation completed", {
        generated: aiResponse.content,
        platformsUpdated: Object.keys(aiResponse.content),
      });

      toast({
        title: "AI生成完了",
        description: "プラットフォーム別のコンテンツが生成されました",
      });
    } catch (error) {
      console.error("AI draft generation failed:", error);
      addLogEntry("ERROR", "AI draft generation failed", error);

      let errorMessage = "コンテンツの生成に失敗しました";
      if (error instanceof Error) {
        if (error.message.includes("APIキー")) {
          errorMessage = "APIキーが無効です。設定を確認してください。";
        } else if (error.message.includes("レート制限")) {
          errorMessage =
            "レート制限に達しました。しばらく待ってから再試行してください。";
        } else if (error.message.includes("ネットワーク")) {
          errorMessage =
            "ネットワークエラーが発生しました。接続を確認してください。";
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "AI生成エラー",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleFormSubmit = async (isDraft = false) => {
    if (!isDraft && !validateContent()) return;

    // Generate images data
    const imageNames = selectedImages.map((img) => img.name);
    const imagesCommaSeparated = imageNames.join(",");
    const imagesJsonArray = JSON.stringify(imageNames);

    // Generate a single base ID for all platforms - fix the duplicate issue
    let baseId: string;
    if (isEditing && initData.id) {
      // For editing, extract base ID if it has platform suffix
      baseId = initData.id.includes("_")
        ? initData.id.split("_")[0]
        : initData.id;
    } else {
      // For new posts, generate new base ID
      baseId = Date.now().toString();
    }

    addLogEntry("INFO", "Starting form submission", {
      baseId,
      isEditing,
      selectedPlatforms,
      originalId: initData.id,
    });

    // For editing, submit as a single post with all platforms
    if (isEditing) {
      let scheduledDateTime: Date | undefined;
      if (isScheduled && scheduleDate && scheduleTime) {
        const localDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
        scheduledDateTime = new Date(
          localDateTime.getTime() - 9 * 60 * 60 * 1000,
        ); // Convert JST to UTC
      }

      const postData: PostData = {
        content: content,
        platforms: selectedPlatforms,
        channels: selectedPlatforms,
        isScheduled: isScheduled,
        scheduleTime: scheduledDateTime,
        images: selectedImages,
        platformContent,
        platformImages,
        platformSchedules,
        status: isDraft ? "draft" : "pending",
        id: baseId, // Use base ID for editing
      };

      addLogEntry("INFO", "Submitting edited post", { postData });
      onSubmit(postData);
      return;
    }

    // For new posts, submit for each platform individually
    for (const platform of selectedPlatforms) {
      let scheduledDateTime: Date | undefined;
      const platformSchedule = platformSchedules[platform];

      if (
        platformSchedule?.enabled &&
        platformSchedule.date &&
        platformSchedule.time
      ) {
        // Convert to Japan time (JST)
        const localDateTime = new Date(
          `${platformSchedule.date}T${platformSchedule.time}`,
        );
        scheduledDateTime = new Date(
          localDateTime.getTime() - 9 * 60 * 60 * 1000,
        ); // Convert JST to UTC
      } else if (isScheduled && scheduleDate && scheduleTime) {
        // Convert to Japan time (JST)
        const localDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
        scheduledDateTime = new Date(
          localDateTime.getTime() - 9 * 60 * 60 * 1000,
        ); // Convert JST to UTC
      }

      const postData: PostData = {
        content: platformContent[platform] || content,
        platforms: [platform], // Single platform per post
        channels: [platform],
        isScheduled: platformSchedule?.enabled || isScheduled,
        scheduleTime: scheduledDateTime,
        images: platformImages[platform] || selectedImages,
        platformContent,
        platformImages,
        platformSchedules,
        status: isDraft ? "draft" : "pending",
        id: `${baseId}_${platform}`, // Use consistent ID format with platform suffix
      };

      addLogEntry("INFO", "Submitting post for platform", {
        platform,
        postId: postData.id,
        baseId,
      });

      try {
        await onSubmit(postData);
        addLogEntry("INFO", "Post submitted successfully", {
          platform,
          postId: postData.id,
        });
      } catch (error) {
        console.error(`Failed to submit post for ${platform}:`, error);
        addLogEntry("ERROR", "Failed to submit post", { platform, error });
        toast({
          title: "投稿エラー",
          description: `${platform}の投稿処理に失敗しました`,
          variant: "destructive",
        });
        continue; // Continue with other platforms even if one fails
      }
    }

    toast({
      title: isEditing ? "投稿更新完了" : "投稿作成完了",
      description: isEditing
        ? "投稿が正常に更新されました"
        : "投稿が正常に作成されました",
    });
  };

  // Validate content on change for Manual Entry tab
  React.useEffect(() => {
    if (activeTab === "manual") {
      validateContent();
    }
  }, [content, selectedPlatforms, activeTab]);

  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  return (
    <div className="w-full bg-white">
      <div className="space-y-6">
        {/* AI Settings Status */}
        {loadingAiSettings ? (
          <Card className="p-4">
            <div className="flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: "linear",
                }}
                className="mr-2"
              >
                <Clock size={16} />
              </motion.div>
              AI設定を読み込み中...
            </div>
          </Card>
        ) : !aiConfigured ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>AI機能使用にはAI設定が必要です</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/settings")}
                className="ml-4"
              >
                設定ページへ
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <Card className="p-4 bg-green-50 border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-medium text-green-800">AI設定済み</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/settings")}
                className="text-green-700 border-green-300 hover:bg-green-100"
              >
                設定変更
              </Button>
            </div>
            <div className="mt-2 text-sm text-green-700">
              <p>サービス: {aiSettings?.ai_service}</p>
              <p>モデル: {aiSettings?.ai_model}</p>
              <p>
                接続状態:{" "}
                {aiSettings?.ai_connection_status
                  ? "✓ 接続確認済み"
                  : "⚠ 未確認"}
              </p>
            </div>
          </Card>
        )}

        <div className="space-y-6">
            <div className="space-y-6">
              {/* 1. Target Platforms Selection */}
              <div className="space-y-4">
                <Label className="text-base font-medium">
                  1. Target Platforms を選択
                </Label>
                {isEditing ? (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
                    <p className="text-sm text-muted-foreground mb-2">
                      編集モードでは、プラットフォームの変更はできません。
                    </p>
                    <div className="flex gap-2">
                      {selectedPlatforms.map((platform) => {
                        const platformInfo = {
                          x: "X (Twitter)",
                          instagram: "Instagram",
                          facebook: "Facebook",
                          line: "LINE",
                          discord: "Discord",
                          wordpress: "WordPress",
                        };
                        return (
                          <Badge key={platform} variant="outline">
                            {platformInfo[
                              platform as keyof typeof platformInfo
                            ] || platform}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <PlatformSelector
                    selectedPlatforms={selectedPlatforms}
                    onChange={setSelectedPlatforms}
                  />
                )}
              </div>

              {/* 2. Content Draft */}
              <div className="space-y-2">
                <Label htmlFor="content">2. 投稿内容の下書き</Label>
                <div className="text-sm text-muted-foreground mb-2">
                  投稿内容を入力してください。下記の「投稿内容転記ボタン」でプラットフォーム別投稿内容に転記・上書きできます。
                </div>
                <Textarea
                  id="content"
                  placeholder="投稿内容を入力してください..."
                  className="min-h-[120px]"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const newPlatformContent = { ...platformContent };
                    selectedPlatforms.forEach(platform => {
                      newPlatformContent[platform] = content;
                    });
                    setPlatformContent(newPlatformContent);
                    toast({
                      title: "転記完了",
                      description: "投稿内容をプラットフォーム別設定に転記しました",
                    });
                  }}
                  disabled={!content.trim() || selectedPlatforms.length === 0}
                  className="w-full"
                >
                  投稿内容転記ボタン（プラットフォーム別投稿内容に転記・上書き）
                </Button>
              </div>

              {/* 3. AI Assistant Section */}
              <Card className="p-4 border-2 border-dashed border-blue-200">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">3. AIアシスタント（オプション）</Label>
                    <div className="text-sm text-muted-foreground">
                      手動下書きをせず、AI生成する場合はONにしてください
                    </div>
                  </div>
                  
                  {aiConfigured && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="ai-base-content">ベース投稿内容・キーワード</Label>
                        <div className="text-sm text-muted-foreground mb-2">
                          AIが生成する際の基となる内容やキーワードを入力してください。
                        </div>
                        <Textarea
                          id="ai-base-content"
                          placeholder="例：新商品の紹介、イベント告知、キーワードなど..."
                          className="min-h-[100px]"
                          value={aiPrompt ? content : ''}
                          onChange={(e) => setContent(e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="ai-prompt">AI への指示</Label>
                        <div className="text-sm text-muted-foreground mb-2">
                          各プラットフォームに合わせてどのように最適化するか指示してください。
                        </div>
                        <Input
                          id="ai-prompt"
                          placeholder="例：カジュアルに、ビジネス向けに、絵文字を使って、詳しく説明して"
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                        />
                      </div>
                      
                      <Button
                        type="button"
                        onClick={generateAIDraft}
                        disabled={
                          isGeneratingDraft ||
                          !content ||
                          !aiPrompt ||
                          selectedPlatforms.length === 0
                        }
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        {isGeneratingDraft ? (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                ease: "linear",
                              }}
                              className="mr-2"
                            >
                              <Clock size={16} />
                            </motion.div>
                            AIコンテンツ生成中...
                          </>
                        ) : (
                          <>
                            <Sparkles size={16} className="mr-2" />
                            プラットフォーム別生成ボタン
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>

              {/* 4. Select Images */}
              <div className="space-y-2">
                <Label htmlFor="manual-image-select">4. 投稿したい画像を選択</Label>
                <div className="text-sm text-muted-foreground mb-2">
                  投稿に使用する画像を選択してください。<br />
                  ※プラットフォーム毎に投稿する画像は下部のプラットフォーム別設定で選択してください。
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      document.getElementById("image-input")?.click()
                    }
                  >
                    <Image className="mr-2 h-4 w-4" />+ 画像追加
                  </Button>
                  <input
                    id="image-input"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  {selectedImages.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {selectedImages.length}枚選択済み
                    </span>
                  )}
                </div>
                {imagePreviews.length > 0 && (
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative">
                        <img
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-20 object-cover rounded-md"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-1 right-1 h-6 w-6 p-0"
                          onClick={() => removeImage(index)}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. Platform-specific Content and Settings */}
              {selectedPlatforms.length > 0 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-base font-medium">
                      5. プラットフォーム別設定
                    </Label>
                    <div className="text-sm text-muted-foreground">
                      投稿内容の下書きを清書してください。プラットフォーム毎に送信タイミングを分けたい場合は、個別スケジュール設定をONにして設定してください。<br />
                      ※個別スケジュールを設定しない場合は、スケジュール投稿の設定になります。
                    </div>
                  </div>
                  {selectedPlatforms.map((platform) => {
                    const validation =
                      platformValidations[
                        platform as keyof typeof platformValidations
                      ];
                    const platformContentValue =
                      platformContent[platform] || content;
                    const platformSchedule = platformSchedules[platform] || {
                      date: "",
                      time: "",
                      enabled: false,
                    };

                    return (
                      <Card key={platform} className="p-4">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <Badge variant="outline">
                              {validation?.name || platform}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {platformContentValue.length}/
                              {validation?.maxLength || "∞"} 文字
                            </span>
                          </div>

                          {/* Platform-specific content */}
                          <div className="space-y-2">
                            <Label>投稿内容</Label>
                            <Textarea
                              placeholder={`${validation?.name || platform}用の投稿内容`}
                              value={platformContentValue}
                              onChange={(e) =>
                                updatePlatformContent(platform, e.target.value)
                              }
                              className="min-h-[100px]"
                            />
                          </div>

                          {/* Image selection for platform */}
                          {selectedImages.length > 0 && (
                            <div className="space-y-2">
                              <Label>使用する画像</Label>
                              <div className="grid grid-cols-4 gap-2">
                                {selectedImages.map((image, index) => {
                                  const isSelected =
                                    platformImages[platform]?.some(
                                      (img) => img.name === image.name,
                                    ) || false;
                                  return (
                                    <div key={index} className="relative">
                                      <img
                                        src={imagePreviews[index]}
                                        alt={`Image ${index + 1}`}
                                        className={`w-full h-16 object-cover rounded-md cursor-pointer border-2 ${
                                          isSelected
                                            ? "border-primary"
                                            : "border-gray-200"
                                        }`}
                                        onClick={() =>
                                          toggleImageForPlatform(
                                            index,
                                            platform,
                                          )
                                        }
                                      />
                                      {isSelected && (
                                        <div className="absolute top-1 right-1 bg-primary text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">
                                          ✓
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Platform-specific schedule */}
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={platformSchedule.enabled}
                                onCheckedChange={(checked) =>
                                  updatePlatformSchedule(
                                    platform,
                                    "enabled",
                                    checked,
                                  )
                                }
                              />
                              <Label>個別スケジュール設定</Label>
                            </div>

                            {platformSchedule.enabled && (
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label>日付</Label>
                                  <Input
                                    type="date"
                                    value={platformSchedule.date}
                                    onChange={(e) =>
                                      updatePlatformSchedule(
                                        platform,
                                        "date",
                                        e.target.value,
                                      )
                                    }
                                  />
                                </div>
                                <div>
                                  <Label>時刻</Label>
                                  <Input
                                    type="time"
                                    value={platformSchedule.time}
                                    onChange={(e) =>
                                      updatePlatformSchedule(
                                        platform,
                                        "time",
                                        e.target.value,
                                      )
                                    }
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

                )}
              </div>
            )}

            {/* Validation Alerts */}
            {hasValidationErrors && (
              <div className="space-y-2">
                {Object.entries(validationErrors).map(
                  ([platform, errors]) => (
                    <Alert key={platform} variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{errors.join(", ")}</AlertDescription>
                    </Alert>
                  ),
                )}
              </div>
            )}
        </div>

        {/* Schedule Settings */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="schedule"
              checked={isScheduled}
              onCheckedChange={setIsScheduled}
            />
            <Label htmlFor="schedule">スケジュール投稿</Label>
          </div>

          {isScheduled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">日付</Label>
                <div className="flex">
                  <Calendar className="mr-2 h-4 w-4 opacity-50" />
                  <Input
                    id="date"
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">時刻</Label>
                <div className="flex">
                  <Clock className="mr-2 h-4 w-4 opacity-50" />
                  <Input
                    id="time"
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between pt-6">
          <Button variant="outline" type="button" onClick={onCancel}>
            キャンセル
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleFormSubmit(true)}
              disabled={selectedPlatforms.length === 0 || !content.trim()}
            >
              下書き保存
            </Button>
            <Button
              onClick={() => handleFormSubmit(false)}
              disabled={
                hasValidationErrors ||
                selectedPlatforms.length === 0 ||
                !content.trim()
              }
            >
              <Send className="mr-2 h-4 w-4" />
              {isScheduled ? "スケジュール投稿" : "今すぐ投稿"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostForm;