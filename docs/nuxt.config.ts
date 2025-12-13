import yaml from '@rollup/plugin-yaml'

export default defineNuxtConfig({
  extends: ['docus'],

  css: ['~/assets/css/main.css'],

  site: {
    url: 'https://nuxt-better-auth.onmax.me',
    name: 'Nuxt Better Auth',
    description: 'Nuxt module for Better Auth with auto schema generation, route protection, and session management.',
    defaultLocale: 'en',
  },

  app: {
    head: {
      meta: [
        { property: 'og:image', content: '/og.png' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
    },
  },

  devtools: { enabled: true },

  future: { compatibilityVersion: 4 },

  compatibilityDate: '2025-01-01',

  vite: { plugins: [yaml()] },

  ogImage: { compatibility: { runtime: { resvg: false } } },
})
