# 2026 3D列印創客營 — 活動網站

國立高雄科技大學推廣教育處｜2026/8/19–8/21｜建工校區

純靜態網站（無建置步驟、無後端），部署於 Cloudflare Pages。

## 報名方式

**本站不辦理報名，也不蒐集任何個人資料。**
報名一律由國立高雄科技大學推廣教育處統一辦理：

<https://cec.nkust.edu.tw/CurriculumList.aspx>

網站上所有報名相關的 CTA 都導向頁面內的「報名方式」區塊，該區塊再連到上面的官方系統。
連結若有變動，改 `index.html` 中 `#register` 區塊裡的網址即可（只有一處）。

> 早期版本曾內建線上報名表單，資料寫入 Google Sheet（Pages Function 中繼 + Apps Script）。
> 改由校方統一報名後已整套移除。程式碼保留在 git 歷史中，需要時可用
> `git show 25a7325 -- functions/api/register.js apps-script/Code.gs` 取回。

## 檔案結構

| 檔案 | 用途 |
|---|---|
| `index.html` | 整頁內容 |
| `styles.css` | 全站樣式（由原 Next.js 版 `app/globals.css` 靜態化而來，報名方式區塊樣式在最末段） |
| `app.js` | 頁面互動：捲動進度、導覽選單、三日課程分頁 |
| `og-image.png` / `favicon.svg` / `robots.txt` / `sitemap.xml` | 站台基本檔 |

原始 Next.js 版本保留在雲端硬碟：
`05_科學教育/02_夏令營與營隊/20260819-21 3d列印夏令營/網頁/`

## 部署（Cloudflare Pages）

Pages 專案設定：

- Framework preset：**None**
- Build command：**留空**
- Build output directory：**`/`**

推上 `main` 後 Pages 會自動部署。不需要任何環境變數。

## 上線前必改

1. **網域**：`index.html` 的 `canonical` / `og:url` / `og:image`、`robots.txt`、`sitemap.xml`
   已設定為 `https://202608-3dpcamp.designjarvis.com/`。
2. **og-image.png** 目前是 1.8MB 的 DM 原圖，建議壓到 300KB 以內、裁成 1200×630。

## 內容怎麼改

課程資料都在 `app.js` 最上方的常數，改完存檔即可，不需要建置：

- `dayPlans` — 三日課表（時間、項目、當日成果）
- `abilities` — 四種能力
- `terms` — 名詞解釋
- `processSteps` — 六階段流程

活動日期、費用、地點等資訊寫在 `index.html` 的 `.quick-facts` 與 `.info-grid` 兩處，
改動時記得兩邊都要同步，另外 `<head>` 裡的 JSON-LD 結構化資料也有一份。
