import { NextRequest, NextResponse } from 'next/server'

// Minimax TTS API 配置
const MINIMAX_API_URL = 'https://api.minimax.chat/v1/tts'
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || ''

interface TTSRequest {
  model: string
  text: string
  voice_type?: string
  audio_setting?: {
    sample_rate: number
    bitrate: number
    format: string
  }
  speed?: number
  vol?: number
  pitch?: number
  emotion?: string
}

interface TTSResponse {
  request_id: string
  base_resp: {
    status_code: number
    status_msg: string
  }
  data: {
    audio_base64: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, voice = 'male-qn-qingse', emotion = 'happy', speed = 1.0 } = body

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    if (!MINIMAX_API_KEY) {
      return NextResponse.json({ error: 'Minimax API key not configured' }, { status: 500 })
    }

    const ttsRequest: TTSRequest = {
      model: 'speech-01',
      text: text,
      voice_type: voice,
      emotion: emotion,
      speed: speed,
      audio_setting: {
        sample_rate: 22050,
        bitrate: 64000,
        format: 'mp3'
      }
    }

    const response = await fetch(MINIMAX_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(ttsRequest)
    })

    if (!response.ok) {
      throw new Error(`Minimax API error: ${response.statusText}`)
    }

    const data: TTSResponse = await response.json()

    if (data.base_resp.status_code !== 0) {
      throw new Error(`Minimax API error: ${data.base_resp.status_msg}`)
    }

    // 返回base64音频数据
    return NextResponse.json({
      audio_base64: data.data.audio_base64,
      request_id: data.request_id
    })

  } catch (error) {
    console.error('TTS API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    )
  }
}

// 支持的音色列表
export async function GET() {
  const voices = [
    { id: 'male-qn-qingse', name: '青涩男声', description: '年轻男性声音，清新自然' },
    { id: 'male-qn-jingying', name: '精英男声', description: '成熟男性声音，沉稳有力' },
    { id: 'male-qn-badao', name: '霸道男声', description: '男性声音，充满魅力' },
    { id: 'male-qn-daxuesheng', name: '大学生男声', description: '年轻男性声音，阳光开朗' },
    { id: 'female-qn-jingying', name: '精英女声', description: '成熟女性声音，专业干练' },
    { id: 'female-qn-mane', name: '暖心女声', description: '温柔女性声音，亲切温暖' },
    { id: 'female-qn-daxuesheng', name: '大学生女声', description: '年轻女性声音，活泼可爱' }
  ]

  return NextResponse.json({ voices })
}