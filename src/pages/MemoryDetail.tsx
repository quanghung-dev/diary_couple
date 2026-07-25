import { Timestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { Pencil, Plus, Star, Trash2, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate, useParams } from 'react-router-dom'
import { LightboxViewer } from '../components/media/LightboxViewer'
import { MediaGrid } from '../components/media/MediaGrid'
import { UploadZone } from '../components/media/UploadZone'
import { useMemory } from '../hooks/useMemories'
import { useUpload } from '../hooks/useUpload'
import { db } from '../lib/firebase'
import { LocationSearchField, type LocationFieldValue } from '../components/location/LocationSearchField'
import { SongEmbed } from '../components/memory/SongEmbed'
import { SongFields } from '../components/memory/SongFields'
import { parseSongUrl } from '../lib/song'
import { formatViFullDate, getMediaThumbnailUrl } from '../lib/utils'
import { MOODS, type MediaItem, type MoodKey } from '../types'

export default function MemoryDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { memory, loading } = useMemory(id)
  const [edit, setEdit] = useState(false)
  const [busy, setBusy] = useState(false)

  const ordered = useMemo(
    () => (memory ? [...memory.mediaItems].sort((a, b) => a.order - b.order) : []),
    [memory],
  )
  const cover = useMemo(() => {
    if (!memory) return undefined
    const coverId = memory.coverMediaId
    const found = coverId ? ordered.find((m) => m.id === coverId) : undefined
    return found ?? ordered[0]
  }, [memory, ordered])
  const mood = MOODS.find((m) => m.key === memory?.mood)

  const slides = useMemo(
    () =>
      ordered.map((m) => {
        if (m.type === 'video') {
          return {
            src: m.url,
            type: 'video' as const,
            poster: getMediaThumbnailUrl(m),
            description: m.caption || '',
            sources: [{ src: m.url, type: 'video/mp4' }],
          }
        }
        return {
          src: m.url,
          type: 'image' as const,
          description: m.caption || '',
        }
      }),
    [ordered],
  )

  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [loc, setLoc] = useState<LocationFieldValue>({ location: '' })
  const [description, setDescription] = useState('')
  const [songUrl, setSongUrl] = useState('')
  const [moodKey, setMoodKey] = useState<MoodKey>('romantic')
  const [draftMedia, setDraftMedia] = useState<MediaItem[]>([])
  const [addMoreOpen, setAddMoreOpen] = useState(false)
  const [coverMediaId, setCoverMediaId] = useState<string | null>(null)
  const [coverFocalX, setCoverFocalX] = useState(50)
  const [coverFocalY, setCoverFocalY] = useState(50)
  const [draggingCover, setDraggingCover] = useState(false)
  const coverPreviewRef = useRef<HTMLDivElement | null>(null)

  const coupleId = memory?.coupleId ?? ''
  const memoryId = memory?.id ?? id
  const uploader = useUpload({
    coupleId: coupleId || 'unknown',
    memoryId: memoryId || 'unknown',
  })

  const hasUploading = uploader.items.some((i) => i.status === 'uploading' || i.status === 'compressing' || i.status === 'queued')
  const hasUploadErrors = uploader.items.some((i) => i.status === 'error')
  const selectedCoverPhoto =
    draftMedia.find((m) => m.id === coverMediaId && m.type === 'photo') ?? null
  const coverPosition = `${coverFocalX}% ${coverFocalY}%`

  const clampPercent = (value: number) => Math.max(0, Math.min(100, value))

  const updateCoverFocalFromPointer = (clientX: number, clientY: number) => {
    const el = coverPreviewRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const x = clampPercent(((clientX - rect.left) / rect.width) * 100)
    const y = clampPercent(((clientY - rect.top) / rect.height) * 100)
    setCoverFocalX(Number(x.toFixed(2)))
    setCoverFocalY(Number(y.toFixed(2)))
  }

  const enterEdit = () => {
    if (!memory) return
    setTitle(memory.title)
    setDate(memory.date.toDate().toISOString().slice(0, 10))
    setLoc({
      location: memory.location,
      locationName: memory.locationName ?? undefined,
      lat: memory.lat ?? undefined,
      lng: memory.lng ?? undefined,
    })
    setDescription(memory.description)
    setSongUrl(memory.songUrl ?? '')
    setMoodKey(memory.mood)
    setDraftMedia([...ordered])
    setCoverMediaId(memory.coverMediaId ?? null)
    setCoverFocalX(memory.coverFocalX ?? 50)
    setCoverFocalY(memory.coverFocalY ?? 50)
    setDraggingCover(false)
    setAddMoreOpen(false)
    uploader.reset()
    setEdit(true)
  }

  const saveEdit = async () => {
    if (!memory) return
    try {
      if (hasUploading) {
        toast.error('Vui lòng chờ upload hoàn tất')
        return
      }
      if (hasUploadErrors) {
        toast.error('Có file upload lỗi. Hãy xoá file lỗi hoặc thử lại.')
        return
      }
      const added = uploader.items.length ? uploader.toMediaItems() : []
      const combined = [...draftMedia, ...added].map((m, idx) => ({ ...m, order: idx }))
      const nextCoverId =
        coverMediaId && combined.some((m) => m.id === coverMediaId)
          ? coverMediaId
          : null

      const parsedSong = parseSongUrl(songUrl)
      setBusy(true)
      await updateDoc(doc(db, 'memories', memory.id), {
        title: title.trim(),
        date: Timestamp.fromDate(new Date(date)),
        location: loc.location.trim(),
        locationName: loc.locationName ?? null,
        lat: loc.lat ?? null,
        lng: loc.lng ?? null,
        description: description.trim(),
        mood: moodKey,
        mediaItems: combined,
        coverMediaId: nextCoverId,
        coverFocalX: clampPercent(coverFocalX),
        coverFocalY: clampPercent(coverFocalY),
        songUrl: songUrl.trim(),
        songType: parsedSong.embedId ? parsedSong.songType : null,
        updatedAt: Timestamp.now(),
      })

      toast.success('Đã lưu thay đổi')
      uploader.reset()
      setEdit(false)
    } catch (e) {
      console.error(e)
      toast.error('Không thể lưu')
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    if (!memory) return
    const ok = window.confirm('Xoá kỷ niệm này? Thao tác không thể hoàn tác.')
    if (!ok) return
    try {
      setBusy(true)
      await deleteDoc(doc(db, 'memories', memory.id))
      toast.success('Đã xoá')
      navigate('/journal')
    } catch {
      toast.error('Không thể xoá')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="aspect-video animate-pulse rounded-[28px] bg-rose-light/50 dark:bg-white/5" />
        <div className="mt-6 h-8 w-2/3 animate-pulse rounded bg-rose-light/50 dark:bg-white/5" />
        <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-rose-light/50 dark:bg-white/5" />
      </main>
    )
  }

  if (!memory) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="font-serif text-4xl tracking-tight">Không tìm thấy</h1>
        <p className="mt-2 text-muted dark:text-cream/70">
          Kỷ niệm này có thể đã bị xoá.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="overflow-hidden rounded-[28px] border border-rose/15 bg-white/70 shadow-soft dark:border-white/10 dark:bg-white/5">
        <div className="relative aspect-video bg-cream/60 dark:bg-white/5">
          {cover ? (
            cover.type === 'photo' ? (
              <img
                src={cover.url}
                alt={memory.title}
                className="h-full w-full object-cover"
                style={{
                  objectPosition: `${memory.coverFocalX ?? 50}% ${memory.coverFocalY ?? 50}%`,
                }}
              />
            ) : (
              <video
                src={cover.url}
                className="h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
              />
            )
          ) : null}
          <div className="absolute left-4 top-4 rounded-full bg-cream/80 px-3 py-1 text-xs text-ink shadow-soft dark:bg-black/35 dark:text-cream">
            {mood?.emoji} {mood?.label}
          </div>
        </div>

        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted dark:text-cream/60">
                {formatViFullDate(memory.date)}
              </p>
              {edit ? (
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-rose/15 bg-white/70 px-4 py-3 font-serif text-2xl outline-none dark:border-white/10 dark:bg-white/5"
                />
              ) : (
                <h1 className="mt-2 font-serif text-4xl tracking-tight">
                  {memory.title}
                </h1>
              )}
              {edit ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="rounded-2xl border border-rose/15 bg-white/70 px-4 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                  />
                  <select
                    value={moodKey}
                    onChange={(e) => setMoodKey(e.target.value as MoodKey)}
                    className="rounded-2xl border border-rose/15 bg-white/70 px-4 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                  >
                    {MOODS.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.emoji} {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {edit ? (
                <>
                  <button
                    type="button"
                    disabled={busy || hasUploading}
                    onClick={saveEdit}
                    className="rounded-full bg-rose px-5 py-2.5 text-sm font-medium text-cream shadow-soft transition hover:brightness-95 disabled:opacity-60"
                  >
                    Lưu
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      uploader.reset()
                      setEdit(false)
                      setAddMoreOpen(false)
                      setDraftMedia([])
                      setCoverMediaId(null)
                      setCoverFocalX(50)
                      setCoverFocalY(50)
                      setDraggingCover(false)
                      setLoc({
                        location: memory.location,
                        locationName: memory.locationName ?? undefined,
                        lat: memory.lat ?? undefined,
                        lng: memory.lng ?? undefined,
                      })
                      setSongUrl(memory.songUrl ?? '')
                    }}
                    className="rounded-full border border-rose/25 bg-white/60 px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-white disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-cream dark:hover:bg-white/10"
                  >
                    Huỷ
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={enterEdit}
                    className="inline-flex items-center gap-2 rounded-full border border-rose/25 bg-white/60 px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-cream dark:hover:bg-white/10"
                  >
                    <Pencil size={16} />
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream transition hover:brightness-95"
                  >
                    <Trash2 size={16} />
                    Xoá
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-4">
            {edit ? (
              <LocationSearchField
                value={loc}
                onChange={setLoc}
                disabled={busy}
              />
            ) : memory.location ? (
              <p className="text-sm text-muted dark:text-cream/70">
                {memory.location}
              </p>
            ) : null}
          </div>

          <div className="mt-4">
            {edit ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full resize-none rounded-2xl border border-rose/15 bg-white/70 px-4 py-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
              />
            ) : memory.description ? (
              <p className="prose-editorial text-muted dark:text-cream/70">
                {memory.description}
              </p>
            ) : null}
          </div>

          {edit ? (
            <div className="mt-4">
              <SongFields songUrl={songUrl} onSongUrlChange={setSongUrl} disabled={busy} />
            </div>
          ) : parseSongUrl(memory.songUrl ?? '').embedId ? (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-ink dark:text-cream">
                🎵 Bài hát của chúng mình
              </h3>
              <div className="mt-3">
                <SongEmbed songUrl={memory.songUrl ?? ''} />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-8">
        {edit ? (
          <section className="rounded-[28px] border border-rose/15 bg-white/70 p-6 shadow-soft dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl">Ảnh & Video</h2>
                <p className="mt-1 text-sm text-muted dark:text-cream/70">
                  Xoá/Thêm sẽ chỉ được lưu khi bạn bấm Lưu.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddMoreOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-full border border-rose/25 bg-white/60 px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-cream dark:hover:bg-white/10"
              >
                <Plus size={16} />
                Thêm ảnh/video
              </button>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-medium text-ink dark:text-cream">
                Chọn ảnh đại diện
              </h3>
              <div className="cover-strip mt-3 flex flex-nowrap gap-2 overflow-x-auto pb-2">
                {draftMedia
                  .filter((m) => m.type === 'photo')
                  .map((m) => {
                    const selected = (coverMediaId ?? null) === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setCoverMediaId(m.id)
                          setCoverFocalX(50)
                          setCoverFocalY(50)
                        }}
                        className={[
                          'relative h-[60px] w-[80px] min-w-[80px] shrink-0 overflow-hidden rounded-xl border transition',
                          selected
                            ? 'border-rose ring-2 ring-rose/30'
                            : 'border-rose/15 hover:border-rose/30 dark:border-white/10 dark:hover:border-white/20',
                        ].join(' ')}
                        aria-label="Select cover"
                      >
                        <img
                          src={m.url}
                          alt={m.caption || 'cover'}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                        {selected ? (
                          <div className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-cream/85 text-ink shadow-soft dark:bg-black/40 dark:text-cream">
                            <Star size={16} className="fill-current" />
                          </div>
                        ) : null}
                      </button>
                    )
                  })}
                {draftMedia.filter((m) => m.type === 'photo').length === 0 ? (
                  <div className="text-sm text-muted dark:text-cream/70">
                    Chưa có ảnh nào để chọn làm đại diện.
                  </div>
                ) : null}
              </div>
            </div>

            {selectedCoverPhoto ? (
              <div className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-medium text-ink dark:text-cream">
                    Căn chỉnh ảnh đại diện
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setCoverFocalX(50)
                      setCoverFocalY(50)
                    }}
                    className="rounded-full border border-rose/25 bg-white/60 px-4 py-1.5 text-xs font-medium text-ink transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-cream dark:hover:bg-white/10"
                  >
                    Đặt lại về giữa
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted dark:text-cream/70">
                  Kéo ảnh để chọn vùng hiển thị
                </p>

                <div
                  ref={coverPreviewRef}
                  className={[
                    'relative mt-3 aspect-video max-w-xl overflow-hidden rounded-2xl border border-rose/15 bg-black/30 select-none touch-none',
                    draggingCover ? 'cursor-grabbing' : 'cursor-grab',
                  ].join(' ')}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    setDraggingCover(true)
                    e.currentTarget.setPointerCapture(e.pointerId)
                    updateCoverFocalFromPointer(e.clientX, e.clientY)
                  }}
                  onPointerMove={(e) => {
                    if (!draggingCover) return
                    updateCoverFocalFromPointer(e.clientX, e.clientY)
                  }}
                  onPointerUp={(e) => {
                    setDraggingCover(false)
                    e.currentTarget.releasePointerCapture(e.pointerId)
                  }}
                  onPointerCancel={() => setDraggingCover(false)}
                >
                  <img
                    src={selectedCoverPhoto.url}
                    alt={selectedCoverPhoto.caption || 'cover preview'}
                    className="h-full w-full object-cover"
                    style={{ objectPosition: coverPosition }}
                    draggable={false}
                  />
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute left-1/2 top-1/2 h-8 w-px -translate-x-1/2 -translate-y-1/2 bg-white/70" />
                    <div className="absolute left-1/2 top-1/2 h-px w-8 -translate-x-1/2 -translate-y-1/2 bg-white/70" />
                    <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90 bg-white/60" />
                  </div>
                </div>
              </div>
            ) : null}

            {draftMedia.length ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {draftMedia.map((m) => (
                  <div
                    key={m.id}
                    className="group relative overflow-hidden rounded-2xl border border-rose/15 bg-white/60 dark:border-white/10 dark:bg-white/5"
                  >
                    <img
                      src={getMediaThumbnailUrl(m)}
                      alt={m.caption || (m.type === 'video' ? 'video' : 'photo')}
                      className="aspect-[16/10] w-full object-cover"
                      loading="lazy"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const ok = window.confirm('Xóa ảnh này?')
                        if (!ok) return
                        setDraftMedia((prev) => prev.filter((x) => x.id !== m.id))
                        setCoverMediaId((cur) => (cur === m.id ? null : cur))
                      }}
                      className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-cream/85 text-ink shadow-soft transition hover:bg-cream dark:bg-black/40 dark:text-cream"
                      aria-label="Remove"
                    >
                      <X size={18} />
                    </button>
                    <div className="p-3">
                      <input
                        value={m.caption || ''}
                        onChange={(e) =>
                          setDraftMedia((prev) =>
                            prev.map((x) =>
                              x.id === m.id ? { ...x, caption: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder="Thêm mô tả cho ảnh này..."
                        className="w-full rounded-xl border border-rose/15 bg-white/70 px-3 py-2 text-sm outline-none focus:border-rose/40 dark:border-white/10 dark:bg-white/5"
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setAddMoreOpen(true)}
                  className="grid aspect-[16/10] place-items-center rounded-2xl border border-dashed border-rose/30 bg-cream/40 text-sm font-medium text-ink transition hover:border-rose/45 hover:bg-cream/60 dark:border-white/15 dark:bg-white/5 dark:text-cream dark:hover:bg-white/10"
                >
                  <span>+ Thêm ảnh/video</span>
                </button>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setAddMoreOpen(true)}
                  className="grid aspect-[16/10] place-items-center rounded-2xl border border-dashed border-rose/30 bg-cream/40 text-sm font-medium text-ink transition hover:border-rose/45 hover:bg-cream/60 dark:border-white/15 dark:bg-white/5 dark:text-cream dark:hover:bg-white/10"
                >
                  <span>+ Thêm ảnh/video</span>
                </button>
              </div>
            )}

            {addMoreOpen ? (
              <div className="mt-6">
                <UploadZone
                  items={uploader.items}
                  onAddFiles={uploader.addFiles}
                  onRemove={uploader.removeItem}
                  onCancel={uploader.cancelUpload}
                  onReorder={uploader.reorder}
                  onCaption={uploader.setCaption}
                />
              </div>
            ) : null}
          </section>
        ) : (
          <MediaGrid
            items={memory.mediaItems}
            onItemClick={(index) => {
              setLightboxIndex(index)
              setLightboxOpen(true)
            }}
          />
        )}
      </div>

      <LightboxViewer
        open={lightboxOpen}
        index={lightboxIndex}
        slides={slides}
        onClose={() => setLightboxOpen(false)}
      />
    </main>
  )
}

