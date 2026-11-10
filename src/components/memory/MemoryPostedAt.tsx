import type { Timestamp } from 'firebase/firestore'

const postedAtFormatter = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
  hourCycle: 'h23',
  timeZone: 'Asia/Ho_Chi_Minh',
})

export function MemoryPostedAt({ timestamp }: { timestamp?: Timestamp | null }) {
  if (!timestamp) return null
  const date = timestamp.toDate()

  return (
    <p className="mt-1 text-xs text-muted dark:text-cream/70">
      Đăng lúc <time dateTime={date.toISOString()}>{postedAtFormatter.format(date)}</time>
    </p>
  )
}
