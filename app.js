/* 2026 3D列印創客營｜靜態版互動邏輯
   - 頁面資料與互動：由原 Next.js page.tsx 轉寫
   - 報名表單：直接 POST 至 Google Apps Script Web App，寫入 Google Sheet
*/

/* ============ 送出設定 ============ */
// 報名資料送到本站自己的 Pages Function，再由後端轉發到 Google Apps Script。
// Apps Script 的網址存在 Cloudflare 環境變數，不會出現在前端原始碼裡。
const SUBMIT_ENDPOINT = "/api/register";
const BATCH_LABEL = "2026 3D列印創客營（8/19-21）";
// 選用：到 Cloudflare → Turnstile 申請後把 site key 填進來，填了才會顯示驗證元件
const TURNSTILE_SITE_KEY = "";

/* ============ 頁面資料 ============ */
const dayPlans = [
  {
    day: "DAY 01",
    date: "8.19 WED",
    role: "3D 建模設計師",
    title: "從想法到數位模型",
    color: "blue",
    outcome: "完成一件可列印的個人立體姓名牌",
    items: [
      ["08:00", "報到、領取資料與分組"],
      ["08:30", "活動開始、破冰與三日任務說明"],
      ["09:00", "3D 列印原理與安全操作"],
      ["10:35", "Tinkercad 基礎建模"],
      ["13:00", "個人作品：立體姓名牌"],
      ["14:20", "模型檢查、修正與發表"],
      ["16:00", "環境整理、當日回顧與賦歸"],
    ],
  },
  {
    day: "DAY 02",
    date: "8.20 THU",
    role: "3D 列印工程師",
    title: "切片、參數與原創人偶",
    color: "yellow",
    outcome: "完成原創人偶模型、STL 檔案並安排列印",
    items: [
      ["08:00", "報到與第一天作品領取"],
      ["08:30", "活動開始、作品觀察與問題記錄"],
      ["09:00", "切片軟體與失敗案例分析"],
      ["10:35", "實機操作與參數實驗"],
      ["13:00", "人偶設計概念與個人建模"],
      ["15:10", "模型檢查、切片與上色規劃"],
      ["16:00", "環境整理、當日回顧與賦歸"],
    ],
  },
  {
    day: "DAY 03",
    date: "8.21 FRI",
    role: "創客挑戰日",
    title: "組裝、上色、測試與改良",
    color: "mint",
    outcome: "完成原創人偶、創客任務與成果發表",
    items: [
      ["08:00", "報到與人偶作品領取"],
      ["08:30", "活動開始、作品檢查與任務說明"],
      ["09:00", "後處理、修邊與試組"],
      ["10:45", "人偶作品上色"],
      ["13:00", "限時創客任務與最終測試"],
      ["15:00", "成果發表、頒獎與合照"],
      ["16:00", "環境整理、作品領取與賦歸"],
    ],
  },
];

const abilities = [
  ["01", "3D 設計與創客力", "運用基本幾何形體，完成具有個人風格的設計。"],
  ["02", "數位製造理解", "理解模型、切片參數與實體列印結果之間的關係。"],
  ["03", "工程解決能力", "辨識厚度、懸空、支撐、公差與列印失敗問題。"],
  ["04", "美感與表達力", "完成作品上色、說明卡，並向大家分享創作歷程。"],
];

const terms = [
  ["FDM", "熔融沉積成型", "將熱塑性線材熔融後，逐層堆疊成形。"],
  ["Slicing", "切片", "把 3D 模型轉換為印表機可執行的路徑。"],
  ["STL", "模型格式", "記錄模型表面三角網格資料的常用交換格式。"],
  ["Infill", "填充", "模型內部結構密度，影響強度、重量與材料用量。"],
  ["Support", "支撐", "托住懸空結構，列印完成後再拆除。"],
  ["Tolerance", "公差", "設計尺寸與實際製造尺寸間允許的差異。"],
];

const processSteps = ["想法", "建模", "切片", "列印", "後處理", "發表"];

/* ============ 小工具 ============ */
const $ = (selector) => document.querySelector(selector);
const pad2 = (value) => String(value).padStart(2, "0");

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ============ 靜態區塊渲染 ============ */
function renderProcess() {
  const host = $("#processLine");
  processSteps.forEach((step, index) => {
    const row = el("div");
    row.append(el("span", null, pad2(index + 1)), el("strong", null, step));
    host.append(row);
  });
}

function renderAbilities() {
  const host = $("#abilityGrid");
  abilities.forEach(([number, title, description]) => {
    const card = el("article", "ability-card");
    const icon = el("div", `ability-icon icon-${number}`);
    icon.setAttribute("aria-hidden", "true");
    icon.append(el("i"), el("i"), el("i"));
    card.append(
      el("span", "ability-number", number),
      icon,
      el("h3", null, title),
      el("p", null, description),
    );
    host.append(card);
  });
}

function renderTerms() {
  const host = $("#termsList");
  terms.forEach(([term, chinese, detail]) => {
    const article = el("article");
    article.append(el("span", null, term), el("strong", null, chinese), el("p", null, detail));
    host.append(article);
  });
}

/* ============ 三日課程分頁 ============ */
let activeDay = 0;

function renderDayTabs() {
  const host = $("#dayTabs");
  host.textContent = "";
  dayPlans.forEach((plan, index) => {
    const button = el("button", index === activeDay ? `active ${plan.color}` : plan.color);
    button.type = "button";
    button.setAttribute("role", "tab");
    button.id = `dayTab${index}`;
    button.setAttribute("aria-controls", "dayPanel");
    button.setAttribute("aria-selected", String(index === activeDay));
    button.tabIndex = index === activeDay ? 0 : -1;
    button.append(el("span", null, plan.day), el("strong", null, plan.date), el("small", null, plan.role));
    button.addEventListener("click", () => {
      activeDay = index;
      renderDayTabs();
      renderDayPanel();
    });
    button.addEventListener("keydown", (event) => {
      const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      event.preventDefault();
      activeDay = (index + step + dayPlans.length) % dayPlans.length;
      renderDayTabs();
      renderDayPanel();
      document.getElementById(`dayTab${activeDay}`).focus();
    });
    host.append(button);
  });
}

function renderDayPanel() {
  const plan = dayPlans[activeDay];
  const panel = $("#dayPanel");
  panel.className = `day-panel ${plan.color}`;
  panel.setAttribute("aria-labelledby", `dayTab${activeDay}`);
  panel.textContent = "";

  const title = el("div", "day-panel-title");
  title.append(
    el("span", null, plan.date),
    el("h3", null, plan.title),
    el("p", null, `本日成果：${plan.outcome}`),
  );

  const timeline = el("div", "timeline");
  plan.items.forEach(([time, item], index) => {
    const row = el("div", "timeline-row");
    row.append(el("span", null, time), el("i", null, pad2(index + 1)), el("strong", null, item));
    timeline.append(row);
  });

  panel.append(title, timeline);
}

/* ============ 捲動進度條與選單 ============ */
function initScrollProgress() {
  const bar = $("#scrollProgress");
  const onScroll = () => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = `${total > 0 ? (window.scrollY / total) * 100 : 0}%`;
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

function initMenu() {
  const button = $("#menuButton");
  const nav = $("#mainNav");
  const setOpen = (open) => {
    nav.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "關閉導覽選單" : "開啟導覽選單");
  };
  button.addEventListener("click", () => setOpen(!nav.classList.contains("open")));
  document.querySelectorAll("[data-close-menu]").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });
}

/* ============ 年級連動 ============ */
const gradesByStage = {
  國小: ["一年級", "二年級", "三年級", "四年級", "五年級", "六年級"],
  國中: ["一年級", "二年級", "三年級"],
  高中: ["一年級", "二年級", "三年級"],
};

function initStageGrade() {
  const stage = $("#stageSelect");
  const grade = $("#gradeSelect");
  stage.addEventListener("change", () => {
    grade.textContent = "";
    const placeholder = el("option", null, "請選擇年級");
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;
    grade.append(placeholder);
    (gradesByStage[stage.value] || []).forEach((name) => grade.append(el("option", null, name)));
  });
}

/* ============ 簽名手寫板 ============ */
function initSignaturePad() {
  const canvas = $("#signaturePad");
  const hint = $("#sigHint");
  const context = canvas.getContext("2d");
  let drawing = false;
  let hasInk = false;

  context.lineWidth = 4;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#244652";

  const point = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    drawing = true;
    canvas.setPointerCapture(event.pointerId);
    const { x, y } = point(event);
    context.beginPath();
    context.moveTo(x, y);
    if (!hasInk) {
      hasInk = true;
      hint.hidden = true;
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!drawing) return;
    event.preventDefault();
    const { x, y } = point(event);
    context.lineTo(x, y);
    context.stroke();
  });

  const stop = () => { drawing = false; };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
  canvas.addEventListener("pointerleave", stop);

  $("#clearSignature").addEventListener("click", () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    hasInk = false;
    hint.hidden = false;
  });

  return {
    isEmpty: () => !hasInk,
    // 白底輸出，避免 Sheet／文件檢視時透明背景看不到筆跡
    toDataURL: () => {
      const flat = document.createElement("canvas");
      flat.width = canvas.width;
      flat.height = canvas.height;
      const flatContext = flat.getContext("2d");
      flatContext.fillStyle = "#ffffff";
      flatContext.fillRect(0, 0, flat.width, flat.height);
      flatContext.drawImage(canvas, 0, 0);
      return flat.toDataURL("image/png");
    },
    clear: () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      hasInk = false;
      hint.hidden = false;
    },
  };
}

/* ============ 驗證 ============ */
const ID_LETTER_CODES = {
  A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, I: 34, J: 18,
  K: 19, L: 20, M: 21, N: 22, O: 35, P: 23, Q: 24, R: 25, S: 26, T: 27,
  U: 28, V: 29, W: 32, X: 30, Y: 31, Z: 33,
};

function isValidTwId(value) {
  if (!/^[A-Z][12ABCD]\d{8}$/.test(value)) return false;
  const code = ID_LETTER_CODES[value[0]];
  // 新式統一證號第二碼可能是 A–D，換算為對應數字
  const second = /[ABCD]/.test(value[1]) ? String(ID_LETTER_CODES[value[1]] % 10) : value[1];
  const digits = `${Math.floor(code / 10)}${code % 10}${second}${value.slice(2)}`;
  const weights = [1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1];
  const sum = weights.reduce((total, weight, index) => total + weight * Number(digits[index]), 0);
  return sum % 10 === 0;
}

function makeRefCode() {
  const now = new Date();
  const date = `${String(now.getFullYear()).slice(2)}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
  const random = Array.from({ length: 6 }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  return `3D${date}-${random}`;
}

/* ============ Turnstile（選用，未填 site key 就完全不載入） ============ */
function initTurnstile() {
  if (!TURNSTILE_SITE_KEY) return;
  const host = $("#turnstileBox");
  host.hidden = false;
  const widget = el("div", "cf-turnstile");
  widget.dataset.sitekey = TURNSTILE_SITE_KEY;
  widget.dataset.theme = "light";
  host.append(widget);
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
  script.async = true;
  script.defer = true;
  document.head.append(script);
}

/* ============ 送出 ============ */
function initForm() {
  const form = $("#registrationForm");
  const errorBox = $("#formError");
  const submitButton = $("#submitButton");
  const successCard = $("#successCard");
  const signature = initSignaturePad();
  const openedAt = Date.now();

  const showError = (message) => {
    errorBox.textContent = message;
    errorBox.hidden = false;
    errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  $("#resetForm").addEventListener("click", () => {
    successCard.hidden = true;
    form.hidden = false;
    form.reset();
    signature.clear();
    $("#gradeSelect").textContent = "";
    const placeholder = el("option", null, "請先選擇就學階段");
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;
    $("#gradeSelect").append(placeholder);
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.hidden = true;

    const data = new FormData(form);
    const get = (name) => String(data.get(name) || "").trim();

    // 機器人防護：蜜罐欄位被填、或開啟不到 5 秒就送出
    if (get("website") || Date.now() - openedAt < 5000) {
      showError("送出失敗，請稍候再試一次。");
      return;
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const idNumber = get("idNumber").toUpperCase();
    if (!isValidTwId(idNumber)) {
      showError("身分證字號格式有誤，請確認後重新輸入（例如 A123456789）。");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get("email"))) {
      showError("請輸入有效的電子信箱。");
      return;
    }
    if (!/\d{8,}/.test(get("phone").replace(/\D/g, ""))) {
      showError("請輸入有效的聯絡電話。");
      return;
    }
    if (signature.isEmpty()) {
      showError("請於簽名區完成家長／監護人親筆簽名。");
      return;
    }

    const refCode = makeRefCode();
    const payload = {
      batch: BATCH_LABEL,
      refCode,
      studentName: get("studentName"),
      school: get("school"),
      stage: get("stage"),
      grade: `${get("stage")}${get("grade")}`,
      gender: get("gender"),
      birth: get("birth"),
      idNumber,
      parentName: get("parentName"),
      relation: get("relation"),
      phone: get("phone"),
      emergency: `${get("emergencyName")}（${get("emergencyPhone")}）`,
      email: get("email"),
      allergies: data.getAll("allergies"),
      allergyOther: get("allergyOther"),
      special: get("special"),
      photoConsent: data.get("photoConsent") ? "同意" : "不同意",
      termsAgree: data.get("termsAgree") === "on",
      signatureName: get("signatureName"),
      signatureImage: signature.toDataURL(),
      notes: get("notes"),
    };

    if (TURNSTILE_SITE_KEY) {
      const token = String(data.get("cf-turnstile-response") || "");
      if (!token) {
        showError("請先完成「我不是機器人」驗證。");
        return;
      }
      payload.turnstileToken = token;
    }

    submitButton.disabled = true;
    submitButton.textContent = "正在送出…";

    try {
      const response = await fetch(SUBMIT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result || result.ok !== true) {
        throw new Error((result && result.error) || `伺服器回應 ${response.status}`);
      }
      // 以伺服器回傳的編號為準
      if (result.refCode) payload.refCode = result.refCode;
    } catch (error) {
      console.error("registration submit error", error);
      submitButton.disabled = false;
      submitButton.textContent = "送出報名資料 →";
      if (window.turnstile) window.turnstile.reset();
      showError(
        error instanceof Error && error.message && !error.message.startsWith("伺服器回應")
          ? error.message
          : "目前無法送出報名，請稍後再試，或直接透過 LINE 與我們聯繫。",
      );
      return;
    }

    $("#successCode").textContent = payload.refCode;
    form.hidden = true;
    successCard.hidden = false;
    successCard.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

/* ============ 啟動 ============ */
renderProcess();
renderAbilities();
renderTerms();
renderDayTabs();
renderDayPanel();
initScrollProgress();
initMenu();
initStageGrade();
initTurnstile();
initForm();
