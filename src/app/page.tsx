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
  const [isDarkMode, setIsDarkMode] = useState(false)
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
      // 尝试获取真实麦克风权限，如果失败则使用模拟音频流
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        console.log('使用真实麦克风')
      } catch (err) {
        console.log('麦克风权限被拒绝，使用模拟音频流')
        // 创建一个模拟的音频流
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const destination = audioContext.createMediaStreamDestination()
        oscillator.connect(destination)
        oscillator.start()
        stream = destination.stream
      }

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
        if (stream) {
          stream.getTracks().forEach(track => track.stop())
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error('录音启动失败:', err)
      // 添加错误消息给用户
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '录音启动失败，请刷新页面重试',
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

  // 主题切换函数
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode)
  }

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-300",
      isDarkMode 
        ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white" 
        : "bg-white text-gray-900"
    )}>
      {/* 圣诞装饰 - 仅在深色模式显示 */}
      {isDarkMode && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 left-10 text-green-400 text-2xl opacity-20">❄️</div>
          <div className="absolute top-20 right-20 text-red-400 text-xl opacity-20">✨</div>
          <div className="absolute bottom-20 left-20 text-green-400 text-lg opacity-20">❄️</div>
          <div className="absolute bottom-10 right-10 text-red-400 text-xl opacity-20">✨</div>
        </div>
      )}

      {/* 主题切换按钮 */}
      <div className="fixed top-4 right-4 z-20">
        <button
          onClick={toggleTheme}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-all text-sm",
            isDarkMode 
              ? "bg-slate-700 hover:bg-slate-600 text-green-300" 
              : "bg-gray-200 hover:bg-gray-300 text-gray-600"
          )}
        >
          {isDarkMode ? '🎄' : '🌙'}
        </button>
      </div>

      {/* 主容器 */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 头部 */}
        <header className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Headphones className={cn(
              "w-10 h-10 transition-colors",
              isDarkMode ? "text-green-400" : "text-gray-600"
            )} />
            <h1 className={cn(
              "text-5xl font-bold transition-colors",
              isDarkMode 
                ? "text-white" 
                : "text-gray-900"
            )}>
              娓娓
            </h1>
          </div>
          <p className={cn(
            "text-xl transition-colors",
            isDarkMode ? "text-gray-300" : "text-gray-600"
          )}>
            AI语音播客编导，把你的故事变成声音
          </p>
        </header>

        {/* 步骤指示器 */}
        <div className="flex justify-center mb-12">
          <div className={cn(
            "flex items-center gap-4 rounded-full p-2 transition-colors",
            isDarkMode ? "bg-slate-800/50" : "bg-gray-100"
          )}>
            {steps.map((step, index) => (
              <div key={step.step} className="flex items-center">
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-all",
                    step.isCompleted
                      ? isDarkMode 
                        ? "bg-green-600 text-white" 
                        : "bg-gray-900 text-white"
                      : currentStep === index
                      ? isDarkMode 
                        ? "bg-red-600 text-white" 
                        : "bg-gray-800 text-white"
                      : isDarkMode 
                        ? "bg-slate-700 text-gray-400" 
                        : "bg-gray-200 text-gray-500"
                  )}
                >
                  {step.isCompleted ? '✓' : step.step}
                </div>
                <span className={cn(
                  "ml-2 mr-4 text-sm font-medium transition-colors",
                  step.isCompleted 
                    ? isDarkMode ? "text-green-300" : "text-gray-900" 
                    : currentStep === index 
                    ? isDarkMode ? "text-red-300" : "text-gray-700" 
                    : isDarkMode ? "text-gray-500" : "text-gray-400"
                )}>
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 消息列表 */}
        <div className={cn(
          "rounded-2xl p-6 mb-8 h-96 overflow-y-auto transition-colors",
          isDarkMode ? "bg-slate-800/50" : "bg-gray-50"
        )}>
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
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                    isDarkMode 
                      ? "bg-green-600" 
                      : "bg-gray-800"
                  )}>
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-md rounded-2xl px-4 py-3 transition-colors",
                    message.role === 'user'
                      ? isDarkMode 
                        ? "bg-red-600 text-white" 
                        : "bg-gray-800 text-white"
                      : isDarkMode 
                        ? "bg-slate-700 text-gray-100" 
                        : "bg-white border border-gray-200 text-gray-700"
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
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                    isDarkMode ? "bg-slate-700" : "bg-gray-600"
                  )}>
                    <Waves className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 播客播放器 */}
        {podcastUrl && (
          <div className={cn(
            "rounded-2xl p-6 mb-8 border transition-colors",
            isDarkMode 
              ? "bg-slate-800/50 border-slate-700" 
              : "bg-gray-50 border-gray-200"
          )}>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Sparkles className={cn(
                "w-6 h-6 transition-colors",
                isDarkMode ? "text-green-400" : "text-gray-600"
              )} />
              你的播客
            </h3>
            <audio controls className="w-full mb-4" src={podcastUrl}>
              您的浏览器不支持音频播放
            </audio>
            {podcastScript && (
              <div className={cn(
                "rounded-lg p-4 mb-4 transition-colors",
                isDarkMode ? "bg-slate-700" : "bg-white border border-gray-200"
              )}>
                <h4 className={cn(
                  "text-sm font-semibold mb-2 transition-colors",
                  isDarkMode ? "text-green-300" : "text-gray-600"
                )}>
                  播客文案
                </h4>
                <pre className={cn(
                  "text-sm whitespace-pre-wrap transition-colors",
                  isDarkMode ? "text-gray-300" : "text-gray-600"
                )}>
                  {podcastScript}
                </pre>
              </div>
            )}
            <div className="flex gap-3">
              <button className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                isDarkMode 
                  ? "bg-green-600 hover:bg-green-700 text-white" 
                  : "bg-gray-800 hover:bg-gray-900 text-white"
              )}>
                <Share2 className="w-4 h-4" />
                分享
              </button>
              <button className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                isDarkMode 
                  ? "bg-slate-700 hover:bg-slate-600 text-white" 
                  : "bg-gray-200 hover:bg-gray-300 text-gray-700"
              )}>
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
                  : isDarkMode 
                    ? "bg-gradient-to-r from-green-600 to-red-600 hover:shadow-lg hover:shadow-green-500/50" 
                    : "bg-gray-800 hover:bg-gray-900 hover:shadow-lg hover:shadow-gray-800/50",
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
        <div className={cn(
          "text-center mt-4 transition-colors",
          isDarkMode ? "text-gray-400" : "text-gray-500"
        )}>
          {isRecording ? '松开结束录音' : isProcessing ? '正在生成播客...' : '按住录音'}
        </div>
      </div>
    </div>
  )
}