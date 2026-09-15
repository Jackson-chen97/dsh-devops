function safeGet(obj, path) {
    if (obj == null || typeof obj !== 'object') return undefined;
    let current = obj;
    for (const key of path.split('.')){
        if (current == null || typeof current !== 'object') return undefined;
        current = current[key];
    }
    return current;
}
function str(value) {
    return value == null ? '' : String(value);
}
const MR_ACTIONS = new Set([
    'open',
    'update',
    'close',
    'merge',
    'approval',
    'unapproval'
]);
export function parseEvent(header) {
    switch(header){
        case 'Merge Request Hook':
            return null;
        case 'Pipeline Hook':
            return {
                type: 'pipeline',
                action: 'created'
            };
        case 'Tag Push Hook':
            return {
                type: 'tag_push'
            };
        case 'Note Hook':
            return {
                type: 'note',
                action: 'create'
            };
        default:
            return null;
    }
}
export function parseMergeRequestEvent(payload) {
    if (payload == null || typeof payload !== 'object') return null;
    const action = payload.object_attributes?.action;
    if (typeof action !== 'string' || !MR_ACTIONS.has(action)) return null;
    const mrAction = action;
    return {
        type: 'merge_request',
        action: mrAction
    };
}
export function toFollowupMessage(event, payload) {
    switch(event.type){
        case 'merge_request':
            {
                const iid = str(safeGet(payload, 'object_attributes.iid'));
                const title = str(safeGet(payload, 'object_attributes.title'));
                const target = str(safeGet(payload, 'object_attributes.target_branch'));
                switch(event.action){
                    case 'merge':
                        return `✅ MR !${iid} "${title}" 已合并到 ${target}`;
                    case 'approval':
                        return `👍 MR !${iid} 获得审批`;
                    case 'unapproval':
                        return `👎 MR !${iid} 审批被撤回`;
                    case 'close':
                        return `🔒 MR !${iid} "${title}" 已关闭`;
                    default:
                        return null;
                }
            }
        case 'pipeline':
            {
                const id = str(safeGet(payload, 'object_attributes.id'));
                const ref = str(safeGet(payload, 'object_attributes.ref'));
                const webUrl = str(safeGet(payload, 'object_attributes.web_url'));
                switch(event.action){
                    case 'success':
                        return `✅ Pipeline #${id} 在 ${ref} 成功`;
                    case 'failed':
                        return `⚠️ Pipeline #${id} 在 ${ref} 失败! ${webUrl}`;
                    case 'canceled':
                        return `🚫 Pipeline #${id} 被取消`;
                    default:
                        return null;
                }
            }
        case 'tag_push':
            {
                const ref = str(safeGet(payload, 'ref'));
                return `🏷️ 新 Tag: ${ref}`;
            }
        case 'note':
            {
                const mrId = str(safeGet(payload, 'merge_request.iid')) || str(safeGet(payload, 'object_attributes.merge_request_id'));
                const note = str(safeGet(payload, 'object_attributes.note'));
                const truncated = note.length > 200 ? `${note.slice(0, 200)}…` : note;
                return `💬 MR !${mrId} 新评论: ${truncated}`;
            }
    }
}
export function getEventType(header) {
    if (!header) return 'unknown';
    const known = {
        'Merge Request Hook': 'merge_request',
        'Pipeline Hook': 'pipeline',
        'Tag Push Hook': 'tag_push',
        'Note Hook': 'note',
        'Push Hook': 'push',
        'Issue Hook': 'issue'
    };
    if (known[header] !== undefined) return known[header];
    return header.toLowerCase().replace(/\s*hook\s*$/, '').replace(/\s+/g, '_');
}
