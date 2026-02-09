<script setup lang="ts">
import { authClient } from '../../utils/auth-client'

const { data: session } = await authClient.useSession(useFetch)
if (session.value?.user?.role !== 'ADMIN') {
  navigateTo('/')
}

const { data: templates, refresh } = await useFetch('/api/get/notifications/templates')

const selectedTemplate = ref<any>(null)
const isEditing = ref(false)
const isPreviewing = ref(false)
const toast = useToast()

const editorRef = ref()
const variables = [
  { label: 'Name', value: '{{name}}' },
  { label: 'Client', value: '{{client}}' },
  { label: 'Pickup', value: '{{pickup}}' },
  { label: 'Dropoff', value: '{{dropoff}}' },
  { label: 'Date', value: '{{date}}' },
  { label: 'Time', value: '{{time}}' },
]

function insertVariable(variable: string) {
  if (editorRef.value?.editor) {
    editorRef.value.editor.chain().focus().insertContent(variable).run()
  }
}

function insertLink() {
  if (editorRef.value?.editor) {
    const previousUrl = editorRef.value.editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)

    if (url === null) {
      return
    }

    if (url === '') {
      editorRef.value.editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editorRef.value.editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }
}

function edit(template: any) {
  selectedTemplate.value = { ...template }
  isEditing.value = true
}

const previewContent = computed(() => {
  if (!selectedTemplate.value) return { subject: '', body: '' }
  
  let subject = selectedTemplate.value.subject
  let body = selectedTemplate.value.body
  
  const dummyData: Record<string, string> = {
    name: 'John Doe',
    client: 'Jane Smith',
    pickup: '123 Main St, Springfield',
    dropoff: '456 Oak Ave, Springfield',
    date: 'Monday, Jan 1',
    time: '10:00 AM',
  }

  for (const [key, value] of Object.entries(dummyData)) {
    const regex = new RegExp(`{{${key}}}`, 'g')
    subject = subject.replace(regex, value)
    body = body.replace(regex, value)
  }
  
  return { subject, body }
})

async function save() {
  if (!selectedTemplate.value) return
  
  try {
    await $fetch(`/api/put/notifications/templates/${selectedTemplate.value.name}`, {
      method: 'PUT',
      body: {
        subject: selectedTemplate.value.subject,
        body: selectedTemplate.value.body,
        enabled: selectedTemplate.value.enabled
      }
    })
    isEditing.value = false
    refresh()
    toast.add({ title: 'Saved', description: 'Template updated successfully', color: 'success' })
  } catch (e) {
    toast.add({ title: 'Error', description: 'Failed to save template', color: 'error' })
  }
}

async function toggle(template: any) {
  try {
    await $fetch(`/api/put/notifications/templates/${template.name}`, {
      method: 'PUT',
      body: { enabled: !template.enabled }
    })
    refresh()
    toast.add({ 
      title: !template.enabled ? 'Enabled' : 'Disabled', 
      description: `Notification ${!template.enabled ? 'enabled' : 'disabled'} globally`,
      color: 'success' 
    })
  } catch (e) {
    toast.add({ title: 'Error', description: 'Failed to update status', color: 'error' })
  }
}
</script>

<template>
  <UContainer class="py-10">
    <div class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <UCard v-for="t in templates" :key="t.name" class="flex flex-col h-full">
        <div class="flex flex-col h-full justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center justify-between gap-2 mb-2">
              <h3 class="font-bold text-lg truncate" :title="t.name">{{ t.name }}</h3>
              <UBadge :color="t.enabled ? 'success' : 'neutral'" variant="subtle">
                {{ t.enabled ? 'On' : 'Off' }}
              </UBadge>
            </div>
            <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 line-clamp-1" :title="t.subject">{{ t.subject }}</p>
            <div class="text-xs text-gray-500 line-clamp-3 prose dark:prose-invert max-w-none" v-html="t.body"></div>
          </div>
          <div class="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <UButton 
              size="xs" 
              variant="ghost" 
              icon="i-lucide-edit" 
              class="flex-1 justify-center"
              @click="edit(t)"
            >
              Edit
            </UButton>
            <UButton 
              size="xs" 
              variant="ghost" 
              :color="t.enabled ? 'error' : 'success'" 
              :icon="t.enabled ? 'i-lucide-ban' : 'i-lucide-check-circle'" 
              class="flex-1 justify-center"
              @click="toggle(t)"
            >
              {{ t.enabled ? 'Disable' : 'Enable' }}
            </UButton>
          </div>
        </div>
      </UCard>
    </div>

    <UModal v-model:open="isEditing" fullscreen>
      <template #content>
        <UCard class="flex flex-col h-full">
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="font-bold text-lg">Edit {{ selectedTemplate?.name }}</h2>
              <div class="flex items-center gap-2">
                <UButton 
                  :label="isPreviewing ? 'Edit' : 'Preview'" 
                  :icon="isPreviewing ? 'i-lucide-pencil' : 'i-lucide-eye'"
                  variant="soft"
                  @click="isPreviewing = !isPreviewing"
                />
                <UButton icon="i-lucide-x" color="neutral" variant="ghost" @click="isEditing = false" />
              </div>
            </div>
          </template>
          
          <div class="space-y-6 flex-1 overflow-y-auto p-4" v-if="selectedTemplate">
            <div v-if="isPreviewing" class="max-w-2xl mx-auto border rounded-lg p-8 shadow-sm bg-white dark:bg-gray-900">
              <div class="border-b pb-4 mb-6">
                <p class="text-sm text-gray-500 mb-1">Subject:</p>
                <h3 class="text-xl font-bold">{{ previewContent.subject }}</h3>
              </div>
              <div>
                <p class="text-sm text-gray-500 mb-2">Body:</p>
                <div class="prose dark:prose-invert max-w-none" v-html="previewContent.body"></div>
              </div>
            </div>

            <div v-else class="space-y-6">
              <UFormField label="Subject" class="w-full">
                <UInput v-model="selectedTemplate.subject" class="w-full" />
              </UFormField>
              
              <UFormField label="Body">
                <div class="space-y-2">
                  <div class="flex flex-col gap-2 pb-2 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
                    <!-- Toolbar -->
                    <div class="flex flex-wrap items-center gap-1">
                      <UTooltip text="Bold">
                        <UButton icon="i-lucide-bold" size="xs" color="neutral" variant="ghost" @click="editorRef?.editor?.chain().focus().toggleBold().run()" :class="{ 'bg-gray-100 dark:bg-gray-800': editorRef?.editor?.isActive('bold') }" />
                      </UTooltip>
                      <UTooltip text="Italic">
                        <UButton icon="i-lucide-italic" size="xs" color="neutral" variant="ghost" @click="editorRef?.editor?.chain().focus().toggleItalic().run()" :class="{ 'bg-gray-100 dark:bg-gray-800': editorRef?.editor?.isActive('italic') }" />
                      </UTooltip>
                      <UTooltip text="Strike">
                        <UButton icon="i-lucide-strikethrough" size="xs" color="neutral" variant="ghost" @click="editorRef?.editor?.chain().focus().toggleStrike().run()" :class="{ 'bg-gray-100 dark:bg-gray-800': editorRef?.editor?.isActive('strike') }" />
                      </UTooltip>
                      <div class="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                      <UTooltip text="Heading 1">
                        <UButton icon="i-lucide-heading-1" size="xs" color="neutral" variant="ghost" @click="editorRef?.editor?.chain().focus().toggleHeading({ level: 1 }).run()" :class="{ 'bg-gray-100 dark:bg-gray-800': editorRef?.editor?.isActive('heading', { level: 1 }) }" />
                      </UTooltip>
                      <UTooltip text="Heading 2">
                        <UButton icon="i-lucide-heading-2" size="xs" color="neutral" variant="ghost" @click="editorRef?.editor?.chain().focus().toggleHeading({ level: 2 }).run()" :class="{ 'bg-gray-100 dark:bg-gray-800': editorRef?.editor?.isActive('heading', { level: 2 }) }" />
                      </UTooltip>
                      <div class="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                      <UTooltip text="Bullet List">
                        <UButton icon="i-lucide-list" size="xs" color="neutral" variant="ghost" @click="editorRef?.editor?.chain().focus().toggleBulletList().run()" :class="{ 'bg-gray-100 dark:bg-gray-800': editorRef?.editor?.isActive('bulletList') }" />
                      </UTooltip>
                      <UTooltip text="Ordered List">
                        <UButton icon="i-lucide-list-ordered" size="xs" color="neutral" variant="ghost" @click="editorRef?.editor?.chain().focus().toggleOrderedList().run()" :class="{ 'bg-gray-100 dark:bg-gray-800': editorRef?.editor?.isActive('orderedList') }" />
                      </UTooltip>
                      <div class="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                      <UTooltip text="Link">
                        <UButton icon="i-lucide-link" size="xs" color="neutral" variant="ghost" @click="insertLink" :class="{ 'bg-gray-100 dark:bg-gray-800': editorRef?.editor?.isActive('link') }" />
                      </UTooltip>
                      <UTooltip text="Undo">
                        <UButton icon="i-lucide-undo" size="xs" color="neutral" variant="ghost" @click="editorRef?.editor?.chain().focus().undo().run()" />
                      </UTooltip>
                      <UTooltip text="Redo">
                        <UButton icon="i-lucide-redo" size="xs" color="neutral" variant="ghost" @click="editorRef?.editor?.chain().focus().redo().run()" />
                      </UTooltip>
                    </div>

                    <div class="flex flex-wrap gap-2 items-center">
                      <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Insert Variable:</span>
                      <UBadge
                        v-for="v in variables"
                        :key="v.value"
                        variant="subtle"
                        class="cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-900 transition-colors"
                        @click="insertVariable(v.value)"
                      >
                        {{ v.label }}
                      </UBadge>
                    </div>
                  </div>
                  
                  <div class="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                    <UEditor 
                      ref="editorRef" 
                      v-model="selectedTemplate.body" 
                      :starter-kit="{
                        heading: { levels: [1, 2, 3] },
                        link: false
                      }"
                      :placeholder="undefined"
                      class="min-h-[400px] [&_p]:my-2"
                    />
                  </div>
                </div>
              </UFormField>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton variant="ghost" @click="isEditing = false">Cancel</UButton>
              <UButton @click="save" :disabled="isPreviewing">Save Changes</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </UContainer>
</template>
