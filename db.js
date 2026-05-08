// db.js
import { supabase } from "./supabase-config.js";

export const gradesConfig = {
    "خامس": ["أ", "ب", "ج", "تج"],
    "سادس": ["أ", "ب", "ج", "د", "تج"],
    "سابع": ["أ", "ب", "ج", "د", "تج"],
    "ثامن": ["أ", "ب", "ج", "د", "تج"],
    "تاسع": ["أ", "ب", "ج", "د"]
};

export const subjectsList = [
    "اللغة العربية", "الرياضيات", "العلوم", "فيزياء", "كيمياء",
    "أحياء", "اللغة الإنجليزية", "التاريخ", "التربية الإسلامية",
    "المهارات الرقمية", "الجغرافيا", "الوطنية", "التربية المهنية",
    "الثقافة المالية", "التربية الفنية", "التربية الرياضية"
];

export const subjectColors = {
    "اللغة العربية": "#ffe0b2", "الرياضيات": "#c8e6c9", "العلوم": "#b3e5fc",
    "فيزياء": "#f8bbd0", "كيمياء": "#e1bee7", "أحياء": "#dcedc8",
    "اللغة الإنجليزية": "#ffccbc", "التاريخ": "#d7ccc8", "التربية الإسلامية": "#fff9c4",
    "المهارات الرقمية": "#b2dfdb", "الجغرافيا": "#f0f4c3", "الوطنية": "#ffecb3",
    "التربية المهنية": "#e0e0e0", "الثقافة المالية": "#ffe082", "التربية الفنية": "#f8bbd0",
    "التربية الرياضية": "#c5e1a5"
};

export const db = {
    schedules: {},
    teacherSchedules: {},
    grades: {},
    groups: [],
    directMessages: {},
    notifs: [],
    pfp: {},
    homeworks: {},
    contacts: {},
    hiddenHomeworks: JSON.parse(localStorage.getItem('hiddenHomeworks')) || {},
    classTeachers: {},
    teacherAssignments: {},
    systemUsers: []
};

export function parseSchedules(rows) {
    const obj = {};
    if (rows) rows.forEach(r => {
        if (!obj[r.grade]) obj[r.grade] = {};
        if (!obj[r.grade][r.class]) obj[r.grade][r.class] = {};
        if (!obj[r.grade][r.class][r.day]) obj[r.grade][r.class][r.day] = {};
        obj[r.grade][r.class][r.day][r.period] = r.value;
    });
    return obj;
}

export function parseTeacherSchedules(rows) {
    const obj = {};
    if (rows) rows.forEach(r => {
        if (!obj[r.teacher_id]) obj[r.teacher_id] = {};
        if (!obj[r.teacher_id][r.day]) obj[r.teacher_id][r.day] = {};
        obj[r.teacher_id][r.day][r.period] = r.value;
    });
    return obj;
}

export function parseGrades(rows) {
    const obj = {};
    if (rows) rows.forEach(r => {
        if (!obj[r.student_serial]) obj[r.student_serial] = {};
        obj[r.student_serial][r.subject] = { m1: r.m1, m2: r.m2, m3: r.m3, m4: r.m4 || 0, fin: r.fin };
    });
    return obj;
}

export function parseHomeworks(rows) {
    const obj = {};
    if (rows) rows.forEach(r => {
        if (!obj[r.grade]) obj[r.grade] = {};
        if (!obj[r.grade][r.class]) obj[r.grade][r.class] = [];
        obj[r.grade][r.class].push({ t: r.teacher_name, s: r.title, c: r.content, sub: r.subject, d: r.date });
    });
    return obj;
}

export function parseGroups(rows) {
    if (!rows) return [];
    return rows.map(r => ({
        id: r.id.toString(),
        name: r.name,
        members: JSON.parse(r.members || '[]'),
        messages: JSON.parse(r.messages || '[]'),
        allowExit: r.allowExit,
        whoCanPost: r.whoCanPost
    }));
}

export function parseDirectMessages(rows) {
    const obj = {};
    if (rows) rows.forEach(r => { obj[r.chat_id] = JSON.parse(r.messages || '[]'); });
    return obj;
}

export function parseNotifications(rows) {
    if (!rows) return [];
    return rows.map(r => ({
        id: r.id, type: r.type, val: r.val, msg: r.msg, time: r.time,
        readBy: JSON.parse(r.readBy || '[]')
    }));
}

export function parseClassTeachers(rows) {
    const obj = {};
    if (rows) rows.forEach(r => {
        if (!obj[r.grade]) obj[r.grade] = {};
        obj[r.grade][r.class] = r.teacher_id;
    });
    return obj;
}

export function parseTeacherAssignments(rows) {
    const obj = {};
    if (rows) {
        rows.forEach(r => {
            if (!obj[r.teacher_id]) obj[r.teacher_id] = [];
            obj[r.teacher_id].push({
                subject: r.subject,
                classes: JSON.parse(r.classes || '[]')
            });
        });
    }
    return obj;
}

export async function saveSchedules() {
    await supabase.from('schedules').delete().neq('grade', '__nonexistent__');
    const rows = [];
    for (let grade in db.schedules)
        for (let cls in db.schedules[grade])
            for (let day in db.schedules[grade][cls])
                for (let period in db.schedules[grade][cls][day])
                    rows.push({ grade, class: cls, day, period, value: db.schedules[grade][cls][day][period] });
    if (rows.length) await supabase.from('schedules').insert(rows);
}

export async function saveTeacherSchedules() {
    await supabase.from('teacher_schedules').delete().neq('teacher_id', '__nonexistent__');
    const rows = [];
    for (let tid in db.teacherSchedules)
        for (let day in db.teacherSchedules[tid])
            for (let period in db.teacherSchedules[tid][day])
                rows.push({ teacher_id: tid, day, period, value: db.teacherSchedules[tid][day][period] });
    if (rows.length) await supabase.from('teacher_schedules').insert(rows);
}

export async function upsertGrade(student_serial, subject, m1, m2, m3, m4, fin) {
    await supabase.from('grades').upsert(
        { student_serial, subject, m1, m2, m3, m4, fin },
        { onConflict: 'student_serial,subject' }
    );
}

export async function addHomeworkToSupabase(grade, cls, teacher_name, title, content, subject, date) {
    await supabase.from('homeworks').insert({ grade, class: cls, teacher_name, title, content, subject, date });
}

export async function updateGroup(id, updates) { await supabase.from('groups').update(updates).eq('id', id); }
export async function addNotification(notif) { await supabase.from('notifications').insert(notif); }
export async function updateClassTeacher(grade, cls, teacher_id) { await supabase.from('class_teachers').upsert({ grade, class: cls, teacher_id }); }
export async function updateTeacherAssignment(teacher_id, subject, classes) { await supabase.from('teacher_assignments').upsert({ teacher_id, subject, classes: JSON.stringify(classes) }); }
export async function saveDirectMessages(chat_id, messages) { await supabase.from('direct_messages').upsert({ chat_id, messages: JSON.stringify(messages) }); }

// دوال جهات الاتصال
export async function loadContacts(userSerial) {
    const { data, error } = await supabase
        .from('contacts')
        .select('contact_serial')
        .eq('user_serial', userSerial);
    if (error) return [];
    return data.map(row => row.contact_serial);
}

export async function addContactToSupabase(userSerial, contactSerial) {
    const { error } = await supabase
        .from('contacts')
        .insert({ user_serial: userSerial, contact_serial: contactSerial });
    if (error && error.code !== '23505') throw error;
}

export async function removeContactFromSupabase(userSerial, contactSerial) {
    await supabase
        .from('contacts')
        .delete()
        .eq('user_serial', userSerial)
        .eq('contact_serial', contactSerial);
}

// دوال الصور الشخصية
export async function getAvatarUrl(serial) {
    const { data } = await supabase.storage.from('avatars').getPublicUrl(`${serial}.jpg`);
    return data.publicUrl;
}

export async function uploadAvatar(serial, file) {
    const { error } = await supabase.storage.from('avatars').upload(`${serial}.jpg`, file, { upsert: true });
    if (error) throw error;
    return getAvatarUrl(serial);
}

export async function loadAllDataFromSupabase() {
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

        db.systemUsers = (users || []).map(u => ({
            s: u.serial,
            n: u.name,
            r: u.role,
            grade: u.grade,
            c: u.class,
            sub: u.subject
        }));
        db.schedules = parseSchedules(schedules);
        db.teacherSchedules = parseTeacherSchedules(teacherSchedules);
        db.grades = parseGrades(grades);
        db.homeworks = parseHomeworks(homeworks);
        db.groups = parseGroups(groups);
        db.directMessages = parseDirectMessages(directMessages);
        db.notifs = parseNotifications(notifications);
        db.classTeachers = parseClassTeachers(classTeachers);
        db.teacherAssignments = parseTeacherAssignments(teacherAssignments);
    } catch (err) {
        console.error("خطأ في تحميل البيانات من Supabase:", err);
        throw err;
    }
}