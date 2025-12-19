前端 (Next.js)

    ↓ HTTP/WebSocket

主Python进程 (chat_server.py)

    ↓ 权限校验 + 文本处理

文本+systemprompt
    ↓ claude自己驱动skill

claude agent sdk python

↓所有结果返回出去

纯文本技能工具

    ↓ 只返回文本建议

前端TTS播放

#1 创建session、返回sessionid

#2 在/chat/completions接口里，前端带一个header或者带一个参数来作为sessionid请求发到后端，后段：

1. 验证session_id存在性
  
2. 提取用户消息内容
  
3. 调用process_text_with_skills(): subagent skills 里使用claude agent sdk python，不使用anthropic、openai库，claude agent sdk设置cwd=/tmp/{session_id}、systemprompt='使用博客skill'、userprompt='用户说的mp3的前端tts之后的text文本'
  
4. 生成响应全部类型内容全部返回前端
  

用户sessionid不删除一直存储，用户只要想聊天就可以继续传sessionid通过process_text_with_skills用claude agent sdj聊天

现在前端要求一个新接口来组织数据结构，我们看下怎么给支持：播客方案生成接口 (Podcast Proposal Generation)

用于根据用户的对话记录和语音片段，生成一期播客的脚本方案（包含 AI 旁白和用户原声的编排）。

- **URL**: `/api/podcast/generate`
- **Method**: `POST`
- **Content-Type**: `application/json`

### 请求参数 (Request)

| 字段名 | 类型  | 必填  | 说明  |
| --- | --- | --- | --- |
| `prompt` | `string` | 是   | 用户的生成需求提示词（例如：“帮我生成一个关于个人成长的故事”） |
| `voice_clips` | `Array` | 是   | 所有相关的语音片段元数据 |
| `chat_sessions` | `Array` | 是   | 包含多个对话会话的列表（支持多轮对话上下文） |

**VoiceClip 对象结构**:
| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `string` | 语音片段的唯一 ID (前端生成，用于后续对应音频文件) |
| `transcript` | `string` | 语音对应的文本内容 |

**ChatSession 对象结构**:
| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `title` | `string` | 对话/会话的标题 |
| `messages` | `Array` | 该会话下的消息列表 |

### 响应参数 (Response)

返回生成的播客方案详情 (`PodcastPlan`)。

| 字段名 | 类型  | 说明  |
| --- | --- | --- |
| `id` | `string` | 方案 ID |
| `title` | `string` | 播客标题 |
| `summary` | `string` | 播客简介 |
| `tags` | `Array<string>` | 标签列表 |
| `segments` | `Array` | 播客段落列表（核心内容） |
| `status` | `string` | 状态，初始为 `draft` |
| `createdAt` | `number` | 创建时间戳 |

**Segment 对象结构**:
| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `string` | 段落 ID |
| `type` | `string` | 类型：`ai_narration` (AI 旁白) 或 `user_clip` (用户原声) |
| `content` | `string` | 文本内容 |
| `clipId` | `string` | (可选) 当 type 为 `user_clip` 时，对应的语音片段 ID |

### 示例数据 (Test Data)

**请求示例 (Request Body)**:

```json
{
  "prompt": "生成一个关于我对科技与生活看法的播客",
  "voice_clips": [
    {
      "id": "clip-uuid-1234",
      "transcript": "我最近一直在思考科技如何改变我们对时间的感知..."
    },
    {
      "id": "clip-uuid-5678",
      "transcript": "有时候我觉得我们被算法控制了。"
    }
  ],
  "chat_sessions": [
    {
      "title": "关于时间的思考",
      "messages": [
        {
          "role": "user",
          "content": "我最近一直在思考科技如何改变我们对时间的感知..."
        },
        {
          "role": "assistant",
          "content": "这个观点很有趣，能展开说说吗？"
        }
      ]
    },
    {
      "title": "关于算法的讨论",
      "messages": [
        {
          "role": "user",
          "content": "有时候我觉得我们被算法控制了。"
        }
      ]
    }
  ]
}
```

**响应示例 (Response Body)**:

```json
{
  "id": "plan-uuid-9999",
  "title": "故事: 关于科技与感知的反思...",
  "summary": "一期由 AI 生成的播客节目，探讨了你最近关于科技、算法与时间感知的想法并附带精彩点评。",
  "tags": ["个人", "反思", "AI 生成"],
  "status": "draft",
  "createdAt": 1715000000000,
  "segments": [
    {
      "id": "seg-1",
      "type": "ai_narration",
      "content": "欢迎收听新的一期个人旅程。今天，我们来回顾一些有趣的想法。"
    },
    {
      "id": "seg-2",
      "type": "user_clip",
      "content": "我最近一直在思考科技如何改变我们对时间的感知...",
      "clipId": "clip-uuid-1234"
    },
    {
      "id": "seg-3",
      "type": "ai_narration",
      "content": "这是一个非常独特的视角。让我们深入探讨这对你的日常生活意味着什么。"
    },
    {
      "id": "seg-4",
      "type": "user_clip",
      "content": "有时候我觉得我们被算法控制了。",
      "clipId": "clip-uuid-5678"
    },
    {
      "id": "seg-5",
      "type": "ai_narration",
      "content": "总的来说，这里似乎有一个关于成长和韧性的共同主题。"
    }
  ]
}
```

## [Claude Agent SDK for Python](https://github.com/anthropics/claude-agent-sdk-python)

[1](https://github.com/anthropics/claude-agent-sdk-python)

[

](https://github.com/anthropics/claude-agent-sdk-python)

The **Claude Agent SDK** is a Python library for building interactive, tool-augmented AI agents using **Claude Code**. It supports both simple queries and advanced bidirectional conversations with custom tools, hooks, and mixed server setups.

**Installation & Requirements**

pip install claude-agent-sdk

npm install -g @anthropic-ai/claude-code # Claude Code 2.0.0+

![Copy](data:image/svg+xml;base64,77u/PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTkiIHZpZXdCb3g9IjAgMCAxOCAxOSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4NCiAgICA8cGF0aCBkPSJNNC4xMTM2MyAzLjU0MTc0TDQuMTExNTMgNS4xNjY0NVYxMy4yMDU0QzQuMTExNTMgMTQuNTc5IDUuMTk5MjUgMTUuNjkyNiA2LjU0MTAyIDE1LjY5MjZMMTIuOTgyIDE1LjY5MjlDMTIuNzUxIDE2LjM2MTUgMTIuMTI4MSAxNi44NDA2IDExLjM5NTggMTYuODQwNkg2LjU0MTAyQzQuNTc5OTggMTYuODQwNiAyLjk5MDIzIDE1LjIxMzEgMi45OTAyMyAxMy4yMDU0VjUuMTY2NDVDMi45OTAyMyA0LjQxNTkxIDMuNDU5MjcgMy43Nzc1MiA0LjExMzYzIDMuNTQxNzRaTTEzLjI2ODggMS41MzEyNUMxNC4xOTc3IDEuNTMxMjUgMTQuOTUwOCAyLjMwMjE5IDE0Ljk1MDggMy4yNTMxOVYxMy4yMDIyQzE0Ljk1MDggMTQuMTUzMSAxNC4xOTc3IDE0LjkyNDEgMTMuMjY4OCAxNC45MjQxSDYuNTQxMDJDNS42MTIxIDE0LjkyNDEgNC44NTkwNyAxNC4xNTMxIDQuODU5MDcgMTMuMjAyMlYzLjI1MzE5QzQuODU5MDcgMi4zMDIxOSA1LjYxMjEgMS41MzEyNSA2LjU0MTAyIDEuNTMxMjVIMTMuMjY4OFpNMTMuMjY4OCAyLjY3OTIxSDYuNTQxMDJDNi4yMzEzOCAyLjY3OTIxIDUuOTgwMzcgMi45MzYxOSA1Ljk4MDM3IDMuMjUzMTlWMTMuMjAyMkM1Ljk4MDM3IDEzLjUxOTIgNi4yMzEzOCAxMy43NzYxIDYuNTQxMDIgMTMuNzc2MUgxMy4yNjg4QzEzLjU3ODQgMTMuNzc2MSAxMy44Mjk1IDEzLjUxOTIgMTMuODI5NSAxMy4yMDIyVjMuMjUzMTlDMTMuODI5NSAyLjkzNjE5IDEzLjU3ODQgMi42NzkyMSAxMy4yNjg4IDIuNjc5MjFaIiBmaWxsPSIjNzY3Njc2IiAvPg0KPC9zdmc+)

Requires **Python 3.10+** and **Node.js**.

**Basic Query Example**

import anyio

from claude_agent_sdk import query, AssistantMessage, TextBlock

async def main():

async for message in query(prompt="Hello Claude"):

if isinstance(message, AssistantMessage):

for block in message.content:

if isinstance(block, TextBlock):

print(block.text)

anyio.run(main)

![Copy](data:image/svg+xml;base64,77u/PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTkiIHZpZXdCb3g9IjAgMCAxOCAxOSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4NCiAgICA8cGF0aCBkPSJNNC4xMTM2MyAzLjU0MTc0TDQuMTExNTMgNS4xNjY0NVYxMy4yMDU0QzQuMTExNTMgMTQuNTc5IDUuMTk5MjUgMTUuNjkyNiA2LjU0MTAyIDE1LjY5MjZMMTIuOTgyIDE1LjY5MjlDMTIuNzUxIDE2LjM2MTUgMTIuMTI4MSAxNi44NDA2IDExLjM5NTggMTYuODQwNkg2LjU0MTAyQzQuNTc5OTggMTYuODQwNiAyLjk5MDIzIDE1LjIxMzEgMi45OTAyMyAxMy4yMDU0VjUuMTY2NDVDMi45OTAyMyA0LjQxNTkxIDMuNDU5MjcgMy43Nzc1MiA0LjExMzYzIDMuNTQxNzRaTTEzLjI2ODggMS41MzEyNUMxNC4xOTc3IDEuNTMxMjUgMTQuOTUwOCAyLjMwMjE5IDE0Ljk1MDggMy4yNTMxOVYxMy4yMDIyQzE0Ljk1MDggMTQuMTUzMSAxNC4xOTc3IDE0LjkyNDEgMTMuMjY4OCAxNC45MjQxSDYuNTQxMDJDNS42MTIxIDE0LjkyNDEgNC44NTkwNyAxNC4xNTMxIDQuODU5MDcgMTMuMjAyMlYzLjI1MzE5QzQuODU5MDcgMi4zMDIxOSA1LjYxMjEgMS41MzEyNSA2LjU0MTAyIDEuNTMxMjVIMTMuMjY4OFpNMTMuMjY4OCAyLjY3OTIxSDYuNTQxMDJDNi4yMzEzOCAyLjY3OTIxIDUuOTgwMzcgMi45MzYxOSA1Ljk4MDM3IDMuMjUzMTlWMTMuMjAyMkM1Ljk4MDM3IDEzLjUxOTIgNi4yMzEzOCAxMy43NzYxIDYuNTQxMDIgMTMuNzc2MUgxMy4yNjg4QzEzLjU3ODQgMTMuNzc2MSAxMy44Mjk1IDEzLjUxOTIgMTMuODI5NSAxMy4yMDIyVjMuMjUzMTlDMTMuODI5NSAyLjkzNjE5IDEzLjU3ODQgMi42NzkyMSAxMy4yNjg4IDIuNjc5MjFaIiBmaWxsPSIjNzY3Njc2IiAvPg0KPC9zdmc+)

*query()* is asynchronous and streams responses as they arrive.

**Using Options**

from claude_agent_sdk import ClaudeAgentOptions

options = ClaudeAgentOptions(

system_prompt="You are a helpful assistant",

max_turns=1

)

async for msg in query(prompt="Tell me a joke", options=options):

print(msg)

![Copy](data:image/svg+xml;base64,77u/PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTkiIHZpZXdCb3g9IjAgMCAxOCAxOSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4NCiAgICA8cGF0aCBkPSJNNC4xMTM2MyAzLjU0MTc0TDQuMTExNTMgNS4xNjY0NVYxMy4yMDU0QzQuMTExNTMgMTQuNTc5IDUuMTk5MjUgMTUuNjkyNiA2LjU0MTAyIDE1LjY5MjZMMTIuOTgyIDE1LjY5MjlDMTIuNzUxIDE2LjM2MTUgMTIuMTI4MSAxNi44NDA2IDExLjM5NTggMTYuODQwNkg2LjU0MTAyQzQuNTc5OTggMTYuODQwNiAyLjk5MDIzIDE1LjIxMzEgMi45OTAyMyAxMy4yMDU0VjUuMTY2NDVDMi45OTAyMyA0LjQxNTkxIDMuNDU5MjcgMy43Nzc1MiA0LjExMzYzIDMuNTQxNzRaTTEzLjI2ODggMS41MzEyNUMxNC4xOTc3IDEuNTMxMjUgMTQuOTUwOCAyLjMwMjE5IDE0Ljk1MDggMy4yNTMxOVYxMy4yMDIyQzE0Ljk1MDggMTQuMTUzMSAxNC4xOTc3IDE0LjkyNDEgMTMuMjY4OCAxNC45MjQxSDYuNTQxMDJDNS42MTIxIDE0LjkyNDEgNC44NTkwNyAxNC4xNTMxIDQuODU5MDcgMTMuMjAyMlYzLjI1MzE5QzQuODU5MDcgMi4zMDIxOSA1LjYxMjEgMS41MzEyNSA2LjU0MTAyIDEuNTMxMjVIMTMuMjY4OFpNMTMuMjY4OCAyLjY3OTIxSDYuNTQxMDJDNi4yMzEzOCAyLjY3OTIxIDUuOTgwMzcgMi45MzYxOSA1Ljk4MDM3IDMuMjUzMTlWMTMuMjAyMkM1Ljk4MDM3IDEzLjUxOTIgNi4yMzEzOCAxMy43NzYxIDYuNTQxMDIgMTMuNzc2MUgxMy4yNjg4QzEzLjU3ODQgMTMuNzc2MSAxMy44Mjk1IDEzLjUxOTIgMTMuODI5NSAxMy4yMDIyVjMuMjUzMTlDMTMuODI5NSAyLjkzNjE5IDEzLjU3ODQgMi42NzkyMSAxMy4yNjg4IDIuNjc5MjFaIiBmaWxsPSIjNzY3Njc2IiAvPg0KPC9zdmc+)

Options allow setting **system prompts**, **tool permissions**, **working directories**, and more.

**Custom Tools (In-Process MCP Servers)**

from claude_agent_sdk import tool, create_sdk_mcp_server, ClaudeAgentOptions, ClaudeSDKClient

@tool("greet", "Greet a user", {"name": str})

async def greet_user(args):

return {"content": [{"type": "text", "text": f"Hello, {args['name']}!"}]}

server = create_sdk_mcp_server(name="my-tools", version="1.0.0", tools=[greet_user])

options = ClaudeAgentOptions(

mcp_servers={"tools": server},

allowed_tools=["mcp__tools__greet"]

)

async with ClaudeSDKClient(options=options) as client:

await client.query("Greet Alice")

async for msg in client.receive_response():

print(msg)

This avoids subprocess overhead and improves performance.

**Hooks for Pre/Post Processing** Hooks can intercept tool usage for validation or automation:

from claude_agent_sdk import HookMatcher

async def check_bash_command(input_data, tool_use_id, context):

if input_data["tool_name"] == "Bash" and "foo.sh" in input_data["tool_input"].get("command", ""):

return {"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny"}}

return {}

options = ClaudeAgentOptions(

allowed_tools=["Bash"],

hooks={"PreToolUse": [HookMatcher(matcher="Bash", hooks=[check_bash_command])]}

)

**Error Handling**

from claude_agent_sdk import CLINotFoundError, ProcessError

try:

async for _ in query(prompt="Hello"):

pass

except CLINotFoundError:

print("Please install Claude Code")

except ProcessError as e:

print(f"Process failed: {e.exit_code}")

The SDK is ideal for **AI agents with tool integration**, **custom automation**, and **interactive coding assistants**.