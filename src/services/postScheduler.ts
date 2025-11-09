// ===== Post Scheduler Service =====
// スケジュール投稿を自動実行するサービス

import { fetchPostsFromGoogleSheet, addLogEntry } from "@/lib/supabase";
import { getMakeWebhookUrl, sendWebhook } from "./webhookService";

// スケジューラーの状態
let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * スケジュールをチェックして、予定時刻が過ぎた投稿があればWebhookを送信
 */
export const checkScheduledPosts = async () => {
  try {
    addLogEntry("INFO", "Checking scheduled posts");

    // Google Sheetsから投稿一覧を取得
    const postsResult = await fetchPostsFromGoogleSheet();
    if (!postsResult.success || !postsResult.posts) {
      addLogEntry("WARN", "Failed to fetch posts for scheduler");
      return { success: false, error: "Failed to fetch posts" };
    }

    const posts = postsResult.posts;
    const now = new Date();

    // 予定時刻が過ぎていて、statusがpendingの投稿を検出
    const scheduledPosts = posts.filter((post) => {
      if (post.status !== "pending") return false;
      if (!post.scheduleTime) return false;

      // scheduleTimeをDateオブジェクトに変換
      const scheduleTime = new Date(post.scheduleTime);

      // 予定時刻が過ぎているか
      return scheduleTime <= now;
    });

    if (scheduledPosts.length === 0) {
      addLogEntry("INFO", "No scheduled posts to process");
      return { success: true, processedCount: 0 };
    }

    addLogEntry("INFO", `Found ${scheduledPosts.length} scheduled posts to process`, {
      postIds: scheduledPosts.map((p) => p.id),
    });

    // Webhook URLを取得
    const webhookResult = await getMakeWebhookUrl();
    if (!webhookResult.success || !webhookResult.webhookUrl) {
      addLogEntry("ERROR", "Webhook URL not configured for scheduler");
      return { success: false, error: "Webhook URL not configured" };
    }

    // Webhookを送信してMakeシナリオを起動
    const webhookSendResult = await sendWebhook(
      webhookResult.webhookUrl,
      "scheduled_check",
      {
        count: scheduledPosts.length.toString(),
      },
    );

    if (webhookSendResult.success) {
      addLogEntry("INFO", "Scheduled posts webhook sent successfully", {
        count: scheduledPosts.length,
      });
      return { success: true, processedCount: scheduledPosts.length };
    } else {
      return { success: false, error: webhookSendResult.error };
    }
  } catch (error) {
    console.error("Error checking scheduled posts:", error);
    addLogEntry("ERROR", "Error checking scheduled posts", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * スケジューラーを起動（デフォルト15分ごとにチェック）
 */
export const startScheduler = (intervalMinutes: number = 15) => {
  if (isRunning) {
    console.log("Scheduler is already running");
    return { success: false, error: "Scheduler is already running" };
  }

  const intervalMs = intervalMinutes * 60 * 1000;

  addLogEntry("INFO", "Starting post scheduler", {
    intervalMinutes,
  });

  // 即座に1回実行
  checkScheduledPosts();

  // 定期実行を開始
  schedulerInterval = setInterval(() => {
    checkScheduledPosts();
  }, intervalMs);

  isRunning = true;

  console.log(`Post scheduler started (interval: ${intervalMinutes} minute(s))`);
  return { success: true };
};

/**
 * スケジューラーを停止
 */
export const stopScheduler = () => {
  if (!isRunning || !schedulerInterval) {
    console.log("Scheduler is not running");
    return { success: false, error: "Scheduler is not running" };
  }

  clearInterval(schedulerInterval);
  schedulerInterval = null;
  isRunning = false;

  addLogEntry("INFO", "Post scheduler stopped");
  console.log("Post scheduler stopped");

  return { success: true };
};

/**
 * スケジューラーの状態を取得
 */
export const getSchedulerStatus = () => {
  return {
    isRunning,
  };
};

/**
 * スケジューラーを再起動
 */
export const restartScheduler = (intervalMinutes: number = 15) => {
  stopScheduler();
  return startScheduler(intervalMinutes);
};
