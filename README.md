# 2026 3D列印創客營 — 活動網站

國立高雄科技大學推廣教育處｜2026/8/19–8/21｜建工校區

純靜態網站（無建置步驟），部署於 Cloudflare Pages。

## 檔案結構

| 檔案 | 用途 |
|---|---|
| `index.html` | 整頁內容與報名表單 |
| `styles.css` | 全站樣式（由原 Next.js 版 `app/globals.css` 靜態化而來，表單樣式在檔案最末段） |
| `app.js` | 頁面互動、簽名手寫板、報名送出邏輯 |
| `og-image.png` | 社群分享預覽圖 |
| `favicon.svg` / `robots.txt` / `sitemap.xml` | 站台基本檔 |

原始 Next.js 版本保留在雲端硬碟：
`05_科學教育/02_夏令營與營隊/20260819-21 3d列印夏令營/網頁/`

## 部署（Cloudflare Pages）

Pages 專案設定：

- Framework preset：**None**
- Build command：**留空**
- Build output directory：**`/`**

推上 `main` 後 Pages 會自動部署。

## 上線前必改

1. **網域**：`index.html` 的 `canonical` / `og:url` / `og:image`、`robots.txt`、`sitemap.xml`
   目前都寫 `https://3dcamp.designjarvis.com/`，請換成實際網域。
2. **og-image.png** 目前是 1.8MB 的 DM 原圖，建議壓到 300KB 以內、裁成 1200×630。

## 報名資料流

表單由瀏覽器直接 `POST` 到 Google Apps Script Web App，寫入 Google Sheet。

設定值集中在 `app.js` 最上方：

```js
const SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/.../exec";
const BATCH_LABEL = "2026 3D列印創客營（8/19-21）";
```

與 `faymi-ai-steam-camp`（五日旗艦營）共用同一個 Apps Script，
靠 `batch` 欄位區分兩邊資料。**修改欄位名稱前務必確認 Apps Script 端的對應。**

### 送出的欄位（22 個）

`batch`, `refCode`, `studentName`, `school`, `stage`, `grade`, `gender`, `birth`,
`idNumber`, `parentName`, `relation`, `phone`, `emergency`, `email`, `allergies`(陣列),
`allergyOther`, `special`, `photoConsent`, `termsAgree`, `signatureName`,
`signatureImage`(base64 PNG), `notes`

- `refCode` 格式：`3D{YYMMDD}-{6碼}`（五日站是 `AI` 開頭）
- `emergency` 為 `姓名（電話）` 合併字串，與五日站格式一致
- `grade` 為 `階段+年級` 合併字串（例：`國小五年級`）

### 前端已做的驗證與防護

- 台灣身分證字號檢查碼驗證
- Email／電話格式檢查
- 簽名必填（空白簽名板擋下）
- 蜜罐欄位 + 最短填寫時間 5 秒（擋簡易機器人）

⚠️ 靜態站的 webhook URL 必然公開在前端。上述僅能擋掉隨手的濫用，
無法阻止刻意的灌水。若之後灌水成問題，需改由後端（Workers / Pages Functions）中繼。
