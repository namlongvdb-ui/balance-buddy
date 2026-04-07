const FOLLOW_UP_URL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api/follow-up-analysis`
  : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/follow-up-analysis`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function fileToBase64(file: File): Promise<{ name: string; base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve({ name: file.name, base64, mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function streamFollowUp({
  conversationHistory,
  followUpQuestion,
  files,
  onDelta,
  onDone,
  onError,
}: {
  conversationHistory: ChatMessage[];
  followUpQuestion: string;
  files?: File[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  try {
    // Convert files to base64 for server-side extraction
    let filesPayload: { name: string; base64: string; mimeType: string }[] | undefined;
    if (files && files.length > 0) {
      filesPayload = await Promise.all(files.map(fileToBase64));
    }

    const resp = await fetch(FOLLOW_UP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(import.meta.env.VITE_API_BASE_URL ? {} : { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` }),
      },
      body: JSON.stringify({ conversationHistory, followUpQuestion, files: filesPayload }),
    });

    if (resp.status === 429) {
      onError("Hệ thống đang quá tải, vui lòng thử lại sau.");
      return;
    }
    if (!resp.ok || !resp.body) {
      onError("Không thể kết nối đến hệ thống phân tích.");
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") { streamDone = true; break; }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (e) {
    onError(e instanceof Error ? e.message : "Lỗi kết nối");
  }
}
