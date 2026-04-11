'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function useRequireRole(roles: string[]) {
  const router = useRouter()
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      const { data } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single()
      if (!data || !roles.includes(data.rol)) {
        router.replace('/dashboard')
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}