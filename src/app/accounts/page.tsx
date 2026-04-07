"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountCard } from "@/components/accounts/AccountCard";
import { PlatformSelector } from "@/components/accounts/PlatformSelector";
import { useAccounts } from "@/hooks/useAccounts";
import type { PlatformType } from "@/types/platform.types";

// useSearchParams를 사용하는 컴포넌트를 Suspense로 분리
function OAuthCallbackHandler({ refresh }: { refresh: () => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const success = searchParams.get("success");
    const err = searchParams.get("error");
    if (success === "connected") {
      toast.success("계정이 연동되었습니다.");
      refresh();
    } else if (err) {
      toast.error(`연동 실패: ${decodeURIComponent(err)}`);
    }
  }, [searchParams, refresh]);
  return null;
}

export default function AccountsPage() {
  const { accounts, loading, error, refresh, deleteAccount } = useAccounts();
  const [connectOpen, setConnectOpen] = useState(false);

  const handlePlatformSelect = (platform: PlatformType) => {
    window.location.href = `/api/accounts/auth/${platform}`;
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAccount(id);
      toast.success("계정 연동이 해제되었습니다.");
    } catch {
      toast.error("연동 해제에 실패했습니다.");
    }
  };

  return (
    <div className="space-y-6">
      {/* OAuth 콜백 처리 (Suspense 필수) */}
      <Suspense fallback={null}>
        <OAuthCallbackHandler refresh={refresh} />
      </Suspense>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SNS 계정</h1>
          <p className="text-muted-foreground mt-1">
            연동된 SNS 계정을 관리합니다.
          </p>
        </div>
        <Button onClick={() => setConnectOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          계정 연동
        </Button>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))
        ) : accounts.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <p>연동된 계정이 없습니다.</p>
            <p className="text-sm mt-1">
              &lsquo;계정 연동&rsquo; 버튼으로 SNS 계정을 추가하세요.
            </p>
          </div>
        ) : (
          accounts.map((account) => (
            <AccountCard
              key={account.id}
              {...account}
              tokenExpiresAt={
                account.tokenExpiresAt
                  ? new Date(account.tokenExpiresAt)
                  : null
              }
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>계정 연동</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              연동할 플랫폼을 선택하세요. 각 플랫폼의 공식 인증 페이지로
              이동합니다.
            </p>
            <PlatformSelector onSelect={handlePlatformSelect} />
            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-1">
              <p>🔒 토큰은 암호화되어 저장되며 외부로 전송되지 않습니다.</p>
              <p>📱 연동 중 문제가 있으면 VPN을 끄고 다시 시도하세요.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
