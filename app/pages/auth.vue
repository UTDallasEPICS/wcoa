<script setup lang="ts">
  import * as z from 'zod'
  import type { FormSubmitEvent } from '@nuxt/ui'
  import { authClient } from '../utils/auth-client'

  const toast = useToast()
  const isEmailSent = ref(false)
  const loading = ref(false)

  const schema = computed(() => {
    if (!isEmailSent.value) {
      return z.object({
        email: z.string().email('Invalid email'),
      })
    } else {
      return z.object({
        email: z.string().email('Invalid email'),
        otp: z.array(z.coerce.string()).length(6, 'Must be 6 digits'),
      })
    }
  })

  type Schema = z.output<typeof schema.value>

  const state = reactive({
    email: '',
    otp: [] as any[],
  })

  async function handleSubmit(event: FormSubmitEvent<any>) {
    loading.value = true
    try {
      if (!isEmailSent.value) {
        const { data, error } = await authClient.emailOtp.sendVerificationOtp({
          email: state.email,
          type: 'sign-in',
        })

        if (error) {
          toast.add({ title: 'Error', description: error.message, color: 'error' })
        } else {
          isEmailSent.value = true
          toast.add({ title: 'Success', description: 'OTP sent to your email', color: 'success' })
        }
      } else {
        const { data, error } = await authClient.signIn.emailOtp({
          email: state.email,
          otp: state.otp.join(''),
        })

        if (error) {
          toast.add({ title: 'Error', description: error.message, color: 'error' })
        } else {
          const role = data.user.role
          // Use window.location for hard reload to clear any stale state if needed, or navigateTo
          if (role === 'VOLUNTEER') {
            await navigateTo('/rides', { external: true })
          } else {
            await navigateTo('/', { external: true })
          }
        }
      }
    } catch (e) {
      console.error(e)
      toast.add({ title: 'Error', description: 'An unexpected error occurred', color: 'error' })
    } finally {
      loading.value = false
    }
  }

  function handleError(event: any) {
    console.error('Validation error:', event)
  }
</script>

<template>
  <div class="flex h-screen w-screen items-center justify-center">
    <UCard class="h-full w-full md:h-auto md:w-1/2">
      <template #header>
        <div class="flex items-center justify-center text-xl font-bold">Login</div>
      </template>

      <UForm
        :schema="schema"
        :state="state"
        @submit="handleSubmit"
        @error="handleError"
        class="space-y-5"
      >
        <UFormField name="email" v-if="!isEmailSent">
          <UInput v-model="state.email" class="w-full" placeholder="Email" type="email" />
        </UFormField>

        <UFormField name="otp" v-if="isEmailSent">
          <div class="flex w-full justify-center">
            <UPinInput otp v-model="state.otp" :length="6" size="xl" type="number" />
          </div>
        </UFormField>

        <div class="flex gap-2">
          <UButton
            v-if="isEmailSent"
            color="neutral"
            variant="ghost"
            class="flex-1 justify-center"
            @click="isEmailSent = false"
          >
            Back
          </UButton>
          <UButton :loading="loading" type="submit" class="flex-1 justify-center">
            {{ isEmailSent ? 'Login' : 'Send OTP' }}
          </UButton>
        </div>
      </UForm>
    </UCard>
  </div>
</template>
