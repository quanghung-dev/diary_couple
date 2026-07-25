import { motion } from 'framer-motion'
import { MapPin, Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Memory } from '../../types'
import { MOODS } from '../../types'
import { parseSongUrl } from '../../lib/song'
import { formatViFullDate, getMediaThumbnailUrl } from '../../lib/utils'

function mediaCountText(memory: Memory) {
  const photos = memory.mediaItems.filter((m) => m.type === 'photo').length
  const videos = memory.mediaItems.filter((m) => m.type === 'video').length
  const parts: string[] = []
  if (photos) parts.push(`${photos} ảnh`)
  if (videos) parts.push(`${videos} video`)
  return parts.join(' · ') || '0'
}

export function MemoryCard({
  memory,
  onDelete,
}: {
  memory: Memory & { id: string }
  onDelete?: (id: string) => void
}) {
  const ordered = [...(memory.mediaItems ?? [])].sort((a, b) => a.order - b.order)
  const cover = (memory.coverMediaId
    ? ordered.find((m) => m.id === memory.coverMediaId)
    : undefined) ?? ordered[0]
  const mood = MOODS.find((m) => m.key === memory.mood)
  const coverPosition = `${memory.coverFocalX ?? 50}% ${memory.coverFocalY ?? 50}%`
  const hasSong = Boolean(parseSongUrl(memory.songUrl ?? '').embedId)

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45 }}
      className="relative overflow-hidden rounded-[28px] border border-rose/15 bg-white/70 shadow-soft dark:border-white/10 dark:bg-white/5"
      onContextMenu={(e) => {
        e.preventDefault()
        if (!onDelete) return
        const ok = window.confirm('Xoá kỷ niệm này?')
        if (ok) onDelete(memory.id)
      }}
    >
      <Link to={`/journal/${memory.id}`} className="block">
        <div className="relative aspect-video bg-cream/60 dark:bg-white/5">
          {cover ? (
            cover.type === 'photo' ? (
              <img
                src={cover.url}
                alt={memory.title}
                className="h-full w-full object-cover"
                style={{ objectPosition: coverPosition }}
                loading="lazy"
              />
            ) : (
              <>
                <img
                  src={getMediaThumbnailUrl(cover)}
                  alt={memory.title}
                  className="h-full w-full object-cover"
                  style={{ objectPosition: coverPosition }}
                  loading="lazy"
                />
                <div className="absolute inset-0 grid place-items-center">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-ink/55 text-cream">
                    <Play size={18} />
                  </div>
                </div>
              </>
            )
          ) : null}

          <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-cream/80 px-3 py-1 text-xs text-ink shadow-soft dark:bg-black/35 dark:text-cream">
            <span>{mood?.emoji ?? '🥰'}</span>
            <span className="font-medium">{mood?.label ?? ''}</span>
          </div>

          <div className="absolute right-4 top-4 rounded-full bg-cream/80 px-3 py-1 text-xs text-ink shadow-soft dark:bg-black/35 dark:text-cream">
            {mediaCountText(memory)}
          </div>

          {hasSong ? (
            <div className="absolute bottom-4 left-4 grid h-9 w-9 place-items-center rounded-full bg-ink/55 text-lg text-cream shadow-soft backdrop-blur dark:bg-black/50">
              🎵
            </div>
          ) : null}
        </div>

        <div className="p-6">
          <p className="text-xs uppercase tracking-[0.16em] text-muted dark:text-cream/60">
            {formatViFullDate(memory.date)}
          </p>
          <h3 className="mt-2 font-serif text-2xl tracking-tight text-ink dark:text-cream">
            {memory.title}
          </h3>

          {memory.location ? (
            <div className="mt-3 inline-flex items-center gap-2 text-sm text-muted dark:text-cream/70">
              <MapPin size={16} className="text-rose" />
              <span className="truncate">{memory.location}</span>
            </div>
          ) : null}
        </div>
      </Link>
    </motion.article>
  )
}

