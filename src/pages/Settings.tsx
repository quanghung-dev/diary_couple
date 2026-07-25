import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Copy, HeartHandshake } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useCouple } from '../hooks/useCouple'
import { formatViFullDate } from '../lib/utils'

function Avatar({
  label,
  photoURL,
}: {
  label: string
  photoURL?: string | null
}) {
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={label}
        className="h-12 w-12 rounded-full border border-rose/20 object-cover"
      />
    )
  }
  return (
    <div className="grid h-12 w-12 place-items-center rounded-full border border-rose/20 bg-rose-light/60 font-serif text-lg text-ink dark:border-white/10 dark:bg-white/5 dark:text-cream">
      {label.trim().slice(0, 1).toUpperCase()}
    </div>
  )
}

export default function Settings() {
  const { user } = useAuth()
  const { couple, loading, memoriesCount, createInviteLink, acceptInvite, setStartDate } =
    useCouple()
  const [params, setParams] = useSearchParams()
  const inviteToken = params.get('invite') ?? ''
  const [inviteLink, setInviteLink] = useState<string>('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!inviteToken) return
    ;(async () => {
      try {
        setBusy(true)
        await acceptInvite(inviteToken)
        toast.success('Đã ghép đôi thành công')
        params.delete('invite')
        setParams(params, { replace: true })
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Không thể ghép đôi')
      } finally {
        setBusy(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteToken])

  const anniversaryText = useMemo(() => {
    if (!couple?.startDate) return ''
    return formatViFullDate(couple.startDate)
  }, [couple?.startDate])

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">Cài đặt</h1>
          <p className="mt-2 text-muted dark:text-cream/70">
            Ghép đôi, kỷ niệm ngày yêu, và quản lý tài khoản.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-[28px] border border-rose/15 bg-white/70 p-6 shadow-soft dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl">Cặp đôi</h2>
            <HeartHandshake className="text-rose" size={20} />
          </div>

          {loading ? (
            <div className="mt-6 h-24 animate-pulse rounded-2xl bg-rose-light/50 dark:bg-white/5" />
          ) : (
            <>
              <div className="mt-5 flex items-center gap-3">
                <Avatar label={user?.displayName ?? user?.email ?? 'Bạn'} photoURL={user?.photoURL} />
                <div className="text-muted dark:text-cream/70">+</div>
                <Avatar label={couple?.user2 ? 'Partner' : '?'} photoURL={null} />
                <div className="ml-2">
                  <p className="text-sm text-muted dark:text-cream/70">
                    Couple ID
                  </p>
                  <p className="font-mono text-sm">{couple?.id ?? '—'}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-sm">
                <div className="flex items-center justify-between rounded-2xl border border-rose/10 bg-cream/60 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <span className="text-muted dark:text-cream/70">Kỷ niệm</span>
                  <span className="font-medium">
                    {memoriesCount == null ? '—' : memoriesCount}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-rose/10 bg-cream/60 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <span className="text-muted dark:text-cream/70">Ngày bắt đầu</span>
                  <span className="font-medium">{anniversaryText || '—'}</span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <input
                  type="date"
                  className="rounded-full border border-rose/20 bg-white/70 px-4 py-2 text-sm outline-none dark:border-white/10 dark:bg-white/5"
                  onChange={async (e) => {
                    if (!e.target.value) return
                    try {
                      setBusy(true)
                      await setStartDate(new Date(e.target.value))
                      toast.success('Đã cập nhật ngày kỷ niệm')
                    } catch {
                      toast.error('Không thể cập nhật')
                    } finally {
                      setBusy(false)
                    }
                  }}
                  disabled={busy}
                />
              </div>
            </>
          )}
        </section>

        <section className="rounded-[28px] border border-rose/15 bg-white/70 p-6 shadow-soft dark:border-white/10 dark:bg-white/5">
          <h2 className="font-serif text-2xl">Ghép đôi</h2>
          <p className="mt-2 text-sm text-muted dark:text-cream/70">
            Nếu bạn chưa có người thương ở đây, hãy tạo link mời và gửi riêng tư.
          </p>

          <div className="mt-5 grid gap-3">
            <button
              type="button"
              disabled={busy || loading || !couple || Boolean(couple.user2)}
              onClick={async () => {
                try {
                  setBusy(true)
                  const link = await createInviteLink()
                  setInviteLink(link)
                  await navigator.clipboard.writeText(link)
                  toast.success('Đã sao chép link mời')
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : 'Không thể tạo link mời')
                } finally {
                  setBusy(false)
                }
              }}
              className="rounded-full bg-rose px-6 py-3 text-sm font-medium text-cream shadow-soft transition hover:brightness-95 disabled:opacity-60"
            >
              {couple?.user2 ? 'Đã ghép đôi' : 'Tạo link mời'}
            </button>

            {inviteLink ? (
              <div className="flex items-center gap-2 rounded-2xl border border-rose/10 bg-cream/60 p-3 dark:border-white/10 dark:bg-white/5">
                <input
                  value={inviteLink}
                  readOnly
                  className="w-full bg-transparent text-sm outline-none"
                />
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose/15 bg-white/60 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inviteLink)
                      toast.success('Đã sao chép')
                    } catch {
                      toast.error('Không thể sao chép')
                    }
                  }}
                  aria-label="Copy invite link"
                >
                  <Copy size={16} />
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <RecoverySection coupleId={couple?.id} userId={user?.uid} />
    </main>
  )
}

function RecoverySection({
  coupleId,
  userId,
}: {
  coupleId?: string
  userId?: string
}) {
  const [mode, setMode] = useState<'api' | 'manual'>('api')
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [urlsText, setUrlsText] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')

  const cloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string) || 'dl8euunhe'

  const handleAutoFetchAndRestore = async () => {
    if (!coupleId || !userId) {
      toast.error('Vui lòng kiểm tra trạng thái đăng nhập và ghép đôi trước')
      return
    }

    if (!apiKey.trim() || !apiSecret.trim()) {
      toast.error('Vui lòng nhập đầy đủ Cloudinary API Key và API Secret')
      return
    }

    try {
      setRestoring(true)
      setProgressMsg('🔍 Đang kết nối Cloudinary API để quét tìm tất cả ảnh/video...')

      const { fetchCloudinaryResourcesApi, autoRestoreMemoriesFromCloudinary } =
        await import('../lib/recovery')

      const urls = await fetchCloudinaryResourcesApi({
        cloudName,
        apiKey,
        apiSecret,
        coupleId,
      })

      if (urls.length === 0) {
        toast.error('Không tìm thấy tệp ảnh/video nào trong tài khoản Cloudinary của bạn.')
        return
      }

      setProgressMsg(`🎉 Đã tìm thấy ${urls.length} ảnh/video! Đang nhóm và khôi phục vào Firestore...`)

      const result = await autoRestoreMemoriesFromCloudinary({
        urls,
        coupleId,
        userId,
        onProgress: (processed, total, restoredCount) => {
          setProgressMsg(
            `Đang xử lý ${processed}/${total} nhóm kỷ niệm (Đã tạo ${restoredCount} bài)...`,
          )
        },
      })

      toast.success(
        `Đã tự động khôi phục thành công ${result.restoredCount} bài viết kỷ niệm!`,
      )
      setApiKey('')
      setApiSecret('')
      setProgressMsg('')
    } catch (e: unknown) {
      console.error(e)
      toast.error(
        e instanceof Error ? e.message : 'Tự động khôi phục thất bại',
      )
    } finally {
      setRestoring(false)
    }
  }

  const handleManualRestore = async () => {
    if (!coupleId || !userId) {
      toast.error('Vui lòng kiểm tra trạng thái đăng nhập và ghép đôi trước')
      return
    }

    const rawUrls = urlsText
      .split(/[\n,\s]+/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0 && u.includes('cloudinary.com'))

    if (rawUrls.length === 0) {
      toast.error('Vui lòng dán ít nhất 1 đường dẫn ảnh/video Cloudinary hợp lệ')
      return
    }

    try {
      setRestoring(true)
      setProgressMsg('Đang phân tích các URL...')

      const { autoRestoreMemoriesFromCloudinary } = await import(
        '../lib/recovery'
      )

      const result = await autoRestoreMemoriesFromCloudinary({
        urls: rawUrls,
        coupleId,
        userId,
        onProgress: (processed, total, restoredCount) => {
          setProgressMsg(
            `Đang xử lý ${processed}/${total} nhóm kỷ niệm (Đã tạo ${restoredCount} bài)...`,
          )
        },
      })

      toast.success(
        `Đã khôi phục thành công ${result.restoredCount} bài viết kỷ niệm!`,
      )
      setUrlsText('')
      setProgressMsg('')
    } catch (e: unknown) {
      console.error(e)
      toast.error(
        e instanceof Error ? e.message : 'Khôi phục thất bại, vui lòng thử lại',
      )
    } finally {
      setRestoring(false)
    }
  }

  return (
    <section className="mt-8 rounded-[28px] border border-rose/15 bg-white/70 p-6 shadow-soft dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl">Khôi phục Bài viết Kỷ niệm</h2>
          <p className="mt-1 text-sm text-muted dark:text-cream/70">
            Tự động tìm kiếm ảnh/video trên Cloudinary và tạo lại tất cả bài viết Kỷ niệm bị mất.
          </p>
        </div>

        <div className="flex rounded-full border border-rose/20 p-1 dark:border-white/10">
          <button
            type="button"
            onClick={() => setMode('api')}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
              mode === 'api'
                ? 'bg-rose text-cream shadow-sm'
                : 'text-muted hover:text-ink dark:text-cream/70'
            }`}
          >
            🔍 Tự động 100% (API Key)
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
              mode === 'manual'
                ? 'bg-rose text-cream shadow-sm'
                : 'text-muted hover:text-ink dark:text-cream/70'
            }`}
          >
            📋 Dán URL thủ công
          </button>
        </div>
      </div>

      {mode === 'api' ? (
        <div className="mt-5 grid gap-4">
          <p className="text-xs text-muted dark:text-cream/70">
            Nhập <strong>API Key</strong> và <strong>API Secret</strong> lấy từ Cloudinary Dashboard để hệ thống tự động quét 100% toàn bộ kho ảnh của bạn:
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-ink dark:text-cream/90">
                Cloudinary API Key
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Ví dụ: 123456789012345"
                className="mt-1.5 w-full rounded-2xl border border-rose/20 bg-white/80 px-4 py-2.5 text-xs outline-none transition focus:border-rose dark:border-white/10 dark:bg-white/5 dark:text-cream"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink dark:text-cream/90">
                Cloudinary API Secret
              </label>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Ví dụ: aBcDeFgHiJkLmNoPqRsTuVwXyZ"
                className="mt-1.5 w-full rounded-2xl border border-rose/20 bg-white/80 px-4 py-2.5 text-xs outline-none transition focus:border-rose dark:border-white/10 dark:bg-white/5 dark:text-cream"
              />
            </div>
          </div>

          {progressMsg ? (
            <p className="text-xs font-medium text-rose dark:text-rose-light">
              ⏳ {progressMsg}
            </p>
          ) : null}

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted dark:text-cream/60">
              🔒 API Secret chỉ sử dụng tạm thời để quét ảnh và không lưu lại trên server.
            </p>

            <button
              type="button"
              disabled={restoring || !apiKey.trim() || !apiSecret.trim()}
              onClick={handleAutoFetchAndRestore}
              className="rounded-full bg-rose px-6 py-2.5 text-sm font-medium text-cream shadow-soft transition hover:brightness-95 disabled:opacity-50"
            >
              {restoring ? 'Đang quét & Khôi phục...' : '🚀 Quét & Khôi phục Tự động'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <label className="block text-xs font-medium text-ink dark:text-cream/90">
            Dán danh sách các đường dẫn (URL) ảnh/video từ Cloudinary (mỗi link 1 dòng hoặc cách nhau bởi dấu phẩy):
          </label>
          <textarea
            rows={5}
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            placeholder={`Ví dụ:\nhttps://res.cloudinary.com/dl8euunhe/image/upload/v1740000000/couples/CP-1/memories/MEM-1/photo1.jpg\nhttps://res.cloudinary.com/dl8euunhe/image/upload/v1740000000/couples/CP-1/memories/MEM-1/photo2.jpg`}
            className="mt-2 w-full rounded-2xl border border-rose/20 bg-white/80 p-4 font-mono text-xs outline-none transition focus:border-rose dark:border-white/10 dark:bg-white/5 dark:text-cream"
          />

          {progressMsg ? (
            <p className="mt-2 text-xs font-medium text-rose dark:text-rose-light">
              ⏳ {progressMsg}
            </p>
          ) : null}

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted dark:text-cream/60">
              💡 Bạn có thể dán danh sách URL ảnh được lấy từ Cloudinary Dashboard.
            </p>

            <button
              type="button"
              disabled={restoring || !urlsText.trim()}
              onClick={handleManualRestore}
              className="rounded-full bg-rose px-6 py-2.5 text-sm font-medium text-cream shadow-soft transition hover:brightness-95 disabled:opacity-50"
            >
              {restoring ? 'Đang khôi phục...' : '🚀 Khôi phục thủ công'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
