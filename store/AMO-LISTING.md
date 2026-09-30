# AMO listing draft — copy fields separately

## Name

双语轻译 · Bilingual Lite

## Summary

自带 API Key，按需翻译网页段落和漫画气泡。支持滚动／整页、双语／仅译文、图片框选和自定义术语。

## Description

双语轻译是一款轻量网页与漫画翻译扩展。无需安装本地 OCR 或 Python，使用您自己配置的 OpenAI 兼容 API 服务。

- 网页阅读：滚动到可见段落时翻译，也可分批翻译当前已加载的整页内容。可切换双语或仅译文；异常批次保留原文，支持单独重试。
- 图片与漫画：悬停后点击全文翻译，或手动框选局部气泡。译文覆盖层可移动、缩放，背景透明度和默认大小可调整。
- 专有名词：填写作品背景和自定义术语，帮助保持角色、技能和职业译名一致。
- 默认文本／图片模型为 DeepSeek 4.1 Flash；可选择其他服务支持的模型。模型识别、翻译和定位可能出错，框选与手动校准可辅助修正。

费用与数据：扩展本身不收取费用。您需要自行配置 API 地址、API Key 和模型；第三方服务可能需要付费账户，并按用量收费。启用翻译后，待译文字／图片、您填写的背景与术语会发送至所配置的服务，API Key 用于该服务认证。配置保存在本机，不通过扩展同步。无遥测或广告。请阅读随扩展提供的隐私说明和服务提供者的政策。

浏览器内部页面和扩展商店等受保护页面不能翻译。当前版本面向桌面 Firefox，不在隐私浏览窗口运行。部分需要登录、重定向或禁止下载的图片仍可能无法处理。

本扩展以 GPL-3.0-only 发布，第三方运行时保留 MIT 许可。发布时请在本段后添加该版本完整源码的公开下载链接。

## Other submission fields

- License: GNU General Public License v3.0 (version 3 only).
- Platform: desktop Firefox.
- Icon: `assets/icon-512.png` or `public/icons/128.png` (upload separately).
- Privacy policy: copy the complete `PRIVACY.md` text into AMO's privacy-policy field.
- Source attachment: `bilingual-lite-0.3.0-source.zip`; build/review instructions: `BUILDING.md`.
- Public source/homepage/support: fill in your actual public repository or release URL after creating it; do not publish a placeholder or use the extension ID as a contact address.
- Payment disclosure: API service may require a paid account; the extension is free.

This file is not part of the installable extension ZIP.
