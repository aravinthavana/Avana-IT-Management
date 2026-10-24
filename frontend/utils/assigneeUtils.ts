export const getAssigneeDisplayInfo = (assigneeId: number | undefined, assigneeType: string | undefined, users: any[], departments: any[], branches: any[]) => {
    if (!assigneeId || !assigneeType) return { name: 'Unassigned', type: '', typeColor: '' };
    if (assigneeType.toLowerCase() === 'user') {
        const user = users.find(u => u.id === assigneeId);
        return { name: user?.name || 'Unknown User', type: 'User', typeColor: 'text-ink bg-surface  ' };
    }
    if (assigneeType.toLowerCase() === 'department') {
        const dept = departments.find(d => d.id === assigneeId);
        return { name: dept?.name || 'Unknown Dept', type: 'Department', typeColor: 'text-ink bg-surface  ' };
    }
    if (assigneeType.toLowerCase() === 'branch') {
        const branch = branches.find(b => b.id === assigneeId);
        return { name: branch?.name || 'Unknown Branch', type: 'Branch', typeColor: 'text-ink bg-surface  ' };
    }
    return { name: 'Unknown', type: assigneeType, typeColor: 'bg-muted text-ink' };
};
