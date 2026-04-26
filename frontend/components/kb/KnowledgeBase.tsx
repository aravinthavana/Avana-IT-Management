import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { useAuth } from '../../contexts/AuthContext';
import { ICONS } from '../../constants';
import { KnowledgeBaseArticle } from '../../types';

const KnowledgeBase: React.FC = () => {
    const { kbArticles, setKbArticles, getHeaders, setNotification } = useAppContext();
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedArticle, setSelectedArticle] = useState<KnowledgeBaseArticle | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        category: 'Troubleshooting',
        content: ''
    });

    const categories = ['Troubleshooting', 'Policy', 'SOP', 'FAQ'];

    const filteredArticles = useMemo(() => {
        return kbArticles.filter(a => 
            a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.content.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [kbArticles, searchTerm]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const method = selectedArticle && isModalOpen ? 'PUT' : 'POST';
            const url = selectedArticle && isModalOpen 
                ? `${(import.meta as any).env.VITE_API_URL || 'http://localhost:8080'}/api/kb/${selectedArticle.id}`
                : `${(import.meta as any).env.VITE_API_URL || 'http://localhost:8080'}/api/kb`;

            const res = await fetch(url, {
                method,
                headers: getHeaders(),
                body: JSON.stringify(formData)
            });
            if (!res.ok) throw new Error('Failed to save article');
            const saved = await res.json();
            
            if (method === 'POST') {
                setKbArticles([saved, ...kbArticles]);
            } else {
                setKbArticles(kbArticles.map(a => a.id === selectedArticle?.id ? saved : a));
            }
            
            setIsModalOpen(false);
            setSelectedArticle(null);
            setFormData({ title: '', category: 'Troubleshooting', content: '' });
            setNotification({ message: 'Article saved successfully', type: 'success' });
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this article?')) return;
        try {
            const res = await fetch(`${(import.meta as any).env.VITE_API_URL || 'http://localhost:8080'}/api/kb/${id}`, {
                method: 'DELETE',
                headers: getHeaders()
            });
            if (!res.ok) throw new Error('Failed to delete article');
            setKbArticles(kbArticles.filter(a => a.id !== id));
            setNotification({ message: 'Article deleted', type: 'success' });
            setSelectedArticle(null);
        } catch (err: any) {
            setNotification({ message: err.message, type: 'error' });
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Knowledge Base</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Policies, SOPs, and troubleshooting guides.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{ICONS.search}</span>
                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pl-11 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-600/20 transition-all" placeholder="Search articles..." />
                    </div>
                    {user?.role === 'Admin' && (
                        <button onClick={() => { setSelectedArticle(null); setFormData({ title: '', category: 'Troubleshooting', content: '' }); setIsModalOpen(true); }} className="bg-red-600 text-white px-5 py-2.5 rounded-2xl hover:bg-red-700 font-bold transition-all active:scale-95 shadow-lg shadow-red-600/20">
                            {ICONS.add} Create
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Categories / List */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Article Categories</h3>
                        <div className="space-y-2">
                            {categories.map(cat => {
                                const count = kbArticles.filter(a => a.category === cat).length;
                                return (
                                    <button key={cat} onClick={() => setSearchTerm(cat)} className="w-full flex justify-between items-center px-4 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-red-600">{cat}</span>
                                        <span className="text-xs font-black bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full text-slate-500">{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="lg:col-span-2 space-y-6">
                    {selectedArticle ? (
                        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden animate-slide-up">
                            <div className="p-8 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="px-3 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full text-[10px] font-black uppercase tracking-widest">{selectedArticle.category}</span>
                                    {user?.role === 'Admin' && (
                                        <div className="flex gap-2">
                                            <button onClick={() => { setFormData({ title: selectedArticle.title, category: selectedArticle.category, content: selectedArticle.content }); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">{ICONS.edit}</button>
                                            <button onClick={() => handleDelete(selectedArticle.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors">{ICONS.delete}</button>
                                        </div>
                                    )}
                                </div>
                                <h3 className="text-3xl font-black text-slate-800 dark:text-white leading-tight mb-2">{selectedArticle.title}</h3>
                                <p className="text-xs text-slate-500 font-medium">Last updated on {new Date(selectedArticle.updatedAt).toLocaleDateString()} by {selectedArticle.author?.name}</p>
                            </div>
                            <div className="p-8">
                                <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                    {selectedArticle.content}
                                </div>
                                <button onClick={() => setSelectedArticle(null)} className="mt-12 text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2 hover:underline">
                                    &larr; Back to list
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredArticles.map(article => (
                                <button key={article.id} onClick={() => setSelectedArticle(article)} className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 text-left hover:shadow-xl hover:-translate-y-1 transition-all group">
                                    <span className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest block mb-2">{article.category}</span>
                                    <h4 className="text-lg font-black text-slate-800 dark:text-white mb-2 group-hover:text-red-600 transition-colors line-clamp-2">{article.title}</h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3 mb-4 leading-relaxed">{article.content}</p>
                                    <div className="flex items-center justify-between mt-auto">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{new Date(article.updatedAt).toLocaleDateString()}</span>
                                        <span className="text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">&rarr;</span>
                                    </div>
                                </button>
                            ))}
                            {filteredArticles.length === 0 && (
                                <div className="col-span-2 py-20 text-center">
                                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                        {ICONS.kb}
                                    </div>
                                    <p className="text-slate-500 font-medium">No articles found matching your search.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-scale-in">
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="text-xl font-black text-slate-800 dark:text-white">{selectedArticle ? 'Edit Article' : 'New Article'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl">{ICONS.close}</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="grid grid-cols-3 gap-6">
                                <div className="col-span-2">
                                    <label className="block text-sm font-black text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-tight">Title</label>
                                    <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-0 rounded-2xl px-5 py-3 text-slate-800 dark:text-white focus:ring-2 focus:ring-red-600/20 transition-all outline-none" placeholder="How to setup email..." />
                                </div>
                                <div>
                                    <label className="block text-sm font-black text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-tight">Category</label>
                                    <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-0 rounded-2xl px-5 py-3 text-slate-800 dark:text-white focus:ring-2 focus:ring-red-600/20 transition-all outline-none">
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-black text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-tight">Content (Plain text or Markdown)</label>
                                <textarea required rows={12} value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-0 rounded-2xl px-5 py-3 text-slate-800 dark:text-white focus:ring-2 focus:ring-red-600/20 transition-all outline-none font-mono text-sm leading-relaxed" placeholder="Type your article content here..." />
                            </div>
                            <button type="submit" className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-red-700 transition-all active:scale-[0.98] shadow-xl shadow-red-600/20">Save Article</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KnowledgeBase;
