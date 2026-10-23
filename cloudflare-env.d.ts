declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    BOOTSTRAP_RUBY_KEY?: string;
    DEEPSEEK_API_KEY?: string;
    DEEPSEEK_MODEL?: string;
  }
}
