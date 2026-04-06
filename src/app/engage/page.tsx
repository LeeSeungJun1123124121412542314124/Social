// src/app/engage/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { RefreshCw, Send, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface EngageItem {
  id: string;
  platform: string;
  triggerType: string;
  authorName: string | null;
  text: string;
  aiDraft: string | null;
  flaggedSales: boolean;
  status: string;
  fetchedAt: string;
}

interface AutoReplyRule {
  id: string;
  platform: string;
  triggerType: string;
  keywords: string | null;
  autoSend: boolean;
  isActive: boolean;
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-100 text-pink-700",
  threads: "bg-gray-100 text-gray-700",
  tiktok: "bg-blue-100 text-blue-700",
  youtube: "bg-red-100 text-red-700",
  x: "bg-sky-100 text-sky-700",
};

const FILTER_TABS = [
  { key: "all", label: "전체" },
  { key: "comment", label: "댓글" },
  { key: "dm", label: "DM" },
  { key: "sales", label: "🔴 세일즈" },
];

export default function EngagePage() {
  const [items, setItems] = useState<EngageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [pollingX, setPollingX] = useState(false);

  const selectedItem = items.find(i => i.id === selectedId) ?? null;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === "sales") { params.set("status", "sales"); }
      else if (filter === "comment" || filter === "dm") { params.set("triggerType", filter); }
      const res = await window.fetch(`/api/engage?${params}`);
      const data = await res.json() as { success: boolean; data: { items: EngageItem[]; total: number } };
      if (data.success) { setItems(data.data.items); setTotal(data.data.total); }
    } catch (e) {
      toast.error("목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const fetchRules = async () => {
    const res = await window.fetch("/api/engage/rules");
    const data = await res.json() as { success: boolean; data: AutoReplyRule[] };
    if (data.success) setRules(data.data);
  };

  useEffect(() => { void fetchItems(); }, [fetchItems]);
  useEffect(() => { if (showRules) void fetchRules(); }, [showRules]);

  useEffect(() => {
    if (selectedItem) setDraftText(selectedItem.aiDraft ?? "");
  }, [selectedItem]);

  const handleSend = async () => {
    if (!selectedId || !draftText.trim()) return;
    setSending(true);
    try {
      const res = await window.fetch(`/api/engage/${selectedId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draftText }),
      });
      const data = await res.json() as { success: boolean; error?: { message: string } };
      if (data.success) {
        toast.success("발송되었습니다.");
        setSelectedId(null);
        void fetchItems();
      } else {
        toast.error(data.error?.message ?? "발송 실패");
      }
    } finally {
      setSending(false);
    }
  };

  const handleIgnore = async () => {
    if (!selectedId) return;
    const res = await window.fetch(`/api/engage/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ignored" }),
    });
    if (!res.ok) { toast.error("상태 변경에 실패했습니다."); return; }
    setSelectedId(null);
    void fetchItems();
  };

  const handlePollX = async () => {
    setPollingX(true);
    try {
      const res = await window.fetch("/api/engage/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "x" }),
      });
      if (res.ok) {
        toast.success("X 갱신 완료");
        void fetchItems();
      } else {
        toast.error("X 갱신 실패");
      }
    } finally {
      setPollingX(false);
    }
  };

  const handleToggleAutoSend = async (rule: AutoReplyRule) => {
    await window.fetch(`/api/engage/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoSend: !rule.autoSend }),
    });
    void fetchRules();
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">댓글/DM 관리</h1>
          <p className="text-muted-foreground text-sm mt-0.5">전체 {total}건</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void fetchItems()}>
            <RefreshCw className="h-4 w-4 mr-1.5" />새로고침
          </Button>
          <Button variant="outline" size="sm" onClick={handlePollX} disabled={pollingX}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${pollingX ? "animate-spin" : ""}`} />
            X 수동 갱신
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowRules(v => !v)}>
            ⚙️ 자동응답 규칙
          </Button>
        </div>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1 border-b pb-2">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              filter === tab.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* 좌측: 수신함 리스트 */}
        <div className="w-72 flex-shrink-0 overflow-y-auto border rounded-lg">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-3 border-b">
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              수신된 항목이 없습니다.
            </div>
          ) : (
            items.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full text-left p-3 border-b hover:bg-muted/50 transition-colors ${
                  selectedId === item.id ? "bg-muted" : ""
                } ${item.status !== "pending" ? "opacity-50" : ""}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {item.flaggedSales && <span className="text-orange-500">●</span>}
                  <span className="text-sm font-medium truncate">
                    {item.authorName ?? "익명"}
                  </span>
                  <Badge className={`text-xs ml-auto ${PLATFORM_COLORS[item.platform] ?? ""}`}>
                    {item.platform}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{item.text}</p>
              </button>
            ))
          )}
        </div>

        {/* 우측: 상세 + AI 초안 */}
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
          {!selectedItem ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm border rounded-lg">
              좌측에서 항목을 선택하세요.
            </div>
          ) : (
            <>
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{selectedItem.authorName ?? "익명"}</span>
                  <Badge className={`text-xs ${PLATFORM_COLORS[selectedItem.platform] ?? ""}`}>
                    {selectedItem.platform}
                  </Badge>
                  <Badge variant="outline" className="text-xs">{selectedItem.triggerType}</Badge>
                  {selectedItem.flaggedSales && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />세일즈 감지
                    </Badge>
                  )}
                </div>
                <div className="bg-muted rounded-md p-3 text-sm">{selectedItem.text}</div>
              </div>

              <div className="border rounded-lg p-4 space-y-3 flex-1">
                <Label>🤖 AI 초안 (편집 가능)</Label>
                <Textarea
                  value={draftText}
                  onChange={e => setDraftText(e.target.value)}
                  rows={5}
                  placeholder="응답을 입력하거나 AI 초안을 수정하세요..."
                  disabled={selectedItem.status !== "pending"}
                />
                {selectedItem.status === "pending" && (
                  <div className="flex gap-2">
                    <Button onClick={() => void handleSend()} disabled={sending || !draftText.trim()} size="sm">
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      {sending ? "발송 중..." : "발송"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void handleIgnore()}>
                      <X className="h-3.5 w-3.5 mr-1.5" />무시
                    </Button>
                  </div>
                )}
                {selectedItem.status !== "pending" && (
                  <p className="text-xs text-muted-foreground">
                    {selectedItem.status === "replied" ? "✅ 답변 완료" : "⏭️ 무시됨"}
                  </p>
                )}
              </div>
            </>
          )}

          {/* 자동응답 규칙 섹션 */}
          {showRules && (
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-sm">⚙️ 자동응답 규칙</h3>
              {rules.length === 0 ? (
                <p className="text-xs text-muted-foreground">등록된 규칙이 없습니다.</p>
              ) : (
                rules.map(rule => (
                  <div key={rule.id} className="flex items-center justify-between border rounded p-2.5 text-sm">
                    <div>
                      <span className="font-medium">{rule.platform}</span>
                      <span className="text-muted-foreground mx-1">·</span>
                      <span>{rule.triggerType}</span>
                      {rule.keywords && (
                        <span className="text-xs text-muted-foreground ml-2">
                          키워드: {rule.keywords}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.autoSend}
                          onChange={() => void handleToggleAutoSend(rule)}
                          className="rounded"
                        />
                        자동발송
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={async () => {
                          await window.fetch(`/api/engage/rules/${rule.id}`, { method: "DELETE" });
                          void fetchRules();
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
              <RuleCreateForm onCreated={() => void fetchRules()} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RuleCreateForm({ onCreated }: { onCreated: () => void }) {
  const [platform, setPlatform] = useState("instagram");
  const [triggerType, setTriggerType] = useState("comment");
  const [keywords, setKeywords] = useState("");
  const [autoSend, setAutoSend] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await window.fetch("/api/engage/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          triggerType,
          keywords: keywords ? keywords.split(",").map(k => k.trim()) : undefined,
          autoSend,
        }),
      });
      setPlatform("instagram"); setTriggerType("comment"); setKeywords(""); setAutoSend(false);
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t pt-3 space-y-2">
      <p className="text-xs font-medium">규칙 추가</p>
      <div className="grid grid-cols-2 gap-2">
        <select
          className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
          value={platform} onChange={e => setPlatform(e.target.value)}
        >
          {["instagram","threads","tiktok","youtube","x"].map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
          value={triggerType} onChange={e => setTriggerType(e.target.value)}
        >
          <option value="comment">댓글</option>
          <option value="dm">DM</option>
        </select>
      </div>
      <Input
        placeholder="키워드 (쉼표 구분, 비우면 전체)"
        value={keywords}
        onChange={e => setKeywords(e.target.value)}
        className="h-8 text-sm"
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input type="checkbox" checked={autoSend} onChange={e => setAutoSend(e.target.checked)} className="rounded" />
          매칭 시 자동 발송
        </label>
        <Button size="sm" className="h-7 text-xs" onClick={() => void handleCreate()} disabled={saving}>
          {saving ? "저장 중..." : "추가"}
        </Button>
      </div>
    </div>
  );
}
