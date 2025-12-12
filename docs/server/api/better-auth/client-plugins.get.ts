export default defineEventHandler(async () => {
  const baseDocsUrl = 'https://www.better-auth.com/docs'

  const html = await fetch(`${baseDocsUrl}/introduction`).then(r => r.text())

  const pluginSlugs = new Set<string>()
  const pluginRe = /\/docs\/plugins\/([a-z0-9-]+)(?=["\\])/g
  for (const pluginMatch of html.matchAll(pluginRe)) {
    if (pluginMatch[1])
      pluginSlugs.add(pluginMatch[1])
  }

  const clientDtsUrl = 'https://unpkg.com/better-auth/dist/client/plugins/index.d.mts'
  const dts = await fetch(clientDtsUrl).then(r => r.text())

  const exportNames = new Set<string>()
  const exportRe = /export\s+(?:declare\s+)?(?:const|function)\s+(\w+)/g
  for (const exportMatch of dts.matchAll(exportRe)) {
    const name = exportMatch[1]
    if (name)
      exportNames.add(name)
  }

  const clientPluginNames = Array.from(exportNames)
    .filter(name => name.endsWith('Client'))
    .sort((a, b) => a.localeCompare(b))

  const camelToKebab = (input: string) =>
    input
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, '$1-$2')
      .toLowerCase()

  const toSlug = (clientExport: string) => {
    const base = clientExport.replace(/Client$/, '')
    const candidate = camelToKebab(base)
    const overrides: Record<string, string> = {
      'two-factor': '2fa',
      'o-auth-proxy': 'oauth-proxy',
    }
    return overrides[candidate] || candidate
  }

  return clientPluginNames.map((exportName) => {
    const slug = toSlug(exportName)
    return {
      exportName,
      slug,
      href: pluginSlugs.has(slug) ? `${baseDocsUrl}/plugins/${slug}` : null,
    }
  })
})
