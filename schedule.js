// schedule.js
import { db, gradesConfig, subjectColors, addHomeworkToSupabase, saveSchedules, saveTeacherSchedules } from "./db.js";
import { showToast } from "./utils.js";
import { supabase } from "./supabase-config.js";

export function initScheduleModule(app) {
    app.renderScheduleTable = function(sched, editable = false, grade = null, cls = null) {
        const current = app.getCurrentPeriodInfo();
        let html = `<table class="main-table"><thead><tr><th>اليوم</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th></tr></thead><tbody>`;
        ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"].forEach(day => {
            html += `<tr><td style="font-weight:bold;">${day}</td>`;
            for (let i = 1; i <= 7; i++) {
                const p = 'p' + i;
                const val = sched[day]?.[p] || '-';
                const color = val !== '-' ? (subjectColors[val] || '') : '';
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
    };

    app.renderStudentSchedule = function() {
        const sc = document.getElementById('schedule-table-container');
        if (!sc) return;
        const sched = db.schedules[app.user.grade]?.[app.user.c];
        if (!sched) { sc.innerHTML = "<p>لا يوجد جدول بعد.</p>"; return; }
        sc.innerHTML = `<h2>📅 جدولي - ${app.user.grade} ${app.user.c}</h2>` + app.renderScheduleTable(sched, false) +
                       `<div id="homework-display"></div><div id="student-grades-display"></div>`;
        app.renderStudentData();
    };

    app.renderTeacherOwnSchedule = function() {
        const sc = document.getElementById('schedule-table-container');
        if (!sc) return;
        const sched = db.teacherSchedules[app.user.s];
        if (!sched) { sc.innerHTML = "<p>لا يوجد جدول بعد.</p>"; return; }
        sc.innerHTML = `<h2>📅 جدولي الأسبوعي</h2>` + app.renderScheduleTable(sched, false);
    };

    app.renderAdminMain = function() {
        const container = document.getElementById('admin-main-container');
        if (!container) return;
        const gradesOptions = Object.keys(gradesConfig).map(g => `<option value="${g}">${g}</option>`).join('');
        container.innerHTML = `
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
    };

    app.renderAdminSchedule = function(grade, cls) {
        const container = document.getElementById('admin-schedule-edit-area');
        if (!container) return;
        const sched = db.schedules[grade]?.[cls];
        if (!sched) return;
        container.innerHTML = app.renderScheduleTable(sched, true, grade, cls);
    };

    app.editClassSub = async function(grade, cls, day, period) {
        const current = db.schedules[grade][cls][day][period];
        const newVal = await app.showEditModal(`تعديل ${grade} ${cls} - ${day} حصة ${period.replace('p','')}`, current);
        if (newVal !== null) {
            db.schedules[grade][cls][day][period] = newVal.trim() === "" ? "-" : newVal;
            await supabase.from('schedules').upsert({ grade, class: cls, day, period, value: newVal.trim() === "" ? "-" : newVal });
            app.addNotif('class', grade+'-'+cls, `تحديث جدول ${grade} ${cls}: ${day} حصة ${period.replace('p','')} أصبحت ${newVal || 'فراغ'}`);
            app.renderAdminSchedule(grade, cls);
        }
    };

    app.renderTeacherEditSchedule = function(teacherId) {
        const container = document.getElementById('teacher-edit-container-admin');
        if (!container) return;
        const teacher = db.systemUsers.find(u => u.s === teacherId);
        const sched = db.teacherSchedules[teacherId] || {};
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
    };

    app.editTeacherCell = async function(teacherId, day, period) {
        const current = db.teacherSchedules[teacherId]?.[day]?.[period] || '-';
        const n = await app.showEditModal('الشعبة (أ,ب,ج,د,تج) أو -', current);
        if (n !== null) {
            db.teacherSchedules[teacherId][day][period] = n.trim() === "" ? "-" : n;
            await supabase.from('teacher_schedules').upsert({ teacher_id: teacherId, day, period, value: n.trim() === "" ? "-" : n });
            app.renderTeacherEditSchedule(teacherId);
        }
    };

    app.showEditModal = function(title, currentValue) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content">
                    <h3>${title}</h3>
                    <input type="text" id="edit-input" value="${currentValue}" autofocus>
                    <div style="margin-top:15px; display:flex; justify-content:center; gap:8px;">
                        <button onclick="this.closest('.modal-overlay').resolve('ok')" class="btn-save">حفظ</button>
                        <button onclick="this.closest('.modal-overlay').resolve('cancel')" class="btn-delete">إلغاء</button>
                    </div>
                </div>
            `;
            modal.resolve = (action) => {
                if (action === 'ok') resolve(modal.querySelector('#edit-input').value);
                else resolve(null);
                modal.remove();
            };
            document.body.appendChild(modal);
            modal.querySelector('#edit-input').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') modal.resolve('ok');
            });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.resolve('cancel');
            });
        });
    };

    app.postHomework = async function() {
        const grade = document.getElementById('hw-grade').value;
        const cls = document.getElementById('hw-class').value;
        const subject = document.getElementById('hw-subject').value;
        const title = document.getElementById('hw-title').value.trim();
        const body = document.getElementById('hw-body').value.trim();
        if (!title || !body || !grade || !cls || !subject) return showToast("املأ جميع الحقول", "warning");
        if (!db.homeworks[grade]) db.homeworks[grade] = {};
        if (!db.homeworks[grade][cls]) db.homeworks[grade][cls] = [];
        db.homeworks[grade][cls].unshift({ t: app.user.n, s: title, c: body, sub: subject, d: new Date().toLocaleDateString('ar-EG') });
        await addHomeworkToSupabase(grade, cls, app.user.n, title, body, subject, new Date().toLocaleDateString('ar-EG'));
        app.addNotif('class', grade + '-' + cls, `واجب جديد في ${subject}: ${title}`);
        showToast("تم نشر الواجب", "success");
        document.getElementById('hw-title').value = '';
        document.getElementById('hw-body').value = '';
    };

    app.renderStudentData = function() {
        app.renderStudentHomeworks();
        const div = document.getElementById('student-grades-display');
        if (!div) return;
        const myGrades = db.grades[app.user.s] || {};
        let html = `<h3>📊 كشف علاماتي</h3><table class="main-table"><thead><tr><th>المادة</th><th>ش1</th><th>ش2</th><th>ش3</th><th>ش4</th><th>نهائي</th><th>المجموع</th></tr></thead><tbody>`;
        let totalSum = 0, count = 0;
        for (let sub in myGrades) {
            const g = myGrades[sub];
            const t = (Number(g.m1)||0)+(Number(g.m2)||0)+(Number(g.m3)||0)+(Number(g.m4)||0)+(Number(g.fin)||0);
            html += `<tr><td>${sub}</td><td>${g.m1||0}</td><td>${g.m2||0}</td><td>${g.m3||0}</td><td>${g.m4||0}</td><td>${g.fin||0}</td><td style="font-weight:bold">${t}</td></tr>`;
            totalSum += t; count++;
        }
        if (count === 0) html += `<tr><td colspan="7" style="color:#888;">لا توجد علامات</td></tr></tbody></table>`;
        else {
            const percentage = ((totalSum / (count * 100)) * 100).toFixed(1);
            html += `</tbody></table><div style="margin-top:15px; background:#eef2f5; padding:10px; border-radius:12px; text-align:center;">📈 المعدل المئوي: ${percentage}% <button onclick="app.downloadStudentOwnReport()" style="background:var(--primary-dark); color:white; border:none; padding:6px 12px; border-radius:20px;">📥 تحميل الشهادة PDF</button></div>`;
        }
        div.innerHTML = html;
    };

    app.renderStudentHomeworks = function() {
        const container = document.getElementById('homework-display');
        if (!container) return;
        const grade = app.user.grade, cls = app.user.c;
        const list = db.homeworks[grade]?.[cls] || [];
        const hidden = db.hiddenHomeworks[app.user.s] || [];
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
    };

    app.hideHomework = function(title, date, content) {
        if (!db.hiddenHomeworks[app.user.s]) db.hiddenHomeworks[app.user.s] = [];
        const id = title + date + content;
        if (!db.hiddenHomeworks[app.user.s].includes(id)) {
            db.hiddenHomeworks[app.user.s].push(id);
            app.syncLocalStorage();
            app.renderStudentHomeworks();
        }
    };

    app.downloadStudentOwnReport = async function() {
        await app.exportStudentReportPDF(app.user, app.user.grade, app.user.c);
    };

    app.exportStudentReportPDF = async function(student, grade, cls) {
        const grades = db.grades[student.s] || {};
        let subjects = [];
        let totalSum = 0, count = 0;
        for (let sub in grades) {
            const g = grades[sub];
            const m1 = Number(g.m1)||0, m2 = Number(g.m2)||0, m3 = Number(g.m3)||0, m4 = Number(g.m4)||0;
            const avg = ((m1+m2+m3+m4)/4).toFixed(1);
            subjects.push({ name: sub, m1, m2, m3, m4, avg });
            totalSum += parseFloat(avg);
            count++;
        }
        const overallAvg = count ? (totalSum/count).toFixed(1) : 0;

        const teacherId = db.classTeachers[grade]?.[cls];
        const teacher = teacherId ? db.systemUsers.find(u=>u.s===teacherId) : null;
        const teacherName = teacher ? teacher.n : "________________";

        const html = `
            <div class="report-card-pdf">
                <div class="header">
                    <img src="logo-transparent.png" alt="شعار المدرسة" style="height:80px;">
                    <h2>وزارة التربية والتعليم</h2>
                    <h3>المملكة الأردنية الهاشمية</h3>
                    <h3>مدرسة اسكان المالية والزراعة الأساسية الثانية للبنين</h3>
                    <p>المديرية: لواء القويسمة</p>
                </div>
                <div style="display:flex; justify-content:space-between; margin:20px 0;">
                    <p><strong>اسم الطالب:</strong> ${student.n}</p>
                    <p><strong>الصف:</strong> ${grade} ${cls}</p>
                </div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>المبحث</th>
                            <th>الشهر الأول</th>
                            <th>الشهر الثاني</th>
                            <th>الشهر الثالث</th>
                            <th>الشهر الرابع</th>
                            <th>المعدل</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${subjects.map(s => `
                            <tr>
                                <td>${s.name}</td>
                                <td>${s.m1}</td>
                                <td>${s.m2}</td>
                                <td>${s.m3}</td>
                                <td>${s.m4}</td>
                                <td><strong>${s.avg}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="margin: 20px 0; text-align:center;">
                    <p><strong>المعدل العام: ${overallAvg}%</strong></p>
                    <p>النتيجة: ${overallAvg >= 50 ? 'ناجح' : 'مكمل'}</p>
                </div>
                <div class="signatures">
                    <div>
                        <p>${teacherName}</p>
                        <hr><small>توقيع مربي الصف</small>
                    </div>
                    <div>
                        <p>د/ أسامة حمدان الرقب</p>
                        <hr><small>مدير المدرسة</small>
                    </div>
                    <div>
                        <p>________________</p>
                        <hr><small>الخاتم الرسمي</small>
                    </div>
                </div>
            </div>
        `;

        const opt = {
            margin:       0,
            filename:     `شهادة_${student.n}_${grade}_${cls}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        await html2pdf().set(opt).from(html).save();
    };
}