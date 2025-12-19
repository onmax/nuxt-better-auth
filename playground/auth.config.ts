import { passkey } from '@better-auth/passkey'
import { admin, lastLoginMethod, multiSession, twoFactor } from 'better-auth/plugins'
import { Resend } from 'resend'
import { defineServerAuth } from '../src/runtime/config'

const from = 'Nuxt Better Auth <onboarding@resend.dev>'
let _resend: Resend
const getResend = () => _resend || (_resend = new Resend(process.env.RESEND_API_KEY))

export default defineServerAuth(() => ({
  appName: 'Nuxt Better Auth Playground',
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || process.env.NUXT_GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || process.env.NUXT_GITHUB_CLIENT_SECRET || '',
    },
  },
  plugins: [
    admin(),
    passkey(),
    multiSession(),
    lastLoginMethod(),
    twoFactor({
      otpOptions: {
        async sendOTP({ user, otp }) {
          console.log(`[2FA] Sending OTP ${otp} to ${user.email}`)
          await getResend().emails.send({ from, to: user.email, subject: 'Your 2FA Code', text: `Your verification code is: ${otp}` })
        },
      },
    }),
  ],
  emailVerification: {
    async sendVerificationEmail({ user, url }) {
      console.log(`[Email] Sending verification to ${user.email}`)
      await getResend().emails.send({ from, to: user.email, subject: 'Verify your email', text: `Click here to verify: ${url}` })
    },
  },
  emailAndPassword: {
    enabled: true,
    async sendResetPassword({ user, url }) {
      console.log(`[Email] Sending password reset to ${user.email}`)
      await getResend().emails.send({ from, to: user.email, subject: 'Reset your password', text: `Click here to reset: ${url}` })
    },
  },
}))
