import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { MoreHorizontal, Edit, Trash2, RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Post {
  id: string;
  content: string;
  scheduleTime: string;
  platforms: string[];
  status: "pending" | "sent" | "failed" | "draft";
  updatedAt: string;
}

interface PostTableProps {
  posts?: Post[];
  onEdit?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onRefresh?: (postId: string) => void;
}

const PostTable: React.FC<PostTableProps> = ({
  posts = defaultPosts,
  onEdit = () => {},
  onDelete = () => {},
  onRefresh = () => {},
}) => {
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Post;
    direction: "ascending" | "descending";
  } | null>(null);

  const handleSort = (key: keyof Post) => {
    let direction: "ascending" | "descending" = "ascending";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    ) {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const sortedPosts = React.useMemo(() => {
    const postsCopy = [...posts];
    if (sortConfig !== null) {
      postsCopy.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
        return 0;
      });
    }
    return postsCopy;
  }, [posts, sortConfig]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPosts(posts.map((post) => post.id));
    } else {
      setSelectedPosts([]);
    }
  };

  const handleSelectPost = (postId: string, checked: boolean) => {
    if (checked) {
      setSelectedPosts([...selectedPosts, postId]);
    } else {
      setSelectedPosts(selectedPosts.filter((id) => id !== postId));
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "sent":
        return "secondary";
      case "failed":
        return "destructive";
      case "draft":
        return "outline";
      default:
        return "default";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "予定";
      case "sent":
        return "送信済";
      case "failed":
        return "失敗";
      case "draft":
        return "下書き";
      default:
        return status;
    }
  };

  return (
    <Card className="w-full bg-white">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>投稿一覧</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => console.log("Filter clicked")}
            >
              フィルター
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      selectedPosts.length === posts.length && posts.length > 0
                    }
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  />
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("content")}
                >
                  投稿内容
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("scheduleTime")}
                >
                  予定時刻
                </TableHead>
                <TableHead>プラットフォーム</TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("status")}
                >
                  ステータス
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("updatedAt")}
                >
                  最終更新
                </TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPosts.length > 0 ? (
                sortedPosts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedPosts.includes(post.id)}
                        onCheckedChange={(checked) =>
                          handleSelectPost(post.id, !!checked)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="truncate max-w-[200px]">
                        {post.content}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(post.scheduleTime).toLocaleString("ja-JP", {
                        timeZone: "Asia/Tokyo",
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(post.platforms || []).map((platform) => (
                          <Badge key={platform} variant="outline">
                            {platform}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(post.status)}>
                        {getStatusText(post.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(post.updatedAt).toLocaleString("ja-JP", {
                        timeZone: "Asia/Tokyo",
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(post.id)}>
                            <Edit className="mr-2 h-4 w-4" />
                            編集
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDelete(post.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            削除
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onRefresh(post.id)}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            ステータス更新
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    投稿が見つかりません。最初の投稿を作成してください！
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

// Default mock data
const defaultPosts: Post[] = [
  {
    id: "1",
    content: "新商品を発表しました！詳細はウェブサイトをご確認ください。",
    scheduleTime: "2023-06-15T10:00:00",
    platforms: ["x", "facebook"],
    status: "sent",
    updatedAt: "2023-06-15T10:01:00",
  },
  {
    id: "2",
    content: "中小企業向けデジタルマーケティング戦略のウェビナーを開催します。",
    scheduleTime: "2023-06-20T14:00:00",
    platforms: ["x", "instagram", "linkedin"],
    status: "pending",
    updatedAt: "2023-06-14T09:30:00",
  },
  {
    id: "3",
    content: "採用情報：優秀な開発者を募集しています。",
    scheduleTime: "2023-06-18T12:00:00",
    platforms: ["linkedin", "x"],
    status: "failed",
    updatedAt: "2023-06-18T12:01:00",
  },
  {
    id: "4",
    content: "下書きの投稿です。後で編集予定。",
    scheduleTime: "2023-06-25T15:00:00",
    platforms: ["x"],
    status: "draft",
    updatedAt: "2023-06-20T12:00:00",
  },
];

export default PostTable;
