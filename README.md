# 2026 3D列印創客營 — 活動網站

國立高雄科技大學推廣教育處｜2026/8/19–8/21｜建工校區

靜態網站 + Cloudflare Pages Functions，部署於 Cloudflare Pages。

## 檔案結構

| 檔案 | 用途 |
|---|---|
| `index.html` | 整頁內容與報名表單 |
| `styles.css` | 全站樣式（由原 Next.js 版 `app/globals.css` 靜態化而來，表單樣式在檔案最末段） |
| `app.js` | 頁面互動、簽名手寫板、報名送出 |
| `functions/api/register.js` | 報名中繼：驗證後轉發至 Apps Script（Apps Script 網址不會外洩） |
| `apps-script/Code.gs` | 貼到 Google Apps Script 用的接收程式（不會被部署） |
| `og-image.png` / `favicon.svg` / `robots.txt` / `sitemap.xml` | 站台基本檔 |

原始 Next.js 版本保留在雲端硬碟：
`05_科學教育/02_夏令營與營隊/20260819-21 3d列印夏令營/網頁/`

## 報名資料流

```
瀏覽器表單
   │  POST /api/register（同源，看不到 Apps Script 網址）
   ▼
Cloudflare Pages Function        ← 蜜罐／頻率限制／Turnstile／伺服器端驗證
   │  POST（帶 SHARED_TOKEN）
   ▼
Google Apps Script Web App       ← 驗證 token
   │
   ├─ 簽名 PNG → Google Drive 資料夾
   ▼
Google Sheet「報名資料」
```

報名編號 `refCode` **由 Function 產生**（格式 `3D{YYMMDD}-{6碼}`），前端送來的值不採用。

## 建置步驟

### 1. Google Sheet + Apps Script

1. 開一個新的 Google Sheet，從網址取得 Sheet ID（`/d/` 與 `/edit` 之間那段）
2. 擴充功能 → Apps Script，把 `apps-script/Code.gs` 全部內容貼上，存檔
3. 專案設定 → 指令碼屬性，新增：
   - `SHEET_ID` — 上面的 Sheet ID
   - `SHARED_TOKEN` — 自訂一組密鑰（等一下 Cloudflare 要填一樣的）
4. 執行一次 `setup()`，授權存取 Sheet 與 Drive → 標題列會自動建好
5. 部署 → 新增部署作業 → **網頁應用程式**
   - 執行身分：**我**
   - 誰可以存取：**任何人**
6. 複製 `/exec` 網址

> 之後每次改 `Code.gs`，要「管理部署作業 → 編輯 → 版本選新版本」才會生效。

### 2. Cloudflare Pages

專案設定：

- Framework preset：**None**
- Build command：**留空**
- Build output directory：**`/`**

Settings → Environment variables（Production 與 Preview 都要設）：

| 變數 | 必要性 | 值 |
|---|---|---|
| `SHEETS_WEBHOOK_URL` | **必要** | Apps Script 的 `/exec` 網址 |
| `SHEETS_SHARED_TOKEN` | 建議 | 與 Apps Script 的 `SHARED_TOKEN` 相同 |
| `TURNSTILE_SECRET` | 選用 | 啟用 Turnstile 時填 |

### 3. 上線前必改

1. **網域**：`index.html` 的 `canonical` / `og:url` / `og:image`、`robots.txt`、`sitemap.xml`
   目前都寫 `https://3dcamp.designjarvis.com/`，請換成實際網域。
2. **og-image.png** 目前是 1.8MB 的 DM 原圖，建議壓到 300KB 以內、裁成 1200×630。

## 防灌水（由弱到強，可疊加）

| 機制 | 目前狀態 | 怎麼開 |
|---|---|---|
| 蜜罐欄位 | 已啟用 | — |
| 最短填寫時間 5 秒 | 已啟用（前端） | — |
| 伺服器端完整驗證 | 已啟用 | — |
| 共用密鑰 | 設了環境變數就啟用 | 見上表 |
| IP 頻率限制（每小時 5 次） | 未啟用 | Pages → Settings → Functions → KV bindings，變數名稱 `RATE_LIMIT`，綁一個 KV Namespace |
| Turnstile 人機驗證 | 未啟用 | Cloudflare → Turnstile 建 widget，site key 填進 `app.js` 的 `TURNSTILE_SITE_KEY`，secret 設成環境變數 `TURNSTILE_SECRET` |

## 送到 Sheet 的欄位

`受理時間`(Apps Script 產生), `梯次`, `報名編號`, `學生姓名`, `就讀學校`, `就學階段`,
`年級`, `性別`, `出生年月日`, `身分證字號`, `家長姓名`, `與學生關係`, `聯絡電話`,
`緊急聯絡人`, `電子信箱`, `過敏／慢性病`, `其他過敏說明`, `特殊照護需求`, `肖像權同意`,
`條款同意`, `家長姓名（正楷）`, `親筆簽名圖`(Drive 連結), `其他備註`, `前端送出時間`, `來源IP`

- `緊急聯絡人` 為 `姓名（電話）` 合併字串
- `年級` 為 `階段+年級` 合併字串（例：`國小五年級`）
- `身分證字號` 與 `出生年月日` 欄位設為文字格式，避免 Sheet 自動轉型
- 同一個 `報名編號` 重複送出只會寫入一次

要增減欄位，改 `apps-script/Code.gs` 最上方的 `COLUMNS` 陣列，再跑一次 `setup()`。
