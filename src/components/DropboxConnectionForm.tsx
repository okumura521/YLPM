import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { initiateDropboxAuth } from "@/lib/supabase";

interface DropboxConnectionFormProps {
  onConnectionSuccess?: () => void;
}

const DropboxConnectionForm: React.FC<DropboxConnectionFormProps> = ({
  onConnectionSuccess,
}) => {
  const [folderName, setFolderName] = useState("YLPM Images");
  const [connecting, setConnecting] = useState(false);
  const { toast } = useToast();

  const handleConnect = async () => {
    if (!folderName.trim()) {
      toast({
        title: "入力エラー",
        description: "保存フォルダ名を入力してください",
        variant: "destructive",
      });
      return;
    }

    setConnecting(true);
    try {
      await initiateDropboxAuth(folderName.trim());
      toast({
        title: "Dropbox連携完了",
        description: "Dropboxとの連携が完了しました",
      });
      onConnectionSuccess?.();
    } catch (error) {
      console.error("Dropbox connection failed:", error);
      toast({
        title: "連携エラー",
        description: error instanceof Error ? error.message : "Dropbox連携に失敗しました",
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="folder-name">保存フォルダ名</Label>
        <Input
          id="folder-name"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          placeholder="例: YLPM Images"
        />
        <p className="text-xs text-muted-foreground">
          Dropboxに作成される画像保存用フォルダの名前を入力してください
        </p>
      </div>
      <Button
        onClick={handleConnect}
        disabled={connecting || !folderName.trim()}
        className="w-full"
      >
        {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Dropboxと連携
      </Button>
    </div>
  );
};

export default DropboxConnectionForm;