import { AlertTriangle, CheckCircle, TrendingUp, Lightbulb, Loader2 } from "lucide-react";

interface AnalysisResultProps {
  content: string;
  isLoading: boolean;
}

export default function AnalysisResult({ content, isLoading }: AnalysisResultProps) {
  if (!content && !isLoading) return null;

  const renderMarkdown = (text: string) => {
    // Simple markdown rendering
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
      // Inline bold
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
      </div>
      <div className="prose prose-sm max-w-none">
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
