import {
  Link2,
  Layers,
  CalendarDays,
  BarChart2,
  MessageSquare,
  Zap,
  Repeat2,
  Video,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

const quickLinks = [
  {
    title: "SNS 계정 연동",
    description: "Instagram, Threads 등 계정을 연결하세요.",
    href: "/accounts",
    icon: Link2,
    iconColor: "text-pink-600",
    iconBg: "bg-pink-50 dark:bg-pink-900/20",
    cardBg: "bg-pink-50/40 dark:bg-pink-900/10",
  },
  {
    title: "카드뉴스 랩",
    description: "AI로 카드뉴스를 빠르게 제작합니다.",
    href: "/content/carousel",
    icon: Layers,
    iconColor: "text-violet-600 dark:text-violet-400",
    iconBg: "bg-violet-50 dark:bg-violet-900/20",
    cardBg: "bg-violet-50/40 dark:bg-violet-900/10",
  },
  {
    title: "콘텐츠 캘린더",
    description: "예약 발행 일정을 관리합니다.",
    href: "/calendar",
    icon: CalendarDays,
    iconColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-50 dark:bg-blue-900/20",
    cardBg: "bg-blue-50/40 dark:bg-blue-900/10",
  },
  {
    title: "성과 분석",
    description: "채널별 지표와 AI 인사이트를 확인합니다.",
    href: "/analytics",
    icon: BarChart2,
    iconColor: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-50 dark:bg-emerald-900/20",
    cardBg: "bg-emerald-50/40 dark:bg-emerald-900/10",
  },
  {
    title: "AI 대량 기획",
    description: "오디언스 맞춤 아이디어를 한 번에 생성합니다.",
    href: "/content/bulk",
    icon: Zap,
    iconColor: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-50 dark:bg-amber-900/20",
    cardBg: "bg-amber-50/40 dark:bg-amber-900/10",
  },
  {
    title: "숏폼 영상",
    description: "30~60초 숏폼 스크립트를 자동으로 제작합니다.",
    href: "/content/short-form",
    icon: Video,
    iconColor: "text-red-600 dark:text-red-400",
    iconBg: "bg-red-50 dark:bg-red-900/20",
    cardBg: "bg-red-50/40 dark:bg-red-900/10",
  },
  {
    title: "콘텐츠 리퍼포징",
    description: "1개 소스로 다양한 포맷을 한 번에 생성합니다.",
    href: "/content/repurpose",
    icon: Repeat2,
    iconColor: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-50 dark:bg-orange-900/20",
    cardBg: "bg-orange-50/40 dark:bg-orange-900/10",
  },
  {
    title: "댓글/DM 관리",
    description: "AI 자동 응답으로 고객 소통을 자동화합니다.",
    href: "/engage",
    icon: MessageSquare,
    iconColor: "text-teal-600 dark:text-teal-400",
    iconBg: "bg-teal-50 dark:bg-teal-900/20",
    cardBg: "bg-teal-50/40 dark:bg-teal-900/10",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* 환영 배너 */}
      <div className="rounded-2xl bg-gradient-to-r from-primary/10 via-accent/30 to-secondary/60 p-6 flex items-center gap-4">
        <div className="rounded-xl bg-primary/15 p-3">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">SNS 마케팅 자동화</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI가 콘텐츠 기획부터 발행, 분석까지 자동으로 처리합니다.
          </p>
        </div>
      </div>

      {/* 빠른 시작 */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">빠른 시작</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {quickLinks.map((item) => (
            <Link key={item.href} href={item.href} className="group">
              <div
                className={`h-full rounded-xl border border-border/60 ${item.cardBg} p-4 transition-all duration-200 group-hover:shadow-md group-hover:scale-[1.02] group-hover:border-primary/20`}
              >
                <div className={`inline-flex rounded-lg ${item.iconBg} p-2 mb-3`}>
                  <item.icon className={`h-5 w-5 ${item.iconColor}`} />
                </div>
                <p className="text-sm font-semibold text-foreground leading-tight">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
