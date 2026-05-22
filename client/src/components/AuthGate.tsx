import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, KeyRound, LogIn } from "lucide-react";
import { toast } from "sonner";

type Props = {
  children: React.ReactNode;
};

/**
 * ローカルストレージキー。
 * ユーザーのopenIdをキーにして認証済みフラグを保存する。
 * ログアウト時にクリアされる。
 */
const getAuthKey = (openId: string) => `auth_gate_verified_${openId}`;

/**
 * 認証ゲートコンポーネント。
 * 1. ログイン未済 → メールログイン画面への導線を表示
 * 2. ログイン済みだが認証コード未入力 → 認証コード入力画面を表示
 * 3. 認証済み（localStorage記録あり） → 子コンポーネントをそのまま表示
 *
 * 認証済みフラグはlocalStorageに保存するため、ブラウザを閉じて再度開いても
 * 同じメールアカウントでログインしている限り再認証不要。
 * ログアウトするとフラグがクリアされ、次回は再認証が必要になる。
 */
export default function AuthGate({ children }: Props) {
  const { user, loading: authLoading, logout: originalLogout } = useAuth();
  const [inputCode, setInputCode] = useState("");
  const [localVerified, setLocalVerified] = useState(false);

  // ユーザーが確定したらlocalStorageを確認
  useEffect(() => {
    if (!user) {
      setLocalVerified(false);
      return;
    }
    if (user.openId === "local-preview") {
      setLocalVerified(true);
      return;
    }
    const key = getAuthKey(user.openId);
    const stored = localStorage.getItem(key);
    if (stored === "1") {
      setLocalVerified(true);
    } else {
      setLocalVerified(false);
    }
  }, [user]);

  const authorizeMutation = trpc.auth.authorize.useMutation({
    onSuccess: (data) => {
      if (data.valid && user) {
        // localStorageに認証済みフラグを保存
        localStorage.setItem(getAuthKey(user.openId), "1");
        setLocalVerified(true);
        toast.success("認証が完了しました");
      } else {
        toast.error("認証コードが正しくありません");
        setInputCode("");
      }
    },
    onError: () => {
      toast.error("認証に失敗しました。もう一度お試しください。");
    },
  });

  // ローディング中
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 未ログイン → メールログイン画面
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-full max-w-sm mx-4">
          <div className="rounded-xl border bg-card shadow-md overflow-hidden">
            {/* ヘッダー */}
            <div className="px-6 py-5 border-b bg-muted/30 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                <LogIn className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-base">ログインが必要です</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  このシステムを利用するには許可済みメールアドレスでログインしてください
                </p>
              </div>
            </div>
            {/* ボタン */}
            <div className="px-6 py-5">
              <Button
                className="w-full"
                onClick={() => { window.location.href = getLoginUrl(); }}
              >
                メールアドレスでログイン
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 認証済み（localStorageにフラグあり）→ コンテンツを表示
  if (localVerified) {
    return <>{children}</>;
  }

  // ログイン済みだが認証コード未入力
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) {
      toast.error("認証コードを入力してください");
      return;
    }
    authorizeMutation.mutate({ code: inputCode.trim() });
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
              <h1 className="font-semibold text-base">認証コードが必要です</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                このシステムにアクセスするには認証コードを入力してください
              </p>
            </div>
          </div>
          {/* フォーム */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="auth-code">
                認証コード
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="auth-code"
                  type="password"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="認証コードを入力"
                  className="pl-9"
                  autoFocus
                  autoComplete="off"
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={authorizeMutation.isPending}
            >
              {authorizeMutation.isPending ? (
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
