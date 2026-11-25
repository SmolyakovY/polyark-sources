const source = {
  specVersion: 1,
  id: "mangadex",
  name: "MangaDex",
  langs: ["en", "ru"],
  hosts: ["api.mangadex.org", "uploads.mangadex.org", ".mangadex.network"],

  async search(query) {
    const url =
      "https://api.mangadex.org/manga?limit=20&includes[]=cover_art&title=" +
      encodeURIComponent(String(query ?? ""))
    const data = await readJson(url)
    return (data.data ?? []).map((manga) => ({
      id: manga.id,
      title: pickTitle(manga.attributes?.title) || manga.id,
      lang: manga.attributes?.originalLanguage,
      coverUrl: coverUrl(manga),
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

export default source
