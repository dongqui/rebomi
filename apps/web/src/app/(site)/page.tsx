import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { COPY } from '@/landing/copy'
import { LandingPage } from '@/landing/landing-page'
import { pickHeadline, pickLocale } from '@/landing/locale'

/*
 * `/` — 대기 명단 랜딩 (waitlist.md). 로그인 여부와 무관하게 누구에게나 보인다 (WAIT-1).
 *
 * 언어는 요청의 `Accept-Language` 로, 헤드라인은 주소의 `?h=` 로 정한다. 둘 다 서버에서
 * 정해 그리므로 영어로 떴다가 한국어로 바뀌는 깜빡임이 없다.
 */

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

async function requestLocale() {
  return pickLocale((await headers()).get('accept-language'))
}

export async function generateMetadata(): Promise<Metadata> {
  return COPY[await requestLocale()].meta
}

export default async function Page({ searchParams }: Props) {
  const [locale, params] = await Promise.all([requestLocale(), searchParams])
  return <LandingPage locale={locale} headline={pickHeadline(params.h)} />
}
