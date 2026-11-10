import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import type { NextConfig } from 'next'

// 환경변수는 모노레포 루트의 .env 하나로 관리한다. Next는 앱 디렉터리에서만
// 찾으므로 여기서 먼저 읽어 process.env 에 올린다 (NEXT_PUBLIC_* 는 빌드 시 인라인된다).
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true })

const nextConfig: NextConfig = {
  reactStrictMode: true,
}

export default nextConfig
