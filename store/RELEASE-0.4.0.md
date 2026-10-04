# 双语轻译 · Bilingual Lite v0.4.0

加入 Firefox Android 触屏适配，修复浮动翻译控件遮挡网页输入区和发送按钮的问题。

- 翻译控件可拖动、收起，尽量避让输入区及附近固定控件；聚焦页面输入框时自动收起。
- 手机默认显示圆形“译”入口，软键盘弹出和横竖屏切换时跟随可见区域重新定位。
- 长按图片约半秒打开工具栏，再点击整图／框选翻译；滑动和多指操作取消未触发的长按。
- 设置页面适应窄屏，图片工具按钮与译文框手柄适合触屏操作。
- 兼容 Android 不提供的快捷键和右键菜单 API，避免后台初始化中断。

验证：95 项自动测试；桌面 Chrome 153 / Firefox 155 与 Android 14 模拟器 / Firefox 157 的实际扩展交互测试通过。Android 使用原生触摸与真实软键盘，验证长按、整图／框选、移动／缩放、横屏和输入／发送操作。尚未在实体手机验收。所有交互测试使用本地模拟 API，付费模型开销为零。Mozilla 检查为 0 errors / 0 warnings / 0 notices。

运行时依赖、权限及 API 计费行为不变。浮动位置仅保留在当前页面；特殊网站布局仍可能需要手动拖动。

- `bilingual-lite-0.4.0-firefox.zip`：Firefox 商店提交／开发调试包，未签名，桌面与 Android 共用。
- `bilingual-lite-0.4.0-chrome.zip`：Chrome / Chromium 包。
- `bilingual-lite-0.4.0-source.zip`：对应完整源码、锁文件、测试与构建说明，审核时单独上传。
- `bilingual-lite-0.4.0-SHA256.txt`：以上附件校验值。

在现有 AMO 项目提交更新，保留扩展 ID，并核对本版本的 Android 兼容性（安装包已声明）。手机普通安装需等待签名且启用 Android 的商店版本；GitHub ZIP 不能直接作为普通手机安装包。日常安装：[Firefox 商店](https://addons.mozilla.org/zh-CN/firefox/addon/bilingual-lite/)。GitHub 发布不代表商店已更新。

本项目为自用项目，完全由 GPT-6 Astra 以 vibe coding 方式开发，不保证可靠性或后续维护。许可：GPL-3.0-only。项目与使用说明：https://github.com/cyreneEGO093/bilingual-lite
