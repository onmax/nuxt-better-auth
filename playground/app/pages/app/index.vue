<script setup lang="ts">
const { user } = useUserSession()
</script>

<template>
  <div>
    <h2>Protected App Page</h2>
    <p>Welcome to the protected area, {{ user?.name }}!</p>
    <p>This page requires authentication.</p>
  </div>
</template>
