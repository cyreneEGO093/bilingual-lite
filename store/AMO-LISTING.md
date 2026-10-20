# AMO listing draft — copy fields separately

## Name

双语轻译 · Bilingual Lite

## Summary

用户自备 API Key，按需翻译网页段落和漫画气泡。支持滚动／整页、双语／仅译文、图片框选和自定义术语。

## Description

这是一个自用项目，完全由 GPT-6 Astra 以 vibe coding 方式开发。不对可靠性、准确性、安全性、兼容性或后续维护作任何保证，也不承诺更新、修复或回复反馈。测试记录不构成质量保证，请自行评估使用风险。

双语轻译是一款轻量网页与漫画翻译扩展。无需安装本地 OCR 或 Python，使用您自己配置的 OpenAI 兼容 API 服务。

- 网页阅读：滚动到可见段落时翻译，也可分批翻译当前已加载的整页内容。可切换双语或仅译文；异常批次保留原文，支持单独重试；X 优先提取帖文正文，减少元数据混入。
- 选中文本：桌面选中网页文字后右键翻译，在独立结果窗查看原文与译文；不必开启整页翻译。
- 图片与漫画：桌面支持右键翻译单张图片、一键分批翻译整页已加载图片，并可停止后续任务。桌面悬停、手机长按图片打开整图／框选工具。译文覆盖层可移动、缩放，背景透明度和默认大小可调整；手机通过“校准位置”显示框外调整工具，阅读时隐藏手柄。可通过“清空译文”删除当前图片的整图／框选结果与缓存。
- 浮动工具可拖动、收起并调整大小；所有状态都不自动避让网页内容或在输入时自动收起，仅保留屏幕边界限制。
- 自定义提示词：分别设置网页、整图和框选翻译要求，支持恢复默认。必要的 JSON 返回格式由程序保留。
- 专有名词：填写作品背景和自定义术语，帮助保持角色、技能和职业译名一致。
- 默认文本／图片模型为 DeepSeek 4.1 Flash；可选择其他服务支持的模型。模型识别、翻译和定位可能出错，框选与手动校准可辅助修正。

费用与数据：扩展本身不收取费用。您需要自行配置 API 地址、API Key 和模型；第三方服务可能需要付费账户，并按用量收费。启用翻译后，待译文字／图片、您填写的背景、术语及对应自定义提示词会发送至所配置的服务，API Key 用于该服务认证。配置保存在本机，不通过扩展同步。无遥测或广告。请阅读随扩展提供的隐私说明和服务提供者的政策。

浏览器内部页面和扩展商店等受保护页面不能翻译。支持桌面 Firefox 与 Firefox Android，不在隐私浏览窗口运行；不支持 iOS Firefox。Android 适配已在模拟器验收，实体手机尚未验证。部分需要登录、重定向或禁止下载的图片仍可能无法处理。

本扩展以 GPL-3.0-only 发布，第三方运行时保留 MIT 许可。

项目主页：https://github.com/cyreneEGO093/bilingual-lite

本版本完整源码：https://github.com/cyreneEGO093/bilingual-lite/releases/download/v0.6.2/bilingual-lite-0.6.2-source.zip

## Other submission fields

- License: GNU General Public License v3.0 (version 3 only).
- Platform: desktop Firefox and Firefox for Android; verify Android compatibility derived from the manifest's `gecko_android` declaration.
- Icon: `assets/icon-512.png` or `public/icons/128.png` (upload separately).
- Privacy policy: copy the complete `PRIVACY.md` text into AMO's privacy-policy field.
- Source attachment: `bilingual-lite-0.6.2-source.zip`; build/review instructions: `BUILDING.md`.
- Homepage: https://github.com/cyreneEGO093/bilingual-lite
- Support: https://github.com/cyreneEGO093/bilingual-lite/issues (no response or maintenance commitment).
- Payment disclosure: API service may require a paid account; the extension is free.

## Reviewer notes for 0.6.2

This updates the existing add-on and retains its Gecko ID, permissions and Android compatibility. It changes webpage text extraction to prefer X-style `data-testid="tweetText"` bodies over entire tweet cards, excluding author/date/action metadata. It handles short replies, newly hydrated bodies, reused DOM nodes and removed translation siblings. Removed translations are restored from completed local results without new inference; responses for changed sources are ignored.

For a Chinese target only, a conservative check rejects exact copies of sufficiently long Japanese/Korean prose instead of displaying and caching them as successful translations. Failures use the existing manual-retry workflow; this does not automatically retry or add API calls and is not comprehensive language detection. User model selections and custom prompts are retained.

The image toolbar adds “清空译文” (discard translations), separate from the existing hide/restore toggle. It deletes the current image's full/crop overlays, edited positions and matching in-page result cache; other images' displayed results remain. Late results for that image are ignored and its pending entry in the current image batch is skipped. Clearing makes no API request. Translating again may incur charges, and already-sent requests may still complete. It cannot delete provider-side records. Model output remains text-only. No new dependencies, telemetry or remote executable code.

Attach `bilingual-lite-0.6.2-source.zip`. With Node.js 24 and npm 11, extract into an empty directory and run:

```text
npm ci
npm test
npm run build
npm run lint:firefox
npm run zip
```

Firefox output: `dist/firefox-mv3/` and `dist/bilingual-lite-0.6.2-firefox.zip`. Compare extracted files rather than ZIP timestamps. See `BUILDING.md` and `store/REPRODUCIBILITY.json`.

Account-free review: run `node scripts/reviewer-server.mjs`, configure API Endpoint `http://127.0.0.1:8787/v1` with an empty API Key, and open `http://127.0.0.1:8787/social`. Test scrolling/whole-page and bilingual/translated-only modes on the synthetic posts. On `/manga`, translate the image, select a crop, click “清空译文”, then translate again. “清除遮罩／恢复遮罩” retains its temporary-hide behavior. `/batch` covers whole-page images. All responses are synthetic; no paid account or bundled API key is required.

Validation: 116 automated tests, Chrome 153 and Firefox 155 extension regressions, and zero Mozilla lint errors/warnings/notices. New tests cover body-only requests, dynamic updates, removed translations, clearing full/crop results, late-response invalidation and new inference after clearing. The real X account/page was not used. Separately, the actual text client completed two live requests to the configured default model using synthetic Korean/Japanese text, with default and synthetic custom prompts. Both reported zero reasoning tokens; total API-reported cost was $0.000220584. See `store/LIVE-TEXT-CHECK.json`; no credentials or private samples are included. These limited tests do not guarantee all content or X layouts. Android's last full emulator validation remains v0.6.0 (Firefox Android 157 / Android 14); this update was not rerun on Android. Source and installation packages were rebuilt independently and compared byte-for-byte.
