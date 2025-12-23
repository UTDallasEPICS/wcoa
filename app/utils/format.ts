export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return ''
  
  const cleaned = phone.replace(/\D/g, '')
  
  if (cleaned.length === 0) return ''
  if (cleaned.length <= 3) return cleaned
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
}

export function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return ''
  return phone.replace(/\D/g, '').slice(0, 10)
}
