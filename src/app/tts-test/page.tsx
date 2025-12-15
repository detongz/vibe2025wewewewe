'use client'

import { useState } from 'react'

export default function TTSTest() {
  const [text, setText] = useState('你好，这是测试语音合成的文本。')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedVoice, setSelectedVoice] = useState('male-qn-jingying')

  const testTTS = async () => {
    setIsLoading(true)
    setError(null)
    setAudioUrl(null)

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice: selectedVoice,
          emotion: 'neutral',
          speed: 1.0
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'TTS API 错误')
        return
      }

      // 创建音频URL
      if (data.audio_base64) {
        const audioBlob = new Buffer.from(data.audio_base64, 'base64')
        const url = URL.createObjectURL(new Blob([audioBlob], { type: 'audio/mp3' }))
        setAudioUrl(url)
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8">Minimax TTS 测试</h1>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              测试文本
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              placeholder="输入要测试的文本..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择音色
            </label>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="male-qn-jingying">精英男声</option>
              <option value="male-qn-qingse">青涩男声</option>
              <option value="male-qn-badao">霸道男声</option>
              <option value="female-qn-jingying">精英女声</option>
              <option value="female-qn-mane">暖心女声</option>
            </select>
          </div>

          <button
            onClick={testTTS}
            disabled={isLoading || !text}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '生成中...' : '生成语音'}
          </button>

          {error && (
            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
              <strong>错误:</strong> {error}
              <p className="mt-2 text-sm">请确保环境变量中配置了正确的 MINIMAX_API_KEY</p>
            </div>
          )}

          {audioUrl && (
            <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded-md">
              <p className="font-semibold mb-2">语音生成成功！</p>
              <audio controls className="w-full mt-2" src={audioUrl}>
                您的浏览器不支持音频播放
              </audio>
            </div>
          )}
        </div>

        <div className="mt-8 p-6 bg-yellow-50 border border-yellow-200 rounded-md">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">配置说明</h2>
          <p className="text-yellow-700 mb-2">
            要使用这个测试页面，请在 <code className="bg-yellow-100 px-2 py-1 rounded">.env.local</code> 文件中配置：
          </p>
          <pre className="bg-yellow-100 p-3 rounded-md overflow-x-auto text-sm">
{`MINIMAX_API_KEY=你的API密钥
MINIMAX_GROUP_ID=你的GroupID`}
          </pre>
          <p className="text-yellow-700 mt-2 text-sm">
            API密钥和Group ID可以在 <a href="https://api.minimax.chat" target="_blank" rel="noopener noreferrer" className="underline">Minimax 控制台</a> 获取。
          </p>
        </div>
      </div>
    </div>
  )
}