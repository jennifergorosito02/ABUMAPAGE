import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Si ya está logueado y va al login → redirigir al dashboard
  if (pathname.startsWith('/login')) {
    if (user) return NextResponse.redirect(new URL('/inventario', request.url))
    return response
  }

  // Tienda pública — no requiere autenticación
  if (pathname.startsWith('/tienda')) return response

  // APIs públicas
  if (pathname.startsWith('/api/checkout')) return response
  if (pathname.startsWith('/api/mp-webhook')) return response
  if (pathname.startsWith('/api/process-payment')) return response

  // Raíz → redirigir
  if (pathname === '/') {
    if (user) return NextResponse.redirect(new URL('/inventario', request.url))
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Todo lo demás (dashboard) requiere autenticación
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$|.*\\.mp4$|.*\\.webm$|.*\\.mov$|.*\\.ico$).*)'],
}