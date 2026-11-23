import type { ButtonHTMLAttributes, ReactNode } from 'react'

/*
 * 디자인이 쓰는 TDS Mobile 컴포넌트 가운데 필요한 것만 웹용으로 옮겼다.
 * 치수는 디자인 시스템의 값 그대로다 (Button L: 높이 48·모서리 14, Button M: 38·12,
 * Button S: 32·10, IconButton M: 38·13, IconButton S: 32·10).
 * TDS는 누를 때 색을 바꾸지 않고 덮개를 씌운다 — `after:` 가 그 덮개다.
 */

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  children: ReactNode
}

const pressLayer =
  'relative overflow-hidden after:pointer-events-none after:absolute after:inset-0 after:opacity-0 after:transition-opacity after:duration-[120ms] enabled:active:after:opacity-100'

const BUTTON_SIZES = {
  L: 'h-12 rounded-[14px] px-4 text-[17px]',
  M: 'h-[38px] rounded-xl px-3.5 text-[15px]',
  S: 'h-8 rounded-[10px] px-3 text-[13px]',
}

/** 채운 버튼. `fill` 은 먹색 주 버튼, `weak` 는 옅은 회색 보조 버튼이다. */
export function Button({
  variant = 'fill',
  size = 'L',
  type = 'button',
  children,
  ...rest
}: ButtonProps & { variant?: 'fill' | 'weak'; size?: keyof typeof BUTTON_SIZES }) {
  const skin =
    variant === 'fill'
      ? 'bg-brand text-on-brand after:bg-black/25'
      : 'bg-fill text-sub after:bg-fill-pressed'
  return (
    <button
      type={type}
      className={`${pressLayer} ${skin} ${BUTTON_SIZES[size]} inline-flex min-w-0 cursor-pointer items-center justify-center leading-[1.252] font-semibold transition-opacity duration-[120ms] disabled:cursor-default disabled:opacity-30`}
      {...rest}
    >
      <span className="relative">{children}</span>
    </button>
  )
}

/** 글자만 있는 버튼 (이전). */
export function TextButton({ type = 'button', children, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className="inline-flex cursor-pointer items-center text-[17px] leading-[1.252] font-medium text-muted disabled:cursor-default disabled:opacity-30"
      {...rest}
    >
      {children}
    </button>
  )
}

/** 아이콘만 있는 버튼 (닫기, 설정). 이름은 `aria-label` 로 준다. */
export function IconButton({
  type = 'button',
  size = 'M',
  children,
  ...rest
}: ButtonProps & { 'aria-label': string; size?: 'M' | 'S' }) {
  return (
    <button
      type={type}
      className={`${pressLayer} ${
        size === 'M' ? 'size-[38px] rounded-[13px]' : 'size-8 rounded-[10px]'
      } flex flex-none cursor-pointer items-center justify-center text-icon after:bg-fill-pressed`}
      {...rest}
    >
      {children}
    </button>
  )
}
