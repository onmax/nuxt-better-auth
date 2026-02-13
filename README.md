<p align="center">
  <img src="https://raw.githubusercontent.com/onmax/nuxt-better-auth/main/.github/og.png" alt="Nuxt Better Auth" width="100%">
  <br>
  <sub>Designed by <a href="https://github.com/HugoRCD">HugoRCD</a></sub>
</p>

<h1 align="center">@onmax/nuxt-better-auth</h1>

<p align="center">Nuxt module for <a href="https://better-auth.com">Better Auth</a></p>

<p align="center">
  <a href="https://npmjs.com/package/@onmax/nuxt-better-auth"><img src="https://img.shields.io/npm/v/@onmax/nuxt-better-auth/latest.svg?style=flat&colorA=020420&colorB=00DC82" alt="npm version"></a>
  <a href="https://npm.chart.dev/@onmax/nuxt-better-auth"><img src="https://img.shields.io/npm/dm/@onmax/nuxt-better-auth.svg?style=flat&colorA=020420&colorB=00DC82" alt="npm downloads"></a>
  <a href="https://npmjs.com/package/@onmax/nuxt-better-auth"><img src="https://img.shields.io/npm/l/@onmax/nuxt-better-auth.svg?style=flat&colorA=020420&colorB=00DC82" alt="License"></a>
  <a href="https://nuxt.com"><img src="https://img.shields.io/badge/Nuxt-020420?logo=nuxt.js" alt="Nuxt"></a>
</p>

> [!WARNING]
> This library is a work in progress and not ready for production use.

## Documentation

**[nuxt-better-auth.onmax.me](https://nuxt-better-auth.onmax.me/)**

## Alpha Migration Notes

- `auth.database.*` module options are removed. This now fails fast during module setup.
- Configure Better Auth's `database` directly in `server/auth.config.ts`, or use a module that registers `better-auth:database:providers`.

## Development Notes

- `@libsql/linux-x64-gnu` is temporarily pinned in dev dependencies to avoid Nitro test build `ENOENT` issues with optional libsql platform packages.
- TODO: remove this pin once upstream Nitro/libsql optional dependency resolution is stable across local and CI environments.

## License

MIT
