#!/usr/bin/env python3
"""
极简播客制作服务器 - 端口3000
核心：session_id验证 + 强制skill + SKILL.md知识库
使用Claude Agent SDK Python实现
"""

import sys
import os

# 添加虚拟环境路径
venv_path = os.path.join(
    os.path.dirname(__file__), "venv", "lib", "python3.11", "site-packages"
)
if os.path.exists(venv_path):
    sys.path.insert(0, venv_path)

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union, AsyncGenerator
import json
import uuid
from datetime import datetime
from pathlib import Path
import subprocess
import asyncio
from fastapi.responses import JSONResponse, StreamingResponse

app = FastAPI(title="Podcast Server", version="1.0.0")


# 自定义JSON响应，强制UTF-8编码
class UTF8JSONResponse(JSONResponse):
    def render(self, content: Any) -> bytes:
        return json.dumps(
            content,
            ensure_ascii=False,  # 禁用ASCII编码，允许中文
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
        ).encode("utf-8")


# 覆盖默认的JSON响应
app.default_response_class = UTF8JSONResponse

# CORS - 修复middleware配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[],
    max_age=3600,
)


# 数据模型
class ChatMessage(BaseModel):
    role: str
    content: Union[str, List[Dict[str, Any]]]


class ChatRequest(BaseModel):
    model: str = "kimi-for-podcast"
    messages: List[ChatMessage]
    max_tokens: Optional[int] = 1024
    temperature: Optional[float] = 0.7
    stream: Optional[bool] = False


class ChatResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[Dict[str, Any]]
    usage: Dict[str, int]
    session_id: str


class ChatCompletionStreamChunk(BaseModel):
    id: str
    object: str = "chat.completion.chunk"
    created: int
    model: str
    choices: List[Dict[str, Any]]
    session_id: str


# 播客生成相关数据模型
class VoiceClip(BaseModel):
    id: str
    transcript: str


class ChatSessionMessage(BaseModel):
    role: str
    content: str


class ChatSession(BaseModel):
    title: str
    messages: List[ChatSessionMessage]


class PodcastSegment(BaseModel):
    id: str
    type: str  # "ai_narration" or "user_clip"
    content: str
    clipId: Optional[str] = None  # 当type为"user_clip"时必填


class PodcastPlan(BaseModel):
    id: str
    title: str
    summary: str
    tags: List[str]
    segments: List[PodcastSegment]
    status: str = "draft"
    createdAt: int


class PodcastGenerateRequest(BaseModel):
    wewecontent: str
    voice_clips: List[VoiceClip]
    chat_sessions: List[ChatSession]
    session_id: str


class CreateSessionRequest(BaseModel):
    username: str  # 用户名，必填参数


# 系统提示词 - 强制使用skill
SYSTEM_PROMPT = """你使用skill完成工作"""

# 会话管理
SESSIONS_DIR = Path("/tmp")


def get_session_path(session_id: str) -> Path:
    return SESSIONS_DIR / f"{session_id}"


def create_session_context(session_id: str, username: str = "anonymous"):
    session_path = get_session_path(session_id)
    session_path.mkdir(exist_ok=True)

    # 保存会话信息
    session_info = {
        "session_id": session_id,
        "username": username,  # 添加用户名字段
        "created_at": datetime.now().isoformat(),
        "messages": [],
        "claude_session_id": None,  # 添加Claude会话ID字段
    }

    with open(session_path / "context.json", "w", encoding="utf-8") as f:
        json.dump(session_info, f, ensure_ascii=False, indent=2)
    with open(session_path / "CLAUDE.md", "w", encoding="utf-8") as f:
        json.dump(session_info, f, ensure_ascii=False, indent=2)

    return session_path


def save_message(session_id: str, role: str, content: str, tool_calls=None):
    session_path = get_session_path(session_id)
    context_file = session_path / "context.json"

    if context_file.exists():
        with open(context_file, "r", encoding="utf-8") as f:
            context = json.load(f)
    else:
        context = {"messages": []}

    message = {
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat(),
    }

    if tool_calls:
        message["tool_calls"] = tool_calls

    context["messages"].append(message)

    with open(context_file, "w", encoding="utf-8") as f:
        json.dump(context, f, ensure_ascii=False, indent=2)


def update_claude_session_in_context(our_session_id: str, claude_session_id: str):
    """更新会话上下文中的Claude会话ID"""
    try:
        session_path = get_session_path(our_session_id)
        session_path.mkdir(parents=True, exist_ok=True)  # Ensure directory exists
        context_file = session_path / "context.json"

        if context_file.exists():
            with open(context_file, "r", encoding="utf-8") as f:
                context = json.load(f)
        else:
            # Create initial context if it doesn't exist
            context = {
                "session_id": our_session_id,
                "created_at": datetime.now().isoformat(),
                "messages": [],
                "claude_session_id": claude_session_id,
            }

        context["claude_session_id"] = claude_session_id

        with open(context_file, "w", encoding="utf-8") as f:
            json.dump(context, f, ensure_ascii=False, indent=2)

        print(f"📝 更新会话上下文中的Claude会话ID: {claude_session_id}")
        return True
    except Exception as e:
        print(f"❌ 更新会话上下文失败: {str(e)}")
        return False


def load_claude_session_id(our_session_id: str) -> Optional[str]:
    """从持久化存储加载Claude会话ID"""
    try:
        # Use the same path approach as other functions
        session_path = get_session_path(our_session_id)
        session_path.mkdir(parents=True, exist_ok=True)  # Ensure directory exists
        context_file = session_path / "context.json"

        if context_file.exists():
            with open(context_file, "r", encoding="utf-8") as f:
                context = json.load(f)
                if "claude_session_id" in context:
                    return context["claude_session_id"]
        return None
    except Exception as e:
        print(f"❌ 加载Claude会话ID失败: {str(e)}")
        return None


def load_chat_history(our_session_id: str) -> Optional[str]:
    """从持久化存储加载Claude会话ID"""
    try:
        # Use the same path approach as other functions
        session_path = get_session_path(our_session_id)
        session_path.mkdir(parents=True, exist_ok=True)  # Ensure directory exists
        context_file = session_path / "context.json"

        context_msgs = []
        if context_file.exists():
            with open(context_file, "r", encoding="utf-8") as f:
                context = json.load(f)
                for msg in context.get("messages"):
                    context_msgs.append(f"{msg.get('role')}: {msg.get('content')}")
                return "\n".join(context_msgs) + "\n"
        return None
    except Exception as e:
        print(f"❌ 加载Claude会话ID失败: {str(e)}")
        return None


# Claude Agent SDK集成
class ClaudeAgentSDK:
    """Claude Agent SDK Python实现"""

    def __init__(self):
        self.work_dir = None
        self.claude_session_ids = (
            {}
        )  # 存储Claude会话ID映射：our_session_id -> claude_session_id

    async def process_formated_mp3_data(
        self, wewewe_data: str, session_id: str, stream: bool = False
    ):
        # json-validator
        # podcast_json_export
        SYSTEM_PROMPT = """你使用json-validator skill检查podcast_json_export的输出：podcast_json_export是处理输入数据产出"""
        pass

    # TODO

    async def process_message(
        self, user_message: str, session_id: str, stream: bool = False
    ) -> Union[Dict[str, Any], AsyncGenerator[str, None]]:
        """使用Claude Agent SDK处理消息"""
        try:
            # 设置工作目录为 /tmp/{session_id}
            work_dir = get_session_path(session_id)
            work_dir.mkdir(parents=True, exist_ok=True)

            if stream:
                # 流式处理模式
                return self._stream_claude_agent(
                    user_message, str(work_dir), session_id
                )
            else:
                # 非流式处理模式
                result = await self._query_claude_agent(
                    user_message, str(work_dir), session_id
                )
                return {
                    "content": result["content"],
                    "tool_calls": result["tool_calls"],
                    "success": True,
                    "claude_session_id": result.get("claude_session_id"),
                }

        except Exception as e:
            if stream:
                # 流式模式下的错误处理
                async def error_stream():
                    error_chunk = {
                        "id": f"chatcmpl-{int(datetime.now().timestamp())}",
                        "object": "chat.completion.chunk",
                        "created": int(datetime.now().timestamp()),
                        "model": "kimi-k2-turbo-preview",
                        "choices": [
                            {
                                "index": 0,
                                "delta": {"content": f"处理消息时出错: {str(e)}"},
                                "finish_reason": None,
                            }
                        ],
                        "session_id": session_id,
                    }
                    yield f"data: {json.dumps(error_chunk, ensure_ascii=False)}\n\n"
                    yield "data: [DONE]\n\n"

                return error_stream()
            else:
                return {
                    "content": f"处理消息时出错: {str(e)}",
                    "tool_calls": [self._create_default_tool_call(user_message)],
                    "success": False,
                    "claude_session_id": None,
                }

    async def _query_claude_agent(
        self, user_message: str, work_dir: str, our_session_id: str = None
    ) -> Dict[str, Any]:
        """使用Claude Agent SDK查询"""
        try:
            # 导入claude-agent-sdk
            from claude_agent_sdk import query, ClaudeAgentOptions
            from claude_agent_sdk.types import (
                AssistantMessage,
                TextBlock,
                ToolUseBlock,
                ResultMessage,
            )

            # 检查是否有保存的Claude会话ID
            claude_session_id = None
            if our_session_id:
                claude_session_id = self.claude_session_ids.get(our_session_id)
                if not claude_session_id:
                    # 尝试从文件加载
                    claude_session_id = load_claude_session_id(our_session_id)
                    if claude_session_id:
                        self.claude_session_ids[our_session_id] = claude_session_id

            # 创建claude-agent-sdk选项
            options = ClaudeAgentOptions(
                system_prompt="使用播客编导 podcasthelper skill 帮助用户产出播客",
                setting_sources=["user", "project"],
                allowed_tools=["Skill", "Read", "Write", "Bash", "Grep", "Glob"],
                cwd=work_dir,
            )

            # 如果有保存的Claude会话ID，使用resume选项
            if claude_session_id:
                options.resume = claude_session_id
                print(f"🔄 恢复Claude会话: {claude_session_id}")

            # 使用claude-agent-sdk处理消息
            response_text = ""
            tool_calls = []
            captured_claude_session_id = None

            async for message in query(
                prompt=load_chat_history(our_session_id)
                + "用户："
                + user_message
                + "你的回复：",
                options=options,
            ):
                # 捕获系统初始化消息中的会话ID
                if (
                    hasattr(message, "type")
                    and message.type == "system"
                    and hasattr(message, "subtype")
                    and message.subtype == "init"
                ):
                    if (
                        hasattr(message, "data")
                        and message.data
                        and "session_id" in message.data
                    ):
                        captured_claude_session_id = message.data["session_id"]
                        print(f"🎯 捕获到Claude会话ID: {captured_claude_session_id}")

                        # 保存Claude会话ID
                        if our_session_id and captured_claude_session_id:
                            self.claude_session_ids[our_session_id] = (
                                captured_claude_session_id
                            )
                            update_claude_session_in_context(
                                our_session_id, captured_claude_session_id
                            )
                if isinstance(message, ResultMessage):
                    response_text += message.result
                    save_message(our_session_id, "assistant", message.result)
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if isinstance(block, TextBlock):
                            response_text += f"<think>{block.text}</think>" + "\n"
                        elif isinstance(block, ToolUseBlock):
                            tool_calls.append(
                                {
                                    "id": f"tool_{len(tool_calls)}_{int(datetime.now().timestamp())}",
                                    "type": "function",
                                    "function": {
                                        "name": block.name,
                                        # "arguments": (
                                        #     json.dumps(block.input)
                                        #     if hasattr(block, "input")
                                        #     else "{}"
                                        # ),
                                    },
                                }
                            )

            # 如果没有工具调用，创建默认的skill调用
            if not tool_calls:
                tool_calls = [self._create_default_tool_call(user_message)]

            return {
                "content": response_text.strip() if response_text else "处理完成",
                "tool_calls": tool_calls,
                "claude_session_id": captured_claude_session_id or claude_session_id,
            }

        except Exception as e:
            # 如果SDK调用失败，返回模拟响应
            mock_response = (
                f"我理解您的需求。我让娓娓来帮助您制作播客。[SDK调用失败: {str(e)}]"
            )
            return {
                "content": mock_response,
                "tool_calls": [self._create_default_tool_call(user_message)],
                "claude_session_id": None,
            }

    # 流式处理，重要
    async def _stream_claude_agent(
        self, user_message: str, work_dir: str, our_session_id: str
    ) -> AsyncGenerator[str, None]:
        """使用Claude Agent SDK进行流式查询"""
        try:
            from claude_agent_sdk import query, ClaudeAgentOptions
            from claude_agent_sdk.types import (
                AssistantMessage,
                TextBlock,
                ToolUseBlock,
                ResultMessage,
            )

            # 检查是否有保存的Claude会话ID
            claude_session_id = None
            if our_session_id:
                claude_session_id = self.claude_session_ids.get(our_session_id)
                if not claude_session_id:
                    # 尝试从文件加载
                    claude_session_id = load_claude_session_id(our_session_id)
                    if claude_session_id:
                        self.claude_session_ids[our_session_id] = claude_session_id

            # 创建claude-agent-sdk选项
            options = ClaudeAgentOptions(
                system_prompt="使用播客编导podcasthelper skill 帮助用户产出播客",
                setting_sources=["user", "project"],
                allowed_tools=["Skill", "Read", "Write", "Bash", "Grep", "Glob"],
                cwd=work_dir,
            )

            # 如果有保存的Claude会话ID，使用resume选项
            if claude_session_id:
                options.resume = claude_session_id
                print(f"🔄 恢复Claude会话 (流式): {claude_session_id}")

            # 生成唯一的聊天ID
            chat_id = f"chatcmpl-{int(datetime.now().timestamp())}"
            created = int(datetime.now().timestamp())

            # 发送初始chunk
            initial_chunk = {
                "id": chat_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": "kimi-for-podcast",
                "choices": [
                    {
                        "index": 0,
                        "delta": {"role": "assistant", "content": ""},
                        "finish_reason": None,
                    }
                ],
                "session_id": our_session_id,
            }
            yield f"data: {json.dumps(initial_chunk, ensure_ascii=False)}\n\n"

            # 使用claude-agent-sdk处理消息并流式输出
            response_text = ""
            tool_calls = []
            chunk_count = 0
            captured_claude_session_id = None

            # 模拟流式响应 - 将完整响应分成多个chunk
            full_response = "<think>娓娓转圈圈</think>"

            # 将响应分成多个chunk来模拟流式输出
            chunk = {
                "id": chat_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": "kimi-for-podcast",
                "choices": [
                    {
                        "index": 0,
                        "delta": {"content": full_response},
                        "finish_reason": None,
                    }
                ],
                "session_id": our_session_id,
            }
            yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"

            # 尝试使用真实的SDK进行查询（如果可用）
            try:
                async for message in query(
                    prompt=load_chat_history(our_session_id)
                    + "用户："
                    + user_message
                    + "你的回复：",
                    options=options,
                ):
                    print("msg::", message)
                    # 捕获系统初始化消息中的会话ID
                    if (
                        hasattr(message, "data")
                        and message.data
                        and "session_id" in message.data
                    ):
                        captured_claude_session_id = message.data["session_id"]
                        print(
                            f"🎯 捕获到Claude会话ID (流式): {captured_claude_session_id}"
                        )

                        # 保存Claude会话ID
                        if our_session_id and captured_claude_session_id:
                            self.claude_session_ids[our_session_id] = (
                                captured_claude_session_id
                            )
                            update_claude_session_in_context(
                                our_session_id, captured_claude_session_id
                            )

                    if isinstance(message, ResultMessage):
                        # 判断comfirm_generate是不是在message.result里
                        msg_res = message.result
                        if (
                            "<comfirm_generate>" in message.result
                            and "</comfirm_generate>" in message.result
                        ):
                            msg_res = (
                                msg_res.split("<comfirm_generate>")[0]
                                + msg_res.split("</comfirm_generate>")[1]
                            )
                            yield f"data: {"comfirm_generate": true}"
                        # 流式输出文本内容
                        chunk = {
                            "id": chat_id,
                            "object": "chat.completion.chunk",
                            "created": created,
                            "model": "kimi-for-podcast",
                            "choices": [
                                {
                                    "index": 0,
                                    "delta": {"content": msg_res},
                                    "finish_reason": None,
                                }
                            ],
                            "session_id": our_session_id,
                        }
                        yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                        response_text += block.text + "\n"
                        save_message(our_session_id, "assistant", message.result)
                    if isinstance(message, AssistantMessage):
                        for block in message.content:
                            if isinstance(block, TextBlock):
                                # 流式输出文本内容
                                chunk = {
                                    "id": chat_id,
                                    "object": "chat.completion.chunk",
                                    "created": created,
                                    "model": "kimi-for-podcast",
                                    "choices": [
                                        {
                                            "index": 0,
                                            "delta": {
                                                "content": f"<think>{block.text}</think>"
                                            },
                                            "finish_reason": None,
                                        }
                                    ],
                                    "session_id": our_session_id,
                                }
                                yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                                response_text += block.text + "\n"
                                await asyncio.sleep(0.05)  # 小延迟
                            elif isinstance(block, ToolUseBlock):
                                tool_calls.append(
                                    {
                                        "id": f"tool_{len(tool_calls)}_{int(datetime.now().timestamp())}",
                                        "type": "function",
                                        "function": {
                                            "name": block.name,
                                            "arguments": (
                                                json.dumps(block.input)
                                                if hasattr(block, "input")
                                                else "{}"
                                            ),
                                        },
                                    }
                                )
            except Exception as sdk_error:
                # 如果SDK调用失败，添加错误信息到响应
                error_text = f" [SDK调用失败，使用模拟响应: {str(sdk_error)}]"
                chunk = {
                    "id": chat_id,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": "kimi-for-podcast",
                    "choices": [
                        {
                            "index": 0,
                            "delta": {"content": error_text},
                            "finish_reason": None,
                        }
                    ],
                    "session_id": our_session_id,
                }
                yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                response_text += error_text

            # 如果没有工具调用，创建默认的skill调用
            if not tool_calls:
                tool_calls = [self._create_default_tool_call(user_message)]

            # 发送工具调用信息
            if tool_calls:
                tool_chunk = {
                    "id": chat_id,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": "kimi-for-podcast",
                    "choices": [
                        {
                            "index": 0,
                            "delta": {"content": "", "tool_calls": tool_calls},
                            "finish_reason": None,
                        }
                    ],
                    "session_id": our_session_id,
                }
                yield f"data: {json.dumps(tool_chunk, ensure_ascii=False)}\n\n"

            # 发送完成chunk
            final_chunk = {
                "id": chat_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": "kimi-for-podcast",
                "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
                "session_id": our_session_id,
            }
            yield f"data: {json.dumps(final_chunk, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

        except Exception as e:
            # 错误处理
            error_chunk = {
                "id": f"chatcmpl-{int(datetime.now().timestamp())}",
                "object": "chat.completion.chunk",
                "created": int(datetime.now().timestamp()),
                "model": "kimi-for-podcast",
                "choices": [
                    {
                        "index": 0,
                        "delta": {"content": f"流式处理出错: {str(e)}"},
                        "finish_reason": None,
                    }
                ],
                "session_id": our_session_id,
            }
            yield f"data: {json.dumps(error_chunk, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

    def _extract_tool_calls(self, result_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """提取工具调用信息"""
        tool_calls = []

        # 从结果中提取工具调用
        if "tool_calls" in result_data.get("result", {}):
            for tool_call in result_data["result"]["tool_calls"]:
                tool_calls.append(
                    {
                        "id": tool_call.get(
                            "id", f"tool_{int(datetime.now().timestamp())}"
                        ),
                        "type": "function",
                        "function": {
                            "name": tool_call.get("name", "skill_documentation"),
                            "arguments": json.dumps(tool_call.get("arguments", {})),
                        },
                    }
                )

        return tool_calls if tool_calls else [self._create_default_tool_call("")]

    def _create_default_tool_call(self, user_message: str) -> Dict[str, Any]:
        """创建默认的工具调用"""
        return {
            "id": f"skill_{int(datetime.now().timestamp())}",
            "type": "function",
            "function": {
                "name": "skill_documentation",
                "arguments": json.dumps(
                    {"query": user_message, "user_message": user_message}
                ),
            },
        }


# 初始化Claude Agent SDK
claude_agent_sdk = ClaudeAgentSDK()


# API端点
@app.post("/v1/sessions/create")
async def create_session(request: CreateSessionRequest):
    """创建新会话 - 需要用户名参数"""
    try:
        print(f"🚀 创建会话请求到达")
        username = request.username
        session_id = str(uuid.uuid4())
        print(f"📋 生成session_id: {session_id}, 用户名: {username}")

        session_path = create_session_context(session_id, username)
        print(f"📁 创建会话目录: {session_path}")

        response = {
            "session_id": session_id,
        }
        print(f"✅ 返回响应: {response}")
        return response

    except Exception as e:
        print(f"❌ 创建会话错误: {str(e)}")
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"创建会话失败: {str(e)}")


@app.post("/v1/chat/completions")
async def chat_completions(
    request: ChatRequest,
    session_id: str = Header(..., description="会话ID", alias="session-id"),
):
    """聊天完成 - 前端通过header传递session_id，支持流式响应"""

    # 1. 验证session_id存在性
    session_path = get_session_path(session_id)
    if not session_path.exists():
        raise HTTPException(status_code=404, detail="Session not found")

    # 2. 提取用户消息内容
    user_content = ""
    if request.messages:
        last_msg = request.messages[-1]
        content = last_msg.content

        if isinstance(content, str):
            user_content = content
        elif isinstance(content, list):
            # 处理复杂的content结构
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    user_content = item.get("text", "")
                    break

    if not user_content:
        raise HTTPException(status_code=400, detail="No user message found")

    # 3. 根据是否流式处理选择不同的响应方式
    if request.stream:
        # 流式响应
        async def generate_stream():
            try:
                # 保存消息（在流式处理完成前）
                save_message(session_id, "user", user_content)
                # 获取流式生成器
                stream_generator = await claude_agent_sdk.process_message(
                    user_content, session_id, stream=True
                )

                # 流式输出响应
                async for chunk in stream_generator:
                    yield chunk

                # 注意：流式模式下，assistant消息会在客户端接收完整内容后保存

            except Exception as e:
                # 流式错误处理
                error_chunk = {
                    "id": f"chatcmpl-{int(datetime.now().timestamp())}",
                    "object": "chat.completion.chunk",
                    "created": int(datetime.now().timestamp()),
                    "model": request.model,
                    "choices": [
                        {
                            "index": 0,
                            "delta": {"content": f"流式处理出错: {str(e)}"},
                            "finish_reason": None,
                        }
                    ],
                    "session_id": session_id,
                }
                yield f"data: {json.dumps(error_chunk, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"

        return StreamingResponse(
            generate_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/plain; charset=utf-8",
            },
        )

    else:
        # 保存消息
        save_message(session_id, "user", user_content)
        # 非流式响应（原有逻辑）
        result = await claude_agent_sdk.process_message(
            user_content, session_id, stream=False
        )

        save_message(
            session_id, "assistant", result["content"], result.get("tool_calls", [])
        )

        # 构建响应
        return ChatResponse(
            id=f"chatcmpl-{int(datetime.now().timestamp())}",
            created=int(datetime.now().timestamp()),
            model=request.model,
            choices=[
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": result["content"],
                        "tool_calls": result.get("tool_calls", []),
                    },
                    "finish_reason": "stop",
                }
            ],
            usage={
                "prompt_tokens": len(user_content),
                "completion_tokens": len(result["content"]),
                "total_tokens": len(user_content) + len(result["content"]),
            },
            session_id=session_id,
        )


@app.get("/v1/sessions/{session_id}")
async def get_session(session_id: str):
    """获取会话信息"""
    session_path = get_session_path(session_id)
    if not session_path.exists():
        raise HTTPException(status_code=404, detail="Session not found")

    context_file = session_path / "context.json"
    if context_file.exists():
        with open(context_file, "r", encoding="utf-8") as f:
            context = json.load(f)
        return context

    return {"session_id": session_id, "messages": []}


@app.post("/v1/sessions/{session_id}/resume")
async def resume_session(session_id: str, request: Dict[str, Any]):
    """恢复会话 - 支持使用Claude会话ID恢复"""
    try:
        # 验证会话存在
        session_path = get_session_path(session_id)
        if not session_path.exists():
            raise HTTPException(status_code=404, detail="Session not found")

        # 获取Claude会话ID（如果提供）
        claude_session_id = request.get("claude_session_id")
        if claude_session_id:
            # 保存Claude会话ID
            claude_agent_sdk.claude_session_ids[session_id] = claude_session_id
            update_claude_session_in_context(session_id, claude_session_id)
            print(f"🔄 恢复会话: {session_id} 使用Claude会话ID: {claude_session_id}")

        return {
            "session_id": session_id,
            "resumed": True,
            "claude_session_id": claude_session_id,
            "message": "会话恢复成功",
        }

    except Exception as e:
        print(f"❌ 恢复会话错误: {str(e)}")
        raise HTTPException(status_code=500, detail=f"恢复会话失败: {str(e)}")


@app.get("/v1/sessions/{session_id}/claude-session")
async def get_claude_session_id(session_id: str):
    """获取会话对应的Claude会话ID"""
    try:
        # 验证会话存在
        session_path = get_session_path(session_id)
        if not session_path.exists():
            raise HTTPException(status_code=404, detail="Session not found")

        claude_session_id = load_claude_session_id(session_id)
        if claude_session_id:
            claude_agent_sdk.claude_session_ids[session_id] = claude_session_id

        return {
            "session_id": session_id,
            "claude_session_id": claude_session_id,
            "exists": claude_session_id is not None,
        }

    except Exception as e:
        print(f"❌ 获取Claude会话ID错误: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取Claude会话ID失败: {str(e)}")


@app.get("/")
async def root():
    return {"message": "Podcast Server - Port 3001", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy", "port": 3001}


# @app.post("/api/podcast/generate")
# async def generate_podcast(request: PodcastGenerateRequest):
#     """生成播客方案接口"""
#     try:
#         print(f"🎙️ 收到播客生成请求")

#         # 生成唯一的播客方案ID
#         podcast_id = f"plan-{uuid.uuid4().hex[:8]}"
#         created_at = int(datetime.now().timestamp())

#         # 构建上下文信息
#         context_info = _build_podcast_context(request)


#         print(f"✅ 播客方案生成成功: {podcast_plan.title}")
#         return podcast_plan

#     except Exception as e:
#         print(f"❌ 播客生成失败: {str(e)}")
#         import traceback

#         traceback.print_exc()
#         raise HTTPException(status_code=500, detail=f"播客生成失败: {str(e)}")


def _build_podcast_context(request: PodcastGenerateRequest) -> str:
    """构建播客生成的上下文信息"""
    context_parts = []

    # 添加用户提示词
    context_parts.append(f"用户需求: {request.prompt}")

    # 添加语音片段信息
    if request.voice_clips:
        context_parts.append("\n语音片段内容:")
        for i, clip in enumerate(request.voice_clips, 1):
            context_parts.append(f"片段{i}: {clip.transcript}")

    # 添加对话会话信息
    if request.chat_sessions:
        context_parts.append("\n对话历史:")
        for session in request.chat_sessions:
            context_parts.append(f"\n【{session.title}】")
            for msg in session.messages:
                context_parts.append(f"{msg.role}: {msg.content}")

    return "\n".join(context_parts)


async def _generate_podcast_with_claude(
    prompt: str,
    context_info: str,
    podcast_id: str,
    created_at: int,
    our_session_id: str,
) -> PodcastPlan:
    """使用Claude Agent SDK生成播客方案"""

    # 创建临时会话用于播客生成
    work_dir = get_session_path(session_id=our_session_id)
    # TODO


if __name__ == "__main__":
    import uvicorn

    print("🚀 Starting Podcast Server on port 3001...")
    uvicorn.run(app, host="0.0.0.0", port=3001, log_level="info")
