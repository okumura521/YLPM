import React from "react";
import { Check, Info } from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

export interface Platform {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  characterLimit?: number;
  fileTypes?: string[];
}

export interface PlatformSelectorProps {
  platforms?: Platform[];
  selectedPlatforms?: string[];
  onChange?: (selectedPlatforms: string[]) => void;
  disabled?: boolean;
}

const defaultPlatforms: Platform[] = [
  {
    id: "x",
    name: "X (Twitter)",
    icon: <span className="text-lg">𝕏</span>,
    color: "bg-black",
    description: "Short messages with images or videos",
    characterLimit: 280,
    fileTypes: ["jpg", "png", "gif", "mp4"],
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: <span className="text-lg">📸</span>,
    color: "bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500",
    description: "Visual content with captions",
    characterLimit: 2200,
    fileTypes: ["jpg", "png", "mp4"],
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: <span className="text-lg">📘</span>,
    color: "bg-blue-600",
    description: "Posts with text, images, videos, and links",
    characterLimit: 63206,
    fileTypes: ["jpg", "png", "gif", "mp4", "pdf"],
  },
  {
    id: "line",
    name: "LINE",
    icon: <span className="text-lg">💬</span>,
    color: "bg-green-500",
    description: "Messaging platform popular in Japan",
    characterLimit: 1000,
    fileTypes: ["jpg", "png", "gif"],
  },
  {
    id: "discord",
    name: "Discord",
    icon: <span className="text-lg">🎮</span>,
    color: "bg-indigo-600",
    description: "Community messaging platform",
    characterLimit: 2000,
    fileTypes: ["jpg", "png", "gif", "mp4"],
  },
  {
    id: "wordpress",
    name: "WordPress",
    icon: <span className="text-lg">📝</span>,
    color: "bg-blue-800",
    description: "Blog posts and articles",
    characterLimit: null,
    fileTypes: ["jpg", "png", "gif", "mp4", "pdf", "doc", "docx"],
  },
];

const PlatformSelector: React.FC<PlatformSelectorProps> = ({
  platforms = defaultPlatforms,
  selectedPlatforms = [],
  onChange,
  disabled = false,
}) => {
  const handleTogglePlatform = (platformId: string) => {
    if (disabled) return;

    const newSelectedPlatforms = selectedPlatforms.includes(platformId)
      ? selectedPlatforms.filter((id) => id !== platformId)
      : [...selectedPlatforms, platformId];

    onChange?.(newSelectedPlatforms);
  };

  return (
    <div className="bg-white rounded-lg p-4 w-full">
      <h3 className="text-lg font-medium mb-3">Select Target Platforms</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {platforms.map((platform) => {
          const isSelected = selectedPlatforms.includes(platform.id);

          return (
            <TooltipProvider key={platform.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "relative flex flex-col items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-gray-200 hover:border-gray-300",
                      disabled && "opacity-60 cursor-not-allowed",
                    )}
                    onClick={() => handleTogglePlatform(platform.id)}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <Check className="h-4 w-4 text-primary" />
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
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div>
                    <p className="font-medium">{platform.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {platform.description}
                    </p>
                    {platform.characterLimit && (
                      <p className="text-xs mt-1">
                        Character limit: {platform.characterLimit}
                      </p>
                    )}
                    {platform.fileTypes && platform.fileTypes.length > 0 && (
                      <p className="text-xs mt-1">
                        Supported files: {platform.fileTypes.join(", ")}
                      </p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
