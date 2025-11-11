export interface UserFriendlyError {
  title: string;
  description: string;
  action?: string;
  actionLabel?: string;
}

/**
 * エラーメッセージをユーザーフレンドリーな形式に変換する
 */
export const getUserFriendlyErrorMessage = (error: string | Error): UserFriendlyError => {
  const errorString = typeof error === 'string' ? error : error.message;
  const lowerError = errorString.toLowerCase();

  // Google 認証エラー
  if (lowerError.includes('access token') || lowerError.includes('token expired') || lowerError.includes('invalid_grant')) {
    return {
      title: 'Google連携の有効期限切れ',
      description: 'Google連携の有効期限が切れました。もう一度ログインしてください。',
      action: '/login',
      actionLabel: '再ログイン'
    };
  }

  // Webhook URL未設定エラー
  if (lowerError.includes('webhook url not configured') || lowerError.includes('webhook url is not set')) {
    return {
      title: 'Webhook URL未設定',
      description: '即時投稿を行うには、Webhook URLの設定が必要です。ユーザー設定ページで設定してください。',
      action: '/settings',
      actionLabel: '設定ページへ'
    };
  }

  // APIキーエラー
  if (lowerError.includes('api key') || lowerError.includes('invalid key') || lowerError.includes('unauthorized')) {
    return {
      title: 'APIキーエラー',
      description: 'AIサービスのAPIキーが無効または期限切れです。設定を確認してください。',
      action: '/settings',
      actionLabel: 'AI設定を確認'
    };
  }

  // ネットワークエラー
  if (lowerError.includes('network') || lowerError.includes('connection') || lowerError.includes('timeout')) {
    return {
      title: '接続エラー',
      description: 'インターネット接続を確認してください。しばらく経ってから再度お試しください。'
    };
  }

  // Dropbox連携エラー
  if (lowerError.includes('dropbox') && !lowerError.includes('connected')) {
    return {
      title: 'Dropbox連携エラー',
      description: 'Dropboxとの連携に問題があります。再度連携してください。',
      action: '/sheets',
      actionLabel: 'Dropbox連携'
    };
  }

  // Google Sheets未作成エラー
  if (lowerError.includes('sheet') && (lowerError.includes('not found') || lowerError.includes('not exist'))) {
    return {
      title: 'Google Sheet未作成',
      description: 'Google Sheetがまだ作成されていません。まずはシートを作成してください。',
      action: '/sheets',
      actionLabel: 'シート作成ページへ'
    };
  }

  // ファイルサイズエラー
  if (lowerError.includes('file size') || lowerError.includes('too large')) {
    return {
      title: 'ファイルサイズオーバー',
      description: '選択した画像のサイズが大きすぎます。より小さいサイズの画像をお選びください。'
    };
  }

  // 文字数制限エラー
  if (lowerError.includes('character') && lowerError.includes('limit')) {
    return {
      title: '文字数制限エラー',
      description: '投稿内容が文字数制限を超えています。文字数を減らしてください。'
    };
  }

  // 権限エラー
  if (lowerError.includes('permission') || lowerError.includes('forbidden')) {
    return {
      title: '権限エラー',
      description: 'この操作を行う権限がありません。設定を確認してください。'
    };
  }

  // AIサービスエラー
  if (lowerError.includes('openai') || lowerError.includes('anthropic') || lowerError.includes('google ai')) {
    return {
      title: 'AI サービスエラー',
      description: 'AIサービスとの通信に失敗しました。APIキーとモデル設定を確認してください。',
      action: '/settings',
      actionLabel: 'AI設定を確認'
    };
  }

  // レート制限エラー
  if (lowerError.includes('rate limit') || lowerError.includes('quota')) {
    return {
      title: '利用制限エラー',
      description: 'APIの利用制限に達しました。しばらく経ってから再度お試しください。'
    };
  }

  // デフォルトエラー
  return {
    title: 'エラーが発生しました',
    description: errorString || '予期しないエラーが発生しました。もう一度お試しください。'
  };
};

/**
 * エラーメッセージから特定のエラータイプを判定する
 */
export const getErrorType = (error: string | Error): 'auth' | 'network' | 'api' | 'validation' | 'unknown' => {
  const errorString = typeof error === 'string' ? error : error.message;
  const lowerError = errorString.toLowerCase();

  if (lowerError.includes('token') || lowerError.includes('auth') || lowerError.includes('login')) {
    return 'auth';
  }
  if (lowerError.includes('network') || lowerError.includes('connection') || lowerError.includes('timeout')) {
    return 'network';
  }
  if (lowerError.includes('api') || lowerError.includes('key')) {
    return 'api';
  }
  if (lowerError.includes('invalid') || lowerError.includes('required') || lowerError.includes('limit')) {
    return 'validation';
  }
  return 'unknown';
};
