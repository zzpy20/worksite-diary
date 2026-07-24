# 工地日记 Worksite Diary

[English](./README.md)

一个用于记录每日工地情况的简单 iOS App —— 作为云端作品集项目的实践之作，涵盖移动端开发、Postgres 后端，以及配套的网页管理后台。

## 功能特性

- 邮箱 + 密码登录（Supabase Auth），每个用户只能看到自己的记录
- 记录每日条目：工地名称、日期、上下班时间（原生选择器）、备注、任务（预设选项快速勾选或自由填写），以及工地的 GPS 定位——自动反查为易读的具体地址
- 从相册选择照片，或直接用相机拍摄；点击照片可全屏查看，支持双指缩放或双击放大，并可左右滑动切换
- 保存后可随时编辑或删除条目
- 将某条记录导出为 A4 尺寸的 PDF，并通过 iOS 原生分享菜单分享给任何人
- 独立的网页管理后台，可查看和编辑所有用户的记录

## 技术栈

- [React Native](https://reactnative.dev/) + [Expo](https://expo.dev/)（SDK 54）+ TypeScript
- [Expo Router](https://docs.expo.dev/router/introduction/) 实现基于文件的路由导航
- [Supabase](https://supabase.com/)（Postgres + Auth + Storage）作为后端 —— 客户端直接访问，通过行级安全策略（RLS）保护数据
- [EAS Build](https://docs.expo.dev/build/introduction/) 用于编译和签名 iOS 安装包

## 项目结构

```
src/
  app/            expo-router 页面（登录、标签页、条目详情/编辑）
  components/     共用 UI 组件（条目表单、图片查看器、主题化基础组件）
  lib/            Supabase 客户端、数据访问、PDF 导出、格式化工具
  types/          共用 TypeScript 类型定义
supabase/         SQL 迁移脚本，需在 Supabase SQL Editor 中按顺序执行
```

## 快速开始

1. `npm install`
2. 创建一个 [Supabase](https://supabase.com/) 项目
3. 在 Supabase 的 SQL Editor 中，**按顺序**运行 `supabase/` 目录下的文件：`schema.sql`、`002_admin_panel.sql`、`003_comments_and_location.sql`、`004_address.sql`
4. 将 `.env.local.example` 复制为 `.env.local`，填入你的 Supabase 项目 URL 和 anon/publishable key（在 Project Settings → API 中获取）
5. 运行 `npx expo start`，用 Expo Go 打开；或运行 `npx expo run:ios` 在已连接的设备上进行独立构建

## 管理后台

一个轻量的静态网页应用（纯 HTML/CSS/JS，无需构建步骤），允许在 `profiles` 表中被标记为 `is_admin` 的账号登录后台，管理所有用户的记录——支持搜索、行内编辑、删除照片、删除条目。它直接访问同一个 Supabase 项目，权限完全通过行级安全策略（RLS）控制（见 `supabase/002_admin_panel.sql`），因此不需要额外的后端服务器。

已部署在 [worksite-diary.plos.xyz](https://worksite-diary.plos.xyz)，托管于 Cloudflare Worker。它的源码不属于本仓库——本仓库只包含授权它访问数据所需的 RLS 策略。
