import React from "react";
import { Check, Info, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface Platform {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  characterLimit?: number;
  fileTypes?: string[];
  maxImages?: number | null;
  requiresDropbox?: boolean;
}

export interface PlatformSelectorProps {
  platforms?: Platform[];
  selectedPlatforms?: string[];
  onChange?: (selectedPlatforms: string[]) => void;
  onSelectionChange?: (selectedPlatforms: string[]) => void;
  disabled?: boolean;
  dropboxConnected?: boolean;
}

const defaultPlatforms: Platform[] = [
  {
    id: "x",
    name: "X (Twitter)",
    icon: <span className="text-lg">𝕏</span>,
    color: "bg-black",
    description: "Short messages with images or videos (最大4枚)",
    characterLimit: 280,
    fileTypes: ["jpg", "png", "gif", "mp4"],
    maxImages: 4,
    requiresDropbox: false,
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: <span className="text-lg">📸</span>,
    color: "bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500",
    description: "Visual content with captions (最大10枚) ※Dropbox連携必須",
    characterLimit: 2200,
    fileTypes: ["jpg", "png", "mp4"],
    maxImages: 10,
    requiresDropbox: true,
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: <span className="text-lg">📘</span>,
    color: "bg-blue-600",
    description: "Posts with text, images, videos, and links (制限なし)",
    characterLimit: 63206,
    fileTypes: ["jpg", "png", "gif", "mp4", "pdf"],
    maxImages: null,
    requiresDropbox: false,
  },
  {
    id: "line",
    name: "LINE",
    icon: <span className="text-lg">💬</span>,
    color: "bg-green-500",
    description: "Messaging platform popular in Japan (最大20枚)",
    characterLimit: 1000,
    fileTypes: ["jpg", "png", "gif"],
    maxImages: 20,
    requiresDropbox: false,
  },
  {
    id: "discord",
    name: "Discord",
    icon: <span className="text-lg">🎮</span>,
    color: "bg-indigo-600",
    description: "Community messaging platform (最大10枚)",
    characterLimit: 2000,
    fileTypes: ["jpg", "png", "gif", "mp4"],
    maxImages: 10,
    requiresDropbox: false,
  },
  {
    id: "wordpress",
    name: "WordPress",
    icon: <span className="text-lg">📝</span>,
    color: "bg-blue-800",
    description: "Blog posts and articles (制限なし)",
    characterLimit: null,
    fileTypes: ["jpg", "png", "gif", "mp4", "pdf", "doc", "docx"],
    maxImages: null,
    requiresDropbox: false,
  },
];

const PlatformSelector: React.FC<PlatformSelectorProps> = ({
  platforms = defaultPlatforms,
  selectedPlatforms = [],
  onChange,
  onSelectionChange,
  disabled = false,
  dropboxConnected = false,
}) => {
  const handleTogglePlatform = (platformId: string) => {
    if (disabled) return;

    const platform = platforms.find(p => p.id === platformId);
    
    if (platform?.requiresDropbox && !dropboxConnected && !selectedPlatforms.includes(platformId)) {
      return;
    }

    const newSelectedPlatforms = selectedPlatforms.includes(platformId)
      ? selectedPlatforms.filter((id) => id !== platformId)
      : [...selectedPlatforms, platformId];

    onChange?.(newSelectedPlatforms);
    onSelectionChange?.(newSelectedPlatforms);
  };

  return (
    <div className="bg-white rounded-lg p-4 w-full">
      <h3 className="text-lg font-medium mb-3">Select Target Platforms</h3>
      
      {!dropboxConnected && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Instagramに投稿する場合はDropbox設定が必要です。Google Sheets作成・管理ページでDropbox連携を完了してください。
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {platforms.map((platform) => {
          const isSelected = selectedPlatforms.includes(platform.id);
          const isDisabledPlatform = platform.requiresDropbox && !dropboxConnected;

          return (
            <motion.div
              key={platform.id}
              whileHover={{ scale: isDisabledPlatform ? 1 : 1.03 }}
              whileTap={{ scale: isDisabledPlatform ? 1 : 0.98 }}
              className={cn(
                "relative flex flex-col items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all",
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-gray-200 hover:border-gray-300",
                (disabled || isDisabledPlatform) && "opacity-60 cursor-not-allowed",
              )}
              onClick={() => handleTogglePlatform(platform.id)}
            >
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <Check className="h-4 w-4 text-primary" />
                </div>
              )}
              {isDisabledPlatform && (
                <div className="absolute top-2 left-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </div>
              )}
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center mb-2",
                  platform.color,
                )}
              >
                {platform.icon}
              </div>
              <span className="text-sm font-medium">{platform.name}</span>
              {platform.characterLimit && (
                <Badge variant="outline" className="mt-1 text-xs">
                  {platform.characterLimit} chars
                </Badge>
              )}
              {isDisabledPlatform && (
                <Badge variant="destructive" className="mt-1 text-xs">
                  Dropbox必須
                </Badge>
              )}
            </motion.div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center text-sm text-muted-foreground">
        <Info className="h-4 w-4 mr-1" />
        <span>Select the platforms where you want to publish your content</span>
      </div>
    </div>
  );
};

export default PlatformSelector;