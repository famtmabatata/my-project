// utils.js
export function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2500);
}

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

export function linkify(text) {
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
}

export function showUploadLoader(show, progressText = '') {
    const overlay = document.getElementById('upload-overlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
        const progressEl = overlay.querySelector('.progress-text');
        if (progressEl && progressText) progressEl.textContent = progressText;
    }
}

export async function compressImage(file, maxWidth = 800) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ratio = maxWidth / img.width;
                canvas.width = maxWidth;
                canvas.height = img.height * ratio;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                }, 'image/jpeg', 0.7);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

export async function uploadImagesToStorage(files) {
    const urls = [];
    const apiKey = '61a13af2500a490eb2774b734a3c2ee8';
    for (let file of files) {
        if (file.type.startsWith('image/')) {
            file = await compressImage(file);
        }
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