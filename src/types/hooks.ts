import type { BetterAuthOptions } from 'better-auth'

export interface ClientPluginImport {
  /** Import path to the plugin file (e.g., 'my-module/runtime/client-plugin') */
  from: string
  /** Named export to import (e.g., 'myPlugin'). If not specified, uses default export. */
  name?: string
}

export interface ClientExtendConfig {
  /** Plugin imports to add to the client config */
  plugins?: ClientPluginImport[]
}

declare module '@nuxt/schema' {
  interface NuxtHooks {
    /**
     * Extend better-auth server config with additional plugins or options.
     * Called during schema generation for NuxtHub database.
     * @param config - Partial config to merge into the server auth options
     */
    'better-auth:config:extend': (config: Partial<BetterAuthOptions>) => void | Promise<void>

    /**
     * Extend better-auth client config with additional plugins.
     * Called during module setup, affects runtime client.
     * @param config - Plugin imports to merge into the client auth options
     */
    'better-auth:client:extend': (config: ClientExtendConfig) => void | Promise<void>
  }
}
