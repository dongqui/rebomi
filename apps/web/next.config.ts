import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import type { NextConfig } from 'next'
import { PUBLIC_ENV_NAMES, requirePublicEnv, type PublicEnvName } from './src/lib/env'

// 환경변수는 모노레포 루트의 .env 하나로 관리한다. Next는 앱 디렉터리에서만
// 찾으므로 여기서 먼저 읽어 process.env 에 올린다 (NEXT_PUBLIC_* 는 빌드 시 인라인된다).
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true })

// 없는 값이 있으면 dev·build·start가 여기서 바로 실패한다. 빈 값으로 뜬 뒤 브라우저에서
// 뒤늦게 깨지는 것보다 낫다.
requirePublicEnv(
  Object.fromEntries(PUBLIC_ENV_NAMES.map((name) => [name, process.env[name]])) as Record<
    PublicEnvName,
    string | undefined
  >,
)

const nextConfig: NextConfig = {
  reactStrictMode: true,
}

export default nextConfig
