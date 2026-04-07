import { useState, useRef, useCallback } from "react";
import { Send, Loader2, MessageSquarePlus, Paperclip, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
].join(",");

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface FollowUpInputProps {
  onSubmit: (question: string, files?: File[]) => void;
  isLoading: boolean;
}

export default function FollowUpInput({ onSubmit, isLoading }: FollowUpInputProps) {
  const [question, setQuestion] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if ((!question.trim() && files.length === 0) || isLoading) return;
    onSubmit(question.trim(), files.length > 0 ? files : undefined);
    setQuestion("");
    setFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
    e.target.value = "";
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-xl bg-card p-4 shadow-card border border-border mt-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquarePlus className="h-4 w-4 text-accent" />
        <span className="text-sm font-semibold text-foreground">Yêu cầu phân tích thêm</span>
      </div>

      {/* Attached files */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {files.map((file, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-xs">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="max-w-[120px] truncate font-medium">{file.name}</span>
              <span className="text-muted-foreground">({formatSize(file.size)})</span>
              <button onClick={() => removeFile(i)} className="ml-0.5 rounded hover:bg-destructive/10 p-0.5">
                <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhập yêu cầu phân tích thêm hoặc đính kèm file bổ sung..."
            className="min-h-[60px] text-sm resize-none pr-10"
            disabled={isLoading}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="absolute right-2 bottom-2 rounded-md p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
            title="Đính kèm file (PDF, DOCX, XLSX)"
          >
            <Paperclip className="h-4 w-4" />
          </button>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={isLoading || (!question.trim() && files.length === 0)}
          size="icon"
          className="h-[60px] w-[60px] shrink-0"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Hỗ trợ đính kèm: PDF, DOCX, XLSX, CSV
      </p>
    </div>
  );
}
