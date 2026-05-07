// utils.js - دوال مساعدة مشتركة بين جميع الأجزاء

/**
 * عرض إشعار منبثق (Toast)
 * @param {string} msg - الرسالة
 * @param {'info'|'success'|'error'|'warning'} type - نوع الإشعار
 */
export function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2500);
}

/**
 * عرض نافذة تأكيد (نعم/إلغاء) وإرجاع وعد
 * @param {string} message - نص السؤال
 * @returns {Promise<boolean>} true إذا وافق المستخدم
 */
export function showConfirm(message) {
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
}

/**
 * تحويل الروابط في النص إلى عناصر HTML قابلة للنقر
 * @param {string} text النص الخام
 * @returns {string} نص مع روابط HTML
 */
export function linkify(text) {
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
}

/**
 * إظهار أو إخفاء شاشة التحميل أثناء رفع الصور مع نص وصفي اختياري
 * @param {boolean} show
 * @param {string} [progressText=''] نص يعرض أسفل الأيقونة
 */
export function showUploadLoader(show, progressText = '') {
    const overlay = document.getElementById('upload-overlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
        const progressEl = overlay.querySelector('.progress-text');
        if (progressEl) progressEl.textContent = progressText || 'جاري رفع الصور...';
    }
}

/**
 * رفع مجموعة ملفات إلى imgbb واسترجاع الروابط
 * @param {File[]} files
 * @returns {Promise<string[]>} روابط الصور المرفوعة
 */
export async function uploadImagesToStorage(files) {
    const urls = [];
    const apiKey = '61a13af2500a490eb2774b734a3c2ee8';
    for (const file of files) {
        const formData = new FormData();
        formData.append('image', file);
        try {
            const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, { method: 'POST', body: formData });
            const data = await response.json();
            if (data.success) urls.push(data.data.url);
            else showToast('فشل رفع الصورة', 'error');
        } catch (error) {
            showToast('فشل رفع الصورة، تأكد من الإنترنت', 'error');
            throw error;
        }
    }
    return urls;
}