import yaml from '@rollup/plugin-yaml'

export default defineNuxtConfig({
  extends: ['docus'],
  modules: ['@vueuse/nuxt', 'motion-v/nuxt'],

  icon: {
    customCollections: [{ prefix: 'custom', dir: './public/icons' }],
  },

  css: ['~/assets/css/main.css'],

  site: {
    url: 'https://better-auth.nuxtjs.org',
    name: 'Nuxt Better Auth',
    description: 'Nuxt module for Better Auth with auto schema generation, route protection, and session management.',
    defaultLocale: 'en',
  },

  app: {
    head: {
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
      meta: [{ name: 'twitter:card', content: 'summary_large_image' }],
    },
  },

  mdc: {
    highlight: {
      theme: { default: 'synthwave-84', dark: 'synthwave-84', light: 'one-light' },
      langs: ['bash', 'json', 'js', 'ts', 'vue', 'html', 'css', 'yaml', 'sql'],
    },
  },

  devtools: { enabled: true },

  future: { compatibilityVersion: 4 },

  compatibilityDate: '2025-01-01',

  vite: { plugins: [yaml()] },

  ogImage: { compatibility: { runtime: { resvg: false } } },
})
