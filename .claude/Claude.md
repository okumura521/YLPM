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

**注意**: このファイルは必要に応じて更新してください。
