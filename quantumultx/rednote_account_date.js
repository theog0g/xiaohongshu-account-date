/******************************

脚本名称：小红书账号创建日期
脚本功能：根据小红书用户 ID 推算账号创建日期，并显示在用户主页
适用软件：Quantumult X
脚本版本：1.0.0
脚本作者：theog0g
项目地址：https://github.com/theog0g/xiaohongshu-account-date
更新时间：2026-08-26

说明：
账号创建日期根据用户 ID 中的时间戳信息推算，
并非小红书官方提供的注册时间字段，
不保证所有账号均符合该规则。

*******************************/


const body = JSON.parse($response.body);

function getCreatedDate(userId) {
    if (!/^[0-9a-f]{24}$/i.test(userId)) {
        return null;
    }

    const timestamp = parseInt(userId.slice(0, 8), 16);
    const date = new Date(timestamp * 1000);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const parts = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);

    const values = {};

    for (const part of parts) {
        values[part.type] = part.value;
    }

    return `${values.year}-${values.month}-${values.day}`;
}

if (body?.data?.userid) {
    const createdDate = getCreatedDate(body.data.userid);

    if (createdDate) {
        // 英文界面通常使用 ip_location
        if (body.data.ip_location) {
            body.data.ip_location =
                `${body.data.ip_location}  ·  创建于 ${createdDate}`;
        }

        // 中文界面可能使用 location
        if (body.data.location) {
            body.data.location =
                `${body.data.location}  ·  创建于 ${createdDate}`;
        }
    }
}

$done({
    body: JSON.stringify(body)
});
