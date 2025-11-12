# YLPM プロジェクト開発ガイドライン

このファイルには、YLPMプロジェクトの開発に関するルールとガイドラインを記載します。

## プロジェクト概要

YLPMは投稿管理システムで、即時投稿とスケジュール投稿の機能を提供します。

## コーディング規約

### 言語とフレームワーク
- TypeScript を使用
- Supabase Edge Functions でバックエンドを構築

### コードスタイル
- インデント: スペース2つ
- セミコロンを使用
- シングルクォートを優先
- 適切な型定義を必ず行う

### ファイル構成
- `src/routes/`: APIエンドポイント
- `src/services/`: ビジネスロジック
- `src/types/`: 型定義
- `src/db/`: データベース関連

## 機能開発のルール

### 投稿機能
- 即時投稿とスケジュール投稿を明確に分離
- スケジュール投稿は外部ツール（Make等）で管理

### Webhook
- Webhook送信はクエリパラメータ方式を使用
- エラーハンドリングを適切に実装

### エラーハンドリング
- すべてのAPI呼び出しで適切なエラーハンドリングを実装
- ユーザーにわかりやすいエラーメッセージを返す

## データベース
- 適切なトランザクション管理
- インデックスの最適化を考慮

## セキュリティ
- 認証・認可を適切に実装
- SQLインジェクション対策
- XSS対策
- CSRF対策

## テスト
- 重要な機能には必ずテストを追加
- エッジケースを考慮

## Git運用
- わかりやすいコミットメッセージ
- PRには適切な説明を記載

## その他
- コードレビューを重視
- ドキュメントの更新を忘れずに

---

## 追加検討機能

### Google Sheets/Drive 管理機能の拡張

#### 概要
現在「準備中」となっている以下の機能の実装に関する調査結果

- **シート変更機能**: 既存のGoogle Sheetから別のシートに切り替える
- **フォルダ変更機能**: 画像保存用のGoogle Driveフォルダを別のフォルダに切り替える

#### 実装難易度
**中程度（★★☆☆☆）** - データベース周りは実装済み。主にGoogle Picker APIのフロントエンド実装が必要。

#### 現状の実装状況
- ✅ `saveUserSettings` 関数（データベース更新）は実装済み (src/lib/supabase.ts:113)
- ✅ UI構造とハンドラー関数は定義済み (src/pages/GoogleSheetsCreationPage.tsx)
- ⚠️ `openGoogleDrivePicker` は簡易的なconfirmダイアログのみ (src/lib/supabase.ts:16-41)

#### 必要な実装内容

##### 1. Google Picker API のセットアップ
```typescript
// index.htmlにスクリプトタグを追加
<script src="https://apis.google.com/js/api.js"></script>

// 型定義のインストールまたは手動定義
// @types/google.picker または手動で型定義
```

##### 2. スプレッドシート選択Picker
```typescript
const openSheetPicker = (accessToken: string): Promise<{id, url}> => {
  return new Promise((resolve) => {
    const picker = new google.picker.PickerBuilder()
      .setOAuthToken(accessToken)
      .addView(google.picker.ViewId.SPREADSHEETS)
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED) {
          resolve({
            id: data.docs[0].id,
            url: data.docs[0].url
          });
        }
      })
      .build();
    picker.setVisible(true);
  });
};
```

##### 3. フォルダ選択Picker
```typescript
const openFolderPicker = (accessToken: string): Promise<{id, name}> => {
  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
      .setSelectFolderEnabled(true);
    const picker = new google.picker.PickerBuilder()
      .setOAuthToken(accessToken)
      .addView(view)
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED) {
          resolve({
            id: data.docs[0].id,
            name: data.docs[0].name
          });
        }
      })
      .build();
    picker.setVisible(true);
  });
};
```

##### 4. シート変更ハンドラー
```typescript
const handleChangeSheet = async () => {
  try {
    const accessToken = await getGoogleAccessToken();
    const { id, url } = await openSheetPicker(accessToken);

    await saveUserSettings({
      googleSheetId: id,
      googleSheetUrl: url,
    });

    // UI更新
    window.location.reload();
  } catch (error) {
    // エラーハンドリング
  }
};
```

##### 5. フォルダ変更ハンドラー
```typescript
const handleChangeFolder = async () => {
  try {
    const accessToken = await getGoogleAccessToken();
    const { id, name } = await openFolderPicker(accessToken);
    const url = `https://drive.google.com/drive/folders/${id}`;

    await saveUserSettings({
      googleDriveFolderId: id,
      googleDriveFolderName: name,
      googleDriveFolderUrl: url,
    });

    // UI更新
    window.location.reload();
  } catch (error) {
    // エラーハンドリング
  }
};
```

#### 注意事項

1. **OAuth スコープ確認**
   - Picker APIには `https://www.googleapis.com/auth/drive.readonly` が必要
   - 既存のOAuth実装に含まれているか確認が必要

2. **エラーハンドリング**
   - ユーザーがPickerをキャンセルした場合の処理
   - アクセストークン期限切れの処理
   - 無効なシート/フォルダが選択された場合の検証

3. **型定義**
   - Google Picker APIの型定義が必要
   - `@types/google.picker` または手動定義

4. **データ整合性**
   - シート変更時、既存の投稿データとの互換性確認
   - フォルダ変更時、既存の画像ファイルの扱い（移動するか、新規作成するか）

#### 推定作業時間
- Google Picker API実装: 2-3時間
- シート変更機能: 1-2時間
- フォルダ変更機能: 1-2時間
- テスト・デバッグ: 2-3時間
- **合計: 6-10時間**

#### 参考ドキュメント
- [Google Picker API Overview](https://developers.google.com/picker/api/overview)
- [Google Picker API Reference](https://developers.google.com/picker/api/reference)
- [Google Drive API - Files](https://developers.google.com/drive/api/v3/reference/files)

#### 関連ファイル
- `src/pages/GoogleSheetsCreationPage.tsx` (UI・ハンドラー)
- `src/lib/supabase.ts` (saveUserSettings関数: 113行目)
- `src/lib/supabase.ts` (openGoogleDrivePicker関数: 16-41行目) - 要実装

---

## 残課題（要対応）

### パフォーマンス最適化: Google Sheets API二重呼び出しの統合

#### 問題
**場所**: `src/components/home.tsx:168-261`

現在、投稿データ取得時に同じGoogle Sheetに対して2回API呼び出しを行っています：
1. `fetchPostsFromGoogleSheet()` で投稿データを取得（180行目）
2. 再度同じシートからステータスデータを取得（183-254行目）

#### 影響
- APIコール数が2倍になり、レスポンス時間が遅延
- Google Sheets API割り当ての無駄な消費
- コード複雑性の増加

#### 修正方法

**180行目**の以下のコード：
```typescript
const postsFromSheet = await fetchPostsFromGoogleSheet();

// Google Sheetから全ステータスデータを取得
const settings = await getUserSettings();
```

を以下に置き換える：

```typescript
// 1回のAPI呼び出しで投稿データとステータスデータを取得
const settings = await getUserSettings();
if (!settings?.google_sheet_id) {
  addLogEntry("INFO", "No Google Sheet configured, returning empty array");
  setPosts([]);
  updateLastRefreshTime();
  return;
}

const accessToken = await getGoogleAccessToken();
const sheetName = encodeURIComponent("投稿データ");

const response = await fetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${settings.google_sheet_id}/values/${sheetName}?majorDimension=ROWS`,
  {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  },
);

if (!response.ok) {
  const errorData = await response.json();
  addLogEntry("ERROR", "Error fetching posts from sheet", errorData);
  throw new Error(
    `Failed to fetch posts: ${errorData.error?.message || "Unknown error"}`,
  );
}

const data = await response.json();
const rows = data.values || [];

// 投稿データとステータスデータを同時に構築
const postsMap = new Map();
const statusDataMap: Record<string, Record<string, string>> = {};

// Skip header row and process data
for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  const fullId = row[0] || `sheet-${i}`;
  const isDeleted = row[8] === "TRUE";

  if (isDeleted) continue;

  const baseId = fullId.includes("_") ? fullId.split("_")[0] : fullId;
  const platform = row[2];
  const status = row[4] || "pending";

  // ステータスデータを収集
  if (platform) {
    const parts = fullId.split("_");
    if (parts.length >= 2) {
      const platformLower = parts.slice(1).join("_").toLowerCase();

      if (!statusDataMap[baseId]) {
        statusDataMap[baseId] = {};
      }

      statusDataMap[baseId][`${baseId}_${platformLower}`] = status;
    }
  }

  // 投稿データを構築
  if (!postsMap.has(baseId)) {
    let scheduleTimeForDisplay =
      row[3] ||
      new Date()
        .toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" })
        .slice(0, 16);
    if (row[3] && row[3].includes("T")) {
      const utcTime = new Date(row[3]);
      scheduleTimeForDisplay = utcTime
        .toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" })
        .slice(0, 16);
    }

    const imageIdsString = row[5] || "";
    const imageIds = imageIdsString
      ? imageIdsString
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id)
      : [];

    postsMap.set(baseId, {
      id: baseId,
      content: row[1] || "",
      platforms: [],
      scheduleTime: scheduleTimeForDisplay,
      status: (status as "pending" | "sent" | "failed" | "draft") || "pending",
      imageIds: imageIds,
      updatedAt: row[10] || row[9] || new Date().toISOString(),
      scheduleTimeData: {},
      statusData: {},
    });
  }

  const post = postsMap.get(baseId);
  if (platform && !post.platforms.includes(platform)) {
    post.platforms.push(platform);
  }

  if (platform) {
    const platformKey = `${baseId}_${platform.toLowerCase()}`;
    const platformScheduleTime = row[3] || post.scheduleTime;
    post.scheduleTimeData[platformKey] = platformScheduleTime;
  }
}

// postsにstatusDataを追加
const postsWithStatus = Array.from(postsMap.values()).map((post) => ({
  ...post,
  statusData: statusDataMap[post.id] || {},
}));

setPosts(postsWithStatus);
setSheetError("");
fetchRetryAttempted.current = false;
updateLastRefreshTime();
addLogEntry("INFO", "Posts fetched with status data in single API call", {
  count: postsWithStatus.length,
  statusDataCount: Object.keys(statusDataMap).length,
});
```

その後、**183-260行目を削除**する。

#### 期待効果
- API呼び出し回数: 2回 → 1回（50%削減）
- レスポンス時間の短縮
- コードの簡潔化

#### 優先度
**中** - 機能に影響はないが、パフォーマンス向上が見込める

#### 修正完了済み項目
✅ PostForm.tsx:551 - デバッグコード（debugger;）削除完了
✅ PostForm.tsx:568-577, 1081-1105 - コメントアウトコード削除完了

---

## YLPMデザインシステム

### 概要

YLPMのフラッグシップUIとして、ロゴの配色を活かした**最高にPOPでリッチなデザインシステム**を実装しました。全ページに統一されたブランドアイデンティティを提供します。

**実装日**: 2025年1月12日
**実装場所**: `src/index.css:119-444` (325行のCSSコード)

### ブランドカラー

#### メインカラーパレット

```css
/* YLPMロゴから抽出したブランドカラー */
--ylpm-turquoise: #00BCD4;        /* メインブランドカラー（ターコイズ） */
--ylpm-turquoise-light: #4DD0E1;  /* ライトターコイズ */
--ylpm-turquoise-dark: #0097A7;   /* ダークターコイズ */
--ylpm-orange: #FF9800;           /* アクセントカラー（オレンジ） */
--ylpm-orange-light: #FFB74D;     /* ライトオレンジ */
--ylpm-orange-dark: #F57C00;      /* ダークオレンジ */
--ylpm-teal: #00ACC1;             /* セカンダリカラー（ティール） */
--ylpm-teal-light: #26C6DA;       /* ライトティール */
```

#### グラデーション定義

```css
--ylpm-gradient-main: linear-gradient(135deg, #00BCD4 0%, #00ACC1 50%, #FF9800 100%);
--ylpm-gradient-card: linear-gradient(135deg, rgba(0,188,212,0.05) 0%, rgba(255,152,0,0.05) 100%);
--ylpm-gradient-button: linear-gradient(135deg, #00BCD4 0%, #00ACC1 100%);
--ylpm-gradient-button-hover: linear-gradient(135deg, #4DD0E1 0%, #26C6DA 100%);
--ylpm-gradient-orange: linear-gradient(135deg, #FF9800 0%, #F57C00 100%);
--ylpm-gradient-success: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%);
```

### CSSクラス一覧

#### 背景・レイアウト

| クラス名 | 説明 | 効果 |
|---------|------|------|
| `ylpm-animated-bg` | アニメーション背景 | 15秒かけてグラデーションが移動 |
| `ylpm-glass-card` | グラスモーフィズムカード | 半透明背景 + 10pxブラー + 影効果 |

#### ボタン

| クラス名 | 説明 | 用途 |
|---------|------|------|
| `ylpm-btn-gradient` | ターコイズグラデーションボタン | メインCTA（保存、ログインなど） |
| `ylpm-btn-orange` | オレンジグラデーションボタン | AI生成などの特別な操作 |
| `ylpm-btn-success` | グリーングラデーションボタン | 成功アクション（転記、テストなど） |

#### エフェクト

| クラス名 | 説明 | 効果 |
|---------|------|------|
| `ylpm-glow` | ターコイズグロー効果 | ボタンの周りに青い光 |
| `ylpm-glow-orange` | オレンジグロー効果 | ボタンの周りにオレンジの光 |

#### テキスト

| クラス名 | 説明 | 効果 |
|---------|------|------|
| `ylpm-section-header` | グラデーションテキスト | 見出しがグラデーション + 下線付き |

#### アニメーション

| クラス名 | 説明 | 効果 | 長さ |
|---------|------|------|------|
| `ylpm-pulse` | パルスアニメーション | 拡大縮小を繰り返す | 2秒 |
| `ylpm-bounce-in` | バウンスイン | 登場時にバウンド | 0.6秒 |
| `ylpm-slide-in-up` | スライドイン（上から） | 下からスライド登場 | 0.5秒 |
| `ylpm-fade-in` | フェードイン | 徐々に表示 | 0.5秒 |
| `ylpm-float` | 浮遊アニメーション | 上下に浮遊 | 3秒 |
| `ylpm-shimmer` | シマーエフェクト | 光が横切る | 2秒 |

### 適用済みページ

#### 1. **PostForm.tsx** `src/components/PostForm.tsx`

**主要な変更点**:
- メインコンテナ: `ylpm-animated-bg` + `min-h-screen`
- ProgressIndicator: `ylpm-glass-card`（スティッキー）
- AI設定カード: `ylpm-glass-card ylpm-bounce-in`
- セクションヘッダー（1-5）: `ylpm-section-header`
- 転記ボタン: `ylpm-btn-success`
- AI生成ボタン: `ylpm-btn-orange ylpm-glow-orange`
- 保存ボタン: `ylpm-btn-gradient ylpm-glow`
- プラットフォーム別カード: `ylpm-glass-card ylpm-bounce-in`

**変更箇所**:
- Line 1262: メインコンテナ
- Line 1265: ProgressIndicator
- Line 1334-1336, 1373, 1409-1411, 1503-1505, 1570-1572: セクションヘッダー
- Line 1399, 1854: ボタン
- Line 1462: AI生成ボタン
- Line 1597: プラットフォーム別カード
- Line 1894: メイン保存ボタン

#### 2. **home.tsx** `src/components/home.tsx`

**主要な変更点**:
- 背景: `ylpm-animated-bg`
- ロゴ: `ylpm-float`（浮遊アニメーション）
- タイトル: `ylpm-section-header`
- 新規投稿作成ボタン: `ylpm-btn-gradient ylpm-glow ylpm-pulse`
- 投稿一覧カード: `ylpm-glass-card ylpm-slide-in-up`
- ダイアログ: `ylpm-glass-card`

**変更箇所**:
- Line 1231: 背景
- Line 1244: ロゴ
- Line 1247: タイトル
- Line 1257: 新規投稿作成ボタン
- Line 1324: 投稿一覧カード
- Line 1359, 1378, 1397: ダイアログ

#### 3. **DashboardPage.tsx** `src/pages/DashboardPage.tsx`

**主要な変更点**:
- ローディング画面: `ylpm-animated-bg` + `ylpm-bounce-in`
- 背景: `ylpm-animated-bg`
- ヘッダー: `ylpm-glass-card` + スティッキー
- ロゴ: `ylpm-float`
- タイトル: `ylpm-section-header`
- 3つのメインカード: `ylpm-glass-card ylpm-slide-in-up`
- ウェルカムカード: `ylpm-glass-card ylpm-slide-in-up`

**変更箇所**:
- Line 80-83: ローディング画面
- Line 90: 背景
- Line 95: ヘッダー
- Line 102: ロゴ
- Line 105: タイトル
- Line 151, 170, 189: メインカード
- Line 209: ウェルカムカード

#### 4. **GoogleSheetsCreationPage.tsx** `src/pages/GoogleSheetsCreationPage.tsx`

**主要な変更点**:
- 背景: `ylpm-animated-bg`
- ロゴ: `ylpm-float`
- タイトル: `ylpm-section-header`
- すべてのカード: `ylpm-glass-card ylpm-slide-in-up`
- 作成ボタン: `ylpm-btn-gradient ylpm-glow`
- 作成完了カード: `ylpm-glass-card ylpm-bounce-in`

**変更箇所**:
- Line 234: 背景
- Line 249: ロゴ
- Line 251: タイトル
- Line 278, 358, 403: カード
- Line 426: 作成ボタン
- Line 502: 作成完了カード

#### 5. **LoginPage.tsx** `src/pages/LoginPage.tsx`

**主要な変更点**:
- 背景: `ylpm-animated-bg`
- ログインカード: `ylpm-glass-card ylpm-bounce-in`
- ロゴ: `ylpm-float`
- タイトル: `ylpm-section-header`
- ログインボタン: `ylpm-btn-gradient ylpm-glow`

**変更箇所**:
- Line 167: 背景
- Line 168: カード
- Line 174: ロゴ
- Line 177: タイトル
- Line 210, 220: ログインボタン

#### 6. **UserSettingsPage.tsx** `src/pages/UserSettingsPage.tsx`

**主要な変更点**:
- 背景: `ylpm-animated-bg`
- ロゴ: `ylpm-float`
- タイトル: `ylpm-section-header`
- すべてのカード: `ylpm-glass-card ylpm-slide-in-up`
- 新規追加ボタン: `ylpm-btn-gradient`
- AI設定カード（内部）: `ylpm-glass-card`
- 保存ボタン: `ylpm-btn-gradient`
- テスト送信ボタン: `ylpm-btn-success`
- ダイアログ: `ylpm-glass-card`

**変更箇所**:
- Line 486: 背景
- Line 501: ロゴ
- Line 503: タイトル
- Line 527, 617, 674: メインカード
- Line 538: 新規追加ボタン
- Line 558: AI設定カード（内部）
- Line 653, 811, 912: 保存・追加ボタン
- Line 664: テスト送信ボタン
- Line 754, 824: ダイアログ

#### 7. **ヘルプボタン** `src/components/ui/HelpButton.tsx`, `src/components/ui/HelpTooltip.tsx`

**主要な変更点**:

**HelpButton.tsx**:
- ボタン: `border-2 border-[#00BCD4] text-[#00BCD4] hover:bg-[#00BCD4] hover:text-white`
- ダイアログ: `ylpm-glass-card`
- タイトル: `ylpm-section-header`

**HelpTooltip.tsx**:
- アイコン: `text-[#00BCD4] hover:text-[#00ACC1] hover:scale-110`

**変更箇所**:
- HelpButton.tsx Line 32: ボタンスタイル
- HelpButton.tsx Line 39, 41: ダイアログ
- HelpTooltip.tsx Line 27: アイコン

### 技術仕様

#### グラスモーフィズム（Glassmorphism）

```css
.ylpm-glass-card {
  background: rgba(255, 255, 255, 0.85);  /* 85%不透明の白 */
  backdrop-filter: blur(10px);            /* 10pxのぼかし */
  -webkit-backdrop-filter: blur(10px);    /* Safari対応 */
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow:
    0 8px 32px 0 rgba(0, 188, 212, 0.15),  /* ターコイズの影 */
    0 0 0 1px rgba(0, 188, 212, 0.1);       /* 細い枠 */
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.ylpm-glass-card:hover {
  transform: translateY(-2px);              /* 上に2px移動 */
  box-shadow:
    0 12px 40px 0 rgba(0, 188, 212, 0.25),
    0 0 0 1px rgba(0, 188, 212, 0.2);
}
```

#### グラデーションボタン

```css
.ylpm-btn-gradient {
  background: var(--ylpm-gradient-button);  /* ターコイズグラデーション */
  color: white;
  font-weight: 600;
  box-shadow: 0 4px 15px 0 rgba(0, 188, 212, 0.3);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.ylpm-btn-gradient::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--ylpm-gradient-button-hover);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.ylpm-btn-gradient:hover::before {
  opacity: 1;  /* ホバー時にグラデーション切り替え */
}

.ylpm-btn-gradient:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px 0 rgba(0, 188, 212, 0.4);
}
```

#### アニメーション背景

```css
@keyframes ylpm-gradient-shift {
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

.ylpm-animated-bg {
  background: linear-gradient(
    -45deg,
    rgba(0, 188, 212, 0.1),
    rgba(0, 172, 193, 0.1),
    rgba(255, 152, 0, 0.1),
    rgba(0, 188, 212, 0.1)
  );
  background-size: 400% 400%;
  animation: ylpm-gradient-shift 15s ease infinite;
}
```

### 使用方法

#### 基本的な使い方

```tsx
// 1. ページ全体にアニメーション背景を適用
<div className="min-h-screen ylpm-animated-bg">
  {/* コンテンツ */}
</div>

// 2. カードをグラスモーフィズムに
<Card className="ylpm-glass-card ylpm-slide-in-up">
  {/* カードコンテンツ */}
</Card>

// 3. セクションヘッダーをグラデーションテキストに
<div className="ylpm-section-header">タイトル</div>

// 4. メインCTAボタン
<Button className="ylpm-btn-gradient ylpm-glow">
  保存
</Button>

// 5. AI関連ボタン
<Button className="ylpm-btn-orange ylpm-glow-orange">
  AI生成
</Button>

// 6. 成功アクション
<Button className="ylpm-btn-success">
  転記
</Button>

// 7. ロゴに浮遊アニメーション
<img src="/YLPM.png" className="ylpm-float" />
```

#### 組み合わせ例

```tsx
// ページの基本構造
<div className="min-h-screen ylpm-animated-bg p-4">
  {/* ヘッダー */}
  <header className="ylpm-glass-card ylpm-fade-in">
    <img src="/YLPM.png" className="ylpm-float" />
    <h1 className="ylpm-section-header">YLPM</h1>
  </header>

  {/* メインカード */}
  <Card className="ylpm-glass-card ylpm-slide-in-up">
    <CardHeader>
      <div className="ylpm-section-header">タイトル</div>
    </CardHeader>
    <CardContent>
      <Button className="ylpm-btn-gradient ylpm-glow">
        保存
      </Button>
    </CardContent>
  </Card>
</div>
```

### パフォーマンス考慮事項

1. **backdrop-filter**: 一部の古いブラウザでは非対応。`-webkit-backdrop-filter`でSafari対応済み
2. **アニメーション**: `will-change`は使用していないため、多数のアニメーションを同時に実行する場合は注意
3. **グラデーション**: CSSカスタムプロパティを使用しているため、IE11では非対応

### ブラウザ対応

- **Chrome**: 完全対応
- **Firefox**: 完全対応
- **Safari**: 完全対応（`-webkit-backdrop-filter`で対応）
- **Edge**: 完全対応
- **IE11**: 非対応（カスタムプロパティとbackdrop-filterが非対応）

### 今後の拡張案

1. **ダークモード対応**: `.dark`クラスでダークモード用のカラースキームを追加
2. **アクセシビリティ**: `prefers-reduced-motion`メディアクエリでアニメーション無効化
3. **テーマカスタマイズ**: ユーザーがアクセントカラーを変更できる機能
4. **追加エフェクト**: パーティクル効果、リップルエフェクトなど

---

**注意**: このファイルは必要に応じて更新してください。
