import React, { useState, useEffect } from 'react';
import { 
  Code, Plus, Edit, Trash2, Check, RefreshCw, Layers, Shield, Tag, 
  IndianRupee, FileText, Search, AlertCircle, CheckCircle2, RotateCcw
} from 'lucide-react';
import { CERTIFICATE_CATEGORIES as DEFAULT_CATEGORIES } from '../constants/certificateTypes';

export default function CodeMasterView({ showToast }) {
  // Load categories from localStorage or default constants
  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('CUSTOM_CERT_CATEGORIES');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return DEFAULT_CATEGORIES;
  });

  const [search, setSearch] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('ALL');

  // Modal States
  const [isAddSubModalOpen, setIsAddSubModalOpen] = useState(false);
  const [editingSubService, setEditingSubService] = useState(null); // { catId, sub }

  // Form State for Add / Edit Sub-Service
  const [subForm, setSubForm] = useState({
    parentCatId: 'income',
    code: '',
    name: '',
    prefix: 'JHIC/2026/',
    defaultFee: 100
  });

  // Save to LocalStorage whenever categories state changes
  useEffect(() => {
    localStorage.setItem('CUSTOM_CERT_CATEGORIES', JSON.stringify(categories));
  }, [categories]);

  // Handle resetting back to original system defaults
  const handleResetToDefaults = () => {
    if (window.confirm('Are you sure you want to reset all Code Master settings to original system defaults? Custom added codes will be removed.')) {
      setCategories(DEFAULT_CATEGORIES);
      localStorage.removeItem('CUSTOM_CERT_CATEGORIES');
      if (showToast) showToast('info', 'Code Master Reset', 'Restored original default certificate categories and codes.');
    }
  };

  // Open Modal for Add
  const handleOpenAdd = () => {
    const defaultCat = categories[0] ? categories[0].id : 'income';
    setSubForm({
      parentCatId: defaultCat,
      code: '',
      name: '',
      prefix: 'JHIC/2026/',
      defaultFee: 100
    });
    setEditingSubService(null);
    setIsAddSubModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (catId, sub) => {
    setSubForm({
      parentCatId: catId,
      code: sub.code,
      name: sub.name,
      prefix: sub.prefix || `${sub.code}/2026/`,
      defaultFee: sub.defaultFee || 100
    });
    setEditingSubService({ catId, oldCode: sub.code });
    setIsAddSubModalOpen(true);
  };

  // Handle Parent Category selection in Form -> auto update prefix
  const handleFormCategoryChange = (catId) => {
    setSubForm(prev => {
      const codePart = prev.code ? prev.code.toUpperCase() : 'NEW';
      return {
        ...prev,
        parentCatId: catId,
        prefix: `${codePart}/2026/`
      };
    });
  };

  // Handle Code Change in Form -> auto update prefix
  const handleFormCodeChange = (val) => {
    const cleanCode = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setSubForm(prev => ({
      ...prev,
      code: cleanCode,
      prefix: `${cleanCode || 'CODE'}/2026/`
    }));
  };

  // Save Sub-Service (Add or Update)
  const handleSaveSubService = (e) => {
    e.preventDefault();
    if (!subForm.code.trim()) {
      if (showToast) showToast('error', 'Code Required', 'Please enter Certificate Code (e.g. JHIC)');
      return;
    }
    if (!subForm.name.trim()) {
      if (showToast) showToast('error', 'Name Required', 'Please enter Certificate Name');
      return;
    }

    const cleanCode = subForm.code.trim().toUpperCase();
    const cleanPrefix = subForm.prefix.trim().toUpperCase().endsWith('/') ? subForm.prefix.trim().toUpperCase() : `${subForm.prefix.trim().toUpperCase()}/`;
    const feeNum = parseFloat(subForm.defaultFee) || 100;

    const newCategories = categories.map(cat => {
      // Remove old sub-service if moving categories or updating
      let updatedSubServices = cat.subServices.filter(s => {
        if (editingSubService) {
          return s.code !== editingSubService.oldCode;
        }
        return s.code !== cleanCode;
      });

      // Add to new parent category
      if (cat.id === subForm.parentCatId) {
        updatedSubServices.push({
          code: cleanCode,
          name: subForm.name.trim(),
          prefix: cleanPrefix,
          defaultFee: feeNum
        });
      }

      return {
        ...cat,
        subServices: updatedSubServices
      };
    });

    setCategories(newCategories);
    setIsAddSubModalOpen(false);
    if (showToast) {
      showToast('success', editingSubService ? 'Code Master Updated' : 'New Code Added', `Certificate sub-service ${cleanCode} saved successfully!`);
    }
  };

  // Delete Sub-Service
  const handleDeleteSubService = (catId, code) => {
    if (!window.confirm(`Are you sure you want to delete certificate code ${code} from Code Master?`)) return;

    const newCategories = categories.map(cat => {
      if (cat.id === catId) {
        return {
          ...cat,
          subServices: cat.subServices.filter(s => s.code !== code)
        };
      }
      return cat;
    });

    setCategories(newCategories);
    if (showToast) showToast('info', 'Code Removed', `Certificate code ${code} deleted.`);
  };

  // Flattened Sub-Services for table display
  const allSubServices = categories.flatMap(cat => 
    cat.subServices.map(sub => ({
      ...sub,
      parentCatId: cat.id,
      parentCatName: cat.name,
      parentCatTitle: cat.title
    }))
  );

  // Filtered List
  const filteredSubServices = allSubServices.filter(item => {
    const matchesCat = selectedCatId === 'ALL' || item.parentCatId === selectedCatId;
    const matchesSearch = 
      item.code.toLowerCase().includes(search.toLowerCase()) ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.prefix.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-300">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 font-black shadow-inner">
            <Code className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
              Code Master Management
              <span className="px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider">
                System Master Settings
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Add, edit, or remove certificate sub-types, custom prefix codes (e.g., <span className="text-emerald-300 font-mono">JHIC/2026/</span>), and default service fees across all categories.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={handleResetToDefaults}
            title="Reset to Original Defaults"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold transition shadow-sm"
          >
            <RotateCcw className="w-4 h-4 text-amber-400" />
            <span>Reset Defaults</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition cursor-pointer"
          >
            <Plus className="w-4.5 h-4.5" />
            <span>+ Add New Certificate Code</span>
          </button>
        </div>
      </div>

      {/* Category Overview Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 w-full">
        <button
          onClick={() => setSelectedCatId('ALL')}
          className={`p-3 rounded-2xl border transition text-center flex flex-col items-center justify-center ${
            selectedCatId === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-xs'
          }`}
        >
          <span className="text-[10px] font-black uppercase text-slate-400">TOTAL CODES</span>
          <span className="text-xl font-extrabold mt-0.5">{allSubServices.length}</span>
        </button>

        {categories.map((cat) => {
          const count = cat.subServices.length;
          const isActive = selectedCatId === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCatId(isActive ? 'ALL' : cat.id)}
              className={`p-3 rounded-2xl border transition text-center flex flex-col items-center justify-center ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-xs'
              }`}
            >
              <span className={`text-[10px] font-black uppercase ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>{cat.name}</span>
              <span className="text-xl font-extrabold mt-0.5">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table Toolbar Container */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4 w-full">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Code (e.g. JHIC), Name, or Prefix..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
            />
          </div>

          {/* Filter Category Dropdown */}
          <select
            value={selectedCatId}
            onChange={(e) => setSelectedCatId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-extrabold text-slate-700 focus:outline-none cursor-pointer w-full sm:w-auto"
          >
            <option value="ALL">All Categories ({allSubServices.length} Codes)</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.subServices.length})</option>
            ))}
          </select>
        </div>

        {/* Master Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs w-full">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-3.5 text-center">Category</th>
                <th className="px-6 py-3.5 text-center">Code</th>
                <th className="px-6 py-3.5 text-center">Certificate Sub-Type Name</th>
                <th className="px-6 py-3.5 text-center">Locked Prefix</th>
                <th className="px-6 py-3.5 text-center">Default Fee</th>
                <th className="px-6 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium">
              {filteredSubServices.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-slate-400">
                    No certificate codes found matching your query.
                  </td>
                </tr>
              ) : (
                filteredSubServices.map((item) => (
                  <tr key={item.code} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-3.5 text-center">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 font-extrabold text-[10px]">
                        {item.parentCatName}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 font-mono font-black text-xs inline-block">
                        {item.code}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-center font-bold text-slate-900">
                      {item.name}
                    </td>
                    <td className="px-6 py-3.5 text-center font-mono font-extrabold text-blue-700">
                      {item.prefix}
                    </td>
                    <td className="px-6 py-3.5 text-center font-bold text-emerald-600">
                      ₹{item.defaultFee || 100}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(item.parentCatId, item)}
                          title="Edit Code Settings"
                          className="p-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition shadow-xs"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSubService(item.parentCatId, item.code)}
                          title="Delete Code"
                          className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition shadow-xs"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT CERTIFICATE CODE MODAL */}
      {isAddSubModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-black">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingSubService ? 'Edit Code Settings' : 'Add New Certificate Code'}
                  </h3>
                  <p className="text-xs text-slate-500">Configure certificate sub-type, prefix, and fees</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAddSubModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-2xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveSubService} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Parent Category *</label>
                <select
                  value={subForm.parentCatId}
                  onChange={(e) => handleFormCategoryChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500/20"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name} - {c.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Certificate Code *</label>
                  <input
                    type="text"
                    required
                    value={subForm.code}
                    onChange={(e) => handleFormCodeChange(e.target.value)}
                    placeholder="e.g. JHIC"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono font-black uppercase focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Default Fee (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={subForm.defaultFee}
                    onChange={(e) => setSubForm(prev => ({ ...prev, defaultFee: e.target.value }))}
                    placeholder="100"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Sub-Type Display Name *</label>
                <input
                  type="text"
                  required
                  value={subForm.name}
                  onChange={(e) => setSubForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Income Certificate (JHIC)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Locked Prefix Format *</label>
                <input
                  type="text"
                  required
                  value={subForm.prefix}
                  onChange={(e) => setSubForm(prev => ({ ...prev, prefix: e.target.value }))}
                  placeholder="e.g. JHIC/2026/"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-blue-700 font-mono font-bold focus:ring-2 focus:ring-emerald-500/20"
                />
                <p className="text-[10px] text-slate-400 mt-1">This prefix will be automatically locked in the reference number field.</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddSubModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-md transition"
                >
                  Save Code Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
