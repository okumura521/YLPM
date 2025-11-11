import { addLogEntry } from "./supabase";

interface AIResponse {
  success: boolean;
  content?: Record<string, string>;
  error?: string;
}

interface AISettings {
  service: string;
  model: string;
  apiToken: string;
}

// OpenAI API call
export const callOpenAI = async (
  prompt: string,
  model: string,
  apiToken: string,
): Promise<AIResponse> => {
  try {
    addLogEntry("INFO", "Calling OpenAI API", {
      model,
      promptLength: prompt.length,
    });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      addLogEntry("ERROR", "OpenAI API error", {
        status: response.status,
        error: errorData,
      });

      if (response.status === 401) {
        throw new Error("APIキーが無効です。設定を確認してください。");
      } else if (response.status === 429) {
        throw new Error(
          "レート制限に達しました。しばらく待ってから再試行してください。",
        );
      } else {
        throw new Error(
          `OpenAI API エラー: ${errorData.error?.message || "不明なエラー"}`,
        );
      }
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("AIからの応答が空です");
    }

    // Clean and parse JSON response
    try {
      // Remove code blocks and extra whitespace
      let cleanContent = content.trim();
      cleanContent = cleanContent.replace(/```json\s*/g, "");
      cleanContent = cleanContent.replace(/```\s*/g, "");
      cleanContent = cleanContent.replace(/\n\n/g, "\n");
      cleanContent = cleanContent.trim();

      const parsedContent = JSON.parse(cleanContent);
      addLogEntry("INFO", "OpenAI API call successful", { parsedContent });
      return { success: true, content: parsedContent };
    } catch (parseError) {
      addLogEntry("WARN", "Failed to parse JSON response, using raw content", {
        content,
        parseError,
      });
      return { success: true, content: { default: content } };
    }
  } catch (error) {
    addLogEntry("ERROR", "OpenAI API call failed", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "OpenAI API呼び出しに失敗しました",
    };
  }
};

// Anthropic API call
export const callAnthropic = async (
  prompt: string,
  model: string,
  apiToken: string,
): Promise<AIResponse> => {
  try {
    addLogEntry("INFO", "Calling Anthropic API", {
      model,
      promptLength: prompt.length,
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiToken,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true" 
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      addLogEntry("ERROR", "Anthropic API error", {
        status: response.status,
        error: errorData,
      });

      if (response.status === 401) {
        throw new Error("APIキーが無効です。設定を確認してください。");
      } else if (response.status === 429) {
        throw new Error(
          "レート制限に達しました。しばらく待ってから再試行してください。",
        );
      } else {
        throw new Error(
          `Anthropic API エラー: ${errorData.error?.message || "不明なエラー"}`,
        );
      }
    }

    const data = await response.json();
    const content = data.content[0]?.text;

    if (!content) {
      throw new Error("AIからの応答が空です");
    }

    // Clean and parse JSON response
    try {
      // Remove code blocks and extra whitespace
      let cleanContent = content.trim();
      cleanContent = cleanContent.replace(/```json\s*/g, "");
      cleanContent = cleanContent.replace(/```\s*/g, "");
      cleanContent = cleanContent.replace(/\n\n/g, "\n");
      cleanContent = cleanContent.trim();

      const parsedContent = JSON.parse(cleanContent);
      addLogEntry("INFO", "Anthropic API call successful", { parsedContent });
      return { success: true, content: parsedContent };
    } catch (parseError) {
      addLogEntry("WARN", "Failed to parse JSON response, using raw content", {
        content,
        parseError,
      });
      return { success: true, content: { default: content } };
    }
  } catch (error) {
    addLogEntry("ERROR", "Anthropic API call failed", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Anthropic API呼び出しに失敗しました",
    };
  }
};

// Google AI API call
export const callGoogleAI = async (
  prompt: string,
  model: string,
  apiToken: string,
): Promise<AIResponse> => {
  try {
    addLogEntry("INFO", "Calling Google AI API", {
      model,
      prompt,
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiToken}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      addLogEntry("ERROR", "Google AI API error", {
        status: response.status,
        error: errorData,
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error("APIキーが無効です。設定を確認してください。");
      } else if (response.status === 429) {
        throw new Error(
          "レート制限に達しました。しばらく待ってから再試行してください。",
        );
      } else {
        throw new Error(
          `Google AI API エラー: ${errorData.error?.message || "不明なエラー"}`,
        );
      }
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error("AIからの応答が空です");
    }

    // Clean and parse JSON response
    try {
      // Remove code blocks and extra whitespace
      let cleanContent = content.trim();
      cleanContent = cleanContent.replace(/```json\s*/g, "");
      cleanContent = cleanContent.replace(/```\s*/g, "");
      cleanContent = cleanContent.replace(/\n\n/g, "\n");
      cleanContent = cleanContent.trim();

      const parsedContent = JSON.parse(cleanContent);
      addLogEntry("INFO", "Google AI API call successful", { parsedContent });
      return { success: true, content: parsedContent };
    } catch (parseError) {
      addLogEntry("WARN", "Failed to parse JSON response, using raw content", {
        content,
        parseError,
      });
      return { success: true, content: { default: content } };
    }
  } catch (error) {
    addLogEntry("ERROR", "Google AI API call failed", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Google AI API呼び出しに失敗しました",
    };
  }
};

// Unified AI call function
export const callAI = async (
  prompt: string,
  settings: AISettings,
): Promise<AIResponse> => {
  const { service, model, apiToken } = settings;

  addLogEntry("INFO", "Starting AI call", { service, model });

  try {
    switch (service.toLowerCase()) {
      case "openai":
        return await callOpenAI(prompt, model, apiToken);
      case "anthropic":
        return await callAnthropic(prompt, model, apiToken);
      case "google":
        return await callGoogleAI(prompt, model, apiToken);
      default:
        throw new Error(`サポートされていないAIサービス: ${service}`);
    }
  } catch (error) {
    addLogEntry("ERROR", "AI call failed", { service, model, error });
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "AI呼び出しに失敗しました",
    };
  }
};

// Build prompt for platform-specific content generation
export const buildPrompt = (
  baseContent: string,
  aiInstruction: string,
  platforms: string[],
  platformValidations: Record<string, { maxLength: number; name: string }>,
): string => {
  const platformInfo = platforms
    .map((platform) => {
      const validation = platformValidations[platform];
      return `- ${validation?.name || platform}: 最大${validation?.maxLength || "無制限"}文字`;
    })
    .join("\n");

  return `以下のベース内容・キーワードを基に、最適化指示に従ってコンテンツを生成してください。

【ベース投稿内容・キーワード】
${baseContent}

【最適化指示】
${aiInstruction || "なし（各プラットフォームの特性に合わせて最適化してください）"}

【対象プラットフォーム（これらのプラットフォームのみ生成してください）】
${platformInfo}

【重要な要求事項】
- 指定されたプラットフォームのみのコンテンツを生成してください
- 各プラットフォームの文字数制限を厳守してください
- 最適化指示がある場合は、必ずその指示に従ってください
- 最適化指示がない場合は、各プラットフォームの特性に合わせて内容を調整してください
- 回答は必ずJSON形式で、指定されたプラットフォームのみをキーとして返してください
- JSONコードブロック（\`\`\`json）や余分な改行（\n\n）は含めないでください

【回答形式例】
{
  "x": "X向けの投稿内容（280文字以内）",
  "instagram": "Instagram向けの投稿内容（2200文字以内）"
}

上記の形式で、選択されたプラットフォーム（${platforms.join(", ")}）向けの最適化されたコンテンツのみを生成してください。`;
};
