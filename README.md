# axe Auto Reporter Web

[@axe-core/puppeteer](https://github.com/dequelabs/axe-core-npm/blob/develop/packages/puppeteer/README.md) を使用して、指定した `sitemap.xml` 内の URL に対してアクセシビリティテストを自動的に実行、その結果をレポートとして表示するダッシュボードアプリです。

![axe Auto Reporter Web](./public/img/main-logo.svg)

![axe Auto Reporter Web ダッシュボード スクリーンショット](./public/img/screen-shot-axe-Auto-Reporter-Web.png)

![axe Auto Reporter Web レポートページ スクリーンショット](./public/img/screen-shot-axe-Auto-Reporter-Web-02.png)

## 必要条件
- Node.js 22.x 以降
- npm 10.x 以降

> [!TIP]
> Linux 環境で Docker を使わずに実行する場合、Puppeteer が要求する Chromium 系ライブラリが不足してエラーになることがあります。動作に必要なパッケージはプロジェクトの `Dockerfile` を参照し、事前にインストールしておいてください。

## インストール
リポジトリを `clone` 後、ルートディレクトリで以下のコマンドを実行します。

```sh
git clone https://github.com/burnworks/axe-auto-reporter-web.git
cd axe-auto-reporter-web
npm install
```

## 起動と初期設定

### 1. 初回起動
ターミナルで以下のコマンドを実行し、ブラウザで `http://localhost:3000` を開きます。  

```sh
npm run build
npm run preview -- --host 0.0.0.0 --port 3000
```

初回起動時に `data/` ディレクトリが作成され、必要な初期ファイルが作成されます。

### 2. 初期設定
設定画面（Setting）を開いてサイトマップの URL など必要な項目を入力して保存します。（設定を保存すると `data/settings.json` と `data/url-list.txt` が更新されます）

### 3. 初回テストの実行
別のターミナルで `node script/scheduler.mjs --once` を実行し、初回アクセシビリティテストを実行します（CUI 画面に進捗が表示されますのでテストが終わるまでお待ちください）。

### 4. 運用開始
初回テストが完了したらブラウザ画面に戻って再読み込みし、アクセシビリティレポートがダッシュボードに表示されているかを確認します。

初回レポートが生成された後は、`node script/scheduler.mjs` を（`--once` なしで）常駐させておくと、設定画面で選択した「テスト頻度」設定に従って以降のレポートが自動で作成されます。

スケジューラは毎回実行前に `data/settings.json` を読み込み、sitemap.xml の URL、タグ、クロールモード、対象ページ数（上限）、テスト頻度（`daily` / `weekly` / `monthly`）を参照します。生成されたレポートは `src/pages/results/` に保存され、`data/reports/index.json` にインデックスされます。

## 注意点（v1.0.0 時点）

- 本アプリは利用者のローカル環境やクローズドなサーバ環境で実行する前提でユーザー認証などの仕組みが組み込まれていません。第三者がアクセスする公開サーバで実行するような利用方法はしないでください。
- テストの対象は `http://` または `https://` で始まる URL のみです。PDF など非 HTML コンテンツはブラウザ内ビューアでアクセスできてしまいますが、アクセシビリティ試験自体は正常に実行されません。
- テストの失敗などに対するダッシュボード上での通知・表示などは行われません。レポートが正常に生成されない場合などは `script/axe-auto-reporter.mjs` の実行ログを確認してください。

## 関連スクリプト

- [burnworks/axe-auto-reporter](https://github.com/burnworks/axe-auto-reporter)
