import type { AuthProvider, AuthUser } from '@rebomi/api-contract'
import { and, eq, gt, isNull, schema, type Db } from '@rebomi/db'
import type { ProviderIdentity } from './providers.js'
import { REFRESH_TOKEN_TTL_SECONDS } from './tokens.js'

const { authIdentities, refreshTokens, users } = schema

const refreshExpiry = (now: Date): Date =>
  new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000)

/**
 * 신원에 해당하는 계정을 찾거나 만든다 (account.md ACC-1, ACC-7).
 *
 * 1. 이미 아는 신원이면 그 계정.
 * 2. 처음 보는 신원이고 이메일이 검증됐으면, 같은 이메일의 계정에 붙이거나 새로 만든다.
 * 3. 처음 보는 신원인데 검증된 이메일이 없으면 받지 않는다 — 이메일로 묶을 수 없고,
 *    이메일 없는 계정은 만들지 않는다.
 *
 * insert는 모두 on conflict do nothing 이다. 같은 신원의 첫 로그인이 동시에 와도
 * 유일 제약 위반으로 실패하지 않고 먼저 들어간 행을 같이 쓴다.
 */
export async function findOrCreateUser(
  db: Db,
  provider: AuthProvider,
  identity: ProviderIdentity,
): Promise<AuthUser | 'email_not_verified'> {
  const byIdentity = (): Promise<AuthUser | undefined> =>
    db.drizzle
      .select({ id: users.id, email: users.email })
      .from(authIdentities)
      .innerJoin(users, eq(users.id, authIdentities.userId))
      .where(
        and(eq(authIdentities.provider, provider), eq(authIdentities.subject, identity.subject)),
      )
      .then((rows) => rows[0])

  const known = await byIdentity()
  if (known) return known

  if (!identity.emailVerified || identity.email === null) return 'email_not_verified'
  const email = identity.email.trim().toLowerCase()

  await db.drizzle.transaction(async (tx) => {
    await tx.insert(users).values({ email }).onConflictDoNothing()
    const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email))
    if (!user) throw new Error('방금 넣은 사용자를 찾을 수 없습니다')

    await tx
      .insert(authIdentities)
      .values({ userId: user.id, provider, subject: identity.subject, email: identity.email })
      .onConflictDoNothing()
  })

  // 동시에 온 다른 요청이 신원을 먼저 넣었을 수 있으므로 신원 기준으로 다시 읽는다.
  const created = await byIdentity()
  if (!created) throw new Error('방금 넣은 신원을 찾을 수 없습니다')
  return created
}

/** 새 갱신 토큰의 해시를 저장한다. */
export async function storeRefreshToken(
  db: Db,
  userId: string,
  tokenHash: string,
  now: Date,
): Promise<void> {
  await db.drizzle
    .insert(refreshTokens)
    .values({ userId, tokenHash, expiresAt: refreshExpiry(now) })
}

/**
 * 갱신 토큰을 한 번 쓴다. 유효하면 만료를 지금부터 60일로 밀고 사용자 ID를 돌려준다.
 *
 * 확인과 연장이 한 문장이다 — 로그아웃과 겹쳐도 폐기된 토큰이 연장되지 않는다.
 */
export async function useRefreshToken(
  db: Db,
  tokenHash: string,
  now: Date,
): Promise<{ userId: string } | 'expired' | 'invalid'> {
  const [used] = await db.drizzle
    .update(refreshTokens)
    .set({ expiresAt: refreshExpiry(now), lastUsedAt: now })
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, now),
      ),
    )
    .returning({ userId: refreshTokens.userId })
  if (used) return used

  const [row] = await db.drizzle
    .select({ revokedAt: refreshTokens.revokedAt })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
  return row && row.revokedAt === null ? 'expired' : 'invalid'
}

/** 갱신 토큰을 폐기한다. 모르는 토큰이거나 이미 폐기됐으면 아무 일도 없다. */
export async function revokeRefreshToken(db: Db, tokenHash: string, now: Date): Promise<void> {
  await db.drizzle
    .update(refreshTokens)
    .set({ revokedAt: now })
    .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)))
}
