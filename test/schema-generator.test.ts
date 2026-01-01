import { describe, expect, it } from 'vitest'
import { generateField } from '../src/schema-generator'

describe('schema-generator', () => {
  it('generates function defaults with $defaultFn', () => {
    const field = {
      type: 'Date',
      required: true,
      defaultValue: () => /* @__PURE__ */ new Date(),
    }
    const result = generateField('createdAt', field, 'sqlite', {})
    expect(result).toContain('.$defaultFn(')
    expect(result).not.toContain('\'() =>') // no quotes around function
  })
})
