import Masonry from 'react-masonry-css'
import { Play } from 'lucide-react'
import type { MediaItem } from '../../types'
import { getMediaThumbnailUrl } from '../../lib/utils'

const breakpoints = {
  default: 4,
  1024: 3,
  768: 2,
  0: 2,
}

export function MediaGrid({
  items,
  onItemClick,
}: {
  items: MediaItem[]
  onItemClick: (index: number) => void
}) {
  const ordered = [...items].sort((a, b) => a.order - b.order)

  return (
    <Masonry
      breakpointCols={breakpoints}
      className="flex w-auto -ml-4"
      columnClassName="pl-4 bg-clip-padding"
    >
      {ordered.map((m, idx) => {
        return (
          <button
            key={m.id}
            type="button"
            className="group mb-4 w-full overflow-hidden rounded-2xl border border-rose/15 bg-white/60 shadow-soft transition hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose/40 dark:border-white/10 dark:bg-white/5"
            onClick={() => onItemClick(idx)}
          >
            <div className="relative">
              <img
                src={getMediaThumbnailUrl(m)}
                alt={m.caption || (m.type === 'video' ? 'video' : 'photo')}
                className="h-auto w-full object-cover"
                loading="lazy"
              />
              {m.type === 'video' ? (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-ink/55 text-cream shadow-soft transition group-hover:bg-ink/65 dark:bg-black/45 dark:group-hover:bg-black/55">
                    <Play size={18} />
                  </div>
                </div>
              ) : null}
            </div>
            {m.caption ? (
              <div className="px-3 py-2 text-left text-xs italic text-muted dark:text-cream/70">
                {m.caption}
              </div>
            ) : null}
          </button>
        )
      })}
    </Masonry>
  )
}
