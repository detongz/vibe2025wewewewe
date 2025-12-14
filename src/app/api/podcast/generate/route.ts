import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = 'http://124.220.31.71:5000/api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_id } = body

    if (!session_id) {
      return NextResponse.json(
        { error: 'Missing session_id' },
        { status: 400 }
      )
    }

    const response = await fetch(`${API_BASE_URL}/podcast/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session_id }),
    })

    if (!response.ok) {
      throw new Error('Failed to generate podcast')
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error generating podcast:', error)
    return NextResponse.json(
      { error: 'Failed to generate podcast' },
      { status: 500 }
    )
  }
}