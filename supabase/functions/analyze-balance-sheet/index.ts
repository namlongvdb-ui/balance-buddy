import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { extractedData, chartOfAccounts } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Bạn là chuyên gia kiểm toán và kế toán tài chính với kinh nghiệm sâu rộng về:
- Chuẩn mực kế toán Việt Nam (VAS) và Thông tư 200/2014/TT-BTC
- Chuẩn mực báo cáo tài chính quốc tế (IFRS)
- Phân tích báo cáo tài chính doanh nghiệp

Khi phân tích báo cáo cân đối kế toán, bạn cần:
1. Kiểm tra tính cân đối: Tổng Tài sản = Tổng Nguồn vốn
2. Kiểm tra từng khoản mục có hợp lý không (số dư âm bất thường, tỷ lệ bất thường)
3. So sánh với hệ thống tài khoản kế toán được cung cấp
4. Phân tích các chỉ số tài chính cơ bản (thanh khoản, đòn bẩy, hiệu quả)
5. Đưa ra nhận xét về những điểm chưa hợp lý, sai sót tiềm ẩn
6. Tư vấn cải thiện

Trả lời bằng tiếng Việt. Format output dạng Markdown với các section rõ ràng:
## 🔍 Kiểm tra cân đối
## ⚠️ Các vấn đề phát hiện
## 📊 Phân tích chỉ số tài chính
## 💡 Tư vấn và khuyến nghị

Mỗi vấn đề cần nêu rõ: mã tài khoản, tên khoản mục, giá trị, lý do bất thường, và đề xuất xử lý.`;

    const userMessage = `Hãy phân tích báo cáo cân đối kế toán sau:

${chartOfAccounts ? `HỆ THỐNG TÀI KHOẢN KẾ TOÁN:
${chartOfAccounts}

` : ''}DỮ LIỆU BÁO CÁO CÂN ĐỐI KẾ TOÁN:
${extractedData}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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
