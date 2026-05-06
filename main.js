// main.js - النسخة الكاملة مع تحسينات الحركة وتجميع الشات
import { supabase } from "./supabase-config.js";
import { hashPassword, verifyPassword } from "./auth.js";

const app = {
    user: null,
    activeChat: null,
    db: {
        schedules: {},
        teacherSchedules: {},
        grades: {},
        groups: [],
        directMessages: {},
        notifs: [],
        pfp: JSON.parse(localStorage.getItem('pfp')) || {},
        homeworks: {},
        contacts: JSON.parse(localStorage.getItem('contacts')) || {},
        hiddenHomeworks: JSON.parse(localStorage.getItem('hiddenHomeworks')) || {},
        classTeachers: {},
        teacherAssignments: {},
        systemUsers: []
    },
    pendingFiles: [],

    gradesConfig: {
        "خامس": ["أ", "ب", "ج", "تج"],
        "سادس": ["أ", "ب", "ج", "د", "تج"],
        "سابع": ["أ", "ب", "ج", "د", "تج"],
        "ثامن": ["أ", "ب", "ج", "د", "تج"],
        "تاسع": ["أ", "ب", "ج", "د"]
    },

    subjectsList: [
        "اللغة العربية", "الرياضيات", "العلوم", "فيزياء", "كيمياء",
        "أحياء", "اللغة الإنجليزية", "التاريخ", "التربية الإسلامية",
        "المهارات الرقمية", "الجغرافيا", "الوطنية", "التربية المهنية",
        "الثقافة المالية", "التربية الفنية", "التربية الرياضية"
    ],

    subjectColors: {
        "اللغة العربية": "#ffe0b2", "الرياضيات": "#c8e6c9", "العلوم": "#b3e5fc",
        "فيزياء": "#f8bbd0", "كيمياء": "#e1bee7", "أحياء": "#dcedc8",
        "اللغة الإنجليزية": "#ffccbc", "التاريخ": "#d7ccc8", "التربية الإسلامية": "#fff9c4",
        "المهارات الرقمية": "#b2dfdb", "الجغرافيا": "#f0f4c3", "الوطنية": "#ffecb3",
        "التربية المهنية": "#e0e0e0", "الثقافة المالية": "#ffe082", "التربية الفنية": "#f8bbd0",
        "التربية الرياضية": "#c5e1a5"
    },

    showToast(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2500);
    },

    showConfirm(message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            const msgEl = document.getElementById('confirm-message');
            const yesBtn = document.getElementById('confirm-yes');
            const noBtn = document.getElementById('confirm-no');
            if (!modal || !msgEl || !yesBtn || !noBtn) {
                resolve(confirm(message));
                return;
            }
            msgEl.textContent = message;
            modal.classList.remove('hidden');
            const cleanup = () => {
                modal.classList.add('hidden');
                yesBtn.removeEventListener('click', onYes);
                noBtn.removeEventListener('click', onNo);
            };
            const onYes = () => { cleanup(); resolve(true); };
            const onNo = () => { cleanup(); resolve(false); };
            yesBtn.addEventListener('click', onYes);
            noBtn.addEventListener('click', onNo);
        });
    },

    // ========== تحميل جميع البيانات من Supabase ==========
    async loadAllDataFromSupabase() {
        try {
            const [
                { data: users }, { data: schedules }, { data: teacherSchedules },
                { data: grades }, { data: homeworks }, { data: groups },
                { data: directMessages }, { data: notifications },
                { data: classTeachers }, { data: teacherAssignments }
            ] = await Promise.all([
                supabase.from('users').select('*'),
                supabase.from('schedules').select('*'),
                supabase.from('teacher_schedules').select('*'),
                supabase.from('grades').select('*'),
                supabase.from('homeworks').select('*'),
                supabase.from('groups').select('*'),
                supabase.from('direct_messages').select('*'),
                supabase.from('notifications').select('*'),
                supabase.from('class_teachers').select('*'),
                supabase.from('teacher_assignments').select('*')
            ]);

            this.db.systemUsers = (users || []).map(u => ({
  s: u.serial,
  n: u.name,
  r: u.role,
  grade: u.grade,
  c: u.class,
  sub: u.subject
}));
            this.db.schedules = this.parseSchedules(schedules);
            this.db.teacherSchedules = this.parseTeacherSchedules(teacherSchedules);
            this.db.grades = this.parseGrades(grades);
            this.db.homeworks = this.parseHomeworks(homeworks);
            this.db.groups = this.parseGroups(groups);
            this.db.directMessages = this.parseDirectMessages(directMessages);
            this.db.notifs = this.parseNotifications(notifications);
            this.db.classTeachers = this.parseClassTeachers(classTeachers);
            this.db.teacherAssignments = this.parseTeacherAssignments(teacherAssignments);
        } catch (err) {
            console.error("خطأ في تحميل البيانات من Supabase:", err);
            this.showToast("تعذر تحميل البيانات من السحابة", "error");
        }
    },

    parseSchedules(rows) {
        const obj = {};
        if (rows) rows.forEach(r => {
            if (!obj[r.grade]) obj[r.grade] = {};
            if (!obj[r.grade][r.class]) obj[r.grade][r.class] = {};
            if (!obj[r.grade][r.class][r.day]) obj[r.grade][r.class][r.day] = {};
            obj[r.grade][r.class][r.day][r.period] = r.value;
        });
        return obj;
    },

    parseTeacherSchedules(rows) {
        const obj = {};
        if (rows) rows.forEach(r => {
            if (!obj[r.teacher_id]) obj[r.teacher_id] = {};
            if (!obj[r.teacher_id][r.day]) obj[r.teacher_id][r.day] = {};
            obj[r.teacher_id][r.day][r.period] = r.value;
        });
        return obj;
    },

    parseGrades(rows) {
        const obj = {};
        if (rows) rows.forEach(r => {
            if (!obj[r.student_serial]) obj[r.student_serial] = {};
            obj[r.student_serial][r.subject] = { m1: r.m1, m2: r.m2, m3: r.m3, fin: r.fin };
        });
        return obj;
    },

    parseHomeworks(rows) {
        const obj = {};
        if (rows) rows.forEach(r => {
            if (!obj[r.grade]) obj[r.grade] = {};
            if (!obj[r.grade][r.class]) obj[r.grade][r.class] = [];
            obj[r.grade][r.class].push({ t: r.teacher_name, s: r.title, c: r.content, sub: r.subject, d: r.date });
        });
        return obj;
    },

    parseGroups(rows) {
        if (!rows) return [];
        return rows.map(r => ({
            id: r.id.toString(),
            name: r.name,
            members: JSON.parse(r.members || '[]'),
            messages: JSON.parse(r.messages || '[]'),
            allowExit: r.allowExit,
            whoCanPost: r.whoCanPost
        }));
    },

    parseDirectMessages(rows) {
        const obj = {};
        if (rows) rows.forEach(r => { obj[r.chat_id] = JSON.parse(r.messages || '[]'); });
        return obj;
    },

    parseNotifications(rows) {
        if (!rows) return [];
        return rows.map(r => ({
            id: r.id, type: r.type, val: r.val, msg: r.msg, time: r.time,
            readBy: JSON.parse(r.readBy || '[]')
        }));
    },

    parseClassTeachers(rows) {
        const obj = {};
        if (rows) rows.forEach(r => {
            if (!obj[r.grade]) obj[r.grade] = {};
            obj[r.grade][r.class] = r.teacher_id;
        });
        return obj;
    },

    parseTeacherAssignments(rows) {
        const obj = {};
        if (rows) rows.forEach(r => {
            obj[r.teacher_id] = { subject: r.subject, classes: JSON.parse(r.classes || '[]') };
        });
        return obj;
    },

    // ========== دوال مساعدة لحفظ التغييرات في Supabase ==========
    async saveSchedules() {
        await supabase.from('schedules').delete().neq('grade', '__nonexistent__');
        const rows = [];
        for (let grade in this.db.schedules)
            for (let cls in this.db.schedules[grade])
                for (let day in this.db.schedules[grade][cls])
                    for (let period in this.db.schedules[grade][cls][day])
                        rows.push({ grade, class: cls, day, period, value: this.db.schedules[grade][cls][day][period] });
        if (rows.length) await supabase.from('schedules').insert(rows);
    },

    async saveTeacherSchedules() {
        await supabase.from('teacher_schedules').delete().neq('teacher_id', '__nonexistent__');
        const rows = [];
        for (let tid in this.db.teacherSchedules)
            for (let day in this.db.teacherSchedules[tid])
                for (let period in this.db.teacherSchedules[tid][day])
                    rows.push({ teacher_id: tid, day, period, value: this.db.teacherSchedules[tid][day][period] });
        if (rows.length) await supabase.from('teacher_schedules').insert(rows);
    },

    async upsertGrade(student_serial, subject, m1, m2, m3, fin) {
        await supabase.from('grades').upsert(
  { student_serial, subject, m1, m2, m3, fin },
  { onConflict: 'student_serial,subject' }
);
    },

    async addHomework(grade, cls, teacher_name, title, content, subject, date) {
        await supabase.from('homeworks').insert({ grade, class: cls, teacher_name, title, content, subject, date });
    },

    async updateGroup(id, updates) { await supabase.from('groups').update(updates).eq('id', id); },
    async addNotification(notif) { await supabase.from('notifications').insert(notif); },
    async updateClassTeacher(grade, cls, teacher_id) { await supabase.from('class_teachers').upsert({ grade, class: cls, teacher_id }); },
    async updateTeacherAssignment(teacher_id, subject, classes) { await supabase.from('teacher_assignments').upsert({ teacher_id, subject, classes: JSON.stringify(classes) }); },
    async saveDirectMessages(chat_id, messages) { await supabase.from('direct_messages').upsert({ chat_id, messages: JSON.stringify(messages) }); },

    syncLocalStorage() {
        localStorage.setItem('pfp', JSON.stringify(this.db.pfp));
        localStorage.setItem('contacts', JSON.stringify(this.db.contacts));
        localStorage.setItem('hiddenHomeworks', JSON.stringify(this.db.hiddenHomeworks));
    },

    // ========== تهيئة البيانات ==========
    ensureDataIntegrity() {
        if (!this.db.schedules) this.db.schedules = {};
        if (!this.db.homeworks) this.db.homeworks = {};
        if (!this.db.classTeachers) this.db.classTeachers = {};
        if (!this.db.teacherAssignments) this.db.teacherAssignments = {};
        if (!this.db.groups) this.db.groups = [];
        if (!this.db.notifs) this.db.notifs = [];
        if (!this.db.contacts) this.db.contacts = {};
        if (!this.db.hiddenHomeworks) this.db.hiddenHomeworks = {};
        if (!this.db.grades) this.db.grades = {};
        if (!this.db.teacherSchedules) this.db.teacherSchedules = {};

        for (let grade in this.gradesConfig) {
            if (!this.db.schedules[grade]) this.db.schedules[grade] = {};
            if (!this.db.homeworks[grade]) this.db.homeworks[grade] = {};
            if (!this.db.classTeachers[grade]) this.db.classTeachers[grade] = {};
            this.gradesConfig[grade].forEach(cls => {
                if (!this.db.schedules[grade][cls]) this.db.schedules[grade][cls] = {};
                if (!this.db.homeworks[grade][cls]) this.db.homeworks[grade][cls] = [];
                if (this.db.classTeachers[grade][cls] === undefined) this.db.classTeachers[grade][cls] = null;
                ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"].forEach(d => {
                    if (!this.db.schedules[grade][cls][d]) this.db.schedules[grade][cls][d] = {p1:"-",p2:"-",p3:"-",p4:"-",p5:"-",p6:"-",p7:"-"};
                });
            });
        }

        this.db.systemUsers.filter(u => u.r === 'teacher').forEach(t => {
            if (!this.db.teacherSchedules[t.s]) {
                this.db.teacherSchedules[t.s] = {};
                ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"].forEach(d => {
                    this.db.teacherSchedules[t.s][d] = {p1:"-",p2:"-",p3:"-",p4:"-",p5:"-",p6:"-",p7:"-"};
                });
            }
        });
    },

    // ========== تسجيل الدخول ==========
    async doLogin() {
        const s = document.getElementById('serial').value.trim();
        const p = document.getElementById('pass').value.trim();
        const { data: users, error } = await supabase.from('users').select('*').eq('serial', s);
        if (error || !users || users.length === 0) {
            this.showToast("البيانات خاطئة!", "error");
            this.shakeLoginCard();
            return;
        }
        const found = users[0];
        const hashed = found.password;
        if (hashed.startsWith('sha256:')) {
            const ok = await verifyPassword(p, hashed);
            if (!ok) {
                this.showToast("البيانات خاطئة!", "error");
                this.shakeLoginCard();
                return;
            }
        } else {
            if (p !== hashed) {
                this.showToast("البيانات خاطئة!", "error");
                this.shakeLoginCard();
                return;
            }
            const newHash = 'sha256:' + await hashPassword(p);
            await supabase.from('users').update({ password: newHash }).eq('serial', s);
            found.password = newHash;
        }
        this.user = {
            s: found.serial,
            n: found.name,
            r: found.role,
            ...(found.role === 'student' ? { grade: found.grade, c: found.class } : {}),
            ...(found.role === 'teacher' ? { sub: found.subject } : {})
        };
        this.launch();
    },

    // هزة بطاقة الدخول عند الخطأ
    shakeLoginCard() {
        const card = document.querySelector('.login-card');
        if (card) {
            card.classList.add('shake');
            setTimeout(() => card.classList.remove('shake'), 600);
        }
    },

    // ========== بدء تشغيل النظام ==========
    async init() {
        await this.loadAllDataFromSupabase();
        this.ensureDataIntegrity();
        this.bindEvents();
        this.setupImageClickHandler();
        this.setupMessageContextHandler();
        this.applyTheme();
        this.setupChatInputHandler();
        this.setupClearOnFocus();
        this.setupKeyboardShortcuts();
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) document.getElementById('sidebar')?.classList.remove('open');
        });
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
        if (mobileAdmin) mobileAdmin.classList.toggle('hidden', this.user.r !== 'admin');
        if (mobileTeacher) mobileTeacher.classList.toggle('hidden', this.user.r !== 'teacher');

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
        addBtn('📜', 'طباعة النتائج', 'admin-print-reports');
        addBtn('📋', 'طباعة أسماء الطلاب', 'admin-print-names');
        addBtn('👨‍🏫', 'تعيين مربي الصفوف', 'admin-assign-teachers');
        addBtn('📚', 'مواد المعلمين', 'admin-teacher-subjects');
        addBtn('📢', 'نشر إشعار عام', 'admin-publish-notification');
        addBtn('👥', 'إدارة المجموعات', 'admin-group-manage');
        addBtn('👤', 'إدارة المستخدمين', 'admin-user-management');
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
        const myNotifs = this.db.notifs.filter(n => n.type === 'all' || (n.type === 'class' && n.val === `${this.user.grade}-${this.user.c}`) || (n.type === 'user' && n.val === this.user.s));
        const unread = myNotifs.filter(n => !n.readBy.includes(this.user.s)).length;
        const countSpan = document.getElementById('bell-count');
        const bell = document.querySelector('.notif-bell');
        if (countSpan) {
            countSpan.innerText = unread;
            countSpan.style.display = unread > 0 ? 'block' : 'none';
        }
        if (bell) {
            if (unread > 0) {
                bell.classList.add('has-notifications');
                bell.addEventListener('animationend', () => bell.classList.remove('has-notifications'), { once: true });
            } else {
                bell.classList.remove('has-notifications');
            }
        }
    },

    renderNotifsList() {
        let list = this.db.notifs.filter(n => n.type === 'all' || (n.type === 'class' && n.val === `${this.user.grade}-${this.user.c}`) || (n.type === 'user' && n.val === this.user.s));
        const container = document.getElementById('notif-list');
        if (!container) return;
        if (list.length === 0) container.innerHTML = '<p style="text-align:center; padding:10px;">لا توجد إشعارات</p>';
        else {
            list.forEach(n => { if (!n.readBy.includes(this.user.s)) { n.readBy.push(this.user.s); this.addNotification(n); } });
            container.innerHTML = list.map(n => `<div style="padding:12px; border-bottom:1px solid var(--border-light);"><div>${n.msg}</div><small>${n.time}</small></div>`).join('');
        }
    },

    async addNotif(type, val, msg) {
        const notif = { id: Date.now(), type, val, msg, time: new Date().toLocaleTimeString(), readBy: [] };
        this.db.notifs.unshift(notif);
        if (this.db.notifs.length > 30) this.db.notifs.pop();
        await this.addNotification(notif);
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

    // ========== إدارة المستخدمين ==========
    renderUserManagement() {
        const section = document.getElementById('tab-admin-user-management');
        if (!section) return;
        const users = this.db.systemUsers;
        let html = `<div class="card"><h3>👥 إدارة المستخدمين</h3>
            <button onclick="app.showAddUserForm()" style="background:var(--primary-dark); color:white; border:none; padding:8px 20px; border-radius:8px; margin-bottom:10px;">➕ إضافة مستخدم جديد</button>
            <div id="add-user-form-container"></div>
            <table class="main-table user-management-table">
                <thead><tr><th>الرقم</th><th>الاسم</th><th>الدور</th><th>الصف/الشعبة/المادة</th><th>كلمة المرور</th><th>إجراءات</th></tr></thead>
                <tbody>`;
        users.forEach((u, idx) => {
            const gradeCls = u.r === 'student' ? `${u.grade || ''} ${u.c || ''}` : (u.r === 'teacher' ? u.sub || '' : '');
            html += `<tr id="user-row-${idx}">
                <td>${u.s}</td>
                <td><input type="text" id="name-${idx}" value="${u.n}" placeholder="الاسم"></td>
                <td>
                    <select id="role-${idx}">
                        <option value="student" ${u.r==='student'?'selected':''}>طالب</option>
                        <option value="teacher" ${u.r==='teacher'?'selected':''}>معلم</option>
                        <option value="admin" ${u.r==='admin'?'selected':''}>مدير</option>
                    </select>
                </td>
                <td id="extra-${idx}">
                    ${u.r === 'student' ? `<input type="text" id="grade-${idx}" value="${u.grade||''}" placeholder="صف" style="width:60px;"> <input type="text" id="class-${idx}" value="${u.c||''}" placeholder="شعبة" style="width:60px;">` : 
                      u.r === 'teacher' ? `<input type="text" id="subject-${idx}" value="${u.sub||''}" placeholder="مادة" style="width:100px;">` : ''}
                </td>
                <td><input type="password" id="pass-${idx}" placeholder="****" style="width:80px;"></td>
                <td>
                    <button onclick="app.saveUser(${idx})" class="btn-save">💾 حفظ</button>
                    <button onclick="app.deleteUser(${idx})" class="btn-delete">🗑️ حذف</button>
                </td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
        section.innerHTML = html;
    },

    showAddUserForm() {
        const container = document.getElementById('add-user-form-container');
        container.innerHTML = `
            <div style="border:1px solid var(--border-light); padding:10px; border-radius:8px; margin-bottom:10px;">
                <input type="text" id="new-serial" placeholder="الرقم التسلسلي" required>
                <input type="text" id="new-name" placeholder="الاسم الكامل" required>
                <input type="password" id="new-pass" placeholder="كلمة المرور" required>
                <select id="new-role">
                    <option value="student">طالب</option>
                    <option value="teacher">معلم</option>
                    <option value="admin">مدير</option>
                </select>
                <div id="new-extra-fields">
                    <input type="text" id="new-grade" placeholder="الصف">
                    <input type="text" id="new-class" placeholder="الشعبة">
                </div>
                <button onclick="app.addNewUser()" style="background:var(--primary-dark); color:white; border:none; padding:6px 14px; border-radius:6px;">إضافة</button>
                <button onclick="document.getElementById('add-user-form-container').innerHTML=''" style="background:#ccc; border:none; padding:6px 14px; border-radius:6px;">إلغاء</button>
            </div>
        `;
        document.getElementById('new-role').addEventListener('change', function() {
            const extra = document.getElementById('new-extra-fields');
            if (this.value === 'student') {
                extra.innerHTML = `<input type="text" id="new-grade" placeholder="الصف"> <input type="text" id="new-class" placeholder="الشعبة">`;
            } else if (this.value === 'teacher') {
                extra.innerHTML = `<input type="text" id="new-subject" placeholder="المادة">`;
            } else {
                extra.innerHTML = '';
            }
        });
    },

    async addNewUser() {
        const s = document.getElementById('new-serial').value.trim();
        const name = document.getElementById('new-name').value.trim();
        const pass = document.getElementById('new-pass').value.trim();
        const role = document.getElementById('new-role').value;
        if (!s || !name || !pass) return this.showToast("املأ الحقول المطلوبة", "warning");
        if (this.db.systemUsers.find(u => u.s === s)) return this.showToast("الرقم التسلسلي موجود مسبقاً", "error");
        const hashed = 'sha256:' + await hashPassword(pass);
        const newUser = { serial: s, name, role, password: hashed };
        if (role === 'student') {
            newUser.grade = document.getElementById('new-grade')?.value || '';
            newUser.class = document.getElementById('new-class')?.value || '';
        } else if (role === 'teacher') {
            newUser.subject = document.getElementById('new-subject')?.value || '';
        }
        const { error } = await supabase.from('users').insert(newUser);
        if (error) return this.showToast("فشلت الإضافة", "error");
        await this.loadAllDataFromSupabase();
        this.renderUserManagement();
        this.showToast("تم إضافة المستخدم", "success");
    },

    async saveUser(index) {
        const user = this.db.systemUsers[index];
        if (!user) return;
        user.name = document.getElementById(`name-${index}`).value.trim();
        user.role = document.getElementById(`role-${index}`).value;
        const passField = document.getElementById(`pass-${index}`);
        if (passField.value.trim() !== '') {
            user.password = 'sha256:' + await hashPassword(passField.value.trim());
        }
        if (user.role === 'student') {
            user.grade = document.getElementById(`grade-${index}`).value.trim();
            user.class = document.getElementById(`class-${index}`).value.trim();
            delete user.subject;
        } else if (user.role === 'teacher') {
            user.subject = document.getElementById(`subject-${index}`).value.trim();
            delete user.grade;
            delete user.class;
        } else {
            delete user.grade; delete user.class; delete user.subject;
        }
        const { error } = await supabase.from('users').upsert({
            serial: user.serial,
            name: user.name,
            role: user.role,
            password: user.password,
            grade: user.grade || null,
            class: user.class || null,
            subject: user.subject || null
        });
        if (error) return this.showToast("فشل الحفظ", "error");
        await this.loadAllDataFromSupabase();
        this.renderUserManagement();
        this.showToast("تم حفظ التعديلات", "success");
    },

    async deleteUser(index) {
        if (this.db.systemUsers.length <= 1) return this.showToast("لا يمكن حذف آخر مستخدم", "error");
        const user = this.db.systemUsers[index];
        const confirmed = await this.showConfirm(`حذف ${user.name}؟`);
        if (confirmed) {
            const { error } = await supabase.from('users').delete().eq('serial', user.serial);
            if (error) return this.showToast("فشل الحذف", "error");
            await this.loadAllDataFromSupabase();
            this.renderUserManagement();
            this.showToast("تم الحذف", "success");
        }
    },

    // ========== الجداول والمواعيد ==========
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

    renderScheduleTable(sched, editable = false, grade = null, cls = null) {
        const current = this.getCurrentPeriodInfo();
        let html = `<table class="main-table"><thead><tr><th>اليوم</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th></tr></thead><tbody>`;
        ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"].forEach(day => {
            html += `<tr><td style="font-weight:bold;">${day}</td>`;
            for (let i = 1; i <= 7; i++) {
                const p = 'p' + i;
                const val = sched[day]?.[p] || '-';
                const color = val !== '-' ? (this.subjectColors[val] || '') : '';
                const isCurrent = current && current.day === day && current.period === p;
                const clsName = isCurrent ? 'current-period' : '';
                const style = color ? `style="background-color:${color};"` : '';
                if (editable && grade && cls) {
                    html += `<td class="${clsName}" ${style} onclick="app.editClassSub('${grade}','${cls}','${day}','${p}')">${val}</td>`;
                } else if (editable) {
                    html += `<td class="${clsName}" ${style} onclick="app.editTeacherCell('${grade}','${day}','${p}')">${val}</td>`;
                } else {
                    html += `<td class="${clsName}" ${style}>${val}</td>`;
                }
            }
            html += `</tr>`;
        });
        html += `</tbody></table>`;
        return html;
    },

    renderAdminMain() {
        const container = document.getElementById('admin-main-container');
        if (!container) return;
        const gradesOptions = Object.keys(this.gradesConfig).map(g => `<option value="${g}">${g}</option>`).join('');
        container.innerHTML = `
            <div class="card">
                <h3>📚 تعديل جداول الطلاب</h3>
                <select id="admin-grade-select">${gradesOptions}</select>
                <select id="admin-class-select"></select>
                <div id="admin-schedule-edit-area"></div>
            </div>
            <div class="card">
                <h3>👨‍🏫 تعديل جداول المعلمين</h3>
                <select id="teacher-select-admin"><option value="">-- اختر معلماً --</option>${this.db.systemUsers.filter(u=>u.r==='teacher').map(t=>`<option value="${t.s}">${t.n}</option>`).join('')}</select>
                <div id="teacher-edit-container-admin"></div>
            </div>
        `;
        document.getElementById('admin-grade-select').onchange = function() {
            const grade = this.value;
            const classSelect = document.getElementById('admin-class-select');
            classSelect.innerHTML = (app.gradesConfig[grade] || []).map(c => `<option value="${c}">${c}</option>`).join('');
            if (classSelect.options.length) app.renderAdminSchedule(grade, classSelect.value);
        };
        document.getElementById('admin-class-select').onchange = function() {
            if (document.getElementById('admin-grade-select').value) app.renderAdminSchedule(document.getElementById('admin-grade-select').value, this.value);
        };
        document.getElementById('admin-grade-select').dispatchEvent(new Event('change'));
        document.getElementById('teacher-select-admin').onchange = function() {
            if (this.value) app.renderTeacherEditSchedule(this.value);
            else document.getElementById('teacher-edit-container-admin').innerHTML = '';
        };
    },

    renderAdminSchedule(grade, cls) {
        const container = document.getElementById('admin-schedule-edit-area');
        if (!container) return;
        const sched = this.db.schedules[grade]?.[cls];
        if (!sched) return;
        container.innerHTML = this.renderScheduleTable(sched, true, grade, cls);
    },

    async editClassSub(grade, cls, day, period) {
        const current = this.db.schedules[grade][cls][day][period];
        const newVal = prompt(`تعديل ${grade} ${cls} - ${day} حصة ${period.replace('p','')}:`, current);
        if (newVal !== null) {
            this.db.schedules[grade][cls][day][period] = newVal.trim() === "" ? "-" : newVal;
            await supabase.from('schedules').upsert({ grade, class: cls, day, period, value: newVal.trim() === "" ? "-" : newVal });
            this.addNotif('class', grade+'-'+cls, `تحديث جدول ${grade} ${cls}: ${day} حصة ${period.replace('p','')} أصبحت ${newVal || 'فراغ'}`);
            this.renderAdminSchedule(grade, cls);
        }
    },

    renderTeacherEditSchedule(teacherId) {
        const container = document.getElementById('teacher-edit-container-admin');
        if (!container) return;
        const teacher = this.db.systemUsers.find(u => u.s === teacherId);
        const sched = this.db.teacherSchedules[teacherId] || {};
        let html = `<h4>جدول الأستاذ: ${teacher.n}</h4><table class="main-table"><thead><tr><th>اليوم</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th></tr></thead><tbody>`;
        ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"].forEach(d => {
            html += `<tr><td>${d}</td>`;
            for (let i=1;i<=7;i++) {
                const p='p'+i;
                const val = sched[d]?.[p] || '-';
                html += `<td onclick="app.editTeacherCell('${teacherId}','${d}','${p}')">${val}</td>`;
            }
            html += `</tr>`;
        });
        html += `</tbody></table>`;
        container.innerHTML = html;
    },

    async editTeacherCell(teacherId, day, period) {
        const current = this.db.teacherSchedules[teacherId][day][period];
        const n = prompt(`الشعبة (أ,ب,ج,د,تج) أو - :`, current);
        if (n !== null) {
            this.db.teacherSchedules[teacherId][day][period] = n.trim() === "" ? "-" : n;
            await supabase.from('teacher_schedules').upsert({ teacher_id: teacherId, day, period, value: n.trim() === "" ? "-" : n });
            this.renderTeacherEditSchedule(teacherId);
        }
    },

    renderAssignTeachersTab() {
        const section = document.getElementById('tab-admin-assign-teachers');
        if (!section) return;
        let html = '<div class="card"><h3>تعيين مربي الصفوف</h3>';
        for (let grade in this.gradesConfig) {
            html += `<h4>${grade}</h4>`;
            this.gradesConfig[grade].forEach(cls => {
                const current = this.db.classTeachers[grade]?.[cls] || '';
                html += `<div><label>${cls}:</label>
                <select onchange="app.assignClassTeacher('${grade}','${cls}', this.value)">
                    <option value="">-- بدون --</option>
                    ${this.db.systemUsers.filter(u=>u.r==='teacher').map(t=>`<option value="${t.s}" ${current==t.s?'selected':''}>${t.n}</option>`).join('')}
                </select></div>`;
            });
        }
        html += '</div>';
        section.innerHTML = html;
    },

    async assignClassTeacher(grade, cls, teacherId) {
        if (!this.db.classTeachers[grade]) this.db.classTeachers[grade] = {};
        this.db.classTeachers[grade][cls] = teacherId || null;
        await this.updateClassTeacher(grade, cls, teacherId);
        this.addNotif('class', grade+'-'+cls, `تم تعيين ${teacherId ? this.db.systemUsers.find(u=>u.s===teacherId)?.n : 'لا أحد'} كمربي صف لـ ${grade} ${cls}`);
        this.showToast("تم التعيين", "success");
    },

    renderPrintReportsTab() {
        const section = document.getElementById('tab-admin-print-reports');
        if (!section) return;
        const grades = Object.keys(this.gradesConfig).map(g => `<option value="${g}">${g}</option>`).join('');
        section.innerHTML = `<div class="card"><h3>طباعة النتائج</h3><select id="report-grade-select">${grades}</select><select id="report-class-select"></select><button onclick="app.printStudentReports()">طباعة</button></div>`;
        document.getElementById('report-grade-select').onchange = function() {
            document.getElementById('report-class-select').innerHTML = (app.gradesConfig[this.value] || []).map(c => `<option value="${c}">${c}</option>`).join('');
        };
        document.getElementById('report-grade-select').dispatchEvent(new Event('change'));
    },

    renderPrintNamesTab() {
        const section = document.getElementById('tab-admin-print-names');
        if (!section) return;
        const grades = Object.keys(this.gradesConfig).map(g => `<option value="${g}">${g}</option>`).join('');
        section.innerHTML = `<div class="card"><h3>طباعة أسماء الطلاب</h3><select id="print-grade-select">${grades}</select><select id="print-class-select"></select><button onclick="app.printStudentList()">طباعة</button><button onclick="app.downloadStudentList()">Excel</button></div>`;
        document.getElementById('print-grade-select').onchange = function() {
            document.getElementById('print-class-select').innerHTML = (app.gradesConfig[this.value] || []).map(c => `<option value="${c}">${c}</option>`).join('');
        };
        document.getElementById('print-grade-select').dispatchEvent(new Event('change'));
    },

    printStudentList() {
        const grade = document.getElementById('print-grade-select')?.value;
        const cls = document.getElementById('print-class-select')?.value;
        if (!grade || !cls) return this.showToast("اختر الصف", "warning");
        const students = this.db.systemUsers.filter(u => u.r === 'student' && u.grade === grade && u.c === cls);
        let content = `<h2>قائمة طلاب ${grade} ${cls}</h2><ul>${students.map(s => `<li>${s.n} - ${s.s}</li>`).join('')}</ul>`;
        const win = window.open('', '_blank');
        if (win) { win.document.write(content); win.document.close(); win.print(); }
    },

    downloadStudentList() {
        const grade = document.getElementById('print-grade-select')?.value;
        const cls = document.getElementById('print-class-select')?.value;
        if (!grade || !cls) return this.showToast("اختر الصف", "warning");
        const students = this.db.systemUsers.filter(u => u.r === 'student' && u.grade === grade && u.c === cls);
        const data = [["الاسم", "الرقم التسلسلي"]];
        students.forEach(s => data.push([s.n, s.s]));
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "الطلاب");
        XLSX.writeFile(wb, `طلاب_${grade}_${cls}.xlsx`);
    },

    printStudentReports() {
        const grade = document.getElementById('report-grade-select')?.value;
        const cls = document.getElementById('report-class-select')?.value;
        if (!grade || !cls) return this.showToast("اختر الصف", "warning");
        const students = this.db.systemUsers.filter(u => u.r === 'student' && u.grade === grade && u.c === cls);
        if (!students.length) { this.showToast("لا يوجد طلاب.", "info"); return; }
        let html = '';
        students.forEach(student => {
            const grades = this.db.grades[student.s] || {};
            let subjects = [], totalSum = 0;
            for (let sub in grades) {
                const g = grades[sub];
                const t = (Number(g.m1)||0)+(Number(g.m2)||0)+(Number(g.m3)||0)+(Number(g.fin)||0);
                totalSum += t;
                subjects.push({ name: sub, m1: g.m1, m2: g.m2, m3: g.m3, fin: g.fin, total: t });
            }
            const percentage = subjects.length ? (totalSum/(subjects.length*100)*100).toFixed(1) : 0;
            const teacherId = this.db.classTeachers[grade]?.[cls];
            const teacher = teacherId ? this.db.systemUsers.find(u=>u.s===teacherId) : null;
            const teacherName = teacher ? teacher.n : "________________";
            html += `<div style="page-break-after: always; padding:20px; border:2px solid #000; margin:20px auto; max-width:800px;">
                        <div style="text-align:center;"><h2>مدرسة اسكان المالية والزراعة</h2><h3>مدير المدرسة: د/ أسامة حمدان الرقب</h3><h3>كشف العلامات - الفصل الثاني</h3><p>العام الدراسي 2025/2026</p></div>
                        <div style="display:flex; justify-content:space-between;"><p><b>اسم الطالب:</b> ${student.n}</p><p><b>الصف:</b> ${grade}</p><p><b>الشعبة:</b> ${cls}</p></div>
                        <table border="1" width="100%" cellpadding="5"><thead><tr><th>المادة</th><th>ش1</th><th>ش2</th><th>ش3</th><th>نهائي</th><th>المجموع</th></tr></thead><tbody>
                        ${subjects.map(s=>`<tr><td>${s.name}</td><td>${s.m1||0}</td><td>${s.m2||0}</td><td>${s.m3||0}</td><td>${s.fin||0}</td><td style="font-weight:bold">${s.total}</td></tr>`).join('')}
                        </tbody></table>
                        <div style="margin-top:20px;text-align:center;"><p><b>المعدل التراكمي: ${percentage}%</b></p></div>
                        <div style="display:flex; justify-content:space-between; margin-top:40px;"><div><p>${teacherName}</p><hr><small>توقيع مربي الصف</small></div><div><p>________________</p><hr><small>الخاتم الرسمي</small></div><div><p>________________</p><hr><small>توقيع ولي الأمر</small></div></div>
                    </div>`;
        });
        const win = window.open('', '_blank');
        if (win) { win.document.write(`<html dir="rtl"><head><title>نتائج ${grade} ${cls}</title></head><body>${html}</body></html>`); win.document.close(); win.print(); }
    },

    renderTeacherSubjectsTab() {
        const section = document.getElementById('tab-admin-teacher-subjects');
        if (!section) return;
        const teachers = this.db.systemUsers.filter(u => u.r === 'teacher');
        section.innerHTML = `<div class="card"><h3>مواد المعلمين</h3>
            <select id="teacher-subject-select"><option value="">اختر معلماً</option>${teachers.map(t=>`<option value="${t.s}">${t.n}</option>`).join('')}</select>
            <div id="teacher-assignment-panel"></div>
        </div>`;
        document.getElementById('teacher-subject-select').onchange = function() { if (this.value) app.renderAssignmentPanel(this.value); else document.getElementById('teacher-assignment-panel').innerHTML = ''; };
    },

    renderAssignmentPanel(teacherId) {
        const container = document.getElementById('teacher-assignment-panel');
        if (!container) return;
        const assignments = this.db.teacherAssignments[teacherId] ? [this.db.teacherAssignments[teacherId]] : [];
        let html = `<h4>المواد الحالية</h4>`;
        if (assignments.length === 0 || !assignments[0]?.subject) html += `<p style="color:#888;">لا توجد مواد معينة بعد.</p>`;
        else {
            assignments.forEach((ass, idx) => {
                html += `<div style="border:1px solid var(--border-light); padding:10px; margin-bottom:10px; border-radius:8px;">
                    <b>${ass.subject}</b>
                    <button onclick="app.removeTeacherSubject('${teacherId}', ${idx})" style="float:left; background:#dc3545; color:white; border:none; border-radius:4px; cursor:pointer;">حذف</button>
                    <br>الصفوف/الشعب: ${ass.classes.map(c => c.grade + ' ' + c.cls).join('، ') || 'لا يوجد'}
                </div>`;
            });
        }
        html += `<hr><h4>إضافة مادة جديدة</h4>
            <select id="new-subject-select">${this.subjectsList.map(s=>`<option value="${s}">${s}</option>`).join('')}</select>
            <div id="grade-class-checkboxes"></div>
            <button onclick="app.saveTeacherSubject('${teacherId}')">حفظ المادة</button>`;
        container.innerHTML = html;
        const checksDiv = document.getElementById('grade-class-checkboxes');
        let cboxes = '';
        for (let grade in this.gradesConfig) {
            this.gradesConfig[grade].forEach(cls => {
                cboxes += `<label style="margin-right:8px;"><input type="checkbox" value="${grade}|${cls}"> ${grade} ${cls}</label>`;
            });
        }
        checksDiv.innerHTML = cboxes;
    },

    async saveTeacherSubject(teacherId) {
        const subject = document.getElementById('new-subject-select').value;
        if (!subject) return this.showToast("اختر مادة", "warning");
        const checkboxes = document.querySelectorAll('#grade-class-checkboxes input[type="checkbox"]:checked');
        const classes = [];
        checkboxes.forEach(cb => { const [grade, cls] = cb.value.split('|'); classes.push({ grade, cls }); });
        if (classes.length === 0) return this.showToast("اختر صفًا واحدًا على الأقل", "warning");
        const assignment = { teacher_id: teacherId, subject, classes };
        const { error } = await supabase.from('teacher_assignments').upsert(assignment);
        if (error) return this.showToast("فشل الحفظ", "error");
        this.db.teacherAssignments[teacherId] = { subject, classes };
        this.renderAssignmentPanel(teacherId);
        this.showToast("تمت إضافة المادة بنجاح", "success");
    },

    async removeTeacherSubject(teacherId, index) {
        await supabase.from('teacher_assignments').delete().eq('teacher_id', teacherId);
        delete this.db.teacherAssignments[teacherId];
        this.renderAssignmentPanel(teacherId);
    },

    renderPublishNotificationTab() {
        const section = document.getElementById('tab-admin-publish-notification');
        if (!section) return;
        section.innerHTML = `<div class="card"><h3>نشر إشعار عام</h3><textarea id="global-notif-text" rows="3" style="width:100%;"></textarea><button onclick="app.publishGlobalNotification()">إرسال</button></div>`;
    },

    async publishGlobalNotification() {
        const text = document.getElementById('global-notif-text').value.trim();
        if (!text) return this.showToast("أدخل نص الإشعار", "warning");
        await this.addNotif('all', '', text);
        document.getElementById('global-notif-text').value = '';
        this.showToast("تم النشر", "success");
    },

    renderGroupManagement() {
        const container = document.getElementById('tab-admin-group-manage');
        if (!container) return;
        const groupsListHtml = this.db.groups.length ?
            this.db.groups.map(g => `
                <div style="border:1px solid var(--border-light); padding:8px; margin-bottom:8px; border-radius:8px;">
                    ${g.name}
                    <button onclick="app.deleteGroup('${g.id}')" style="background:#dc3545; color:white; margin-right:10px; border:none; padding:4px 10px; border-radius:5px;">🗑️ حذف كامل</button>
                </div>
            `).join('') : '<p>لا توجد مجموعات بعد</p>';

        container.innerHTML = `
            <div class="card">
                <h3>➕ إنشاء مجموعة جديدة</h3>
                <input type="text" id="group-name-new-mgmt" placeholder="اسم المجموعة" style="width:100%; margin-bottom:8px;">
                <select id="group-type-mgmt" style="width:100%; margin-bottom:8px;">
                    <option value="classes">اختيار شعب</option>
                    <option value="all">جميع من في النظام</option>
                    <option value="teachers">جميع المعلمين</option>
                    <option value="individual">أرقام تسلسلية فردية</option>
                </select>
                <div id="class-selection-panel-mgmt" style="display:none; margin-bottom:8px;">
                    <select id="class-grade-select-mgmt"></select>
                    <select id="class-class-select-mgmt"></select>
                </div>
                <div id="individual-serials-panel" style="display:none; margin-bottom:8px;">
                    <textarea id="group-individual-serials" placeholder="أدخل الأرقام التسلسلية مفصولة بفواصل أو مسافات (مثال: 101,102,103)" rows="2" style="width:100%;"></textarea>
                </div>
                <button onclick="app.createGroupFromMgmt()" style="background:var(--primary-dark); color:white; border:none; padding:8px; border-radius:6px;">إنشاء المجموعة</button>
            </div>
            <div class="card">
                <h3>🗑️ حذف المجموعات</h3>
                <div id="groups-list-admin">${groupsListHtml}</div>
            </div>
            <div class="card">
                <h3>⚙️ إدارة المجموعات (إضافة/طرد أعضاء)</h3>
                <select id="group-manage-select" style="padding:8px; width:100%; margin-bottom:15px;"></select>
                <div id="group-members-list" style="margin-bottom:15px;"></div>
                <div style="display:flex; gap:10px; margin-bottom:10px;">
                    <input id="new-member-serial" placeholder="الرقم التسلسلي للعضو الجديد" style="flex:1;">
                    <button onclick="app.addMemberToGroup()" style="background:var(--primary-dark); color:white; border:none; padding:8px 15px; border-radius:6px;">➕ إضافة عضو</button>
                </div>
                <div style="display:flex; gap:10px;">
                    <input id="kick-member-serial" placeholder="الرقم التسلسلي للعضو المطلوب طرده" style="flex:1;">
                    <button onclick="app.kickMemberFromGroup()" style="background:#dc3545; color:white; border:none; padding:8px 15px; border-radius:6px;">🚫 طرد من المجموعة</button>
                </div>
            </div>
        `;

        document.getElementById('group-type-mgmt').onchange = function() {
            const classPanel = document.getElementById('class-selection-panel-mgmt');
            const individualPanel = document.getElementById('individual-serials-panel');
            if (this.value === 'classes') {
                classPanel.style.display = 'block';
                individualPanel.style.display = 'none';
                app.populateGradesClassesMgmt();
            } else if (this.value === 'individual') {
                classPanel.style.display = 'none';
                individualPanel.style.display = 'block';
            } else {
                classPanel.style.display = 'none';
                individualPanel.style.display = 'none';
            }
        };

        this.populateGradesClassesMgmt();
        const select = document.getElementById('group-manage-select');
        select.innerHTML = this.db.groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
        select.onchange = () => this.renderGroupMembers(select.value);
        if (this.db.groups.length) this.renderGroupMembers(this.db.groups[0].id);
    },

    populateGradesClassesMgmt() {
        const gradeSel = document.getElementById('class-grade-select-mgmt');
        if (!gradeSel) return;
        gradeSel.innerHTML = Object.keys(this.gradesConfig).map(g => `<option value="${g}">${g}</option>`).join('');
        gradeSel.onchange = () => { document.getElementById('class-class-select-mgmt').innerHTML = this.gradesConfig[gradeSel.value].map(c => `<option value="${c}">${c}</option>`).join(''); };
        gradeSel.dispatchEvent(new Event('change'));
    },

    async createGroupFromMgmt() {
        const name = document.getElementById('group-name-new-mgmt')?.value.trim();
        if (!name) return this.showToast("أدخل اسم المجموعة", "warning");
        const type = document.getElementById('group-type-mgmt').value;
        let members = [];
        const users = this.db.systemUsers;
        if (type === 'all') members = users.map(u => u.s);
        else if (type === 'teachers') members = users.filter(u => u.r === 'teacher').map(u => u.s);
        else if (type === 'classes') {
            const grade = document.getElementById('class-grade-select-mgmt').value;
            const cls = document.getElementById('class-class-select-mgmt').value;
            if (!grade || !cls) return this.showToast("يرجى اختيار الصف والشعبة", "warning");
            members = users.filter(u => u.r === 'student' && u.grade === grade && u.c === cls).map(u => u.s);
            if (members.length === 0) return this.showToast("لا يوجد طلاب في هذه الشعبة", "error");
        } else if (type === 'individual') {
            const serialsText = document.getElementById('group-individual-serials')?.value.trim();
            if (!serialsText) return this.showToast("يرجى إدخال أرقام تسلسلية", "warning");
            const serials = serialsText.split(/[\s,]+/).filter(s => s.length > 0);
            members = serials.filter(s => users.some(u => u.s === s));
            if (members.length === 0) return this.showToast("جميع الأرقام المدخلة غير موجودة", "error");
        }
        if (!members.includes(this.user.s)) members.push(this.user.s);

        const { data, error } = await supabase.from('groups').insert({
            name,
            members: JSON.stringify(members),
            messages: JSON.stringify([]),
            allowExit: true,
            whoCanPost: 'all'
        }).select('id').single();

        if (error || !data) return this.showToast("فشل في إنشاء المجموعة", "error");

        this.db.groups.push({
            id: data.id.toString(),
            name,
            members,
            messages: [],
            allowExit: true,
            whoCanPost: 'all'
        });
        this.addNotif('all', '', `تم إنشاء مجموعة جديدة: ${name}`);
        this.renderGroupManagement();
        this.showToast("تم إنشاء المجموعة بنجاح", "success");
    },

    async deleteGroup(id) {
        const ok = await this.showConfirm("حذف المجموعة بشكل نهائي؟");
        if (ok) {
            await supabase.from('groups').delete().eq('id', id);
            this.db.groups = this.db.groups.filter(g => g.id != id);
            this.renderGroupManagement();
            this.renderChatList();
            this.showToast("تم حذف المجموعة", "success");
        }
    },

    renderGroupMembers(groupId) {
        const group = this.db.groups.find(g => g.id == groupId);
        const membersDiv = document.getElementById('group-members-list');
        if (!group || !membersDiv) return;
        const users = this.db.systemUsers;
        membersDiv.innerHTML = `<strong>الأعضاء (${group.members.length}):</strong><ul style="margin-top:8px;">` +
            group.members.map(m => { const u = users.find(uu => uu.s == m); return `<li>${u ? u.n : m} (${m})</li>`; }).join('') + `</ul>`;
    },

    async addMemberToGroup() {
        const groupId = document.getElementById('group-manage-select').value;
        const serial = document.getElementById('new-member-serial').value.trim();
        if (!serial) return this.showToast("أدخل الرقم التسلسلي", "warning");
        const group = this.db.groups.find(g => g.id == groupId);
        if (!group) return;
        if (group.members.includes(serial)) return this.showToast("العضو موجود بالفعل", "info");
        group.members.push(serial);
        await this.updateGroup(groupId, { members: JSON.stringify(group.members) });
        this.renderGroupMembers(groupId);
        this.addNotif('user', serial, `تمت إضافتك إلى مجموعة ${group.name}`);
        this.showToast("تمت الإضافة", "success");
    },

    async kickMemberFromGroup() {
        const groupId = document.getElementById('group-manage-select').value;
        const serial = document.getElementById('kick-member-serial').value.trim();
        if (!serial) return this.showToast("أدخل الرقم التسلسلي", "warning");
        const group = this.db.groups.find(g => g.id == groupId);
        if (group && group.members.includes(serial)) {
            group.members = group.members.filter(m => m != serial);
            await this.updateGroup(groupId, { members: JSON.stringify(group.members) });
            this.renderGroupMembers(groupId);
            this.addNotif('user', serial, `تم طردك من مجموعة ${group.name}`);
            this.showToast("تم طرد العضو", "success");
        } else this.showToast("العضو غير موجود في المجموعة", "error");
    },

    getTeacherAssignments() { return this.db.teacherAssignments?.[this.user.s] || null; },

    getAllowedClassesWithSubjects() {
        const assignments = this.getTeacherAssignments();
        if (!assignments) return null;
        const allowed = new Map();
        (Array.isArray(assignments) ? assignments : [assignments]).forEach(a => {
            if (a.classes && Array.isArray(a.classes)) {
                a.classes.forEach(c => {
                    if (!allowed.has(c.grade)) allowed.set(c.grade, new Map());
                    const classMap = allowed.get(c.grade);
                    if (!classMap.has(c.cls)) classMap.set(c.cls, []);
                    classMap.get(c.cls).push(a.subject);
                });
            }
        });
        return allowed;
    },

    renderTeacherUI() {
        const container = document.getElementById('grades-table-container');
        if (!container) return;
        const allowedMap = this.getAllowedClassesWithSubjects();
        let gradesOptions = allowedMap ? Array.from(allowedMap.keys()).map(g => `<option value="${g}">${g}</option>`).join('') : '<option value="">لا توجد مواد مخصصة لك بعد</option>';
        container.innerHTML = `
            <div class="card"><h3>📝 إضافة واجب</h3>
                <select id="hw-grade">${gradesOptions}</select>
                <select id="hw-class" style="width:100%; padding:8px; margin-bottom:10px;"></select>
                <select id="hw-subject" style="width:100%; padding:8px; margin-bottom:10px;"></select>
                <input type="text" id="hw-title" placeholder="عنوان الواجب" style="width:100%; padding:8px; margin-bottom:10px;">
                <textarea id="hw-body" placeholder="تفاصيل الواجب" style="width:100%; height:80px; margin-bottom:10px;"></textarea>
                <button onclick="app.postHomework()" style="width:100%;">نشر الواجب</button>
            </div>
            <div class="card"><h3>📊 رصد علامات</h3>
                <select id="grade-select-grading">${gradesOptions}</select>
                <select id="current-grading-class" style="padding:8px;"></select>
                <select id="grading-subject" style="padding:8px; margin-top:8px;"></select>
                <div id="students-list-grading" style="margin-top:15px;"></div>
            </div>
            <button onclick="app.saveAllGrades()" style="position:fixed; bottom:30px; left:30px; background:var(--primary-dark); color:white; border:none; padding:12px 25px; border-radius:50px; cursor:pointer;">💾 حفظ العلامات</button>
        `;
        const updateClassesAndSubjects = (gradeSelectId, classSelectId, subjectSelectId, isGrading = false) => {
            const gradeSelect = document.getElementById(gradeSelectId);
            const classSelect = document.getElementById(classSelectId);
            const subjectSelect = document.getElementById(subjectSelectId);
            if (!gradeSelect) return;
            const update = () => {
                const grade = gradeSelect.value;
                let classes = [];
                if (allowedMap && allowedMap.has(grade)) {
                    classes = Array.from(allowedMap.get(grade).keys());
                    if (classSelect) classSelect.innerHTML = classes.map(c => `<option value="${c}">${c}</option>`).join('');
                } else {
                    if (classSelect) classSelect.innerHTML = '<option value="">لا توجد شعب</option>';
                }
                const selectedClass = classSelect?.value;
                if (selectedClass && allowedMap && allowedMap.has(grade)) {
                    const subjects = allowedMap.get(grade).get(selectedClass) || [];
                    if (subjectSelect) subjectSelect.innerHTML = subjects.map(s => `<option value="${s}">${s}</option>`).join('');
                } else {
                    if (subjectSelect) subjectSelect.innerHTML = '<option value="">لا توجد مواد</option>';
                }
                if (isGrading && grade && selectedClass && subjectSelect?.value) this.renderStudentsForGrades(grade, selectedClass, subjectSelect.value);
            };
            gradeSelect.onchange = update;
            if (classSelect) classSelect.onchange = update;
            update();
        };
        updateClassesAndSubjects('hw-grade', 'hw-class', 'hw-subject', false);
        updateClassesAndSubjects('grade-select-grading', 'current-grading-class', 'grading-subject', true);
        document.getElementById('grading-subject').onchange = () => {
            const grade = document.getElementById('grade-select-grading').value;
            const cls = document.getElementById('current-grading-class').value;
            const subject = document.getElementById('grading-subject').value;
            if (grade && cls && subject) app.renderStudentsForGrades(grade, cls, subject);
        };
    },

    renderStudentsForGrades(grade, cls, subject) {
        const div = document.getElementById('students-list-grading');
        if (!div) return;
        const students = this.db.systemUsers.filter(u => u.r === 'student' && u.grade === grade && u.c === cls);
        if (!students.length) { div.innerHTML = "<p>لا يوجد طلاب في هذه الشعبة</p>"; return; }
        let html = `<table class="main-table"><thead><tr><th>الطالب</th><th>ش1</th><th>ش2</th><th>ش3</th><th>نهائي</th><th>المجموع</th></tr></thead><tbody>`;
        students.forEach(s => {
            const g = (this.db.grades[s.s] && this.db.grades[s.s][subject]) ? this.db.grades[s.s][subject] : {m1:0, m2:0, m3:0, fin:0};
            const total = (Number(g.m1)||0)+(Number(g.m2)||0)+(Number(g.m3)||0)+(Number(g.fin)||0);
            html += `<tr data-sid="${s.s}" data-subject="${subject}">
                        <td>${s.n}</td>
                        <td><input type="number" class="grade-input m1" value="${g.m1}" oninput="app.calcRowTotal(this)"></td>
                        <td><input type="number" class="grade-input m2" value="${g.m2}" oninput="app.calcRowTotal(this)"></td>
                        <td><input type="number" class="grade-input m3" value="${g.m3}" oninput="app.calcRowTotal(this)"></td>
                        <td><input type="number" class="grade-input fin" value="${g.fin}" oninput="app.calcRowTotal(this)"></td>
                        <td class="row-total">${total}</td>
                    </tr>`;
        });
        div.innerHTML = html + `</tbody></table>`;
    },

    calcRowTotal(input) {
        const row = input.closest('tr');
        const m1 = Number(row.querySelector('.m1').value) || 0;
        const m2 = Number(row.querySelector('.m2').value) || 0;
        const m3 = Number(row.querySelector('.m3').value) || 0;
        const fin = Number(row.querySelector('.fin').value) || 0;
        row.querySelector('.row-total').innerText = m1 + m2 + m3 + fin;
    },

    async saveAllGrades() {
        const rows = document.querySelectorAll('#students-list-grading tr[data-sid]');
        const grade = document.getElementById('grade-select-grading').value;
        const cls = document.getElementById('current-grading-class').value;
        const subject = document.getElementById('grading-subject').value;
        if (!rows.length) return this.showToast("اختر صفاً وشعبة ومادة أولاً!", "warning");
        if (!subject) return this.showToast("اختر المادة أولاً", "warning");
        const allowed = this.getAllowedClassesWithSubjects();
        if (allowed && (!allowed.get(grade)?.get(cls)?.includes(subject))) return this.showToast("ليس لديك صلاحية لرصد علامات هذه المادة لهذه الشعبة.", "error");
        for (let row of rows) {
            const sid = row.getAttribute('data-sid');
            const m1 = row.querySelector('.m1').value || 0;
            const m2 = row.querySelector('.m2').value || 0;
            const m3 = row.querySelector('.m3').value || 0;
            const fin = row.querySelector('.fin').value || 0;
            if (!this.db.grades[sid]) this.db.grades[sid] = {};
            this.db.grades[sid][subject] = { m1, m2, m3, fin };
            await this.upsertGrade(sid, subject, m1, m2, m3, fin);
        }
        this.addNotif('class', grade + '-' + cls, `تم رصد علامات ${subject} لـ ${grade} ${cls}`);
        this.showToast("تم حفظ العلامات بنجاح", "success");
    },

    async postHomework() {
        const grade = document.getElementById('hw-grade').value;
        const cls = document.getElementById('hw-class').value;
        const subject = document.getElementById('hw-subject').value;
        const title = document.getElementById('hw-title').value.trim();
        const body = document.getElementById('hw-body').value.trim();
        if (!title || !body || !grade || !cls || !subject) return this.showToast("املأ جميع الحقول", "warning");
        const allowed = this.getAllowedClassesWithSubjects();
        if (allowed && (!allowed.get(grade)?.get(cls)?.includes(subject))) return this.showToast("ليس لديك صلاحية لإضافة واجب لهذه المادة لهذه الشعبة.", "error");
        if (!this.db.homeworks[grade]) this.db.homeworks[grade] = {};
        if (!this.db.homeworks[grade][cls]) this.db.homeworks[grade][cls] = [];
        this.db.homeworks[grade][cls].unshift({ t: this.user.n, s: title, c: body, sub: subject, d: new Date().toLocaleDateString('ar-EG') });
        await this.addHomework(grade, cls, this.user.n, title, body, subject, new Date().toLocaleDateString('ar-EG'));
        this.addNotif('class', grade + '-' + cls, `واجب جديد في ${subject}: ${title}`);
        this.showToast("تم نشر الواجب", "success");
        document.getElementById('hw-title').value = '';
        document.getElementById('hw-body').value = '';
    },

    renderTeacherOwnSchedule() {
        const sc = document.getElementById('schedule-table-container');
        if (!sc) return;
        const sched = this.db.teacherSchedules[this.user.s];
        if (!sched) { sc.innerHTML = "<p>لا يوجد جدول بعد.</p>"; return; }
        sc.innerHTML = `<h2>📅 جدولي الأسبوعي</h2>` + this.renderScheduleTable(sched, false);
    },

    // ========== عرض بيانات الطالب ==========
    renderStudentSchedule() {
        const sc = document.getElementById('schedule-table-container');
        if (!sc) return;
        const sched = this.db.schedules[this.user.grade]?.[this.user.c];
        if (!sched) { sc.innerHTML = "<p>لا يوجد جدول بعد.</p>"; return; }
        sc.innerHTML = `<h2>📅 جدولي - ${this.user.grade} ${this.user.c}</h2>` + this.renderScheduleTable(sched, false) +
                       `<div id="homework-display"></div><div id="student-grades-display"></div>`;
        this.renderStudentData();
    },

    renderStudentData() {
        this.renderStudentHomeworks();
        const div = document.getElementById('student-grades-display');
        if (!div) return;
        const myGrades = this.db.grades[this.user.s] || {};
        let html = `<h3>📊 كشف علاماتي</h3><table class="main-table"><thead><tr><th>المادة</th><th>ش1</th><th>ش2</th><th>ش3</th><th>نهائي</th><th>المجموع</th></tr></thead><tbody>`;
        let totalSum = 0, count = 0;
        for (let sub in myGrades) {
            const g = myGrades[sub];
            const t = (Number(g.m1)||0)+(Number(g.m2)||0)+(Number(g.m3)||0)+(Number(g.fin)||0);
            html += `<tr><td>${sub}</td><td>${g.m1||0}</td><td>${g.m2||0}</td><td>${g.m3||0}</td><td>${g.fin||0}</td><td style="font-weight:bold">${t}</td></tr>`;
            totalSum += t; count++;
        }
        if (count === 0) html += `<tr><td colspan="6" style="color:#888;">لا توجد علامات</td></tr></tbody></table>`;
        else {
            const percentage = ((totalSum / (count * 100)) * 100).toFixed(1);
            html += `</tbody></table><div style="margin-top:15px; background:#eef2f5; padding:10px; border-radius:12px; text-align:center;">📈 المعدل المئوي: ${percentage}% <button onclick="app.downloadStudentOwnReport()" style="background:var(--primary-dark); color:white; border:none; padding:6px 12px; border-radius:20px;">📥 تحميل</button></div>`;
        }
        div.innerHTML = html;
    },

    downloadStudentOwnReport() {
        const student = this.user;
        const grades = this.db.grades[student.s] || {};
        let subjects = [], totalSum = 0;
        for (let sub in grades) {
            const g = grades[sub];
            const t = (Number(g.m1)||0)+(Number(g.m2)||0)+(Number(g.m3)||0)+(Number(g.fin)||0);
            totalSum += t;
            subjects.push({ name: sub, m1: g.m1, m2: g.m2, m3: g.m3, fin: g.fin, total: t });
        }
        const percentage = subjects.length ? (totalSum/(subjects.length*100)*100).toFixed(1) : 0;
        const teacherId = this.db.classTeachers[student.grade]?.[student.c];
        const teacher = teacherId ? this.db.systemUsers.find(u=>u.s===teacherId) : null;
        const teacherName = teacher ? teacher.n : "________________";
        const html = `<div style="padding:20px; font-family:'Segoe UI'; max-width:700px; margin:auto; border:2px solid #000;">
            <div style="text-align:center;"><h2>مدرسة اسكان المالية والزراعة</h2><h3>مدير المدرسة: د/ أسامة حمدان الرقب</h3><h3>كشف العلامات - الفصل الثاني</h3><p>العام الدراسي 2025/2026</p></div>
            <div><p><b>اسم الطالب:</b> ${student.n} - <b>الصف:</b> ${student.grade} <b>الشعبة:</b> ${student.c}</p></div>
            <table border="1" width="100%"><thead><tr><th>المادة</th><th>ش1</th><th>ش2</th><th>ش3</th><th>نهائي</th><th>المجموع</th></tr></thead><tbody>${subjects.map(s=>`<tr><td>${s.name}</td><td>${s.m1||0}</td><td>${s.m2||0}</td><td>${s.m3||0}</td><td>${s.fin||0}</td><td style="font-weight:bold">${s.total}</td></tr>`).join('')}</tbody></table>
            <div><p><b>المعدل التراكمي: ${percentage}%</b></p></div>
            <div><p>${teacherName}</p><hr><small>توقيع مربي الصف</small></div>
        </div>`;
        const win = window.open('', '_blank');
        if (win) { win.document.write(`<html dir="rtl"><head><title>تقرير علاماتي</title></head><body>${html}</body></html>`); win.document.close(); win.print(); }
    },

    renderStudentHomeworks() {
        const container = document.getElementById('homework-display');
        if (!container) return;
        const grade = this.user.grade, cls = this.user.c;
        const list = this.db.homeworks[grade]?.[cls] || [];
        const hidden = this.db.hiddenHomeworks[this.user.s] || [];
        let html = `<h3>📚 واجبات ${grade} ${cls}</h3>`;
        const visibleList = list.filter(h => !hidden.includes(h.s + h.d + h.c));
        if (visibleList.length === 0) html += "<p style='color:#888;'>لا توجد واجبات حالياً.</p>";
        else {
            visibleList.forEach(h => {
                html += `<div class="card" style="border-right:4px solid var(--primary-light); margin-bottom:10px;">
                            <div><b>${h.s}</b> - ${h.d} <button onclick="app.hideHomework('${h.s}','${h.d}','${h.c}')" style="float:left; background:none; border:none; color:#dc3545;">❌</button></div>
                            <p>${h.c}</p><small>بواسطة: ${h.t} (${h.sub || ''})</small>
                        </div>`;
            });
        }
        container.innerHTML = html;
    },

    hideHomework(title, date, content) {
        if (!this.db.hiddenHomeworks[this.user.s]) this.db.hiddenHomeworks[this.user.s] = [];
        const id = title + date + content;
        if (!this.db.hiddenHomeworks[this.user.s].includes(id)) {
            this.db.hiddenHomeworks[this.user.s].push(id);
            this.syncLocalStorage();
            this.renderStudentHomeworks();
        }
    },

    // ========== المحادثات ==========
    handleFileSelection(files) {
        if (!files || files.length === 0) return;
        if (files.length > 15) return this.showToast("الحد الأقصى 15 صورة", "warning");
        this.pendingFiles = [...this.pendingFiles, ...Array.from(files)];
        this.renderImagePreviews();
    },

    renderImagePreviews() {
        const previewArea = document.getElementById('image-preview-area');
        if (!previewArea) return;
        previewArea.innerHTML = '';
        this.pendingFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const div = document.createElement('div');
                div.className = 'preview-item';
                div.innerHTML = `<img src="${e.target.result}" /><button class="remove-btn" onclick="app.pendingFiles.splice(${index},1); app.renderImagePreviews();">✕</button>`;
                previewArea.appendChild(div);
            };
            reader.readAsDataURL(file);
        });
    },

    openImage(url) {
        const modal = document.getElementById('image-modal');
        const img = document.getElementById('modal-img');
        if (modal && img) { img.src = url; modal.classList.remove('hidden'); }
    },

    async sendMessage() {
        const inp = document.getElementById('chat-msg');
        if (!inp || !this.activeChat) return;
        const text = inp.value.trim();
        const hasFiles = this.pendingFiles.length > 0;
        if (!text && !hasFiles) return;

        if (this.activeChat.t === 'user') {
            const receiverId = this.activeChat.id;
            if (!this.db.contacts[receiverId]) this.db.contacts[receiverId] = [];
            if (!this.db.contacts[receiverId].includes(this.user.s)) {
                this.db.contacts[receiverId].push(this.user.s);
                this.syncLocalStorage();
            }
        }

        let uploadedUrls = [];
        if (hasFiles) {
            this.showUploadLoader(true);
            try { uploadedUrls = await this.uploadImagesToStorage(this.pendingFiles); } catch (e) { this.showUploadLoader(false); return; }
            this.showUploadLoader(false);
        }

        const msg = {
            senderId: this.user.s, senderName: this.user.n,
            time: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }),
            text: text || '', images: uploadedUrls, reactions: [], deletedFor: []
        };

        if (this.activeChat.t === 'group') {
            const group = this.db.groups.find(g => g.id == this.activeChat.id);
            if (group) {
                if (group.whoCanPost === 'admin' && this.user.r !== 'admin') return this.showToast("🔒 هذه المجموعة تسمح للمدير فقط بالإرسال.", "warning");
                group.messages.push(msg);
                await this.updateGroup(group.id, { messages: JSON.stringify(group.messages) });
            }
        } else {
            const cid = [this.user.s, this.activeChat.id].sort().join('_');
            if (!this.db.directMessages[cid]) this.db.directMessages[cid] = [];
            this.db.directMessages[cid].push(msg);
            await this.saveDirectMessages(cid, this.db.directMessages[cid]);
            this.addNotif('user', this.activeChat.id, `رسالة جديدة من ${this.user.n}`);
        }

        this.renderMessages();
        inp.value = '';
        this.pendingFiles = [];
        document.getElementById('image-preview-area').innerHTML = '';
        document.getElementById('chat-image-input').value = '';
    },

    linkify(text) {
        const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
        return text.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
    },

    getCurrentChatMessages() {
        if (!this.activeChat) return [];
        return this.activeChat.t === 'group'
            ? (this.db.groups.find(g => g.id == this.activeChat.id)?.messages || [])
            : (this.db.directMessages[[this.user.s, this.activeChat.id].sort().join('_')] || []);
    },

    renderMessages() {
        const box = document.getElementById('chat-box');
        if (!box || !this.activeChat) return;
        let msgs = this.getCurrentChatMessages();
        let html = '';
        let lastSender = null;
        msgs.forEach((m, idx) => {
            if (m.deletedFor?.includes(this.user.s)) return;
            let content = '';
            if (m.images?.length) m.images.forEach(url => content += `<img src="${url}" style="max-width:200px; border-radius:8px; margin:2px; cursor:pointer;" />`);
            if (m.text) content += `<div>${this.linkify(m.text)}</div>`;
            let reactions = '';
            if (m.reactions?.length) {
                const grouped = {}; m.reactions.forEach(r => { grouped[r.emoji] = grouped[r.emoji] || []; grouped[r.emoji].push(r.userId); });
                reactions = '<div class="reactions-row">' + Object.entries(grouped).map(([em, ids]) => `<span style="cursor:pointer; margin-left:5px;" onclick="app.showReactionDetails(${idx}, '${em}')">${em} ${ids.length}</span>`).join('') + '</div>';
            }
            const isSameSender = (lastSender === m.senderId);
            const className = `message ${m.senderId === this.user.s ? 'sent' : 'received'}${isSameSender ? ' same-sender' : ''}`;
            html += `<div class="${className}" data-msg-index="${idx}">
                        ${this.activeChat.t === 'group' && m.senderId !== this.user.s && !isSameSender ? `<small>${m.senderName}</small>` : ''}
                        <div class="bubble">${content}<span class="time">${m.time}</span>${reactions}</div>
                    </div>`;
            lastSender = m.senderId;
        });
        if (msgs.length === 0) html = `<div class="system-message">🏫 <b>إدارة المدرسة</b><br><small>يمكنك بدء المحادثة عن طريق إضافة جهة اتصال من القائمة الجانبية.</small></div>`;
        box.innerHTML = html;
        box.scrollTop = box.scrollHeight;
    },

    showReactionDetails(index, emoji) {
        const msgs = this.getCurrentChatMessages();
        const msg = msgs[index];
        if (!msg?.reactions) return;
        const users = this.db.systemUsers;
        const names = msg.reactions.filter(r => r.emoji === emoji).map(r => users.find(u => u.s === r.userId)?.n || r.userId);
        this.showToast(`تفاعل ${emoji}: ${names.join('، ') || 'لا أحد'}`, 'info');
    },

    showMessageContext(event, index) {
        const existing = document.querySelector('.context-menu');
        if (existing) existing.remove();
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.cssText = 'position:fixed; background:var(--bg-card); border:1px solid var(--border-light); border-radius:8px; padding:5px 0; z-index:9999; direction:rtl;';
        const copy = app.createMenuItem('📋 نسخ', () => { app.copyMessage(index); menu.remove(); });
        const delMe = app.createMenuItem('🗑️ حذف لدي', () => { app.deleteMessage(index, 'me'); menu.remove(); });
        const delAll = app.createMenuItem('🗑️ حذف للجميع', () => { app.deleteMessage(index, 'everyone'); menu.remove(); });
        const separator = document.createElement('div'); separator.style.borderBottom = '1px solid var(--border-light)'; separator.style.margin = '5px 0';
        const emojiTitle = document.createElement('div'); emojiTitle.innerText = 'تفاعل:'; emojiTitle.style.padding = '5px 20px';
        const emojiContainer = document.createElement('div'); emojiContainer.style.cssText = 'display:flex; justify-content:space-around; padding:5px 10px;';
        ['👍', '😂', '😢', '😊', '😍', '❤️'].forEach(emoji => {
            const span = document.createElement('span'); span.textContent = emoji; span.style.cssText = 'cursor:pointer; font-size:1.4rem;';
            span.onclick = () => { app.toggleReaction(index, emoji); menu.remove(); };
            emojiContainer.appendChild(span);
        });
        menu.append(copy, delMe, delAll, separator, emojiTitle, emojiContainer);
        document.body.appendChild(menu);
        const x = event.clientX || (event.touches && event.touches[0].clientX);
        const y = event.clientY || (event.touches && event.touches[0].clientY);
        menu.style.top = y + 'px'; menu.style.left = x + 'px';
        setTimeout(() => {
            const rect = menu.getBoundingClientRect();
            if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 10) + 'px';
            if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
        }, 10);
        const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); } };
        setTimeout(() => document.addEventListener('click', close), 100);
    },

    createMenuItem(text, onClick) {
        const div = document.createElement('div');
        div.innerText = text;
        div.style.cssText = 'padding:8px 20px; cursor:pointer;';
        div.onclick = onClick;
        return div;
    },

    copyMessage(index) {
        const msgs = this.getCurrentChatMessages();
        if (!msgs[index] || !msgs[index].text) return this.showToast('لا يوجد نص لنسخه', 'info');
        navigator.clipboard.writeText(msgs[index].text).then(() => this.showToast('تم النسخ', 'success')).catch(() => this.showToast('فشل النسخ', 'error'));
    },

    async deleteMessage(index, scope) {
        const msgs = this.getCurrentChatMessages();
        if (!msgs[index]) return;
        if (scope === 'everyone') {
            if (this.user.r === 'admin' || msgs[index].senderId === this.user.s) {
                msgs.splice(index, 1);
                if (this.activeChat.t === 'group') {
                    const group = this.db.groups.find(g => g.id == this.activeChat.id);
                    if (group) await this.updateGroup(group.id, { messages: JSON.stringify(group.messages) });
                } else {
                    const cid = [this.user.s, this.activeChat.id].sort().join('_');
                    await this.saveDirectMessages(cid, msgs);
                }
                this.renderMessages();
                this.showToast('تم الحذف للجميع', 'success');
            } else this.showToast('لا صلاحيات', 'error');
        } else if (scope === 'me') {
            if (!msgs[index].deletedFor) msgs[index].deletedFor = [];
            if (!msgs[index].deletedFor.includes(this.user.s)) {
                msgs[index].deletedFor.push(this.user.s);
                if (this.activeChat.t === 'group') {
                    const group = this.db.groups.find(g => g.id == this.activeChat.id);
                    if (group) await this.updateGroup(group.id, { messages: JSON.stringify(group.messages) });
                } else {
                    const cid = [this.user.s, this.activeChat.id].sort().join('_');
                    await this.saveDirectMessages(cid, msgs);
                }
                this.renderMessages();
                this.showToast('تم الحذف من جهازك', 'success');
            }
        }
    },

    async toggleReaction(index, emoji) {
        const msgs = this.getCurrentChatMessages();
        const msg = msgs[index];
        if (!msg) return;
        if (!msg.reactions) msg.reactions = [];
        const existing = msg.reactions.findIndex(r => r.userId === this.user.s && r.emoji === emoji);
        if (existing > -1) msg.reactions.splice(existing, 1);
        else { msg.reactions = msg.reactions.filter(r => r.userId !== this.user.s); msg.reactions.push({ userId: this.user.s, emoji }); }
        if (this.activeChat.t === 'group') {
            const group = this.db.groups.find(g => g.id == this.activeChat.id);
            if (group) await this.updateGroup(group.id, { messages: JSON.stringify(group.messages) });
        } else {
            const cid = [this.user.s, this.activeChat.id].sort().join('_');
            await this.saveDirectMessages(cid, msgs);
        }
        this.renderMessages();
    },

    renderChatList() {
        const div = document.getElementById('group-list');
        if (!div) return;
        if (!this.db.contacts[this.user.s]) this.db.contacts[this.user.s] = [];
        const myContacts = this.db.contacts[this.user.s];
        let html = '<h4 style="padding:15px; margin:0; background:var(--primary-dark); color:white;">📋 المحادثات</h4>';
        html += `<div style="padding:12px; display:flex; gap:8px;">
            <input type="text" id="contact-serial-input" placeholder="أدخل الرقم التسلسلي..." style="flex:1; padding:8px; border-radius:6px;">
            <button onclick="app.addContact()" style="background:var(--primary-dark); color:white; border:none; padding:8px 15px; border-radius:6px;">➕ تواصل</button>
        </div>`;
        const userGroups = this.db.groups.filter(g => g.members.includes(this.user.s));
        if (userGroups.length) {
            html += '<div style="padding:8px 15px; background:var(--sidebar-bg); color:white;">📢 المجموعات</div>';
            userGroups.forEach(g => {
                let leaveBtn = '';
                if (this.user.r === 'teacher') leaveBtn = `<button onclick="event.stopPropagation(); app.forceLeaveGroup('${g.id}')" style="background:#dc3545; color:white; margin-right:8px; border:none; border-radius:4px; padding:2px 8px;">🚪 خروج</button>`;
                else if (g.allowExit) leaveBtn = `<button onclick="event.stopPropagation(); app.leaveGroup('${g.id}')" style="background:#dc3545; color:white; margin-right:8px; border:none; border-radius:4px; padding:2px 8px;">🚪 مغادرة</button>`;
                html += `<div class="chat-item" data-chat-id="group-${g.id}" onclick="app.openChat('group','${g.id}')">
                            <div class="chat-avatar">👥</div><div class="chat-info"><b>${g.name}</b></div>${leaveBtn}</div>`;
            });
        }
        html += '<div style="padding:8px 15px; background:var(--sidebar-bg); color:white;">👤 جهات اتصالي</div>';
        if (myContacts.length === 0) html += '<p style="text-align:center; padding:25px; color:#888;">لا توجد جهات اتصال بعد.</p>';
        else {
            myContacts.forEach(contactId => {
                const user = this.db.systemUsers.find(u => u.s == contactId);
                if (user) {
                    const pfp = this.db.pfp[user.s] || "https://cdn-icons-png.flaticon.com/512/149/149071.png";
                    const roleText = user.r === 'teacher' ? 'معلم - ' + user.sub : user.r === 'admin' ? 'مدير النظام' : 'طالب';
                    html += `<div class="chat-item" data-chat-id="user-${user.s}" onclick="app.openChat('user','${user.s}')">
                                <img src="${pfp}" width="40" height="40" style="border-radius:50%; margin-left:12px;">
                                <div class="chat-info"><b>${user.n}</b><br><small>${roleText}</small></div>
                                <button onclick="event.stopPropagation(); app.deleteContact('${user.s}')" style="margin-right:auto; background:none; border:none; color:#dc3545; cursor:pointer;">✕</button>
                            </div>`;
                }
            });
        }
        div.innerHTML = html;
        if (this.activeChat) {
            const id = this.activeChat.t === 'group' ? `group-${this.activeChat.id}` : `user-${this.activeChat.id}`;
            const selected = div.querySelector(`.chat-item[data-chat-id="${id}"]`);
            if (selected) selected.style.backgroundColor = 'var(--primary-light)';
        }
        if (window.innerWidth <= 768) document.querySelector('.chat-container')?.classList.add('show-sidebar');
    },

    async forceLeaveGroup(groupId) {
        const group = this.db.groups.find(g => g.id == groupId);
        if (!group || !group.members.includes(this.user.s)) return this.showToast("لست عضواً", "error");
        group.members = group.members.filter(m => m !== this.user.s);
        group.messages.push({ senderId:"system", senderName:"النظام", time:new Date().toLocaleTimeString(), text:`📢 خرج الأستاذ ${this.user.n} من المجموعة`, images:[], reactions:[], deletedFor:[] });
        await this.updateGroup(groupId, { members: JSON.stringify(group.members), messages: JSON.stringify(group.messages) });
        if (this.activeChat?.id == groupId) this.renderMessages();
        this.renderChatList();
        this.showToast("تمت المغادرة بنجاح", "success");
    },

    async leaveGroup(groupId) {
        const group = this.db.groups.find(g => g.id == groupId);
        if (!group || !group.allowExit || !group.members.includes(this.user.s)) return;
        group.members = group.members.filter(m => m !== this.user.s);
        await this.updateGroup(groupId, { members: JSON.stringify(group.members) });
        if (this.activeChat?.id == groupId) { this.activeChat = null; document.getElementById('chat-header').innerHTML = 'اختر محادثة لبدء الدردشة'; document.getElementById('chat-box').innerHTML = ''; }
        this.renderChatList();
        this.showToast("تمت المغادرة بنجاح", "success");
    },

    deleteContact(serial) {
        if (this.db.contacts[this.user.s]) this.db.contacts[this.user.s] = this.db.contacts[this.user.s].filter(s => s !== serial);
        this.syncLocalStorage();
        this.renderChatList();
        this.showToast("تم حذف جهة الاتصال", "success");
    },

    addContact() {
        const input = document.getElementById('contact-serial-input');
        const serial = input.value.trim();
        if (!serial) return this.showToast("الرجاء إدخال رقم تسلسلي.", "warning");
        const targetUser = this.db.systemUsers.find(u => u.s === serial);
        if (!targetUser) return this.showToast("⚠️ الرقم التسلسلي غير صحيح أو غير موجود.", "error");
        if (targetUser.s === this.user.s) return this.showToast("لا يمكنك إضافة نفسك!", "warning");
        if (!this.db.contacts[this.user.s]) this.db.contacts[this.user.s] = [];
        if (this.db.contacts[this.user.s].includes(serial)) return this.showToast("جهة الاتصال موجودة بالفعل.", "info");
        this.db.contacts[this.user.s].push(serial);
        this.syncLocalStorage();
        this.renderChatList();
        input.value = '';
        this.addNotif('user', serial, `أضافك ${this.user.n} إلى جهات الاتصال`);
        this.showToast(`تم إضافة ${targetUser.n} إلى جهات الاتصال بنجاح.`, "success");
    },

    openChat(type, id) {
        this.activeChat = { t: type, id: id };
        this.renderChatHeader();
        this.renderMessages();
        document.querySelectorAll('.chat-item').forEach(i => i.style.backgroundColor = '');
        const selectedId = type === 'group' ? `group-${id}` : `user-${id}`;
        const selected = document.querySelector(`.chat-item[data-chat-id="${selectedId}"]`);
        if (selected) selected.style.backgroundColor = 'var(--primary-light)';
        if (window.innerWidth <= 768) {
            const container = document.querySelector('.chat-container');
            if (container) { container.classList.remove('show-sidebar'); container.classList.add('show-chat'); }
        }
    },

    goBackToChatList() {
        if (window.innerWidth <= 768) {
            const container = document.querySelector('.chat-container');
            if (container) { container.classList.remove('show-chat'); container.classList.add('show-sidebar'); }
        }
    },

    renderChatHeader() {
        const header = document.getElementById('chat-header');
        if (!header || !this.activeChat) return;
        let name = "", leaveBtn = "";
        if (this.activeChat.t === 'group') {
            const group = this.db.groups.find(g => g.id == this.activeChat.id);
            if (group) {
                name = group.name;
                if (this.user.r === 'teacher') leaveBtn = `<button onclick="app.forceLeaveGroup('${group.id}')" style="margin-right:auto; background:#dc3545; color:white; border:none; padding:5px 12px; border-radius:5px;">🚪 خروج إجباري</button>`;
                else if (group.allowExit) leaveBtn = `<button onclick="app.leaveGroup('${group.id}')" style="margin-right:auto; background:#dc3545; color:white; border:none; padding:5px 12px; border-radius:5px;">🚪 مغادرة</button>`;
            }
        } else {
            name = this.db.systemUsers.find(u => u.s == this.activeChat.id)?.n || "";
        }
        header.innerHTML = `<button class="back-btn" onclick="app.goBackToChatList()">←</button> <span>محادثة مع <b>${name}</b></span> ${leaveBtn}`;
    },

    toggleEmojiPicker() {
        const picker = document.getElementById('emoji-picker');
        if (!picker) return;
        if (picker.classList.contains('hidden')) {
            const emojis = ['😀','😂','😍','😢','😡','👍','👎','❤️','🔥','🎉','🤔','🙏'];
            picker.innerHTML = emojis.map(e => `<span onclick="app.insertEmoji('${e}')">${e}</span>`).join('');
            picker.classList.remove('hidden');
        } else picker.classList.add('hidden');
    },

    insertEmoji(emoji) {
        const input = document.getElementById('chat-msg');
        if (input) { input.value += emoji; input.focus(); }
        document.getElementById('emoji-picker')?.classList.add('hidden');
    },

    renderPfp() {
        const url = this.db.pfp[this.user.s] || "https://cdn-icons-png.flaticon.com/512/149/149071.png";
        const container = document.getElementById('user-pfp-container');
        if (container) container.innerHTML = `<img src="${url}" title="اضغط لتغيير الصورة" style="width:70px; height:70px; border-radius:50%; border:2px solid white; cursor:pointer;" onclick="app.changePfp()">`;
    },

    changePfp() {
        const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => { this.db.pfp[this.user.s] = event.target.result; this.syncLocalStorage(); this.renderPfp(); this.showToast("تم تحديث الصورة الشخصية", "success"); };
            reader.readAsDataURL(file);
        };
        input.click();
    },

    uploadImagesToStorage: async function(files) {
        const urls = [];
        const apiKey = '61a13af2500a490eb2774b734a3c2ee8';
        for (const file of files) {
            const formData = new FormData();
            formData.append('image', file);
            try {
                const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, { method: 'POST', body: formData });
                const data = await response.json();
                if (data.success) urls.push(data.data.url);
                else this.showToast('فشل رفع الصورة', 'error');
            } catch (error) {
                this.showToast('فشل رفع الصورة، تأكد من الإنترنت', 'error');
                throw error;
            }
        }
        return urls;
    },

    showUploadLoader(show) {
        const overlay = document.getElementById('upload-overlay');
        if (overlay) overlay.style.display = show ? 'flex' : 'none';
    },

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === '1') { e.preventDefault(); this.switchTab('schedule'); }
            else if (e.ctrlKey && e.key === '2') { e.preventDefault(); this.switchTab('chat'); }
        });
    },

    setupChatInputHandler() {
        const chatInput = document.getElementById('chat-msg');
        if (!chatInput) return;
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); this.sendMessage(); }
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

    applyTheme() {
        const saved = localStorage.getItem('schoolTheme');
        if (saved === 'dark') document.body.classList.add('dark');
        else document.body.classList.remove('dark');
        const btn = document.getElementById('themeToggleBtn');
        if (btn) btn.innerText = saved === 'dark' ? '☀️' : '🌙';
    },

    toggleTheme() {
        const isDark = document.body.classList.toggle('dark');
        localStorage.setItem('schoolTheme', isDark ? 'dark' : 'light');
        const btn = document.getElementById('themeToggleBtn');
        if (btn) btn.innerText = isDark ? '☀️' : '🌙';
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
    }
};

window.app = app;
app.init();