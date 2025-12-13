<script setup lang="ts">
const { signIn, signUp } = useUserSession()

const email = ref('')
const password = ref('')
const name = ref('')
const isSignUp = ref(false)
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true

  try {
    if (isSignUp.value) {
      await signUp.email({ email: email.value, password: password.value, name: name.value })
    }
    else {
      await signIn.email({ email: email.value, password: password.value })
    }
    await navigateTo('/app')
  }
  catch (e: any) {
    error.value = e.message || 'Authentication failed'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <h2>{{ isSignUp ? 'Sign Up' : 'Sign In' }}</h2>

    <form @submit.prevent="handleSubmit">
      <div v-if="isSignUp" class="field">
        <label for="name">Name</label>
        <input id="name" v-model="name" type="text" required>
      </div>

      <div class="field">
        <label for="email">Email</label>
        <input id="email" v-model="email" type="email" required>
      </div>

      <div class="field">
        <label for="password">Password</label>
        <input id="password" v-model="password" type="password" required minlength="8">
      </div>

      <p v-if="error" class="error">
        {{ error }}
      </p>

      <button type="submit" :disabled="loading">
        {{ loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In') }}
      </button>
    </form>

    <p class="toggle">
      {{ isSignUp ? 'Already have an account?' : 'Need an account?' }}
      <button type="button" class="link" @click="isSignUp = !isSignUp">
        {{ isSignUp ? 'Sign In' : 'Sign Up' }}
      </button>
    </p>
  </div>
</template>

<style scoped>
.auth-page {
  max-width: 400px;
}
.field {
  margin-bottom: 1rem;
}
.field label {
  display: block;
  margin-bottom: 0.25rem;
  font-weight: 500;
}
.field input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.error {
  color: red;
  margin-bottom: 1rem;
}
.toggle {
  margin-top: 1rem;
}
.link {
  background: none;
  border: none;
  color: blue;
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
}
</style>
