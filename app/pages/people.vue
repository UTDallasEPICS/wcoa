<script setup lang="ts">
  import { h, resolveComponent } from 'vue'
  import type { TableColumn, TableRow } from '@nuxt/ui'
  import * as z from 'zod'
  import { authClient } from '../utils/auth-client'

  const toast = useToast()
  const UButton = resolveComponent('UButton')
  const UBadge = resolveComponent('UBadge')

  const { data: session } = await authClient.useSession(useFetch)

  // --- Data Fetching ---
  const { data: volunteers, refresh: refreshVolunteers } = await useFetch('/api/get/volunteers')
  const { data: clients, refresh: refreshClients } = await useFetch('/api/get/clients')
  const { data: admins, refresh: refreshAdmins } = await useFetch('/api/get/admins')

  // --- State ---
  const activeTab = ref('volunteers')
  const search = ref('')
  const volunteerStatusFilter = ref('All')

  const volunteerStatusOptions = ['All', 'AVAILABLE', 'BUSY', 'INACTIVE']

  // --- Schemas ---
  const volunteerSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    phone: z.string().optional(),
    status: z.string().optional(),
  })

  const clientSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    phone: z.string().optional(),
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    zip: z.string().min(1, 'Zip is required'),
  })

  const adminSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    phone: z.string().optional(),
  })

  // --- Modals State ---
  const isVolunteerModalOpen = ref(false)
  const isClientModalOpen = ref(false)
  const isAdminModalOpen = ref(false)
  const isDeleteModalOpen = ref(false)
  const editingId = ref<string | null>(null)
  const deleteTarget = ref<{ type: 'volunteer' | 'client' | 'admin'; id: string } | null>(null)

  const volunteerState = reactive({
    name: '',
    email: '',
    phone: '',
    status: 'AVAILABLE',
  })

  const clientState = reactive({
    name: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    zip: '',
  })

  const adminState = reactive({
    name: '',
    email: '',
    phone: '',
  })

  // --- Computed ---
  const filteredVolunteers = computed(() => {
    if (!volunteers.value) return []

    let result = volunteers.value

    // Status Filter
    if (volunteerStatusFilter.value !== 'All') {
      result = result.filter((v: any) => v.status === volunteerStatusFilter.value)
    }

    // Search Filter
    if (search.value) {
      const q = search.value.toLowerCase()
      result = result.filter(
        (v: any) => v.user.name.toLowerCase().includes(q) || v.user.email.toLowerCase().includes(q)
      )
    }

    return result
  })

  const filteredClients = computed(() => {
    if (!clients.value) return []
    const q = search.value.toLowerCase()
    return clients.value.filter(
      (c: any) => c.user.name.toLowerCase().includes(q) || c.user.email.toLowerCase().includes(q)
    )
  })

  const filteredAdmins = computed(() => {
    if (!admins.value) return []
    const q = search.value.toLowerCase()
    return admins.value.filter(
      (a: any) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
    )
  })

  const items = [
    {
      label: 'Volunteers',
      slot: 'volunteers',
      value: 'volunteers',
    },
    {
      label: 'Clients',
      slot: 'clients',
      value: 'clients',
    },
    {
      label: 'Admins',
      slot: 'admins',
      value: 'admins',
    },
  ]

  // --- Columns ---
  const volunteerColumns: TableColumn<any>[] = [
    { accessorKey: 'user.name', header: 'Name' },
    { accessorKey: 'user.email', header: 'Email' },
    { accessorKey: 'user.phone', header: 'Phone' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) =>
        h(
          UBadge,
          { color: row.original.status === 'AVAILABLE' ? 'success' : 'neutral', variant: 'subtle' },
          () => row.original.status
        ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const isSelf = row.original.userId === session.value?.user?.id
        const actions = [
          h(UButton, {
            icon: 'i-lucide-edit',
            color: 'neutral',
            variant: 'ghost',
            size: 'xs',
            onClick: () => openEditVolunteer(row.original),
          }),
        ]
        if (!isSelf) {
          actions.push(
            h(UButton, {
              icon: 'i-lucide-trash',
              color: 'error',
              variant: 'ghost',
              size: 'xs',
              onClick: () => confirmDelete('volunteer', row.original.id),
            })
          )
        }
        return h('div', { class: 'flex justify-end gap-2' }, actions)
      },
    },
  ]

  const clientColumns: TableColumn<any>[] = [
    { accessorKey: 'user.name', header: 'Name' },
    { accessorKey: 'user.email', header: 'Email' },
    { accessorKey: 'user.phone', header: 'Phone' },
    {
      id: 'address',
      header: 'Address',
      cell: ({ row }) => {
        const a = row.original.homeAddress
        return a ? `${a.street}, ${a.city}` : 'N/A'
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const isSelf = row.original.userId === session.value?.user?.id
        const actions = [
          h(UButton, {
            icon: 'i-lucide-edit',
            color: 'neutral',
            variant: 'ghost',
            size: 'xs',
            onClick: () => openEditClient(row.original),
          }),
        ]
        if (!isSelf) {
          actions.push(
            h(UButton, {
              icon: 'i-lucide-trash',
              color: 'error',
              variant: 'ghost',
              size: 'xs',
              onClick: () => confirmDelete('client', row.original.id),
            })
          )
        }
        return h('div', { class: 'flex justify-end gap-2' }, actions)
      },
    },
  ]

  const adminColumns: TableColumn<any>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'phone', header: 'Phone' },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        // Prevent deleting self
        const isSelf = row.original.id === session.value?.user?.id
        const actions = [
          h(UButton, {
            icon: 'i-lucide-edit',
            color: 'neutral',
            variant: 'ghost',
            size: 'xs',
            onClick: () => openEditAdmin(row.original),
          }),
        ]
        if (!isSelf) {
          actions.push(
            h(UButton, {
              icon: 'i-lucide-trash',
              color: 'error',
              variant: 'ghost',
              size: 'xs',
              onClick: () => confirmDelete('admin', row.original.id),
            })
          )
        }
        return h('div', { class: 'flex justify-end gap-2' }, actions)
      },
    },
  ]

  // --- Actions ---

  // Volunteer
  function openCreateVolunteer() {
    editingId.value = null
    Object.assign(volunteerState, { name: '', email: '', phone: '', status: 'AVAILABLE' })
    isVolunteerModalOpen.value = true
  }

  function openEditVolunteer(volunteer: any) {
    editingId.value = volunteer.id
    Object.assign(volunteerState, {
      name: volunteer.user.name,
      email: volunteer.user.email,
      phone: volunteer.user.phone || '',
      status: volunteer.status,
    })
    isVolunteerModalOpen.value = true
  }

  async function handleVolunteerSubmit() {
    try {
      if (editingId.value) {
        await $fetch(`/api/put/volunteers/${editingId.value}`, {
          method: 'PUT',
          body: volunteerState,
        })
        toast.add({ title: 'Success', description: 'Volunteer updated', color: 'success' })
      } else {
        await $fetch('/api/post/volunteers', { method: 'POST', body: volunteerState })
        toast.add({ title: 'Success', description: 'Volunteer created', color: 'success' })
      }
      isVolunteerModalOpen.value = false
      refreshVolunteers()
    } catch (err: any) {
      toast.add({
        title: 'Error',
        description: err.statusMessage || 'Action failed',
        color: 'error',
      })
    }
  }

  // Client
  function openCreateClient() {
    editingId.value = null
    Object.assign(clientState, {
      name: '',
      email: '',
      phone: '',
      street: '',
      city: '',
      state: '',
      zip: '',
    })
    isClientModalOpen.value = true
  }

  function openEditClient(client: any) {
    editingId.value = client.id
    const addr = client.homeAddress || {}
    Object.assign(clientState, {
      name: client.user.name,
      email: client.user.email,
      phone: client.user.phone || '',
      street: addr.street || '',
      city: addr.city || '',
      state: addr.state || '',
      zip: addr.zip || '',
    })
    isClientModalOpen.value = true
  }

  async function handleClientSubmit() {
    try {
      if (editingId.value) {
        await $fetch(`/api/put/clients/${editingId.value}`, { method: 'PUT', body: clientState })
        toast.add({ title: 'Success', description: 'Client updated', color: 'success' })
      } else {
        await $fetch('/api/post/clients', { method: 'POST', body: clientState })
        toast.add({ title: 'Success', description: 'Client created', color: 'success' })
      }
      isClientModalOpen.value = false
      refreshClients()
    } catch (err: any) {
      toast.add({
        title: 'Error',
        description: err.statusMessage || 'Action failed',
        color: 'error',
      })
    }
  }

  // Admin
  function openCreateAdmin() {
    editingId.value = null
    Object.assign(adminState, { name: '', email: '', phone: '' })
    isAdminModalOpen.value = true
  }

  function openEditAdmin(admin: any) {
    editingId.value = admin.id
    Object.assign(adminState, {
      name: admin.name,
      email: admin.email,
      phone: admin.phone || '',
    })
    isAdminModalOpen.value = true
  }

  async function handleAdminSubmit() {
    try {
      if (editingId.value) {
        await $fetch(`/api/put/admins/${editingId.value}`, { method: 'PUT', body: adminState })
        toast.add({ title: 'Success', description: 'Admin updated', color: 'success' })
      } else {
        await $fetch('/api/post/admins', { method: 'POST', body: adminState })
        toast.add({ title: 'Success', description: 'Admin created', color: 'success' })
      }
      isAdminModalOpen.value = false
      refreshAdmins()
    } catch (err: any) {
      toast.add({
        title: 'Error',
        description: err.statusMessage || 'Action failed',
        color: 'error',
      })
    }
  }

  // Delete
  function confirmDelete(type: 'volunteer' | 'client' | 'admin', id: string) {
    deleteTarget.value = { type, id }
    isDeleteModalOpen.value = true
  }

  async function handleDelete() {
    if (!deleteTarget.value) return
    try {
      const { type, id } = deleteTarget.value
      await $fetch(`/api/delete/${type}s/${id}`, { method: 'DELETE' })
      toast.add({
        title: 'Success',
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} deleted`,
        color: 'success',
      })
      if (type === 'volunteer') refreshVolunteers()
      else if (type === 'client') refreshClients()
      else refreshAdmins()
    } catch (err: any) {
      toast.add({ title: 'Error', description: 'Delete failed', color: 'error' })
    }
    isDeleteModalOpen.value = false
  }

  function getButtonLabel() {
    if (activeTab.value === 'volunteers') return 'Add Volunteer'
    if (activeTab.value === 'clients') return 'Add Client'
    if (activeTab.value === 'admins') return 'Add Admin'
    return 'Add'
  }

  function handleAddClick() {
    if (activeTab.value === 'volunteers') openCreateVolunteer()
    else if (activeTab.value === 'clients') openCreateClient()
    else if (activeTab.value === 'admins') openCreateAdmin()
  }
</script>

<template>
  <UContainer class="py-10">
    <div class="mb-6 flex items-center justify-end">
      <UButton
        :label="getButtonLabel()"
        icon="i-lucide-plus"
        color="primary"
        @click="handleAddClick()"
      />
    </div>

    <div class="mb-6 flex gap-4">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search people..."
        class="flex-1"
      />
      <USelect
        v-if="activeTab === 'volunteers'"
        v-model="volunteerStatusFilter"
        :items="volunteerStatusOptions"
        placeholder="Status"
        class="w-40"
      />
    </div>

    <UTabs v-model="activeTab" :items="items" class="w-full">
      <template #volunteers>
        <UTable :data="filteredVolunteers" :columns="volunteerColumns" class="mt-4" />
      </template>
      <template #clients>
        <UTable :data="filteredClients" :columns="clientColumns" class="mt-4" />
      </template>
      <template #admins>
        <UTable :data="filteredAdmins" :columns="adminColumns" class="mt-4" />
      </template>
    </UTabs>

    <!-- Volunteer Modal -->
    <UModal
      v-model:open="isVolunteerModalOpen"
      :title="editingId ? 'Edit Volunteer' : 'Add Volunteer'"
    >
      <template #content>
        <UForm
          :schema="volunteerSchema"
          :state="volunteerState"
          class="space-y-4 p-4"
          @submit="handleVolunteerSubmit"
        >
          <UFormField label="Name" name="name"
            ><UInput v-model="volunteerState.name" class="w-full"
          /></UFormField>
          <UFormField label="Email" name="email"
            ><UInput v-model="volunteerState.email" class="w-full"
          /></UFormField>
          <UFormField label="Phone" name="phone"
            ><UInput v-model="volunteerState.phone" class="w-full"
          /></UFormField>
          <UFormField label="Status" name="status">
            <USelect
              v-model="volunteerState.status"
              :items="['AVAILABLE', 'BUSY', 'INACTIVE']"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end gap-2 pt-4">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              @click="isVolunteerModalOpen = false"
            />
            <UButton type="submit" label="Save" color="primary" />
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Client Modal -->
    <UModal v-model:open="isClientModalOpen" :title="editingId ? 'Edit Client' : 'Add Client'">
      <template #content>
        <UForm
          :schema="clientSchema"
          :state="clientState"
          class="space-y-4 p-4"
          @submit="handleClientSubmit"
        >
          <UFormField label="Name" name="name"
            ><UInput v-model="clientState.name" class="w-full"
          /></UFormField>
          <UFormField label="Email" name="email"
            ><UInput v-model="clientState.email" class="w-full"
          /></UFormField>
          <UFormField label="Phone" name="phone"
            ><UInput v-model="clientState.phone" class="w-full"
          /></UFormField>
          <UFormField label="Street" name="street"
            ><UInput v-model="clientState.street" class="w-full"
          /></UFormField>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="City" name="city"
              ><UInput v-model="clientState.city" class="w-full"
            /></UFormField>
            <UFormField label="State" name="state"
              ><UInput v-model="clientState.state" class="w-full"
            /></UFormField>
          </div>
          <UFormField label="Zip" name="zip"
            ><UInput v-model="clientState.zip" class="w-full"
          /></UFormField>
          <div class="flex justify-end gap-2 pt-4">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              @click="isClientModalOpen = false"
            />
            <UButton type="submit" label="Save" color="primary" />
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Admin Modal -->
    <UModal v-model:open="isAdminModalOpen" :title="editingId ? 'Edit Admin' : 'Add Admin'">
      <template #content>
        <UForm
          :schema="adminSchema"
          :state="adminState"
          class="space-y-4 p-4"
          @submit="handleAdminSubmit"
        >
          <UFormField label="Name" name="name"
            ><UInput v-model="adminState.name" class="w-full"
          /></UFormField>
          <UFormField label="Email" name="email"
            ><UInput v-model="adminState.email" class="w-full"
          /></UFormField>
          <UFormField label="Phone" name="phone"
            ><UInput v-model="adminState.phone" class="w-full"
          /></UFormField>
          <div class="flex justify-end gap-2 pt-4">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              @click="isAdminModalOpen = false"
            />
            <UButton type="submit" label="Save" color="primary" />
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Delete Modal -->
    <UModal v-model:open="isDeleteModalOpen" title="Confirm Delete">
      <template #content>
        <div class="space-y-4 p-4">
          <p>Are you sure? This will remove the profile.</p>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              @click="isDeleteModalOpen = false"
            />
            <UButton label="Delete" color="error" @click="handleDelete" />
          </div>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>

