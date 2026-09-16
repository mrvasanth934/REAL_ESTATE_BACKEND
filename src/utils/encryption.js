const crypto = require('crypto');

const secretKey = process.env.ENCRYPTION_KEY || 'your-secure-32-byte-secret-key-here!!';
const ivLength = 16;

const encrypt = (text) => {
    if (!text) return null;
    const iv = crypto.randomBytes(ivLength);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secretKey.padEnd(32).slice(0, 32)), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
};

const decrypt = (text) => {
    if (!text) return null;
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = textParts.join(':');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secretKey.padEnd(32).slice(0, 32)), iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        return null;
    }
};

module.exports = { encrypt, decrypt };