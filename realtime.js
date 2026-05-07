import { supabase } from "./supabase-config.js";

export function enableRealtime(app) {
    supabase
        .channel('public-changes')
        .on('postgres_changes', { event: '*', schema: 'public' }, payload => {
            handleRealtimeChange(app, payload);
        })
        .subscribe();

    // قناة الكتابة
    supabase.channel('typing')
        .on('broadcast', { event: 'typing' }, (payload) => {
            if (app.activeChat && payload.payload.chatId === app.activeChat.id && payload.payload.userId !== app.user.s) {
                // إطلاق حدث مخصص لاستخدامه في chat.js
                window.dispatchEvent(new CustomEvent('typing-event', { detail: payload.payload }));
            }
        })
        .subscribe();
}

function handleRealtimeChange(app, payload) {
    const table = payload.table;
    if (table === 'messages' && app.activeChat) {
        if (payload.eventType === 'INSERT') {
            app.getCurrentChatMessages().push(payload.new);
            app.renderMessages();
            if (payload.new.senderId !== app.user.s) {
                app.sendBrowserNotification('رسالة جديدة', payload.new.senderName + ': ' + (payload.new.text || 'صورة'));
            }
        }
    } else if (table === 'notifications') {
        app.db.notifs.unshift(payload.new);
        app.updateBellCount();
        app.renderNotifsList();
        app.sendBrowserNotification('إشعار', payload.new.msg);
    } else if (table === 'homeworks') {
        if (app.user?.r === 'student') app.renderStudentHomeworks();
    }
}