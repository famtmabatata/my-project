// core.js
import { loadAllDataFromSupabase, db, gradesConfig, subjectsList, subjectColors, addNotification, loadContacts, uploadAvatar, getAvatarUrl } from "./db.js";
import { showToast, showConfirm } from "./utils.js";
import { hashPassword, verifyPassword } from "./auth.js";
import { supabase } from "./supabase-config.js";
import { initScheduleModule } from "./schedule.js";
import { initGradesModule } from "./grades.js";
import { initChatModule } from "./chat.js";
import { initAdminModule } from "./admin.js";
import { enableRealtime } from "./realtime.js";

const app = {
    user: null,
    activeChat: null,
    pendingFiles: [],
    db,
    gradesConfig,
    subjectsList,
    subjectColors,
    showToast,
    showConfirm,

    async init() {
        this.hideSplashScreen();
        try {
            await loadAllDataFromSupabase();
        } catch (e) {
            showToast("تعذر تحميل البيانات من السحابة", "error");
        }
        this.ensureDataIntegrity();
        this.bindEvents();
        this.setupImageClickHandler();
        this.setupMessageContextHandler();
        this.applyTheme();
        this.setupChatInputHandler();
        this.setupClearOnFocus();
        this.setupKeyboardShortcuts();
        this.setupInactivityTimer();
        this.setupReadingProgress();
        this.setupPullToRefresh();
        enableRealtime(this);

        initScheduleModule(this);
        initGradesModule(this);
        initChatModule(this);
        initAdminModule(this);

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            window.deferredPrompt = e;
            showToast("تستطيع تثبيت التطبيق على الشاشة الرئيسية", "info");
        });
    },

    showSplashScreen(text = '') {
        const splash = document.getElementById('splash-screen');
        if (!splash) return;
        splash.classList.remove('hidden');
        splash.classList.remove('fade-out');
        if (text) {
            const subtitle = splash.querySelector('.splash-subtitle');
            if (subtitle) subtitle.textContent = text;
        }
    },

    hideSplashScreen() {
        const splash = document.getElementById('splash-screen');
        if (!splash) return;
        splash.classList.add('fade-out');
        splash.addEventListener('transitionend', () => {
            splash.classList.add('hidden');
            splash.remove();
        }, { once: true });
        setTimeout(() => {
            if (document.getElementById('splash-screen')) {
                splash.classList.add('hidden');
                splash.remove();
            }
        }, 3000);
    },

    togglePasswordVisibility() {
        const passInput = document.getElementById('pass');
        const toggleBtn = document.querySelector('.toggle-password');
        if (!passInput || !toggleBtn) return;
        if (passInput.type === 'password') {
            passInput.type = 'text';
            toggleBtn.textContent = '🙈';
        } else {
            passInput.type = 'password';
            toggleBtn.textContent = '👁️';
        }
    },

    syncLocalStorage() {
        localStorage.setItem('pfp', JSON.stringify(db.pfp));
        localStorage.setItem('contacts', JSON.stringify(db.contacts));
        localStorage.setItem('hiddenHomeworks', JSON.stringify(db.hiddenHomeworks));
    },

    ensureDataIntegrity() {
        if (!db.schedules) db.schedules = {};
        if (!db.homeworks) db.homeworks = {};
        if (!db.classTeachers) db.classTeachers = {};
        if (!db.teacherAssignments) db.teacherAssignments = {};
        if (!db.groups) db.groups = [];
        if (!db.notifs) db.notifs = [];
        if (!db.contacts) db.contacts = {};
        if (!db.hiddenHomeworks) db.hiddenHomeworks = {};
        if (!db.grades) db.grades = {};
        if (!db.teacherSchedules) db.teacherSchedules = {};

        for (let grade in gradesConfig) {
            if (!db.schedules[grade]) db.schedules[grade] = {};
            if (!db.homeworks[grade]) db.homeworks[grade] = {};
            if (!db.classTeachers[grade]) db.classTeachers[grade] = {};
            gradesConfig[grade].forEach(cls => {
                if (!db.schedules[grade][cls]) db.schedules[grade][cls] = {};
                if (!db.homeworks[grade][cls]) db.homeworks[grade][cls] = [];
                if (db.classTeachers[grade][cls] === undefined) db.classTeachers[grade][cls] = null;
                ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"].forEach(d => {
                    if (!db.schedules[grade][cls][d]) db.schedules[grade][cls][d] = {p1:"-",p2:"-",p3:"-",p4:"-",p5:"-",p6:"-",p7:"-"};
                });
            });
        }

        db.systemUsers.filter(u => u.r === 'teacher').forEach(t => {
            if (!db.teacherSchedules[t.s]) {
                db.teacherSchedules[t.s] = {};
                ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"].forEach(d => {
                    db.teacherSchedules[t.s][d] = {p1:"-",p2:"-",p3:"-",p4:"-",p5:"-",p6:"-",p7:"-"};
                });
            }
        });
    },

    async doLogin() {
        const s = document.getElementById('serial').value.trim();
        const p = document.getElementById('pass').value.trim();
        const errorDiv = document.getElementById('login-error');
        if (errorDiv) errorDiv.classList.add('hidden');

        const now = Date.now();
        let attempts = JSON.parse(localStorage.getItem('loginAttempts') || '{"count":0,"lastAttempt":0,"blockedUntil":0}');
        if (attempts.blockedUntil && now < attempts.blockedUntil) {
            showToast("تم تجميد الدخول مؤقتاً. حاول لاحقاً.", "error");
            return;
        }
        if (now - attempts.lastAttempt > 15 * 60 * 1000) {
            attempts = { count: 0, lastAttempt: now, blockedUntil: 0 };
        }

        const { data: users, error } = await supabase.from('users').select('*').eq('serial', s);
        if (error || !users || users.length === 0) {
            attempts.count++;
            attempts.lastAttempt = now;
            if (attempts.count >= 5) {
                attempts.blockedUntil = now + 15 * 60 * 1000;
                localStorage.setItem('loginAttempts', JSON.stringify(attempts));
                showToast("تم تجميد الدخول لمدة 15 دقيقة", "error");
                return;
            }
            localStorage.setItem('loginAttempts', JSON.stringify(attempts));
            if (errorDiv) {
                errorDiv.textContent = 'الرقم التسلسلي غير صحيح أو غير موجود';
                errorDiv.classList.remove('hidden');
            }
            this.shakeLoginCard();
            return;
        }

        const found = users[0];
        const passwordOk = await verifyPassword(p, found.password);
        if (!passwordOk) {
            attempts.count++;
            attempts.lastAttempt = now;
            if (attempts.count >= 5) {
                attempts.blockedUntil = now + 15 * 60 * 1000;
                localStorage.setItem('loginAttempts', JSON.stringify(attempts));
                showToast("تم تجميد الدخول لمدة 15 دقيقة", "error");
                return;
            }
            localStorage.setItem('loginAttempts', JSON.stringify(attempts));
            if (errorDiv) {
                errorDiv.textContent = 'كلمة المرور غير صحيحة';
                errorDiv.classList.remove('hidden');
            }
            this.shakeLoginCard();
            return;
        }

        localStorage.removeItem('loginAttempts');
        if (errorDiv) errorDiv.classList.add('hidden');
        this.user = {
            s: found.serial,
            n: found.name,
            r: found.role,
            ...(found.role === 'student' ? { grade: found.grade, c: found.class } : {}),
            ...(found.role === 'teacher' ? { sub: found.subject } : {})
        };
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        const contactsList = await loadContacts(this.user.s);
        db.contacts[this.user.s] = contactsList;
        this.syncLocalStorage();

        this.showSplashScreen('جاري تحميل النظام...');
        setTimeout(() => {
            this.launch();
        }, 800);
    },

    shakeLoginCard() {
        const card = document.querySelector('.login-card');
        if (card) {
            card.classList.add('shake');
            setTimeout(() => card.classList.remove('shake'), 600);
        }
    },

    bindEvents() {
        document.getElementById('login-btn').onclick = () => this.doLogin();
        const serialInput = document.getElementById('serial');
        const passInput = document.getElementById('pass');
        const handler = (e) => { if (e.key === 'Enter') this.doLogin(); };
        if (serialInput) serialInput.addEventListener('keypress', handler);
        if (passInput) passInput.addEventListener('keypress', handler);
        window.onclick = (e) => {
            if (!e.target.closest('.notif-wrapper')) document.getElementById('notif-dropdown')?.classList.add('hidden');
        };
        document.addEventListener('click', function(e) {
            const target = e.target.closest('button');
            if (!target) return;
            const ripple = document.createElement('span');
            ripple.className = 'ripple-effect';
            const rect = target.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (e.clientX - rect.left - size/2) + 'px';
            ripple.style.top = (e.clientY - rect.top - size/2) + 'px';
            target.appendChild(ripple);
            ripple.addEventListener('animationend', () => ripple.remove());
        });
    },

    setupInactivityTimer() {
        let timer;
        const reset = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                if (this.user) {
                    showToast("تم تسجيل الخروج بسبب عدم النشاط", "warning");
                    location.reload();
                }
            }, 30 * 60 * 1000);
        };
        ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(ev => document.addEventListener(ev, reset));
        reset();
    },

    setupReadingProgress() {
        const contentArea = document.getElementById('content-area');
        if (!contentArea) return;
        contentArea.addEventListener('scroll', () => {
            const scrollTop = contentArea.scrollTop;
            const scrollHeight = contentArea.scrollHeight - contentArea.clientHeight;
            const progress = scrollHeight ? (scrollTop / scrollHeight) * 100 : 0;
            document.getElementById('reading-progress').style.width = progress + '%';
        });
    },

    setupPullToRefresh() {
        if (window.innerWidth > 768) return;
        let startY = 0;
        document.addEventListener('touchstart', e => startY = e.touches[0].clientY, { passive: true });
        document.addEventListener('touchmove', e => {
            if (window.scrollY === 0 && e.touches[0].clientY - startY > 100) {
                const activeTab = [...document.querySelectorAll('main section:not(.hidden)')].pop();
                if (activeTab) {
                    if (activeTab.id === 'tab-schedule') this.renderStudentSchedule();
                    else if (activeTab.id === 'tab-chat') this.renderChatList();
                }
                startY = e.touches[0].clientY;
            }
        }, { passive: true });
    },

    toggleSidebar() { document.getElementById('sidebar')?.classList.toggle('open'); },

    launch() {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('main-system').classList.remove('hidden');
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth <= 768 && sidebar) sidebar.classList.remove('open');
        const nameParts = this.user.n.split(' ');
        const nameEl = document.getElementById('display-name');
        if (nameParts.length > 2) nameEl.innerHTML = nameParts.slice(0,2).join(' ')+'<br>'+nameParts.slice(2).join(' ');
        else if (nameParts.length === 2) nameEl.innerHTML = nameParts[0]+'<br>'+nameParts[1];
        else nameEl.innerText = this.user.n;

        let roleText = '';
        if (this.user.r === 'student') roleText = `طالب - ${this.user.grade} ${this.user.c}`;
        else if (this.user.r === 'teacher') roleText = 'معلم';
        else if (this.user.r === 'admin') roleText = 'مدير النظام';
        document.getElementById('display-role').innerText = roleText;

        this.renderPfp();
        this.updateBellCount();

        const mobileAdmin = document.getElementById('mobile-admin-btn');
        const mobileTeacher = document.getElementById('mobile-teacher-btn');
        const mobileMore = document.getElementById('mobile-more-btn');
        if (mobileAdmin) mobileAdmin.classList.toggle('hidden', this.user.r !== 'admin');
        if (mobileTeacher) mobileTeacher.classList.toggle('hidden', this.user.r !== 'teacher');
        if (mobileMore) mobileMore.classList.toggle('hidden', this.user.r !== 'admin');

        if (this.user.r === 'teacher') {
            document.getElementById('teacher-tab').classList.remove('hidden');
            this.renderTeacherUI();
            this.switchTab('teacher');
        } else if (this.user.r === 'admin') {
            document.querySelector('aside nav button[onclick*="schedule"]')?.classList.add('hidden');
            this.createAdminSidebarButtons();
            document.getElementById('admin-tab').classList.remove('hidden');
            this.switchTab('admin');
        } else {
            this.renderStudentSchedule();
            this.switchTab('schedule');
        }

        this.hideSplashScreen();
    },

    createAdminSidebarButtons() {
        const nav = document.querySelector('aside nav');
        if (!nav) return;
        nav.querySelectorAll('.custom-admin-btn').forEach(b => b.remove());
        const addBtn = (icon, text, tab) => {
            const btn = document.createElement('button');
            btn.className = 'custom-admin-btn';
            btn.innerHTML = `<i>${icon}</i> <span>${text}</span>`;
            btn.onclick = () => app.switchTab(tab);
            nav.appendChild(btn);
        };
        addBtn('📜', 'طباعة النتائج PDF', 'admin-print-reports');
        addBtn('📋', 'طباعة أسماء الطلاب', 'admin-print-names');
        addBtn('👨‍🏫', 'تعيين مربي الصفوف', 'admin-assign-teachers');
        addBtn('📚', 'مواد المعلمين', 'admin-teacher-subjects');
        addBtn('📢', 'نشر إشعار عام', 'admin-publish-notification');
        addBtn('👥', 'إدارة المجموعات', 'admin-group-manage');
        addBtn('👤', 'إدارة المستخدمين', 'admin-user-management');
    },

    toggleMobileMoreMenu() {
        const menu = document.getElementById('mobile-more-menu');
        if (!menu) return;
        if (menu.classList.contains('hidden')) {
            const adminTabs = [
                { id: 'admin-print-reports', label: 'طباعة النتائج' },
                { id: 'admin-print-names', label: 'طباعة الأسماء' },
                { id: 'admin-assign-teachers', label: 'مربي الصفوف' },
                { id: 'admin-teacher-subjects', label: 'مواد المعلمين' },
                { id: 'admin-publish-notification', label: 'إشعار عام' },
                { id: 'admin-group-manage', label: 'المجموعات' },
                { id: 'admin-user-management', label: 'المستخدمين' }
            ];
            menu.innerHTML = adminTabs.map(t => 
                `<button onclick="app.switchTab('${t.id}'); app.toggleMobileMoreMenu();" 
                style="background:var(--primary-dark); color:white; border:none; padding:10px 18px; border-radius:10px; margin:3px 0; cursor:pointer;">${t.label}</button>`
            ).join('');
            setTimeout(() => {
                const hideMenu = (e) => {
                    if (!e.target.closest('#mobile-more-menu') && !e.target.closest('#mobile-more-btn')) {
                        menu.classList.add('hidden');
                        document.removeEventListener('click', hideMenu);
                    }
                };
                document.addEventListener('click', hideMenu);
            }, 10);
        }
        menu.classList.toggle('hidden');
    },

    toggleNotifs(e) {
        e.stopPropagation();
        const dd = document.getElementById('notif-dropdown');
        if (dd) {
            dd.classList.toggle('hidden');
            if (!dd.classList.contains('hidden')) this.renderNotifsList();
        }
    },

    updateBellCount() {
        if (!this.user) return;
        const myNotifs = db.notifs.filter(n => n.type === 'all' || (n.type === 'class' && n.val === `${this.user.grade}-${this.user.c}`) || (n.type === 'user' && n.val === this.user.s));
        const unread = myNotifs.filter(n => !n.readBy.includes(this.user.s)).length;
        const countSpan = document.getElementById('bell-count');
        const bell = document.querySelector('.notif-bell');
        if (countSpan) {
            countSpan.innerText = unread;
            countSpan.style.display = unread > 0 ? 'block' : 'none';
        }
        if (bell) {
            if (unread > 0) bell.classList.add('has-notifications');
            else bell.classList.remove('has-notifications');
        }
    },

    renderNotifsList() {
        let list = db.notifs.filter(n => n.type === 'all' || (n.type === 'class' && n.val === `${this.user.grade}-${this.user.c}`) || (n.type === 'user' && n.val === this.user.s));
        const container = document.getElementById('notif-list');
        if (!container) return;
        if (list.length === 0) container.innerHTML = '<p style="text-align:center; padding:10px;">لا توجد إشعارات</p>';
        else {
            list.forEach(n => { if (!n.readBy.includes(this.user.s)) { n.readBy.push(this.user.s); this.addNotif(n.type, n.val, n.msg); } });
            container.innerHTML = list.map(n => `<div style="padding:12px; border-bottom:1px solid var(--border-light);"><div>${n.msg}</div><small>${n.time}</small></div>`).join('');
        }
    },

    async addNotif(type, val, msg) {
        const notif = { id: Date.now(), type, val, msg, time: new Date().toLocaleTimeString(), readBy: [] };
        db.notifs.unshift(notif);
        if (db.notifs.length > 30) db.notifs.pop();
        await addNotification(notif);
        this.updateBellCount();
    },

    switchTab(id) {
        const sections = document.querySelectorAll('main section, .admin-sub-tab');
        sections.forEach(s => {
            if (s.id === 'tab-' + id) {
                s.classList.remove('hidden');
                s.style.opacity = '0';
                s.style.transform = 'translateY(10px)';
                requestAnimationFrame(() => {
                    s.style.opacity = '1';
                    s.style.transform = 'translateY(0)';
                });
            } else {
                if (!s.classList.contains('hidden')) {
                    s.style.opacity = '0';
                    s.style.transform = 'translateY(10px)';
                    s.addEventListener('transitionend', function handler() {
                        s.classList.add('hidden');
                        s.removeEventListener('transitionend', handler);
                    });
                }
            }
        });

        if (id.startsWith('admin-') && !document.getElementById('tab-' + id)) {
            const section = document.createElement('section');
            section.id = 'tab-' + id;
            section.className = 'admin-sub-tab';
            document.getElementById('content-area').appendChild(section);
        }

        const target = document.getElementById('tab-' + id);
        if (target) target.classList.remove('hidden');
        if (id === 'chat') this.renderChatList();
        if (id === 'admin') this.renderAdminMain();
        if (id === 'admin-print-reports') this.renderPrintReportsTab();
        if (id === 'admin-print-names') this.renderPrintNamesTab();
        if (id === 'admin-assign-teachers') this.renderAssignTeachersTab();
        if (id === 'admin-teacher-subjects') this.renderTeacherSubjectsTab();
        if (id === 'admin-publish-notification') this.renderPublishNotificationTab();
        if (id === 'admin-group-manage') this.renderGroupManagement();
        if (id === 'admin-user-management') this.renderUserManagement();
        if (id === 'schedule') {
            if (this.user.r === 'student') this.renderStudentSchedule();
            else if (this.user.r === 'teacher') this.renderTeacherOwnSchedule();
        }
    },

    applyTheme() {
        const saved = localStorage.getItem('schoolTheme');
        if (saved) {
            document.body.classList.toggle('dark', saved === 'dark');
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) document.body.classList.add('dark');
            else document.body.classList.remove('dark');
        }
        this.updateThemeIcon();
    },

    toggleTheme() {
        const isDark = document.body.classList.toggle('dark');
        localStorage.setItem('schoolTheme', isDark ? 'dark' : 'light');
        this.updateThemeIcon();
    },

    updateThemeIcon() {
        const btn = document.getElementById('themeToggleBtn');
        if (btn) {
            btn.innerText = document.body.classList.contains('dark') ? '☀️' : '🌙';
        }
    },

    setupFullscreenButtons() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.fullscreen-btn')) {
                const card = e.target.closest('.card');
                if (card) {
                    card.classList.toggle('fullscreen');
                    const btn = card.querySelector('.fullscreen-btn');
                    if (btn) btn.textContent = card.classList.contains('fullscreen') ? '✕' : '⛶';
                }
            }
        });
    },

    addFullscreenButton(containerSelector) {
        const card = document.querySelector(containerSelector);
        if (card && !card.querySelector('.fullscreen-btn')) {
            const btn = document.createElement('button');
            btn.className = 'fullscreen-btn';
            btn.textContent = '⛶';
            card.style.position = 'relative';
            card.appendChild(btn);
        }
    },

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === '1') { e.preventDefault(); this.switchTab('schedule'); }
            else if (e.ctrlKey && e.key === '2') { e.preventDefault(); this.switchTab('chat'); }
            else if (e.key === 'Escape') {
                if (document.getElementById('emoji-picker')) document.getElementById('emoji-picker').classList.add('hidden');
            }
        });
    },

    setupChatInputHandler() {
        const chatInput = document.getElementById('chat-msg');
        if (!chatInput) return;
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.sendMessage(); }
            else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const start = chatInput.selectionStart, end = chatInput.selectionEnd;
                chatInput.value = chatInput.value.substring(0, start) + "\n" + chatInput.value.substring(end);
                chatInput.selectionStart = chatInput.selectionEnd = start + 1;
            }
        });
    },

    setupClearOnFocus() {
        document.querySelectorAll('input:not([type="file"]):not([type="password"]):not([type="submit"]):not([type="button"]), textarea')
            .forEach(input => {
                input.addEventListener('focus', (e) => {
                    if (e.target.id !== 'chat-msg') e.target.select();
                });
            });
    },

    setupImageClickHandler() {
        const chatBox = document.getElementById('chat-box');
        if (!chatBox) return;
        chatBox.onclick = (e) => {
            if (e.target.tagName === 'IMG' && e.target.closest('.bubble')) {
                const url = e.target.getAttribute('src');
                if (url) this.openImage(url);
            }
        };
    },

    setupMessageContextHandler() {
        const chatBox = document.getElementById('chat-box');
        if (!chatBox) return;
        chatBox.oncontextmenu = (e) => {
            const messageDiv = e.target.closest('.message');
            if (messageDiv) {
                e.preventDefault();
                const index = messageDiv.getAttribute('data-msg-index');
                if (index !== null) this.showMessageContext(e, parseInt(index));
            }
        };
    },

    getCurrentPeriodInfo() {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const arabicDays = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
        const today = arabicDays[dayOfWeek];
        if (today === "الجمعة" || today === "السبت") return null;
        const hour = now.getHours(), minute = now.getMinutes();
        const periodsTimes = [
            {p:'p1', start:'08:00', end:'08:45'}, {p:'p2', start:'08:50', end:'09:35'},
            {p:'p3', start:'09:40', end:'10:25'}, {p:'p4', start:'10:30', end:'11:15'},
            {p:'p5', start:'11:20', end:'12:05'}, {p:'p6', start:'12:10', end:'12:55'},
            {p:'p7', start:'13:00', end:'13:45'}
        ];
        const currentMinutes = hour * 60 + minute;
        for (let p of periodsTimes) {
            const [sh, sm] = p.start.split(':').map(Number);
            const [eh, em] = p.end.split(':').map(Number);
            if (currentMinutes >= sh*60+sm && currentMinutes < eh*60+em) {
                return { day: today, period: p.p };
            }
        }
        return null;
    },

    getDefaultAvatar() {
        if (db.pfp[this.user.s]) return db.pfp[this.user.s];
        switch (this.user.r) {
            case 'admin': return 'avatar-admin.png';
            case 'teacher': return 'avatar-teacher.png';
            case 'student':
                if (['خامس', 'سادس'].includes(this.user.grade)) return 'avatar-student-56.png';
                return 'avatar-student-789.png';
            default: return 'avatar-student-789.png';
        }
    },

    async renderPfp() {
        const url = await this.getDefaultAvatar();
        const container = document.getElementById('user-pfp-container');
        if (container) {
            container.innerHTML = `
                <div class="pfp-wrapper" onclick="app.changePfp()" title="اضغط لتغيير الصورة">
                    <img src="${url}" alt="الصورة الشخصية">
                    <span class="pfp-edit-overlay">تحرير</span>
                </div>
            `;
        }
    },

    async changePfp() {
        const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            this.showUploadLoader(true, 'جاري رفع الصورة...');
            try {
                const url = await uploadAvatar(this.user.s, file);
                db.pfp[this.user.s] = url;
                await this.renderPfp();
                this.syncLocalStorage();
                showToast("تم تحديث الصورة الشخصية", "success");
            } catch (err) {
                console.error(err);
                showToast("فشل رفع الصورة", "error");
            } finally {
                this.showUploadLoader(false);
            }
        };
        input.click();
    },

    openImage(url) {
        const modal = document.getElementById('image-modal');
        const img = document.getElementById('modal-img');
        if (modal && img) { img.src = url; modal.classList.remove('hidden'); }
    },

    sendBrowserNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
            new Notification(title, { body, icon: 'logo-transparent.png' });
        }
    },

    animateCounter(el, target) {
        if (!el) return;
        let current = 0;
        const step = Math.ceil(target / 40);
        const timer = setInterval(() => {
            current += step;
            if (current >= target) {
                el.textContent = target;
                clearInterval(timer);
            } else {
                el.textContent = Math.floor(current);
            }
        }, 25);
    },

    showUploadLoader(show, text = '') {
        const overlay = document.getElementById('upload-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
            const p = overlay.querySelector('.progress-text');
            if (p && text) p.textContent = text;
        }
    }
};

window.app = app;
app.init();
// --- END OF core.js ---