const ANALYZE_URL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api/analyze-balance-sheet`
  : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-balance-sheet`;

interface FilePayload {
  name: string;
  mimeType: string;
  base64: string;
}

async function fileToBase64(file: File): Promise<FilePayload> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    base64: btoa(binary),
  };
}

export async function streamAnalysis({
  extractedData,
  chartOfAccounts,
  files,
  chartFiles,
  onDelta,
  onDone,
  onError,
}: {
  extractedData: string;
  chartOfAccounts?: string;
  files?: File[];
  chartFiles?: File[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  try {
    // Convert files to base64
    const filePayloads: FilePayload[] = [];
    if (files && files.length > 0) {
      for (const f of files) {
        filePayloads.push(await fileToBase64(f));
      }
    }

    const chartFilePayloads: FilePayload[] = [];
    if (chartFiles && chartFiles.length > 0) {
      for (const f of chartFiles) {
        chartFilePayloads.push(await fileToBase64(f));
      }
    }

    const resp = await fetch(ANALYZE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        extractedData,
        chartOfAccounts,
        files: filePayloads,
        chartFiles: chartFilePayloads,
      }),
    });

    if (resp.status === 429) {
      onError("Hệ thống đang quá tải, vui lòng thử lại sau.");
      return;
    }
    if (resp.status === 402) {
      onError("Hết credits AI, vui lòng nạp thêm.");
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
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

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
