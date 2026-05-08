// admin.js
import { db, gradesConfig, subjectsList, updateClassTeacher, updateTeacherAssignment, addNotification, loadAllDataFromSupabase, updateGroup } from "./db.js";
import { showToast, showConfirm } from "./utils.js";
import { hashPassword } from "./auth.js";
import { supabase } from "./supabase-config.js";

export function initAdminModule(app) {
    app.renderUserManagement = function() {
        const section = document.getElementById('tab-admin-user-management');
        if (!section) return;
        const users = db.systemUsers;
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
    };

    app.showAddUserForm = function() {
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
    };

    app.addNewUser = async function() {
        const s = document.getElementById('new-serial').value.trim();
        const name = document.getElementById('new-name').value.trim();
        const pass = document.getElementById('new-pass').value.trim();
        const role = document.getElementById('new-role').value;
        if (!s || !name || !pass) return showToast("املأ الحقول المطلوبة", "warning");
        if (db.systemUsers.find(u => u.s === s)) return showToast("الرقم التسلسلي موجود مسبقاً", "error");
        const hashed = 'sha256:' + await hashPassword(pass);
        const newUser = { serial: s, name, role, password: hashed };
        if (role === 'student') {
            newUser.grade = document.getElementById('new-grade')?.value || '';
            newUser.class = document.getElementById('new-class')?.value || '';
        } else if (role === 'teacher') {
            newUser.subject = document.getElementById('new-subject')?.value || '';
        }
        const { error } = await supabase.from('users').insert(newUser);
        if (error) return showToast("فشلت الإضافة", "error");
        await loadAllDataFromSupabase();
        app.renderUserManagement();
        showToast("تم إضافة المستخدم", "success");
    };

    app.saveUser = async function(index) {
        const user = db.systemUsers[index];
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
        if (error) return showToast("فشل الحفظ", "error");
        await loadAllDataFromSupabase();
        app.renderUserManagement();
        showToast("تم حفظ التعديلات", "success");
    };

    app.deleteUser = async function(index) {
        if (db.systemUsers.length <= 1) return showToast("لا يمكن حذف آخر مستخدم", "error");
        const user = db.systemUsers[index];
        if (user.s === app.user.s) return showToast("لا يمكنك حذف حسابك الحالي", "error");
        if (user.r === 'admin' && db.systemUsers.filter(u => u.r === 'admin').length === 1)
            return showToast("لا يمكن حذف آخر مدير في النظام", "error");
        const confirmed = await showConfirm(`حذف ${user.name}؟`);
        if (confirmed) {
            const { error } = await supabase.from('users').delete().eq('serial', user.serial);
            if (error) return showToast("فشل الحذف", "error");
            await loadAllDataFromSupabase();
            app.renderUserManagement();
            showToast("تم الحذف", "success");
        }
    };

    app.renderAssignTeachersTab = function() {
        const section = document.getElementById('tab-admin-assign-teachers');
        if (!section) return;
        let html = '<div class="card"><h3>تعيين مربي الصفوف</h3>';
        for (let grade in gradesConfig) {
            html += `<h4>${grade}</h4>`;
            gradesConfig[grade].forEach(cls => {
                const current = db.classTeachers[grade]?.[cls] || '';
                html += `<div><label>${cls}:</label>
                <select onchange="app.assignClassTeacher('${grade}','${cls}', this.value)">
                    <option value="">-- بدون --</option>
                    ${db.systemUsers.filter(u=>u.r==='teacher').map(t=>`<option value="${t.s}" ${current==t.s?'selected':''}>${t.n}</option>`).join('')}
                </select></div>`;
            });
        }
        html += '</div>';
        section.innerHTML = html;
    };

    app.assignClassTeacher = async function(grade, cls, teacherId) {
        if (!db.classTeachers[grade]) db.classTeachers[grade] = {};
        db.classTeachers[grade][cls] = teacherId || null;
        await updateClassTeacher(grade, cls, teacherId);
        app.addNotif('class', grade+'-'+cls, `تم تعيين ${teacherId ? db.systemUsers.find(u=>u.s===teacherId)?.n : 'لا أحد'} كمربي صف لـ ${grade} ${cls}`);
        showToast("تم التعيين", "success");
    };

    app.renderPrintReportsTab = function() {
        const section = document.getElementById('tab-admin-print-reports');
        if (!section) return;
        const grades = Object.keys(gradesConfig).map(g => `<option value="${g}">${g}</option>`).join('');
        section.innerHTML = `<div class="card"><h3>طباعة النتائج PDF</h3><select id="report-grade-select">${grades}</select><select id="report-class-select"></select><button onclick="app.printStudentReports()">تصدير الشهادات</button></div>`;
        document.getElementById('report-grade-select').onchange = function() {
            document.getElementById('report-class-select').innerHTML = (gradesConfig[this.value] || []).map(c => `<option value="${c}">${c}</option>`).join('');
        };
        document.getElementById('report-grade-select').dispatchEvent(new Event('change'));
    };

    app.renderPrintNamesTab = function() {
        const section = document.getElementById('tab-admin-print-names');
        if (!section) return;
        const grades = Object.keys(gradesConfig).map(g => `<option value="${g}">${g}</option>`).join('');
        section.innerHTML = `<div class="card"><h3>طباعة أسماء الطلاب</h3><select id="print-grade-select">${grades}</select><select id="print-class-select"></select><button onclick="app.printStudentList()">طباعة</button><button onclick="app.downloadStudentList()">Excel</button></div>`;
        document.getElementById('print-grade-select').onchange = function() {
            document.getElementById('print-class-select').innerHTML = (gradesConfig[this.value] || []).map(c => `<option value="${c}">${c}</option>`).join('');
        };
        document.getElementById('print-grade-select').dispatchEvent(new Event('change'));
    };

    app.printStudentList = function() {
        const grade = document.getElementById('print-grade-select')?.value;
        const cls = document.getElementById('print-class-select')?.value;
        if (!grade || !cls) return showToast("اختر الصف", "warning");
        const students = db.systemUsers.filter(u => u.r === 'student' && u.grade === grade && u.c === cls);
        let content = `<h2>قائمة طلاب ${grade} ${cls}</h2><ul>${students.map(s => `<li>${s.n} - ${s.s}</li>`).join('')}</ul>`;
        const win = window.open('', '_blank');
        if (win) { win.document.write(content); win.document.close(); win.print(); }
    };

    app.downloadStudentList = function() {
        const grade = document.getElementById('print-grade-select')?.value;
        const cls = document.getElementById('print-class-select')?.value;
        if (!grade || !cls) return showToast("اختر الصف", "warning");
        const students = db.systemUsers.filter(u => u.r === 'student' && u.grade === grade && u.c === cls);
        const data = [["الاسم", "الرقم التسلسلي"]];
        students.forEach(s => data.push([s.n, s.s]));
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "الطلاب");
        XLSX.writeFile(wb, `طلاب_${grade}_${cls}.xlsx`);
    };

    app.printStudentReports = async function() {
        const grade = document.getElementById('report-grade-select')?.value;
        const cls = document.getElementById('report-class-select')?.value;
        if (!grade || !cls) return showToast("اختر الصف", "warning");
        const students = db.systemUsers.filter(u => u.r === 'student' && u.grade === grade && u.c === cls);
        if (!students.length) { showToast("لا يوجد طلاب.", "info"); return; }
        for (let student of students) {
            await app.exportStudentReportPDF(student, grade, cls);
        }
        showToast("تم تحميل الشهادات", "success");
    };

    app.renderTeacherSubjectsTab = function() {
        const section = document.getElementById('tab-admin-teacher-subjects');
        if (!section) return;
        const teachers = db.systemUsers.filter(u => u.r === 'teacher');
        section.innerHTML = `<div class="card"><h3>مواد المعلمين</h3>
            <select id="teacher-subject-select"><option value="">اختر معلماً</option>${teachers.map(t=>`<option value="${t.s}">${t.n}</option>`).join('')}</select>
            <div id="teacher-assignment-panel"></div>
        </div>`;
        document.getElementById('teacher-subject-select').onchange = function() { if (this.value) app.renderAssignmentPanel(this.value); else document.getElementById('teacher-assignment-panel').innerHTML = ''; };
    };

    app.renderAssignmentPanel = function(teacherId) {
        const container = document.getElementById('teacher-assignment-panel');
        if (!container) return;
        const assignments = db.teacherAssignments[teacherId] || [];
        let html = `<h4>المواد الحالية</h4>`;
        if (assignments.length === 0) html += `<p style="color:#888;">لا توجد مواد معينة بعد.</p>`;
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
            <select id="new-subject-select">${subjectsList.map(s=>`<option value="${s}">${s}</option>`).join('')}</select>
            <div id="grade-class-checkboxes"></div>
            <button onclick="app.saveTeacherSubject('${teacherId}')">حفظ المادة</button>`;
        container.innerHTML = html;
        const checksDiv = document.getElementById('grade-class-checkboxes');
        let cboxes = '';
        for (let grade in gradesConfig) {
            gradesConfig[grade].forEach(cls => {
                cboxes += `<label style="margin-right:8px;"><input type="checkbox" value="${grade}|${cls}"> ${grade} ${cls}</label>`;
            });
        }
        checksDiv.innerHTML = cboxes;
    };

    app.saveTeacherSubject = async function(teacherId) {
        const subject = document.getElementById('new-subject-select').value;
        if (!subject) return showToast("اختر مادة", "warning");
        const checkboxes = document.querySelectorAll('#grade-class-checkboxes input[type="checkbox"]:checked');
        const classes = [];
        checkboxes.forEach(cb => { const [grade, cls] = cb.value.split('|'); classes.push({ grade, cls }); });
        if (classes.length === 0) return showToast("اختر صفًا واحدًا على الأقل", "warning");
        
        const current = db.teacherAssignments[teacherId] || [];
        current.push({ subject, classes });
        db.teacherAssignments[teacherId] = current;
        
        await supabase.from('teacher_assignments').delete().eq('teacher_id', teacherId);
        const rows = current.map(ass => ({
            teacher_id: teacherId,
            subject: ass.subject,
            classes: JSON.stringify(ass.classes)
        }));
        if (rows.length) await supabase.from('teacher_assignments').insert(rows);
        
        app.renderAssignmentPanel(teacherId);
        showToast("تمت إضافة المادة بنجاح", "success");
    };

    app.removeTeacherSubject = async function(teacherId, index) {
        const current = db.teacherAssignments[teacherId] || [];
        current.splice(index, 1);
        db.teacherAssignments[teacherId] = current;
        await supabase.from('teacher_assignments').delete().eq('teacher_id', teacherId);
        const rows = current.map(ass => ({
            teacher_id: teacherId,
            subject: ass.subject,
            classes: JSON.stringify(ass.classes)
        }));
        if (rows.length) await supabase.from('teacher_assignments').insert(rows);
        app.renderAssignmentPanel(teacherId);
    };

    app.renderPublishNotificationTab = function() {
        const section = document.getElementById('tab-admin-publish-notification');
        if (!section) return;
        section.innerHTML = `<div class="card"><h3>نشر إشعار عام</h3><textarea id="global-notif-text" rows="3" style="width:100%;"></textarea><button onclick="app.publishGlobalNotification()">إرسال</button></div>`;
    };

    app.publishGlobalNotification = async function() {
        const text = document.getElementById('global-notif-text').value.trim();
        if (!text) return showToast("أدخل نص الإشعار", "warning");
        await app.addNotif('all', '', text);
        document.getElementById('global-notif-text').value = '';
        showToast("تم النشر", "success");
    };

    app.renderGroupManagement = function() {
        const container = document.getElementById('tab-admin-group-manage');
        if (!container) return;
        const groupsListHtml = db.groups.length ?
            db.groups.map(g => `
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

        app.populateGradesClassesMgmt();
        const select = document.getElementById('group-manage-select');
        select.innerHTML = db.groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
        select.onchange = () => app.renderGroupMembers(select.value);
        if (db.groups.length) app.renderGroupMembers(db.groups[0].id);
    };

    app.populateGradesClassesMgmt = function() {
        const gradeSel = document.getElementById('class-grade-select-mgmt');
        if (!gradeSel) return;
        gradeSel.innerHTML = Object.keys(gradesConfig).map(g => `<option value="${g}">${g}</option>`).join('');
        gradeSel.onchange = () => { document.getElementById('class-class-select-mgmt').innerHTML = gradesConfig[gradeSel.value].map(c => `<option value="${c}">${c}</option>`).join(''); };
        gradeSel.dispatchEvent(new Event('change'));
    };

    app.createGroupFromMgmt = async function() {
        const name = document.getElementById('group-name-new-mgmt')?.value.trim();
        if (!name) return showToast("أدخل اسم المجموعة", "warning");
        const type = document.getElementById('group-type-mgmt').value;
        let members = [];
        const users = db.systemUsers;
        if (type === 'all') members = users.map(u => u.s);
        else if (type === 'teachers') members = users.filter(u => u.r === 'teacher').map(u => u.s);
        else if (type === 'classes') {
            const grade = document.getElementById('class-grade-select-mgmt').value;
            const cls = document.getElementById('class-class-select-mgmt').value;
            if (!grade || !cls) return showToast("يرجى اختيار الصف والشعبة", "warning");
            members = users.filter(u => u.r === 'student' && u.grade === grade && u.c === cls).map(u => u.s);
            if (members.length === 0) return showToast("لا يوجد طلاب في هذه الشعبة", "error");
        } else if (type === 'individual') {
            const serialsText = document.getElementById('group-individual-serials')?.value.trim();
            if (!serialsText) return showToast("يرجى إدخال أرقام تسلسلية", "warning");
            const serials = serialsText.split(/[\s,]+/).filter(s => s.length > 0);
            members = serials.filter(s => users.some(u => u.s === s));
            if (members.length === 0) return showToast("جميع الأرقام المدخلة غير موجودة", "error");
        }
        if (!members.includes(app.user.s)) members.push(app.user.s);

        const { data, error } = await supabase.from('groups').insert({
            name,
            members: JSON.stringify(members),
            messages: JSON.stringify([]),
            allowExit: true,
            whoCanPost: 'all'
        }).select('id').single();

        if (error || !data) return showToast("فشل في إنشاء المجموعة", "error");

        db.groups.push({
            id: data.id.toString(),
            name,
            members,
            messages: [],
            allowExit: true,
            whoCanPost: 'all'
        });
        app.addNotif('all', '', `تم إنشاء مجموعة جديدة: ${name}`);
        app.renderGroupManagement();
        showToast("تم إنشاء المجموعة بنجاح", "success");
    };

    app.deleteGroup = async function(id) {
        const ok = await showConfirm("حذف المجموعة بشكل نهائي؟");
        if (ok) {
            await supabase.from('groups').delete().eq('id', id);
            db.groups = db.groups.filter(g => g.id != id);
            app.renderGroupManagement();
            app.renderChatList();
            showToast("تم حذف المجموعة", "success");
        }
    };

    app.renderGroupMembers = function(groupId) {
        const group = db.groups.find(g => g.id == groupId);
        const membersDiv = document.getElementById('group-members-list');
        if (!group || !membersDiv) return;
        const users = db.systemUsers;
        membersDiv.innerHTML = `<strong>الأعضاء (${group.members.length}):</strong><ul style="margin-top:8px;">` +
            group.members.map(m => { const u = users.find(uu => uu.s == m); return `<li>${u ? u.n : m} (${m})</li>`; }).join('') + `</ul>`;
    };

    app.addMemberToGroup = async function() {
        const groupId = document.getElementById('group-manage-select').value;
        const serial = document.getElementById('new-member-serial').value.trim();
        if (!serial) return showToast("أدخل الرقم التسلسلي", "warning");
        const group = db.groups.find(g => g.id == groupId);
        if (!group) return;
        if (group.members.includes(serial)) return showToast("العضو موجود بالفعل", "info");
        group.members.push(serial);
        await updateGroup(groupId, { members: JSON.stringify(group.members) });
        app.renderGroupMembers(groupId);
        app.addNotif('user', serial, `تمت إضافتك إلى مجموعة ${group.name}`);
        showToast("تمت الإضافة", "success");
    };

    app.kickMemberFromGroup = async function() {
        const groupId = document.getElementById('group-manage-select').value;
        const serial = document.getElementById('kick-member-serial').value.trim();
        if (!serial) return showToast("أدخل الرقم التسلسلي", "warning");
        const group = db.groups.find(g => g.id == groupId);
        if (group && group.members.includes(serial)) {
            group.members = group.members.filter(m => m != serial);
            await updateGroup(groupId, { members: JSON.stringify(group.members) });
            app.renderGroupMembers(groupId);
            app.addNotif('user', serial, `تم طردك من مجموعة ${group.name}`);
            showToast("تم طرد العضو", "success");
        } else showToast("العضو غير موجود في المجموعة", "error");
    };

    app.renderAdminMain = function() {
        const container = document.getElementById('admin-main-container');
        if (!container) return;
        const totalStudents = db.systemUsers.filter(u => u.r === 'student').length;
        const totalTeachers = db.systemUsers.filter(u => u.r === 'teacher').length;
        const totalClasses = Object.values(gradesConfig).flat().length;
        const gradesOptions = Object.keys(gradesConfig).map(g => `<option value="${g}">${g}</option>`).join('');
        container.innerHTML = `
            <div class="admin-stats" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px,1fr)); gap:15px; margin-bottom:20px;">
                <div class="stat-card">
                    <div class="stat-icon">👨‍🎓</div>
                    <div class="stat-number" id="stat-students">0</div>
                    <div class="stat-label">طالب</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">👨‍🏫</div>
                    <div class="stat-number" id="stat-teachers">0</div>
                    <div class="stat-label">معلم</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📚</div>
                    <div class="stat-number">${totalClasses}</div>
                    <div class="stat-label">شعبة</div>
                </div>
            </div>
            <div class="card">
                <h3>📚 تعديل جداول الطلاب</h3>
                <select id="admin-grade-select">${gradesOptions}</select>
                <select id="admin-class-select"></select>
                <div id="admin-schedule-edit-area"></div>
            </div>
            <div class="card">
                <h3>👨‍🏫 تعديل جداول المعلمين</h3>
                <select id="teacher-select-admin"><option value="">-- اختر معلماً --</option>${db.systemUsers.filter(u=>u.r==='teacher').map(t=>`<option value="${t.s}">${t.n}</option>`).join('')}</select>
                <div id="teacher-edit-container-admin"></div>
            </div>
        `;
        document.getElementById('admin-grade-select').onchange = function() {
            const grade = this.value;
            const classSelect = document.getElementById('admin-class-select');
            classSelect.innerHTML = (gradesConfig[grade] || []).map(c => `<option value="${c}">${c}</option>`).join('');
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
        setTimeout(() => {
            app.animateCounter(document.getElementById('stat-students'), totalStudents);
            app.animateCounter(document.getElementById('stat-teachers'), totalTeachers);
        }, 300);
        app.addFullscreenButton('#admin-main-container .card:first-of-type');
        app.addFullscreenButton('#admin-main-container .card:last-of-type');
    };
}