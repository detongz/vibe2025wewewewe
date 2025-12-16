'use client'

import { useState, useEffect, useRef } from 'react'

export default function TenTest() {
  const [isConnected, setIsConnected] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [testText, setTestText] = useState('你好，这是测试语音合成的功能。')
  const [selectedVoice, setSelectedVoice] = useState('male-qn-jingying')
  const [isConnecting, setIsConnecting] = useState(false)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [transcription, setTranscription] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // 初始化音频上下文
    const initAudio = async () => {
      try {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)()
        setAudioContext(context)
      } catch (error) {
        addLog(`音频上下文初始化失败: ${error}`)
      }
    }

    initAudio()

    return () => {
      if (audioContext) {
        audioContext.close()
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const handleStartRecording = async () => {
    try {
      addLog('开始录音...')
      setIsRecording(true)
      setRecordingTime(0)
      audioChunksRef.current = []

      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // 创建MediaRecorder
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        await handleAudioTranscription(audioBlob)
      }

      mediaRecorder.start()
      addLog('录音成功')

      // 开始计时
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

    } catch (error) {
      addLog(`录音失败: ${error}`)
      setIsRecording(false)
    }
  }

  const handleStopRecording = async () => {
    try {
      addLog('停止录音...')
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
      }
      setIsRecording(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      addLog('录音已停止')
    } catch (error) {
      addLog(`停止录音失败: ${error}`)
    }
  }

  const handleAudioTranscription = async (audioBlob: Blob) => {
    try {
      addLog('开始语音识别...')
      
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.wav')

      const response = await fetch('/api/asr', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('ASR请求失败')
      }

      const result = await response.json()
      setTranscription(result.text || result.answer || '识别结果为空')
      addLog('语音识别成功')
    } catch (error) {
      addLog(`语音识别失败: ${error}`)
      setTranscription('')
    }
  }

  const handleTestTTS = async () => {
    try {
      addLog(`测试TTS: ${testText}`)
      
      // 直接调用Minimax API
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: testText,
          voice: selectedVoice,
        }),
      })

      if (!response.ok) {
        throw new Error('TTS请求失败')
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      
      if (audioContext) {
        const audioElement = new Audio(audioUrl)
        audioElement.play()
        addLog('TTS播放成功')
      } else {
        addLog('音频上下文未初始化')
      }
    } catch (error) {
      addLog(`TTS失败: ${error}`)
    }
  }

  const handleConnect = async () => {
    try {
      setIsConnecting(true)
      addLog('正在连接到Minimax服务...')
      // 这里不需要连接，直接使用API
      setIsConnected(true)
      addLog('✅ 已连接到Minimax服务')
    } catch (error) {
      addLog(`❌ 连接失败: ${error}`)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      addLog('正在断开连接...')
      setIsConnected(false)
      addLog('已断开连接')
    } catch (error) {
      addLog(`断开连接失败: ${error}`)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8">Minimax直接集成测试页面</h1>

        {/* 连接状态 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">连接状态</h2>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{isConnected ? '已连接到Minimax服务' : '未连接到Minimax服务'}</span>
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleConnect}
              disabled={isConnected || isConnecting}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400"
            >
              {isConnecting ? '连接中...' : '连接'}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={!isConnected}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-400"
            >
              断开连接
            </button>
          </div>
        </div>

        {/* 录音测试 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">录音测试</h2>
          <div className="flex gap-4">
            <button
              onClick={handleStartRecording}
              disabled={!isConnected || isRecording}
              className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-400"
            >
              开始录音
            </button>
            <button
              onClick={handleStopRecording}
              disabled={!isRecording}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-400"
            >
              停止录音
            </button>
          </div>
          {isRecording && (
            <div className="mt-4 flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span>正在录音... {formatTime(recordingTime)}</span>
            </div>
          )}
          {transcription && (
            <div className="mt-4 p-3 bg-gray-100 rounded-md">
              <p className="text-sm text-gray-600">识别结果:</p>
              <p className="mt-1">{transcription}</p>
            </div>
          )}
        </div>

        {/* TTS测试 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">TTS测试</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">测试文本</label>
              <input
                type="text"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">音色选择</label>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md"
              >
                <option value="male-qn-jingying">精英男声</option>
                <option value="male-qn-qingse">青涩男声</option>
                <option value="male-qn-badao">霸道男声</option>
                <option value="female-qn-jingying">精英女声</option>
                <option value="female-qn-mane">暖心女声</option>
              </select>
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleTestTTS}
                disabled={!isConnected}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
              >
                测试TTS
              </button>
            </div>
          </div>
        </div>

        {/* 日志输出 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">日志输出</h2>
          <div className="bg-gray-900 text-green-400 p-4 rounded-md h-64 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <span className="text-gray-500">等待日志...</span>
            ) : (
              logs.map((log, index) => (
                <div key={index}>{log}</div>
              ))
            )}
          </div>
          <button
            onClick={() => setLogs([])}
            className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            清空日志
          </button>
        </div>

        {/* 说明 */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="font-semibold text-blue-800 mb-2">说明：</h3>
          <ul className="text-blue-700 text-sm space-y-1">
            <li>• 直接使用Minimax API，无需Ten中间层</li>
            <li>• 配置好Minimax API密钥</li>
            <li>• 允许浏览器访问麦克风</li>
            <li>• 可以同时测试录音和TTS功能</li>
            <li>• 录音后会自动进行语音识别</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
