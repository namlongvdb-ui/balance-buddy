/**
 * Trích xuất text từ các file PDF, DOCX, XLSX, CSV trên server
 * PDF: Sử dụng Gemini Vision API để giữ nguyên cấu trúc bảng (cột Nợ/Có)
 * DOCX/XLSX/CSV: Trích xuất trực tiếp trên server
 */

const mammoth = require("mammoth");
const XLSX = require("xlsx");

// Gemini API caller - sẽ được inject từ server.js
let _callGeminiForExtraction = null;

function setGeminiCaller(fn) {
  _callGeminiForExtraction = fn;
}

/**
 * Trích xuất text từ file base64
 */
async function extractTextFromBase64(base64, fileName, mimeType) {
  const buffer = Buffer.from(base64, "base64");
  const ext = fileName.toLowerCase().split(".").pop();

  try {
    switch (ext) {
      case "pdf":
        return await extractPDFViaGemini(base64, fileName);
      case "docx":
        return await extractDOCX(buffer, fileName);
      case "doc":
        return `[File DOC cũ: ${fileName} - Vui lòng chuyển sang DOCX hoặc PDF]`;
      case "xlsx":
      case "xls":
        return extractExcel(buffer, fileName);
      case "csv":
        return buffer.toString("utf-8");
      case "txt":
        return buffer.toString("utf-8");
      default:
        if (mimeType && mimeType.startsWith("image/")) {
          return `[File ảnh: ${fileName} - Không thể trích xuất text từ ảnh trên server]`;
        }
        return `[File không hỗ trợ: ${fileName} (${ext})]`;
    }
  } catch (err) {
    console.error(`❌ Lỗi trích xuất file ${fileName}:`, err.message);
    return `[Lỗi trích xuất file ${fileName}: ${err.message}]`;
  }
}

/**
 * Trích xuất text từ PDF bằng Gemini Vision API
 * Giữ nguyên cấu trúc bảng, phân biệt rõ cột Nợ và Có
 */
async function extractPDFViaGemini(base64, fileName) {
  console.log(`📄 Trích xuất PDF qua Gemini Vision: ${fileName}`);

  if (!_callGeminiForExtraction) {
    throw new Error("Gemini caller chưa được cấu hình. Gọi setGeminiCaller() trước.");
  }

  const extractionPrompt = `Bạn là chuyên gia trích xuất dữ liệu tài chính từ file PDF.

NHIỆM VỤ: Trích xuất TOÀN BỘ nội dung bảng cân đối kế toán từ file PDF này.

YÊU CẦU TUYỆT ĐỐI:
1. GIỮ NGUYÊN 100% tất cả số liệu, ngày tháng năm, tên đơn vị như trong file gốc
2. PHÂN BIỆT RÕ RÀNG cột NỢ và cột CÓ - đây là yêu cầu quan trọng nhất
3. Với mỗi dòng tài khoản, ghi rõ: số dư đầu kỳ (Nợ/Có), phát sinh trong kỳ (Nợ/Có), lũy kế từ đầu năm (Nợ/Có), số dư cuối kỳ (Nợ/Có)
4. Nếu một ô trống (không có số liệu), ghi rõ là "0" hoặc để trống, KHÔNG được tự bịa số

FORMAT OUTPUT - Mỗi dòng tài khoản phải theo format:
Mã TK: [mã] | Tên: [tên tài khoản] | Dư đầu kỳ Nợ: [số] | Dư đầu kỳ Có: [số] | PS trong kỳ Nợ: [số] | PS trong kỳ Có: [số] | LK Nợ: [số] | LK Có: [số] | Dư cuối kỳ Nợ: [số] | Dư cuối kỳ Có: [số]

LƯU Ý ĐẶC BIỆT:
- Tài khoản Hao mòn TSCĐ (305, 3051, 3052...) thường có số dư BÊN CÓ, KHÔNG PHẢI bên Nợ
- Tài khoản nguồn vốn (loại 6) có số dư bên CÓ
- Tài khoản tài sản (loại 1, 2) thường có số dư bên NỢ
- NHÌN KỸ vị trí cột trong bảng PDF để xác định đúng cột Nợ hay Có

Chỉ trả về dữ liệu trích xuất, không thêm nhận xét hay phân tích.`;

  const response = await _callGeminiForExtraction({
    model: "gemini-2.5-flash",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: extractionPrompt },
          {
            type: "image_url",
            image_url: {
              url: `data:application/pdf;base64,${base64}`,
            },
          },
        ],
      },
    ],
    stream: false,
    max_tokens: 32000,
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`❌ Gemini Vision PDF error:`, response.status, errText);
    // Fallback: thử dùng pdf-parse
    console.log(`⚠️ Fallback sang pdf-parse...`);
    const pdfParse = require("pdf-parse");
    const buffer = Buffer.from(base64, "base64");
    const data = await pdfParse(buffer);
    return data.text || `[Không thể trích xuất PDF ${fileName}]`;
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || "";

  console.log(`   ✅ Trích xuất PDF qua Vision: ${text.length} ký tự`);
  return text;
}

/**
 * Trích xuất text từ DOCX
 */
async function extractDOCX(buffer, fileName) {
  console.log(`📝 Trích xuất DOCX: ${fileName} (${(buffer.length / 1024).toFixed(1)} KB)`);
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value || "";

  if (!text.trim()) {
    return `[File DOCX ${fileName} rỗng hoặc không chứa text]`;
  }

  console.log(`   ✅ Trích xuất được ${text.length} ký tự`);
  return text;
}

/**
 * Trích xuất text từ Excel (XLSX/XLS)
 * Giữ nguyên cấu trúc bảng dạng text
 */
function extractExcel(buffer, fileName) {
  console.log(`📊 Trích xuất Excel: ${fileName} (${(buffer.length / 1024).toFixed(1)} KB)`);
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, dateNF: "dd/mm/yyyy" });

  let allText = "";
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: "\t", RS: "\n", dateNF: "dd/mm/yyyy" });

    if (csv.trim()) {
      allText += `\n--- Sheet: ${sheetName} ---\n`;
      allText += csv + "\n";
    }
  }

  if (!allText.trim()) {
    return `[File Excel ${fileName} rỗng]`;
  }

  console.log(`   ✅ Trích xuất được ${allText.length} ký tự từ ${workbook.SheetNames.length} sheet`);
  return allText;
}

/**
 * Trích xuất text từ danh sách files
 */
async function extractTextFromFiles(files, label) {
  if (!files || files.length === 0) return "";

  console.log(`📂 Bắt đầu trích xuất ${files.length} file ${label}...`);

  const results = [];
  for (const file of files) {
    const text = await extractTextFromBase64(file.base64, file.name, file.mimeType);
    if (text && !text.startsWith("[")) {
      results.push(`--- File: ${file.name} ---\n${text}`);
    } else {
      results.push(text);
    }
  }

  const combined = results.join("\n\n");
  console.log(`📂 Hoàn tất trích xuất ${label}: ${combined.length} ký tự tổng cộng`);
  return combined;
}

module.exports = { extractTextFromFiles, extractTextFromBase64, setGeminiCaller };
