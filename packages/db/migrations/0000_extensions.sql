-- 한국어 전문 검색(PGroonga)과 의미 검색(pgvector)은 제품의 핵심이다(스펙 8장).
-- 확장이 없는 DB로 개발이 시작되는 것을 막기 위해 마이그레이션 0번에서 활성화하고,
-- 실패하면 마이그레이션 전체가 실패하게 둔다.
CREATE EXTENSION IF NOT EXISTS pgroonga;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS vector;
