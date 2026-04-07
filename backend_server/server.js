require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { extractTextFromFiles, setGeminiCaller } = require("./file-extractor");

const app = express();
const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || "0.0.0.0";

// ===== PROXY AGENT =====
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const proxyAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : null;

if (proxyAgent) {
  console.log(`✅ Proxy được cấu hình: ${proxyUrl}`);
} else {
  console.log("⚠️  Không có proxy, kết nối trực tiếp ra Internet");
}

// ===== DATABASE =====
const pool = new Pool({
  host: process.env.DB_HOST || "10.24.16.77",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "db_can_doi",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
});

// ===== MIDDLEWARE =====
app.use(express.json({ limit: "50mb" }));
app.use(cors({ origin: "*" }));

// IP Whitelist middleware
const ALLOWED_IPS = (process.env.ALLOWED_IPS || "").split(",").map((s) => s.trim()).filter(Boolean);

function checkIP(req, res, next) {
  if (ALLOWED_IPS.length === 0) return next();
  const clientIP = req.ip || req.connection.remoteAddress || "";
  const normalizedIP = clientIP.replace("::ffff:", "");
  
  const allowed = ALLOWED_IPS.some((range) => {
    if (range.includes("/")) return ipInCIDR(normalizedIP, range);
    return normalizedIP === range;
  });

  if (allowed) return next();
  console.warn(`⛔ Truy cập bị từ chối từ IP: ${normalizedIP}`);
  return res.status(403).json({ error: "Truy cập bị từ chối" });
}

function ipInCIDR(ip, cidr) {
  const [range, bits] = cidr.split("/");
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  const ipNum = ip.split(".").reduce((a, o) => (a << 8) + parseInt(o), 0);
  const rangeNum = range.split(".").reduce((a, o) => (a << 8) + parseInt(o), 0);
  return (ipNum & mask) === (rangeNum & mask);
}

app.use(checkIP);

// ===== HELPER: Gọi Gemini API qua proxy =====
async function callGeminiAPI(body) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY chưa được cấu hình");

  const url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;

  const fetchOptions = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GEMINI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };

  if (proxyAgent) fetchOptions.agent = proxyAgent;

  const { default: fetch } = await import("node-fetch");
  return fetch(url, fetchOptions);
}

// ===== API: Phân tích cân đối kế toán =====
app.post("/api/analyze-balance-sheet", async (req, res) => {
  try {
    const { extractedData, chartOfAccounts, files, chartFiles } = req.body;

    console.log("📊 Bắt đầu phân tích báo cáo...");

    // TRÍCH XUẤT NỘI DUNG FILE TRÊN SERVER (không gửi cho AI)
    const [fileContent, chartFileContent] = await Promise.all([
      extractTextFromFiles(files || [], "báo cáo tài chính"),
      extractTextFromFiles(chartFiles || [], "hệ thống tài khoản"),
    ]);

    let fullData = "";
    if (fileContent) fullData += fileContent + "\n\n";
    if (extractedData?.trim()) fullData += extractedData;

    let fullChart = chartOfAccounts || "";
    if (chartFileContent) {
      fullChart = fullChart ? `${fullChart}\n\n${chartFileContent}` : chartFileContent;
    }

    if (!fullData.trim()) {
      return res.status(400).json({ error: "Không có dữ liệu để phân tích. Vui lòng kiểm tra file đã upload." });
    }

    // Log preview để debug
    console.log(`📋 Dữ liệu trích xuất: ${fullData.length} ký tự`);
    console.log(`📋 Preview 500 ký tự đầu:\n${fullData.substring(0, 500)}`);

    const systemPrompt = `Bạn là chuyên gia kiểm toán và kế toán tài chính với kinh nghiệm sâu rộng về:
- Chuẩn mực kế toán Việt Nam (VAS) và Thông tư 200/2014/TT-BTC
- Chuẩn mực báo cáo tài chính quốc tế (IFRS)
- Phân tích báo cáo tài chính doanh nghiệp

**NGUYÊN TẮC TUYỆT ĐỐI:**
- CHỈ sử dụng dữ liệu được cung cấp bên dưới. KHÔNG được tự bịa, suy luận, hoặc thêm bất kỳ số liệu nào không có trong dữ liệu gốc.
- Giữ nguyên 100% ngày tháng năm, tên đơn vị, số liệu như trong dữ liệu gốc. KHÔNG thay đổi năm hay bất kỳ thông tin nào.
- Nếu dữ liệu ghi kỳ 01/03/2026 đến 31/03/2026 thì phải ghi đúng như vậy, KHÔNG đổi thành năm khác.

Khi phân tích báo cáo cân đối kế toán, bạn cần:
1. Kiểm tra tính cân đối: Tổng Tài sản = Tổng Nguồn vốn
2. Kiểm tra từng khoản mục có hợp lý không
3. So sánh với hệ thống tài khoản kế toán được cung cấp
4. Phân tích các chỉ số tài chính cơ bản
5. Đưa ra nhận xét về những điểm chưa hợp lý
6. Tư vấn cải thiện

**QUAN TRỌNG - PHÂN TÍCH TÀI KHOẢN CHI TIẾT:**
- Phân tích đến cấp tài khoản chi tiết (cấp 2, cấp 3)
- Kiểm tra số dư từng tài khoản chi tiết
- Phát hiện các bất thường ở cấp chi tiết

Trả lời bằng tiếng Việt. Format Markdown:
## 🔍 Kiểm tra cân đối
## 📋 Phân tích theo tài khoản chi tiết
## ⚠️ Các vấn đề phát hiện
## 📊 Phân tích chỉ số tài chính
## 💡 Tư vấn và khuyến nghị`;

    const userMessage = `Hãy phân tích báo cáo cân đối kế toán sau. CHỈ SỬ DỤNG DỮ LIỆU DƯỚI ĐÂY, KHÔNG TỰ BỊA SỐ LIỆU:

${fullChart ? `HỆ THỐNG TÀI KHOẢN KẾ TOÁN:\n${fullChart}\n\n` : ""}DỮ LIỆU BÁO CÁO CÂN ĐỐI KẾ TOÁN:\n${fullData}`;

    console.log("🤖 Gọi Gemini API qua proxy...");

    const response = await callGeminiAPI({
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      stream: true,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ Gemini API error:", response.status, errText);
      if (response.status === 429) return res.status(429).json({ error: "Quá tải, thử lại sau." });
      if (response.status === 401) return res.status(401).json({ error: "GEMINI_API_KEY không hợp lệ." });
      return res.status(500).json({ error: `Lỗi API: ${response.status}` });
    }

    console.log("✅ Streaming kết quả phân tích...");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    response.body.pipe(res);
  } catch (e) {
    console.error("❌ Lỗi phân tích:", e.message);
    res.status(500).json({ error: e.message || "Lỗi không xác định" });
  }
});

// ===== API: Hỏi thêm (follow-up) =====
app.post("/api/follow-up-analysis", async (req, res) => {
  try {
    const { conversationHistory, followUpQuestion } = req.body;

    if (!followUpQuestion?.trim()) {
      return res.status(400).json({ error: "Vui lòng nhập yêu cầu phân tích." });
    }

    const systemPrompt = `Bạn là chuyên gia kiểm toán và kế toán tài chính. Tiếp tục phân tích dựa trên ngữ cảnh cuộc hội thoại. 
NGUYÊN TẮC: CHỈ sử dụng dữ liệu đã được cung cấp trước đó, KHÔNG tự bịa số liệu. Giữ nguyên ngày tháng năm gốc.
Trả lời bằng tiếng Việt, format Markdown.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []),
      { role: "user", content: followUpQuestion },
    ];

    const response = await callGeminiAPI({
      model: "gemini-2.5-flash",
      messages,
      stream: true,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ Gemini follow-up error:", response.status, errText);
      if (response.status === 429) return res.status(429).json({ error: "Quá tải, thử lại sau." });
      return res.status(500).json({ error: "Lỗi hệ thống AI" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    response.body.pipe(res);
  } catch (e) {
    console.error("❌ Lỗi follow-up:", e.message);
    res.status(500).json({ error: e.message || "Lỗi không xác định" });
  }
});

// ===== API: Test kết nối =====
app.get("/api/health", async (req, res) => {
  const checks = { server: "ok", database: "unknown", proxy: "unknown", gemini: "unknown" };

  try {
    await pool.query("SELECT 1");
    checks.database = "ok";
  } catch (e) {
    checks.database = `error: ${e.message}`;
  }

  try {
    const { default: fetch } = await import("node-fetch");
    const fetchOpts = { method: "GET" };
    if (proxyAgent) fetchOpts.agent = proxyAgent;
    const r = await fetch("https://generativelanguage.googleapis.com/", fetchOpts);
    checks.proxy = proxyAgent ? "ok (qua proxy)" : "ok (trực tiếp)";
    checks.gemini = r.status < 500 ? "reachable" : `status ${r.status}`;
  } catch (e) {
    checks.proxy = `error: ${e.message}`;
    checks.gemini = "unreachable";
  }

  const allOk = checks.database === "ok" && checks.gemini !== "unreachable";
  res.status(allOk ? 200 : 503).json(checks);
});

// ===== SERVE STATIC FRONTEND =====
const path = require("path");
const fs = require("fs");
const staticPath = path.join(__dirname, "public");
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api/")) {
      res.sendFile(path.join(staticPath, "index.html"));
    }
  });
}

// ===== START =====
app.listen(PORT, HOST, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║  📊 Balance Sheet Analyzer - Backend Server      ║
║  🌐 http://${HOST}:${PORT}                        ║
║  🔒 Proxy: ${proxyAgent ? proxyUrl : "Không"}     ║
║  💾 DB: ${process.env.DB_HOST || "10.24.16.77"}   ║
║  📂 Trích xuất file: LOCAL (pdf-parse, mammoth)  ║
╚══════════════════════════════════════════════════╝
  `);
});
