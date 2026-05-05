// auth.js
const database = {
    users: []
};

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(inputPassword, hashedPassword) {
    if (!hashedPassword.startsWith('sha256:')) {
        return inputPassword === hashedPassword;
    }
    const hash = 'sha256:' + await hashPassword(inputPassword);
    return hash === hashedPassword;
}

export { database, hashPassword, verifyPassword };