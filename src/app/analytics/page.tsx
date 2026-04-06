"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { RefreshCw, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";

interface Snapshot {
  snapshotDate: string;
  impressions: number;
  reach: number;
  followers: number;
  platform: string;
}

interface TopPost {
  postId: string;
  platform: string;
  impressions: number;
  likes: number;
  title: string | null;
}

interface DashboardData {
  snapshots: Snapshot[];
  topPosts: TopPost[];
  summary: { totalImpressions: number; totalReach: number; followerGrowth: number };
}

const PLATFORMS = [
  { key: "all", emoji: "🌐", label: "전체" },
  { key: "instagram", emoji: "📸", label: "Instagram" },
  { key: "threads", emoji: "🧵", label: "Threads" },
  { key: "tiktok", emoji: "🎵", label: "TikTok" },
  { key: "youtube", emoji: "📺", label: "YouTube" },
  { key: "x", emoji: "🐦", label: "X" },
];

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const PERIOD_OPTIONS = [
  { value: "7", label: "7일" },
  { value: "30", label: "30일" },
  { value: "90", label: "90일" },
];

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#e879f9",
  threads: "#000000",
  tiktok: "#3b82f6",
  youtube: "#ef4444",
  x: "#0ea5e9",
  all: "#6366f1",
};

export default function AnalyticsPage() {
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [days, setDays] = useState("30");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.fetch(`/api/analytics?platform=${selectedPlatform}&days=${days}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { success: boolean; data: DashboardData };
      if (json.success) setData(json.data);
    } catch {
      toast.error("데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [selectedPlatform, days]);

  useEffect(() => { void fetchDashboard(); }, [fetchDashboard]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await window.fetch("/api/analytics/sync", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { success: boolean; data: { synced: number; failed: number } };
      if (json.success) {
        toast.success(`${json.data.synced}개 계정 동기화 완료${json.data.failed > 0 ? ` (${json.data.failed}건 실패)` : ""}`);
        // fetchDashboard는 내부에서 자체 에러 처리
        void fetchDashboard();
      }
    } catch {
      toast.error("동기화에 실패했습니다.");
    } finally {
      setSyncing(false);
    }
  };

  const handleGenerateReport = async () => {
    setReportLoading(true);
    setReport(null);
    try {
      const res = await window.fetch("/api/analytics/report", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { success: boolean; data: { report: string } };
      if (json.success) setReport(json.data.report);
      else toast.error("리포트 생성 실패");
    } catch {
      toast.error("리포트 생성에 실패했습니다.");
    } finally {
      setReportLoading(false);
    }
  };

  // 스냅샷을 날짜별로 집계 (차트용)
  const chartData = useMemo(() => {
    if (!data) return [];
    const byDate: Record<string, { date: string; impressions: number; reach: number }> = {};
    for (const s of data.snapshots) {
      const date = s.snapshotDate.slice(0, 10);
      if (!byDate[date]) byDate[date] = { date, impressions: 0, reach: 0 };
      byDate[date].impressions += s.impressions;
      byDate[date].reach += s.reach;
    }
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  // 사이드바용 플랫폼별 노출 합계
  const platformImpressions = useMemo(() => {
    if (!data) return {} as Record<string, number>;
    return data.snapshots.reduce<Record<string, number>>((acc, s) => {
      acc[s.platform] = (acc[s.platform] ?? 0) + s.impressions;
      return acc;
    }, {});
  }, [data]);

  // 전체 선택 시 플랫폼별 비교 데이터
  const platformBarData = useMemo(() => {
    if (!data || selectedPlatform !== "all") return [];
    const byPlatform: Record<string, number> = {};
    for (const s of data.snapshots) {
      byPlatform[s.platform] = (byPlatform[s.platform] ?? 0) + s.impressions;
    }
    return Object.entries(byPlatform).map(([platform, impressions]) => ({ platform, impressions }));
  }, [data, selectedPlatform]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">성과 분석</h1>
        <div className="flex gap-2 items-center">
          <select
            className="flex h-8 rounded-md border border-input bg-transparent px-2 text-sm"
            value={days}
            onChange={e => setDays(e.target.value)}
          >
            {PERIOD_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-4">
        {/* 좌측: 플랫폼 패널 */}
        <div className="w-48 flex-shrink-0 space-y-1">
          {PLATFORMS.map(p => (
            <button
              key={p.key}
              onClick={() => setSelectedPlatform(p.key)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex flex-col ${
                selectedPlatform === p.key
                  ? "bg-primary text-primary-foreground font-medium"
                  : "hover:bg-muted"
              }`}
            >
              <span>
                {p.emoji} {p.label}
                {p.key === "x" && (
                  <span className="text-xs text-muted-foreground ml-1">(수동)</span>
                )}
              </span>
              {p.key === "all" ? (
                data && (
                  <span className="text-xs text-muted-foreground">
                    {formatNumber(Object.values(platformImpressions).reduce((a, b) => a + b, 0))} 노출
                  </span>
                )
              ) : (
                platformImpressions[p.key] !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    {formatNumber(platformImpressions[p.key])} 노출
                  </span>
                )
              )}
            </button>
          ))}
        </div>

        {/* 우측: 대시보드 */}
        <div className="flex-1 space-y-4">
          {/* 우측 패널 헤더: 플랫폼명 + 동기화 버튼 */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {PLATFORMS.find(p => p.key === selectedPlatform)?.label ?? "전체"}
            </h2>
            <Button variant="outline" size="sm" onClick={() => void handleSync()} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
              동기화
            </Button>
          </div>

          {/* 요약 카드 */}
          <div className="grid grid-cols-3 gap-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}><CardContent className="pt-4"><Skeleton className="h-8 w-24" /></CardContent></Card>
              ))
            ) : (
              <>
                <Card>
                  <CardHeader className="pb-1 pt-3 px-4">
                    <CardTitle className="text-xs text-muted-foreground">총 노출</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className="text-2xl font-bold">{(data?.summary.totalImpressions ?? 0).toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1 pt-3 px-4">
                    <CardTitle className="text-xs text-muted-foreground">총 도달</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className="text-2xl font-bold">{(data?.summary.totalReach ?? 0).toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1 pt-3 px-4">
                    <CardTitle className="text-xs text-muted-foreground">팔로워 증감</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className={`text-2xl font-bold ${(data?.summary.followerGrowth ?? 0) >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {(data?.summary.followerGrowth ?? 0) >= 0 ? "+" : ""}{(data?.summary.followerGrowth ?? 0).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* 추이 차트 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {selectedPlatform === "all" ? "전체 노출 추이" : `${selectedPlatform} 노출 추이`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-40 w-full" /> : chartData.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                  데이터가 없습니다. 동기화를 실행해주세요.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="impressions"
                      stroke={PLATFORM_COLORS[selectedPlatform] ?? "#6366f1"}
                      dot={false}
                      strokeWidth={2}
                      name="노출"
                    />
                    <Line type="monotone" dataKey="reach" stroke="#94a3b8" dot={false} strokeWidth={1.5} name="도달" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* 전체일 때 플랫폼 비교 바 차트 */}
          {selectedPlatform === "all" && platformBarData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">플랫폼별 총 노출 비교</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={platformBarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="platform" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="impressions" name="노출" fill="#6366f1" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* TOP 게시물 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">🏆 TOP 게시물</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full mb-2" />)
              ) : (data?.topPosts.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">게시물 데이터가 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {data?.topPosts.map((post, i) => (
                    <div key={post.postId} className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground w-4">{i + 1}.</span>
                      <span className="flex-1 truncate">{post.title ?? "제목 없음"}</span>
                      <Badge variant="outline" className="text-xs">{post.platform}</Badge>
                      <span className="text-muted-foreground text-xs">노출 {post.impressions.toLocaleString()}</span>
                      <span className="text-muted-foreground text-xs">❤️ {post.likes}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI 주간 리포트 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">🤖 AI 주간 리포트</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleGenerateReport()}
                disabled={reportLoading}
              >
                <Wand2 className="h-4 w-4 mr-1.5" />
                {reportLoading ? "생성 중..." : "주간 리포트 생성"}
              </Button>
              {report && (
                <div className="bg-muted rounded-md p-4 text-sm">
                  <div className="whitespace-pre-wrap [&_h1]:text-lg [&_h1]:font-bold [&_h2]:font-semibold [&_h3]:font-medium [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-4 [&_li]:my-0.5">
                    <ReactMarkdown
                      components={{
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer">
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {report}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
