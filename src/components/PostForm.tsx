import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { Calendar, Clock, Send, Sparkles } from "lucide-react";

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
  isEditing?: boolean;
}

interface PostData {
  id?: string;
  content: string;
  scheduleTime?: Date;
  platforms: string[];
  isScheduled: boolean;
}

const PostForm: React.FC<PostFormProps> = ({
  initialData = {
    content: "",
    platforms: [],
    isScheduled: false,
  },
  onSubmit = () => {},
  isEditing = false,
}) => {
  const [activeTab, setActiveTab] = useState<string>("manual");
  const [content, setContent] = useState<string>(initialData.content);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    initialData.platforms,
  );
  const [isScheduled, setIsScheduled] = useState<boolean>(
    initialData.isScheduled,
  );
  const [scheduleDate, setScheduleDate] = useState<string>("");
  const [scheduleTime, setScheduleTime] = useState<string>("");
  const [isGeneratingDraft, setIsGeneratingDraft] = useState<boolean>(false);
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
    X: { maxLength: 280 },
    Instagram: { maxLength: 2200 },
    Facebook: { maxLength: 63206 },
    LINE: { maxLength: 1000 },
    Discord: { maxLength: 2000 },
    WordPress: { maxLength: 100000 },
  };

  const validateContent = () => {
    const errors: Record<string, string[]> = {};

    selectedPlatforms.forEach((platform) => {
      const validation =
        platformValidations[platform as keyof typeof platformValidations];
      if (validation && content.length > validation.maxLength) {
        if (!errors[platform]) errors[platform] = [];
        errors[platform].push(
          `Content exceeds maximum length of ${validation.maxLength} characters`,
        );
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const generateAIDraft = async () => {
    setIsGeneratingDraft(true);
    // Simulate AI draft generation
    setTimeout(() => {
      setContent(
        "This is an AI-generated draft for your social media post. You can edit this text to customize it for your needs.",
      );
      setIsGeneratingDraft(false);
    }, 1500);
  };

  const handleFormSubmit = () => {
    if (!validateContent()) return;

    let scheduledDateTime: Date | undefined;
    if (isScheduled && scheduleDate && scheduleTime) {
      scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
    }

    const postData: PostData = {
      content,
      platforms: selectedPlatforms,
      isScheduled,
      scheduleTime: scheduledDateTime,
    };

    if (initialData.id) {
      postData.id = initialData.id;
    }

    onSubmit(postData);
  };

  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  return (
    <Card className="w-full max-w-4xl mx-auto bg-white">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">
          {isEditing ? "Edit Post" : "Create New Post"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <div className="space-y-6">
            <Tabs
              defaultValue="manual"
              value={activeTab}
              onValueChange={setActiveTab}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                <TabsTrigger value="ai">AI Assistance</TabsTrigger>
              </TabsList>
              <TabsContent value="manual" className="pt-4">
                <div className="space-y-2">
                  <Label htmlFor="content">Post Content</Label>
                  <Textarea
                    id="content"
                    placeholder="Enter your post content here..."
                    className="min-h-[200px]"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>
              </TabsContent>
              <TabsContent value="ai" className="pt-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="ai-prompt">AI Prompt</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateAIDraft}
                      disabled={isGeneratingDraft}
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
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} className="mr-2" />
                          Generate Draft
                        </>
                      )}
                    </Button>
                  </div>
                  <Input
                    id="ai-prompt"
                    placeholder="Describe what you want to post about..."
                    disabled={isGeneratingDraft}
                  />
                  <div className="space-y-2">
                    <Label htmlFor="ai-content">Generated Content</Label>
                    <Textarea
                      id="ai-content"
                      placeholder="AI-generated content will appear here..."
                      className="min-h-[200px]"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      disabled={isGeneratingDraft}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">
                  Target Platforms
                </Label>
                <PlatformSelector
                  selectedPlatforms={selectedPlatforms}
                  onSelectionChange={setSelectedPlatforms}
                />
              </div>

              {selectedPlatforms.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedPlatforms.map((platform) => (
                    <TooltipProvider key={platform}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant={
                              validationErrors[platform]
                                ? "destructive"
                                : "default"
                            }
                            className="cursor-default"
                          >
                            {platform}
                          </Badge>
                        </TooltipTrigger>
                        {validationErrors[platform] && (
                          <TooltipContent>
                            <ul className="list-disc pl-4">
                              {validationErrors[platform].map((error, i) => (
                                <li key={i}>{error}</li>
                              ))}
                            </ul>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Switch
                  id="schedule"
                  checked={isScheduled}
                  onCheckedChange={setIsScheduled}
                />
                <Label htmlFor="schedule">Schedule for later</Label>
              </div>

              {isScheduled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
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
                    <Label htmlFor="time">Time</Label>
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

            {hasValidationErrors && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>
                  Please fix the validation errors before submitting.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-6">
        <Button variant="outline" type="button">
          Cancel
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
          {isScheduled ? "Schedule Post" : "Post Now"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default PostForm;
