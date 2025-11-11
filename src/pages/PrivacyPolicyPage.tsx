import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const PrivacyPolicyPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          戻る
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">プライバシーポリシー</CardTitle>
            <p className="text-sm text-muted-foreground">最終更新日: 2025年11月1日</p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <h2>1. はじめに</h2>
            <p>
              Yell-lab-PostMate（以下「本サービス」）は、複数のSNSへの投稿を効率化するためのツールです。
              本プライバシーポリシーは、本サービスがどのような情報を収集し、どのように使用・保護するかを説明します。
            </p>

            <h2>2. 運営者情報</h2>
            <ul>
              <li>サービス名: Yell-lab-PostMate（YLPM）</li>
              <li>運営: プロジェクトNo135 有志メンバー</li>
              <li>ウェブサイト: https://ylpm.minami-umemoto.jp/</li>
            </ul>

            <h2>3. 収集する情報</h2>

            <h3>3.1 Googleアカウント情報</h3>
            <ul>
              <li>メールアドレス</li>
              <li>プロフィール情報（氏名、プロフィール画像）</li>
              <li>Googleアクセストークンおよびリフレッシュトークン</li>
            </ul>
            <p><strong>収集目的</strong>: ユーザー認証およびGoogle Sheetsへのアクセス</p>

            <h3>3.2 Google Sheets データ</h3>
            <ul>
              <li>投稿内容（テキスト、画像URL）</li>
              <li>投稿スケジュール情報</li>
              <li>投稿ステータス</li>
              <li>AI設定情報</li>
              <li>Webhook URL</li>
            </ul>
            <p><strong>収集目的</strong>: SNS投稿の管理・自動化</p>

            <h3>3.3 Dropbox情報（オプション）</h3>
            <ul>
              <li>アクセストークン</li>
              <li>アップロードした画像ファイル</li>
            </ul>
            <p><strong>収集目的</strong>: 画像の保存・管理</p>

            <h3>3.4 AI API情報（オプション）</h3>
            <ul>
              <li>選択したAIサービス名（OpenAI、Anthropic、Google AI）</li>
              <li>APIキー（ユーザのgooglesheetに保存）</li>
            </ul>
            <p><strong>収集目的</strong>: AI による投稿文の自動生成</p>

            <h3>3.5 利用ログ</h3>
            <ul>
              <li>アクセス日時</li>
              <li>操作ログ（エラー情報含む）</li>
            </ul>
            <p><strong>収集目的</strong>: サービスの改善、エラー対応</p>

            <h2>4. 情報の使用目的</h2>
            <p>収集した情報は以下の目的でのみ使用します：</p>
            <ul>
              <li>ユーザー認証およびアカウント管理</li>
              <li>Google Sheetsへの投稿データの読み書き</li>
              <li>投稿スケジュールの管理</li>
              <li>AI による投稿文の生成</li>
              <li>サービスの提供・維持・改善</li>
              <li>技術的な問題の診断・修正</li>
            </ul>

            <h2>5. 情報の保存と保護</h2>

            <h3>5.1 保存場所</h3>
            <ul>
              <li>ユーザーデータ: Supabase（PostgreSQLデータベース）</li>
              <li>投稿データ: ユーザーのGoogle Sheets、Google Drive</li>
              <li>画像ファイル: Dropbox（ユーザーが選択した場合）</li>
            </ul>

            <h3>5.2 セキュリティ対策</h3>
            <ul>
              <li>すべての通信はHTTPS（SSL/TLS）で暗号化</li>
              <li>APIキーはユーザーのgooglesheetに保存</li>
              <li>アクセストークンの適切な管理とローテーション</li>
              <li>最小権限の原則に基づくアクセス制御</li>
            </ul>

            <h3>5.3 保存期間</h3>
            <ul>
              <li>アカウントデータ: アカウント削除まで</li>
              <li>投稿データ: システム側では保存しません。ユーザーのGoogle Sheets、Google Driveに保存されます。</li>
              <li>ログデータ: 最大30日間</li>
            </ul>

            <h2>6. 第三者への情報提供</h2>

            <h3>6.1 情報共有</h3>
            <p>以下の場合を除き、ユーザーの個人情報を第三者に提供することはありません：</p>
            <ul>
              <li>ユーザーの明示的な同意がある場合</li>
              <li>法的義務がある場合</li>
            </ul>

            <h3>6.2 外部サービスの利用</h3>
            <p>本サービスは以下の外部サービスを利用します：</p>

            <p><strong>必須サービス:</strong></p>
            <ul>
              <li><strong>Google API</strong> (認証、Google Sheetsアクセス) - <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google プライバシーポリシー</a></li>
              <li><strong>Supabase</strong> (データベース、認証) - <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabase プライバシーポリシー</a></li>
            </ul>

            <p><strong>オプションサービス（ユーザーが選択した場合のみ）:</strong></p>
            <ul>
              <li><strong>Dropbox</strong> (画像保存) - <a href="https://www.dropbox.com/privacy" target="_blank" rel="noopener noreferrer">Dropbox プライバシーポリシー</a></li>
              <li><strong>OpenAI API</strong> (AI文章生成) - <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer">OpenAI プライバシーポリシー</a></li>
              <li><strong>Anthropic API</strong> (AI文章生成) - <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer">Anthropic プライバシーポリシー</a></li>
              <li><strong>Google AI API</strong> (AI文章生成) - <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google AI プライバシーポリシー</a></li>
              <li><strong>Make.com</strong> (投稿自動化) - <a href="https://www.make.com/en/privacy-policy" target="_blank" rel="noopener noreferrer">Make プライバシーポリシー</a></li>
            </ul>

            <h2>7. Google APIの使用に関する開示</h2>
            <p>
              本サービスのGoogle APIの使用および他のアプリとの情報の転送は、
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>
              （制限付き使用要件を含む）に準拠します。
            </p>

            <h3>7.1 Google Sheetsへのアクセス</h3>
            <p>本サービスは以下の目的でGoogle Sheetsにアクセスします：</p>
            <ul>
              <li>投稿データの作成・読み取り・更新・削除</li>
              <li>投稿スケジュールの管理</li>
              <li>AI設定情報の保存・読み取り</li>
            </ul>

            <h3>7.2 アクセス権限</h3>
            <ul>
              <li>https://www.googleapis.com/auth/spreadsheets - Googleスプレッドシートの表示、編集、作成、削除</li>
              <li>https://www.googleapis.com/auth/drive.file - Googleドライブのアプリで作成または開いたファイルの表示と管理</li>
            </ul>

            <h2>8. ユーザーの権利</h2>
            <p>ユーザーには以下の権利があります：</p>
            <ul>
              <li><strong>アクセス権</strong>: 自分のデータにアクセスする権利</li>
              <li><strong>修正権</strong>: 不正確なデータを修正する権利</li>
              <li><strong>削除権</strong>: データの削除を要求する権利</li>
              <li><strong>制限権</strong>: データ処理を制限する権利</li>
              <li><strong>データポータビリティ権</strong>: データを受け取る権利</li>
            </ul>

            <h3>8.1 データの削除</h3>
            <p>以下の方法でデータを削除できます：</p>
            <ol>
              <li>Google Sheets上のデータ削除: アプリ内から削除可能</li>
              <li>アカウント削除: 運営チームまでご連絡ください</li>
              <li>Google連携解除: Googleアカウント設定から「アプリとサイトへのアクセス」を取り消し</li>
            </ol>

            <h2>9. Cookie とトラッキング</h2>
            <p>
              本サービスは、セッション管理のために最小限のCookieを使用します。
              第三者による行動追跡は行っていません。
            </p>

            <h2>10. 子どもの個人情報</h2>
            <p>
              本サービスは13歳未満の子どもを対象としていません。
              13歳未満の子どもから故意に個人情報を収集することはありません。
            </p>

            <h2>11. プライバシーポリシーの変更</h2>
            <p>
              本プライバシーポリシーは必要に応じて更新されることがあります。
              重大な変更がある場合は、サービス内で通知します。
            </p>

            <h2>12. お問い合わせ</h2>
            <p>プライバシーに関するご質問やご懸念がある場合は、Discord 「時短&効率改善になるデジタルツールを作って地域の活動に貢献しよう！」チャンネルのお問い合わせまでご連絡ください。</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
