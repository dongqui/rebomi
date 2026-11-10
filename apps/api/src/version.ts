import { createRequire } from 'node:module'

// package.json 은 rootDir(src) 밖이라 import 로 가져올 수 없다. 런타임 경로는
// src/ 와 dist/ 에서 같은 깊이이므로 두 경우 모두 apps/api/package.json 을 가리킨다.
const pkg = createRequire(import.meta.url)('../package.json') as { version: string }

export const VERSION: string = pkg.version
