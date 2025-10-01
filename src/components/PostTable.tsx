import React, { useState, useEffect } from "react";
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
  platformStatuses?: Record<string, "pending" | "sent" | "failed" | "draft">;
  updatedAt: string;
  // Google Sheetから取得したステータスデータ（{postId}_{platform} = status形式）
  statusData?: Record<string, "pending" | "sent" | "failed" | "draft">;
}

interface PostTableProps {
  posts?: Post[];
  onEdit?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onRefresh?: (postId: string) => void;
  //  onAutoRefresh?: () => void;
}

const PostTable: React.FC<PostTableProps> = ({
  posts = defaultPosts,
  onEdit = () => {},
  onDelete = () => {},
  onRefresh = () => {},
  //  onAutoRefresh = () => {},
}) => {
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Post;
    direction: "ascending" | "descending";
  } | null>(null);
  const [processedPosts, setProcessedPosts] = useState<Post[]>(posts);
  const [lastRefreshTime, setLastRefreshTime] = useState<string>("");

  // Check for failed posts based on schedule time
  useEffect(() => {
    const checkFailedPosts = () => {
      const now = new Date();
      const updatedPosts = posts.map((post) => {
        if (post.status === "pending" && post.scheduleTime) {
          let scheduleTime: Date;
          if (post.scheduleTime.includes("-")) {
            // yyyy-mm-dd HH:MM format
            scheduleTime = new Date(
              post.scheduleTime.replace(" ", "T") + ":00",
            );
          } else {
            scheduleTime = new Date(post.scheduleTime);
          }
          const timeDiff = now.getTime() - scheduleTime.getTime();
          const fiveMinutesInMs = 5 * 60 * 1000;

          if (timeDiff > fiveMinutesInMs) {
            return { ...post, status: "failed" as const };
          }
        }
        return post;
      });
      setProcessedPosts(updatedPosts);
    };

    checkFailedPosts();
    const interval = setInterval(checkFailedPosts, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [posts]);

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
    const postsCopy = [...processedPosts];
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
  }, [processedPosts, sortConfig]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPosts(processedPosts.map((post) => post.id));
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
          <div className="text-sm text-muted-foreground">
            クリックして並び替え
          </div>
        </CardTitle>
        {lastRefreshTime && (
          <div className="text-xs text-muted-foreground mt-2 flex flex-row-reverse">
            最終更新: {lastRefreshTime}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      selectedPosts.length === processedPosts.length &&
                      processedPosts.length > 0
                    }
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  />
                </TableHead>
                <TableHead>投稿内容</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort("scheduleTime")}
                >
                  予定時刻{" "}
                  {sortConfig?.key === "scheduleTime" &&
                    (sortConfig.direction === "ascending" ? "↑" : "↓")}
                </TableHead>
                <TableHead>プラットフォーム</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort("status")}
                >
                  ステータス{" "}
                  {sortConfig?.key === "status" &&
                    (sortConfig.direction === "ascending" ? "↑" : "↓")}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort("updatedAt")}
                >
                  最終更新{" "}
                  {sortConfig?.key === "updatedAt" &&
                    (sortConfig.direction === "ascending" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPosts.length > 0 ? (
                sortedPosts.flatMap((post) => {
                  // statusDataから各プラットフォームのステータスを取得
                  const hasStatusData =
                    post.statusData && Object.keys(post.statusData).length > 0;

                  if (hasStatusData && post.platforms.length > 0) {
                    return post.platforms.map((platform, index) => {
                      // Google Sheetのフォーマット: {postId}_{platform}
                      const statusKey = `${post.id}_${platform.toLowerCase()}`;
                      const platformStatus =
                        post.statusData?.[statusKey] || post.status;
                      const isFirstRow = index === 0;

                      const getPlatformBadgeStyle = (platform: string) => {
                        switch (platform.toLowerCase()) {
                          case "x":
                          case "twitter":
                            return "bg-black text-white hover:bg-gray-800";
                          case "facebook":
                            return "bg-blue-600 text-white hover:bg-blue-700";
                          case "instagram":
                            return "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600";
                          case "linkedin":
                            return "bg-blue-700 text-white hover:bg-blue-800";
                          case "line":
                            return "bg-green-500 text-white hover:bg-green-600";
                          case "discord":
                            return "bg-indigo-600 text-white hover:bg-indigo-700";
                          case "wordpress":
                            return "bg-gray-700 text-white hover:bg-gray-800";
                          default:
                            return "bg-gray-500 text-white hover:bg-gray-600";
                        }
                      };

                      return (
                        <TableRow key={`${post.id}-${platform}`}>
                          {isFirstRow && (
                            <>
                              <TableCell rowSpan={post.platforms.length}>
                                <Checkbox
                                  checked={selectedPosts.includes(post.id)}
                                  onCheckedChange={(checked) =>
                                    handleSelectPost(post.id, !!checked)
                                  }
                                />
                              </TableCell>
                              <TableCell
                                className="font-medium"
                                rowSpan={post.platforms.length}
                              >
                                <div className="truncate max-w-[200px]">
                                  {post.content}
                                </div>
                              </TableCell>
                              <TableCell rowSpan={post.platforms.length}>
                                {post.scheduleTime.includes("-")
                                  ? post.scheduleTime
                                      .replace(/-/g, "/")
                                      .replace(" ", " ")
                                  : new Date(post.scheduleTime)
                                      .toLocaleString("ja-JP", {
                                        timeZone: "Asia/Tokyo",
                                        year: "numeric",
                                        month: "2-digit",
                                        day: "2-digit",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                      .replace(/\/(\d{4})/, "/$1")
                                      .replace(
                                        /(\d{2}):(\d{2}):(\d{2})/,
                                        "$1:$2",
                                      )}
                              </TableCell>
                            </>
                          )}
                          <TableCell>
                            <Badge className={getPlatformBadgeStyle(platform)}>
                              {platform}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={getStatusBadgeVariant(platformStatus)}
                            >
                              {getStatusText(platformStatus)}
                            </Badge>
                          </TableCell>
                          {isFirstRow && (
                            <>
                              <TableCell rowSpan={post.platforms.length}>
                                {new Date(post.updatedAt)
                                  .toLocaleString("ja-JP", {
                                    timeZone: "Asia/Tokyo",
                                    year: "numeric",
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                  .replace(/\/(\d{4})/, "/$1")
                                  .replace(/(\d{2}):(\d{2}):(\d{2})/, "$1:$2")}
                              </TableCell>
                              <TableCell
                                className="text-right"
                                rowSpan={post.platforms.length}
                              >
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreHorizontal className="h-4 w-4" />
                                      <span className="sr-only">Open menu</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => onEdit(post.id)}
                                    >
                                      <Edit className="mr-2 h-4 w-4" />
                                      編集
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => onDelete(post.id)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      削除
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => onRefresh(post.id)}
                                    >
                                      <RefreshCw className="mr-2 h-4 w-4" />
                                      ステータス更新
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      );
                    });
                  } else {
                    // 従来の単一行表示（statusDataがない場合）
                    return (
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
                          {post.scheduleTime.includes("-")
                            ? post.scheduleTime
                                .replace(/-/g, "/")
                                .replace(" ", " ")
                            : new Date(post.scheduleTime)
                                .toLocaleString("ja-JP", {
                                  timeZone: "Asia/Tokyo",
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                                .replace(/\/(\d{4})/, "/$1")
                                .replace(/(\d{2}):(\d{2}):(\d{2})/, "$1:$2")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {(post.platforms || []).map((platform) => {
                              const getPlatformBadgeStyle = (
                                platform: string,
                              ) => {
                                switch (platform.toLowerCase()) {
                                  case "x":
                                  case "twitter":
                                    return "bg-black text-white hover:bg-gray-800";
                                  case "facebook":
                                    return "bg-blue-600 text-white hover:bg-blue-700";
                                  case "instagram":
                                    return "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600";
                                  case "linkedin":
                                    return "bg-blue-700 text-white hover:bg-blue-800";
                                  case "line":
                                    return "bg-green-500 text-white hover:bg-green-600";
                                  case "discord":
                                    return "bg-indigo-600 text-white hover:bg-indigo-700";
                                  case "wordpress":
                                    return "bg-gray-700 text-white hover:bg-gray-800";
                                  default:
                                    return "bg-gray-500 text-white hover:bg-gray-600";
                                }
                              };

                              return (
                                <Badge
                                  key={platform}
                                  className={getPlatformBadgeStyle(platform)}
                                >
                                  {platform}
                                </Badge>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(post.status)}>
                            {getStatusText(post.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(post.updatedAt)
                            .toLocaleString("ja-JP", {
                              timeZone: "Asia/Tokyo",
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                            .replace(/\/(\d{4})/, "/$1")
                            .replace(/(\d{2}):(\d{2}):(\d{2})/, "$1:$2")}
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
                              <DropdownMenuItem
                                onClick={() => onDelete(post.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                削除
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onRefresh(post.id)}
                              >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                ステータス更新
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  }
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    投稿が見つかりません。最初の投稿を作成してください!
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
