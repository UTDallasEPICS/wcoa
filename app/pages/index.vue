<script setup lang="ts">
  import { authClient } from '../utils/auth-client'
  const { data: users, pending, error } = await useFetch('/api/get/users')
</script>

<template>
  <UContainer class="py-20">
    <div class="flex flex-col items-center justify-center space-y-4">
      <p class="text-xl text-gray-500">Dashboard Coming Soon</p>
    </div>
  </UContainer>
</template>
