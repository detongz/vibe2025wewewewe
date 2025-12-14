import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = 'http://124.220.31.71:5000/api'

export async function POST() {
  try {
    const response = await fetch(`${API_BASE_URL}/session/new`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error('Failed to create session')
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}