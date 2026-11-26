const source = {
  specVersion: 1,
  id: "mangadex",
  name: "MangaDex",
  langs: ["en", "ru"],
  hosts: ["api.mangadex.org", "uploads.mangadex.org", ".mangadex.network"],

  async search(query, filters) {
    const params = new URLSearchParams()
    params.set("limit", "20")
    params.append("includes[]", "cover_art")
    params.set("title", String(query ?? ""))
    const selected = filters && typeof filters === "object" ? filters : {}
    if (selected.year) params.set("year", String(selected.year))
    if (Array.isArray(selected.status)) {
      for (const status of selected.status) params.append("status[]", String(status))
    }
    if (Array.isArray(selected.tags) && selected.tags.length > 0) {
      const ids = await tagIds(selected.tags)
      for (const id of ids) params.append("includedTags[]", id)
      if (selected.tagMode === "all") params.set("includedTagsMode", "AND")
    }
    const data = await readJson("https://api.mangadex.org/manga?" + params.toString())
    return mapManga(data)
  },

  async listPopular(offset) {
    const params = new URLSearchParams()
    params.set("limit", "20")
    params.set("offset", String(Math.max(0, Math.floor(Number(offset) || 0))))
    params.append("includes[]", "cover_art")
    params.set("order[followedCount]", "desc")
    const data = await readJson("https://api.mangadex.org/manga?" + params.toString())
    return mapManga(data)
  },

  async getMangaDetails(mangaId) {
    const params = new URLSearchParams()
    params.append("includes[]", "cover_art")
    const data = await readJson(
      "https://api.mangadex.org/manga/" + encodeURIComponent(String(mangaId)) + "?" + params.toString(),
    )
    const manga = data.data
    if (!manga?.id) return null
    const attrs = manga.attributes ?? {}
    const title = pickTitle(attrs.title) || manga.id
    const seen = new Set([title.toLowerCase()])
    const altTitles = []
    for (const row of attrs.altTitles ?? []) {
      if (!row || typeof row !== "object") continue
      for (const value of Object.values(row)) {
        const text = String(value ?? "").trim()
        if (!text || seen.has(text.toLowerCase())) continue
        seen.add(text.toLowerCase())
        altTitles.push(text)
      }
    }
    const description = pickTitle(attrs.description)
    return {
      title,
      altTitles,
      description: description || undefined,
      tags: (attrs.tags ?? []).map((tag) => tag.attributes?.name?.en).filter(Boolean),
      year: typeof attrs.year === "number" ? attrs.year : undefined,
      status: attrs.status || undefined,
      contentRating: attrs.contentRating || undefined,
      coverUrl: coverUrl(manga, "512"),
    }
  },

  async listChapters(mangaId) {
    const params = new URLSearchParams()
    params.set("limit", "100")
    params.append("translatedLanguage[]", "en")
    params.append("translatedLanguage[]", "ru")
    params.set("includeExternalUrl", "0")
    params.set("order[chapter]", "asc")
    const url =
      "https://api.mangadex.org/manga/" +
      encodeURIComponent(String(mangaId)) +
      "/feed?" +
      params.toString()
    const data = await readJson(url)
    return (data.data ?? [])
      .filter((chapter) => (chapter.attributes?.pages ?? 0) > 0 && !chapter.attributes?.externalUrl)
      .map((chapter) => ({
        id: chapter.id,
        mangaId: String(mangaId),
        title: chapter.attributes?.title || undefined,
        number: chapter.attributes?.chapter || undefined,
        volume: chapter.attributes?.volume || undefined,
        lang: chapter.attributes?.translatedLanguage,
        publishedAt: chapter.attributes?.publishAt || undefined,
      }))
  },

  async listPages(chapterId) {
    const data = await readJson(
      "https://api.mangadex.org/at-home/server/" + encodeURIComponent(String(chapterId)),
    )
    const hash = data.chapter?.hash
    const files = data.chapter?.data ?? []
    const base = String(data.baseUrl || "").replace(/\/$/, "")
    return files.map((file, index) => ({
      index,
      url: `${base}/data/${hash}/${file}`,
    }))
  },
}

async function readJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error("MangaDex " + response.status)
  }
  return response.json()
}

function mapManga(data) {
  return (data.data ?? []).map((manga) => ({
    id: manga.id,
    title: pickTitle(manga.attributes?.title) || manga.id,
    lang: manga.attributes?.originalLanguage,
    coverUrl: coverUrl(manga),
    year: manga.attributes?.year || undefined,
    status: manga.attributes?.status || undefined,
    tags: (manga.attributes?.tags ?? []).map((tag) => tag.attributes?.name?.en).filter(Boolean),
  }))
}

function coverUrl(manga, size = "256") {
  const cover = (manga.relationships ?? []).find((item) => item.type === "cover_art")
  const file = cover?.attributes?.fileName
  if (!manga.id || !file) return undefined
  return `https://uploads.mangadex.org/covers/${manga.id}/${file}.${size}.jpg`
}

function pickTitle(titles) {
  if (!titles) return ""
  return titles.en || titles.ru || Object.values(titles)[0] || ""
}

const TAG_NAMES = {
  action: "Action",
  adventure: "Adventure",
  comedy: "Comedy",
  drama: "Drama",
  fantasy: "Fantasy",
  "sci-fi": "Sci-Fi",
  romance: "Romance",
  "slice-of-life": "Slice of Life",
  thriller: "Thriller",
  horror: "Horror",
  mystery: "Mystery",
  supernatural: "Supernatural",
  psychological: "Psychological",
  sports: "Sports",
  mecha: "Mecha",
  music: "Music",
  historical: "Historical",
  military: "Military",
  school: "School Life",
  "martial-arts": "Martial Arts",
}

let tagIndex = null

async function tagIds(slugs) {
  if (!tagIndex) {
    const data = await readJson("https://api.mangadex.org/manga/tag")
    tagIndex = new Map()
    for (const tag of data.data ?? []) {
      const name = tag.attributes?.name?.en
      if (name && tag.id) tagIndex.set(name.toLowerCase(), tag.id)
    }
  }
  return slugs
    .map((slug) => TAG_NAMES[slug])
    .filter(Boolean)
    .map((name) => tagIndex.get(name.toLowerCase()))
    .filter(Boolean)
}

export default source
