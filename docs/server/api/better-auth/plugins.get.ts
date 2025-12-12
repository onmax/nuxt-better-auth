export default defineEventHandler(async () => {
  const baseDocsUrl = 'https://www.better-auth.com/docs'

  const titleCase = (slug: string) =>
    slug
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .replace(/\bOauth\b/g, 'OAuth')
      .replace(/\bOidc\b/g, 'OIDC')
      .replace(/\bApi\b/g, 'API')

  const html = await fetch(`${baseDocsUrl}/introduction`).then(r => r.text())

  const slugs = new Set<string>()
  const re = /\/docs\/plugins\/([a-z0-9-]+)(?=["\\])/g
  for (const match of html.matchAll(re)) {
    const slug = match[1]
    if (!slug)
      continue
    slugs.add(slug)
  }

  return Array.from(slugs)
    .sort((a, b) => a.localeCompare(b))
    .map(slug => ({
      slug,
      name: titleCase(slug),
      href: `${baseDocsUrl}/plugins/${slug}`,
    }))
})
