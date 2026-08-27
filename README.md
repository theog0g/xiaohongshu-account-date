# 小红书账号创建日期

一个用于推算并显示小红书账号创建日期的小工具，目前支持：

* Web：Tampermonkey 用户脚本
* iOS：Quantumult X Rewrite 脚本

脚本根据小红书用户 ID 前 8 位所包含的时间戳信息推算账号创建日期，仅显示年月日。

> 注意：该日期由用户 ID 推算得到，并非小红书官方提供的注册时间字段。

## 效果

原本显示：

```text
小红书号：27765779615 | IP属地：安徽
```

启用脚本后：

```text
小红书号：27765779615  创建于 2022-08-24 | IP属地：安徽
```

Web 版本中，将鼠标悬停在创建日期上，还可以看到对应 User ID 以及“根据用户 ID 推算”的提示。

## 支持平台

### Web

* 小红书网页版
* Tampermonkey
* Chromium 系浏览器

### iOS

* 小红书 App
* Quantumult X
* 需要开启 Rewrite
* 需要开启 MITM 并正确安装、信任 Quantumult X CA 证书

## 项目结构

```text
xiaohongshu-account-date/
├── xiaohongshu-account-date.user.js
├── quantumultx/
│   ├── xiaohongshu-account-date.conf
│   └── xiaohongshu-account-date.js
├── README.md
└── .gitignore
```

## 功能

### Tampermonkey

* 自动识别小红书用户主页
* 从 `/user/profile/<userId>` 中提取用户 ID
* 根据用户 ID 前 8 位解析时间戳
* 仅显示年月日
* 使用 `Asia/Shanghai` 时区
* 支持小红书网页版 SPA 页面切换
* 切换不同博主主页时自动刷新日期
* 过滤明显异常的日期
* 不请求额外接口
* 不上传或收集用户数据

### Quantumult X

* 拦截小红书 App 用户主页资料接口
* 从接口返回数据中读取 `userid`
* 根据 `userid` 前 8 位解析账号创建日期
* 修改本地响应内容，使创建日期显示在用户主页
* 不向第三方服务器发送接口数据
* 不上传 Cookie、Token 或账号数据

## 原理

小红书部分用户 ID 为 24 位十六进制字符串，例如：

```text
6a8aaa97000000000301d1a3
```

取前 8 位：

```text
6a8aaa97
```

将其按照十六进制转换为 Unix 时间戳，再转换为日期。

核心逻辑：

```javascript
const timestamp = parseInt(userId.slice(0, 8), 16);
const date = new Date(timestamp * 1000);
```

例如：

```text
User ID
6a8aaa97000000000301d1a3

↓ 取前 8 位

6a8aaa97

↓ Unix Timestamp

↓ 转换日期

2026-08-23
```

项目中的 Web 和 Quantumult X 版本使用相同的时间解析思路，区别主要在于获取 User ID 和修改页面显示的方式。

## Web 版安装

### 1. 安装 Tampermonkey

首先安装 Tampermonkey 浏览器扩展。

### 2. 导入脚本

打开 Tampermonkey 管理面板并新建脚本，将：

```text
xiaohongshu-account-date.user.js
```

中的代码复制进去并保存。

也可以使用仓库中的 `.user.js` 文件进行安装。

### 3. 打开小红书网页版

访问任意用户主页，例如：

```text
https://www.xiaohongshu.com/user/profile/xxxxxxxxxxxxxxxxxxxxxxxx
```

如果该用户 ID 可以正常解析，脚本会自动显示推算出的创建日期。

## Web 版工作方式

网页版脚本读取当前页面 URL：

```text
https://www.xiaohongshu.com/user/profile/<userId>
```

从中提取 24 位 User ID。

完成日期计算后，通过修改页面 DOM，将创建日期插入小红书号附近。

由于小红书网页版采用 SPA 页面结构，脚本还会监听 URL 和页面内容变化，因此从一个博主主页切换到另一个博主主页时，无需刷新页面。

## Quantumult X 安装

Quantumult X 版本由两个文件组成：

```text
quantumultx/
├── xiaohongshu-account-date.conf
└── xiaohongshu-account-date.js
```

其中：

```text
xiaohongshu-account-date.conf
```

负责定义：

* Rewrite 匹配规则
* JavaScript 脚本地址
* MITM Hostname

而：

```text
xiaohongshu-account-date.js
```

负责实际处理小红书接口返回的数据。

### 1. 配置 MITM

Quantumult X 版本需要开启 MITM，并正确安装和信任 Quantumult X CA 证书。

脚本需要解密：

```text
edith.xiaohongshu.com
```

的 HTTPS 流量。

### 2. 添加远程 Rewrite

使用仓库中的：

```text
quantumultx/xiaohongshu-account-date.conf
```

作为 Quantumult X Rewrite 远程资源。

配置文件会自动引用对应的 JavaScript 脚本。

### 3. 打开小红书 App

完全关闭小红书 App 后重新打开。

进入任意博主个人主页，如果接口和当前脚本兼容，即可看到根据 User ID 推算出的创建日期。

## Quantumult X 工作方式

小红书 App 在进入用户主页时会请求用户资料接口，例如：

```text
https://edith.xiaohongshu.com/api/sns/v3/user/info
```

接口返回的数据中包含：

```json
{
  "data": {
    "userid": "59921a2e50c4b40676883f67",
    "red_id": "954106650",
    "location": "浙江"
  }
}
```

Quantumult X 使用 `script-response-body` 在响应交给小红书 App 之前执行 JavaScript。

脚本读取：

```text
data.userid
```

计算创建日期，然后修改本地 JSON 响应，使日期能够显示在个人主页。

整个修改过程发生在设备本地。

## 日期准确性说明

本项目显示的日期来自用户 ID 中的时间戳信息。

它不代表小红书官方提供的：

```text
账号注册时间
```

也无法保证所有账号、所有历史时期以及所有类型的 User ID 都遵循相同规则。

因此，更准确的描述是：

> 根据小红书 User ID 推算的账号创建时间。

脚本会检查 User ID 格式，并过滤明显异常的日期。

如果 User ID 不符合预期：

```text
非 24 位十六进制字符串
```

或者解析得到明显异常的时间，脚本将不会显示日期。

## 兼容性

### Tampermonkey

主要针对：

* 小红书网页版
* Tampermonkey
* Chromium 系浏览器

小红书如果修改网页版 DOM 结构，日期插入逻辑可能需要调整。

### Quantumult X

主要针对：

* iOS
* Quantumult X
* 小红书 App

小红书如果修改：

* API 地址
* JSON 数据结构
* User ID 字段
* 个人主页 UI 数据来源

Quantumult X 版本可能需要同步更新。

## 隐私

### Web 版

Tampermonkey 脚本仅在浏览器本地运行。

不会：

* 上传浏览记录
* 收集小红书账号信息
* 向第三方服务器发送数据
* 调用额外的小红书接口

### Quantumult X 版

Quantumult X 脚本会在设备本地处理经过 MITM 解密的小红书接口响应。

脚本不会：

* 上传 Cookie
* 上传 Token
* 上传请求头
* 上传用户资料
* 将接口响应发送到第三方服务器
* 主动请求额外的数据接口

脚本仅修改匹配到的响应内容。

## 注意事项

Quantumult X 版本需要 MITM，因此使用者应了解 HTTPS 解密和本地代理的基本工作方式。

请仅在自己的设备和账号环境中使用。

小红书 App、API 和网页结构均可能随版本更新发生变化，本项目无法保证永久兼容。

## License

建议使用 MIT License。

如果仓库已经添加 `LICENSE` 文件，则项目的使用、修改和分发方式以该文件中的许可条款为准。