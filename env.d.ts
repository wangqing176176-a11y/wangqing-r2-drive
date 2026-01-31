interface CloudflareEnv {
  [key: string]: unknown;
  BUCKET: R2Bucket;
}

// 扩展 Next.js 的 Edge Runtime 类型
declare global {
  interface CloudflareEnv {
    [key: string]: unknown;
    BUCKET: R2Bucket;
  }
}
