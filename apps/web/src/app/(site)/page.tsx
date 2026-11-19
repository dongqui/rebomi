import type { Metadata } from 'next'
import { COPY } from '@/landing/copy'
import { LandingPage } from '@/landing/landing-page'
import { LANDING_LOCALE, pickHeadline, pickHero } from '@/landing/locale'

/*
 * `/` — 대기 명단 랜딩 (waitlist.md). 로그인 여부와 무관하게 누구에게나 보인다 (WAIT-1).
 *
 * 언어는 지금 영어 하나다 (WAIT-5). 헤드라인과 첫 화면 그림은 주소의 `?h=` · `?hero=` 로
 * 정하고 서버에서 그린다.
 */

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export const metadata: Metadata = COPY[LANDING_LOCALE].meta

export default async function Page({ searchParams }: Props) {
  const params = await searchParams
  return (
    <LandingPage
      locale={LANDING_LOCALE}
      headline={pickHeadline(params.h)}
      hero={pickHero(params.hero)}
    />
  )
}
