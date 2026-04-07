import { apiHandler, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// 알림 목록 조회 (최근 50개)
export const GET = apiHandler(async () => {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return successResponse(notifications);
});

// 모든 알림 읽음 처리
export const PATCH = apiHandler(async () => {
  await prisma.notification.updateMany({
    where: { read: false },
    data: { read: true },
  });
  return successResponse({ message: "모든 알림을 읽음 처리했습니다." });
});
