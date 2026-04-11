'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function useRequireRole(roles: string[]) {
  const router = useRouter()
  useEffect(() => {
    const supabase = createClient()
    async function check() {
      const authResult = await supabase.auth.getUser()
      const user = authResult.data.user
      if (!user) { router.replace('/login'); return }
      const profileResult = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single()
      const rol: string | null = profileResult.data?.rol ?? null
      if (!rol || !roles.includes(rol)) {
        router.replace('/dashboard')
      }
    }
    check()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}