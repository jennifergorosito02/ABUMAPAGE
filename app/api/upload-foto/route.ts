import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function verificarAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single()
  return profile?.rol === 'admin' ? user : null
}

export async function GET(request: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const path = request.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Falta path' }, { status: 400 })

  const supabase = adminClient()
  const { data, error } = await supabase.storage.from('productos').createSignedUploadUrl(path)
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Error' }, { status: 500 })
  return NextResponse.json({ token: data.token, path: data.path })
}

export async function POST(request: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const storagePath = formData.get('path') as string | null

    if (!file || !storagePath) {
      return NextResponse.json({ error: 'Faltan parámetros: file y path son requeridos' }, { status: 400 })
    }

    const supabase = adminClient()
    const bytes = await file.arrayBuffer()

    const { error: upErr } = await supabase.storage
      .from('productos')
      .upload(storagePath, Buffer.from(bytes), {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      })

    if (upErr) {
      console.error('Storage upload error:', upErr)
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from('productos').getPublicUrl(storagePath)
    return NextResponse.json({ url: publicUrl })
  } catch (error: any) {
    console.error('Upload API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const { path } = await request.json()
    if (!path) return NextResponse.json({ error: 'Falta path' }, { status: 400 })

    const supabase = adminClient()
    const { error } = await supabase.storage.from('productos').remove([path])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}