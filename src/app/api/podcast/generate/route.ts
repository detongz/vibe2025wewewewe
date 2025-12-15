import { NextRequest, NextResponse } from 'next/server'

// 模拟的GPT-4 API调用（实际项目中需要集成真实的GPT）
async function generateScript(transcripts: string[]) {
  // 这里应该调用GPT-4 API生成播客脚本
  // 现在使用硬编码的示例
  const script = {
    title: "那个停下的瞬间",
    narration: [
      {
        text: "每个人都有一个不得不面对自己的时刻。",
        timestamp: 0
      },
      {
        text: "有时候，停下来不是放弃，而是为了更好地认识自己。",
        timestamp: 8
      },
      {
        text: "这就是今天的故事，一个关于停下的故事。",
        timestamp: 16
      }
    ],
    user_clips: [
      {
        index: 0,
        transcript: transcripts[0] || "那天晚上我站在公司楼下，一直没进去。",
        start_time: 4
      },
      {
        index: 1,
        transcript: transcripts[1] || "在街对面，雨下得挺大的，我躲在屋檐下面。",
        start_time: 12
      },
      {
        index: 2,
        transcript: transcripts[2] || "就是一个终于停下来的人吧。",
        start_time: 20
      }
    ]
  }

  return script
}

// 调用Minimax TTS生成旁白音频
async function generateNarrationAudio(text: string, emotion: string = 'calm') {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: text,
      voice: 'male-qn-jingying', // 使用精英男声作为旁白
      emotion: emotion,
      speed: 0.95 // 稍微慢一点，营造播客氛围
    })
  })

  if (!response.ok) {
    throw new Error('Failed to generate narration audio')
  }

  return response.json()
}

// 简单的音频拼接（返回音频数组，前端可以按顺序播放）
async function combineAudioClips(narrationAudios: any[], userAudioUrls: string[]) {
  // 实际项目中，这里需要使用ffmpeg进行音频拼接
  // 现在返回播放顺序
  const timeline = []

  // 添加开始音乐（可选）
  timeline.push({
    type: 'intro_music',
    url: '/api/audio/intro-music',
    duration: 3
  })

  // 交替添加旁白和用户录音
  let currentTime = 3
  for (let i = 0; i < narrationAudios.length; i++) {
    // 添加旁白
    timeline.push({
      type: 'narration',
      audio_base64: narrationAudios[i].audio_base64,
      start_time: currentTime,
      duration: 4 // 假设每段旁白4秒
    })
    currentTime += 4

    // 添加用户录音
    if (i < userAudioUrls.length) {
      timeline.push({
        type: 'user_clip',
        url: userAudioUrls[i],
        start_time: currentTime,
        duration: 4 // 假设每段用户录音4秒
      })
      currentTime += 4
    }
  }

  // 添加结束音乐
  timeline.push({
    type: 'outro_music',
    url: '/api/audio/outro-music',
    duration: 3
  })

  return timeline
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transcripts, audioUrls } = body

    if (!transcripts || !Array.isArray(transcripts) || transcripts.length === 0) {
      return NextResponse.json({ error: 'Transcripts are required' }, { status: 400 })
    }

    // 1. 生成播客脚本
    console.log('Generating podcast script...')
    const script = await generateScript(transcripts)

    // 2. 生成所有旁白的音频
    console.log('Generating narration audio...')
    const narrationAudios = []
    for (const narration of script.narration) {
      const audio = await generateNarrationAudio(narration.text, 'calm')
      narrationAudios.push({
        ...audio,
        timestamp: narration.timestamp
      })
    }

    // 3. 组合音频片段
    console.log('Combining audio clips...')
    const timeline = await combineAudioClips(narrationAudios, audioUrls)

    // 4. 生成完整的播客文案
    const fullScript = script.narration.reduce((acc, nar, index) => {
      acc += `【旁白】\n${nar.text}\n\n`
      if (index < script.user_clips.length) {
        acc += `【用户原声】\n"${script.user_clips[index].transcript}"\n\n`
      }
      return acc
    }, '')

    // 5. 返回播客数据
    return NextResponse.json({
      podcast: {
        title: script.title,
        script: fullScript,
        timeline: timeline,
        duration: timeline[timeline.length - 1].start_time + timeline[timeline.length - 1].duration,
        narration_count: narrationAudios.length,
        user_clip_count: script.user_clips.length
      }
    })

  } catch (error) {
    console.error('Generate podcast error:', error)
    return NextResponse.json(
      { error: 'Failed to generate podcast' },
      { status: 500 }
    )
  }
}