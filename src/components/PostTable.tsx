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
  status: "pending" | "sent" | "failed";
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
      default:
        return "default";
    }
  };

  return (
    <Card className="w-full bg-white">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Posts</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => console.log("Filter clicked")}
            >
              Filter
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => console.log("Bulk actions clicked")}
            >
              Bulk Actions
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
                  Content
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("scheduleTime")}
                >
                  Schedule Time
                </TableHead>
                <TableHead>Platforms</TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("status")}
                >
                  Status
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("updatedAt")}
                >
                  Last Updated
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                      {new Date(post.scheduleTime).toLocaleString()}
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
                        {post.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(post.updatedAt).toLocaleString()}
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
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDelete(post.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onRefresh(post.id)}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh Status
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    No posts found. Create your first post!
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
    content:
      "Exciting news! We just launched our new product. Check it out at our website!",
    scheduleTime: "2023-06-15T10:00:00",
    platforms: ["x", "facebook"],
    status: "sent",
    updatedAt: "2023-06-15T10:01:00",
  },
  {
    id: "2",
    content:
      "Join us for our upcoming webinar on digital marketing strategies for small businesses.",
    scheduleTime: "2023-06-20T14:00:00",
    platforms: ["x", "instagram", "linkedin"],
    status: "pending",
    updatedAt: "2023-06-14T09:30:00",
  },
  {
    id: "3",
    content: "We're hiring! Looking for talented developers to join our team.",
    scheduleTime: "2023-06-18T12:00:00",
    platforms: ["linkedin", "x"],
    status: "failed",
    updatedAt: "2023-06-18T12:01:00",
  },
];

export default PostTable;
