import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';
import { API_URL } from '../../utils/apiClient';
import React, { useState, useMemo, useRef } from 'react';
import { useAppContext } from '../../hooks/useAppContext';
import { useAuth } from '../../contexts/AuthContext';
import { ICONS } from '../../constants';
import { KnowledgeBaseArticle } from '../../types';
import { sanitizeHtml } from '../../utils/sanitize';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';


const KnowledgeBase: React.FC = () => {
    const { kbArticles, setKbArticles, getHeaders, setNotification } = useAppContext();
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedArticle, setSelectedArticle] = useState<KnowledgeBaseArticle | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const editorRef = useDialogAccessibility(isModalOpen, () => setIsModalOpen(false));
    const [formData, setFormData] = useState({
        title: '',
        category: 'Troubleshooting',
        content: ''
    });

    const quillRef = useRef<any>(null);

    const categories = ['Troubleshooting', 'Policy', 'SOP', 'FAQ'];

    const filteredArticles = useMemo(() => {
        return kbArticles.filter(a =>
            a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.content.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [kbArticles, searchTerm]);

    const imageHandler = () => {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.click();

        input.onchange = async () => {
            const file = input.files ? input.files[0] : null;
            if (!file) return;

            const uploadData = new FormData();
            uploadData.append('image', file);

            try {
                const headers = getHeaders() as any;
                delete headers['Content-Type']; // Let browser set boundary for FormData

                const res = await fetch(`${API_URL}/api/upload`, {
                    method: 'POST',
                    headers,
                    body: uploadData,
                    credentials: 'include'
                });

                if (!res.ok) throw new Error('Upload failed');
                const { url } = await res.json();

                const quill = quillRef.current;
                if (quill) {
                    const range = quill.getEditor().getSelection();
                    quill.getEditor().insertEmbed(range ? range.index : 0, 'image', url);
                }
            } catch (err: any) {
                setNotification({ message: 'Failed to upload image', type: 'error' });
            }
        };
    };

    const modules = useMemo(() => ({
        toolbar: {
            container: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['link', 'image'],
                ['clean']
            ],
            handlers: {
                image: imageHandler
            }
        }
    }), []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const method = selectedArticle && isModalOpen ? 'PUT' : 'POST';
            const url = selectedArticle && isModalOpen
                ? `${API_URL}/api/kb/${selectedArticle.id}`
                : `${API_URL}/api/kb`;

            const res = await fetch(url, {
                method,
                headers: getHeaders(),
                body: JSON.stringify(formData),
                credentials: 'include'
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
            const res = await fetch(`${API_URL}/api/kb/${id}`, {
                method: 'DELETE',
                headers: getHeaders(),
                credentials: 'include',
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
                    <h2 className="text-2xl font-black uppercase tracking-tight text-slate-800 dark:text-white">Knowledge Base</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Policies, SOPs, and troubleshooting guides.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{ICONS.search}</span>
                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full border rounded-2xl pl-11 pr-4 py-2.5 text-sm outline-none focus:ring-2 transition-all bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-red-600/20" placeholder="Search articles..." />
                    </div>
                    {user?.role === 'Admin' && (
                        <button onClick={() => { setSelectedArticle(null); setFormData({ title: '', category: 'Troubleshooting', content: '' }); setIsModalOpen(true); }} className="px-5 py-2.5 rounded-2xl font-bold transition-all active:scale-95 shadow-lg bg-brand-600 text-white hover:bg-brand-700 shadow-brand-600/20">
                            {ICONS.add} Create
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Categories / List */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="rounded-3xl shadow-sm border p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <h3 className="text-xs font-black uppercase tracking-widest mb-6 text-slate-400">Article Categories</h3>
                        <div className="space-y-2">
                            {categories.map(cat => {
                                const count = kbArticles.filter(a => a.category === cat).length;
                                return (
                                    <button key={cat} onClick={() => setSearchTerm(cat)} className="w-full flex justify-between items-center px-4 py-3 rounded-2xl transition-colors group hover:bg-slate-50 dark:hover:bg-slate-900">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-brand-600">{cat}</span>
                                        <span className="text-xs font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="lg:col-span-2 space-y-6">
                    {selectedArticle ? (
                        <div className="rounded-3xl shadow-sm border overflow-hidden animate-slide-up bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                            <div className="p-8 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{selectedArticle.category}</span>
                                    {user?.role === 'Admin' && (
                                        <div className="flex gap-2">
                                            <button aria-label="Edit" onClick={() => { setFormData({ title: selectedArticle.title, category: selectedArticle.category, content: selectedArticle.content }); setIsModalOpen(true); }} className="p-2 transition-colors text-slate-400 hover:text-blue-600">{ICONS.edit}</button>
                                            <button aria-label="Delete" onClick={() => handleDelete(selectedArticle.id)} className="p-2 transition-colors text-slate-400 hover:text-red-600">{ICONS.delete}</button>
                                        </div>
                                    )}
                                </div>
                                <h3 className="text-3xl font-black leading-tight mb-2 text-slate-800 dark:text-white">{selectedArticle.title}</h3>
                                <p className="text-xs font-medium text-slate-500">Last updated on {new Date(selectedArticle.updatedAt).toLocaleDateString()} by {selectedArticle.author?.name}</p>
                            </div>
                            <div className="p-8">
                                <div
                                    className="prose dark:prose-invert max-w-none leading-relaxed text-slate-700 dark:text-slate-300"
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedArticle.content) }}
                                />
                                <button onClick={() => setSelectedArticle(null)} className="mt-12 text-sm font-bold flex items-center gap-2 hover:underline text-brand-600 dark:text-red-400">
                                    &larr; Back to list
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredArticles.map(article => (
                                <button key={article.id} onClick={() => setSelectedArticle(article)} className="p-6 rounded-3xl shadow-sm border text-left hover:shadow-xl hover:-translate-y-1 transition-all group bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                    <span className="text-[10px] font-black uppercase tracking-widest block mb-2 text-brand-600 dark:text-red-400">{article.category}</span>
                                    <h4 className="text-lg font-black mb-2 transition-colors line-clamp-2 text-slate-800 dark:text-white group-hover:text-brand-600">{article.title}</h4>
                                    <p className="text-sm line-clamp-3 mb-4 leading-relaxed text-slate-500 dark:text-slate-400">
                                        {article.content.replace(/<[^>]+>/g, '').substring(0, 150) + '...'}
                                    </p>
                                    <div className="flex items-center justify-between mt-auto">
                                        <span className="text-[10px] font-bold uppercase tracking-tight text-slate-400">{new Date(article.updatedAt).toLocaleDateString()}</span>
                                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-brand-600">&rarr;</span>
                                    </div>
                                </button>
                            ))}
                            {filteredArticles.length === 0 && (
                                <div className="col-span-2 py-20 text-center">
                                    <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 bg-slate-50 dark:bg-slate-900 text-slate-300">
                                        {ICONS.kb}
                                    </div>
                                    <p className="font-medium text-slate-500">No articles found matching your search.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div ref={editorRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Article editor" className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-[60] p-4 bg-slate-900/60">
                    <div className="rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-scale-in max-h-[calc(100dvh-1rem)] flex flex-col bg-white dark:bg-slate-800">
                        <div className="px-4 py-4 sm:px-8 sm:py-6 border-b flex justify-between items-center shrink-0 border-slate-100 dark:border-slate-700">
                            <h3 className="text-xl font-black text-slate-800 dark:text-white">{selectedArticle ? 'Edit Article' : 'New Article'}</h3>
                            <button aria-label="Close dialog" onClick={() => setIsModalOpen(false)} className="transition-colors p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">{ICONS.close}</button>
                        </div>
                        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
                            <div className="p-8 space-y-6 overflow-y-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-black mb-2 uppercase tracking-tight text-slate-700 dark:text-slate-300">Title</label>
                                    <input aria-label="Title" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full border-0 rounded-2xl px-5 py-3 focus:ring-2 transition-all outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-red-600/20" placeholder="How to setup email..." />
                                </div>
                                <div>
                                    <label className="block text-sm font-black mb-2 uppercase tracking-tight text-slate-700 dark:text-slate-300">Category</label>
                                    <select aria-label="Category" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border-0 rounded-2xl px-5 py-3 focus:ring-2 transition-all outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-red-600/20">
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-black mb-2 uppercase tracking-tight text-slate-700 dark:text-slate-300">Content</label>
                                <div className="rounded-2xl overflow-hidden border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                                    <ReactQuill
                                        // @ts-ignore
                                        ref={quillRef}
                                        theme="snow"
                                        value={formData.content}
                                        onChange={(val) => setFormData({...formData, content: val})}
                                        modules={modules}
                                        className="h-64 mb-12 text-slate-800 dark:text-white"
                                    />
                                </div>
                            </div>
                            </div>
                            <div className="px-8 py-6 border-t flex gap-4 shrink-0 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 rounded-2xl font-black text-lg transition-all active:scale-[0.98] bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600">Cancel</button>
                                <button type="submit" className="flex-1 py-4 rounded-2xl font-black text-lg transition-all active:scale-[0.98] shadow-xl bg-brand-600 text-white hover:bg-brand-700 shadow-brand-600/20">Save Article</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KnowledgeBase;
