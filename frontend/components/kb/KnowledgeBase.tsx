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
                    <h2 className="text-2xl font-black text-ink uppercase tracking-tight">Knowledge Base</h2>
                    <p className="text-quiet text-sm">Policies, SOPs, and troubleshooting guides.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-quiet">{ICONS.search}</span>
                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-surface border border-line rounded-2xl pl-11 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/20 transition-all" placeholder="Search articles..." />
                    </div>
                    {user?.role === 'Admin' && (
                        <button onClick={() => { setSelectedArticle(null); setFormData({ title: '', category: 'Troubleshooting', content: '' }); setIsModalOpen(true); }} className="bg-accent text-on-strong px-5 py-2.5 rounded-2xl hover:bg-accent font-bold transition-all active:scale-95 shadow-lg shadow-strong/15">
                            {ICONS.add} Create
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Categories / List */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-surface rounded-3xl shadow-sm border border-line p-6">
                        <h3 className="text-xs font-black text-quiet uppercase tracking-widest mb-6">Article Categories</h3>
                        <div className="space-y-2">
                            {categories.map(cat => {
                                const count = kbArticles.filter(a => a.category === cat).length;
                                return (
                                    <button key={cat} onClick={() => setSearchTerm(cat)} className="w-full flex justify-between items-center px-4 py-3 rounded-2xl hover:bg-canvas transition-colors group">
                                        <span className="text-sm font-bold text-ink group-hover:text-ink">{cat}</span>
                                        <span className="text-xs font-black bg-muted px-2 py-0.5 rounded-full text-quiet">{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="lg:col-span-2 space-y-6">
                    {selectedArticle ? (
                        <div className="bg-surface rounded-3xl shadow-sm border border-line overflow-hidden animate-slide-up">
                            <div className="p-8 border-b border-line bg-canvas/50">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="px-3 py-1 bg-surface text-ink rounded-full text-[10px] font-black uppercase tracking-widest">{selectedArticle.category}</span>
                                    {user?.role === 'Admin' && (
                                        <div className="flex gap-2">
                                            <button aria-label="Edit" onClick={() => { setFormData({ title: selectedArticle.title, category: selectedArticle.category, content: selectedArticle.content }); setIsModalOpen(true); }} className="p-2 text-quiet hover:text-ink transition-colors">{ICONS.edit}</button>
                                            <button aria-label="Delete" onClick={() => handleDelete(selectedArticle.id)} className="p-2 text-quiet hover:text-ink transition-colors">{ICONS.delete}</button>
                                        </div>
                                    )}
                                </div>
                                <h3 className="text-3xl font-black text-ink leading-tight mb-2">{selectedArticle.title}</h3>
                                <p className="text-xs text-quiet font-medium">Last updated on {new Date(selectedArticle.updatedAt).toLocaleDateString()} by {selectedArticle.author?.name}</p>
                            </div>
                            <div className="p-8">
                                <div
                                    className="prose dark:prose-invert max-w-none text-ink leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedArticle.content) }}
                                />
                                <button onClick={() => setSelectedArticle(null)} className="mt-12 text-sm font-bold text-ink flex items-center gap-2 hover:underline">
                                    &larr; Back to list
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredArticles.map(article => (
                                <button key={article.id} onClick={() => setSelectedArticle(article)} className="bg-surface p-6 rounded-3xl shadow-sm border border-line text-left hover:shadow-xl hover:-translate-y-1 transition-all group">
                                    <span className="text-[10px] font-black text-ink uppercase tracking-widest block mb-2">{article.category}</span>
                                    <h4 className="text-lg font-black text-ink mb-2 group-hover:text-ink transition-colors line-clamp-2">{article.title}</h4>
                                    <p className="text-sm text-quiet line-clamp-3 mb-4 leading-relaxed">
                                        {article.content.replace(/<[^>]+>/g, '').substring(0, 150) + '...'}
                                    </p>
                                    <div className="flex items-center justify-between mt-auto">
                                        <span className="text-[10px] font-bold text-quiet uppercase tracking-tight">{new Date(article.updatedAt).toLocaleDateString()}</span>
                                        <span className="text-ink opacity-0 group-hover:opacity-100 transition-opacity">&rarr;</span>
                                    </div>
                                </button>
                            ))}
                            {filteredArticles.length === 0 && (
                                <div className="col-span-2 py-20 text-center">
                                    <div className="w-20 h-20 bg-canvas rounded-full flex items-center justify-center mx-auto mb-4 text-on-strong">
                                        {ICONS.kb}
                                    </div>
                                    <p className="text-quiet font-medium">No articles found matching your search.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div ref={editorRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Article editor" className="fixed inset-0 bg-strong/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-scale-in max-h-[calc(100dvh-1rem)] flex flex-col">
                        <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-line flex justify-between items-center shrink-0">
                            <h3 className="text-xl font-black text-ink">{selectedArticle ? 'Edit Article' : 'New Article'}</h3>
                            <button aria-label="Close dialog" onClick={() => setIsModalOpen(false)} className="text-quiet hover:text-quiet transition-colors p-2 hover:bg-muted rounded-xl">{ICONS.close}</button>
                        </div>
                        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
                            <div className="p-8 space-y-6 overflow-y-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-black text-ink mb-2 uppercase tracking-tight">Title</label>
                                    <input aria-label="Title" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-canvas border-0 rounded-2xl px-5 py-3 text-ink focus:ring-2 focus:ring-accent/20 transition-all outline-none" placeholder="How to setup email..." />
                                </div>
                                <div>
                                    <label className="block text-sm font-black text-ink mb-2 uppercase tracking-tight">Category</label>
                                    <select aria-label="Category" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-canvas border-0 rounded-2xl px-5 py-3 text-ink focus:ring-2 focus:ring-accent/20 transition-all outline-none">
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-black text-ink mb-2 uppercase tracking-tight">Content</label>
                                <div className="bg-surface rounded-2xl overflow-hidden border border-line">
                                    <ReactQuill
                                        // @ts-ignore
                                        ref={quillRef}
                                        theme="snow"
                                        value={formData.content}
                                        onChange={(val) => setFormData({...formData, content: val})}
                                        modules={modules}
                                        className="h-64 mb-12 text-ink"
                                    />
                                </div>
                            </div>
                            </div>
                            <div className="px-8 py-6 border-t border-line bg-canvas flex gap-4 shrink-0">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-muted text-ink py-4 rounded-2xl font-black text-lg hover:bg-muted transition-all active:scale-[0.98]">Cancel</button>
                                <button type="submit" className="flex-1 bg-accent text-on-strong py-4 rounded-2xl font-black text-lg hover:bg-accent transition-all active:scale-[0.98] shadow-xl shadow-strong/15">Save Article</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KnowledgeBase;
