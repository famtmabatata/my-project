// قائمة الطلاب (أكمل الـ 90 اسماً هنا بنفس النمط)
const students = {
    "123456": "همام الشريف",
    "111111": "أحمد محمد",
    "222222": "سارة علي",
    "333333": "خالد محمود"
    // أضف بقية الطلاب هنا..
};

function checkAttendance() {
    const input = document.getElementById('studentID');
    const messageDiv = document.getElementById('message');
    const id = input.value;

    if (students[id]) {
        const name = students[id];
        messageDiv.innerHTML = `✅ تم تسجيل الحضور بنجاح: ${name}`;
        messageDiv.style.color = "#28a745";

        // إرسال الإيميل باستخدام بياناتك
        sendEmail(name, id);
        
        input.value = ""; // مسح الخانة بعد التسجيل
    } else {
        messageDiv.innerHTML = "❌ الرمز غير صحيح، يرجى المحاولة مرة أخرى.";
        messageDiv.style.color = "#dc3545";
    }
}

function sendEmail(name, id) {
    // تم وضع IDs الخاصة بك هنا
    emailjs.send("service_xkra9so", "template_ofkydp7", {
        name: name,
        id: id
    }).then(() => {
        console.log("تم إرسال التقرير بنجاح!");
    }, (error) => {
        console.log("حدث خطأ في الإرسال:", error);
    });
}