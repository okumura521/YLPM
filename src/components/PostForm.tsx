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
  uploadImageAndGenerateId, // 追加
  getImagesInfoByIds, // 追加
} from "@/lib/supabase";
import { callAI, buildPrompt } from "@/lib/aiProviders";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";

interface PostFormProps {
  initialData?: PostData | PostData[];
  onSubmit?: (data: PostData) => void;
  onCancel?: () => void;
  // 変更: postを単一のオブジェクトではなく、配列として受け取る
  post?: PostData[];
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
  platformImages?: Record<string, File[]>; // この型は最終的に使わないが、一時的に残す
  platformSchedules?: Record<
    string,
    { date: string; time: string; enabled: boolean }
  >;
  status?: "pending" | "sent" | "failed" | "draft";
  // 新しい画像管理システム
  imageIds?: string[]; // 画像IDの配列
  platformImageIds?: Record<string, string[]>; // プラットフォーム別の画像ID
}

interface ImagePreviewData {
  type: "new" | "existing";
  id: string; // File name for new, imageId for existing (クライアントサイドで一意なIDにする)
  previewUrl: string;
  originalFile?: File; // Only for new images
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

  const [activeTab, setActiveTab] = useState<string>("ai");
  const [content, setContent] = useState<string>("");
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [aiInstruction, setAiInstruction] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isScheduled, setIsScheduled] = useState<boolean>(false);
  const [scheduleDate, setScheduleDate] = useState<string>("");
  const [scheduleTime, setScheduleTime] = useState<string>("");
  const [isGeneratingDraft, setIsGeneratingDraft] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  // const [selectedImages, setSelectedImages] = useState<File[]>([]); // この行は削除
  const [imagePreviews, setImagePreviews] = useState<ImagePreviewData[]>([]); // 型を修正
  const [imageIds, setImageIds] = useState<string[]>([]); // 画像IDの配列
  const [imageInfoMap, setImageInfoMap] = useState<
    Record<string, { imageId: string; fileName: string; imageUrl: string }>
  >({});
  const [platformContent, setPlatformContent] = useState<
    Record<string, string>
  >({});
  const [platformImages, setPlatformImages] = useState<
    Record<string, ImagePreviewData[]>
  >({}); // 型を修正
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
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PostData>({
    defaultValues: undefined,
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

  // プラットフォーム別の文字数監視と検証
  const validatePlatformContents = () => {
    const errors: Record<string, string[]> = {};

    selectedPlatforms.forEach((platform) => {
      const validation =
        platformValidations[platform as keyof typeof platformValidations];
      if (!validation) return;

      const platformContentValue = platformContent[platform] || "";
      const contentLength = platformContentValue.length;

      if (contentLength > validation.maxLength) {
        if (!errors[platform]) errors[platform] = [];
        errors[platform].push(
          `${validation.name}の文字数制限（${validation.maxLength}文字）を超えています。現在${contentLength}文字です。`,
        );
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // プラットフォーム別コンテンツが変更されたときに検証を実行
  React.useEffect(() => {
    if (selectedPlatforms.length > 0) {
      validatePlatformContents();
    }
  }, [platformContent, selectedPlatforms]);

  // エラー状態の確認
  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  React.useEffect(() => {
    const initializeForm = async () => {
      // 編集モードで、post配列またはinitialDataが渡された場合の処理
      const editData = isEditing
        ? post ||
          (Array.isArray(initialData)
            ? initialData
            : initialData
              ? [initialData]
              : [])
        : [];

      if (isEditing && editData && editData.length > 0) {
        const primaryPost = editData[0];

        addLogEntry("INFO", "Post data received for editing", {
          editDataCount: editData.length,
          primaryPost: {
            id: primaryPost.id,
            hasPlatforms: !!primaryPost.platforms,
            platformsType: typeof primaryPost.platforms,
            imageIdsCount: primaryPost.imageIds?.length || 0, // 修正
          },
        });

        // プラットフォーム別データが存在する場合の処理
        if (
          primaryPost.platforms &&
          typeof primaryPost.platforms === "object" &&
          !Array.isArray(primaryPost.platforms)
        ) {
          // 新しい形式: プラットフォーム別データ
          const platformsData = primaryPost.platforms as Record<string, any>;
          const availablePlatforms = Object.keys(platformsData).filter(
            (platform) =>
              platformsData[platform].content ||
              platformsData[platform].hasImageUrl,
          );

          setSelectedPlatforms(availablePlatforms);
          setIsScheduled(primaryPost.isScheduled || false);

          // プラットフォーム別の投稿内容を設定
          const newPlatformContent: Record<string, string> = {};
          // const newPlatformImages: Record<string, File[]> = {}; // 型を修正
          const newPlatformSchedules: Record<
            string,
            { date: string; time: string; enabled: boolean }
          > = {};

          availablePlatforms.forEach((platform) => {
            const platformData = platformsData[platform];
            newPlatformContent[platform] = platformData.content || "";

            // スケジュール設定
            if (primaryPost.scheduleTime) {
              const scheduleDate = new Date(primaryPost.scheduleTime);
              newPlatformSchedules[platform] = {
                date: scheduleDate.toISOString().split("T")[0],
                time: scheduleDate.toTimeString().slice(0, 5),
                enabled: true,
              };
            } else {
              newPlatformSchedules[platform] = {
                date: "",
                time: "",
                enabled: false,
              };
            }
          });

          setPlatformContent(newPlatformContent);
          // setPlatformImages(newPlatformImages); // 初期化ロジックは後で
          setPlatformSchedules(newPlatformSchedules);

          // 最初のプラットフォームの内容をベース内容として設定
          const firstPlatform = availablePlatforms[0];
          if (firstPlatform && platformsData[firstPlatform]) {
            setContent(platformsData[firstPlatform].content || "");
          }

          // 画像IDの処理 - プラットフォーム別のimageUrlsから取得
          const allImageIds: string[] = [];
          const platformImageIds: Record<string, string[]> = {};

          // 各プラットフォームのimageUrlsから画像IDを収集
          availablePlatforms.forEach((platform) => {
            const platformData = platformsData[platform];
            if (
              platformData.imageUrls &&
              Array.isArray(platformData.imageUrls)
            ) {
              platformImageIds[platform] = platformData.imageUrls;
              allImageIds.push(...platformData.imageUrls);
            }
          });

          // 重複を除去
          const uniqueImageIds = [...new Set(allImageIds)];
          setImageIds(uniqueImageIds);

          addLogEntry("INFO", "Processing image IDs for edit", {
            uniqueImageIds,
            platformImageIds,
            availablePlatforms,
          });

          // 画像IDから画像情報を取得
          if (uniqueImageIds.length > 0) {
            const imageInfoResult = await getImagesInfoByIds(uniqueImageIds);
            if (imageInfoResult.success) {
              const newImageInfoMap: Record<
                string,
                { imageId: string; fileName: string; imageUrl: string }
              > = {};
              const newImagePreviewsData: ImagePreviewData[] = []; // 型を修正

              imageInfoResult.images.forEach((imageInfo: any) => {
                if (imageInfo.imageUrl && !imageInfo.error) {
                  newImageInfoMap[imageInfo.imageId] = {
                    imageId: imageInfo.imageId,
                    fileName: imageInfo.fileName,
                    imageUrl: imageInfo.imageUrl,
                  };
                  newImagePreviewsData.push({
                    // ImagePreviewData形式で追加
                    type: "existing",
                    id: imageInfo.imageId,
                    previewUrl: imageInfo.imageUrl,
                  });
                }
              });

              setImageInfoMap(newImageInfoMap);
              setImagePreviews(newImagePreviewsData); // 更新

              // 既存画像の選択状態を設定
              const updatedPlatformImages: Record<string, ImagePreviewData[]> =
                {}; // 型を修正
              availablePlatforms.forEach((platform) => {
                const platformData = platformsData[platform];
                if (
                  platformData.imageUrls &&
                  Array.isArray(platformData.imageUrls)
                ) {
                  platformData.imageUrls.forEach((imageId) => {
                    const imageInfo = newImageInfoMap[imageId];
                    if (imageInfo) {
                      const previewData: ImagePreviewData = {
                        type: "existing",
                        id: imageInfo.imageId,
                        previewUrl: imageInfo.imageUrl,
                      };
                      if (!updatedPlatformImages[platform]) {
                        updatedPlatformImages[platform] = [];
                      }
                      updatedPlatformImages[platform].push(previewData);
                    }
                  });
                }
              });
              setPlatformImages(updatedPlatformImages); // 更新

              addLogEntry("INFO", "Image info loaded for edit", {
                imageCount: newImagePreviewsData.length,
                imageIds: Object.keys(newImageInfoMap),
                platformImages: updatedPlatformImages,
              });
            }
          }

          addLogEntry("INFO", "Platform-specific data processed for edit", {
            availablePlatforms,
            platformContentKeys: Object.keys(newPlatformContent),
            totalImageIds: uniqueImageIds.length, // 修正
          });
        } else {
          // 従来の形式: 配列形式のプラットフォーム
          setContent(primaryPost.content || "");
          setIsScheduled(primaryPost.isScheduled || false);

          // 各プラットフォームの投稿内容とスケジュールを初期化
          const newPlatformContent: Record<string, string> = {};
          const newSelectedPlatforms: string[] = [];
          const newPlatformSchedules: Record<
            string,
            { date: string; time: string; enabled: boolean }
          > = {};
          const newImageIds: string[] = [];

          // 既存の画像IDを管理するための新しいステートを設定
          const uniqueImageIds = [
            ...new Set(
              editData.flatMap((p) => {
                if (p.imageIds) {
                  return p.imageIds.filter((id) => id.trim());
                }
                return [];
              }),
            ),
          ];

          setImageIds(uniqueImageIds);

          // 画像IDから画像情報を取得
          if (uniqueImageIds.length > 0) {
            const imageInfoResult = await getImagesInfoByIds(uniqueImageIds);
            if (imageInfoResult.success) {
              const newImageInfoMap: Record<
                string,
                { imageId: string; fileName: string; imageUrl: string }
              > = {};
              const newImagePreviewsData: ImagePreviewData[] = []; // 型を修正

              imageInfoResult.images.forEach((imageInfo: any) => {
                if (imageInfo.imageUrl && !imageInfo.error) {
                  newImageInfoMap[imageInfo.imageId] = {
                    imageId: imageInfo.imageId,
                    fileName: imageInfo.fileName,
                    imageUrl: imageInfo.imageUrl,
                  };
                  newImagePreviewsData.push({
                    // ImagePreviewData形式で追加
                    type: "existing",
                    id: imageInfo.imageId,
                    previewUrl: imageInfo.imageUrl,
                  });
                }
              });

              setImageInfoMap(newImageInfoMap);
              setImagePreviews(newImagePreviewsData); // 更新

              // 既存画像の選択状態を設定 (従来の形式の場合も考慮)
              const updatedPlatformImages: Record<string, ImagePreviewData[]> =
                {}; // 型を修正
              editData.forEach((p) => {
                const platform = Array.isArray(p.platforms)
                  ? p.platforms[0]
                  : p.platforms;
                if (platform && p.imageIds) {
                  p.imageIds.forEach((imageId) => {
                    const imageInfo = newImageInfoMap[imageId];
                    if (imageInfo) {
                      const previewData: ImagePreviewData = {
                        type: "existing",
                        id: imageInfo.imageId,
                        previewUrl: imageInfo.imageUrl,
                      };
                      if (!updatedPlatformImages[platform]) {
                        updatedPlatformImages[platform] = [];
                      }
                      updatedPlatformImages[platform].push(previewData);
                    }
                  });
                }
              });
              setPlatformImages(updatedPlatformImages); // 更新
            }
          }

          editData.forEach((p) => {
            const platform = Array.isArray(p.platforms)
              ? p.platforms[0]
              : p.platforms;
            if (platform) {
              // プラットフォームごとの投稿内容を設定
              newPlatformContent[platform] = p.content || "";
              if (!newSelectedPlatforms.includes(platform)) {
                newSelectedPlatforms.push(platform);
              }

              // プラットフォームごとのスケジュールを設定
              if (p.scheduleTime) {
                const scheduleDate = new Date(p.scheduleTime);
                // Convert to JST for display
                const jstDate = new Date(scheduleDate.getTime());
                newPlatformSchedules[platform] = {
                  date: jstDate.toISOString().split("T")[0],
                  time: jstDate.toTimeString().slice(0, 5),
                  enabled: true,
                };
              }

              // 画像IDを設定
              if (p.imageIds) {
                newImageIds.push(...p.imageIds.filter((id) => id.trim()));
              }
            }
          });

          setPlatformContent(newPlatformContent);
          setSelectedPlatforms(newSelectedPlatforms);
          setPlatformSchedules(newPlatformSchedules);
        }
      } else {
        // 新規投稿時の初期化
        addLogEntry("INFO", "Initializing form for new post");
        setContent("");
        setSelectedPlatforms([]);
        setIsScheduled(false);
        setPlatformContent({});
        setScheduleDate("");
        setScheduleTime("");
        setImagePreviews([]); // ImagePreviewData[] を期待
        setImageIds([]);
        setImageInfoMap({});
      }
    };

    initializeForm();
  }, [post, initialData, isEditing]);

  // AI 設定の読み込みは、コンポーネントのマウント時に一度だけ実行する
  React.useEffect(() => {
    let isMounted = true;

    const loadAiSettings = async () => {
      try {
        setLoadingAiSettings(true);
        const settings = await getUserSettings();

        if (!isMounted) return; // コンポーネントがアンマウントされている場合は処理を中断

        setAiSettings(settings);

        const isConfigured = !!(
          settings?.ai_service &&
          settings?.ai_model &&
          settings?.ai_api_token &&
          settings?.ai_connection_status
        );
        setAiConfigured(isConfigured);

        addLogEntry("INFO", "AI settings loaded in PostForm", {
          isConfigured,
          componentId: "PostForm",
        });
      } catch (error) {
        if (isMounted) {
          addLogEntry("ERROR", "Failed to load AI settings in PostForm", error);
          setAiConfigured(false);
        }
      } finally {
        if (isMounted) {
          setLoadingAiSettings(false);
        }
      }
    };

    loadAiSettings();

    return () => {
      isMounted = false;
    };
  }, []); // 依存配列が空なので、初回マウント時のみ実行される

  const handleImageSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      // setSelectedImages((prev) => [...prev, ...files]); // この行は削除

      const newImagePreviewDataToAdd: ImagePreviewData[] = [];
      // 既存のプレビューのユニークな識別子を Set に収集
      // ここでは id: file.name だけでなく、file.name + file.size も考慮に入れることで
      // ユーザーが同じファイル（内容が同じ）を複数回選択した際に、ブラウザが異なるFileオブジェクトとして
      // 提供しても、論理的な重複を検出できるようにする
      const existingFileIdentifiers = new Set<string>();
      imagePreviews.forEach((p) => {
        if (p.type === "new" && p.originalFile) {
          existingFileIdentifiers.add(
            `${p.originalFile.name}-${p.originalFile.size}`,
          );
        } else {
          existingFileIdentifiers.add(p.id); // 既存画像はIDで管理
        }
      });

      for (const file of files) {
        // 新しいファイルのユニークな識別子を生成
        const newFileIdentifier = `${file.name}-${file.size}`;

        // 論理的な重複をチェック
        if (!existingFileIdentifiers.has(newFileIdentifier)) {
          existingFileIdentifiers.add(newFileIdentifier); // 新しい識別子をセットに追加

          const reader = new FileReader();
          reader.onload = (e) => {
            setImagePreviews((prev) => [
              ...prev,
              {
                // ImagePreviewData形式で追加
                type: "new",
                id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`, // 真にユニークなIDを生成
                previewUrl: e.target?.result as string,
                originalFile: file,
              },
            ]);
          };
          reader.readAsDataURL(file);
        } else {
          addLogEntry(
            "WARN",
            "Skipping adding duplicate image preview to state (detected by name+size)",
            {
              fileName: file.name,
              fileSize: file.size,
            },
          );
        }
      }
    }
  };

  const removeImage = (index: number) => {
    const imageToRemove = imagePreviews[index];

    // platformImages からも該当画像を削除
    setPlatformImages((prev) => {
      const newPlatformImages: Record<string, ImagePreviewData[]> = {};
      for (const platform in prev) {
        newPlatformImages[platform] = prev[platform].filter(
          (item) => item.id !== imageToRemove.id,
        );
      }
      return newPlatformImages;
    });

    setImagePreviews((prev) => prev.filter((_, i) => i !== index));

    // 既存画像の場合、imageIds と imageInfoMap からも削除する必要があるが、
    // 現状はプレビューとplatformImagesから削除するのみに留める
    if (imageToRemove.type === "existing") {
      setImageIds((prev) => prev.filter((id) => id !== imageToRemove.id));
      setImageInfoMap((prev) => {
        const newMap = { ...prev };
        delete newMap[imageToRemove.id];
        return newMap;
      });
    }
  };

  const toggleImageForPlatform = (previewIndex: number, platform: string) => {
    setPlatformImages((prev) => {
      const current = prev[platform] || [];
      const previewItem = imagePreviews[previewIndex];

      // current配列に既に存在するかどうかをチェック
      const exists = current.some((item) => item.id === previewItem.id);

      if (exists) {
        // 選択解除
        return {
          ...prev,
          [platform]: current.filter((item) => item.id !== previewItem.id),
        };
      } else {
        // 選択
        return {
          ...prev,
          [platform]: [...current, previewItem], // プレビューアイテムをそのまま格納
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
    if (!aiInstruction || !aiPrompt || selectedPlatforms.length === 0) {
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
        aiPrompt,
        aiInstruction,
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
    setIsSubmitting(true);

    try {
      // 下書き保存時は文字数検証をスキップ、確定・投稿時は検証を実行
      if (!isDraft && !validatePlatformContents()) {
        toast({
          title: "文字数制限エラー",
          description:
            "一部のプラットフォームで文字数制限を超えています。内容を修正してください。",
          variant: "destructive",
        });
        return;
      }

      // ========== 画像アップロード処理を一元化ここから ==========
      const newImageIds: string[] = [];
      const allNewFilesToUpload: File[] = [];
      const uploadedFileKeys = new Set<string>(); // ファイル名とファイルサイズを組み合わせた文字列をキーとして重複を管理

      addLogEntry(
        "DEBUG",
        "Collecting all new files to upload across platforms",
        {
          selectedPlatforms: selectedPlatforms,
          initialImagePreviewsCount: imagePreviews.length,
          initialPlatformImageState: Object.keys(platformImages).reduce(
            (acc: any, platform) => {
              acc[platform] = (platformImages[platform] || []).map((p) => ({
                id: p.id,
                type: p.type,
              }));
              return acc;
            },
            {},
          ), // デバッグ用に現在の platformImages の状態も見る
        },
      );

      // 全てのプラットフォームで選択された新規画像を収集し、重複を除去
      selectedPlatforms.forEach((platform) => {
        const platformSelectedImages = platformImages[platform] || [];
        platformSelectedImages.forEach((previewData) => {
          if (previewData.type === "new" && previewData.originalFile) {
            const file = previewData.originalFile;
            const fileKey = `${file.name}-${file.size}`;

            if (!uploadedFileKeys.has(fileKey)) {
              uploadedFileKeys.add(fileKey);
              allNewFilesToUpload.push(file);
            } else {
              addLogEntry(
                "DEBUG",
                "Skipping duplicate file for upload (deduplicated by name+size)",
                {
                  fileName: file.name,
                  fileSize: file.size,
                  platform: platform,
                  previewDataId: previewData.id, // ImagePreviewDataのIDもログに出す
                },
              );
            }
          }
        });
      });

      addLogEntry("DEBUG", "Final list of unique files to upload", {
        allNewFilesToUploadCount: allNewFilesToUpload.length,
        allNewFilesToUploadNames: allNewFilesToUpload.map((f) => f.name),
        allNewFilesToUploadDetails: allNewFilesToUpload.map((f) => ({
          name: f.name,
          size: f.size,
          type: f.type,
        })),
      });

      if (allNewFilesToUpload.length > 0) {
        for (const file of allNewFilesToUpload) {
          addLogEntry("DEBUG", "Attempting to upload file", {
            fileName: file.name,
            fileSize: file.size,
          });
          const uploadResult = await uploadImageAndGenerateId(file); // ここでアップロード
          if (uploadResult.success) {
            newImageIds.push(uploadResult.imageId);
            addLogEntry("INFO", "Selected new image uploaded", {
              fileName: file.name,
              imageId: uploadResult.imageId,
            });
          }
        }
      } else {
        addLogEntry("INFO", "No new images selected for upload", {
          totalNewImages: allNewFilesToUpload.length,
          selectedNewImagesForUpload: allNewFilesToUpload.length,
        });
      }

      // 既存の画像IDと、今回アップロードされた新規画像のIDを統合
      const selectedExistingImageIds: string[] = [];
      selectedPlatforms.forEach((platform) => {
        const platformSelectedImages = platformImages[platform] || [];
        platformSelectedImages.forEach((previewData) => {
          if (previewData.type === "existing" && previewData.id) {
            selectedExistingImageIds.push(previewData.id);
          }
        });
      });
      const uniqueSelectedExistingImageIds = [
        ...new Set(selectedExistingImageIds),
      ];

      const allImageIds = [...uniqueSelectedExistingImageIds, ...newImageIds];

      // 編集時の画像ID管理を改善
      addLogEntry("INFO", "Image ID management for submission", {
        existingImageIdsFromState: imageIds, // 初期状態のimageIds
        selectedExistingImageIds: uniqueSelectedExistingImageIds, // 今回選択された既存画像ID
        newUploadedImageIds: newImageIds, // 今回アップロードされた新規画像のID
        finalAllImageIds: allImageIds, // 最終的に投稿に紐づく画像ID
        isEditing: isEditing,
        selectedPlatforms: selectedPlatforms,
      });
      // ========== 画像アップロード処理を一元化ここまで ==========

      // Generate a single base ID for all platforms
      const baseId = isEditing
        ? post?.[0]?.id?.split("_")[0] || Date.now().toString()
        : Date.now().toString();

      addLogEntry("INFO", "Starting form submission", {
        baseId,
        isEditing,
        selectedPlatforms,
        originalId: isEditing ? post?.[0]?.id : undefined,
        allImageIdsForDebug: allImageIds,
        newlyUploadedImageIdsForDebug: newImageIds,
        selectedExistingImageIdsForDebug: uniqueSelectedExistingImageIds,
      });

      // 変更: 編集時も新規登録時と同様に、各プラットフォームごとにデータを保存
      for (const platform of selectedPlatforms) {
        let scheduledDateTime: Date | undefined;
        const platformSchedule = platformSchedules[platform];

        if (
          platformSchedule?.enabled &&
          platformSchedule.date &&
          platformSchedule.time
        ) {
          // Create date in JST timezone directly
          scheduledDateTime = new Date(
            `${platformSchedule.date}T${platformSchedule.time}:00`,
          );
        } else if (isScheduled && scheduleDate && scheduleTime) {
          // Create date in JST timezone directly
          scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}:00`);
        }

        // images は空の配列を渡すように変更
        const platformImagesForSubmission: File[] = [];

        addLogEntry(
          "DEBUG",
          "platformImagesForSubmission content before addPostToGoogleSheet",
          {
            platform,
            imageCount: platformImagesForSubmission.length, // ここは常に0になる
            imageNames: platformImagesForSubmission.map((f) => f.name),
            imageDetails: platformImagesForSubmission.map((f) => ({
              name: f.name,
              size: f.size,
              type: f.type,
            })),
          },
        );

        const postData: PostData = {
          content: platformContent[platform] || content,
          platforms: [platform], // Single platform per post
          channels: [platform],
          isScheduled: platformSchedule?.enabled || isScheduled,
          scheduleTime: scheduledDateTime,
          images: platformImagesForSubmission, // images は空配列を渡す
          platformContent, // 全プラットフォームの内容を送信
          platformImages: undefined, // DB保存時には使用しない想定
          platformSchedules,
          imageIds: allImageIds, // すべての画像IDを渡す
          status: isDraft ? "draft" : "pending",
          id: `${baseId}_${platform}`, // IDにプラットフォームサフィックスを付与
        };

        addLogEntry(
          "INFO",
          "Post data created with image IDs for platform submission",
          {
            platform,
            postId: postData.id,
            imageIds: postData.imageIds,
            imageCount: postData.imageIds?.length || 0,
            isEditing: isEditing,
            postDataImageIdsDetails: postData.imageIds,
          },
        );

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
    } catch (error) {
      console.error("Form submission error:", error);
      addLogEntry("ERROR", "Form submission failed", error);
      toast({
        title: "投稿エラー",
        description: "投稿の処理中にエラーが発生しました",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🔹 JSX外（コンポーネント先頭）に関数定義
  const convertDriveUrl = (url: string) => {
    // 新規投稿時はローカルURLをそのまま使用
    if (url.startsWith("data:")) {
      return url;
    }
    // Google DriveのファイルIDを抽出して公開URL形式に変換
    // https://drive.google.com/file/d/{FILE_ID}/view → https://lh3.googleusercontent.com/d/{FILE_ID}
    const match = url.match(/[-\w]{25,}/);
    return match ? `https://lh3.googleusercontent.com/d/${match[0]}` : url;
  };

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
                  selectedPlatforms.forEach((platform) => {
                    newPlatformContent[platform] = content;
                  });
                  setPlatformContent(newPlatformContent);
                  toast({
                    title: "転記完了",
                    description:
                      "投稿内容をプラットフォーム別設定に転記しました",
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
                  <Label className="text-base font-medium">
                    3. AIアシスタント（オプション）
                  </Label>
                  <div className="text-sm text-muted-foreground">
                    {aiConfigured
                      ? "AI生成する場合は、ベース投稿内容・キーワードとAI への指示を入力して、プラットフォーム別生成ボタンを押してください。"
                      : "AI設定が未設定のため利用できません"}
                  </div>
                </div>

                {aiConfigured ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="ai-base-content">
                        ベース投稿内容・キーワード
                      </Label>
                      <div className="text-sm text-muted-foreground mb-2">
                        AIが生成する際の基となる内容やキーワードを入力してください。
                      </div>
                      <Textarea
                        id="ai-base-content"
                        placeholder="例：新商品の紹介、イベント告知、キーワードなど..."
                        className="min-h-[100px]"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ai-instruction">AI への指示</Label>
                      <div className="text-sm text-muted-foreground mb-2">
                        各プラットフォームに合わせてどのように最適化するか指示してください。
                      </div>
                      <Input
                        id="ai-instruction"
                        placeholder="例：カジュアルに、ビジネス向けに、絵文字を使って、詳しく説明して"
                        value={aiInstruction}
                        onChange={(e) => setAiInstruction(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Button
                        type="button"
                        onClick={generateAIDraft}
                        disabled={
                          isGeneratingDraft ||
                          !aiPrompt ||
                          !aiInstruction ||
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
                      <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-200">
                        ※ボタンを押下すると、プラットフォーム別設定の投稿内容が上書きされるので、下書き等書き込んでいる場合は、別場所に保存するなどしてください。
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
                    <p className="text-sm text-muted-foreground text-center">
                      AI設定を完了すると利用可能になります
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* 4. Select Images */}
            <div className="space-y-2">
              <Label htmlFor="manual-image-select">
                4. 投稿したい画像を選択
              </Label>
              <div className="text-sm text-muted-foreground mb-2">
                投稿に使用する画像を選択してください。
                <br />
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
                {imagePreviews.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    {imagePreviews.length}枚選択済み
                  </div>
                )}
              </div>
              {imagePreviews.length > 0 && (
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {imagePreviews.map(
                    (
                      previewData,
                      index, // previewData を使用
                    ) => (
                      <div key={previewData.id} className="relative">
                        {" "}
                        {/* key を previewData.id に変更 */}
                        <img
                          src={convertDriveUrl(previewData.previewUrl)} // previewData.previewUrl を使用
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
                    ),
                  )}
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
                    投稿内容の下書きを清書してください。プラットフォーム毎に送信タイミングを分けたい場合は、個別スケジュール設定をONにして設定してください。
                    <br />
                    ※個別スケジュールを設定しない場合は、スケジュール投稿の設定になります。
                  </div>
                </div>
                {selectedPlatforms.map((platform) => {
                  const validation =
                    platformValidations[
                      platform as keyof typeof platformValidations
                    ];
                  const platformContentValue = platformContent[platform] || "";
                  const platformSchedule = platformSchedules[platform] || {
                    date: "",
                    time: "",
                    enabled: false,
                  };
                  const hasError =
                    validationErrors[platform] &&
                    validationErrors[platform].length > 0;

                  return (
                    <Card
                      key={platform}
                      className={`p-4 ${hasError ? "border-red-300 bg-red-50" : ""}`}
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <Badge variant={hasError ? "destructive" : "outline"}>
                            {validation?.name || platform}
                          </Badge>
                          <span
                            className={`text-xs ${hasError ? "text-red-600 font-medium" : "text-muted-foreground"}`}
                          >
                            {platformContentValue.length}/
                            {validation?.maxLength || "∞"} 文字
                            {hasError && (
                              <span className="ml-2 text-red-600">
                                (制限超過)
                              </span>
                            )}
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
                            className={`min-h-[100px] ${hasError ? "border-red-300 focus:border-red-500" : ""}`}
                          />
                          {hasError && (
                            <div className="text-sm text-red-600">
                              {validationErrors[platform].map(
                                (error, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center gap-1"
                                  >
                                    <AlertTriangle size={14} />
                                    {error}
                                  </div>
                                ),
                              )}
                            </div>
                          )}
                        </div>

                        {/* Image selection for platform */}
                        {imagePreviews.length > 0 && (
                          <div className="space-y-2">
                            <Label>使用する画像</Label>
                            <div className="grid grid-cols-4 gap-2">
                              {imagePreviews.map((previewData, index) => {
                                // previewData を使用
                                const isNewImage = previewData.type === "new";
                                // platformImages[platform] に previewData.id (新規はファイル名、既存は画像ID) が含まれているかで判定
                                const isSelected =
                                  platformImages[platform]?.some(
                                    (item) => item.id === previewData.id,
                                  ) || false;

                                return (
                                  <div
                                    key={previewData.id}
                                    className="relative"
                                  >
                                    {" "}
                                    {/* key を previewData.id に変更 */}
                                    <img
                                      src={convertDriveUrl(
                                        previewData.previewUrl,
                                      )} // previewData.previewUrl を使用
                                      alt={`Image ${index + 1}`}
                                      className={`w-full h-16 object-cover rounded-md cursor-pointer border-2 ${
                                        isSelected
                                          ? "border-primary"
                                          : "border-gray-200"
                                      }`}
                                      onClick={() => {
                                        toggleImageForPlatform(index, platform);
                                      }}
                                    />
                                    {isSelected && (
                                      <div className="absolute top-1 right-1 bg-primary text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">
                                        ✓
                                      </div>
                                    )}
                                    {previewData.type === "existing" && ( // 既存画像の場合
                                      <div className="absolute bottom-1 left-1 bg-blue-500 text-white rounded px-1 text-xs">
                                        既存
                                      </div>
                                    )}
                                    {isNewImage &&
                                      !isSelected && ( // 新規画像で未選択の場合
                                        <div className="absolute bottom-1 right-1 bg-gray-500 text-white rounded px-1 text-xs">
                                          未選択
                                        </div>
                                      )}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              ※既存画像は自動的に選択されています。新規アップロード画像はクリックして選択してください。チェックが付いていない画像は保存されません。
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
                                <select
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                  value={platformSchedule.time}
                                  onChange={(e) =>
                                    updatePlatformSchedule(
                                      platform,
                                      "time",
                                      e.target.value,
                                    )
                                  }
                                >
                                  <option value="">時刻を選択</option>
                                  {(() => {
                                    const options = [];
                                    for (let hour = 0; hour < 24; hour++) {
                                      for (
                                        let minute = 0;
                                        minute < 60;
                                        minute += 15
                                      ) {
                                        const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
                                        options.push(
                                          <option key={time} value={time}>
                                            {time}
                                          </option>,
                                        );
                                      }
                                    }
                                    return options;
                                  })()}
                                </select>
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
          </div>
        </div>

        {/* Validation Alerts */}
        {hasValidationErrors && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <h4 className="font-semibold mb-1">文字数制限エラー</h4>
              <p className="text-sm mb-2">
                以下のプラットフォームで文字数制限を超えています。内容を修正してから投稿してください。
              </p>
              {Object.entries(validationErrors).map(([platform, errors]) => {
                const platformInfo = {
                  x: "X (Twitter)",
                  instagram: "Instagram",
                  facebook: "Facebook",
                  line: "LINE",
                  discord: "Discord",
                  wordpress: "WordPress",
                };
                const platformName =
                  platformInfo[platform as keyof typeof platformInfo] ||
                  platform;

                return (
                  <div
                    key={platform}
                    className="mb-2 p-2 bg-red-100 rounded border border-red-200"
                  >
                    <span className="font-medium text-red-800">
                      {platformName}
                    </span>
                    <ul className="list-disc list-inside ml-2 mt-1">
                      {errors.map((error, index) => (
                        <li key={index} className="text-sm text-red-700">
                          {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        {/* Form Action Buttons */}
        <div className="flex justify-end space-x-2 p-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button
            type="button"
            onClick={() => handleFormSubmit(true)}
            variant="secondary"
            disabled={
              selectedPlatforms.length === 0 ||
              isGeneratingDraft ||
              isSubmitting
            }
          >
            {isSubmitting ? (
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
                処理中...
              </>
            ) : (
              "下書き保存"
            )}
          </Button>
          <Button
            type="button"
            onClick={() => handleFormSubmit(false)}
            disabled={
              selectedPlatforms.length === 0 ||
              isGeneratingDraft ||
              hasValidationErrors ||
              isSubmitting
            }
          >
            {isSubmitting ? (
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
                処理中...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                {isEditing ? "投稿を更新" : "確定"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PostForm;
