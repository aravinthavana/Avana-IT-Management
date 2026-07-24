import React, { useMemo, useState, useEffect } from 'react';
import { User } from '../../types';
import { ICONS } from '../../constants';

interface UserHierarchyProps {
    users: User[];
    searchTerm: string;
    filterCompany: string;
    filterAccountType: string;
    onSelectUser: (userId: number) => void;
    loggedInUserId?: number;
}

const TreeNode: React.FC<{
    user: User;
    childrenNodes: User[];
    allChildrenMap: Map<number, User[]>;
    level: number;
    searchTerm: string;
    matchedUserIds: Set<number>;
    ancestorsOfMatched: Set<number>;
    onSelectUser: (userId: number) => void;
    loggedInUserId?: number;
}> = ({ user, childrenNodes, allChildrenMap, level, searchTerm, matchedUserIds, ancestorsOfMatched, onSelectUser, loggedInUserId }) => {
    const hasChildren = childrenNodes && childrenNodes.length > 0;
    
    // Auto-expand if search is active and this node is an ancestor of a matched node
    const shouldAutoExpand = searchTerm.length > 0 && ancestorsOfMatched.has(user.id);
    
    // Also expand by default if it's the root level
    const [isExpanded, setIsExpanded] = useState(level === 0);

    useEffect(() => {
        if (searchTerm.length > 0) {
            setIsExpanded(shouldAutoExpand);
        }
    }, [searchTerm, shouldAutoExpand]);

    const isMatch = searchTerm.length > 0 && matchedUserIds.has(user.id);
    const isSelf = user.id === loggedInUserId;
    const isInactive = user.status === 'Inactive';

    return (
        <div className="w-full">
            <div 
                className={`flex items-center py-2 px-3 my-1 rounded-lg border transition-colors cursor-pointer group ${
                    isMatch 
                        ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50' 
                        : 'bg-white border-transparent hover:border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/50 dark:hover:border-slate-600'
                } ${isInactive ? 'opacity-70' : ''}`}
                style={{ marginLeft: `${level * 24}px` }}
                onClick={() => onSelectUser(user.id)}
            >
                <div 
                    className="w-6 h-6 flex items-center justify-center mr-2 cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (hasChildren) setIsExpanded(!isExpanded);
                    }}
                >
                    {hasChildren ? (
                        isExpanded ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        ) : (
                            <svg className="w-4 h-4 transform -rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        )
                    ) : (
                        <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                    )}
                </div>

                <div className="flex items-center gap-3 flex-1 min-w-0">
                    {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="h-8 w-8 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                    ) : (
                        <div className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs bg-gradient-to-br from-red-400 to-red-600 text-white flex-shrink-0">
                            {user.name?.charAt(0).toUpperCase()}
                        </div>
                    )}
                    
                    <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                        <div className="flex items-center gap-2 truncate">
                            <span className={`font-semibold text-sm truncate ${isMatch ? 'text-red-700 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'}`}>
                                {user.name}
                            </span>
                            {isSelf && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">You</span>}
                            {isInactive && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">Inactive</span>}
                        </div>
                        <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 truncate gap-2">
                            {user.jobTitle && <span className="truncate" title={user.jobTitle}>{user.jobTitle}</span>}
                            {user.jobTitle && user.department?.name && <span>•</span>}
                            {user.department?.name && <span className="truncate">{user.department.name}</span>}
                        </div>
                    </div>
                </div>
            </div>

            {hasChildren && isExpanded && (
                <div className="flex flex-col relative before:absolute before:left-[11px] before:top-0 before:bottom-4 before:w-px before:bg-slate-200 dark:before:bg-slate-700">
                    {childrenNodes.map(child => (
                        <TreeNode 
                            key={child.id}
                            user={child}
                            childrenNodes={allChildrenMap.get(child.id) || []}
                            allChildrenMap={allChildrenMap}
                            level={level + 1}
                            searchTerm={searchTerm}
                            matchedUserIds={matchedUserIds}
                            ancestorsOfMatched={ancestorsOfMatched}
                            onSelectUser={onSelectUser}
                            loggedInUserId={loggedInUserId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const UserHierarchy: React.FC<UserHierarchyProps> = ({ users, searchTerm, filterCompany, filterAccountType, onSelectUser, loggedInUserId }) => {
    
    const { rootNodes, childrenMap, matchedUserIds, ancestorsOfMatched } = useMemo(() => {
        // 1. Filter by company and account type (these actually remove nodes from the tree)
        const visibleUsers = users.filter(user => {
            const matchesCompany = filterCompany === 'All' || user.company === filterCompany;
            const accType = user.accountType || 'Employee';
            const matchesAccountType = filterAccountType === 'All' || accType === filterAccountType;
            return matchesCompany && matchesAccountType;
        });

        const visibleIds = new Set(visibleUsers.map(u => u.id));
        const userMap = new Map<number, User>();
        visibleUsers.forEach(u => userMap.set(u.id, u));

        // 2. Identify search matches
        const matches = new Set<number>();
        if (searchTerm.length > 0) {
            const lowerSearch = searchTerm.toLowerCase();
            visibleUsers.forEach(u => {
                if (
                    (u.name || '').toLowerCase().includes(lowerSearch) ||
                    (u.email || '').toLowerCase().includes(lowerSearch) ||
                    (u.department?.name || '').toLowerCase().includes(lowerSearch) ||
                    (u.jobTitle || '').toLowerCase().includes(lowerSearch)
                ) {
                    matches.add(u.id);
                }
            });
        }

        // 3. Build hierarchy map
        const children = new Map<number, User[]>();
        const roots: User[] = [];

        visibleUsers.forEach(user => {
            // A node is a root if it has no manager OR its manager is not in the visible list
            if (!user.managerId || !visibleIds.has(user.managerId)) {
                roots.push(user);
            } else {
                if (!children.has(user.managerId)) {
                    children.set(user.managerId, []);
                }
                children.get(user.managerId)!.push(user);
            }
        });

        // Sort children alphabetically
        roots.sort((a, b) => a.name.localeCompare(b.name));
        children.forEach(list => list.sort((a, b) => a.name.localeCompare(b.name)));

        // 4. Identify ancestors of matched nodes for auto-expansion
        const ancestors = new Set<number>();
        if (matches.size > 0) {
            // function to trace path to root
            const traceAncestors = (userId: number) => {
                let curr = userMap.get(userId);
                while (curr && curr.managerId && visibleIds.has(curr.managerId)) {
                    ancestors.add(curr.managerId);
                    curr = userMap.get(curr.managerId);
                }
            };
            matches.forEach(id => traceAncestors(id));
        }

        return { rootNodes: roots, childrenMap: children, matchedUserIds: matches, ancestorsOfMatched: ancestors };
    }, [users, searchTerm, filterCompany, filterAccountType]);

    if (rootNodes.length === 0) {
        return (
            <div className="text-center py-16 text-slate-500 dark:text-slate-400">
                <p className="text-lg font-medium">No users found</p>
                <p className="text-sm mt-1">Try adjusting your filters.</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6 overflow-x-auto">
            <div className="min-w-[600px]">
                {rootNodes.map(root => (
                    <TreeNode 
                        key={root.id}
                        user={root}
                        childrenNodes={childrenMap.get(root.id) || []}
                        allChildrenMap={childrenMap}
                        level={0}
                        searchTerm={searchTerm}
                        matchedUserIds={matchedUserIds}
                        ancestorsOfMatched={ancestorsOfMatched}
                        onSelectUser={onSelectUser}
                        loggedInUserId={loggedInUserId}
                    />
                ))}
            </div>
        </div>
    );
};

export default UserHierarchy;
