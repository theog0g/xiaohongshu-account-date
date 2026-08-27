# 小红书账号创建日期 + 笔记排序

一个用于增强小红书用户主页的小工具。

目前支持：

* **Web：Tampermonkey 用户脚本**

  * 根据 User ID 推算账号创建日期
  * 对用户主页已经浏览过的笔记按点赞数排序
* **iOS：Quantumult X Rewrite 脚本**

  * 根据 User ID 推算账号创建日期

账号创建日期根据小红书 User ID 前 8 位包含的时间戳信息推算，仅显示年月日。

> 注意：该日期由 User ID 推算得到，并非小红书官方提供的注册时间字段。

---

## 功能预览

### 账号创建日期

原本显示：

```text
小红书号：27765779615 | IP属地：安徽
```

启用脚本后：

```text
小红书号：27765779615  创建于 2022-08-24 | IP属地：安徽
```

Web 版本中，将鼠标悬停在创建日期上，还可以看到对应的 User ID，以及“根据用户 ID 推算”的提示。

### 笔记点赞排序

Tampermonkey 版本会在用户主页的：

```text
笔记   收藏
```

附近增加：

```text
喜欢
```

按钮。

第一次点击：

```text
喜欢 ↓
```

按照点赞数从高到低排序。

再次点击：

```text
喜欢 ↑
```

按照点赞数从低到高排序。

排序只针对当前浏览过程中已经加载过的笔记。

---

## 支持平台

### Web

* 小红书网页版
* Tampermonkey
* Chromium 系浏览器
* Chrome / Edge 等兼容 Tampermonkey 的浏览器

### iOS

* 小红书 App
* Quantumult X
* 需要开启 Rewrite
* 需要开启 MITM
* 需要正确安装并信任 Quantumult X CA 证书

---

## 快速安装

### Tampermonkey

先安装 Tampermonkey，然后打开下面的脚本：

[安装 / 查看 Tampermonkey 脚本](https://raw.githubusercontent.com/theog0g/xiaohongshu-account-date/main/tampermonkey/xiaohongshu-account-date.user.js)

脚本安装完成后，打开任意小红书网页版用户主页即可使用。

### Quantumult X

将下面的远程 Rewrite 地址添加到 Quantumult X：

```text
https://raw.githubusercontent.com/theog0g/xiaohongshu-account-date/main/quantumultx/xiaohongshu-account-date.conf
```

Quantumult X 版本目前只提供账号创建日期功能，不包含网页版的笔记排序功能。

---

## 项目结构

```text
xiaohongshu-account-date/
├── tampermonkey/
│   └── xiaohongshu-account-date.user.js
├── quantumultx/
│   ├── xiaohongshu-account-date.conf
│   └── xiaohongshu-account-date.js
├── README.md
└── .gitignore
```

---

## 功能

### Tampermonkey

#### 账号创建日期

* 自动识别小红书用户主页
* 从 `/user/profile/<userId>` 中提取用户 ID
* 根据用户 ID 前 8 位解析时间戳
* 使用 `Asia/Shanghai` 时区
* 仅显示年月日
* 支持小红书网页版 SPA 页面切换
* 切换不同博主主页时自动刷新日期
* 过滤明显异常的日期
* 鼠标悬停可查看 User ID 和推算说明

#### 笔记排序

* 支持按照笔记点赞数排序
* 支持点赞数从高到低排序
* 支持点赞数从低到高排序
* 保持瀑布流形式展示排序结果
* 支持用户主页动态加载的笔记
* 支持小红书网页版虚拟滚动机制
* 点击排序后的笔记仍使用小红书原生详情弹窗
* 打开和关闭笔记详情后保留排序状态

支持解析的点赞数格式包括：

```text
143
1,234
1.2万
2万+
1.5亿
```

#### 数据范围

排序功能只处理：

```text
用户当前浏览过程中已经加载过的笔记
```

脚本不会：

* 自动翻页
* 自动滚动加载全部笔记
* 主动调用额外的小红书 API
* 请求未浏览过的笔记数据
* 将数据发送到第三方服务器

因此，如果一个账号有 100 篇笔记，而你只浏览并加载了其中 30 篇：

```text
排序范围 = 已加载的这 30 篇
```

---

### Quantumult X

* 拦截小红书 App 用户主页资料接口
* 从接口返回数据中读取 `userid`
* 根据 `userid` 前 8 位解析账号创建日期
* 修改本地响应内容
* 将创建日期显示在用户主页
* 不主动请求额外接口
* 不向第三方服务器发送接口数据
* 不上传 Cookie、Token 或账号数据

Quantumult X 版本目前不提供笔记排序功能。

---

## 账号创建日期原理

小红书部分用户 ID 为 24 位十六进制字符串，例如：

```text
6a8aaa97000000000301d1a3
```

取前 8 位：

```text
6a8aaa97
```

然后将其按照十六进制转换为 Unix Timestamp，再转换为日期。

核心逻辑：

```javascript
const timestamp = parseInt(
    userId.slice(0, 8),
    16
);

const date = new Date(
    timestamp * 1000
);
```

例如：

```text
User ID

6a8aaa97000000000301d1a3

↓

取前 8 位

6a8aaa97

↓

Hexadecimal → Unix Timestamp

↓

转换日期
```

Web 和 Quantumult X 版本使用相同的日期解析方式。

主要区别在于 User ID 的获取方式。

### Web

从用户主页 URL 中读取：

```text
https://www.xiaohongshu.com/user/profile/<userId>
```

### Quantumult X

从小红书用户资料接口响应中的：

```json
{
  "data": {
    "userid": "59921a2e50c4b40676883f67"
  }
}
```

读取：

```text
data.userid
```

---

## Web 版账号创建日期工作方式

Tampermonkey 脚本读取当前页面 URL：

```text
https://www.xiaohongshu.com/user/profile/<userId>
```

从中提取 24 位 User ID。

完成日期计算后，通过修改页面 DOM，将创建日期插入“小红书号”附近。

由于小红书网页版采用 SPA 页面结构，脚本还会监听：

* URL 变化
* 页面 DOM 变化

因此从一个博主主页切换到另一个博主主页时，无需刷新整个网页。

---

## Web 版笔记排序工作方式

### 1. 收集已浏览笔记

用户正常浏览主页时，脚本监听页面中已经加载的：

```text
section.note-item
```

并在浏览器本地记录每篇笔记的：

* Note ID
* 点赞数
* 笔记卡片显示数据
* 笔记出现时的大致滚动位置

不会主动请求额外数据。

---

### 2. 本地排序

点击：

```text
喜欢
```

以后，脚本会根据已经收集的数据在浏览器本地排序。

```text
喜欢 ↓
```

代表：

```text
点赞数从高到低
```

```text
喜欢 ↑
```

代表：

```text
点赞数从低到高
```

排序不会修改小红书服务器上的任何数据。

---

### 3. 虚拟滚动

小红书网页版用户主页使用虚拟滚动机制。

随着页面不断向下滚动，已经离开较远位置的笔记 DOM 可能被删除，后续滚回对应位置时再重新生成。

因此：

```text
页面曾经加载过某篇笔记
```

并不意味着：

```text
这篇笔记的 DOM 会一直保留在页面中
```

脚本会记录已经浏览过的笔记数据，以支持对这些笔记进行本地排序。

---

### 4. 打开排序后的笔记

排序界面中的卡片主要负责显示排序结果。

当用户点击排序后的笔记时，脚本不会直接访问：

```text
/explore/<noteId>
```

也不会自己构造笔记详情 URL。

脚本会：

```text
点击排序卡片
↓
根据记录定位到笔记之前出现的位置
↓
恢复小红书原始笔记列表
↓
等待小红书虚拟列表重新生成真实笔记卡片
↓
根据 Note ID 找到真实卡片
↓
触发小红书自己的点击逻辑
↓
打开原生笔记详情弹窗
```

这样可以尽量保持小红书网页版原本的 SPA 和 Modal 行为。

---

## 为什么只排序已经浏览过的笔记

本项目目前采用低侵入方式实现排序。

不会：

* 自动翻页
* 自动模拟无限滚动
* 批量请求笔记接口
* 抓取账号全部笔记数据

这样可以减少：

* 对小红书接口的额外请求
* 对网页内部接口的依赖
* 因接口变化导致脚本失效的风险

如果希望排序更多笔记，可以先正常向下浏览主页，让更多笔记被页面加载，再点击排序按钮。

---

## 日期准确性说明

本项目显示的日期来自 User ID 中包含的时间戳信息。

它不代表小红书官方提供的：

```text
账号注册时间
```

也无法保证：

* 所有账号
* 所有历史时期
* 所有类型的 User ID

都遵循相同规则。

因此，更准确的描述是：

> 根据小红书 User ID 推算的账号创建时间。

脚本会检查 User ID 格式，并过滤明显异常的日期。

如果 User ID：

```text
不是 24 位十六进制字符串
```

或者解析得到明显异常的年份，脚本将不会显示创建日期。

---

## 兼容性

### Tampermonkey

主要针对：

* 小红书网页版
* Tampermonkey
* Chromium 系浏览器

网页版功能依赖小红书当前的：

* 用户主页 DOM
* 笔记卡片 DOM
* SPA 页面行为
* 虚拟滚动机制
* 原生笔记点击行为

如果小红书修改相关结构，以下功能可能需要同步调整：

* 创建日期插入位置
* 点赞数读取
* 排序按钮位置
* 笔记卡片识别
* 排序视图
* 笔记详情打开逻辑

### Quantumult X

主要针对：

* iOS
* Quantumult X
* 小红书 App

如果小红书修改：

* API 地址
* JSON 数据结构
* User ID 字段
* 用户主页 UI 数据来源

Quantumult X 版本可能需要同步更新。

---

## 隐私

### Web 版

Tampermonkey 脚本仅在浏览器本地运行。

脚本不会：

* 上传浏览记录
* 上传笔记数据
* 收集小红书登录信息
* 上传小红书账号信息
* 向第三方服务器发送数据
* 主动调用额外的小红书数据接口

笔记排序所使用的数据只存在于当前网页运行环境中。

刷新页面后，需要重新浏览笔记才能重新收集排序数据。

### Quantumult X 版

Quantumult X 脚本会在设备本地处理经过 MITM 解密的小红书接口响应。

脚本不会：

* 上传 Cookie
* 上传 Token
* 上传请求头
* 上传用户资料
* 将接口响应发送到第三方服务器
* 主动请求额外的数据接口

脚本只修改匹配到的响应内容。

---

## 注意事项

### 关于笔记排序

排序结果取决于当前浏览过程中已经成功收集到的笔记。

例如：

```text
账号总笔记：100 篇
当前已浏览：40 篇
```

那么排序范围最多为：

```text
40 篇
```

继续向下浏览后，脚本会继续收集新加载的笔记。

### 关于网页更新

小红书网页版属于动态更新的 SPA 应用。

页面 DOM、虚拟列表、CSS 和内部交互逻辑可能随时变化，因此无法保证脚本永久兼容。

### 关于 Quantumult X

Quantumult X 版本需要 MITM。

使用者应了解 HTTPS 解密和本地代理的基本工作方式。

请仅在自己的设备和账号环境中使用。

---

## License

建议使用 MIT License。

如果仓库已经添加 `LICENSE` 文件，则项目的使用、修改和分发方式以该文件中的许可条款为准。
