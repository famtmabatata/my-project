// grades.js
import { db, gradesConfig, subjectsList, subjectColors, upsertGrade } from "./db.js";
import { showToast } from "./utils.js";

export function initGradesModule(app) {
    app.getTeacherAssignments = function() { return db.teacherAssignments?.[app.user.s] || null; };

    app.getAllowedClassesWithSubjects = function() {
        const assignments = app.getTeacherAssignments();
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
    };

    app.renderTeacherUI = function() {
        const container = document.getElementById('grades-table-container');
        if (!container) return;
        const allowedMap = app.getAllowedClassesWithSubjects();
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
                if (isGrading && grade && selectedClass && subjectSelect?.value) app.renderStudentsForGrades(grade, selectedClass, subjectSelect.value);
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
    };

    app.renderStudentsForGrades = function(grade, cls, subject) {
        const div = document.getElementById('students-list-grading');
        if (!div) return;
        const students = db.systemUsers.filter(u => u.r === 'student' && u.grade === grade && u.c === cls);
        if (!students.length) { div.innerHTML = "<p>لا يوجد طلاب في هذه الشعبة</p>"; return; }
        let html = `<table class="main-table"><thead><tr><th>الطالب</th><th>ش1</th><th>ش2</th><th>ش3</th><th>ش4</th><th>نهائي</th><th>المجموع</th></tr></thead><tbody>`;
        students.forEach(s => {
            const g = (db.grades[s.s] && db.grades[s.s][subject]) ? db.grades[s.s][subject] : {m1:0, m2:0, m3:0, m4:0, fin:0};
            const total = (Number(g.m1)||0)+(Number(g.m2)||0)+(Number(g.m3)||0)+(Number(g.m4)||0)+(Number(g.fin)||0);
            html += `<tr data-sid="${s.s}" data-subject="${subject}">
                        <td>${s.n}</td>
                        <td><input type="number" class="grade-input m1" value="${g.m1}" oninput="app.calcRowTotal(this)"></td>
                        <td><input type="number" class="grade-input m2" value="${g.m2}" oninput="app.calcRowTotal(this)"></td>
                        <td><input type="number" class="grade-input m3" value="${g.m3}" oninput="app.calcRowTotal(this)"></td>
                        <td><input type="number" class="grade-input m4" value="${g.m4}" oninput="app.calcRowTotal(this)"></td>
                        <td><input type="number" class="grade-input fin" value="${g.fin}" oninput="app.calcRowTotal(this)"></td>
                        <td class="row-total">${total}</td>
                    </tr>`;
        });
        div.innerHTML = html + `</tbody></table>`;
    };

    app.calcRowTotal = function(input) {
        const row = input.closest('tr');
        const m1 = Number(row.querySelector('.m1').value) || 0;
        const m2 = Number(row.querySelector('.m2').value) || 0;
        const m3 = Number(row.querySelector('.m3').value) || 0;
        const m4 = Number(row.querySelector('.m4').value) || 0;
        const fin = Number(row.querySelector('.fin').value) || 0;
        row.querySelector('.row-total').innerText = m1 + m2 + m3 + m4 + fin;
    };

    app.saveAllGrades = async function() {
        const rows = document.querySelectorAll('#students-list-grading tr[data-sid]');
        const grade = document.getElementById('grade-select-grading').value;
        const cls = document.getElementById('current-grading-class').value;
        const subject = document.getElementById('grading-subject').value;
        if (!rows.length) return showToast("اختر صفاً وشعبة ومادة أولاً!", "warning");
        if (!subject) return showToast("اختر المادة أولاً", "warning");
        for (let row of rows) {
            const sid = row.getAttribute('data-sid');
            const m1 = row.querySelector('.m1').value || 0;
            const m2 = row.querySelector('.m2').value || 0;
            const m3 = row.querySelector('.m3').value || 0;
            const m4 = row.querySelector('.m4').value || 0;
            const fin = row.querySelector('.fin').value || 0;
            if (!db.grades[sid]) db.grades[sid] = {};
            db.grades[sid][subject] = { m1, m2, m3, m4, fin };
            await upsertGrade(sid, subject, m1, m2, m3, m4, fin);
        }
        app.addNotif('class', grade + '-' + cls, `تم رصد علامات ${subject} لـ ${grade} ${cls}`);
        showToast("تم حفظ العلامات بنجاح", "success");
    };
}