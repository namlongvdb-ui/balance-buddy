import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { conversationHistory, followUpQuestion } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!followUpQuestion?.trim()) {
      return new Response(JSON.stringify({ error: "Vui lòng nhập yêu cầu phân tích." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Bạn là chuyên gia kiểm toán và kế toán tài chính với kinh nghiệm sâu rộng về:
- Chuẩn mực kế toán Việt Nam (VAS) và Thông tư 200/2014/TT-BTC
- Chuẩn mực báo cáo tài chính quốc tế (IFRS)
- Phân tích báo cáo tài chính doanh nghiệp

Bạn đang tiếp tục phân tích báo cáo cân đối kế toán dựa trên kết quả phân tích trước đó.
Hãy trả lời yêu cầu mới của người dùng dựa trên ngữ cảnh cuộc hội thoại.

**QUAN TRỌNG:**
- Phân tích đến cấp tài khoản chi tiết (cấp 2, cấp 3) nếu liên quan
- Trả lời bằng tiếng Việt
- Format output dạng Markdown rõ ràng
- Nếu người dùng hỏi về một khía cạnh cụ thể, hãy đi sâu vào khía cạnh đó`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []),
      { role: "user", content: followUpQuestion },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Hệ thống đang quá tải, vui lòng thử lại sau." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    console.error("follow-up error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Lỗi không xác định" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
