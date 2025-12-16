import { describe, expect, it, vi } from 'vitest'

/**
 * Better Auth callback patterns:
 * - Standard (email, social): signIn.email(data, { onSuccess })
 * - Passkey: signIn.passkey({ fetchOptions: { onSuccess } })
 */

function createWrapper(waitFn: () => Promise<void>) {
  return <T extends (...args: any[]) => Promise<any>>(method: T): T => (async (...args: any[]) => {
    const [data, options] = args
    const nested = data?.fetchOptions?.onSuccess
    const topLevel = options?.onSuccess

    if (!nested && !topLevel)
      return method(data, options)

    if (nested) {
      const onSuccess = async (ctx: any) => {
        await waitFn()
        await nested(ctx)
      }
      return method({ ...data, fetchOptions: { ...data.fetchOptions, onSuccess } }, options)
    }
    const onSuccess = async (ctx: any) => {
      await waitFn()
      await topLevel(ctx)
    }
    return method(data, { ...options, onSuccess })
  }) as T
}

describe('wrapAuthMethod', () => {
  it('standard: signIn.email(data, { onSuccess })', async () => {
    const wait = vi.fn()
    const onSuccess = vi.fn()
    const method = vi.fn(async (_, opts) => {
      await opts?.onSuccess?.('ctx')
    })
    await createWrapper(wait)(method)({ email: 'a@b.c' }, { onSuccess })
    expect(wait).toHaveBeenCalledBefore(onSuccess)
  })

  it('passkey: signIn.passkey({ fetchOptions: { onSuccess } })', async () => {
    const wait = vi.fn()
    const onSuccess = vi.fn()
    const method = vi.fn(async (opts) => {
      await opts?.fetchOptions?.onSuccess?.('ctx')
    })
    await createWrapper(wait)(method)({ fetchOptions: { onSuccess } })
    expect(wait).toHaveBeenCalledBefore(onSuccess)
  })

  it('no callback: passes through', async () => {
    const wait = vi.fn()
    const method = vi.fn()
    await createWrapper(wait)(method)({ email: 'a@b.c' })
    expect(wait).not.toHaveBeenCalled()
  })
})
