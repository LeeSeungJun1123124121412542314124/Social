import Link from "next/link";
import { Layers, Video, Zap, Repeat2, BookOpen, Type } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const contentTypes = [
  { title: "텍스트 게시물", href: "/content/text", icon: Type, description: "AI가 플랫폼별 최적화 텍스트를 작성합니다." },
  { title: "카드뉴스", href: "/content/carousel", icon: Layers, description: "이미지 슬라이드 카드뉴스를 제작합니다." },
  { title: "블로그 아티클", href: "/content/blog", icon: BookOpen, description: "2000자 이상의 블로그 글을 작성합니다." },
  { title: "AI 대량 기획", href: "/content/bulk", icon: Zap, description: "오디언스 맞춤 아이디어를 한번에 기획합니다." },
  { title: "콘텐츠 리퍼포징", href: "/content/repurpose", icon: Repeat2, description: "1개 소스로 다양한 포맷을 생성합니다." },
  { title: "숏폼 영상", href: "/content/short-form", icon: Video, description: "30~60초 숏폼 영상을 제작합니다." },
];

export default function ContentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">콘텐츠 생성</h1>
        <p className="text-muted-foreground mt-1">생성할 콘텐츠 유형을 선택하세요.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {contentTypes.map((item) => (
          <Link key={item.href} href={item.href} className="group">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardHeader className="pb-2">
                <item.icon className="h-6 w-6 text-primary" />
                <CardTitle className="text-sm font-semibold mt-1">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
