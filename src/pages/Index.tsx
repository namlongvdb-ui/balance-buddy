import { useState, useCallback } from "react";
import { BarChart3, BookOpen, Send, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import FileUploadZone from "@/components/FileUploadZone";
import AnalysisResult from "@/components/AnalysisResult";
import FollowUpInput from "@/components/FollowUpInput";
import { streamAnalysis } from "@/lib/streamChat";
import { streamFollowUp, ChatMessage } from "@/lib/streamFollowUp";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [chartOfAccounts, setChartOfAccounts] = useState("");
  const [chartFiles, setChartFiles] = useState<File[]>([]);
  const [manualData, setManualData] = useState("");
  const [analysisContent, setAnalysisContent] = useState("");
  const [followUpResults, setFollowUpResults] = useState<{ question: string; answer: string }[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFollowingUp, setIsFollowingUp] = useState(false);
  const { toast } = useToast();

  const handleFilesSelected = useCallback((newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const extractTextFromFileList = async (fileList: File[]): Promise<string[]> => {
    const texts: string[] = [];
    for (const file of fileList) {
      if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        texts.push(await file.text());
      } else if (
        file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.type === "application/vnd.ms-excel"
      ) {
        texts.push(`[File Excel: ${file.name} - Vui lòng nhập dữ liệu thủ công bên dưới hoặc sử dụng file CSV]`);
      } else {
        texts.push(`[File: ${file.name} - ${file.type}]`);
      }
    }
    return texts;
  };

  const extractTextFromFiles = async (): Promise<string> => {
    const texts = await extractTextFromFileList(files);
    if (manualData.trim()) {
      texts.push(manualData);
    }
    return texts.join("\n\n");
  };

  const handleAnalyze = async () => {
    if (files.length === 0 && !manualData.trim()) {
      toast({
        title: "Chưa có dữ liệu",
        description: "Vui lòng upload file hoặc nhập dữ liệu báo cáo.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisContent("");

    const extractedData = await extractTextFromFiles();

    // Build chart of accounts from text + uploaded files
    let fullChartOfAccounts = chartOfAccounts || "";
    if (chartFiles.length > 0) {
      const chartTexts = await extractTextFromFileList(chartFiles);
      const chartFileContent = chartTexts.join("\n\n");
      fullChartOfAccounts = fullChartOfAccounts
        ? `${fullChartOfAccounts}\n\n${chartFileContent}`
        : chartFileContent;
    }

    await streamAnalysis({
      extractedData,
      chartOfAccounts: fullChartOfAccounts || undefined,
      files,
      chartFiles,
      onDelta: (text) => {
        setAnalysisContent((prev) => prev + text);
      },
      onDone: () => {
        setIsAnalyzing(false);
        // Save initial analysis to conversation history
        setConversationHistory([]);
      },
      onError: (error) => {
        setIsAnalyzing(false);
        toast({
          title: "Lỗi phân tích",
          description: error,
          variant: "destructive",
        });
      },
    });
  };

  const handleFollowUp = async (question: string) => {
    setIsFollowingUp(true);
    
    // Build conversation history including initial analysis
    const history: ChatMessage[] = [
      ...conversationHistory,
    ];
    if (history.length === 0 && analysisContent) {
      history.push({ role: "assistant", content: analysisContent });
    }

    // Add new follow-up result placeholder
    const newIndex = followUpResults.length;
    setFollowUpResults((prev) => [...prev, { question, answer: "" }]);

    await streamFollowUp({
      conversationHistory: history,
      followUpQuestion: question,
      onDelta: (text) => {
        setFollowUpResults((prev) => {
          const updated = [...prev];
          updated[newIndex] = { ...updated[newIndex], answer: updated[newIndex].answer + text };
          return updated;
        });
      },
      onDone: () => {
        setIsFollowingUp(false);
        // Update conversation history
        setFollowUpResults((prev) => {
          const latest = prev[newIndex];
          setConversationHistory((ch) => [
            ...ch,
            ...(ch.length === 0 && analysisContent ? [{ role: "assistant" as const, content: analysisContent }] : []),
            { role: "user" as const, content: question },
            { role: "assistant" as const, content: latest.answer },
          ]);
          return prev;
        });
      },
      onError: (error) => {
        setIsFollowingUp(false);
        toast({
          title: "Lỗi phân tích",
          description: error,
          variant: "destructive",
        });
      },
    });
  };

  const handleReset = () => {
    setFiles([]);
    setChartFiles([]);
    setManualData("");
    setAnalysisContent("");
    setChartOfAccounts("");
    setFollowUpResults([]);
    setConversationHistory([]);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-primary">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20">
              <BarChart3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-heading font-bold text-primary-foreground">
                Phân tích Báo cáo Cân đối Kế toán
              </h1>
              <p className="text-xs text-primary-foreground/70">
                Hỗ trợ VAS & IFRS • AI phân tích chuyên sâu
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left: Input */}
          <div className="space-y-6">
            {/* Chart of accounts */}
            <div className="rounded-xl bg-card p-6 shadow-card border border-border">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="h-5 w-5 text-accent" />
                <h2 className="font-heading font-semibold text-foreground">
                  Hệ thống tài khoản kế toán
                </h2>
              </div>
              <div className="space-y-3">
                <FileUploadZone
                  files={chartFiles}
                  onFilesSelected={(newFiles) => setChartFiles((prev) => [...prev, ...newFiles])}
                  onRemoveFile={(index) => setChartFiles((prev) => prev.filter((_, i) => i !== index))}
                />
                <Textarea
                  value={chartOfAccounts}
                  onChange={(e) => setChartOfAccounts(e.target.value)}
                  placeholder="Hoặc nhập/dán hệ thống tài khoản kế toán tại đây...&#10;VD: 111 - Tiền mặt, 112 - Tiền gửi ngân hàng..."
                  className="min-h-[100px] text-sm resize-none"
                />
              </div>
            </div>

            {/* File upload */}
            <div className="rounded-xl bg-card p-6 shadow-card border border-border">
              <h2 className="font-heading font-semibold text-foreground mb-4">
                Báo cáo cân đối kế toán
              </h2>
              <FileUploadZone
                files={files}
                onFilesSelected={handleFilesSelected}
                onRemoveFile={handleRemoveFile}
              />
            </div>

            {/* Manual data input */}
            <div className="rounded-xl bg-card p-6 shadow-card border border-border">
              <h2 className="font-heading font-semibold text-foreground mb-4">
                Hoặc nhập dữ liệu thủ công
              </h2>
              <Textarea
                value={manualData}
                onChange={(e) => setManualData(e.target.value)}
                placeholder="Dán nội dung báo cáo cân đối kế toán tại đây...&#10;&#10;VD:&#10;TÀI SẢN NGẮN HẠN: 5,000,000,000&#10;  Tiền và tương đương tiền: 1,200,000,000&#10;  Phải thu ngắn hạn: 2,300,000,000&#10;..."
                className="min-h-[180px] text-sm resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="flex-1 h-12 text-base font-semibold"
              >
                <Send className="h-4 w-4 mr-2" />
                {isAnalyzing ? "Đang phân tích..." : "Phân tích báo cáo"}
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={isAnalyzing}
                className="h-12"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Right: Results */}
          <div>
            {!analysisContent && !isAnalyzing ? (
              <div className="rounded-xl bg-card p-8 shadow-card border border-border flex flex-col items-center justify-center min-h-[400px] text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5 mb-4">
                  <BarChart3 className="h-8 w-8 text-primary/40" />
                </div>
                <h3 className="font-heading font-semibold text-foreground mb-2">
                  Kết quả phân tích
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Upload báo cáo cân đối kế toán và nhấn "Phân tích" để AI kiểm tra và tư vấn cho bạn.
                </p>
              </div>
            ) : (
              <div className="sticky top-8">
                <AnalysisResult content={analysisContent} isLoading={isAnalyzing} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
