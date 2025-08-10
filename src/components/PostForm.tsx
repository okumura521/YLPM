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
import { addPostToGoogleSheet, addLogEntry } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

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
  status?: string;
}

const PostForm: React.FC<PostFormProps> = ({
  initialData,
  post,
  onSubmit = () => {},
  onCancel = () => {},
  isEditing = false,
}) => {
  const { toast } = useToast();
  // Initialize from post prop or initialData or defaults
  const initData = post ||
    initialData || {
      content: "",
      platforms: [],
      channels: [],
      isScheduled: false,
    };

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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PostData>({
    defaultValues: initialData,
  });

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
      return;
    }

    setIsGeneratingDraft(true);
    addLogEntry("INFO", "Starting AI draft generation", {
      content,
      aiPrompt,
      platforms: selectedPlatforms,
    });

    try {
      // In a real implementation, this would call the actual AI API
      // For now, we'll simulate the API call with more realistic behavior

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const generated: Record<string, string> = {};

      selectedPlatforms.forEach((platform) => {
        const validation =
          platformValidations[platform as keyof typeof platformValidations];
        if (validation) {
          // Generate platform-specific content based on character limits
          let platformContent = content;
          if (aiPrompt.includes("短く") || aiPrompt.includes("要約")) {
            platformContent = content.substring(
              0,
              Math.min(validation.maxLength * 0.8, content.length),
            );
          } else if (aiPrompt.includes("詳しく") || aiPrompt.includes("詳細")) {
            platformContent =
              content + "\n\n詳細はプロフィールリンクから確認してください。";
          }

          // Ensure it fits within platform limits
          if (platformContent.length > validation.maxLength) {
            platformContent =
              platformContent.substring(0, validation.maxLength - 3) + "...";
          }

          generated[platform] = platformContent;
        }
      });

      setGeneratedContent(generated);
      addLogEntry("INFO", "AI draft generation completed", { generated });

      toast({
        title: "AI生成完了",
        description: "プラットフォーム別のコンテンツが生成されました",
      });
    } catch (error) {
      console.error("AI draft generation failed:", error);
      addLogEntry("ERROR", "AI draft generation failed", error);
      toast({
        title: "AI生成エラー",
        description: "コンテンツの生成に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleFormSubmit = async () => {
    if (!validateContent()) return;

    // Generate images data
    const imageNames = selectedImages.map((img) => img.name);
    const imagesCommaSeparated = imageNames.join(",");
    const imagesJsonArray = JSON.stringify(imageNames);

    // Submit posts for each platform individually
    for (const platform of selectedPlatforms) {
      let scheduledDateTime: Date | undefined;
      const platformSchedule = platformSchedules[platform];

      if (
        platformSchedule?.enabled &&
        platformSchedule.date &&
        platformSchedule.time
      ) {
        scheduledDateTime = new Date(
          `${platformSchedule.date}T${platformSchedule.time}`,
        );
      } else if (isScheduled && scheduleDate && scheduleTime) {
        scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
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
        imagesCommaSeparated,
        imagesJsonArray,
        status: "pending",
      };

      if (initData.id) {
        postData.id = `${initData.id}_${platform}`;
      } else {
        postData.id = `${Date.now()}_${platform}`;
      }

      addLogEntry("INFO", "Submitting post for platform", {
        platform,
        postData,
      });

      try {
        // Add to Google Sheets if not editing
        if (!isEditing) {
          const sheetResult = await addPostToGoogleSheet(postData);
          if (!sheetResult.success) {
            addLogEntry(
              "ERROR",
              "Failed to add post to Google Sheet",
              sheetResult,
            );
            toast({
              title: "Google Sheetエラー",
              description: `${platform}の投稿保存に失敗しました: ${sheetResult.error}`,
              variant: "destructive",
            });
            continue;
          }
          addLogEntry("INFO", "Post added to Google Sheet successfully", {
            platform,
          });
        }

        onSubmit(postData);
      } catch (error) {
        console.error(`Failed to submit post for ${platform}:`, error);
        addLogEntry("ERROR", "Failed to submit post", { platform, error });
        toast({
          title: "投稿エラー",
          description: `${platform}の投稿処理に失敗しました`,
          variant: "destructive",
        });
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
        <Tabs defaultValue="ai" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ai">AI Assistance</TabsTrigger>
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="pt-4">
            <div className="space-y-6">
              {/* 1. Target Platforms Selection */}
              <div className="space-y-4">
                <Label className="text-base font-medium">
                  1. Target Platforms を選択
                </Label>
                <PlatformSelector
                  selectedPlatforms={selectedPlatforms}
                  onChange={setSelectedPlatforms}
                />
              </div>

              {/* 2. Content Form */}
              <div className="space-y-2">
                <Label htmlFor="content">2. 投稿内容</Label>
                <Textarea
                  id="content"
                  placeholder="投稿したい内容を入力してください..."
                  className="min-h-[120px]"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>

              {/* 3. AI Prompt */}
              <div className="space-y-2">
                <Label htmlFor="ai-prompt">3. AI への指示</Label>
                <Input
                  id="ai-prompt"
                  placeholder="どのように編集して欲しいか指示を入力（例：短くまとめて、詳しく説明して）"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                />
              </div>

              {/* 4. Select Images */}
              <div className="space-y-2">
                <Label htmlFor="image-select">4. 画像を選択</Label>
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
                  <Label className="text-base font-medium">
                    5. プラットフォーム別設定
                  </Label>
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

              {/* 6. Generate Draft Button */}
              <div className="space-y-4">
                <Button
                  type="button"
                  onClick={generateAIDraft}
                  disabled={
                    isGeneratingDraft ||
                    !content ||
                    !aiPrompt ||
                    selectedPlatforms.length === 0
                  }
                  className="w-full"
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
                      Generating Draft...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} className="mr-2" />
                      6. Generate Draft
                    </>
                  )}
                </Button>

                {/* Generated Content Preview */}
                {Object.keys(generatedContent).length > 0 && (
                  <div className="space-y-4">
                    <Label>プラットフォーム別生成コンテンツ</Label>
                    {Object.entries(generatedContent).map(
                      ([platform, platformContent]) => {
                        const validation =
                          platformValidations[
                            platform as keyof typeof platformValidations
                          ];
                        return (
                          <Card key={platform} className="p-4">
                            <div className="flex justify-between items-center mb-2">
                              <Badge variant="outline">
                                {validation?.name || platform}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {platformContent.length}/{validation?.maxLength}{" "}
                                文字
                              </span>
                            </div>
                            <p className="text-sm">{platformContent}</p>
                          </Card>
                        );
                      },
                    )}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="manual" className="pt-4">
            <div className="space-y-6">
              {/* 1. Target Platforms Selection */}
              <div className="space-y-4">
                <Label className="text-base font-medium">
                  1. Target Platforms を選択
                </Label>
                <PlatformSelector
                  selectedPlatforms={selectedPlatforms}
                  onChange={setSelectedPlatforms}
                />
              </div>

              {/* 2. Content Form */}
              <div className="space-y-2">
                <Label htmlFor="manual-content">2. 投稿内容</Label>
                <Textarea
                  id="manual-content"
                  placeholder="投稿内容を入力してください..."
                  className="min-h-[200px]"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>

              {/* 3. Select Images */}
              <div className="space-y-2">
                <Label htmlFor="manual-image-select">3. 画像を選択</Label>
                <div className="flex items-center gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      document.getElementById("manual-image-input")?.click()
                    }
                  >
                    <Image className="mr-2 h-4 w-4" />+ 画像追加
                  </Button>
                  <input
                    id="manual-image-input"
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

              {/* 4. Platform-specific Content and Settings */}
              {selectedPlatforms.length > 0 && (
                <div className="space-y-4">
                  <Label className="text-base font-medium">
                    4. プラットフォーム別設定
                  </Label>
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
          </TabsContent>
        </Tabs>

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
          <Button
            onClick={handleFormSubmit}
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
  );
};

export default PostForm;
