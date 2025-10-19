# axe Auto Reporter Web

[@axe-core/puppeteer](https://github.com/dequelabs/axe-core-npm/blob/develop/packages/puppeteer/README.md) を使用して、指定した `sitemap.xml` 内の URL に対してアクセシビリティテストを自動的に実行、その結果をレポートとして表示するダッシュボードアプリです。

## 必要条件
- Node.js 20.x 以降
- npm 10.x 以降

> [!TIP]
> Linux 環境で Docker を使わずに実行する場合、Puppeteer が要求する Chromium 系ライブラリが不足してエラーになることがあります。動作に必要なパッケージはプロジェクトの `Dockerfile` を参照し、事前にインストールしておいてください。

## インストール
リポジトリのルートで以下を実行します。

```sh
npm install
```

初回起動時に `data/` 以下へ必要な初期ファイルが作成されます。

## 起動と初期設定

### 1. 初回起動
ターミナルで以下のコマンドを実行し、ブラウザで `http://localhost:3000` を開きます。  

    ```sh
    npm run build
    npm run preview -- --host 0.0.0.0 --port 3000
    ```

### 2. 初期設定
設定画面（Setting）を開いてサイトマップの URL など必要な項目を入力して保存します。（設定を保存すると `data/settings.json` と `data/url-list.txt` が更新されます）

### 3. 初回テストの実行
別のターミナルで `node script/scheduler.mjs --once` を実行し、初回アクセシビリティテストを実行します（CUI 画面に進捗が表示されますのでテストが終わるまでお待ちください）。

### 4. 運用開始
初回テストが完了したらブラウザ画面に戻って再読み込みし、アクセシビリティレポートがダッシュボードに表示されているかを確認します。

初回レポートが生成された後は、`node script/scheduler.mjs` を（`--once` なしで）常駐させておくと、設定画面で選択した「テスト頻度」設定に従って以降のレポートが自動で作成されます。

スケジューラは毎回実行前に `data/settings.json` を読み込み、sitemap.xml の URL、タグ、クロールモード、対象ページ数（上限）、テスト頻度（`daily` / `weekly` / `monthly`）を参照します。生成されたレポートは `src/pages/results/` に保存され、`data/reports/index.json` にインデックスされます。

## Docker の利用
`Dockerfile` には、Puppeteer の依存関係をインストールし、ダッシュボードをビルドしてウェブサーバとスケジューラを同時に起動するイメージ定義が用意されています。

### ビルドと起動
以下のコマンドでビルドとコンテナの起動を行います。

```sh
docker build -t axe-auto-reporter-web .
docker run --rm -p 3000:3000 axe-auto-reporter-web
```

なお、この起動方法だと、コンテナを停止した際、設定やレポートはリセットされます。

#### データを永続化したい場合
もし設定やレポートデータを永続化（コンテナを停止しても削除されないように）したい場合には以下のコマンドでコンテナを起動し、 `data/` ディレクトリをボリュームとしてマウントしてください。

```sh
docker run --rm -p 3000:3000 -v "$(pwd)/data:/app/data" axe-auto-reporter-web
```

### 初期設定
コンテナが起動したら、ブラウザで `http://localhost:3000` を開き、設定画面（Setting）を開いてサイトマップの URL など必要な項目を入力して保存します。

### スケジューラ
コンテナが起動すると `docker-start.sh` が `script/scheduler.mjs` を常駐させることで定期的なアクセシビリティテストが実行されます。

定期アクセシビリティテストの実行間隔は、設定画面で選択した「テスト頻度」設定に従い、テストは AM 3:00（Asia/Tokyo） に実行されます。

初期設定を行った後は、コンテナを起動したままこの定期実行を待てば、自動的に初回のアクセシビリティテストが実行されます。

もし、即時に初回レポートを生成したい場合は、次のコマンドでアクセシビリティテストを実行できます。

```sh
docker exec -it <コンテナ名またはID> node script/scheduler.mjs --once
```

`<コンテナ名またはID>` は `docker ps` で確認してください。

## 注意点（v1.0.0 時点）

- 本アプリは利用者のローカル環境やクローズドなサーバ環境で実行する前提でユーザー認証などの仕組みが組み込まれていません。第三者がアクセスする公開サーバで実行するような利用方法はしないでください。
- テストの対象は `http://` または `https://` で始まる URL のみです。PDF など非 HTML コンテンツはブラウザ内ビューアでアクセスできてしまいますが、アクセシビリティ試験自体は正常に実行されません。
- テストの失敗などに対するダッシュボード上での通知・表示などは行われません。レポートが正常に生成されない場合などは `script/axe-auto-reporter.mjs` の実行ログを確認してください。

## 関連スクリプト

- [burnworks/axe-auto-reporter](https://github.com/burnworks/axe-auto-reporter)
