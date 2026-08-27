// ==UserScript==
// @name         小红书账号创建日期 + 笔记排序
// @namespace    xiaohongshu-account-date
// @version      1.1.2
// @description  显示小红书账号创建日期，并支持对已浏览笔记按点赞数排序
// @author       theog0g
// @match        https://www.xiaohongshu.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*
 * 笔记排序说明：
 *
 * 排序功能仅处理当前页面已经加载并被脚本收集到的笔记。
 *
 * 小红书网页版使用虚拟滚动和图片懒加载机制。
 * 为避免干扰页面原生加载、图片显示和笔记详情交互，
 * 脚本不会自动滚动页面或主动加载全部笔记。
 *
 * 如需排序更多笔记，请刷新页面后正常向下浏览，
 * 等待需要的笔记和图片完成加载，再点击“喜欢”进行排序。
 */

(function () {
    'use strict';

    const DATE_MARKER_CLASS = 'xhs-account-created-date';
    const SORT_CONTROL_ID = 'xhs-note-sort-control';
    const SORT_VIEW_ID = 'xhs-note-sort-view';

    const noteStore = new Map();

    let sortDirection = null;
    let originalFeedContainer = null;
    let currentProfileId = null;
    let currentTabContainer = null;
    let openingNoteId = null;

    function getUserId() {
        const match = location.pathname.match(
            /\/user\/profile\/([0-9a-f]{24})(?:\/|$)/i
        );

        return match ? match[1] : null;
    }

    function getCreatedDate(userId) {
        if (!/^[0-9a-f]{24}$/i.test(userId)) {
            return null;
        }

        const timestamp = parseInt(
            userId.slice(0, 8),
            16
        );

        if (!Number.isFinite(timestamp)) {
            return null;
        }

        const date = new Date(
            timestamp * 1000
        );

        if (Number.isNaN(date.getTime())) {
            return null;
        }

        const parts =
            new Intl.DateTimeFormat(
                'zh-CN',
                {
                    timeZone: 'Asia/Shanghai',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }
            ).formatToParts(date);

        const values = {};

        for (const part of parts) {
            values[part.type] =
                part.value;
        }

        const year =
            Number(values.year);

        const currentYear =
            Number(
                new Intl.DateTimeFormat(
                    'zh-CN',
                    {
                        timeZone:
                            'Asia/Shanghai',
                        year: 'numeric'
                    }
                ).format(new Date())
            );

        if (
            year < 2013 ||
            year > currentYear + 1
        ) {
            return null;
        }

        return (
            `${values.year}-` +
            `${values.month}-` +
            `${values.day}`
        );
    }

    function findRedIdElement() {
        const elements =
            document.querySelectorAll(
                'span, div, p'
            );

        const matches = [];

        for (const element of elements) {
            const directText =
                Array.from(
                    element.childNodes
                )
                    .filter(
                        node =>
                            node.nodeType ===
                            Node.TEXT_NODE
                    )
                    .map(
                        node =>
                            node.textContent
                    )
                    .join('')
                    .trim();

            if (
                directText.includes(
                    '小红书号：'
                ) ||
                directText.includes(
                    '小红书号:'
                )
            ) {
                matches.push(element);
            }
        }

        if (!matches.length) {
            return null;
        }

        matches.sort(
            (a, b) =>
                a.childElementCount -
                b.childElementCount
        );

        return matches[0];
    }

    function injectCreatedDate() {
        const userId = getUserId();

        if (!userId) {
            return;
        }

        const createdDate =
            getCreatedDate(userId);

        if (!createdDate) {
            return;
        }

        const existing =
            document.querySelector(
                `.${DATE_MARKER_CLASS}` +
                `[data-user-id="${userId}"]`
            );

        if (existing) {
            return;
        }

        document
            .querySelectorAll(
                `.${DATE_MARKER_CLASS}`
            )
            .forEach(
                element =>
                    element.remove()
            );

        const redIdElement =
            findRedIdElement();

        if (!redIdElement) {
            return;
        }

        const dateElement =
            document.createElement(
                'span'
            );

        dateElement.className =
            DATE_MARKER_CLASS;

        dateElement.dataset.userId =
            userId;

        dateElement.textContent =
            `创建于 ${createdDate}`;

        dateElement.title =
            '根据用户 ID 推算的创建时间\n' +
            `User ID: ${userId}`;

        dateElement.style.cssText = `
            display: inline-block;
            margin: 0 6px;
            white-space: nowrap;
            font-size: inherit;
            color: inherit;
        `;

        if (
            redIdElement.tagName ===
            'SPAN' ||
            redIdElement.tagName ===
            'P'
        ) {
            redIdElement
                .insertAdjacentElement(
                    'afterend',
                    dateElement
                );
        } else {
            redIdElement.appendChild(
                dateElement
            );
        }
    }

    function parseCount(text) {
        const value =
            String(text ?? '')
                .trim()
                .replace(/,/g, '');

        if (!value) {
            return 0;
        }

        const match = value.match(
            /([\d.]+)\s*(万|亿)?/
        );

        if (!match) {
            return 0;
        }

        const number =
            Number(match[1]);

        if (!Number.isFinite(number)) {
            return 0;
        }

        if (match[2] === '万') {
            return Math.round(
                number * 10000
            );
        }

        if (match[2] === '亿') {
            return Math.round(
                number * 100000000
            );
        }

        return Math.round(number);
    }

    function getNoteId(noteElement) {
        const dataNoteId =
            noteElement?.dataset?.noteId;

        if (
            dataNoteId &&
            /^[0-9a-f]{24}$/i.test(
                dataNoteId
            )
        ) {
            return dataNoteId;
        }

        const links =
            noteElement.querySelectorAll(
                'a[href]'
            );

        for (const item of links) {
            const href =
                item.getAttribute('href');

            if (!href) {
                continue;
            }

            const matches = [
                href.match(
                    /(?:explore\/|discovery\/item\/)([0-9a-f]{24})/i
                ),
                href.match(
                    /\/user\/profile\/[0-9a-f]{24}\/([0-9a-f]{24})/i
                )
            ];

            for (const match of matches) {
                if (match) {
                    return match[1];
                }
            }
        }

        return null;
    }

    function getLikeCount(noteElement) {
        const selectors = [
            '.like-wrapper .count',
            '.like-wrapper span.count',
            'span.count'
        ];

        for (
            const selector
            of selectors
        ) {
            const element =
                noteElement.querySelector(
                    selector
                );

            if (!element) {
                continue;
            }

            const text =
                element.textContent
                    ?.trim();

            if (text) {
                return parseCount(
                    text
                );
            }
        }

        return 0;
    }

    function getNoteScrollTarget(
        noteElement,
        previous
    ) {
        const rect =
            noteElement
                .getBoundingClientRect();

        if (
            rect.width > 0 &&
            rect.height > 0 &&
            Number.isFinite(rect.top)
        ) {
            return Math.max(
                0,
                Math.round(
                    window.scrollY +
                    rect.top -
                    120
                )
            );
        }

        return previous?.scrollY ??
            Math.max(
                0,
                Math.round(window.scrollY)
            );
    }

    function collectVisibleNotes() {
        if (!getUserId()) {
            return;
        }

        const noteElements =
            document.querySelectorAll(
                'section.note-item'
            );

        for (
            const noteElement
            of noteElements
        ) {
            if (
                noteElement.closest(
                    `#${SORT_VIEW_ID}`
                )
            ) {
                continue;
            }

            const noteId =
                getNoteId(
                    noteElement
                );

            if (!noteId) {
                continue;
            }

            const likes =
                getLikeCount(
                    noteElement
                );

            const rect =
                noteElement
                    .getBoundingClientRect();

            const previous =
                noteStore.get(noteId);

            const clone =
                noteElement.cloneNode(
                    true
                );

            noteStore.set(
                noteId,
                {
                    id: noteId,

                    likes,

                    element: clone,

                    scrollY:
                        getNoteScrollTarget(
                            noteElement,
                            previous
                        ),

                    width:
                        rect.width ||
                        previous?.width ||
                        240,

                    height:
                        rect.height ||
                        previous?.height ||
                        320
                }
            );
        }

        updateSortButtonTitle();
    }

    function findFeedContainer() {
        const firstNote =
            document.querySelector(
                'section.note-item'
            );

        if (!firstNote) {
            return null;
        }

        let current =
            firstNote.parentElement;

        let fallback =
            firstNote.parentElement;

        while (
            current &&
            current !==
            document.body
        ) {
            const count =
                current
                    .querySelectorAll(
                        'section.note-item'
                    )
                    .length;

            if (count >= 4) {
                return current;
            }

            if (count >= 2) {
                fallback =
                    current;
            }

            current =
                current.parentElement;
        }

        return fallback;
    }

    function findTabContainer() {
        const elements =
            document.querySelectorAll(
                'span, div, button'
            );

        const candidates = [];

        for (const element of elements) {
            if (
                element.offsetParent === null
            ) {
                continue;
            }

            const text =
                element.textContent
                    ?.trim();

            if (text !== '收藏') {
                continue;
            }

            candidates.push(element);
        }

        for (const element of candidates) {
            let parent =
                element.parentElement;

            for (
                let depth = 0;
                depth < 5 && parent;
                depth++
            ) {
                const text =
                    parent.innerText
                        ?.replace(
                            /\s+/g,
                            ''
                        );

                if (
                    text?.includes('笔记') &&
                    text?.includes('收藏')
                ) {
                    return element;
                }

                parent =
                    parent.parentElement;
            }
        }

        return candidates[0] ?? null;
    }

    function injectSortControl() {
        if (!getUserId()) {
            return;
        }

        currentTabContainer =
            findTabContainer();

        if (!currentTabContainer) {
            return;
        }

        let button =
            document.getElementById(
                SORT_CONTROL_ID
            );

        if (!button) {
            button =
                document.createElement(
                    'button'
                );

            button.id =
                SORT_CONTROL_ID;

            button.textContent =
                '喜欢';

            document.body.appendChild(
                button
            );

            button.style.cssText = `
                position: fixed;
                z-index: 9999;

                appearance: none;
                border: none;

                background:
                    rgba(255, 255, 255, 0.96);

                color: #333;

                font-size: 15px;
                line-height: 20px;

                cursor: pointer;

                padding: 7px 12px;

                border-radius: 16px;

                white-space: nowrap;

                box-shadow:
                    0 1px 4px
                    rgba(0, 0, 0, 0.08);

                transition:
                    background-color
                    0.15s ease,
                    opacity
                    0.15s ease;
            `;

            button.addEventListener(
                'mouseenter',
                () => {
                    button.style
                        .backgroundColor =
                        '#f5f5f5';
                }
            );

            button.addEventListener(
                'mouseleave',
                () => {
                    button.style
                        .backgroundColor =
                        'rgba(255,255,255,0.96)';
                }
            );

            button.addEventListener(
                'click',
                handleSortButtonClick
            );
        }

        positionSortControl();

        updateSortButton();
    }

    function positionSortControl() {
        const button =
            document.getElementById(
                SORT_CONTROL_ID
            );

        if (
            !button ||
            !currentTabContainer
        ) {
            return;
        }

        if (isNoteDetailPath()) {
            button.style.visibility =
                'hidden';

            return;
        }

        const rect =
            currentTabContainer
                .getBoundingClientRect();

        if (
            rect.bottom < 0 ||
            rect.top >
            window.innerHeight
        ) {
            button.style
                .visibility =
                'hidden';

            return;
        }

        button.style.visibility =
            'visible';

        const left =
            Math.min(
                rect.right + 16,
                window.innerWidth -
                100
            );

        const top =
            rect.top +
            rect.height / 2;

        button.style.left =
            `${left}px`;

        button.style.top =
            `${top}px`;

        button.style.transform =
            'translateY(-50%)';
    }

    function updateSortButtonTitle() {
        const button =
            document.getElementById(
                SORT_CONTROL_ID
            );

        if (!button) {
            return;
        }

        button.title =
            `按点赞数排序，目前已收集 ${noteStore.size} 篇笔记`;
    }

    function updateSortButton() {
        const button =
            document.getElementById(
                SORT_CONTROL_ID
            );

        if (!button) {
            return;
        }

        if (
            sortDirection === 'desc'
        ) {
            button.textContent =
                '喜欢 ↓';
        } else if (
            sortDirection === 'asc'
        ) {
            button.textContent =
                '喜欢 ↑';
        } else {
            button.textContent =
                '喜欢';
        }

        updateSortButtonTitle();
    }

    function sortNotes(
        notes,
        direction
    ) {
        const multiplier =
            direction === 'asc'
                ? 1
                : -1;

        return notes
            .map(
                (note, index) => ({
                    note,
                    index
                })
            )
            .sort(
                (a, b) => {
                    const delta =
                        multiplier *
                        (
                            a.note.likes -
                            b.note.likes
                        );

                    return (
                        delta ||
                        a.index -
                        b.index
                    );
                }
            )
            .map(
                item => item.note
            );
    }

    function handleSortButtonClick() {
        collectVisibleNotes();

        if (!noteStore.size) {
            alert(
                '还没有收集到可以排序的笔记。'
            );

            return;
        }

        if (
            sortDirection === null ||
            sortDirection === 'asc'
        ) {
            sortDirection =
                'desc';
        } else {
            sortDirection =
                'asc';
        }

        updateSortButton();

        renderSortedNotes();
    }

    function findLiveNoteById(noteId) {
        if (!originalFeedContainer) {
            return null;
        }

        const direct =
            originalFeedContainer
                .querySelector(
                    `section.note-item[data-note-id="${noteId}"]`
                );

        if (
            direct?.isConnected &&
            !direct.closest(
                `#${SORT_VIEW_ID}`
            )
        ) {
            return direct;
        }

        const notes =
            originalFeedContainer
                .querySelectorAll(
                    'section.note-item'
                );

        for (const noteElement of notes) {
            if (
                noteElement.isConnected &&
                getNoteId(noteElement) ===
                noteId
            ) {
                return noteElement;
            }
        }

        return null;
    }

    function waitForLiveNote(
        noteId,
        timeout = 900
    ) {
        return new Promise(resolve => {
            const startedAt =
                Date.now();

            const check = () => {
                const liveNote =
                    findLiveNoteById(
                        noteId
                    );

                if (liveNote) {
                    resolve(liveNote);
                    return;
                }

                if (
                    Date.now() -
                    startedAt >=
                    timeout
                ) {
                    resolve(null);
                    return;
                }

                setTimeout(
                    check,
                    80
                );
            };

            check();
        });
    }

    async function findRemountedNote(
        note
    ) {
        const baseScrollY =
            Number.isFinite(note.scrollY)
                ? note.scrollY
                : 0;

        const offsets = [
            0,
            -600,
            600,
            -1200,
            1200,
            -1800,
            1800,
            -2400,
            2400
        ];

        for (const offset of offsets) {
            window.scrollTo(
                0,
                Math.max(
                    0,
                    baseScrollY + offset
                )
            );

            const liveNote =
                await waitForLiveNote(
                    note.id,
                    offset === 0
                        ? 1200
                        : 650
                );

            if (liveNote) {
                return liveNote;
            }
        }

        return null;
    }

    function waitForNoteModal(
        noteId,
        timeout = 1800
    ) {
        return new Promise(resolve => {
            const startedAt =
                Date.now();

            const check = () => {
                if (
                    location.pathname.includes(
                        noteId
                    )
                ) {
                    resolve(true);
                    return;
                }

                if (
                    Date.now() -
                    startedAt >=
                    timeout
                ) {
                    resolve(false);
                    return;
                }

                setTimeout(
                    check,
                    60
                );
            };

            check();
        });
    }

    function restoreSortedView(
        sortView,
        scrollY
    ) {
        if (
            originalFeedContainer &&
            sortView
        ) {
            originalFeedContainer
                .style.display =
                'none';

            sortView.style.display =
                'flex';
        }

        requestAnimationFrame(() => {
            window.scrollTo(
                0,
                scrollY
            );
        });
    }

    async function openSortedNote(note) {
        if (
            openingNoteId ||
            !note?.id
        ) {
            return;
        }

        const sortView =
            document.getElementById(
                SORT_VIEW_ID
            );

        if (
            !sortView ||
            !originalFeedContainer
        ) {
            return;
        }

        const sortedScrollY =
            window.scrollY;

        openingNoteId =
            note.id;

        sortView.style.display =
            'none';

        originalFeedContainer
            .style.display =
            '';

        try {
            const liveNote =
                await findRemountedNote(
                    note
                );

            if (!liveNote) {
                throw new Error(
                    `无法重新加载笔记 ${note.id}`
                );
            }

            const cover =
                liveNote.querySelector(
                    'a.cover'
                ) ||
                liveNote.querySelector(
                    'a.title'
                );

            if (!cover) {
                throw new Error(
                    `找不到笔记点击入口 ${note.id}`
                );
            }

            cover.click();

            const opened =
                await waitForNoteModal(
                    note.id
                );

            if (!opened) {
                throw new Error(
                    `笔记详情未打开 ${note.id}`
                );
            }

            restoreSortedView(
                sortView,
                sortedScrollY
            );

        } catch (error) {
            restoreSortedView(
                sortView,
                sortedScrollY
            );

            console.warn(
                '[XHS Sort] 打开排序笔记失败',
                error
            );

            alert(
                '未能重新加载这篇笔记。' +
                '请回到主页继续滚动后再试。'
            );
        } finally {
            openingNoteId =
                null;
        }
    }

    function getColumnCount(
        containerWidth
    ) {
        if (
            containerWidth >= 1200
        ) {
            return 5;
        }

        if (
            containerWidth >= 950
        ) {
            return 4;
        }

        if (
            containerWidth >= 700
        ) {
            return 3;
        }

        return 2;
    }

    function chooseShortestColumn(
        heights
    ) {
        if (!heights.length) {
            return -1;
        }

        let minIndex = 0;

        for (
            let i = 1;
            i < heights.length;
            i++
        ) {
            if (
                heights[i] <
                heights[minIndex]
            ) {
                minIndex = i;
            }
        }

        return minIndex;
    }

    function prepareSortedCard(
        note
    ) {
        const card =
            note.element.cloneNode(
                true
            );

        card.style.setProperty(
            'position',
            'relative',
            'important'
        );

        card.style.setProperty(
            'transform',
            'none',
            'important'
        );

        card.style.setProperty(
            'left',
            'auto',
            'important'
        );

        card.style.setProperty(
            'right',
            'auto',
            'important'
        );

        card.style.setProperty(
            'top',
            'auto',
            'important'
        );

        card.style.setProperty(
            'bottom',
            'auto',
            'important'
        );

        card.style.setProperty(
            'width',
            '100%',
            'important'
        );

        card.style.setProperty(
            'max-width',
            'none',
            'important'
        );

        card.style.setProperty(
            'margin',
            '0',
            'important'
        );

        card.addEventListener(
            'click',
            event => {
                const interactive =
                    event.target
                        .closest?.(
                            'button, input, textarea, .like-wrapper'
                        );

                if (interactive) {
                    return;
                }

                const anchor =
                    event.target
                        .closest?.(
                            'a[href]'
                        );

                if (
                    anchor &&
                    !anchor
                        .getAttribute('href')
                        ?.includes(note.id)
                ) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                openSortedNote(note);
            },
            true
        );

        card.title =
            `点赞：${note.likes}`;

        return card;
    }

    function renderSortedNotes() {
        let sortView =
            document.getElementById(
                SORT_VIEW_ID
            );

        if (!originalFeedContainer) {
            originalFeedContainer =
                findFeedContainer();
        }

        if (!originalFeedContainer) {
            console.warn(
                '[XHS Sort] 找不到笔记容器'
            );

            return;
        }

        originalFeedContainer
            .style.display =
            'none';

        if (!sortView) {
            sortView =
                document.createElement(
                    'div'
                );

            sortView.id =
                SORT_VIEW_ID;

            sortView.style.cssText = `
                width: 100%;
                box-sizing: border-box;
                display: flex;
                gap: 16px;
                align-items: flex-start;
                padding: 16px 0 40px;
            `;

            originalFeedContainer
                .insertAdjacentElement(
                    'afterend',
                    sortView
                );
        }

        sortView.innerHTML = '';

        const sorted =
            sortNotes(
                Array.from(
                    noteStore.values()
                ),
                sortDirection
            );

        const containerWidth =
            originalFeedContainer
                .getBoundingClientRect()
                .width ||
            sortView
                .getBoundingClientRect()
                .width ||
            1200;

        const columnCount =
            getColumnCount(
                containerWidth
            );

        const columns = [];

        const heights =
            new Array(
                columnCount
            ).fill(0);

        for (
            let i = 0;
            i < columnCount;
            i++
        ) {
            const column =
                document.createElement(
                    'div'
                );

            column.style.cssText = `
                flex: 1 1 0;
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 16px;
            `;

            columns.push(column);

            sortView.appendChild(
                column
            );
        }

        for (const note of sorted) {
            const columnIndex =
                chooseShortestColumn(
                    heights
                );

            const card =
                prepareSortedCard(
                    note
                );

            columns[
                columnIndex
            ].appendChild(card);

            heights[
                columnIndex
            ] +=
                note.height + 16;
        }
    }

    function resetForNewProfile() {
        noteStore.clear();

        sortDirection = null;

        openingNoteId = null;

        if (
            originalFeedContainer
        ) {
            originalFeedContainer
                .style.display =
                '';
        }

        originalFeedContainer =
            null;

        currentTabContainer =
            null;

        document
            .getElementById(
                SORT_VIEW_ID
            )
            ?.remove();

        document
            .getElementById(
                SORT_CONTROL_ID
            )
            ?.remove();
    }

    function isNoteDetailPath() {
        return (
            /\/explore\/[0-9a-f]{24}/i
                .test(location.pathname) ||
            /\/discovery\/item\/[0-9a-f]{24}/i
                .test(location.pathname)
        );
    }

    function handleProfileChange() {
        const userId =
            getUserId();

        if (userId) {
            if (
                userId ===
                currentProfileId
            ) {
                return;
            }

            resetForNewProfile();

            currentProfileId =
                userId;

            return;
        }

        if (
            isNoteDetailPath() &&
            currentProfileId
        ) {
            return;
        }

        if (
            currentProfileId !== null
        ) {
            resetForNewProfile();

            currentProfileId =
                null;
        }
    }

    let timer = null;

    function scheduleEnhancements() {
        clearTimeout(timer);

        timer =
            setTimeout(
                () => {
                    handleProfileChange();

                    collectVisibleNotes();

                    injectCreatedDate();

                    injectSortControl();

                    positionSortControl();
                },
                150
            );
    }

    currentProfileId =
        getUserId();

    collectVisibleNotes();

    scheduleEnhancements();

    const observer =
        new MutationObserver(
            () => {
                if (
                    !document
                        .getElementById(
                            SORT_VIEW_ID
                        )
                ) {
                    collectVisibleNotes();
                }

                scheduleEnhancements();
            }
        );

    observer.observe(
        document.documentElement,
        {
            childList: true,
            subtree: true
        }
    );

    let lastUrl =
        location.href;

    setInterval(
        () => {
            if (
                location.href !==
                lastUrl
            ) {
                lastUrl =
                    location.href;

                handleProfileChange();

                scheduleEnhancements();
            }
        },
        500
    );

    let positionFrame = null;

    function schedulePositionUpdate() {
        if (positionFrame) {
            return;
        }

        positionFrame =
            requestAnimationFrame(
                () => {
                    positionFrame =
                        null;

                    positionSortControl();
                }
            );
    }

    window.addEventListener(
        'scroll',
        schedulePositionUpdate,
        {
            passive: true
        }
    );

    window.addEventListener(
        'resize',
        () => {
            schedulePositionUpdate();

            if (
                document
                    .getElementById(
                        SORT_VIEW_ID
                    )
            ) {
                renderSortedNotes();
            }
        }
    );

})();
