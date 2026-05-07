import { supabase } from "./supabase-config.js";

export function enableRealtime(app) {
    // القناة الأساسية لمراقبة تغييرات قاعدة البيانات
    supabase
        .channel('public-changes')
        .on('postgres_changes', { event: '*', schema: 'public' }, payload => {
            handleRealtimeChange(app, payload);
        })
        .subscribe();

    // قناة خاصة للكتابة (مؤشر "يكتب...")
    supabase.channel('typing')
        .on('broadcast', { event: 'typing' }, (payload) => {
            if (app.activeChat && payload.payload.chatId === app.activeChat.id && payload.payload.userId !== app.user.s) {
                window.dispatchEvent(new CustomEvent('typing-event', { detail: payload.payload }));
            }
        })
        .on('broadcast', { event: 'stop_typing' }, (payload) => {
            if (app.activeChat && payload.payload.chatId === app.activeChat.id && payload.payload.userId !== app.user.s) {
                window.dispatchEvent(new CustomEvent('stop-typing-event', { detail: payload.payload }));
            }
        })
        .subscribe();
}

function handleRealtimeChange(app, payload) {
    const table = payload.table;
    const eventType = payload.eventType;

    // --- التعامل مع الرسائل المباشرة (direct_messages) ---
    if (table === 'direct_messages') {
        const chatId = payload.new?.chat_id || payload.old?.chat_id;
        if (!chatId) return;

        // تحديث قاعدة البيانات المحلية بمحتوى العمود messages (نص JSON)
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
            const messages = JSON.parse(payload.new.messages || '[]');
            app.db.directMessages[chatId] = messages;

            // عرض الرسائل لو كانت هي المحادثة النشطة
            if (app.activeChat && app.activeChat.t === 'user') {
                const activeCid = [app.user.s, app.activeChat.id].sort().join('_');
                if (activeCid === chatId) {
                    app.renderMessages();

                    // إرسال إشعار إذا كانت الرسالة الأخيرة من شخص آخر
                    const lastMsg = messages[messages.length - 1];
                    if (lastMsg && lastMsg.senderId !== app.user.s) {
                        app.sendBrowserNotification('رسالة جديدة', lastMsg.senderName + ': ' + (lastMsg.text || 'صورة'));
                    }
                }
            }
        } else if (eventType === 'DELETE') {
            // يمكن حذف الدردشة بالكامل، فقط احذف السجل المحلي
            delete app.db.directMessages[chatId];
        }
    }

    // --- التعامل مع رسائل المجموعات (groups) ---
    else if (table === 'groups') {
        const groupId = payload.new?.id || payload.old?.id;
        if (!groupId) return;

        if (eventType === 'UPDATE' || eventType === 'INSERT') {
            const updatedGroup = payload.new;
            // تحديث بيانات المجموعة في الذاكرة
            const index = app.db.groups.findIndex(g => g.id == groupId);
            if (index !== -1) {
                app.db.groups[index] = {
                    ...app.db.groups[index],
                    name: updatedGroup.name,
                    members: JSON.parse(updatedGroup.members || '[]'),
                    messages: JSON.parse(updatedGroup.messages || '[]'),
                    allowExit: updatedGroup.allowExit,
                    whoCanPost: updatedGroup.whoCanPost
                };
            } else if (eventType === 'INSERT') {
                app.db.groups.push({
                    id: updatedGroup.id.toString(),
                    name: updatedGroup.name,
                    members: JSON.parse(updatedGroup.members || '[]'),
                    messages: JSON.parse(updatedGroup.messages || '[]'),
                    allowExit: updatedGroup.allowExit,
                    whoCanPost: updatedGroup.whoCanPost
                });
            }

            // عرض الرسائل لو كانت هذه المجموعة نشطة
            if (app.activeChat && app.activeChat.t === 'group' && app.activeChat.id == groupId) {
                app.renderMessages();

                const msgs = app.db.groups[index]?.messages || [];
                const lastMsg = msgs[msgs.length - 1];
                if (lastMsg && lastMsg.senderId !== app.user.s) {
                    app.sendBrowserNotification('رسالة مجموعة', lastMsg.senderName + ': ' + (lastMsg.text || 'صورة'));
                }
            }
        } else if (eventType === 'DELETE') {
            app.db.groups = app.db.groups.filter(g => g.id != groupId);
            if (app.activeChat?.id == groupId) {
                app.activeChat = null;
                document.getElementById('chat-header').innerHTML = 'اختر محادثة';
                document.getElementById('chat-box').innerHTML = '';
            }
        }
    }

    // --- الإشعارات العامة ---
    else if (table === 'notifications') {
        if (eventType === 'INSERT') {
            app.db.notifs.unshift(payload.new);
            app.updateBellCount();
            app.renderNotifsList();
            app.sendBrowserNotification('إشعار', payload.new.msg);
        }
    }

    // --- الواجبات المنزلية للطالب ---
    else if (table === 'homeworks') {
        if (app.user?.r === 'student') app.renderStudentHomeworks();
    }
}
