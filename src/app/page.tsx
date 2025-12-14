'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Upload, Play, Pause, Download, Share2, Sparkles, Headphones, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Recording {
  id: string
  blob?: Blob
  audioUrl?: string
  duration: number
  timestamp: Date
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  audioUrl?: string
  timestamp: Date
}

interface Step {
  id: number
  title: string
  status: 'pending' | 'recording' | 'completed'
  prompt: string
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [podcastUrl, setPodcastUrl] = useState<string | null>(null)
  const [podcastScript, setPodcastScript] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const [isAiThinking, setIsAiThinking] = useState(false)

  const getStepStatus = (stepId: number): 'pending' | 'recording' | 'completed' => {
    if (stepId < currentStep) return 'completed'
    if (stepId === currentStep) return 'recording'
    return 'pending'
  }

  const steps: Step[] = [
    {
      id: 1,
      title: "回忆瞬间",
      status: getStepStatus(1),
      prompt: "我们不需要一个完整故事。就说最近一次，你突然觉得'有点不对劲'的时候。你想到的第一个画面是什么？"
    },
    {
      id: 2,
      title: "重建现场",
      status: getStepStatus(2),
      prompt: "你能带我回到那个瞬间吗？当时具体发生了什么？"
    },
    {
      id: 3,
      title: "自我认知",
      status: getStepStatus(3),
      prompt: "如果现在回头看那一刻，你会怎么形容当时的自己？"
    }
  ]

  useEffect(() => {
    // 初始化欢迎消息
    setMessages([{
      id: '1',
      role: 'assistant',
      content: '你好，我是你的AI语音播客编导。我们将通过3段对话，把你的故事变成一期精彩的播客。',
      timestamp: new Date()
    }, {
      id: '2',
      role: 'assistant',
      content: steps[0].prompt,
      timestamp: new Date()
    }])

    // 预先请求麦克风权限并初始化音频流
    initAudioStream()
  }, [])

  // 初始化音频流
  const initAudioStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })
      audioStreamRef.current = stream

      // 预先创建MediaRecorder但不开始录制
      const options = { mimeType: 'audio/webm;codecs=opus' }
      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder

      console.log('麦克风权限已获取，准备就绪')
    } catch (err) {
      console.error('初始化音频流失败:', err)
    }
  }

  // 发送音频流到后端
  const sendAudioToBackend = async (audioChunk: Blob) => {
    try {
      // 将 Blob 转换为 ArrayBuffer
      const arrayBuffer = await audioChunk.arrayBuffer()

      // 发送到后端（即使后端不存在）
      fetch('/api/audio-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'audio/webm',
        },
        body: arrayBuffer,
      }).catch(err => {
        // 即使后端不存在也不报错，静默处理
        console.log('音频流发送到后端（后端可以不存在）')
      })
    } catch (error) {
      console.log('音频流处理:', error)
    }
  }

  // 播放AI回复的提示音
  const playAiResponseSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // 设置柔和的回复提示音
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime) // G5
      oscillator.frequency.exponentialRampToValueAtTime(1046.50, audioContext.currentTime + 0.1) // C6

      gainNode.gain.setValueAtTime(0, audioContext.currentTime)
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.02)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.2)
    } catch (err) {
      console.error('播放提示音失败:', err)
    }
  }

  const startRecording = async () => {
    if (!mediaRecorderRef.current) {
      console.error('MediaRecorder 未初始化')
      alert('录音功能初始化中，请稍后再试')
      return
    }

    try {
      audioChunksRef.current = []

      // 立即显示录音中消息
      const recordingMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '🎙️ 深呼吸...慢慢说，我在听',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, recordingMessage])

      // 设置数据处理回调
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
          console.log('录音数据:', event.data.size, 'bytes')

          // 发送音频数据到后端
          sendAudioToBackend(event.data)
        }
      }

      // 设置录音结束回调
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const audioUrl = URL.createObjectURL(audioBlob)
        console.log('录音完成，音频大小:', audioBlob.size, 'bytes')

        // 移除"正在录音"的消息
        setMessages(prev => prev.filter(msg => msg.id !== recordingMessage.id))

        const newRecording: Recording = {
          id: Date.now().toString(),
          blob: audioBlob,
          audioUrl,
          duration: recordingTime,
          timestamp: new Date()
        }

        setRecordings(prev => [...prev, newRecording])

        // 添加用户消息
        const userMessage: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: `录音完成 (${formatTime(recordingTime)})`,
          audioUrl,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, userMessage])

        // 模拟转录
        setTimeout(() => {
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

          // 设置AI思考状态
          setIsAiThinking(true)

          // 延迟显示AI回复，创造期待感
          setTimeout(() => {
            setIsAiThinking(false)

            // 准备AI响应
            if (currentStep < 2) {
              const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: steps[currentStep + 1].prompt,
                timestamp: new Date()
              }
              setMessages(prev => [...prev, aiMessage])
              setCurrentStep(prev => prev + 1)

              // 播放AI回复的提示音
              playAiResponseSound()
            } else {
              // 完成三步，生成播客
              generatePodcast()
            }
          }, 2000)
        }, 1000)
      }

      // 开始录音
      mediaRecorderRef.current.start(100)
      setIsRecording(true)
      console.log('开始录音...')

      // 开始计时
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

      // 播放温暖的提示音
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      const filter = audioContext.createBiquadFilter()

      oscillator.connect(filter)
      filter.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // 设置温暖的音色
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime) // C5
      oscillator.frequency.exponentialRampToValueAtTime(659.25, audioContext.currentTime + 0.1) // E5

      filter.type = 'lowpass'
      filter.frequency.value = 2000

      gainNode.gain.setValueAtTime(0, audioContext.currentTime)
      gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.05)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)

    } catch (err) {
      console.error('启动录音失败:', err)
      alert('录音启动失败，请刷新页面重试')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setRecordingTime(0)

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('audio/')) {
      setIsUploading(true)
      const audioUrl = URL.createObjectURL(file)

      const newRecording: Recording = {
        id: Date.now().toString(),
        audioUrl,
        duration: 0, // 实际应用中应该解析音频文件获取时长
        timestamp: new Date()
      }

      setRecordings(prev => [...prev, newRecording])

      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: `上传了音频文件: ${file.name}`,
        audioUrl,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, userMessage])

      setIsUploading(false)

      // 设置AI思考状态
      setIsAiThinking(true)

      // 上传后的AI响应
      setTimeout(() => {
        setIsAiThinking(false)

        if (currentStep < 2) {
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: steps[currentStep + 1].prompt,
            timestamp: new Date()
          }
          setMessages(prev => [...prev, aiMessage])
          setCurrentStep(prev => prev + 1)
          playAiResponseSound()
        } else {
          generatePodcast()
        }
      }, 2000)
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

    // 模拟播客生成
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <>
      <style jsx>{`
        @keyframes heartbeat {
          0% {
            transform: scale(1);
            opacity: 0.8;
          }
          20% {
            transform: scale(1.05);
            opacity: 0.4;
          }
          40% {
            transform: scale(1.1);
            opacity: 0.2;
          }
          60% {
            transform: scale(1.15);
            opacity: 0.1;
          }
          80% {
            transform: scale(1.2);
            opacity: 0.05;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }

        @keyframes pulse-ring {
          0% {
            transform: scale(0.95);
            opacity: 1;
          }
          40% {
            transform: scale(1.3);
            opacity: 0.5;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }

        .heartbeat-animation {
          animation: heartbeat 2s ease-in-out infinite;
        }

        .heartbeat-delay-1 {
          animation-delay: 0.5s;
        }

        .heartbeat-delay-2 {
          animation-delay: 1s;
        }

        .heartbeat-delay-3 {
          animation-delay: 1.5s;
        }

        .ai-thinking {
          animation: pulse-ring 3s ease-in-out infinite;
        }

        .ai-thinking-delay {
          animation-delay: 1s;
        }

        .animation-delay-100 {
          animation-delay: 100ms;
        }

        .animation-delay-200 {
          animation-delay: 200ms;
        }
      `}</style>
      <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center gap-3">
            <Headphones className="w-8 h-8 text-slate-600" />
            <h1 className="text-3xl font-light text-slate-900">娓娓</h1>
          </div>
          <p className="text-center text-slate-500 mt-2">AI语音播客编导</p>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Steps Progress */}
        <div className="flex justify-center mb-12">
          <div className="flex items-center gap-6">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "w-16 h-16 rounded-full flex flex-col items-center justify-center text-sm transition-all duration-500 ease-out",
                      step.status === 'completed'
                        ? "bg-white border-2 border-slate-800 shadow-sm"
                        : step.status === 'recording'
                        ? "bg-white border-2 border-slate-800 shadow-md"
                        : "bg-white border-2 border-slate-200"
                    )}
                  >
                    {step.status === 'completed' ? (
                      <span className="text-slate-800 text-lg">✓</span>
                    ) : step.status === 'recording' ? (
                      <>
                        <span className="text-slate-800 font-light">{step.id}</span>
                        <div className="flex gap-1 mt-1">
                          <div className="w-1 h-1 bg-slate-800 rounded-full animate-pulse"></div>
                          <div className="w-1 h-1 bg-slate-800 rounded-full animate-pulse animation-delay-100"></div>
                          <div className="w-1 h-1 bg-slate-800 rounded-full animate-pulse animation-delay-200"></div>
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-400 font-light">{step.id}</span>
                    )}
                  </div>
                  <span className={cn(
                    "text-xs mt-3 transition-all duration-500",
                    step.status === 'completed'
                      ? "text-slate-800 font-normal"
                      : step.status === 'recording'
                      ? "text-slate-800 font-medium"
                      : "text-slate-400 font-light"
                  )}>
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className="relative">
                    <div
                      className={cn(
                        "w-12 h-px transition-all duration-500",
                        step.status === 'completed' ? "bg-slate-800" : "bg-slate-200"
                      )}
                    ></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="bg-slate-50 rounded-2xl p-6 mb-8 h-96 overflow-y-auto relative">
          {/* AI思考时的波纹效果 */}
          {isAiThinking && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-none">
              <div className="relative">
                <div className="absolute inset-0 w-16 h-16 rounded-full bg-gradient-to-r from-blue-400/20 to-indigo-400/20 ai-thinking"></div>
                <div className="absolute inset-0 w-16 h-16 rounded-full bg-gradient-to-r from-blue-400/15 to-indigo-400/15 ai-thinking ai-thinking-delay"></div>
                <div className="w-16 h-16 rounded-full bg-white/80 flex items-center justify-center backdrop-blur-sm">
                  <Sparkles className="w-6 h-6 text-blue-500 animate-pulse" />
                </div>
              </div>
            </div>
          )}

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
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-md rounded-2xl px-4 py-3",
                    message.role === 'user'
                      ? "bg-slate-800 text-white"
                      : "bg-white border border-slate-200 text-slate-700"
                  )}
                >
                  {message.audioUrl && (
                    <audio controls className="w-full mb-2" src={message.audioUrl}>
                      您的浏览器不支持音频播放
                    </audio>
                  )}
                  <p className="text-sm">{message.content}</p>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <Mic className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Podcast Player */}
        {podcastUrl && (
          <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-200">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-800">
              <Sparkles className="w-6 h-6 text-slate-600" />
              你的播客
            </h3>
            <audio controls className="w-full mb-4" src={podcastUrl}>
              您的浏览器不支持音频播放
            </audio>
            {podcastScript && (
              <div className="bg-white rounded-lg p-4 mb-4 border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-600 mb-2">播客文案</h4>
                <pre className="text-sm text-slate-600 whitespace-pre-wrap">{podcastScript}</pre>
              </div>
            )}
            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition-colors">
                <Share2 className="w-4 h-4" />
                分享
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors">
                <Download className="w-4 h-4" />
                下载
              </button>
            </div>
          </div>
        )}

        {/* Recording Area */}
        <div className="mt-8">
          {/* File Upload */}
          <div className="mb-6 text-center">
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
              <span>上传音频文件 (MP3/WAV)</span>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Recording Button */}
          <div className="flex justify-center">
            {!podcastUrl && (
              <div className="relative">
                {/* 录音时的心跳波纹效果 */}
                {isRecording && (
                  <>
                    <div className="absolute inset-0 w-24 h-24 rounded-full bg-gradient-to-r from-rose-400/40 to-pink-400/40 heartbeat-animation"></div>
                    <div className="absolute inset-0 w-24 h-24 rounded-full bg-gradient-to-r from-rose-400/30 to-pink-400/30 heartbeat-animation heartbeat-delay-1"></div>
                    <div className="absolute inset-0 w-24 h-24 rounded-full bg-gradient-to-r from-rose-400/20 to-pink-400/20 heartbeat-animation heartbeat-delay-2"></div>
                    <div className="absolute inset-0 w-24 h-24 rounded-full bg-gradient-to-r from-rose-400/10 to-pink-400/10 heartbeat-animation heartbeat-delay-3"></div>
                  </>
                )}

                <button
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  disabled={isProcessing}
                  className={cn(
                    "relative w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all transform overflow-hidden",
                    isRecording
                      ? "bg-gradient-to-br from-rose-500 to-pink-600 scale-105 shadow-2xl shadow-rose-500/50"
                      : "bg-slate-600 hover:bg-slate-700 hover:scale-105 shadow-lg shadow-slate-600/30"
                  )}
                >
                  {isRecording && (
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  )}
                  {isRecording ? (
                    <>
                      <MicOff className="w-8 h-8 text-white mb-1 relative z-10 animate-pulse" />
                      <span className="text-xs text-white font-medium flex items-center gap-1 relative z-10">
                        <Clock className="w-3 h-3" />
                        {formatTime(recordingTime)}
                      </span>
                    </>
                  ) : (
                    <Mic className="w-8 h-8 text-white" />
                  )}
                </button>
              </div>
            )}
          </div>

          <p className="text-center mt-4 text-slate-500 text-sm">
            {isRecording ? '松开结束录音' : isProcessing ? '正在生成播客...' : '按住录音或上传音频文件'}
          </p>

          {/* Upload Progress */}
          {isUploading && (
            <div className="mt-4 text-center">
              <div className="inline-flex items-center gap-2 text-sm text-blue-600">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                上传中...
              </div>
            </div>
          )}
        </div>

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-lg p-8 border border-slate-200">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-700">正在生成播客...</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  )
}