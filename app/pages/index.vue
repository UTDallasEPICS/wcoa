<script setup lang="ts">
  import { authClient } from '../utils/auth-client'
  const { data: users, pending, error } = await useFetch('/api/get/users')
</script>

<template>
  <div v-if="pending">Loading users...</div>
  <div v-else-if="error">{{ error.message }}</div>
  <div v-else class="overflow-auto">
    <h1>Users in the database:</h1>
    <pre>{{ JSON.stringify(users, null, 2) }}</pre>
  </div>
</template>
