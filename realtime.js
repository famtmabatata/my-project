// realtime.js
import { supabase } from "./supabase-config.js";

export function enableRealtime(app) {
    supabase
        .channel('public-changes')
        .on('postgres_changes', { event: '*', schema: 'public' }, payload => {
            handleRealtimeChange(app, payload);
        })
        .subscribe();
}

function handleRealtimeChange(app, payload) {
    const table = payload.table;
    if (table === 'messages' && app.activeChat) {
        if (payload.eventType === 'INSERT') {
            app.getCurrentChatMessages().push(payload.new);
            app.renderMessages();
        }
    } else if (table === 'notifications') {
        app.db.notifs.unshift(payload.new);
        app.updateBellCount();
        app.renderNotifsList();
    } else if (table === 'homeworks') {
        if (app.user.r === 'student') app.renderStudentHomeworks();
    }
}