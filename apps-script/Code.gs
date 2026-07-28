/**
 * 2026 3D列印創客營 — 報名資料接收
 *
 * 部署方式（Apps Script 編輯器）：
 *   1. 貼上本檔全部內容，存檔
 *   2. 專案設定 → 指令碼屬性，新增：
 *        SHEET_ID       你的 Google Sheet ID（網址 /d/ 與 /edit 之間那段）
 *        SHARED_TOKEN   自訂密鑰，需與 Cloudflare 的 SHEETS_SHARED_TOKEN 一致
 *        DRIVE_FOLDER_ID（選用）存放簽名圖的 Drive 資料夾 ID，未設定則自動建立
 *   3. 執行一次 setup()，授權存取 Sheet 與 Drive，並自動建立標題列
 *   4. 部署 → 新增部署作業 → 類型「網頁應用程式」
 *        執行身分：我
 *        誰可以存取：任何人
 *   5. 把 /exec 網址填到 Cloudflare 的 SHEETS_WEBHOOK_URL 環境變數
 *
 * 注意：每次改完程式碼要「管理部署作業 → 編輯 → 版本選新版本」才會生效。
 */

var SHEET_NAME = '報名資料';

// 欄位順序 = Sheet 欄位順序。要加欄位就在這裡加，setup() 會重建標題列。
var COLUMNS = [
  ['receivedAt',     '接收時間'],
  ['batch',          '梯次'],
  ['refCode',        '報名編號'],
  ['studentName',    '學生姓名'],
  ['school',         '就讀學校'],
  ['stage',          '就學階段'],
  ['grade',          '年級'],
  ['gender',         '性別'],
  ['birth',          '出生年月日'],
  ['idNumber',       '身分證字號'],
  ['parentName',     '家長姓名'],
  ['relation',       '與學生關係'],
  ['phone',          '聯絡電話'],
  ['emergency',      '緊急聯絡人'],
  ['email',          '電子信箱'],
  ['allergies',      '過敏／慢性病'],
  ['allergyOther',   '其他過敏說明'],
  ['special',        '特殊照護需求'],
  ['photoConsent',   '肖像權同意'],
  ['termsAgree',     '條款同意'],
  ['signatureName',  '家長姓名（正楷）'],
  ['signatureLink',  '親筆簽名圖'],
  ['notes',          '其他備註'],
  ['submittedAt',    '前端送出時間'],
  ['sourceIp',       '來源IP']
];

function props_() {
  return PropertiesService.getScriptProperties();
}

function getSheet_() {
  var id = props_().getProperty('SHEET_ID');
  if (!id) throw new Error('尚未設定指令碼屬性 SHEET_ID');
  var book = SpreadsheetApp.openById(id);
  var sheet = book.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = book.insertSheet(SHEET_NAME);
  return sheet;
}

/** 首次執行：建立標題列並授權 */
function setup() {
  var sheet = getSheet_();
  var headers = COLUMNS.map(function (column) { return column[1]; });
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#cdeeff');
  sheet.setFrozenRows(1);
  // 身分證字號、出生年月日強制文字格式，避免被當成數字或日期而變形
  var idCol = columnIndex_('idNumber');
  var birthCol = columnIndex_('birth');
  sheet.getRange(2, idCol, sheet.getMaxRows() - 1, 1).setNumberFormat('@');
  sheet.getRange(2, birthCol, sheet.getMaxRows() - 1, 1).setNumberFormat('@');
  getSignatureFolder_(); // 順便建立／確認簽名資料夾
  Logger.log('setup 完成，共 ' + headers.length + ' 欄');
}

function columnIndex_(key) {
  for (var i = 0; i < COLUMNS.length; i++) {
    if (COLUMNS[i][0] === key) return i + 1;
  }
  throw new Error('找不到欄位 ' + key);
}

function getSignatureFolder_() {
  var id = props_().getProperty('DRIVE_FOLDER_ID');
  if (id) return DriveApp.getFolderById(id);
  var folders = DriveApp.getFoldersByName('3D列印創客營_報名簽名');
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('3D列印創客營_報名簽名');
  props_().setProperty('DRIVE_FOLDER_ID', folder.getId());
  return folder;
}

/** 把 base64 PNG 存成 Drive 檔案，回傳可點擊連結；失敗不擋報名 */
function saveSignature_(dataUrl, refCode, studentName) {
  if (!dataUrl) return '';
  try {
    var base64 = String(dataUrl).replace(/^data:image\/png;base64,/, '');
    var blob = Utilities.newBlob(
      Utilities.base64Decode(base64),
      'image/png',
      refCode + '_' + studentName + '.png'
    );
    var file = getSignatureFolder_().createFile(blob);
    return file.getUrl();
  } catch (error) {
    Logger.log('簽名圖儲存失敗：' + error);
    return '（簽名圖儲存失敗）';
  }
}

function json_(object) {
  return ContentService
    .createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 健康檢查：瀏覽器直接開 /exec 會看到這個 */
function doGet() {
  return json_({ ok: true, service: '3D列印創客營報名接收', time: new Date().toISOString() });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, error: '沒有收到資料' });
    }

    var data = JSON.parse(e.postData.contents);

    // 共用密鑰檢查：設了才驗，避免有人直接打這個網址灌資料
    var expected = props_().getProperty('SHARED_TOKEN');
    if (expected && data.token !== expected) {
      Logger.log('token 不符，已拒絕');
      return json_({ ok: false, error: 'unauthorized' });
    }

    var refCode = String(data.refCode || '');
    var studentName = String(data.studentName || '');

    var sheet = getSheet_();

    // 重複送出保護：同一個報名編號只寫一次
    if (refCode) {
      var codeCol = columnIndex_('refCode');
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        var existing = sheet.getRange(2, codeCol, lastRow - 1, 1).getValues();
        for (var i = 0; i < existing.length; i++) {
          if (String(existing[i][0]) === refCode) {
            return json_({ ok: true, duplicate: true, refCode: refCode });
          }
        }
      }
    }

    var signatureLink = saveSignature_(data.signatureImage, refCode, studentName);

    var values = COLUMNS.map(function (column) {
      var key = column[0];
      if (key === 'receivedAt') {
        return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
      }
      if (key === 'signatureLink') return signatureLink;
      if (key === 'allergies') {
        return Array.isArray(data.allergies) ? data.allergies.join('、') : String(data.allergies || '');
      }
      if (key === 'termsAgree') return data.termsAgree === true ? '同意' : '未同意';
      // 身分證字號與出生年月日前面不加撇號，改靠 setup() 設定的文字格式保留原樣
      var value = data[key];
      return value === undefined || value === null ? '' : String(value);
    });

    sheet.appendRow(values);

    return json_({ ok: true, refCode: refCode });
  } catch (error) {
    Logger.log('doPost 失敗：' + error);
    return json_({ ok: false, error: String(error) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}
