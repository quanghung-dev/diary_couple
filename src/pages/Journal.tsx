import { Link } from 'react-router-dom'
import { MemoryCard } from '../components/memory/MemoryCard'
import { useCouple } from '../hooks/useCouple'
import { useMemories } from '../hooks/useMemories'
import { formatViMonthYear, formatViYear } from '../lib/utils'

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-[28px] border border-rose/15 bg-white/70 shadow-soft dark:border-white/10 dark:bg-white/5">
      <div className="aspect-video animate-pulse bg-rose-light/50 dark:bg-white/5" />
      <div className="p-6">
        <div className="h-3 w-40 animate-pulse rounded bg-rose-light/60 dark:bg-white/5" />
        <div className="mt-3 h-7 w-2/3 animate-pulse rounded bg-rose-light/60 dark:bg-white/5" />
        <div className="mt-4 h-4 w-1/2 animate-pulse rounded bg-rose-light/60 dark:bg-white/5" />
      </div>
    </div>
  )
}

export default function Journal() {
  const { couple, loading: coupleLoading } = useCouple()
  const coupleId = couple?.id ?? ''
  const mem = useMemories({ coupleId, pageSize: 10 })

  const memories = mem.memories

  const grouped = memories.reduce(
    (acc, m) => {
      const postedAt = m.createdAt ?? m.date
      const y = formatViYear(postedAt)
      const my = formatViMonthYear(postedAt)
      acc[y] ??= {}
      acc[y]![my] ??= []
      acc[y]![my]!.push(m)
      return acc
    },
    {} as Record<string, Record<string, typeof memories>>,
  )

  const years = Object.keys(grouped).sort((a, b) => Number(b) - Number(a))

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Nhật ký</h1>
          <p className="mt-2 text-muted dark:text-cream/70">
            Bài đăng của hai bạn, mới nhất ở trên.
          </p>
        </div>
        <Link
          to="/upload"
          className="rounded-full bg-rose px-6 py-3 text-sm font-medium text-cream shadow-soft transition hover:brightness-95"
        >
          Thêm kỷ niệm
        </Link>
      </div>

      {coupleLoading || mem.loading ? (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : memories.length === 0 ? (
        <div className="mt-14 grid place-items-center">
          <div className="max-w-md text-center">
            <svg
              width="160"
              height="160"
              viewBox="0 0 160 160"
              className="mx-auto mb-6 text-rose"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M50 88c-12-12-10-34 6-44 13-8 30-3 37 9 7-12 24-17 37-9 16 10 18 32 6 44-16 16-43 35-43 35S66 104 50 88Z"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinejoin="round"
              />
              <path
                d="M44 118c20 10 52 12 72 0"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
              />
            </svg>
            <h2 className="font-serif text-3xl tracking-tight">
              Chưa có kỷ niệm nào
            </h2>
            <p className="mt-3 text-muted dark:text-cream/70">
              Hãy thêm kỷ niệm đầu tiên để bắt đầu dòng thời gian của hai bạn.
            </p>
            <Link
              to="/upload"
              className="mt-6 inline-flex rounded-full bg-rose px-6 py-3 text-sm font-medium text-cream shadow-soft transition hover:brightness-95"
            >
              Tạo kỷ niệm đầu tiên
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          {years.map((year) => {
            const months = Object.keys(grouped[year] ?? {})
            return (
              <section key={year}>
                <div className="sticky top-[72px] z-10 -mx-2 mb-6 rounded-full bg-cream/90 px-4 py-2 font-serif text-2xl text-ink backdrop-blur dark:bg-[#140C0C]/70 dark:text-cream">
                  {year}
                </div>

                <div className="space-y-10">
                  {months.map((month) => (
                    <div key={month}>
                      <div className="sticky top-[120px] z-10 inline-flex rounded-full border border-rose/15 bg-white/70 px-4 py-2 text-sm font-medium text-ink shadow-soft backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-cream">
                        {month}
                      </div>
                      <div className="mt-5 grid gap-6 md:grid-cols-2">
                        {grouped[year]![month]!.map((m) => (
                          <MemoryCard
                            key={m.id}
                            memory={m}
                            onDelete={mem.deleteMemory}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}

          <div className="flex items-center justify-center pt-4">
            {mem.hasMore ? (
              <button
                type="button"
                onClick={mem.loadMore}
                disabled={mem.loadingMore}
                className="rounded-full border border-rose/25 bg-white/70 px-6 py-3 text-sm font-medium text-ink shadow-soft transition hover:bg-white disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-cream dark:hover:bg-white/10"
              >
                {mem.loadingMore ? 'Đang tải…' : 'Tải thêm'}
              </button>
            ) : (
              <p className="text-sm text-muted dark:text-cream/70">
                Bạn đã xem hết rồi.
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

