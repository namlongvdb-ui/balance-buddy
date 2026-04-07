/**
 * Trích xuất text từ các file PDF, DOCX, XLSX, CSV trên server
 * Không cần gửi file cho AI - đảm bảo dữ liệu chính xác 100%
 */

const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const XLSX = require("xlsx");

/**
 * Trích xuất text từ file base64
 * @param {string} base64 - Nội dung file dạng base64
 * @param {string} fileName - Tên file
 * @param {string} mimeType - MIME type
 * @returns {Promise<string>} - Nội dung text đã trích xuất
 */
async function extractTextFromBase64(base64, fileName, mimeType) {
  const buffer = Buffer.from(base64, "base64");
  const ext = fileName.toLowerCase().split(".").pop();

  try {
    switch (ext) {
      case "pdf":
        return await extractPDF(buffer, fileName);
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
        // Với file ảnh (jpg, png, bmp), không thể trích xuất text trên server
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
 * Trích xuất text từ PDF
 */
async function extractPDF(buffer, fileName) {
  console.log(`📄 Trích xuất PDF: ${fileName} (${(buffer.length / 1024).toFixed(1)} KB)`);
  const data = await pdfParse(buffer);
  const text = data.text || "";
  
  if (!text.trim()) {
    return `[File PDF ${fileName} không chứa text (có thể là scan/ảnh). Vui lòng dùng file Excel hoặc CSV]`;
  }
  
  console.log(`   ✅ Trích xuất được ${text.length} ký tự từ ${data.numpages} trang`);
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
    
    // Convert to CSV-like format to preserve structure
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
 * Trích xuất text từ danh sách files (format giống frontend gửi lên)
 * @param {Array<{name: string, mimeType: string, base64: string}>} files
 * @param {string} label - Nhãn cho log
 * @returns {Promise<string>} - Nội dung text đã gộp
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

module.exports = { extractTextFromFiles, extractTextFromBase64 };
