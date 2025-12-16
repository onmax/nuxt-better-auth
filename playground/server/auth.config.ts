import { passkey } from '@better-auth/passkey'
import { admin, multiSession, twoFactor } from 'better-auth/plugins'
import { Resend } from 'resend'
import { defineServerAuth } from '../../src/runtime/config'

const resend = new Resend(process.env.RESEND_API_KEY)
const from = 'Nuxt Better Auth <onboarding@resend.dev>'

export default defineServerAuth(() => ({
  appName: 'Nuxt Better Auth Playground',
  plugins: [
    admin(),
    passkey(),
    multiSession(),
    twoFactor({
      otpOptions: {
        async sendOTP({ user, otp }) {
          console.log(`[2FA] Sending OTP ${otp} to ${user.email}`)
          await resend.emails.send({ from, to: user.email, subject: 'Your 2FA Code', text: `Your verification code is: ${otp}` })
        },
      },
    }),
  ],
  emailVerification: {
    async sendVerificationEmail({ user, url }) {
      console.log(`[Email] Sending verification to ${user.email}`)
      await resend.emails.send({ from, to: user.email, subject: 'Verify your email', text: `Click here to verify: ${url}` })
    },
  },
  emailAndPassword: {
    enabled: true,
    async sendResetPassword({ user, url }) {
      console.log(`[Email] Sending password reset to ${user.email}`)
      await resend.emails.send({ from, to: user.email, subject: 'Reset your password', text: `Click here to reset: ${url}` })
    },
  },
}))
