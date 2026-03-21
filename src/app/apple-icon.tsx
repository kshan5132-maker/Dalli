import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 120,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
          color: 'white',
          borderRadius: '36px',
          fontWeight: 800,
          fontFamily: 'sans-serif',
          letterSpacing: '-0.05em',
        }}
      >
        D
      </div>
    ),
    { ...size }
  )
}
