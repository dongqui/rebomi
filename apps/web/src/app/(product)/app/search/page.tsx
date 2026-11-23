import { SearchScreen } from '@/search/search-screen'

/** 검색 화면. 검색어는 주소의 `#` 뒤에 있어 서버는 모른다 — 화면은 브라우저에서 그린다. */
export default function Search() {
  return <SearchScreen />
}
