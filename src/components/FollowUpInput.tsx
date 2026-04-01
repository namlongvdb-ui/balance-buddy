import { useState } from "react";
import { Send, Loader2, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface FollowUpInputProps {
  onSubmit: (question: string) => void;
  isLoading: boolean;
}

export default function FollowUpInput({ onSubmit, isLoading }: FollowUpInputProps) {
  const [question, setQuestion] = useState("");

  const handleSubmit = () => {
    if (!question.trim() || isLoading) return;
    onSubmit(question.trim());
    setQuestion("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="rounded-xl bg-card p-4 shadow-card border border-border mt-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquarePlus className="h-4 w-4 text-accent" />
        <span className="text-sm font-semibold text-foreground">Yêu cầu phân tích thêm</span>
      </div>
      <div className="flex gap-2">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nhập yêu cầu phân tích thêm... (VD: Phân tích chi tiết nhóm tài khoản phải thu, So sánh tỷ lệ nợ...)"
          className="min-h-[60px] text-sm resize-none flex-1"
          disabled={isLoading}
        />
        <Button
          onClick={handleSubmit}
          disabled={isLoading || !question.trim()}
          size="icon"
          className="h-[60px] w-[60px] shrink-0"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
