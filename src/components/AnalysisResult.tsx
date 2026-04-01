import { useRef } from "react";
import { AlertTriangle, CheckCircle, TrendingUp, Lightbulb, Loader2, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

interface AnalysisResultProps {
  content: string;
  isLoading: boolean;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^##\s*[🔍⚠️📊💡]?\s*/gm, "")
    .replace(/^###\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/^- /gm, "• ");
}

export default function AnalysisResult({ content, isLoading }: AnalysisResultProps) {
  const resultRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  if (!content && !isLoading) return null;

  const handleExportPDF = () => {
    if (!content) return;
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const maxWidth = pageWidth - margin * 2;
      let y = 20;

      // Title
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("KET QUA PHAN TICH BAO CAO CAN DOI KE TOAN", margin, y);
      y += 10;
      doc.setDrawColor(0, 120, 120);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      // Date
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Ngay xuat: ${new Date().toLocaleDateString("vi-VN")}`, margin, y);
      y += 10;

      // Content
      const plain = stripMarkdown(content);
      const lines = doc.splitTextToSize(plain, maxWidth);

      doc.setFontSize(10);
      for (const line of lines) {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += 5.5;
      }

      doc.save("phan-tich-can-doi-ke-toan.pdf");
      toast({ title: "Xuất PDF thành công!" });
    } catch {
      toast({ title: "Lỗi xuất PDF", variant: "destructive" });
    }
  };

  const handleExportDOCX = () => {
    if (!content) return;
    try {
      // Create a simple HTML-based doc that Word can open
      const plain = stripMarkdown(content);
      const html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:w="urn:schemas-microsoft-com:office:word"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8">
        <style>body{font-family:Arial;font-size:11pt;line-height:1.6}
        h1{color:#1e3a5f;font-size:16pt;border-bottom:2px solid #2a9d8f;padding-bottom:6pt}
        p{margin:4pt 0}</style></head>
        <body>
        <h1>Kết quả phân tích Báo cáo Cân đối Kế toán</h1>
        <p style="color:#888;font-size:9pt">Ngày xuất: ${new Date().toLocaleDateString("vi-VN")}</p>
        ${plain.split("\n").map((l) => `<p>${l}</p>`).join("")}
        </body></html>`;

      const blob = new Blob(["\ufeff" + html], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "phan-tich-can-doi-ke-toan.doc";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Xuất Word thành công!" });
    } catch {
      toast({ title: "Lỗi xuất Word", variant: "destructive" });
    }
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      if (line.startsWith("## 🔍")) {
        return (
          <h2 key={i} className="flex items-center gap-2 text-lg font-heading font-bold text-primary mt-6 mb-3">
            <CheckCircle className="h-5 w-5 text-success" />
            {line.replace("## 🔍 ", "")}
          </h2>
        );
      }
      if (line.startsWith("## ⚠️")) {
        return (
          <h2 key={i} className="flex items-center gap-2 text-lg font-heading font-bold text-primary mt-6 mb-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
            {line.replace("## ⚠️ ", "")}
          </h2>
        );
      }
      if (line.startsWith("## 📊")) {
        return (
          <h2 key={i} className="flex items-center gap-2 text-lg font-heading font-bold text-primary mt-6 mb-3">
            <TrendingUp className="h-5 w-5 text-info" />
            {line.replace("## 📊 ", "")}
          </h2>
        );
      }
      if (line.startsWith("## 💡")) {
        return (
          <h2 key={i} className="flex items-center gap-2 text-lg font-heading font-bold text-primary mt-6 mb-3">
            <Lightbulb className="h-5 w-5 text-accent" />
            {line.replace("## 💡 ", "")}
          </h2>
        );
      }
      if (line.startsWith("## ")) {
        return <h2 key={i} className="text-lg font-heading font-bold text-primary mt-6 mb-3">{line.replace("## ", "")}</h2>;
      }
      if (line.startsWith("### ")) {
        return <h3 key={i} className="text-base font-heading font-semibold text-foreground mt-4 mb-2">{line.replace("### ", "")}</h3>;
      }
      if (line.startsWith("- **")) {
        const match = line.match(/^- \*\*(.+?)\*\*:?\s*(.*)$/);
        if (match) {
          return (
            <div key={i} className="flex gap-2 py-1 pl-4">
              <span className="text-accent mt-1">•</span>
              <span className="text-sm">
                <strong className="text-foreground">{match[1]}</strong>
                {match[2] && <span className="text-muted-foreground">: {match[2]}</span>}
              </span>
            </div>
          );
        }
      }
      if (line.startsWith("- ")) {
        return (
          <div key={i} className="flex gap-2 py-1 pl-4">
            <span className="text-accent mt-1">•</span>
            <span className="text-sm text-foreground">{line.replace("- ", "")}</span>
          </div>
        );
      }
      if (line.startsWith("**") && line.endsWith("**")) {
        return <p key={i} className="text-sm font-semibold text-foreground mt-2">{line.replace(/\*\*/g, "")}</p>;
      }
      if (line.trim() === "") {
        return <div key={i} className="h-2" />;
      }
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <p key={i} className="text-sm text-foreground/90 leading-relaxed">
          {parts.map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={j} className="text-foreground">{part.replace(/\*\*/g, "")}</strong>
            ) : (
              part
            )
          )}
        </p>
      );
    });
  };

  return (
    <div className="rounded-xl bg-card p-6 shadow-card border border-border">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
        <h3 className="font-heading font-semibold text-foreground">Kết quả phân tích</h3>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-auto" />}
        {!isLoading && content && (
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <Download className="h-3.5 w-3.5 mr-1" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportDOCX}>
              <FileText className="h-3.5 w-3.5 mr-1" />
              Word
            </Button>
          </div>
        )}
      </div>
      <div ref={resultRef} className="prose prose-sm max-w-none">
        {renderMarkdown(content)}
        {isLoading && !content && (
          <div className="flex items-center gap-3 text-muted-foreground py-8 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Đang phân tích báo cáo...</span>
          </div>
        )}
      </div>
    </div>
  );
}
