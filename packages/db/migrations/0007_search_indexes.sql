-- 키워드 검색 인덱스 (search.md SRCH-1). Drizzle 스키마로는 표현할 수 없어 직접 쓴다.
--
-- 토크나이저는 알파벳·숫자·기호를 단어로 묶지 않는 N-gram이다. 한국어뿐 아니라 영어도
-- 단어의 일부("engin" → "engine")로 찾기 위해서다. 정규화로 대소문자와 전각·반각을 가리지 않는다.
--
-- 질의의 식이 이 인덱스의 식과 같아야 인덱스를 쓴다 (apps/api 의 search/keyword.ts).
CREATE INDEX "contents_search_idx" ON "contents" USING pgroonga ((ARRAY["title", "description", "url", "domain"]) pgroonga_text_array_full_text_search_ops_v2) WITH (tokenizer = 'TokenNgram("unify_alphabet", false, "unify_digit", false, "unify_symbol", false)', normalizers = 'NormalizerNFKC150');--> statement-breakpoint
CREATE INDEX "content_bodies_search_idx" ON "content_bodies" USING pgroonga ("text" pgroonga_text_full_text_search_ops_v2) WITH (tokenizer = 'TokenNgram("unify_alphabet", false, "unify_digit", false, "unify_symbol", false)', normalizers = 'NormalizerNFKC150');
