import type { ReactNode } from 'react'

export const metadata = { title: 'Cuestack — Wave 0 resolution probe' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
