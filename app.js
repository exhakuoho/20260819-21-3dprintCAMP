/* 2026 3D列印創客營｜靜態版互動邏輯
   由原 Next.js page.tsx 轉寫。
   報名一律於高科大推廣教育處課程報名系統辦理，本站不收集任何個人資料。
*/

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
  ["01", "3D 設計與創客力", "運用基本幾何形體，完成具有個人風格的設計。", "icon-01-3d-design"],
  ["02", "數位製造理解", "理解模型、切片參數與實體列印結果之間的關係。", "icon-02-digital-manufacturing"],
  ["03", "工程解決能力", "辨識厚度、懸空、支撐、公差與列印失敗問題。", "icon-03-engineering-solution"],
  ["04", "美感與表達力", "完成作品上色、說明卡，並向大家分享創作歷程。", "icon-04-aesthetic-expression"],
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
  abilities.forEach(([number, title, description, iconFile]) => {
    const card = el("article", "ability-card");
    const icon = el("div", `ability-icon icon-${number}`);
    icon.setAttribute("aria-hidden", "true");
    const img = document.createElement("img");
    img.src = `/icons/${iconFile}.svg`;
    img.alt = "";
    img.width = 256;
    img.height = 256;
    icon.append(img);
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

/* ============ 啟動 ============ */
renderProcess();
renderAbilities();
renderTerms();
renderDayTabs();
renderDayPanel();
initScrollProgress();
initMenu();
