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
from ultra_simple_server_paths import (
    create_session_context,
    get_session_path,
    load_chat_history,
    load_claude_session_id,
    save_message,
    update_claude_session_in_context,
)

# 添加虚拟环境路径
venv_path = os.path.join(
    os.path.dirname(__file__), "venv", "lib", "python3.11", "site-packages"
)
if os.path.exists(venv_path):
    sys.path.insert(0, venv_path)

from typing import List, Optional, Dict, Any, Union, AsyncGenerator
import json
import uuid
from datetime import datetime
from pathlib import Path
from ultra_simple_server_paths import (
    create_session_context,
    get_session_path,
    load_chat_history,
    load_claude_session_id,
    save_message,
    update_claude_session_in_context,
)


# Claude Agent SDK集成
class ClaudeAgentSDK:
    """Claude Agent SDK Python实现"""

    def __init__(self):
        self.work_dir = None
        self.claude_session_ids = (
            {}
        )  # 存储Claude会话ID映射：our_session_id -> claude_session_id

    def _extract_json_objects(self, text: str, content_to_clip_map: dict, user_clips: list):
        """
        从文本中提取完整的JSON对象，支持跨行JSON

        Args:
            text: 包含JSON的文本
            content_to_clip_map: 内容到clip的映射
            user_clips: 用户clip列表

        Yields:
            处理后的数据对象或非JSON文本
        """
        i = 0
        n = len(text)

        while i < n:
            # 跳过非JSON内容
            while i < n and text[i] != '{':
                # 收集非JSON文本直到换行或JSON开始
                start = i
                while i < n and text[i] != '{' and text[i] != '\n':
                    i += 1

                if start < i:
                    non_json_text = text[start:i].strip()
                    if non_json_text:
                        yield {"type": "ai", "text": non_json_text}

                if i < n and text[i] == '\n':
                    i += 1

            if i >= n:
                break

            # 提取JSON对象
            if text[i] == '{':
                brace_count = 0
                json_start = i
                in_string = False
                escape_next = False

                while i < n:
                    char = text[i]

                    if escape_next:
                        escape_next = False
                    elif char == '\\':
                        escape_next = True
                    elif char == '"':
                        in_string = not in_string
                    elif not in_string:
                        if char == '{':
                            brace_count += 1
                        elif char == '}':
                            brace_count -= 1
                            if brace_count == 0:
                                # 找到完整JSON对象
                                i += 1
                                json_str = text[json_start:i]

                                # 处理JSON对象
                                try:
                                    data_obj = json.loads(json_str)

                                    # 数据清洗和校验
                                    if data_obj.get("type") == "user":
                                        user_text = data_obj.get("text", "")

                                        # 确保用户片段有audio字段
                                        if "audio" not in data_obj:
                                            # 优先精确匹配
                                            if user_text in content_to_clip_map:
                                                data_obj["audio"] = content_to_clip_map[user_text]["clipId"]
                                            else:
                                                # 尝试模糊匹配（去除空格和换行）
                                                user_text_clean = user_text.replace(" ", "").replace("\n", "")
                                                for clip_content, clip_info in content_to_clip_map.items():
                                                    clip_content_clean = clip_content.replace(" ", "").replace("\n", "")
                                                    if user_text_clean == clip_content_clean:
                                                        data_obj["audio"] = clip_info["clipId"]
                                                        # 使用原始clip内容确保一致性
                                                        data_obj["text"] = clip_content
                                                        break
                                                else:
                                                    # 如果找不到匹配，使用第一个可用的clipId
                                                    if user_clips:
                                                        data_obj["audio"] = user_clips[0]["clipId"]

                                        # 最终验证：确保audio字段存在
                                        if "audio" not in data_obj and user_clips:
                                            data_obj["audio"] = user_clips[0]["clipId"]

                                    yield data_obj

                                except json.JSONDecodeError:
                                    # JSON解析失败，作为普通文本处理
                                    yield {"type": "ai", "text": json_str}

                                break

                    i += 1

                # 如果没找到闭合的}，可能是JSON不完整，停止处理
                if brace_count > 0:
                    break

    def _should_skip_line(self, line: str) -> bool:
        """判断是否应该跳过该行"""
        if not line.strip():
            return True
        # 跳过markdown标记和数组符号
        skip_prefixes = ["```", "```json", "[", "]"]
        return any(line.startswith(prefix) for prefix in skip_prefixes)

    async def process_formated_mp3_data(self, session_id: str, contexts: List[Dict[str, Any]]):
        """
        处理格式化的MP3数据，生成播客脚本

        Args:
            session_id: 会话ID
            contexts: 用户录音素材列表，格式：[{"role": "user", "content": "内容", "sequence_id": "seg-1"}]
        """
        try:
            # 设置工作目录
            work_dir = get_session_path(session_id)
            work_dir.mkdir(parents=True, exist_ok=True)

            # 数据预处理：提取用户素材并转换为所需格式
            user_clips = []
            content_to_clip_map = {}

            for ctx in contexts:
                if ctx.get("role") == "user" and ctx.get("content"):
                    content = ctx.get("content", "").strip()
                    sequence_id = ctx.get("sequence_id", "")

                    if content:
                        clip_data = {
                            "id": sequence_id,
                            "content": content,
                            "clipId": sequence_id
                        }
                        user_clips.append(clip_data)
                        content_to_clip_map[content] = clip_data

            if not user_clips:
                error_data = {
                    "type": "error",
                    "text": "没有找到有效的用户录音素材，无法生成播客脚本"
                }
                yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"
                return

            # 系统提示词
            SYSTEM_PROMPT = """使用podcast-editor skill

用户原声素材列表：
{{USER_CLIPS_JSON}}

IMPORTANT: 你必须严格按照JSON Lines格式输出播客脚本，不要添加任何解释性文字！
每行必须是一个完整的JSON对象，格式如下：

{"type": "ai", "text": "AI旁白内容"}
{"type": "user", "text": "用户原声完整内容", "audio": "对应的clipId"}

规则：
1. 不要输出任何markdown标记（如```json）
2. 不要输出任何解释性文字
3. 直接从第一个JSON对象开始输出
4. 每行一个完整的JSON对象
5. 确保所有user类型的条目都包含正确的audio字段
"""

            # 替换提示词中的素材占位符
            user_clips_json = json.dumps(user_clips, ensure_ascii=False, indent=2)
            system_prompt = SYSTEM_PROMPT.replace("{{USER_CLIPS_JSON}}", user_clips_json)

            # 导入claude-agent-sdk
            from claude_agent_sdk import query, ClaudeAgentOptions
            from claude_agent_sdk.types import (
                AssistantMessage,
                TextBlock,
                ResultMessage,
            )

            # 创建claude-agent-sdk选项
            options = ClaudeAgentOptions(
                system_prompt=system_prompt,
                setting_sources=["user", "project"],
                allowed_tools=["Skill", "Read", "Write", "Bash", "Grep", "Glob"],
                cwd=str(work_dir),
            )

            # 用于缓冲LLM输出的内容
            buffer = ""

            # 统一的流式处理函数
            def process_content(content: str):
                """统一处理内容，提取并输出JSON Lines"""
                nonlocal buffer
                buffer += content

                # 使用健壮的JSON对象提取
                for data_obj in self._extract_json_objects(buffer, content_to_clip_map, user_clips):
                    yield f"data: {json.dumps(data_obj, ensure_ascii=False)}\n\n"

                # 处理完后清空缓冲区
                buffer = ""

            # 流式处理LLM响应
            async for message in query(
                prompt="现在开始生成播客脚本。严格按照JSON Lines格式输出，每行一个JSON对象，不要任何解释文字。",
                options=options,
            ):
                print('msg:',message)
                if isinstance(message, ResultMessage):
                    content = message.result
                    if content:
                        for output in process_content(content):
                            yield output

                elif isinstance(message, AssistantMessage):
                    for block in message.content:
                        if isinstance(block, TextBlock):
                            content = block.text
                            if content:
                                for output in process_content(content):
                                    yield output

            # 处理缓冲区中剩余的内容
            if buffer.strip():
                data_obj = self._process_json_line(buffer.strip(), content_to_clip_map, user_clips)
                if data_obj:
                    yield f"data: {json.dumps(data_obj, ensure_ascii=False)}\n\n"
                elif buffer.strip():
                    # 无法解析的内容作为警告
                    warning_data = {
                        "type": "warning",
                        "text": f"生成内容中有部分无法解析: {buffer.strip()[:100]}..."
                    }
                    yield f"data: {json.dumps(warning_data, ensure_ascii=False)}\n\n"

            # 发送结束信号
            yield "data: [DONE]\n\n"

        except Exception as e:
            import traceback
            error_msg = f"处理播客脚本生成时出错: {str(e)}"
            print(f"❌ {error_msg}")
            print(traceback.format_exc())

            error_data = {
                "type": "error",
                "text": error_msg
            }
            yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        
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
                            yield """data: {"comfirm_generate": true}"""
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
claude_agent_sdk_instance = ClaudeAgentSDK()
