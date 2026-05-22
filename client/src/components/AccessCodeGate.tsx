import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, KeyRound } from "lucide-react";
import { toast } from "sonner";

const SESSION_KEY = "access_code_verified";

type Props = {
  children: React.ReactNode;
};

/**
 * ログイン後に招待コードを要求するゲートコンポーネント。
 * - 招待コードが未設定の場合は子コンポーネントをそのまま表示する。
 * - セッション中に一度認証済みの場合は再入力不要。
 */
export default function AccessCodeGate({ children }: Props) {
  const [inputCode, setInputCode] = useState("");
  const [verified, setVerified] = useState(() => {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  });

  const { data: isSetData, isLoading: isSetLoading } = trpc.accessCode.isSet.useQuery(undefined, {
    retry: false,
  });

  const verifyMutation = trpc.accessCode.verify.useMutation({
    onSuccess: (data) => {
      if (data.valid) {
        sessionStorage.setItem(SESSION_KEY, "1");
        setVerified(true);
      } else {
        toast.error("招待コードが正しくありません");
        setInputCode("");
      }
    },
    onError: () => {
      toast.error("認証に失敗しました。もう一度お試しください。");
    },
  });

  // コードが未設定なら即通過
  useEffect(() => {
    if (!isSetLoading && isSetData && !isSetData.isSet) {
      setVerified(true);
    }
  }, [isSetData, isSetLoading]);

  if (isSetLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (verified) {
    return <>{children}</>;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) {
      toast.error("招待コードを入力してください");
      return;
    }
    verifyMutation.mutate({ code: inputCode.trim() });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-sm mx-4">
        <div className="rounded-xl border bg-card shadow-md overflow-hidden">
          {/* ヘッダー */}
          <div className="px-6 py-5 border-b bg-muted/30 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-base">招待コードが必要です</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                このシステムにアクセスするには招待コードを入力してください
              </p>
            </div>
          </div>

          {/* フォーム */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="access-code">
                招待コード
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="access-code"
                  type="password"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="招待コードを入力"
                  className="pl-9"
                  autoFocus
                  autoComplete="off"
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={verifyMutation.isPending}
            >
              {verifyMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  確認中...
                </span>
              ) : (
                "アクセスする"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
