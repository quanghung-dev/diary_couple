import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import Masonry from 'react-masonry-css'
import { useEffect, useMemo, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { db } from '../lib/firebase'
import { useCouple } from '../hooks/useCouple'
import { MOODS, type Memory, type MoodKey, type MediaItem } from '../types'
import { getMediaThumbnailUrl } from '../lib/utils'

type GalleryItem = {
  media: MediaItem
  memoryId: string
  memoryTitle: string
  memoryLocation: string
  mood: MoodKey
  dateMs: number
}

const breakpoints = {
  default: 4,
  1024: 3,
  768: 2,
  0: 2,
}

export default function Gallery() {
  const { couple } = useCouple()
  const coupleId = couple?.id ?? ''

  const [memories, setMemories] = useState<(Memory & { id: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null)

  const [typeFilter, setTypeFilter] = useState<'all' | 'photo' | 'video'>('all')
  const [moodFilter, setMoodFilter] = useState<MoodKey | 'all'>('all')
  const [fromMonth, setFromMonth] = useState('') // YYYY-MM
  const [toMonth, setToMonth] = useState('') // YYYY-MM
  const [search, setSearch] = useState('')

  const { ref, inView } = useInView({ rootMargin: '600px' })

  const loadFirst = async () => {
    if (!coupleId) return
    setLoading(true)
    setHasMore(true)
    setLastDoc(null)
    try {
      const q = query(
        collection(db, 'memories'),
        where('coupleId', '==', coupleId),
        orderBy('date', 'desc'),
        limit(10),
      )
      const snap = await getDocs(q)
      setMemories(snap.docs.map((d) => ({ ...(d.data() as Memory), id: d.id })))
      setLastDoc(snap.docs.length ? snap.docs[snap.docs.length - 1]! : null)
      setHasMore(snap.docs.length === 10)
    } catch (e: any) {
      console.error(e)
      const msg = String(e?.message ?? '')
      const code = String(e?.code ?? '')
      if (code === 'failed-precondition' || msg.toLowerCase().includes('requires an index')) {
        // fallback without orderBy (no pagination)
        const q2 = query(
          collection(db, 'memories'),
          where('coupleId', '==', coupleId),
          limit(50),
        )
        const snap2 = await getDocs(q2)
        const sorted = snap2.docs
          .map((d) => ({ ...(d.data() as Memory), id: d.id }))
          .sort(
            (a, b) =>
              (b.date?.toMillis?.() ?? 0) - (a.date?.toMillis?.() ?? 0),
          )
        setMemories(sorted)
        setLastDoc(null)
        setHasMore(false)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadMore = async () => {
    if (!coupleId || !hasMore || !lastDoc || loadingMore) return
    setLoadingMore(true)
    try {
      const q = query(
        collection(db, 'memories'),
        where('coupleId', '==', coupleId),
        orderBy('date', 'desc'),
        startAfter(lastDoc),
        limit(10),
      )
      const snap = await getDocs(q)
      setMemories((prev) => [
        ...prev,
        ...snap.docs.map((d) => ({ ...(d.data() as Memory), id: d.id })),
      ])
      setLastDoc(snap.docs.length ? snap.docs[snap.docs.length - 1]! : lastDoc)
      setHasMore(snap.docs.length === 10)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    void loadFirst()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId])

  useEffect(() => {
    if (inView) void loadMore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView])

  const allItems = useMemo(() => {
    const out: GalleryItem[] = []
    for (const m of memories) {
      const dateMs = m.date?.toDate?.()?.getTime?.() ?? 0
      for (const media of m.mediaItems ?? []) {
        out.push({
          media,
          memoryId: m.id,
          memoryTitle: m.title,
          memoryLocation: m.location,
          mood: m.mood,
          dateMs,
        })
      }
    }
    return out.sort((a, b) => b.dateMs - a.dateMs)
  }, [memories])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    const from = fromMonth ? new Date(`${fromMonth}-01T00:00:00`).getTime() : null
    const to = toMonth ? new Date(`${toMonth}-01T00:00:00`).getTime() : null

    return allItems.filter((it) => {
      if (typeFilter !== 'all' && it.media.type !== typeFilter) return false
      if (moodFilter !== 'all' && it.mood !== moodFilter) return false
      if (from != null && it.dateMs < from) return false
      if (to != null) {
        const end = new Date(to)
        end.setMonth(end.getMonth() + 1)
        if (it.dateMs >= end.getTime()) return false
      }
      if (s) {
        const hay = `${it.memoryTitle} ${it.memoryLocation}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
  }, [allItems, typeFilter, moodFilter, fromMonth, toMonth, search])

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Thư viện</h1>
          <p className="mt-2 text-muted dark:text-cream/70">
            Tất cả ảnh & video — lọc theo cảm xúc, thời gian, và tìm kiếm.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 rounded-[28px] border border-rose/15 bg-white/70 p-5 shadow-soft dark:border-white/10 dark:bg-white/5 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 rounded-2xl border border-rose/15 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/5">
            <Search size={16} className="text-muted dark:text-cream/60" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tiêu đề / địa điểm…"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted dark:text-cream/70">
              Từ tháng
            </span>
            <input
              type="month"
              value={fromMonth}
              onChange={(e) => setFromMonth(e.target.value)}
              className="w-full rounded-2xl border border-rose/15 bg-white/70 px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-white/5"
            />
          </label>
        </div>
        <div>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted dark:text-cream/70">
              Đến tháng
            </span>
            <input
              type="month"
              value={toMonth}
              onChange={(e) => setToMonth(e.target.value)}
              className="w-full rounded-2xl border border-rose/15 bg-white/70 px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-white/5"
            />
          </label>
        </div>

        <div className="md:col-span-4">
          <div className="flex flex-wrap gap-2">
            {(['all', 'photo', 'video'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={[
                  'rounded-full px-4 py-2 text-sm font-medium transition',
                  typeFilter === t
                    ? 'bg-rose text-cream'
                    : 'border border-rose/20 bg-white/60 text-ink hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-cream dark:hover:bg-white/10',
                ].join(' ')}
              >
                {t === 'all' ? 'Tất cả' : t === 'photo' ? 'Ảnh' : 'Video'}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMoodFilter('all')}
              className={[
                'rounded-full px-4 py-2 text-sm font-medium transition',
                moodFilter === 'all'
                  ? 'bg-ink text-cream'
                  : 'border border-rose/20 bg-white/60 text-ink hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-cream dark:hover:bg-white/10',
              ].join(' ')}
            >
              All moods
            </button>
            {MOODS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMoodFilter(m.key)}
                className={[
                  'rounded-full px-4 py-2 text-sm font-medium transition',
                  moodFilter === m.key
                    ? 'bg-rose text-cream'
                    : 'border border-rose/20 bg-white/60 text-ink hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-cream dark:hover:bg-white/10',
                ].join(' ')}
              >
                {m.emoji} {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-10">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[4/5] animate-pulse rounded-2xl bg-rose-light/50 dark:bg-white/5"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted dark:text-cream/70">
            Không có mục nào phù hợp.
          </p>
        ) : (
          <Masonry
            breakpointCols={breakpoints}
            className="flex w-auto -ml-4"
            columnClassName="pl-4 bg-clip-padding"
          >
            {filtered.map((it) => (
              <Link
                key={`${it.memoryId}:${it.media.id}`}
                to={`/journal/${it.memoryId}`}
                className="group relative mb-4 block overflow-hidden rounded-2xl border border-rose/15 bg-white/60 shadow-soft transition hover:brightness-[0.98] dark:border-white/10 dark:bg-white/5"
              >
                <img
                  src={getMediaThumbnailUrl(it.media)}
                  alt={it.media.caption || it.memoryTitle}
                  className="h-auto w-full object-cover"
                  loading="lazy"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/65 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-3 opacity-0 transition group-hover:opacity-100">
                  <p className="text-sm font-medium text-cream">
                    {it.memoryTitle}
                  </p>
                  {it.memoryLocation ? (
                    <p className="text-xs text-cream/80">{it.memoryLocation}</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </Masonry>
        )}

        <div ref={ref} className="h-10" />
        {loadingMore ? (
          <p className="mt-2 text-center text-sm text-muted dark:text-cream/70">
            Đang tải thêm…
          </p>
        ) : null}
      </div>
    </main>
  )
}

