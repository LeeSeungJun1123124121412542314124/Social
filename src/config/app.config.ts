import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().default("file:./prisma/data.db"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  ENCRYPTION_KEY: z.string().min(20, "ENCRYPTION_KEY는 20자 이상이어야 합니다."),

  // SNS OAuth (선택 - 연동 시 필요)
  INSTAGRAM_CLIENT_ID: z.string().optional(),
  INSTAGRAM_CLIENT_SECRET: z.string().optional(),
  THREADS_CLIENT_ID: z.string().optional(),
  THREADS_CLIENT_SECRET: z.string().optional(),
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),
  X_API_KEY: z.string().optional(),
  X_API_SECRET: z.string().optional(),
  X_ACCESS_TOKEN: z.string().optional(),
  X_ACCESS_SECRET: z.string().optional(),

  // AI API (선택)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  FLUX_API_KEY: z.string().optional(),

  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("info"),

  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    console.error("환경변수 검증 실패:", errors);
    throw new Error(
      "필수 환경변수가 설정되지 않았습니다. .env.example을 참고하세요."
    );
  }
  return result.data;
}

// 서버 사이드에서만 호출됨을 보장
let _env: ReturnType<typeof validateEnv> | undefined;

function getEnv() {
  if (!_env) {
    _env = validateEnv();
  }
  return _env;
}

export const env = new Proxy({} as ReturnType<typeof validateEnv>, {
  get(_, key: string) {
    return getEnv()[key as keyof ReturnType<typeof validateEnv>];
  },
});
