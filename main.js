const app = {
    user: null,
    activeChat: null,
    db: {},

    firestoreDoc: null,

    init: function() {
        if (typeof firebase === 'undefined' || !firebase.firestore) {
            alert("Firebase غير جاهز. تأكد من إعداد index.html بشكل صحيح.");
            return;
        }

        this.firestoreDoc = firebase.firestore().collection('data').doc('main');

        this.loadDataFromFirestore().then(() => {
            this.ensureDataIntegrity();
            this.bindEvents();
        }).catch(err => {
            console.error("فشل تحميل البيانات:", err);
            alert("تعذر الاتصال بقاعدة البيانات. جارٍ استخدام بيانات افتراضية.");
            this.initDefaultData();
            this.ensureDataIntegrity();
            this.bindEvents();
        });
    },

    loadDataFromFirestore: function() {
        return this.firestoreDoc.get().then(doc => {
            if (doc.exists) {
                this.db = doc.data();
            } else {
                this.initDefaultData();
                return this.firestoreDoc.set(this.db);
            }
        });
    },

    initDefaultData: function() {
        this.db = {
            schedules: {"أ": {}, "ب": {}, "ج": {}, "د": {}},
            teacherSchedules: {"201": {}, "202": {}, "203": {}, "204": {}},
            grades: {},
            groups: [],
            directMessages: {},
            notifs: [],
            pfp: {},
            homeworks: {"أ": [], "ب": [], "ج": [], "د": []},
            contacts: {},
            hiddenHomeworks: {},
            classTeachers: {"أ": null, "ب": null, "ج": null, "د": null}
        };
    },

    ensureDataIntegrity: function() {
        if (!this.db.teacherSchedules) this.db.teacherSchedules = {};
        if (!this.db.contacts) this.db.contacts = {};
        if (!this.db.hiddenHomeworks) this.db.hiddenHomeworks = {};
        if (!this.db.classTeachers) this.db.classTeachers = {"أ": null, "ب": null, "ج": null, "د": null};
        if (!this.db.schedules["أ"] || Object.keys(this.db.schedules["أ"]).length === 0) this.setupClassSchedules();
        if (!this.db.teacherSchedules["201"] || Object.keys(this.db.teacherSchedules["201"]).length === 0) this.setupTeacherSchedules();
    },

    bindEvents: function() {
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) loginBtn.onclick = () => this.doLogin();
        this.setupEnterKey();
        window.onclick = (e) => { if (!e.target.closest('.notif-wrapper')) document.getElementById('notif-dropdown')?.classList.add('hidden'); };
    },

    setupClassSchedules: function() {
        ["أ","ب","ج","د"].forEach(c => {
            this.db.schedules[c] = {};
            ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"].forEach(d => {
                this.db.schedules[c][d] = {p1:"-",p2:"-",p3:"-",p4:"-",p5:"-",p6:"-",p7:"-"};
            });
        });
        this.sync();
    },

    setupTeacherSchedules: function() {
        ["201","202","203","204"].forEach(tid => {
            this.db.teacherSchedules[tid] = {};
            ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"].forEach(d => {
                this.db.teacherSchedules[tid][d] = {p1:"-",p2:"-",p3:"-",p4:"-",p5:"-",p6:"-",p7:"-"};
            });
        });
        this.sync();
    },

    doLogin: function() {
        const s = document.getElementById('serial').value;
        const p = document.getElementById('pass').value;
        const found = database.users.find(u => u.s === s && u.p === p);
        if (found) { this.user = found; this.launch(); }
        else alert("البيانات خاطئة!");
    },

    setupEnterKey: function() {
        const serialInput = document.getElementById('serial');
        const passInput = document.getElementById('pass');
        const loginHandler = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.doLogin();
            }
        };
        if (serialInput) serialInput.addEventListener('keypress', loginHandler);
        if (passInput) passInput.addEventListener('keypress', loginHandler);
    },

    // ========== SYNCHRONIZATION ==========
    sync: function() {
        if (this.firestoreDoc) {
            this.firestoreDoc.set(this.db).catch(err => {
                console.error("فشل حفظ البيانات:", err);
            });
        }
        this.updateBellCount();
    },

    toggleSidebar: function() { document.getElementById('main-system').classList.toggle('mini-sidebar'); },

    launch: function() {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('main-system').classList.remove('hidden');
        document.getElementById('display-name').innerText = this.user.n;
        const roleText = this.user.r === 'student' ? 'طالب' : (this.user.r === 'teacher' ? 'معلم' : 'مدير النظام');
        document.getElementById('display-role').innerText = roleText;
        this.renderPfp();
        this.updateBellCount();
        if (this.user.r === 'teacher') {
            document.getElementById('teacher-tab').classList.remove('hidden');
            this.renderTeacherUI();
            this.switchTab('teacher');
        } else if (this.user.r === 'admin') {
            const scheduleBtn = document.querySelector('aside nav button[onclick*="schedule"]');
            if (scheduleBtn) scheduleBtn.classList.add('hidden');
            this.createAdminSidebarButtons();
            document.getElementById('admin-tab').classList.remove('hidden');
            this.switchTab('admin');
        }
        if (this.user.r === 'student') {
            this.renderStudentSchedule();
            this.switchTab('schedule');
        }
    },

    createAdminSidebarButtons: function() {
        const nav = document.querySelector('aside nav');
        if (!nav) return;
        const existingCustom = nav.querySelectorAll('.custom-admin-btn');
        existingCustom.forEach(b => b.remove());
        const btn1 = document.createElement('button');
        btn1.className = 'custom-admin-btn';
        btn1.innerHTML = '<i>📜</i> <span>طباعة النتائج</span>';
        btn1.onclick = () => app.switchTab('admin-print-reports');
        nav.appendChild(btn1);
        const btn2 = document.createElement('button');
        btn2.className = 'custom-admin-btn';
        btn2.innerHTML = '<i>📋</i> <span>طباعة أسماء الطلاب</span>';
        btn2.onclick = () => app.switchTab('admin-print-names');
        nav.appendChild(btn2);
        const btn3 = document.createElement('button');
        btn3.className = 'custom-admin-btn';
        btn3.innerHTML = '<i>👨‍🏫</i> <span>تعيين مربي الصفوف</span>';
        btn3.onclick = () => app.switchTab('admin-assign-teachers');
        nav.appendChild(btn3);
    },

    // ---------- الإشعارات ----------
    toggleNotifs: function(e) {
        if (e) e.stopPropagation();
        const dd = document.getElementById('notif-dropdown');
        if (dd) {
            dd.classList.toggle('hidden');
            if (!dd.classList.contains('hidden')) this.renderNotifsList();
        }
    },

    updateBellCount: function() {
        if (!this.user) return;
        const myNotifs = this.db.notifs.filter(n => n.type === 'all' || (n.type === 'class' && n.val === this.user.c) || (n.type === 'user' && n.val === this.user.s));
        const unread = myNotifs.filter(n => !n.readBy.includes(this.user.s)).length;
        const count = document.getElementById('bell-count');
        if (count) { count.innerText = unread; count.style.display = unread > 0 ? 'block' : 'none'; }
    },

    renderNotifsList: function() {
        const list = this.db.notifs.filter(n => n.type === 'all' || (n.type === 'class' && n.val === this.user.c) || (n.type === 'user' && n.val === this.user.s));
        const container = document.getElementById('notif-list');
        if (!container) return;
        if (list.length === 0) container.innerHTML = '<p style="text-align:center; padding:10px; color:#888;">لا توجد إشعارات</p>';
        else {
            container.innerHTML = list.map(n => {
                const isRead = n.readBy.includes(this.user.s);
                if (!isRead) n.readBy.push(this.user.s);
                return `<div style="padding:12px; border-bottom:1px solid #eee; background:${isRead ? 'white' : '#f0f9ff'}; border-right:3px solid ${isRead ? 'transparent' : 'var(--primary-dark)'}">
                            <div style="font-size:13px; font-weight:500;">${n.msg}</div>
                            <small style="color:#aaa;">${n.time}</small>
                        </div>`;
            }).join('');
            this.sync();
        }
    },

    addNotif: function(targetType, targetValue, msg) {
        const n = { id: Date.now(), type: targetType, val: targetValue, msg: msg, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}), readBy: [] };
        this.db.notifs.unshift(n);
        if (this.db.notifs.length > 30) this.db.notifs.pop();
        this.sync();
    },

    // ---------- التبويبات ----------
    switchTab: function(id) {
        document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
        if (id.startsWith('admin-') && !document.getElementById('tab-' + id)) {
            const section = document.createElement('section');
            section.id = 'tab-' + id;
            section.className = 'admin-sub-tab';
            document.getElementById('content-area')?.appendChild(section);
        }
        const target = document.getElementById('tab-' + id);
        if (target) target.classList.remove('hidden');
        if (id === 'chat') this.renderChatList();
        if (id === 'admin') this.renderAdminMain();
        if (id === 'admin-print-reports') this.renderPrintReportsTab();
        if (id === 'admin-print-names') this.renderPrintNamesTab();
        if (id === 'admin-assign-teachers') this.renderAssignTeachersTab();
        if (id === 'schedule') {
            if (this.user.r === 'student') this.renderStudentSchedule();
            else if (this.user.r === 'teacher') this.renderTeacherOwnSchedule();
        }
    },

    // ================== ADMIN ==================
    renderAdminMain: function() {
        const container = document.getElementById('admin-main-container');
        if (!container) return;
        container.innerHTML = `
            <div class="card">
                <h3>📚 تعديل جدول الطلاب</h3>
                <select id="admin-class-select" style="margin-bottom:15px; padding:10px; width:100%; border-radius:10px;">
                    <option value="أ">تاسع أ</option><option value="ب">تاسع ب</option><option value="ج">تاسع ج</option><option value="د">تاسع د</option>
                </select>
                <div id="admin-schedule-edit-area"></div>
            </div>
            <div class="card">
                <h3>👨‍🏫 تعديل جداول المعلمين</h3>
                <select id="teacher-select-admin" style="margin-bottom:15px; padding:10px; width:100%; border-radius:10px;">
                    <option value="">-- اختر معلماً --</option>
                    ${database.users.filter(u=>u.r==='teacher').map(t=>`<option value="${t.s}">${t.n} - ${t.sub}</option>`).join('')}
                </select>
                <div id="teacher-edit-container-admin"></div>
            </div>
            <div class="card">
                <h3>👥 إنشاء مجموعة محادثة جديدة</h3>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <input type="text" id="group-name" placeholder="اسم المجموعة">
                    <input type="text" id="group-members" placeholder="الأرقام التسلسلية (افصل بفاصلة ,)">
                    <label><input type="checkbox" id="allow-exit" checked> السماح للأعضاء بالمغادرة</label>
                    <select id="who-can-post"><option value="all">الجميع يرسل</option><option value="admin">المدير فقط</option></select>
                    <button onclick="app.createGroup()" style="background:var(--primary-dark); color:white; border:none; padding:10px; border-radius:8px;">إنشاء المجموعة</button>
                </div>
            </div>
        `;
        const classSelect = document.getElementById('admin-class-select');
        classSelect.onchange = () => this.renderAdminSchedule(classSelect.value);
        this.renderAdminSchedule("أ");

        const teacherSelect = document.getElementById('teacher-select-admin');
        teacherSelect.onchange = () => {
            const tid = teacherSelect.value;
            if (tid) this.renderTeacherEditSchedule(tid);
            else document.getElementById('teacher-edit-container-admin').innerHTML = '';
        };
    },

    renderAdminSchedule: function(className) {
        const container = document.getElementById('admin-schedule-edit-area');
        if (!container) return;
        const sched = this.db.schedules[className];
        let html = `<table class="main-table"><thead><tr><th>اليوم</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th></tr></thead><tbody>`;
        const days = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"];
        days.forEach(day => {
            html += `<tr><td><b>${day}</b></td>`;
            for (let i = 1; i <= 7; i++) {
                const period = 'p' + i;
                const value = sched[day][period];
                html += `<td onclick="app.editClassSub('${className}','${day}','${period}')" style="cursor:pointer; background:#fff;" 
                         onmouseover="this.style.background='#eef2f7'" onmouseout="this.style.background='#fff'">${value}</td>`;
            }
            html += `</tr>`;
        });
        html += `</tbody></table>`;
        container.innerHTML = html;
    },

    editClassSub: function(className, day, period) {
        const current = this.db.schedules[className][day][period];
        const newValue = prompt(`تعديل حصة يوم ${day} - الحصة ${period.replace('p','')}:`, current);
        if (newValue !== null && newValue !== undefined) {
            this.db.schedules[className][day][period] = newValue.trim() === "" ? "-" : newValue;
            this.addNotif('class', className, `تحديث الجدول: ${day} ${period} أصبح ${newValue || 'فراغ'}`);
            this.sync();
            this.renderAdminSchedule(className);
        }
    },

    renderTeacherEditSchedule: function(teacherId) {
        const container = document.getElementById('teacher-edit-container-admin');
        if (!container || !teacherId) { if(container) container.innerHTML = ""; return; }
        const teacher = database.users.find(u => u.s === teacherId);
        const sched = this.db.teacherSchedules[teacherId];
        let html = `<h4 style="margin:10px 0;">جدول الأستاذ: ${teacher.n} (${teacher.sub})</h4>
                    <table class="main-table"><thead><tr><th>اليوم</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th></tr></thead><tbody>`;
        ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"].forEach(d => {
            html += `<tr><td><b>${d}</b></td>`;
            for(let i=1;i<=7;i++){
                const p='p'+i;
                html += `<td onclick="app.editTeacherCell('${teacherId}','${d}','${p}')" style="cursor:pointer; background:#fff;" 
                         onmouseover="this.style.background='#eef2f7'" onmouseout="this.style.background='#fff'">${sched[d][p]}</td>`;
            }
            html += `</tr>`;
        });
        html += `</tbody></table>`;
        container.innerHTML = html;
    },

    editTeacherCell: function(teacherId, day, period) {
        const current = this.db.teacherSchedules[teacherId][day][period];
        const n = prompt(`أدخل الشعبة التي يدرسها (مثال: أ, ب, ج, د) أو (-) لفراغ:`, current);
        if (n !== null) {
            this.db.teacherSchedules[teacherId][day][period] = n.trim() === "" ? "-" : n;
            this.sync();
            this.renderTeacherEditSchedule(teacherId);
        }
    },

    renderPrintReportsTab: function(){
        const section = document.getElementById('tab-admin-print-reports');
        if(!section) return;
        section.innerHTML = `<div class="card"><h3>📜 طباعة النتائج (شهادات)</h3><select id="report-class-select" style="padding:6px;"><option value="أ">شعبة أ</option><option value="ب">ب</option><option value="ج">ج</option><option value="د">د</option></select><button onclick="app.printStudentReports()" style="background:var(--primary-dark); color:white; margin-top:10px; padding:8px 15px; border:none; border-radius:6px;">🖨️ طباعة</button></div>`;
    },

    renderPrintNamesTab: function(){
        const section = document.getElementById('tab-admin-print-names');
        if(!section) return;
        section.innerHTML = `<div class="card"><h3>📋 طباعة أسماء الطلاب</h3><select id="print-class-select" style="padding:6px;"><option value="أ">أ</option><option value="ب">ب</option><option value="ج">ج</option><option value="د">د</option></select><button onclick="app.printStudentList()" style="background:var(--primary-dark); color:white; margin:5px; padding:8px 15px; border:none; border-radius:6px;">🖨️ طباعة</button><button onclick="app.downloadStudentList()" style="background:var(--primary-dark); color:white; padding:8px 15px; border:none; border-radius:6px;">📥 تنزيل Excel</button></div>`;
    },

    renderAssignTeachersTab: function(){
        const section = document.getElementById('tab-admin-assign-teachers');
        if(!section) return;
        let html = `<div class="card"><h3>👨‍🏫 تعيين مربي الصفوف</h3>`;
        ["أ","ب","ج","د"].forEach(c=>{
            const currentTeacherId = this.db.classTeachers[c] || "";
            html += `<div style="margin-bottom:10px;"><label>شعبة ${c}: </label>
            <select onchange="app.assignClassTeacher('${c}', this.value)" style="padding:5px;">
                <option value="">-- بدون --</option>
                ${database.users.filter(u=>u.r==='teacher').map(t=>`<option value="${t.s}" ${currentTeacherId==t.s?'selected':''}>${t.n} (${t.sub})</option>`).join('')}
            </select></div>`;
        });
        html += `</div>`;
        section.innerHTML = html;
    },

    assignClassTeacher: function(className, teacherId){
        this.db.classTeachers[className] = teacherId || null;
        this.sync();
        alert(`تم تعيين مربي صف لشعبة ${className} بنجاح.`);
    },

    printStudentList: function(){
        const cls = document.getElementById('print-class-select')?.value || 'أ';
        const students = database.users.filter(u => u.r === 'student' && u.c === cls);
        let content = `<h2>قائمة طلاب شعبة ${cls}</h2><ul>${students.map(s=>`<li>${s.n} - ${s.s}</li>`).join('')}</ul>`;
        const win = window.open('', '_blank');
        win.document.write(content);
        win.document.close();
        win.print();
    },

    downloadStudentList: function(){
        const cls = document.getElementById('print-class-select')?.value || 'أ';
        const students = database.users.filter(u => u.r === 'student' && u.c === cls);
        let csv = "الاسم,الرقم التسلسلي\n" + students.map(s=>`${s.n},${s.s}`).join("\n");
        const blob = new Blob([csv], {type: 'text/csv'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `طلاب_شعبة_${cls}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    },

    printStudentReports: function(){
        const cls = document.getElementById('report-class-select')?.value || 'أ';
        const students = database.users.filter(u => u.r === 'student' && u.c === cls);
        if(students.length === 0) { alert("لا يوجد طلاب في هذه الشعبة."); return; }
        let html = '';
        students.forEach(student => {
            const grades = this.db.grades[student.s] || {};
            let totalSum = 0, subjects = [];
            for(let sub in grades){
                const g = grades[sub];
                const t = (Number(g.m1)||0)+(Number(g.m2)||0)+(Number(g.m3)||0)+(Number(g.fin)||0);
                totalSum += t;
                subjects.push({ name: sub, m1: g.m1, m2: g.m2, m3: g.m3, fin: g.fin, total: t });
            }
            const percentage = subjects.length ? (totalSum/(subjects.length*100)*100).toFixed(1) : 0;
            const teacherId = this.db.classTeachers[cls];
            const teacher = teacherId ? database.users.find(u=>u.s===teacherId) : null;
            const teacherName = teacher ? teacher.n : "________________";
            html += `<div style="page-break-after: always; padding:20px; border:2px solid #000; margin:20px auto; max-width:800px;">
                        <div style="text-align:center;"><h2>مدرسة اسكان المالية والزراعة الأساسية الثانية للبنين</h2><h3>مدير المدرسة: د/ أسامة حمدان الرقب</h3><h3>كشف العلامات - الفصل الدراسي الثاني</h3><p>العام الدراسي 2025/2026</p></div>
                        <div style="display:flex; justify-content:space-between;"><p><b>اسم الطالب:</b> ${student.n}</p><p><b>الصف:</b> التاسع</p><p><b>الشعبة:</b> ${cls}</p></div>
                        <table border="1" width="100%" cellpadding="5"><thead><tr><th>المادة</th><th>ش1</th><th>ش2</th><th>ش3</th><th>نهائي</th><th>المجموع</th></tr></thead><tbody>
                        ${subjects.map(s=>`<tr><td>${s.name}</td><td>${s.m1||0}</td><td>${s.m2||0}</td><td>${s.m3||0}</td><td>${s.fin||0}</td><td><b>${s.total}</b></td></tr>`).join('')}
                        </tbody></table>
                        <div style="margin-top:20px; text-align:center;"><p><b>المعدل التراكمي: ${percentage}%</b></p></div>
                        <div style="display:flex; justify-content:space-between; margin-top:40px;"><div><p>${teacherName}</p><hr><small>توقيع مربي الصف</small></div><div><p>________________</p><hr><small>الخاتم الرسمي</small></div><div><p>________________</p><hr><small>توقيع ولي الأمر</small></div></div>
                    </div>`;
        });
        const win = window.open('', '_blank');
        win.document.write(`<html dir="rtl"><head><title>نتائج شعبة ${cls}</title></head><body>${html}</body></html>`);
        win.document.close();
        win.print();
    },

    // ================== TEACHER ==================
    renderTeacherUI: function(){
        const container = document.getElementById('grades-table-container');
        if(!container) return;
        container.innerHTML = `<div class="card"><h3>📝 إضافة واجب لشعبة</h3>
            <select id="hw-class" style="width:100%; padding:8px; margin-bottom:10px;"><option value="أ">تاسع أ</option><option value="ب">تاسع ب</option><option value="ج">تاسع ج</option><option value="د">تاسع د</option></select>
            <input type="text" id="hw-title" placeholder="عنوان الواجب" style="width:100%; padding:8px; margin-bottom:10px;">
            <textarea id="hw-body" placeholder="تفاصيل الواجب" style="width:100%; height:80px; margin-bottom:10px;"></textarea>
            <button onclick="app.postHomework()" style="background:var(--primary-dark); color:white; padding:10px; border:none; border-radius:8px; width:100%;">نشر الواجب</button>
        </div>
        <div class="card"><h3>📊 رصد علامات: ${this.user.sub}</h3>
            <select id="current-grading-class" onchange="app.renderStudentsForGrades(this.value)" style="padding:8px;"><option value="">-- اختر الشعبة --</option><option value="أ">أ</option><option value="ب">ب</option><option value="ج">ج</option><option value="د">د</option></select>
            <div id="students-list-grading" style="margin-top:15px;"></div>
        </div>
        <button onclick="app.saveAllGrades()" style="position:fixed; bottom:30px; left:30px; background:var(--primary-dark); color:white; border:none; padding:12px 25px; border-radius:50px; cursor:pointer;">💾 حفظ العلامات</button>`;
    },

    renderStudentsForGrades: function(cls){
        const div = document.getElementById('students-list-grading');
        if(!cls) { div.innerHTML = ""; return; }
        const students = database.users.filter(u=>u.r==='student' && u.c===cls);
        let html = `<table class="main-table"><thead><tr><th>الطالب</th><th>ش1</th><th>ش2</th><th>ش3</th><th>نهائي</th><th>المجموع</th></tr></thead><tbody>`;
        students.forEach(s=>{
            const g = (this.db.grades[s.s] && this.db.grades[s.s][this.user.sub]) ? this.db.grades[s.s][this.user.sub] : {m1:0, m2:0, m3:0, fin:0};
            const total = (Number(g.m1)||0)+(Number(g.m2)||0)+(Number(g.m3)||0)+(Number(g.fin)||0);
            html += `<tr data-sid="${s.s}">
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

    calcRowTotal: function(input){
        const row = input.closest('tr');
        const m1 = Number(row.querySelector('.m1').value) || 0;
        const m2 = Number(row.querySelector('.m2').value) || 0;
        const m3 = Number(row.querySelector('.m3').value) || 0;
        const fin = Number(row.querySelector('.fin').value) || 0;
        row.querySelector('.row-total').innerText = m1 + m2 + m3 + fin;
    },

    saveAllGrades: function(){
        const rows = document.querySelectorAll('#students-list-grading tr[data-sid]');
        const cls = document.getElementById('current-grading-class').value;
        if(rows.length === 0) return alert("اختر شعبة أولاً!");
        rows.forEach(row => {
            const sid = row.getAttribute('data-sid');
            if(!this.db.grades[sid]) this.db.grades[sid] = {};
            this.db.grades[sid][this.user.sub] = {
                m1: row.querySelector('.m1').value || 0,
                m2: row.querySelector('.m2').value || 0,
                m3: row.querySelector('.m3').value || 0,
                fin: row.querySelector('.fin').value || 0
            };
        });
        this.addNotif('class', cls, `تم رصد علامات ${this.user.sub} لشعبتكم من قبل ${this.user.n}`);
        this.sync();
        alert("تم حفظ جميع العلامات بنجاح ✅");
    },

    postHomework: function(){
        const cls = document.getElementById('hw-class').value;
        const tit = document.getElementById('hw-title').value;
        const bdy = document.getElementById('hw-body').value;
        if(!tit || !bdy) return alert("الرجاء تعبئة العنوان والتفاصيل");
        this.db.homeworks[cls].unshift({ t: this.user.n, s: tit, c: bdy, d: new Date().toLocaleDateString('ar-EG') });
        this.addNotif('class', cls, `واجب جديد في مادة ${this.user.sub}: ${tit}`);
        this.sync();
        alert("تم نشر الواجب!");
        document.getElementById('hw-title').value = "";
        document.getElementById('hw-body').value = "";
    },

    // ================== STUDENT ==================
    renderStudentSchedule: function(){
        const sc = document.getElementById('schedule-table-container');
        if(!sc) return;
        const s = this.db.schedules[this.user.c];
        let h = `<h2>📅 جدول شعبتي</h2><table class="main-table"><thead><tr><th>اليوم</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th></tr></thead><tbody>`;
        ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"].forEach(d=>{
            h += `<tr><td><b>${d}</b><td>${s[d].p1}</td><td>${s[d].p2}</td><td>${s[d].p3}</td><td>${s[d].p4}</td><td>${s[d].p5}</td><td>${s[d].p6}</td><td>${s[d].p7}</td></tr>`;
        });
        sc.innerHTML = h + `</tbody></table><div id="homework-display"></div><div id="student-grades-display"></div>`;
        this.renderStudentData();
    },

    renderStudentData: function(){
        this.renderStudentHomeworks();
        const div = document.getElementById('student-grades-display');
        if(!div) return;
        const myGrades = this.db.grades[this.user.s] || {};
        let html = `<h3>📊 كشف علاماتي</h3><table class="main-table"><thead><tr><th>المادة</th><th>ش1</th><th>ش2</th><th>ش3</th><th>نهائي</th><th>المجموع</th></tr></thead><tbody>`;
        let totalSum = 0, count = 0;
        for(let sub in myGrades){
            const g = myGrades[sub];
            const t = (Number(g.m1)||0)+(Number(g.m2)||0)+(Number(g.m3)||0)+(Number(g.fin)||0);
            html += `<tr><td>${sub}</td><td>${g.m1}</td><td>${g.m2}</td><td>${g.m3}</td><td>${g.fin}</td><td style="font-weight:bold">${t}</td></tr>`;
            totalSum += t; count++;
        }
        if(count === 0) html += `<tr><td colspan="6" style="color:#888;">لا توجد علامات مرصودة بعد</td></tr>`;
        else {
            const percentage = ((totalSum / (count * 100)) * 100).toFixed(1);
            html += `</tbody></table><div style="margin-top:15px; background:#eef2f5; padding:10px; border-radius:12px; text-align:center;">📈 المعدل المئوي: ${percentage}% <button onclick="app.downloadStudentOwnReport()" style="background:var(--primary-dark); color:white; border:none; padding:6px 12px; border-radius:20px; margin-right:10px;">📥 تحميل</button></div>`;
        }
        div.innerHTML = html;
    },

    downloadStudentOwnReport: function(){
        const student = this.user;
        const grades = this.db.grades[student.s] || {};
        let totalSum = 0, subjects = [];
        for(let sub in grades){
            const g = grades[sub];
            const t = (Number(g.m1)||0)+(Number(g.m2)||0)+(Number(g.m3)||0)+(Number(g.fin)||0);
            totalSum += t;
            subjects.push({ name: sub, m1: g.m1, m2: g.m2, m3: g.m3, fin: g.fin, total: t });
        }
        const percentage = subjects.length ? (totalSum/(subjects.length*100)*100).toFixed(1) : 0;
        const teacherId = this.db.classTeachers[student.c];
        const teacher = teacherId ? database.users.find(u=>u.s===teacherId) : null;
        const teacherName = teacher ? teacher.n : "________________";
        const htmlContent = `<div style="padding:20px; font-family:'Segoe UI'; max-width:700px; margin:auto; border:2px solid #000;">
            <div style="text-align:center;"><h2>مدرسة اسكان المالية والزراعة الأساسية الثانية للبنين</h2><h3>مدير المدرسة: د/ أسامة حمدان الرقب</h3><h3>كشف العلامات - الفصل الدراسي الثاني</h3><p>العام الدراسي 2025/2026</p></div>
            <div><p><b>اسم الطالب:</b> ${student.n} - <b>الشعبة:</b> ${student.c}</p></div>
            <table border="1" width="100%"><thead><tr><th>المادة</th><th>ش1</th><th>ش2</th><th>ش3</th><th>نهائي</th><th>المجموع</th></tr></thead><tbody>${subjects.map(s=>`<tr><td>${s.name}</td><td>${s.m1||0}</td><td>${s.m2||0}</td><td>${s.m3||0}</td><td>${s.fin||0}</td><td><b>${s.total}</b></td></tr>`).join('')}</tbody></table>
            <div><p><b>المعدل التراكمي: ${percentage}%</b></p></div>
            <div><p>${teacherName}</p><hr><small>توقيع مربي الصف</small></div>
        </div>`;
        const win = window.open('', '_blank');
        win.document.write(`<html dir="rtl"><head><title>تقرير علاماتي</title></head><body>${htmlContent}</body></html>`);
        win.document.close();
        win.print();
    },

    renderStudentHomeworks: function(){
        const container = document.getElementById('homework-display');
        if(!container) return;
        const list = this.db.homeworks[this.user.c] || [];
        const hidden = this.db.hiddenHomeworks[this.user.s] || [];
        let html = `<h3>📚 الواجبات المطلوبة</h3>`;
        const visibleList = list.filter(h => !hidden.includes(h.s + h.d + h.c));
        if(visibleList.length === 0) html += "<p style='color:#888;'>لا توجد واجبات حالياً.</p>";
        else visibleList.forEach(h => {
            html += `<div class="card" style="border-right:4px solid var(--primary-light); margin-bottom:10px;"><div><b>${h.s}</b> - ${h.d} <button onclick="app.hideHomework('${h.s}','${h.d}','${h.c}')" style="float:left; background:none; border:none; color:#dc3545;">❌</button></div><p>${h.c}</p><small>بواسطة: ${h.t}</small></div>`;
        });
        container.innerHTML = html;
    },

    hideHomework: function(title, date, content){
        if(!this.db.hiddenHomeworks[this.user.s]) this.db.hiddenHomeworks[this.user.s] = [];
        const id = title + date + content;
        if(!this.db.hiddenHomeworks[this.user.s].includes(id)) this.db.hiddenHomeworks[this.user.s].push(id);
        this.sync();
        this.renderStudentHomeworks();
    },

    renderTeacherOwnSchedule: function(){
        const sc = document.getElementById('schedule-table-container');
        if(!sc) return;
        const sched = this.db.teacherSchedules[this.user.s];
        if(!sched) { sc.innerHTML = "<p>لا يوجد جدول بعد.</p>"; return; }
        let h = `<h2>📅 جدولي الأسبوعي</h2><table class="main-table"><thead><tr><th>اليوم</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th></tr></thead><tbody>`;
        ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"].forEach(d => {
            h += `<tr><td><b>${d}</b></td>`;
            for(let i=1;i<=7;i++){ const p='p'+i; h += `<td>${sched[d][p]}</td>`; }
            h += `</tr>`;
        });
        sc.innerHTML = h + `</tbody></table>`;
    },

    // ================== CHAT ==================
    renderChatList: function(){
        const div = document.getElementById('group-list');
        if(!div) return;
        if(!this.db.contacts) this.db.contacts = {};
        if(!this.db.contacts[this.user.s]) this.db.contacts[this.user.s] = [];
        const myContacts = this.db.contacts[this.user.s];
        let html = '<h4 style="padding:15px; margin:0; background:var(--primary-dark); color:white;">📋 إدارة المدرسة - المحادثات</h4>';
        html += `<div style="padding:12px; display:flex; gap:8px;"><input type="text" id="contact-serial-input" placeholder="أدخل الرقم التسلسلي..." style="flex:1; padding:8px; border-radius:6px;"><button onclick="app.addContact()" style="background:var(--primary-dark); color:white; border:none; padding:8px 15px; border-radius:6px;">➕ تواصل</button></div>`;
        const userGroups = this.db.groups.filter(g => g.members.includes(this.user.s));
        if(userGroups.length){
            html += '<div style="background:#eef2f5; padding:8px 15px;">📢 المجموعات</div>';
            userGroups.forEach(g=>{ html+=`<div class="chat-item" onclick="app.openChat('group','${g.id}')"><div class="chat-avatar">👥</div><div class="chat-info"><b>${g.name}</b></div></div>`; });
        }
        html += '<div style="background:#eef2f5; padding:8px 15px;">👤 جهات اتصالي</div>';
        if(myContacts.length === 0) html += '<p style="text-align:center; padding:25px; color:#888;">لا توجد جهات اتصال بعد.</p>';
        else myContacts.forEach(contactId => {
            const user = database.users.find(u=>u.s == contactId);
            if(user){
                const pfp = this.db.pfp[user.s] || "https://cdn-icons-png.flaticon.com/512/149/149071.png";
                html += `<div class="chat-item" onclick="app.openChat('user','${user.s}')"><img src="${pfp}" width="40" height="40" style="border-radius:50%; margin-left:12px;"><div class="chat-info"><b>${user.n}</b><br><small>${user.r==='teacher'?'معلم - '+user.sub:'طالب'}</small></div></div>`;
            }
        });
        div.innerHTML = html;
    },

    addContact: function(){
        const input = document.getElementById('contact-serial-input');
        const serial = input.value.trim();
        if(!serial) return alert("الرجاء إدخال رقم تسلسلي.");
        const targetUser = database.users.find(u => u.s === serial);
        if(!targetUser) return alert("⚠️ الرقم التسلسلي غير صحيح أو غير موجود.");
        if(targetUser.s === this.user.s) return alert("لا يمكنك إضافة نفسك!");
        if(!this.db.contacts[this.user.s]) this.db.contacts[this.user.s] = [];
        if(this.db.contacts[this.user.s].includes(serial)) return alert("جهة الاتصال موجودة بالفعل.");
        this.db.contacts[this.user.s].push(serial);
        this.sync();
        this.renderChatList();
        input.value = '';
        this.addNotif('user', serial, `أضافك ${this.user.n} إلى جهات الاتصال`);
        alert(`تم إضافة ${targetUser.n} إلى جهات الاتصال بنجاح.`);
    },

    openChat: function(type, id){
        this.activeChat = { t: type, id: id };
        this.renderChatHeader();
        this.renderMessages();
    },

    renderChatHeader: function(){
        const header = document.getElementById('chat-header');
        if(!header || !this.activeChat) return;
        let name = "", leaveBtn = "";
        if(this.activeChat.t === 'group'){
            const group = this.db.groups.find(g => g.id == this.activeChat.id);
            if(group){
                name = group.name;
                if(group.allowExit && group.members.includes(this.user.s)) leaveBtn = `<button onclick="app.leaveGroup('${group.id}')" style="margin-right:auto; background:#dc3545; color:white; border:none; padding:5px 12px; border-radius:5px;">🚪 مغادرة</button>`;
            }
        } else { name = database.users.find(u => u.s == this.activeChat.id)?.n || ""; }
        header.innerHTML = `<span>محادثة مع <b>${name}</b></span> ${leaveBtn}`;
    },

    leaveGroup: function(groupId){
        const group = this.db.groups.find(g => g.id == groupId);
        if(!group || !group.allowExit || !group.members.includes(this.user.s)) return alert("لا يمكن المغادرة.");
        group.members = group.members.filter(m => m !== this.user.s);
        this.sync();
        this.activeChat = null;
        document.getElementById('chat-header').innerHTML = 'اختر محادثة لبدء الدردشة';
        document.getElementById('chat-box').innerHTML = '';
        this.renderChatList();
        alert("تمت مغادرة المجموعة بنجاح.");
    },

    sendMessage: function(){
        const inp = document.getElementById('chat-msg');
        if(!inp || !inp.value.trim() || !this.activeChat) return;
        if(this.activeChat.t === 'group'){
            const group = this.db.groups.find(g => g.id == this.activeChat.id);
            if(group && group.whoCanPost === 'admin' && this.user.r !== 'admin'){ alert("🔒 هذه المجموعة تسمح للمدير فقط بإرسال الرسائل."); return; }
        }
        const msg = { senderId: this.user.s, senderName: this.user.n, text: inp.value, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) };
        if(this.activeChat.t === 'group') this.db.groups.find(g => g.id == this.activeChat.id).messages.push(msg);
        else { const cid = [this.user.s, this.activeChat.id].sort().join('_'); if(!this.db.directMessages[cid]) this.db.directMessages[cid] = []; this.db.directMessages[cid].push(msg); this.addNotif('user', this.activeChat.id, `رسالة جديدة من ${this.user.n}`); }
        inp.value = "";
        this.sync();
        this.renderMessages();
    },

    renderMessages: function(){
        const box = document.getElementById('chat-box');
        if(!box || !this.activeChat) return;
        let msgs = [];
        if(this.activeChat.t === 'group') msgs = this.db.groups.find(g => g.id == this.activeChat.id).messages;
        else { const cid = [this.user.s, this.activeChat.id].sort().join('_'); msgs = this.db.directMessages[cid] || []; }
        let html = '';
        if(msgs.length === 0) html += `<div class="system-message">🏫 <b>إدارة المدرسة</b><br><small>المحادثات مؤمنة ومشفّرة بين الطرفين. لا يمكن لأي شخص آخر الاطلاع عليها.</small></div>`;
        html += msgs.map(m => `<div class="message ${m.senderId === this.user.s ? 'sent' : 'received'}">${this.activeChat.t === 'group' && m.senderId !== this.user.s ? `<small style="display:block; margin-bottom:2px; font-weight:bold;">${m.senderName}</small>` : ''}<div class="bubble">${m.text}<span class="time">${m.time}</span></div></div>`).join('');
        box.innerHTML = html;
        box.scrollTop = box.scrollHeight;
    },

    createGroup: function(){
        const name = document.getElementById('group-name')?.value.trim();
        const membersInput = document.getElementById('group-members')?.value.trim();
        const allowExit = document.getElementById('allow-exit')?.checked ?? true;
        const whoCanPost = document.getElementById('who-can-post')?.value || 'all';
        if(!name || !membersInput) return alert("يرجى إدخال اسم المجموعة والأعضاء");
        const memberSerials = membersInput.split(',').map(s=>s.trim()).filter(s=>s!=='');
        const validMembers = memberSerials.filter(s => database.users.some(u=>u.s===s));
        if(validMembers.length === 0) return alert("لا يوجد أعضاء صالحين.");
        if(!validMembers.includes(this.user.s)) validMembers.push(this.user.s);
        const newGroup = { id: Date.now(), name, members: validMembers, messages: [], allowExit, whoCanPost };
        this.db.groups.push(newGroup);
        this.addNotif('all', '', `تم إنشاء مجموعة جديدة باسم: ${name}`);
        this.sync();
        this.renderChatList();
        document.getElementById('group-name').value = '';
        document.getElementById('group-members').value = '';
        alert("تم إنشاء المجموعة!");
    },

    renderPfp: function(){
        const url = this.db.pfp[this.user.s] || "https://cdn-icons-png.flaticon.com/512/149/149071.png";
        const container = document.getElementById('user-pfp-container');
        if(container) container.innerHTML = `<img src="${url}" title="اضغط لتغيير الصورة" style="width:70px; height:70px; border-radius:50%; border:2px solid white; cursor:pointer;" onclick="app.changePfp()">`;
    },

    changePfp: function(){
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if(!file) return;
            const reader = new FileReader();
            reader.onload = (event) => { this.db.pfp[this.user.s] = event.target.result; this.sync(); this.renderPfp(); };
            reader.readAsDataURL(file);
        };
        input.click();
    }
};

window.onload = () => app.init();