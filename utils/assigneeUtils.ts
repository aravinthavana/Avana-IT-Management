export const getAssigneeDisplayInfo = (assigneeId: number | undefined, assigneeType: string | undefined, users: any[], departments: any[], branches: any[]) => {
    if (!assigneeId || !assigneeType) return { name: 'Unassigned', type: '', typeColor: '' };
    if (assigneeType === 'User') {
        const user = users.find(u => u.id === assigneeId);
        return { name: user?.name || 'Unknown User', type: 'User', typeColor: 'text-blue-700 bg-blue-100 dark:bg-blue-900 dark:text-blue-300' };
    }
    if (assigneeType === 'Department') {
        const dept = departments.find(d => d.id === assigneeId);
        return { name: dept?.name || 'Unknown Dept', type: 'Department', typeColor: 'text-green-700 bg-green-100 dark:bg-green-900 dark:text-green-300' };
    }
    if (assigneeType === 'Branch') {
        const branch = branches.find(b => b.id === assigneeId);
        return { name: branch?.name || 'Unknown Branch', type: 'Branch', typeColor: 'text-yellow-700 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300' };
    }
    return { name: 'Unknown', type: assigneeType, typeColor: 'bg-gray-100 text-gray-800' };
};
