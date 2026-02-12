import { defineServerAuth } from '../../../../src/runtime/config'

function customAdminLikePlugin() {
  return {
    id: 'custom-admin-like',
    $ERROR_CODES: {
      BROKEN: 'Broken',
    },
    schema: {
      user: {
        fields: {
          role: {
            type: 'string',
            required: false,
            input: false,
          },
        },
      },
    },
  } as const
}

export default defineServerAuth({
  emailAndPassword: { enabled: true },
  plugins: [customAdminLikePlugin()],
  user: {
    additionalFields: {
      internalCode: {
        type: 'string',
        required: false,
      },
    },
  },
})
