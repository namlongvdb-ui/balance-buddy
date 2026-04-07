import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FilePayload {
  name: string;
  mimeType: string;
  base64: string;
}

async function extractTextFromFiles(
  files: FilePayload[],
  apiKey: string,
  label: string
): Promise<string> {
  if (!files || files.length === 0) return "";

  const parts: { text?: string; inline_data?: { mime_type: string; data: string } }[] = [];
  parts.push({
    text: `Trích xuất toàn bộ nội dung văn bản, số liệu, bảng biểu từ các file ${label} sau đây. Trả về đúng nội dung gốc, giữ nguyên cấu trúc bảng và số liệu. QUAN TRỌNG: Giữ nguyên 100% tất cả ngày tháng năm như trong file gốc, KHÔNG được thay đổi năm hay bất kỳ thành phần nào của ngày tháng. Ví dụ nếu file ghi "01/03/2026" thì phải trả về đúng "01/03/2026", KHÔNG được đổi thành 2023 hay bất kỳ năm nào khác. Chỉ trả về nội dung trích xuất, không thêm nhận xét.`,
  });

  for (const file of files) {
    // Map common extensions to supported MIME types
    let mimeType = file.mimeType;
    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else if (file.name.endsWith(".docx")) {
      mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    } else if (file.name.endsWith(".csv")) {
      mimeType = "text/csv";
    }

    parts.push({
      text: `\n--- File: ${file.name} ---`,
    });
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: file.base64,
      },
    });
  }

  const response = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: parts.map((p) => {
              if (p.inline_data) {
                return {
                  type: "image_url",
                  image_url: {
                    url: `data:${p.inline_data.mime_type};base64,${p.inline_data.data}`,
                  },
                };
              }
              return { type: "text", text: p.text };
            }),
          },
        ],
        stream: false,
        max_tokens: 16000,
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error(`File extraction error for ${label}:`, response.status, errText);
    return `[Không thể trích xuất nội dung file ${label}: ${response.status}]`;
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { extractedData, chartOfAccounts, files, chartFiles } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Extract text from uploaded files using Vision API
    const [fileContent, chartFileContent] = await Promise.all([
      extractTextFromFiles(files || [], LOVABLE_API_KEY, "báo cáo tài chính"),
      extractTextFromFiles(chartFiles || [], LOVABLE_API_KEY, "hệ thống tài khoản"),
    ]);

    // Combine all data sources
    let fullData = "";
    if (fileContent) fullData += fileContent + "\n\n";
    if (extractedData?.trim()) fullData += extractedData;

    let fullChart = chartOfAccounts || "";
    if (chartFileContent) {
      fullChart = fullChart ? `${fullChart}\n\n${chartFileContent}` : chartFileContent;
    }

    const systemPrompt = `Bạn là chuyên gia kiểm toán và kế toán tài chính với kinh nghiệm sâu rộng về:
- Chuẩn mực kế toán Việt Nam (VAS) và Thông tư 200/2014/TT-BTC
- Chuẩn mực báo cáo tài chính quốc tế (IFRS)
- Phân tích báo cáo tài chính doanh nghiệp

**NGUYÊN TẮC TUYỆT ĐỐI:**
- CHỈ sử dụng dữ liệu được cung cấp bên dưới. KHÔNG được tự bịa, suy luận, hoặc thêm bất kỳ số liệu nào không có trong dữ liệu gốc.
- Giữ nguyên 100% ngày tháng năm, tên đơn vị, số liệu như trong dữ liệu gốc. KHÔNG thay đổi năm hay bất kỳ thông tin nào.

Khi phân tích báo cáo cân đối kế toán, bạn cần:
1. Kiểm tra tính cân đối: Tổng Tài sản = Tổng Nguồn vốn
2. Kiểm tra từng khoản mục có hợp lý không (số dư âm bất thường, tỷ lệ bất thường)
3. So sánh với hệ thống tài khoản kế toán được cung cấp
4. Phân tích các chỉ số tài chính cơ bản (thanh khoản, đòn bẩy, hiệu quả)
5. Đưa ra nhận xét về những điểm chưa hợp lý, sai sót tiềm ẩn
6. Tư vấn cải thiện

**QUAN TRỌNG - PHÂN TÍCH TÀI KHOẢN CHI TIẾT:**
- Bạn PHẢI phân tích đến cấp tài khoản chi tiết (VD: 1111 - Tiền Việt Nam, 1112 - Ngoại tệ, 1121 - Tiền VNĐ gửi ngân hàng, 1122 - Ngoại tệ gửi ngân hàng, v.v.)
- Không chỉ phân tích ở cấp tài khoản tổng hợp (111, 112, 131...) mà phải đi sâu vào từng tài khoản chi tiết cấp 2, cấp 3 nếu có dữ liệu
- Kiểm tra số dư từng tài khoản chi tiết có hợp lý không, có phù hợp với bản chất tài khoản không
- So sánh tỷ trọng giữa các tài khoản chi tiết trong cùng một tài khoản tổng hợp
- Phát hiện các bất thường ở cấp chi tiết: số dư ngược chiều, giá trị quá lớn/nhỏ bất thường, tài khoản chi tiết không phù hợp

Trả lời bằng tiếng Việt. Format output dạng Markdown với các section rõ ràng:
## 🔍 Kiểm tra cân đối
## 📋 Phân tích theo tài khoản chi tiết
(Liệt kê và phân tích từng nhóm tài khoản với các tài khoản chi tiết bên trong)
## ⚠️ Các vấn đề phát hiện
## 📊 Phân tích chỉ số tài chính
## 💡 Tư vấn và khuyến nghị

Mỗi vấn đề cần nêu rõ: mã tài khoản (bao gồm cả mã chi tiết), tên khoản mục, giá trị, lý do bất thường, và đề xuất xử lý.`;

    const userMessage = `Hãy phân tích báo cáo cân đối kế toán sau. CHỈ SỬ DỤNG DỮ LIỆU DƯỚI ĐÂY, KHÔNG TỰ BỊA SỐ LIỆU:

${fullChart ? `HỆ THỐNG TÀI KHOẢN KẾ TOÁN:
${fullChart}

` : ''}DỮ LIỆU BÁO CÁO CÂN ĐỐI KẾ TOÁN:
${fullData}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Hệ thống đang quá tải, vui lòng thử lại sau." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Hết credits AI, vui lòng nạp thêm." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Lỗi hệ thống AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("analyze error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Lỗi không xác định" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
