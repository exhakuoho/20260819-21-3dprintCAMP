/**
 * Cloudflare Pages Function — 報名資料中繼
 *
 * 前端 POST /api/register → 本函式驗證後 → 轉發至 Google Apps Script → 寫入 Google Sheet
 * Apps Script 網址與共用密鑰存在環境變數，不會出現在前端原始碼。
 *
 * Cloudflare Pages → Settings → Environment variables 需設定：
 *   SHEETS_WEBHOOK_URL  （必要）Apps Script Web App 的 /exec 網址
 *   SHEETS_SHARED_TOKEN （建議）與 Apps Script 端 Script Property 相同的密鑰
 *   TURNSTILE_SECRET    （選用）啟用 Turnstile 驗證時填入
 *
 * Bindings（選用）：
 *   RATE_LIMIT  KV Namespace，綁了才會啟用 IP 頻率限制
 */

const MAX_BODY_BYTES = 300 * 1024; // 簽名 PNG 約 15–40KB，300KB 綽綽有餘
const RATE_LIMIT_MAX = 5; // 同一 IP
const RATE_LIMIT_WINDOW = 3600; // 每小時

const ID_LETTER_CODES = {
  A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, I: 34, J: 18,
  K: 19, L: 20, M: 21, N: 22, O: 35, P: 23, Q: 24, R: 25, S: 26, T: 27,
  U: 28, V: 29, W: 32, X: 30, Y: 31, Z: 33,
};

function isValidTwId(value) {
  if (!/^[A-Z][12ABCD]\d{8}$/.test(value)) return false;
  const code = ID_LETTER_CODES[value[0]];
  const second = /[ABCD]/.test(value[1]) ? String(ID_LETTER_CODES[value[1]] % 10) : value[1];
  const digits = `${Math.floor(code / 10)}${code % 10}${second}${value.slice(2)}`;
  const weights = [1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1];
  const sum = weights.reduce((total, weight, index) => total + weight * Number(digits[index]), 0);
  return sum % 10 === 0;
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function makeRefCode() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${String(now.getUTCFullYear()).slice(2)}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`;
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const random = Array.from(bytes, (b) => alphabet[b % 32]).join("");
  return `3D${date}-${random}`;
}

async function verifyTurnstile(secret, token, ip) {
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const result = await response.json().catch(() => null);
  return Boolean(result && result.success);
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method Not Allowed" }, 405);
  }
  if (!env.SHEETS_WEBHOOK_URL) {
    console.error("SHEETS_WEBHOOK_URL 未設定");
    return json({ ok: false, error: "報名系統尚未完成設定，請透過 LINE 與我們聯繫。" }, 503);
  }

  const ip = request.headers.get("CF-Connecting-IP") || "";

  // --- 頻率限制（綁了 KV 才啟用）---
  if (env.RATE_LIMIT && ip) {
    const key = `rl:${ip}`;
    const count = Number((await env.RATE_LIMIT.get(key)) || 0);
    if (count >= RATE_LIMIT_MAX) {
      return json({ ok: false, error: "送出次數過於頻繁，請稍後再試，或直接透過 LINE 報名。" }, 429);
    }
    await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW });
  }

  // --- 讀取並限制大小 ---
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ ok: false, error: "資料量過大，請重新簽名後再送出。" }, 413);
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "資料格式錯誤。" }, 400);
  }

  // --- 蜜罐 ---
  if (text(body.website, 50)) {
    console.warn("honeypot triggered", ip);
    return json({ ok: false, error: "送出失敗，請稍後再試。" }, 400);
  }

  // --- Turnstile（設了 secret 才驗）---
  if (env.TURNSTILE_SECRET) {
    const passed = await verifyTurnstile(env.TURNSTILE_SECRET, text(body.turnstileToken, 3000), ip);
    if (!passed) {
      return json({ ok: false, error: "驗證未通過，請重新完成「我不是機器人」後再送出。" }, 403);
    }
  }

  // --- 伺服器端重新驗證（不信任前端檢查）---
  const idNumber = text(body.idNumber, 10).toUpperCase();
  const email = text(body.email, 180);
  const phone = text(body.phone, 30);

  const required = {
    studentName: text(body.studentName, 50),
    school: text(body.school, 80),
    stage: text(body.stage, 10),
    grade: text(body.grade, 20),
    birth: text(body.birth, 10),
    parentName: text(body.parentName, 50),
    relation: text(body.relation, 20),
    signatureName: text(body.signatureName, 50),
  };
  const labels = {
    studentName: "學員姓名", school: "就讀學校", stage: "就學階段", grade: "年級",
    birth: "出生年月日", parentName: "家長／監護人姓名", relation: "與學生關係",
    signatureName: "家長姓名（正楷）",
  };
  for (const [field, value] of Object.entries(required)) {
    if (!value) return json({ ok: false, error: `「${labels[field]}」為必填欄位，請完整填寫。` }, 400);
  }
  if (!isValidTwId(idNumber)) {
    return json({ ok: false, error: "身分證字號格式有誤，請確認後重新輸入。" }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: "請輸入有效的電子信箱。" }, 400);
  }
  if (phone.replace(/\D/g, "").length < 8) {
    return json({ ok: false, error: "請輸入有效的聯絡電話。" }, 400);
  }
  if (body.termsAgree !== true) {
    return json({ ok: false, error: "請先同意個人資料蒐集與使用說明。" }, 400);
  }
  const signatureImage = typeof body.signatureImage === "string" ? body.signatureImage : "";
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signatureImage)) {
    return json({ ok: false, error: "請於簽名區完成家長／監護人親筆簽名。" }, 400);
  }

  // 報名編號一律由伺服器產生，前端送來的值不採用
  const refCode = makeRefCode();

  const payload = {
    batch: text(body.batch, 60) || "2026 3D列印創客營（8/19-21）",
    refCode,
    ...required,
    gender: text(body.gender, 10),
    idNumber,
    phone,
    emergency: text(body.emergency, 120),
    email,
    allergies: Array.isArray(body.allergies) ? body.allergies.map((item) => text(item, 30)).filter(Boolean) : [],
    allergyOther: text(body.allergyOther, 200),
    special: text(body.special, 500),
    photoConsent: body.photoConsent === "同意" ? "同意" : "不同意",
    termsAgree: true,
    signatureImage,
    notes: text(body.notes, 500),
    submittedAt: new Date().toISOString(),
    sourceIp: ip,
  };

  if (env.SHEETS_SHARED_TOKEN) payload.token = env.SHEETS_SHARED_TOKEN;

  // --- 轉發至 Apps Script ---
  try {
    const response = await fetch(env.SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`Apps Script 回應 ${response.status}`);
    const result = await response.json().catch(() => null);
    if (result && result.ok === false) throw new Error(result.error || "寫入未完成");
  } catch (error) {
    console.error("forward to apps script failed", error);
    return json({ ok: false, error: "目前無法送出報名，請稍後再試，或直接透過 LINE 與我們聯繫。" }, 502);
  }

  return json({ ok: true, refCode }, 201);
}
