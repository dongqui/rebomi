const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

// 환경변수는 모노레포 루트의 .env 하나로 관리한다. Metro가 EXPO_PUBLIC_* 를
// 번들에 인라인하므로, 번들링 전에 process.env 에 올려둔다.
require('dotenv').config({ path: path.join(workspaceRoot, '.env'), quiet: true })

const config = getDefaultConfig(projectRoot)

// 모노레포: 워크스페이스 전체를 감시하고, 앱과 루트의 node_modules를 모두 본다.
config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
// disableHierarchicalLookup 은 켜지 않는다. pnpm isolated 설치에서는 각 패키지가
// 자기 node_modules 에 전이 의존성을 두므로(react-native → invariant), 상위 탐색을
// 막으면 Metro가 그것을 찾지 못한다. 그 설정은 hoisted 모노레포용이다.

module.exports = config
