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
    return (data.data ?? []).map((manga) => ({
      id: manga.id,
      title: pickTitle(manga.attributes?.title) || manga.id,
      lang: manga.attributes?.originalLanguage,
      coverUrl: coverUrl(manga),
      year: manga.attributes?.year || undefined,
      status: manga.attributes?.status || undefined,
      tags: (manga.attributes?.tags ?? [])
        .map((tag) => tag.attributes?.name?.en)
        .filter(Boolean),
    }))
  },

  async listChapters(mangaId) {
    const url =
      "https://api.mangadex.org/manga/" +
      encodeURIComponent(String(mangaId)) +
      "/feed?limit=100&translatedLanguage[]=en&translatedLanguage[]=ru&order[chapter]=asc"
    const data = await readJson(url)
    return (data.data ?? []).map((chapter) => ({
      id: chapter.id,
      mangaId: String(mangaId),
      title: chapter.attributes?.title || undefined,
      number: chapter.attributes?.chapter || undefined,
      lang: chapter.attributes?.translatedLanguage,
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

function coverUrl(manga) {
  const cover = (manga.relationships ?? []).find((item) => item.type === "cover_art")
  const file = cover?.attributes?.fileName
  if (!manga.id || !file) return undefined
  return `https://uploads.mangadex.org/covers/${manga.id}/${file}.256.jpg`
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
