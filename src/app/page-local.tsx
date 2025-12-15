'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Play, Pause, Download, Share2, Sparkles, Waves, Headphones } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  audioUrl?: string
  timestamp: Date
}

interface RecordingStep {
  step: number
  title: string
  prompt: string
  isCompleted: boolean
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [podcastUrl, setPodcastUrl] = useState<string | null>(null)
  const [podcastScript, setPodcastScript] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const steps: RecordingStep[] = [
    {
      step: 1,
      title: "回忆瞬间",
      prompt: "我们不需要一个完整故事。就说最近一次，你突然觉得'有点不对劲'的时候。你想到的第一个画面是什么？",
      isCompleted: currentStep > 0
    },
    {
      step: 2,
      title: "重建现场",
      prompt: "你能带我回到那个瞬间吗？当时具体发生了什么？",
      isCompleted: currentStep > 1
    },
    {
      step: 3,
      title: "自我认知",
      prompt: "如果现在回头看那一刻，你会怎么形容当时的自己？",
      isCompleted: currentStep > 2
    }
  ]

  useEffect(() => {
    // 初始化时显示欢迎消息
    setMessages([{
      id: '1',
      role: 'assistant',
      content: '你好，我是你的AI语音播客编导。我们将通过三段对话，把你的故事变成一期精彩的播客。准备好开始了吗？',
      timestamp: new Date()
    }])
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        const audioUrl = URL.createObjectURL(audioBlob)

        // 添加用户消息
        const userMessage: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: '[录音中...]',
          audioUrl,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, userMessage])

        // 模拟转录
        const transcripts = [
          "那天晚上我站在公司楼下，一直没进去。",
          "在街对面，雨下得挺大的，我躲在屋檐下面。",
          "就是一个终于停下来的人吧。"
        ]
        const transcript = transcripts[currentStep] || "..."

        // 更新用户消息的转录文本
        setMessages(prev => prev.map(msg =>
          msg.id === userMessage.id ? { ...msg, content: transcript } : msg
        ))

        // 准备AI响应
        setTimeout(() => {
          handleAIResponse()
        }, 1500)

        // 清理
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error('Error accessing microphone:', err)
      // 添加错误消息给用户
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '录音启动失败，请检查麦克风权限并刷新页面重试',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleAIResponse = () => {
    if (currentStep < 3) {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: steps[currentStep].prompt,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, aiMessage])
      setCurrentStep(prev => prev + 1)
    } else {
      // 完成三步，生成播客
      generatePodcast()
    }
  }

  const generatePodcast = async () => {
    setIsProcessing(true)

    // 显示处理中消息
    const processingMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: '正在为你生成播客，这需要几秒钟...',
      timestamp: new Date()
    }
    setMessages(prev => [...prev, processingMessage])

    // 模拟生成过程
    setTimeout(() => {
      const script = `【旁白】
每个人都有一个不得不面对自己的时刻。

【用户原声】
"那天晚上我站在公司楼下，一直没进去。"

【旁白】
有时候，停下来不是放弃，而是为了更好地认识自己。

【用户原声】
"就是一个终于停下来的人吧。"

【旁白】
这就是今天的故事，一个关于停下的故事。`

      setPodcastScript(script)
      setPodcastUrl('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3')
      setIsProcessing(false)

      // 更新处理中消息为完成消息
      setMessages(prev => prev.map(msg =>
        msg.id === processingMessage.id ? {
          ...msg,
          content: '🎉 你的播客已经准备好了！点击下方播放按钮听听效果。'
        } : msg
      ))
    }, 3000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      {/* 背景装饰 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
      </div>

      {/* 主容器 */}
      <div className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
        {/* 头部 */}
        <header className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Headphones className="w-10 h-10 text-purple-400" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              声记
            </h1>
          </div>
          <p className="text-xl text-gray-300">AI语音播客编导，把你的故事变成声音</p>
        </header>

        {/* 步骤指示器 */}
        <div className="flex justify-center mb-12">
          <div className="flex items-center gap-4 bg-white/5 backdrop-blur-sm rounded-full p-2">
            {steps.map((step, index) => (
              <div key={step.step} className="flex items-center">
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-all",
                    step.isCompleted
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                      : currentStep === index
                      ? "bg-purple-600 text-white"
                      : "bg-gray-700 text-gray-400"
                  )}
                >
                  {step.isCompleted ? '✓' : step.step}
                </div>
                <span className={cn(
                  "ml-2 mr-4 text-sm font-medium",
                  step.isCompleted ? "text-white" : currentStep === index ? "text-purple-300" : "text-gray-500"
                )}>
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 消息列表 */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 mb-8 h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-purple-600 scrollbar-track-transparent">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-md rounded-2xl px-4 py-3",
                    message.role === 'user'
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                      : "bg-gray-800 text-gray-100"
                  )}
                >
                  {message.audioUrl && (
                    <audio controls className="w-full mb-2 h-8" src={message.audioUrl}>
                      您的浏览器不支持音频播放
                    </audio>
                  )}
                  <p className="text-sm">{message.content}</p>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <Waves className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 播客播放器 */}
        {podcastUrl && (
          <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-purple-500/20">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-400" />
              你的播客
            </h3>
            <audio controls className="w-full mb-4" src={podcastUrl}>
              您的浏览器不支持音频播放
            </audio>
            {podcastScript && (
              <div className="bg-black/30 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-semibold text-purple-300 mb-2">播客文案</h4>
                <pre className="text-sm text-gray-300 whitespace-pre-wrap">{podcastScript}</pre>
              </div>
            )}
            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors">
                <Share2 className="w-4 h-4" />
                分享
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                <Download className="w-4 h-4" />
                下载
              </button>
            </div>
          </div>
        )}

        {/* 录音控制 */}
        <div className="flex justify-center">
          {!podcastUrl && (
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              disabled={isProcessing}
              className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center transition-all transform hover:scale-105",
                isRecording
                  ? "bg-red-500 animate-pulse shadow-lg shadow-red-500/50"
                  : "bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-lg hover:shadow-purple-500/50",
                isProcessing && "opacity-50 cursor-not-allowed"
              )}
            >
              {isRecording ? (
                <MicOff className="w-10 h-10 text-white" />
              ) : (
                <Mic className="w-10 h-10 text-white" />
              )}
            </button>
          )}
        </div>

        {/* 提示文字 */}
        <div className="text-center mt-4 text-gray-400">
          {isRecording ? '松开结束录音' : isProcessing ? '正在生成播客...' : '按住录音'}
        </div>
      </div>
    </div>
  )
}