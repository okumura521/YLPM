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
  status?: string;
}

const PostForm: React.FC<PostFormProps> = ({
  initialData,
  post,
  onSubmit = () => {},
  onCancel = () => {},
  isEditing = false,
}) => {
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
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateAIDraft = async () => {
    if (!content || !aiPrompt || selectedPlatforms.length === 0) {
      return;
    }

    setIsGeneratingDraft(true);
    // Simulate AI draft generation for each platform
    setTimeout(() => {
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
      setIsGeneratingDraft(false);
    }, 2000);
  };

  const handleFormSubmit = async () => {
    if (!validateContent()) return;

    let scheduledDateTime: Date | undefined;
    if (isScheduled && scheduleDate && scheduleTime) {
      scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
    }

    const postData: PostData = {
      content,
      platforms: selectedPlatforms,
      channels: selectedPlatforms, // For compatibility
      isScheduled,
      scheduleTime: scheduledDateTime,
      image: selectedImage,
      status: "pending",
    };

    if (initData.id) {
      postData.id = initData.id;
    }

    // Simulate Google Sheets write
    try {
      // Here you would integrate with Google Sheets API
      console.log("Writing to Google Sheets:", postData);
      onSubmit(postData);
    } catch (error) {
      console.error("Failed to write to Google Sheets:", error);
    }
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

              {/* 4. Select Image */}
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
                    <Image className="mr-2 h-4 w-4" />
                    Select Image
                  </Button>
                  <input
                    id="image-input"
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  {selectedImage && (
                    <span className="text-sm text-muted-foreground">
                      {selectedImage.name}
                    </span>
                  )}
                </div>
                {imagePreview && (
                  <div className="mt-2">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-w-xs max-h-32 object-cover rounded-md"
                    />
                  </div>
                )}
              </div>

              {/* 5. Generate Draft Button */}
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
                      5. Generate Draft
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

              {/* 3. Select Image */}
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
                    <Image className="mr-2 h-4 w-4" />
                    Select Image
                  </Button>
                  <input
                    id="manual-image-input"
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  {selectedImage && (
                    <span className="text-sm text-muted-foreground">
                      {selectedImage.name}
                    </span>
                  )}
                </div>
                {imagePreview && (
                  <div className="mt-2">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-w-xs max-h-32 object-cover rounded-md"
                    />
                  </div>
                )}
              </div>

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
