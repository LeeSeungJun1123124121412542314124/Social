"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useContent } from "@/hooks/useContent";
import { POST_STATUS_LABELS } from "@/lib/constants";
import type { ContentPost } from "@/hooks/useContent";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  publishing: "bg-yellow-100 text-yellow-700",
  published: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  partial: "bg-orange-100 text-orange-700",
};

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedPost, setSelectedPost] = useState<ContentPost | null>(null);
  const { posts, loading } = useContent();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // 날짜별 게시물 그룹핑
  const postsByDate = posts.reduce<Record<string, ContentPost[]>>((acc, post) => {
    const date = post.scheduledAt ?? post.publishedAt ?? post.createdAt;
    const key = format(new Date(date), "yyyy-MM-dd");
    acc[key] = [...(acc[key] ?? []), post];
    return acc;
  }, {});

  const prevMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">콘텐츠 캘린더</h1>
          <p className="text-muted-foreground mt-1">
            예약 발행 일정을 관리합니다.
          </p>
        </div>
        <Button onClick={() => (router.push("/content/text"))}>
          <Plus className="h-4 w-4 mr-2" />
          새 콘텐츠
        </Button>
      </div>

      <Tabs defaultValue="calendar">
        <TabsList>
          <TabsTrigger value="calendar">캘린더</TabsTrigger>
          <TabsTrigger value="list">리스트</TabsTrigger>
        </TabsList>

        {/* 캘린더 뷰 */}
        <TabsContent value="calendar" className="mt-4">
          <div className="border rounded-lg overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 border-b bg-card">
              <Button variant="ghost" size="icon" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="font-semibold">
                {format(currentDate, "yyyy년 M월", { locale: ko })}
              </h2>
              <Button variant="ghost" size="icon" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 bg-muted/50">
              {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                <div
                  key={day}
                  className="py-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div className="grid grid-cols-7">
              {/* 첫 주 빈 칸 */}
              {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[100px] border-b border-r bg-muted/20" />
              ))}

              {days.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayPosts = postsByDate[key] ?? [];

                return (
                  <div
                    key={key}
                    className={`min-h-[100px] border-b border-r p-1.5 ${
                      isToday(day) ? "bg-primary/5" : ""
                    }`}
                  >
                    <div
                      className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday(day)
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {loading ? null : dayPosts.slice(0, 2).map((post) => (
                        <button
                          key={post.id}
                          onClick={() => setSelectedPost(post)}
                          className={`w-full text-left text-xs px-1 py-0.5 rounded truncate ${
                            STATUS_COLORS[post.status] ?? "bg-muted"
                          }`}
                        >
                          {post.title ?? post.contentText?.substring(0, 15) ?? "제목 없음"}
                        </button>
                      ))}
                      {dayPosts.length > 2 && (
                        <div className="text-xs text-muted-foreground px-1">
                          +{dayPosts.length - 2}개 더
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* 리스트 뷰 */}
        <TabsContent value="list" className="mt-4">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="예약된 콘텐츠가 없습니다"
              description="새 콘텐츠를 만들어 발행 일정을 잡아보세요."
              action={{ label: "새 콘텐츠 만들기", onClick: () => { router.push("/content/text"); } }}
            />
          ) : (
            <div className="space-y-2">
              {posts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className="w-full text-left border rounded-lg p-3 hover:bg-accent transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {post.title ?? post.contentText?.substring(0, 50) ?? "제목 없음"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {post.scheduledAt
                          ? `예약: ${format(new Date(post.scheduledAt), "M/d HH:mm")}`
                          : post.publishedAt
                          ? `발행: ${format(new Date(post.publishedAt), "M/d HH:mm")}`
                          : `생성: ${format(new Date(post.createdAt), "M/d HH:mm")}`}
                      </p>
                    </div>
                    <Badge
                      variant={post.status === "failed" ? "destructive" : "secondary"}
                      className="shrink-0 text-xs"
                    >
                      {POST_STATUS_LABELS[post.status] ?? post.status}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 게시물 상세 모달 */}
      {selectedPost && (
        <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedPost.title ?? "게시물 상세"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant={selectedPost.status === "failed" ? "destructive" : "secondary"}
                >
                  {POST_STATUS_LABELS[selectedPost.status] ?? selectedPost.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {selectedPost.type}
                </span>
              </div>
              {selectedPost.contentText && (
                <p className="text-sm whitespace-pre-wrap bg-muted rounded-md p-3">
                  {selectedPost.contentText}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedPost(null);
                    router.push("/content/text");
                  }}
                >
                  수정
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
