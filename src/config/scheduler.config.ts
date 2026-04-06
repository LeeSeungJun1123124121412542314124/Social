// node-cron 스케줄 설정
export const schedulerConfig = {
  publishCheck: "* * * * *",     // 매분 - 예약 발행 체크
  tokenRefresh: "0 * * * *",    // 매시간 - 토큰 갱신
  analyticsSync: "0 */6 * * *", // 6시간마다 - 성과 동기화
  engagePoll: "*/15 * * * *",   // 15분마다 - 댓글/DM 폴링
} as const;
