import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'LINK_DEPRECATED',
        message: 'This link has been deprecated. Please use the /u/:publicId/c/:token link.'
      }
    },
    { status: 410 }
  )
}

export async function POST() {
  return GET()
}




