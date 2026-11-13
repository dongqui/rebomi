'use client'

import { useState } from 'react'
import { useSession } from './session'

export function SignOutButton() {
  const { signOut } = useSession()
  const [pending, setPending] = useState(false)

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true)
        void signOut()
      }}
    >
      로그아웃
    </button>
  )
}
