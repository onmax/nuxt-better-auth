import type { BetterAuthOptions, BetterAuthPlugin, UnionToIntersection } from 'better-auth'
import type { InferFieldsOutput } from 'better-auth/db'

export type PluginsFromConfig<C> = C extends { plugins: infer P }
  ? P
  : C extends { plugins?: infer P }
      ? P
      : []

export type NormalizePlugins<P> = P extends readonly (infer T)[]
  ? Array<T & BetterAuthPlugin>
  : P extends (infer T)[]
      ? Array<T & BetterAuthPlugin>
      : BetterAuthPlugin[]

export type BetterAuthConfigFromServerConfig<C> = Omit<BetterAuthOptions, 'plugins'> & Omit<C, 'plugins'> & {
  plugins?: NormalizePlugins<PluginsFromConfig<C>>
}

type InferModelFieldsFromPlugins<P, M extends string> = P extends readonly (infer Plugin)[]
  ? UnionToIntersection<Plugin extends { schema: { [K in M]: { fields: infer F } } } ? InferFieldsOutput<F> : {}>
  : P extends (infer Plugin)[]
      ? UnionToIntersection<Plugin extends { schema: { [K in M]: { fields: infer F } } } ? InferFieldsOutput<F> : {}>
      : {}

type InferModelFieldsFromOptions<C, M extends 'user' | 'session'> = C extends { [K in M]: { additionalFields: infer F } }
  ? InferFieldsOutput<F>
  : {}

export type UserFieldsFromConfig<C> = InferModelFieldsFromPlugins<PluginsFromConfig<C>, 'user'> & InferModelFieldsFromOptions<C, 'user'>
export type SessionFieldsFromConfig<C> = InferModelFieldsFromPlugins<PluginsFromConfig<C>, 'session'> & InferModelFieldsFromOptions<C, 'session'>
