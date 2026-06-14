# 小红书世界杯防剧透 / XHS World Cup Spoiler Blocker

## 简介（中文）

这是一个适用于 **Edge / Chrome** 的浏览器扩展（Manifest V3），用于在小红书「2026
世界杯」相关页面上隐藏比分和比赛结果，让你在观看录像回放前不被剧透。

**功能：**

- **世界杯主页**：只保留赛程标题、全部比赛卡片以及左右切换 /「全部赛程」按钮，隐藏其余
  可能含有比分的新闻信息流；并把比赛卡片中已显示的比分（如 `1 : 1`）替换为 `? : ?`，
  未开赛的 `VS` 保持不变。
- **回放笔记页**：当作者为「世界杯高清回放」时，隐藏笔记标题、正文、评论，以及视频封面
  （封面在页面加载时也不会一闪而过），避免剧透。
- **一键开关**：点击工具栏图标弹出开关，可随时启用 / 关闭，立即生效、无需刷新（关闭后会
  立刻还原比分、标题与内容）。

**安装方法（加载解压缩的扩展）：**

1. 打开扩展管理页：Edge 访问 `edge://extensions`，Chrome 访问 `chrome://extensions`。
2. 打开「开发者模式」（Edge 在左下角，Chrome 在右上角）。
3. 点击「加载解压缩的扩展」，选择本项目文件夹 `xhs-worldcup-spoiler-blocker`。
4. 点击浏览器工具栏的拼图图标，将本扩展「固定」到工具栏。
5. 打开世界杯页面或回放笔记即可生效；点击扩展图标可随时开关防剧透功能。

> 提示：重新加载扩展后，请刷新已打开的小红书标签页，使新脚本生效。

---

A small Edge/Chrome (Manifest V3) extension that removes match scores and result
spoilers from Xiaohongshu's 2026 World Cup pages, so you can watch replays
without knowing the result in advance.

## What it does

### World Cup home page
`https://www.xiaohongshu.com/worldcup26`

- Keeps the schedule header
  (`.xhs-world-cup-home-section-header-schedule`), **all match cards**
  (`.xhs-match-card`) and the strip's nav / "all matches" buttons
  (`.xhs-match-nav-btn`, `.xhs-match-all-entry`) inside the home container
  (`.xhs-world-cup-home`) visible — they sit side by side — while hiding every
  surrounding news-feed block, which often shows results.
- In each match card, the score span (`.xhs-match-card-vs`) is rewritten:
  - `1 : 1`, `10 : 0`, etc. → `? : ?`
  - `VS` (not played yet) → left unchanged.

### Replay note page
`https://www.xiaohongshu.com/explore/<id>`

- Detects the official replay channel by reading the author name
  (`.username` === `世界杯高清回放`).
- When it matches, it hides:
  - the note title (`#detail-title`) and the browser tab title,
  - the note content (`.note-content`),
  - the comments (`.comments-container`),
  - and masks the video cover (`.xgplayer-poster`) with a neutral "封面已隐藏"
    placeholder. The mask is CSS applied at `document_start` (toggled by a class
    on `<html>`), so the original cover never paints — there is no spoiler flash
    before the script reacts.

If the author is anyone else, the page is left untouched.

## Enable / disable

Click the extension's toolbar icon to open a small popup with an on/off switch.
The choice is saved and applied **live** — turning it off instantly reveals the
scores, titles and content on the open page (no reload needed), and turning it
back on hides them again. Spoiler hiding is **on** by default.

## How it works

Xiaohongshu is a single-page app that renders and live-updates content with Vue
after navigation. The content script therefore runs an idempotent `update()`
re-triggered by a `MutationObserver` (with a 1s interval fallback), so it keeps
working across in-app navigation and live score updates. It runs at
`document_start` and toggles a single `display:none` class, so spoilers are
suppressed before the page paints in most cases.

The extension requests only the `storage` permission (to remember your on/off
choice), makes no network requests, and sends no data anywhere.

## Install (load unpacked)

### Microsoft Edge
1. Go to `edge://extensions`.
2. Turn on **Developer mode** (bottom-left).
3. Click **Load unpacked** and select this folder
   (`xhs-worldcup-spoiler-blocker`).

### Google Chrome
1. Go to `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this folder.

Then open the World Cup page or a replay note and the spoilers will be hidden.
To reveal results again, disable the extension from the extensions page.

## Customizing selectors

Xiaohongshu may change its markup over time. If something stops being hidden,
update the selectors near the top of [`content.js`](content.js):

| Purpose            | Selector                                         |
| ------------------ | ------------------------------------------------ |
| Home container     | `.xhs-world-cup-home`                            |
| Schedule to keep   | `.xhs-world-cup-home-section-header-schedule`    |
| Match cards/buttons to keep | `.xhs-match-card`, `.xhs-match-nav-btn`, `.xhs-match-all-entry` |
| Score span         | `.xhs-match-card-vs`                             |
| Replay author name | `.username` (text `世界杯高清回放`)              |
| Note title         | `#detail-title`                                  |
| Note content       | `.note-content`                                  |
| Comments           | `.comments-container`                            |
| Video cover poster | `.xgplayer-poster`                               |

The `data-v-*` attributes from the page are intentionally **not** used as
selectors because they are Vue build hashes that change between releases; class
names are far more stable.

## Files

- `manifest.json` – MV3 manifest, injects the script/styles on xiaohongshu.com.
- `content.js` – all spoiler-hiding logic.
- `styles.css` – the `.xhs-spoiler-hidden { display:none }` rule.
- `popup.html` / `popup.css` / `popup.js` – the toolbar on/off toggle.
- `icons/` – extension icons.
