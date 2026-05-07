// auth.js

/**
 * قاعدة بيانات مؤقتة للمستخدمين (غير مستخدمة بشكل مباشر بعد Supabase)
 * @type {{users: Array}}
 */
const database = {
    users: []
};

/**
 * تشفير كلمة المرور باستخدام SHA-256
 * @param {string} password - كلمة المرور النصية
 * @returns {Promise<string>} التجزئة بالنظام الست عشري
 */
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * التحقق من كلمة المرور المدخلة مقابل كلمة مرور مشفرة (أو نصية)
 * @param {string} inputPassword - كلمة المرور التي أدخلها المستخدم
 * @param {string} hashedPassword - كلمة المرور المخزنة (قد تبدأ بـ sha256: أو تكون نصية)
 * @returns {Promise<boolean>} صحيح إذا تطابقت
 */
async function verifyPassword(inputPassword, hashedPassword) {
    // التحقق من البادئة للتأكد من أن الكلمة مشفرة
    if (!hashedPassword || !hashedPassword.startsWith('sha256:')) {
        return inputPassword === hashedPassword;
    }
    const hash = 'sha256:' + await hashPassword(inputPassword);
    return hash === hashedPassword;
}

export { database, hashPassword, verifyPassword };