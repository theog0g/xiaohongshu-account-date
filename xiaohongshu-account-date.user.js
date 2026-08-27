// ==UserScript==
// @name         小红书账号创建日期
// @namespace    xiaohongshu-account-date
// @version      1.0.0
// @description  根据小红书用户 ID 推算账号创建日期，并显示在用户主页
// @author       theog0g
// @match        https://www.xiaohongshu.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const MARKER_CLASS = 'xhs-account-created-date';

    /**
     * 从当前 URL 获取用户 ID
     *
     * 示例：
     * /user/profile/6a8aaa97000000000301d1a3
     */
    function getUserId() {
        const match = location.pathname.match(
            /\/user\/profile\/([0-9a-f]{24})(?:\/|$)/i
        );

        return match ? match[1] : null;
    }

    /**
     * 根据用户 ID 前 8 位解析时间
     */
    function getCreatedDate(userId) {
    if (!/^[0-9a-f]{24}$/i.test(userId)) {
        return null;
    }

    const timestamp = parseInt(userId.slice(0, 8), 16);

    if (!Number.isFinite(timestamp)) {
        return null;
    }

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

    // 过滤明显异常的日期
    const year = Number(values.year);

    const currentYear = Number(
        new Intl.DateTimeFormat('zh-CN', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric'
        }).format(new Date())
    );

    if (year < 2013 || year > currentYear + 1) {
        return null;
    }

    return `${values.year}-${values.month}-${values.day}`;
    }

    /**
     * 找到“小红书号”所在的最小 DOM 元素
     *
     * 不依赖小红书的 class 名，避免网站更新 CSS class 后马上失效。
     */
    function findRedIdElement() {
        const elements = document.querySelectorAll('span, div, p');

        const matches = [];

        for (const element of elements) {
            const directText = Array.from(element.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE)
                .map(node => node.textContent)
                .join('')
                .trim();

            if (
                directText.includes('小红书号：') ||
                directText.includes('小红书号:')
            ) {
                matches.push(element);
            }
        }

        if (!matches.length) {
            return null;
        }

        // 优先选择 DOM 层级最具体的节点
        matches.sort(
            (a, b) => a.childElementCount - b.childElementCount
        );

        return matches[0];
    }

    /**
     * 将创建日期插入页面
     */
    function injectCreatedDate() {
        const userId = getUserId();

        // 当前页面并非用户主页
        if (!userId) {
            return;
        }

        const createdDate = getCreatedDate(userId);

        if (!createdDate) {
            return;
        }

        // 防止重复插入
        const existing = document.querySelector(
            `.${MARKER_CLASS}[data-user-id="${userId}"]`
        );

        if (existing) {
            return;
        }

        // 删除上一个博主遗留的数据
        document
            .querySelectorAll(`.${MARKER_CLASS}`)
            .forEach(element => element.remove());

        const redIdElement = findRedIdElement();

        if (!redIdElement) {
            return;
        }

        const dateElement = document.createElement('span');

        dateElement.className = MARKER_CLASS;
        dateElement.dataset.userId = userId;

        dateElement.textContent = `创建于 ${createdDate}`;

        dateElement.title =
        `根据用户 ID 推算的创建时间\n` +
        `User ID: ${userId}`;

        dateElement.style.cssText = `
        display: inline-block;
        margin: 0 6px;
        white-space: nowrap;
        font-size: inherit;
        color: inherit;
        `;

        /*
         * 如果“小红书号”本身是 span，
         * 日期插入它后面。
         *
         * 如果它是整个 div，
         * 直接追加到 div 内，避免换行。
         */
        if (
            redIdElement.tagName === 'SPAN' ||
            redIdElement.tagName === 'P'
        ) {
            redIdElement.insertAdjacentElement(
                'afterend',
                dateElement
            );
        } else {
            redIdElement.appendChild(dateElement);
        }
    }

    /**
     * debounce
     *
     * 小红书页面 DOM 更新非常频繁，
     * MutationObserver 不能每次变化都立即执行完整查找。
     */
    let timer = null;

    function scheduleInject() {
        clearTimeout(timer);

        timer = setTimeout(() => {
            injectCreatedDate();
        }, 200);
    }

    // 首次执行
    scheduleInject();

    /*
     * 小红书是 SPA。
     * 从首页点击博主进入主页时通常不会完整刷新网页，
     * 因此需要监听 DOM 变化。
     */
    const observer = new MutationObserver(() => {
        scheduleInject();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    /*
     * 同时监控 URL。
     *
     * 解决：
     * 博主 A → 博主 B
     * 页面 DOM 尚未变化但 URL 已改变的情况。
     */
    let lastUrl = location.href;

    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            scheduleInject();
        }
    }, 500);
})();