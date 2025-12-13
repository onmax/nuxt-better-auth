<script setup lang="ts">
const { user } = useUserSession()
</script>

<template>
  <div>
    <h2>Admin Dashboard</h2>
    <p>Welcome, admin {{ user?.name }}!</p>
    <p>This page is only accessible to admins.</p>
  </div>
</template>
