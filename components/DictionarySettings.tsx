// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  Database, 
  RefreshCw, 
  Trash2, 
  AlertCircle, 
  CheckCircle, 
  Download, 
  HardDrive, 
  FileUp,
  Plus,
  ExternalLink,
  FileJson,
  Globe,
  Server,
  X,
  Loader2,
  Info,
  Eye
} from 'lucide-react';
import { UserSettings } from '../services/dataModels';

interface Dictionary {
  code: string;
  name: string;
  hasLocal: boolean;
  wordCount: number;
  senseCount: number;
  formCount: number;
  path: string;
}

interface DictionarySettingsProps {
  serverUrl?: string;
  settings: UserSettings;
}

const DictionarySettings: React.FC<DictionarySettingsProps> = ({ 
  serverUrl = 'http://localhost:3006',
  settings
}) => {
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isoCode, setIsoCode] = useState('');
  const [addMethod, setAddMethod] = useState<'convert' | 'upload' | 'download'>('convert');
  const [pythonStatus, setPythonStatus] = useState<{
    checked: boolean;
    available?: boolean;
    version?: string;
    message?: string;
  }>({ checked: false });
  
  // 主题颜色映射
  const getThemeClasses = () => {
    const theme = settings?.theme || 'auto';
    switch (theme) {
      case 'dark':
        return {
          bg: 'bg-slate-900',
          text: 'text-slate-100',
          border: 'border-slate-700',
          cardBg: 'bg-slate-800',
          hoverBg: 'hover:bg-slate-700',
          mutedText: 'text-slate-400',
          mutedBg: 'bg-slate-800/50',
          buttonPrimary: 'bg-indigo-600 text-white hover:bg-indigo-700',
          buttonSecondary: 'bg-slate-700 text-slate-100 hover:bg-slate-600'
        };
      case 'night':
        return {
          bg: 'bg-indigo-950',
          text: 'text-indigo-100',
          border: 'border-indigo-800',
          cardBg: 'bg-indigo-900',
          hoverBg: 'hover:bg-indigo-800',
          mutedText: 'text-indigo-400',
          mutedBg: 'bg-indigo-900/50',
          buttonPrimary: 'bg-indigo-700 text-white hover:bg-indigo-800',
          buttonSecondary: 'bg-indigo-800 text-indigo-100 hover:bg-indigo-700'
        };
      case 'contrast':
        return {
          bg: 'bg-black',
          text: 'text-white',
          border: 'border-white',
          cardBg: 'bg-gray-900',
          hoverBg: 'hover:bg-gray-800',
          mutedText: 'text-gray-400',
          mutedBg: 'bg-gray-900/50',
          buttonPrimary: 'bg-white text-black hover:bg-gray-200',
          buttonSecondary: 'bg-gray-900 text-white hover:bg-gray-800'
        };
      case 'sepia':
        return {
          bg: 'bg-amber-50',
          text: 'text-amber-900',
          border: 'border-amber-200',
          cardBg: 'bg-amber-100',
          hoverBg: 'hover:bg-amber-200',
          mutedText: 'text-amber-700',
          mutedBg: 'bg-amber-100/50',
          buttonPrimary: 'bg-amber-600 text-white hover:bg-amber-700',
          buttonSecondary: 'bg-amber-200 text-amber-900 hover:bg-amber-300'
        };
      case 'paper':
        return {
          bg: 'bg-stone-50',
          text: 'text-stone-800',
          border: 'border-stone-200',
          cardBg: 'bg-stone-100',
          hoverBg: 'hover:bg-stone-200',
          mutedText: 'text-stone-600',
          mutedBg: 'bg-stone-100/50',
          buttonPrimary: 'bg-stone-600 text-white hover:bg-stone-700',
          buttonSecondary: 'bg-stone-200 text-stone-800 hover:bg-stone-300'
        };
      default: // light, auto
        return {
          bg: 'bg-slate-50',
          text: 'text-slate-900',
          border: 'border-slate-200',
          cardBg: 'bg-white',
          hoverBg: 'hover:bg-slate-100',
          mutedText: 'text-slate-500',
          mutedBg: 'bg-slate-100/50',
          buttonPrimary: 'bg-indigo-600 text-white hover:bg-indigo-700',
          buttonSecondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        };
    }
  };

  const themeClasses = getThemeClasses();
  
  // 从服务器获取词典列表
  const fetchDictionaries = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${serverUrl}/api/dictionary/languages`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setDictionaries(data.languages || []);
      } else {
        throw new Error(data.error || 'Failed to fetch dictionaries');
      }
      
      // 同时获取统计信息
      const statsResponse = await fetch(`${serverUrl}/api/dictionary/stats`);
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        if (statsData.success) {
          setStats(statsData);
        }
      }
      
    } catch (err: any) {
      console.error('Failed to fetch dictionaries:', err);
      setError(err.message || 'Failed to connect to dictionary server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDictionaries();
  }, [serverUrl]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`${serverUrl}/api/dictionary/rescan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to rescan dictionaries');
      }
      
      console.log(`Rescanned dictionaries: ${data.oldCount} → ${data.newCount} languages`);
    } catch (err: any) {
      console.error('Failed to rescan dictionaries:', err);
      alert(`Failed to rescan: ${err.message}`);
    }
    
    // 重新获取词典列表
    await fetchDictionaries();
  };

  const checkPythonEnvironment = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/dictionary/check-python`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setPythonStatus({
        checked: true,
        available: data.available,
        version: data.version,
        message: data.message
      });
      
      return data;
    } catch (err: any) {
      console.error('Failed to check Python environment:', err);
      setPythonStatus({
        checked: true,
        available: false,
        message: `Failed to check: ${err.message}`
      });
      return null;
    }
  };

  const handleDeleteDictionary = async (code: string) => {
    if (!confirm(`Are you sure you want to delete the dictionary file for "${code}"? This will permanently delete the database file and cannot be undone.`)) {
      return;
    }
    
    try {
      const response = await fetch(`${serverUrl}/api/dictionary/${code}/file`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        alert(`Dictionary '${code}' deleted successfully!`);
        fetchDictionaries(); // 刷新列表
      } else {
        throw new Error(data.error || 'Failed to delete dictionary');
      }
    } catch (err: any) {
      console.error('Failed to delete dictionary:', err);
      alert(`Failed to delete dictionary: ${err.message}`);
    }
  };

  const handleFileUpload = async () => {
    if (!isoCode.trim()) {
      alert('Please enter an ISO language code');
      return;
    }

    if (addMethod === 'convert' && !selectedFile) {
      alert('Please select a JSONL file to convert');
      return;
    }

    if (addMethod === 'upload' && !selectedFile) {
      alert('Please select a SQLite database file to upload');
      return;
    }

    try {
      setUploading(true);
      
      let response;
      
      if (addMethod === 'convert') {
        // JSONL转换（暂未完全实现）
        const conversionSteps = `
JSONL Conversion Guide:

1. CHECK PYTHON INSTALLATION:
   Open terminal/command prompt and run:
     python --version
   If Python is not installed or version < 3.7:

2. INSTALL PYTHON:
   - Download from: https://www.python.org/downloads/
   - During installation, CHECK "Add Python to PATH"
   - Restart terminal/application after installation

3. CONVERT JSONL TO SQLITE:
   Run the conversion script:
     cd scripts
     python convert_jsonl_to_sqlite.py "path/to/your-file.jsonl" "${isoCode.trim()}"

4. UPLOAD SQLITE FILE:
   - Select "Upload SQLite" method above
   - Upload the generated .db file from dict/${isoCode.trim()}_dict.db

Script location: scripts/convert_jsonl_to_sqlite.py
Python requirement: Python 3.7+ with sqlite3 module (included by default)
        `;
        alert(conversionSteps);
        setUploading(false);
        return;
      } else if (addMethod === 'upload') {
        // SQLite文件上传
        const formData = new FormData();
        formData.append('file', selectedFile!);
        formData.append('languageCode', isoCode.trim());
        
        response = await fetch(`${serverUrl}/api/dictionary/upload`, {
          method: 'POST',
          body: formData
        });
      } else {
        // download方法不需要上传文件
        alert('Download method: Visit kaikki.org to download JSONL files, then convert and upload them.');
        setUploading(false);
        return;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      
      const data = await response.json();
      if (data.success) {
        alert(`Dictionary '${isoCode}' uploaded successfully!`);
        setShowAddForm(false);
        setSelectedFile(null);
        setIsoCode('');
        fetchDictionaries();
      } else {
        throw new Error(data.error || 'Failed to upload dictionary');
      }
      
    } catch (err: any) {
      console.error('Failed to upload dictionary:', err);
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileSize = async (path: string) => {
    // 在实际应用中，这需要从服务器获取
    // 这里我们模拟文件大小
    const dict = dictionaries.find(d => d.path === path);
    if (dict && dict.wordCount > 0) {
      const estimatedSize = dict.wordCount * 1000; // 模拟大小
      return formatFileSize(estimatedSize);
    }
    return 'Unknown';
  };

  const getDictionaryStatus = (dict: Dictionary) => {
    if (dict.wordCount === 0) return { color: 'text-amber-600', icon: <AlertCircle size={14} />, text: 'Empty' };
    if (dict.wordCount < 1000) return { color: 'text-blue-600', icon: <Info size={14} />, text: 'Small' };
    if (dict.wordCount < 10000) return { color: 'text-emerald-600', icon: <CheckCircle size={14} />, text: 'Good' };
    return { color: 'text-indigo-600', icon: <CheckCircle size={14} />, text: 'Large' };
  };

  const totalWords = dictionaries.reduce((sum, dict) => sum + dict.wordCount, 0);
  const totalSenses = dictionaries.reduce((sum, dict) => sum + dict.senseCount, 0);
  const totalForms = dictionaries.reduce((sum, dict) => sum + dict.formCount, 0);

  if (loading && !refreshing) {
    return (
      <section className={`border rounded-3xl p-6 shadow-sm ${themeClasses.cardBg} ${themeClasses.border}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Database size={20} />
          </div>
          <div>
            <h2 className={`text-lg font-bold ${themeClasses.text}`}>Dictionary Management</h2>
            <p className={`text-xs font-medium ${themeClasses.mutedText}`}>Loading dictionary information...</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className={`flex items-center gap-3 ${themeClasses.mutedText}`}>
            <Loader2 size={24} className="animate-spin" />
            <span>Loading dictionaries...</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`border rounded-3xl p-6 shadow-sm ${themeClasses.cardBg} ${themeClasses.border}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Database size={20} />
          </div>
          <div>
            <h2 className={`text-lg font-bold ${themeClasses.text}`}>Dictionary Management</h2>
            <p className={`text-xs font-medium ${themeClasses.mutedText}`}>
              Local offline dictionaries for fast word lookup
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {error && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold">
              <AlertCircle size={12} />
              Server Error
            </div>
          )}
          
          <button
            onClick={handleRefresh}
            disabled={refreshing}
             className={`p-2 rounded-xl transition-all disabled:opacity-50 ${themeClasses.mutedText} ${themeClasses.hoverBg}`}
            title="Refresh dictionaries"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
          
          <button
            onClick={() => setShowAddForm(!showAddForm)}
             className={`p-2 rounded-xl transition-all shadow-md shadow-indigo-100 active:scale-95 ${themeClasses.buttonPrimary}`}
            title="Add new dictionary"
          >
            <Plus size={20} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* 添加词典表单 */}
      {showAddForm && (
        <div className={`mb-6 border rounded-xl p-5 ${themeClasses.mutedBg} ${themeClasses.border}`}>
          <div className="flex items-center justify-between mb-4">
             <h3 className={`text-sm font-semibold ${themeClasses.text}`}>Add New Dictionary</h3>
            <button
              onClick={() => {
                setShowAddForm(false);
                setSelectedFile(null);
                setIsoCode('');
              }}
              className={`p-1 ${themeClasses.mutedText} hover:${themeClasses.text}`}
            >
              <X size={16} />
            </button>
          </div>
          
          <div className="space-y-4">
            {/* 方法选择 */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Add Method
              </label>
              <div className="flex gap-2">
                {['convert', 'upload', 'download'].map((method) => (
                  <button
                    key={method}
                    onClick={() => setAddMethod(method as any)}
                    className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
                      addMethod === method
                        ? 'bg-indigo-600 text-white'
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {method === 'convert' && 'Convert JSONL'}
                    {method === 'upload' && 'Upload SQLite'}
                    {method === 'download' && 'Download'}
                  </button>
                ))}
              </div>
            </div>
            
            {/* ISO代码输入 */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ISO Language Code
              </label>
              <input
                type="text"
                value={isoCode}
                onChange={(e) => setIsoCode(e.target.value.toLowerCase())}
                 className={`w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-all ${themeClasses.cardBg} ${themeClasses.border} ${themeClasses.text}`}
                placeholder="e.g., de, en, fr, sa"
                maxLength={3}
              />
               <p className={`text-xs mt-1 ${themeClasses.mutedText}`}>
                 2-3 letter ISO code (must match the dictionary language)
               </p>
            </div>
            
            {/* 文件上传/转换 */}
            {addMethod === 'convert' && (
              <div>
                 <label className={`block text-xs font-medium mb-1 ${themeClasses.text}`}>
                   JSONL File (kaikki.org format)
                 </label>
                 <div className={`border-2 border-dashed rounded-lg p-6 text-center hover:border-indigo-300 transition-colors ${themeClasses.border}`}>
                   {selectedFile ? (
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                         <FileJson size={20} className="text-indigo-500" />
                         <div className="text-left">
                           <div className={`text-sm font-medium ${themeClasses.text}`}>{selectedFile.name}</div>
                           <div className={`text-xs ${themeClasses.mutedText}`}>
                             {formatFileSize(selectedFile.size)}
                           </div>
                         </div>
                       </div>
                       <button
                         onClick={() => setSelectedFile(null)}
                         className={`p-1 ${themeClasses.mutedText} hover:${themeClasses.text}`}
                       >
                         <X size={16} />
                       </button>
                     </div>
                   ) : (
                     <div>
                       <FileUp size={24} className={`mx-auto mb-2 ${themeClasses.mutedText}`} />
                       <p className={`text-sm mb-1 ${themeClasses.mutedText}`}>
                         Drop kaikki.org JSONL file here
                       </p>
                       <p className={`text-xs ${themeClasses.mutedText}`}>
                         Or <span className="text-indigo-600 font-medium cursor-pointer" 
                           onClick={() => document.getElementById('jsonl-file')?.click()}>
                           browse
                         </span> to select
                       </p>
                       <input
                         id="jsonl-file"
                         type="file"
                         accept=".jsonl,.json"
                         onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                         className="hidden"
                       />
                     </div>
                   )}
                 </div>
                 <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                   <div className="flex items-start gap-2">
                     <AlertCircle size={14} className="text-amber-600 mt-0.5" />
                     <div>
                       <p className="text-xs font-medium text-amber-800">Python Required for Conversion</p>
                       <p className="text-xs text-amber-600 mt-1">
                         JSONL conversion requires Python 3.7+ with sqlite3 module.
                       </p>
                       <div className="mt-2 space-y-1 text-xs text-amber-700">
                         <p><strong>To check if Python is installed:</strong></p>
                         <code className="block bg-amber-100 px-2 py-1 rounded font-mono">python --version</code>
                         <p><strong>If Python is not installed:</strong></p>
                         <ul className="list-disc pl-4 ml-2">
                           <li><a href="https://www.python.org/downloads/" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-900">Download Python</a> from python.org</li>
                           <li>During installation, check "Add Python to PATH"</li>
                           <li>Restart your terminal/application after installation</li>
                         </ul>
                          <p><strong>Conversion script location:</strong></p>
                          <code className="block bg-amber-100 px-2 py-1 rounded font-mono">scripts/convert_jsonl_to_sqlite.py</code>
                          
                          <div className="mt-3 pt-3 border-t border-amber-200">
                            <p><strong>Environment Check:</strong></p>
                            <button
                              onClick={checkPythonEnvironment}
                              className="mt-2 px-3 py-1.5 bg-amber-600 text-white text-xs rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-1"
                            >
                              <RefreshCw size={12} />
                              Check Python Installation
                            </button>
                            
                            {pythonStatus.checked && (
                              <div className={`mt-2 p-2 rounded text-xs ${pythonStatus.available ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                                <div className="font-medium">
                                  {pythonStatus.available ? '✓ Python Available' : '✗ Python Not Available'}
                                  {pythonStatus.version && ` (${pythonStatus.version})`}
                                </div>
                                {pythonStatus.message && (
                                  <div className="mt-1">{pythonStatus.message}</div>
                                )}
                                {!pythonStatus.available && (
                                  <div className="mt-2 text-amber-700">
                                    <p className="font-medium">Installation Steps:</p>
                                    <ol className="list-decimal pl-4 ml-2 mt-1">
                                      <li>Download Python from <a href="https://www.python.org/downloads/" target="_blank" rel="noopener noreferrer" className="underline">python.org</a></li>
                                      <li>During installation, check <strong>"Add Python to PATH"</strong></li>
                                      <li>Restart your terminal/application</li>
                                      <li>Click "Check Python Installation" again to verify</li>
                                    </ol>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                     </div>
                   </div>
                 </div>
                 <p className="text-xs text-slate-500 mt-2">
                   File will be converted to SQLite format and stored locally (requires Python)
                 </p>
               </div>
             )}
            
            {addMethod === 'upload' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  SQLite Database File
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-indigo-300 transition-colors">
                  {selectedFile ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database size={20} className="text-indigo-500" />
                        <div className="text-left">
                          <div className="text-sm font-medium text-slate-900">{selectedFile.name}</div>
                          <div className="text-xs text-slate-500">
                            {formatFileSize(selectedFile.size)}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedFile(null)}
                        className="p-1 text-slate-400 hover:text-slate-600"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Database size={24} className="mx-auto mb-2 text-slate-400" />
                      <p className="text-sm text-slate-600 mb-1">
                        Drop SQLite database file here
                      </p>
                      <p className="text-xs text-slate-500">
                        Or <span className="text-indigo-600 font-medium cursor-pointer" 
                          onClick={() => document.getElementById('sqlite-file')?.click()}>
                          browse
                        </span> to select (.db, .sqlite)
                      </p>
                      <input
                        id="sqlite-file"
                        type="file"
                        accept=".db,.sqlite"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  File will be copied to the dict directory and registered automatically
                </p>
              </div>
            )}
            
            {addMethod === 'download' && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Globe size={16} className="text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-800">
                      Download from kaikki.org
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Visit <a 
                        href="https://kaikki.org/dictionary/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="underline hover:text-blue-800"
                      >
                        kaikki.org/dictionary
                      </a> to download JSONL files
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* 操作按钮 */}
            <div className="pt-2 flex gap-2">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setSelectedFile(null);
                  setIsoCode('');
                }}
                className="flex-1 py-2 text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                onClick={handleFileUpload}
                disabled={uploading || !isoCode.trim() || (addMethod === 'convert' && !selectedFile)}
                className="flex-1 py-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Add Dictionary
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 总体统计 */}
      {stats && (
        <div className="mb-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-indigo-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-indigo-600">{dictionaries.length}</div>
              <div className="text-xs text-indigo-500 font-medium">Dictionaries</div>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">{totalWords.toLocaleString()}</div>
              <div className="text-xs text-emerald-500 font-medium">Total Words</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">{totalSenses.toLocaleString()}</div>
              <div className="text-xs text-amber-500 font-medium">Total Senses</div>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{totalForms.toLocaleString()}</div>
              <div className="text-xs text-purple-500 font-medium">Total Forms</div>
            </div>
          </div>
        </div>
      )}

      {/* 词典列表 */}
      <div className="space-y-3">
        {dictionaries.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Database size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">No local dictionaries found</p>
            <p className="text-xs mt-1">Add a dictionary to enable fast offline lookup</p>
          </div>
        ) : (
          dictionaries.map((dict) => {
            const status = getDictionaryStatus(dict);
            return (
              <div 
                key={dict.code} 
                className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50/50 border border-slate-100 hover:border-slate-200 transition-all group"
              >
                {/* 语言图标/标识 */}
                <div className="p-2 bg-white border border-slate-200 rounded-lg">
                  <div className="w-8 h-8 flex items-center justify-center">
                    <span className="text-sm font-bold text-slate-700">
                      {dict.code.toUpperCase()}
                    </span>
                  </div>
                </div>
                
                {/* 词典信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-slate-900">{dict.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${status.color} bg-opacity-10 flex items-center gap-1`}>
                      {status.icon}
                      {status.text}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
                    <span className="flex items-center gap-1">
                      <HardDrive size={10} />
                      ISO: <span className="font-mono font-bold">{dict.code}</span>
                    </span>
                    <span>Words: <span className="font-bold">{dict.wordCount.toLocaleString()}</span></span>
                    <span>Senses: <span className="font-bold">{dict.senseCount.toLocaleString()}</span></span>
                    <span>Forms: <span className="font-bold">{dict.formCount.toLocaleString()}</span></span>
                  </div>
                  
                  <div className="text-xs text-slate-400 font-mono truncate" title={dict.path}>
                    <Server size={10} className="inline mr-1" />
                    {dict.path.replace(/^.*[\\\/]/, '')}
                  </div>
                </div>
                
                {/* 操作按钮 */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="View details"
                    onClick={() => alert(`Dictionary details:\n\nCode: ${dict.code}\nName: ${dict.name}\nWords: ${dict.wordCount}\nSenses: ${dict.senseCount}\nForms: ${dict.formCount}\nPath: ${dict.path}`)}
                  >
                    <Eye size={14} />
                  </button>
                  <button 
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete dictionary"
                    onClick={() => handleDeleteDictionary(dict.code)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 服务器连接状态 */}
      <div className="mt-6 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${error ? 'bg-rose-500' : 'bg-emerald-500'}`} />
            <span className="text-slate-500">
              Server: {serverUrl}
            </span>
          </div>
          
          {stats && (
            <div className="text-slate-400">
              Last updated: {new Date(stats.timestamp || Date.now()).toLocaleTimeString()}
            </div>
          )}
        </div>
        
        {error && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-100 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="text-rose-600 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-rose-800">Connection Error</p>
                <p className="text-xs text-rose-600 mt-1">{error}</p>
                <button
                  onClick={() => fetchDictionaries()}
                  className="mt-2 text-xs text-rose-700 hover:text-rose-900 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default DictionarySettings;