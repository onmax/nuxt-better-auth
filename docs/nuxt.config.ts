import yaml from '@rollup/plugin-yaml'

export default defineNuxtConfig({
  extends: ['docus'],

  css: ['~/assets/css/main.css'],

  $production: { site: { name: 'Nuxt Better Auth' } },

  devtools: { enabled: true },

  future: { compatibilityVersion: 4 },

  compatibilityDate: '2025-01-01',

  vite: { plugins: [yaml()] },
})
