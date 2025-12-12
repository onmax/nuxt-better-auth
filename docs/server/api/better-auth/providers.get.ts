export default defineEventHandler(async () => {
  const baseDocsUrl = 'https://www.better-auth.com/docs'

  const titleCase = (id: string) =>
    id
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())

  const html = await fetch(`${baseDocsUrl}/introduction`).then(r => r.text())

  const ids = new Set<string>()
  const re = /\/docs\/authentication\/([a-z0-9-]+)(?=["\\])/g
  for (const match of html.matchAll(re)) {
    const id = match[1]
    if (!id || id === 'oauth' || id === 'other-social-providers')
      continue
    ids.add(id)
  }

  return Array.from(ids)
    .sort((a, b) => a.localeCompare(b))
    .map(id => ({
      id,
      name: titleCase(id),
      href: `${baseDocsUrl}/authentication/${id}`,
    }))
})
