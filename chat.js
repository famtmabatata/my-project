// chat.js
import { db } from "./db.js";
import { showToast, showConfirm, linkify, showUploadLoader, uploadImagesToStorage } from "./utils.js";
import { updateGroup, saveDirectMessages, addNotification } from "./db.js";

export function initChatModule(app) {
    app.handleFileSelection = function(files) {
        if (!files || files.length === 0) return;
        if (files.length > 15) return showToast("الحد الأقصى 15 صورة", "warning");
        app.pendingFiles = [...app.pendingFiles, ...Array.from(files)];
        app.renderImagePreviews();
    };

    app.renderImagePreviews = function() {
        const previewArea = document.getElementById('image-preview-area');
        if (!previewArea) return;
        previewArea.innerHTML = '';
        app.pendingFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const div = document.createElement('div');
                div.className = 'preview-item';
                div.innerHTML = `<img src="${e.target.result}" /><button class="remove-btn" onclick="app.pendingFiles.splice(${index},1); app.renderImagePreviews();">✕</button>`;
                previewArea.appendChild(div);
            };
            reader.readAsDataURL(file);
        });
    };

    app.sendMessage = async function() {
        const inp = document.getElementById('chat-msg');
        if (!inp || !app.activeChat) return;
        const text = inp.value.trim();
        const hasFiles = app.pendingFiles.length > 0;
        if (!text && !hasFiles) return;

        if (app.activeChat.t === 'user') {
            const receiverId = app.activeChat.id;
            if (!db.contacts[receiverId]) db.contacts[receiverId] = [];
            if (!db.contacts[receiverId].includes(app.user.s)) {
                db.contacts[receiverId].push(app.user.s);
                app.syncLocalStorage();
            }
        }

        let uploadedUrls = [];
        if (hasFiles) {
            showUploadLoader(true, `جاري رفع ${app.pendingFiles.length} صورة...`);
            try { uploadedUrls = await uploadImagesToStorage(app.pendingFiles); } catch (e) { showUploadLoader(false); return; }
            showUploadLoader(false);
        }

        const msg = {
            senderId: app.user.s, senderName: app.user.n,
            time: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }),
            text: text || '', images: uploadedUrls, reactions: [], deletedFor: []
        };

        if (app.activeChat.t === 'group') {
            const group = db.groups.find(g => g.id == app.activeChat.id);
            if (group) {
                if (group.whoCanPost === 'admin' && app.user.r !== 'admin') return showToast("🔒 هذه المجموعة تسمح للمدير فقط بالإرسال.", "warning");
                group.messages.push(msg);
                await updateGroup(group.id, { messages: JSON.stringify(group.messages) });
            }
        } else {
            const cid = [app.user.s, app.activeChat.id].sort().join('_');
            if (!db.directMessages[cid]) db.directMessages[cid] = [];
            db.directMessages[cid].push(msg);
            await saveDirectMessages(cid, db.directMessages[cid]);
            app.addNotif('user', app.activeChat.id, `رسالة جديدة من ${app.user.n}`);
        }

        app.renderMessages();
        inp.value = '';
        app.pendingFiles = [];
        document.getElementById('image-preview-area').innerHTML = '';
        document.getElementById('chat-image-input').value = '';
    };

    app.getCurrentChatMessages = function() {
        if (!app.activeChat) return [];
        return app.activeChat.t === 'group'
            ? (db.groups.find(g => g.id == app.activeChat.id)?.messages || [])
            : (db.directMessages[[app.user.s, app.activeChat.id].sort().join('_')] || []);
    };

    app.renderMessages = function() {
        const box = document.getElementById('chat-box');
        if (!box || !app.activeChat) return;
        let msgs = app.getCurrentChatMessages();
        let html = '';
        let lastSender = null;
        msgs.forEach((m, idx) => {
            if (m.deletedFor?.includes(app.user.s)) return;
            let content = '';
            if (m.images?.length) m.images.forEach(url => content += `<img src="${url}" style="max-width:200px; border-radius:8px; margin:2px; cursor:pointer;" />`);
            if (m.text) content += `<div>${linkify(m.text)}</div>`;
            let reactions = '';
            if (m.reactions?.length) {
                const grouped = {}; m.reactions.forEach(r => { grouped[r.emoji] = grouped[r.emoji] || []; grouped[r.emoji].push(r.userId); });
                reactions = '<div class="reactions-row">' + Object.entries(grouped).map(([em, ids]) => `<span style="cursor:pointer; margin-left:5px;" onclick="app.showReactionDetails(${idx}, '${em}')">${em} ${ids.length}</span>`).join('') + '</div>';
            }
            const isSameSender = (lastSender === m.senderId);
            const className = `message ${m.senderId === app.user.s ? 'sent' : 'received'}${isSameSender ? ' same-sender' : ''}`;
            html += `<div class="${className}" data-msg-index="${idx}">
                        ${app.activeChat.t === 'group' && m.senderId !== app.user.s && !isSameSender ? `<small>${m.senderName}</small>` : ''}
                        <div class="bubble">${content}<span class="time">${m.time}</span>${reactions}</div>
                    </div>`;
            lastSender = m.senderId;
        });
        if (msgs.length === 0) html = `<div class="system-message">🏫 <b>إدارة المدرسة</b><br><small>يمكنك بدء المحادثة عن طريق إضافة جهة اتصال من القائمة الجانبية.</small></div>`;
        box.innerHTML = html;
        box.scrollTop = box.scrollHeight;
    };

    app.showReactionDetails = function(index, emoji) {
        const msgs = app.getCurrentChatMessages();
        const msg = msgs[index];
        if (!msg?.reactions) return;
        const users = db.systemUsers;
        const names = msg.reactions.filter(r => r.emoji === emoji).map(r => users.find(u => u.s === r.userId)?.n || r.userId);
        showToast(`تفاعل ${emoji}: ${names.join('، ') || 'لا أحد'}`, 'info');
    };

    app.showMessageContext = function(event, index) {
        const existing = document.querySelector('.context-menu');
        if (existing) existing.remove();
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.cssText = 'position:fixed; background:var(--bg-card); border:1px solid var(--border-light); border-radius:8px; padding:5px 0; z-index:9999; direction:rtl;';
        const copy = createMenuItem('📋 نسخ', () => { app.copyMessage(index); menu.remove(); });
        const delMe = createMenuItem('🗑️ حذف لدي', () => { app.deleteMessage(index, 'me'); menu.remove(); });
        const delAll = createMenuItem('🗑️ حذف للجميع', () => { app.deleteMessage(index, 'everyone'); menu.remove(); });
        const separator = document.createElement('div'); separator.style.borderBottom = '1px solid var(--border-light)'; separator.style.margin = '5px 0';
        const emojiTitle = document.createElement('div'); emojiTitle.innerText = 'تفاعل:'; emojiTitle.style.padding = '5px 20px';
        const emojiContainer = document.createElement('div'); emojiContainer.style.cssText = 'display:flex; justify-content:space-around; padding:5px 10px;';
        ['👍', '😂', '😢', '😊', '😍', '❤️'].forEach(emoji => {
            const span = document.createElement('span'); span.textContent = emoji; span.style.cssText = 'cursor:pointer; font-size:1.4rem;';
            span.onclick = () => { app.toggleReaction(index, emoji); menu.remove(); };
            emojiContainer.appendChild(span);
        });
        menu.append(copy, delMe, delAll, separator, emojiTitle, emojiContainer);
        document.body.appendChild(menu);
        const x = event.clientX || (event.touches && event.touches[0].clientX);
        const y = event.clientY || (event.touches && event.touches[0].clientY);
        menu.style.top = y + 'px'; menu.style.left = x + 'px';
        setTimeout(() => {
            const rect = menu.getBoundingClientRect();
            if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 10) + 'px';
            if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
        }, 10);
        const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); } };
        setTimeout(() => document.addEventListener('click', close), 100);
    };

    function createMenuItem(text, onClick) {
        const div = document.createElement('div');
        div.innerText = text;
        div.style.cssText = 'padding:8px 20px; cursor:pointer;';
        div.onclick = onClick;
        return div;
    }

    app.copyMessage = function(index) {
        const msgs = app.getCurrentChatMessages();
        if (!msgs[index] || !msgs[index].text) return showToast('لا يوجد نص لنسخه', 'info');
        navigator.clipboard.writeText(msgs[index].text).then(() => showToast('تم النسخ', 'success')).catch(() => showToast('فشل النسخ', 'error'));
    };

    app.deleteMessage = async function(index, scope) {
        const msgs = app.getCurrentChatMessages();
        if (!msgs[index]) return;
        if (scope === 'everyone') {
            if (app.user.r === 'admin' || msgs[index].senderId === app.user.s) {
                msgs.splice(index, 1);
                if (app.activeChat.t === 'group') {
                    const group = db.groups.find(g => g.id == app.activeChat.id);
                    if (group) await updateGroup(group.id, { messages: JSON.stringify(group.messages) });
                } else {
                    const cid = [app.user.s, app.activeChat.id].sort().join('_');
                    await saveDirectMessages(cid, msgs);
                }
                app.renderMessages();
                showToast('تم الحذف للجميع', 'success');
            } else showToast('لا صلاحيات', 'error');
        } else if (scope === 'me') {
            if (!msgs[index].deletedFor) msgs[index].deletedFor = [];
            if (!msgs[index].deletedFor.includes(app.user.s)) {
                msgs[index].deletedFor.push(app.user.s);
                if (app.activeChat.t === 'group') {
                    const group = db.groups.find(g => g.id == app.activeChat.id);
                    if (group) await updateGroup(group.id, { messages: JSON.stringify(group.messages) });
                } else {
                    const cid = [app.user.s, app.activeChat.id].sort().join('_');
                    await saveDirectMessages(cid, msgs);
                }
                app.renderMessages();
                showToast('تم الحذف من جهازك', 'success');
            }
        }
    };

    app.toggleReaction = async function(index, emoji) {
        const msgs = app.getCurrentChatMessages();
        const msg = msgs[index];
        if (!msg) return;
        if (!msg.reactions) msg.reactions = [];
        const existing = msg.reactions.findIndex(r => r.userId === app.user.s && r.emoji === emoji);
        if (existing > -1) msg.reactions.splice(existing, 1);
        else { msg.reactions = msg.reactions.filter(r => r.userId !== app.user.s); msg.reactions.push({ userId: app.user.s, emoji }); }
        if (app.activeChat.t === 'group') {
            const group = db.groups.find(g => g.id == app.activeChat.id);
            if (group) await updateGroup(group.id, { messages: JSON.stringify(group.messages) });
        } else {
            const cid = [app.user.s, app.activeChat.id].sort().join('_');
            await saveDirectMessages(cid, msgs);
        }
        app.renderMessages();
    };

    app.renderChatList = function() {
        const div = document.getElementById('group-list');
        if (!div) return;
        if (!db.contacts[app.user.s]) db.contacts[app.user.s] = [];
        const myContacts = db.contacts[app.user.s];
        let html = '<h4 style="padding:15px; margin:0; background:var(--primary-dark); color:white;">📋 المحادثات</h4>';
        html += `<div style="padding:12px; display:flex; gap:8px;">
            <input type="text" id="contact-serial-input" placeholder="أدخل الرقم التسلسلي..." style="flex:1; padding:8px; border-radius:6px;">
            <button onclick="app.addContact()" style="background:var(--primary-dark); color:white; border:none; padding:8px 15px; border-radius:6px;">➕ تواصل</button>
        </div>`;
        const userGroups = db.groups.filter(g => g.members.includes(app.user.s));
        if (userGroups.length) {
            html += '<div style="padding:8px 15px; background:var(--sidebar-bg); color:white;">📢 المجموعات</div>';
            userGroups.forEach(g => {
                let leaveBtn = '';
                if (app.user.r === 'teacher') leaveBtn = `<button onclick="event.stopPropagation(); app.forceLeaveGroup('${g.id}')" style="background:#dc3545; color:white; margin-right:8px; border:none; border-radius:4px; padding:2px 8px;">🚪 خروج</button>`;
                else if (g.allowExit) leaveBtn = `<button onclick="event.stopPropagation(); app.leaveGroup('${g.id}')" style="background:#dc3545; color:white; margin-right:8px; border:none; border-radius:4px; padding:2px 8px;">🚪 مغادرة</button>`;
                html += `<div class="chat-item" data-chat-id="group-${g.id}" onclick="app.openChat('group','${g.id}')">
                            <div class="chat-avatar">👥</div><div class="chat-info"><b>${g.name}</b></div>${leaveBtn}</div>`;
            });
        }
        html += '<div style="padding:8px 15px; background:var(--sidebar-bg); color:white;">👤 جهات اتصالي</div>';
        if (myContacts.length === 0) html += '<p style="text-align:center; padding:25px; color:#888;">لا توجد جهات اتصال بعد.</p>';
        else {
            myContacts.forEach(contactId => {
                const user = db.systemUsers.find(u => u.s == contactId);
                if (user) {
                    const pfp = db.pfp[user.s] || "https://cdn-icons-png.flaticon.com/512/149/149071.png";
                    const roleText = user.r === 'teacher' ? 'معلم - ' + user.sub : user.r === 'admin' ? 'مدير النظام' : 'طالب';
                    html += `<div class="chat-item" data-chat-id="user-${user.s}" onclick="app.openChat('user','${user.s}')">
                                <img src="${pfp}" width="40" height="40" style="border-radius:50%; margin-left:12px;">
                                <div class="chat-info"><b>${user.n}</b><br><small>${roleText}</small></div>
                                <button onclick="event.stopPropagation(); app.deleteContact('${user.s}')" style="margin-right:auto; background:none; border:none; color:#dc3545; cursor:pointer;">✕</button>
                            </div>`;
                }
            });
        }
        div.innerHTML = html;
        if (app.activeChat) {
            const id = app.activeChat.t === 'group' ? `group-${app.activeChat.id}` : `user-${app.activeChat.id}`;
            const selected = div.querySelector(`.chat-item[data-chat-id="${id}"]`);
            if (selected) selected.style.backgroundColor = 'var(--primary-light)';
        }
        if (window.innerWidth <= 768) document.querySelector('.chat-container')?.classList.add('show-sidebar');
    };

    app.forceLeaveGroup = async function(groupId) {
        const group = db.groups.find(g => g.id == groupId);
        if (!group || !group.members.includes(app.user.s)) return showToast("لست عضواً", "error");
        group.members = group.members.filter(m => m !== app.user.s);
        group.messages.push({ senderId:"system", senderName:"النظام", time:new Date().toLocaleTimeString(), text:`📢 خرج الأستاذ ${app.user.n} من المجموعة`, images:[], reactions:[], deletedFor:[] });
        await updateGroup(groupId, { members: JSON.stringify(group.members), messages: JSON.stringify(group.messages) });
        if (app.activeChat?.id == groupId) app.renderMessages();
        app.renderChatList();
        showToast("تمت المغادرة بنجاح", "success");
    };

    app.leaveGroup = async function(groupId) {
        const group = db.groups.find(g => g.id == groupId);
        if (!group || !group.allowExit || !group.members.includes(app.user.s)) return;
        group.members = group.members.filter(m => m !== app.user.s);
        await updateGroup(groupId, { members: JSON.stringify(group.members) });
        if (app.activeChat?.id == groupId) { app.activeChat = null; document.getElementById('chat-header').innerHTML = 'اختر محادثة لبدء الدردشة'; document.getElementById('chat-box').innerHTML = ''; }
        app.renderChatList();
        showToast("تمت المغادرة بنجاح", "success");
    };

    app.deleteContact = function(serial) {
        if (db.contacts[app.user.s]) db.contacts[app.user.s] = db.contacts[app.user.s].filter(s => s !== serial);
        app.syncLocalStorage();
        app.renderChatList();
        showToast("تم حذف جهة الاتصال", "success");
    };

    app.addContact = function() {
        const input = document.getElementById('contact-serial-input');
        const serial = input.value.trim();
        if (!serial) return showToast("الرجاء إدخال رقم تسلسلي.", "warning");
        const targetUser = db.systemUsers.find(u => u.s === serial);
        if (!targetUser) return showToast("⚠️ الرقم التسلسلي غير صحيح أو غير موجود.", "error");
        if (targetUser.s === app.user.s) return showToast("لا يمكنك إضافة نفسك!", "warning");
        if (!db.contacts[app.user.s]) db.contacts[app.user.s] = [];
        if (db.contacts[app.user.s].includes(serial)) return showToast("جهة الاتصال موجودة بالفعل.", "info");
        db.contacts[app.user.s].push(serial);
        app.syncLocalStorage();
        app.renderChatList();
        input.value = '';
        app.addNotif('user', serial, `أضافك ${app.user.n} إلى جهات الاتصال`);
        showToast(`تم إضافة ${targetUser.n} إلى جهات الاتصال بنجاح.`, "success");
    };

    app.openChat = function(type, id) {
        app.activeChat = { t: type, id: id };
        app.renderChatHeader();
        app.renderMessages();
        document.querySelectorAll('.chat-item').forEach(i => i.style.backgroundColor = '');
        const selectedId = type === 'group' ? `group-${id}` : `user-${id}`;
        const selected = document.querySelector(`.chat-item[data-chat-id="${selectedId}"]`);
        if (selected) selected.style.backgroundColor = 'var(--primary-light)';
        if (window.innerWidth <= 768) {
            const container = document.querySelector('.chat-container');
            if (container) { container.classList.remove('show-sidebar'); container.classList.add('show-chat'); }
        }
    };

    app.goBackToChatList = function() {
        if (window.innerWidth <= 768) {
            const container = document.querySelector('.chat-container');
            if (container) { container.classList.remove('show-chat'); container.classList.add('show-sidebar'); }
        }
    };

    app.renderChatHeader = function() {
        const header = document.getElementById('chat-header');
        if (!header || !app.activeChat) return;
        let name = "", leaveBtn = "";
        if (app.activeChat.t === 'group') {
            const group = db.groups.find(g => g.id == app.activeChat.id);
            if (group) {
                name = group.name;
                if (app.user.r === 'teacher') leaveBtn = `<button onclick="app.forceLeaveGroup('${group.id}')" style="margin-right:auto; background:#dc3545; color:white; border:none; padding:5px 12px; border-radius:5px;">🚪 خروج إجباري</button>`;
                else if (group.allowExit) leaveBtn = `<button onclick="app.leaveGroup('${group.id}')" style="margin-right:auto; background:#dc3545; color:white; border:none; padding:5px 12px; border-radius:5px;">🚪 مغادرة</button>`;
            }
        } else {
            name = db.systemUsers.find(u => u.s == app.activeChat.id)?.n || "";
        }
        header.innerHTML = `<button class="back-btn" onclick="app.goBackToChatList()">←</button> <span>محادثة مع <b>${name}</b></span> ${leaveBtn}`;
    };

    app.toggleEmojiPicker = function() {
        const picker = document.getElementById('emoji-picker');
        if (!picker) return;
        if (picker.classList.contains('hidden')) {
            const emojis = ['😀','😂','😍','😢','😡','👍','👎','❤️','🔥','🎉','🤔','🙏'];
            picker.innerHTML = emojis.map(e => `<span onclick="app.insertEmoji('${e}')">${e}</span>`).join('');
            picker.classList.remove('hidden');
        } else picker.classList.add('hidden');
    };

    app.insertEmoji = function(emoji) {
        const input = document.getElementById('chat-msg');
        if (input) { input.value += emoji; input.focus(); }
        document.getElementById('emoji-picker')?.classList.add('hidden');
    };
}