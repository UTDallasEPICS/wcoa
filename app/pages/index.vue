<script setup lang="ts">
  import { authClient } from '../utils/auth-client'
  const { data: users, pending, error } = await useFetch('/api/get/users')
  async function logout() {
    await authClient.signOut()
    await navigateTo('/auth')
  }
</script>

<template>
  <UButton @click="logout">Logout</UButton>
  <div v-if="pending">Loading users...</div>
  <div v-else-if="error">{{ error.message }}</div>
  <div v-else>
    <h1>Users in the database:</h1>
    <pre>{{ JSON.stringify(users, null, 2) }}</pre>
  </div>
</template>
