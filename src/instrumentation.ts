// Next.js instrumentation hook - 서버 시작 시 한 번 실행
// 스케줄러를 여기서 초기화하여 PM2로 재시작해도 자동으로 활성화됨
export async function register() {
  // 서버 사이드(Node.js runtime)에서만 실행
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initScheduler } = await import("./scheduler");
    initScheduler();
  }
}
