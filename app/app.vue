<script setup lang="ts">
const users = await useFetch("/api/get/users")
</script>

<template>
	<div>
		Hello, {{ users.data }}
	</div>
</template>
