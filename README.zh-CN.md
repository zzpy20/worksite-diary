# 工地日记 Worksite Diary

[English](./README.md)

一个用于记录每日工地情况的简单 iOS App —— 作为云端作品集项目的实践之作，涵盖移动端开发、Postgres 后端，以及配套的网页管理后台。

## 功能特性

- 首次启动时会有一个简短的新手引导，介绍应用的主要功能
- 邮箱 + 密码登录（Supabase Auth），每个用户只能看到自己的记录
- 记录每日条目：工地名称（自动联想最近使用过的工地）、日期、上下班时间（原生选择器）、备注、任务（预设选项快速勾选或自由填写），以及工地的 GPS 定位——自动反查为易读的具体地址
- 从相册选择照片，或直接用相机拍摄；点击照片可全屏查看，支持双指缩放或双击放大，滑动可瞬间切换到上一张/下一张
- 一键复制条目，快速新建一条预填了工地、任务、备注的记录
- 保存后可随时编辑或删除条目
- 可在列表视图和照片网格视图之间切换浏览，支持按工地或任务搜索，还可通过顶部的日历选择器直接跳转到指定日期
- 工时统计——按本周或本月汇总总工时，并按工地拆分明细
- 支持离线使用：在没有网络（或网络太差以至于无法真正完成上传）的情况下新建、编辑或删除条目会先保存在本地队列中，联网后自动同步，同步完成前会显示待同步标记
- 将某条记录导出为 A4 尺寸的 PDF，并通过 iOS 原生分享菜单分享给任何人
- 独立的网页管理后台，可查看和编辑所有用户的记录

## 这些功能背后的考虑

其中几个功能是专门针对工地实际使用场景来做优先级排序的，而不只是常规的增删改查打磨：

- **工地名称自动联想** —— 同一个班组往往会在同一个工地连续工作好几天甚至几周，每天都重新打一遍工地名称是可以省掉的麻烦。
- **一键复制条目** —— "和昨天同一个工地"是很常见的情况。用上一条记录预填新条目可以省去重复输入；日期、时间、照片会留空，因为这些是每天都不一样的信息。
- **工时统计** —— 按工地、按周汇总工时，本质上就是一份工时报表，而这些数据每条记录本来就已经在记录了——只是缺一个汇总和展示的页面。
- **离线优先的写入** —— 工地经常信号不好甚至完全没有信号。如果没有这个功能，没网络时保存条目会直接失败。把写入操作先存在本地、联网后自动同步，是直接针对这个实际使用场景做的处理，而不只是当作一个边缘情况顺带处理。

## 技术栈

- [React Native](https://reactnative.dev/) + [Expo](https://expo.dev/)（SDK 54）+ TypeScript
- [Expo Router](https://docs.expo.dev/router/introduction/) 实现基于文件的路由导航
- [Supabase](https://supabase.com/)（Postgres + Auth + Storage）作为后端 —— 客户端直接访问，通过行级安全策略（RLS）保护数据
- 离线优先的写入机制：本地队列（[`@react-native-async-storage/async-storage`](https://react-native-async-storage.github.io/async-storage/)），联网后通过 [`@react-native-community/netinfo`](https://github.com/react-native-netinfo/react-native-netinfo) 自动同步
- [EAS Build](https://docs.expo.dev/build/introduction/) 用于编译和签名 iOS 安装包

## 项目结构

```
src/
  app/            expo-router 页面（登录、标签页、条目详情/编辑、工时统计）
  components/     共用 UI 组件（条目表单、图片查看器、主题化基础组件）
  lib/            Supabase 客户端、数据访问、离线同步队列、PDF 导出、格式化工具
  types/          共用 TypeScript 类型定义
supabase/         SQL 迁移脚本，需在 Supabase SQL Editor 中按顺序执行
```

## 快速开始

1. `npm install`
2. 创建一个 [Supabase](https://supabase.com/) 项目
3. 在 Supabase 的 SQL Editor 中，**按顺序**运行 `supabase/` 目录下的文件：`schema.sql`、`002_admin_panel.sql`、`003_comments_and_location.sql`、`004_address.sql`
4. 将 `.env.local.example` 复制为 `.env.local`，填入你的 Supabase 项目 URL 和 anon/publishable key（在 Project Settings → API 中获取）
5. 运行 `npx expo start`，用 Expo Go 打开；或运行 `npx expo run:ios` 在已连接的设备上进行独立构建

## 离线支持

新建、编辑、删除条目在没有网络时也能正常使用。改动会先保存在本地队列中——新建的条目会当场生成好本地 ID，同步后无需再做任何 ID 对应处理——联网后会自动同步到 Supabase；尚未同步的条目会在列表、网格和详情页显示一个小的待同步标记。

这里仅覆盖“写入”场景：浏览记录首次加载时仍需要网络连接，本应用不会缓存已加载过的数据以支持完全离线浏览。对一条已同步条目做的离线编辑会被安全地放入队列，但在同步完成前，该条目自己的详情页不会显示这次修改；只有全新的离线新建条目会完全基于本地数据正常显示。

保存时不会仅凭上传调用没有报错就认为照片已经传成功——之后还会向存储服务确认一遍，因为在网络不稳定时，上传请求有可能在文件并未完整传输的情况下依然"正常返回"。如果这项确认失败，保存会自动回退到同一套离线队列机制，而不是直接报错失败——这样一条记录只会因为真的离线而进入排队等待同步，不会因为网络不稳定就丢失。

## 管理后台

一个轻量的静态网页应用（纯 HTML/CSS/JS，无需构建步骤），允许在 `profiles` 表中被标记为 `is_admin` 的账号登录后台，管理所有用户的记录——支持搜索、行内编辑、删除照片、删除条目。它直接访问同一个 Supabase 项目，权限完全通过行级安全策略（RLS）控制（见 `supabase/002_admin_panel.sql`），因此不需要额外的后端服务器。

已部署在 [worksite-diary.plos.xyz](https://worksite-diary.plos.xyz)，托管于 Cloudflare Worker。它的源码不属于本仓库——本仓库只包含授权它访问数据所需的 RLS 策略。
