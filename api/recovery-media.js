export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method !== 'GET') return res.status(405).end()

  const authorization = req.headers.authorization
  if (!authorization?.startsWith('Bearer ')) return res.status(401).end()

  const { coupleId, cursor } = req.query
  if (typeof coupleId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(coupleId) ||
      (cursor !== undefined && typeof cursor !== 'string')) {
    return res.status(400).end()
  }

  const {
    VITE_FIREBASE_PROJECT_ID: projectId,
    VITE_CLOUDINARY_CLOUD_NAME: cloudName,
    CLOUDINARY_API_KEY: apiKey,
    CLOUDINARY_API_SECRET: apiSecret,
  } = process.env
  if (!projectId || !cloudName || !apiKey || !apiSecret) return res.status(503).end()

  try {
    // Firestore evaluates its couple membership rule using the caller's Firebase ID token.
    const membership = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/couples/${coupleId}`,
      { headers: { Authorization: authorization } },
    )
    if (!membership.ok) return res.status(403).end()

    const prefix = `couples/${coupleId}/memories/`
    const search = new URL(`https://api.cloudinary.com/v1_1/${cloudName}/resources/search`)
    search.searchParams.set('max_results', '500')
    search.searchParams.set('fields', 'secure_url,width,height')
    if (cursor) search.searchParams.set('next_cursor', cursor)

    const headers = { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}` }
    search.searchParams.set('expression', `type:upload AND (resource_type:image OR resource_type:video) AND (public_id:${prefix}* OR asset_folder:${prefix}*)`)
    let response = await fetch(search, { headers })
    if (response.status === 400) {
      search.searchParams.set('expression', `type:upload AND (resource_type:image OR resource_type:video) AND public_id:${prefix}*`)
      response = await fetch(search, { headers })
    }
    if (!response.ok) return res.status(502).end()

    const page = await response.json()
    const assets = []
    for (const asset of page.resources) {
      const folder = asset.asset_folder || asset.public_id.slice(0, asset.public_id.lastIndexOf('/'))
      if (!folder.startsWith(prefix)) continue
      const [memoryId] = folder.slice(prefix.length).split('/')
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(memoryId) ||
          !['image', 'video'].includes(asset.resource_type) ||
          !asset.secure_url?.startsWith(`https://res.cloudinary.com/${cloudName}/`)) continue

      assets.push({
        memoryId,
        publicId: asset.public_id,
        url: asset.secure_url,
        type: asset.resource_type === 'video' ? 'video' : 'photo',
        createdAt: asset.created_at,
        width: asset.width ?? 0,
        height: asset.height ?? 0,
      })
    }

    return res.status(200).json({ assets, cursor: page.next_cursor })
  } catch (error) {
    console.error('Cloud recovery failed', error)
    return res.status(502).end()
  }
}
