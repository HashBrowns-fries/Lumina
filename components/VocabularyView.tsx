
// @ts-nocheck
import React, { useState, useMemo } from 'react';
import { 
  Term, 
  TermStatus, 
  Language,
  UserSettings
} from '../types';
import { 
  Search, 
  Trash2, 
  Layers, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  Filter,
  GraduationCap,
  Clock,
  CalendarDays,
  BrainCircuit,
  Zap
} from 'lucide-react';
import { calculateNextReview, ReviewRating, getIntervalLabel } from '../services/srsService';

interface VocabularyViewProps {
  terms: Record<string, Term>;
  languages: Language[];
  onUpdateTerm: (term: Term, linkedChild?: Term) => void;
  onDeleteTerm: (key: string) => void;
  settings: UserSettings;
}

const VocabularyView: React.FC<VocabularyViewProps> = ({ terms, languages, onUpdateTerm, onDeleteTerm, settings }) => {
  const [mode, setMode] = useState<'list' | 'review'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLang, setFilterLang] = useState<string>('all');
  
  // Review state
  const [reviewIndex, setReviewIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const termList = useMemo(() => {
    let list = Object.entries(terms).map(([key, term]) => ({ key, ...(term as Term) }));
    if (settings?.showRootFormsOnly) {
      list = list.filter(term => term.parentId === undefined);
    }
    return list;
  }, [terms, settings?.showRootFormsOnly]);

  const filteredTerms = useMemo(() => {
    return termList.filter(t => {
      const matchesSearch = t.text.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           t.translation.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLang = filterLang === 'all' || t.languageId === filterLang;
      return matchesSearch && matchesLang;
    }).sort((a, b) => b.status - a.status);
  }, [termList, searchTerm, filterLang]);

  const reviewTerms = useMemo(() => {
    const now = Date.now();
    // Filter for terms due today or never reviewed, excluding ignored
    return termList.filter(t => {
      if (t.status === TermStatus.Ignored) return false;
      return !t.nextReview || t.nextReview <= now;
    }).sort((a, b) => (a.nextReview || 0) - (b.nextReview || 0));
  }, [termList, mode]); // Recalculate when entering review mode

  const handleReviewRating = (rating: ReviewRating) => {
    const currentTerm = reviewTerms[reviewIndex];
    const updates = calculateNextReview(currentTerm, rating);
    onUpdateTerm({ ...currentTerm, ...updates });
    
    if (reviewIndex < reviewTerms.length - 1) {
      setReviewIndex(prev => prev + 1);
      setShowAnswer(false);
    } else {
      setMode('list');
    }
  };

  if (mode === 'review') {
    const currentTerm = reviewTerms[reviewIndex];

    if (!currentTerm) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6 border border-slate-100">
            <CheckCircle2 size={48} className="text-emerald-500" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Daily Goal Reached!</h2>
          <p className="text-slate-500 mt-2 mb-8 max-w-xs font-medium">You've cleared your review queue. Great job staying consistent!</p>
          <button 
            onClick={() => setMode('list')}
            className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-slate-200"
          >
            Back to Collection
          </button>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-6 md:p-12 overflow-y-auto">
        <div className="w-full max-w-2xl">
          <div className="flex items-center justify-between mb-8">
            <button onClick={() => setMode('list')} className="text-slate-400 hover:text-slate-900 font-bold flex items-center gap-2 transition-colors">
              <XCircle size={20} /> Exit Session
            </button>
            <div className="flex flex-col items-center">
                <div className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                    Remaining: {reviewTerms.length - reviewIndex}
                </div>
                <div className="w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden mt-2">
                    <div 
                        className="h-full bg-indigo-600 transition-all duration-500" 
                        style={{ width: `${((reviewIndex) / reviewTerms.length) * 100}%` }}
                    />
                </div>
            </div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <BrainCircuit size={20} />
            </div>
          </div>

          <div 
            className={`relative bg-white rounded-[40px] shadow-2xl shadow-slate-200 p-8 md:p-12 min-h-[500px] flex flex-col transition-all duration-300 transform border border-slate-100 ${!showAnswer ? 'cursor-pointer hover:scale-[1.01]' : ''}`}
            onClick={() => !showAnswer && setShowAnswer(true)}
          >
            {!showAnswer ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                <div className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-8 bg-indigo-50/50 px-4 py-1.5 rounded-full">
                    Target Word
                </div>
                <h2 className="text-7xl font-black text-slate-900 serif-text mb-10 tracking-tight">{currentTerm.text}</h2>
                <div className="flex items-center gap-2 text-slate-300 font-bold uppercase tracking-widest text-xs animate-pulse">
                  <RotateCcw size={14} /> Click to reveal
                </div>
              </div>
            ) : (
              <div className="w-full flex-1 flex flex-col animate-in fade-in zoom-in-95 duration-500">
                <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-slate-400 serif-text mb-2">{currentTerm.text}</h3>
                    <div className="w-12 h-1 bg-slate-100 mx-auto rounded-full" />
                </div>
                
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                  <h2 className="text-5xl font-black text-slate-900 serif-text leading-tight">{currentTerm.translation}</h2>

                  {currentTerm.image && (
                    <img 
                      src={currentTerm.image} 
                      className="w-40 h-40 object-cover rounded-3xl shadow-xl border-4 border-white ring-1 ring-slate-100" 
                      alt=""
                    />
                  )}

                  {currentTerm.notes && (
                    <div className="bg-slate-50 p-5 rounded-2xl text-slate-600 text-sm leading-relaxed font-medium italic border border-slate-100 max-w-md">
                      {currentTerm.notes}
                    </div>
                  )}
                </div>

                {/* SRS Buttons */}
                <div className="grid grid-cols-4 gap-3 mt-10">
                  <SRSButton 
                    label="Again" 
                    time={getIntervalLabel(currentTerm, 'again')} 
                    color="rose" 
                    onClick={() => handleReviewRating('again')} 
                  />
                  <SRSButton 
                    label="Hard" 
                    time={getIntervalLabel(currentTerm, 'hard')} 
                    color="orange" 
                    onClick={() => handleReviewRating('hard')} 
                  />
                  <SRSButton 
                    label="Good" 
                    time={getIntervalLabel(currentTerm, 'good')} 
                    color="indigo" 
                    onClick={() => handleReviewRating('good')} 
                  />
                  <SRSButton 
                    label="Easy" 
                    time={getIntervalLabel(currentTerm, 'easy')} 
                    color="emerald" 
                    onClick={() => handleReviewRating('easy')} 
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      <header className="p-8 lg:p-12 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Vocabulary</h1>
          <div className="flex items-center gap-4">
            <p className="text-slate-500 font-medium">Collection of {termList.length} terms.</p>
            {reviewTerms.length > 0 && (
                <span className="flex items-center gap-1.5 bg-rose-50 text-rose-600 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-rose-100">
                    <Clock size={12} /> {reviewTerms.length} Due Now
                </span>
            )}
          </div>
        </div>
        
        <button 
          onClick={() => {
            if (reviewTerms.length === 0) return;
            setReviewIndex(0);
            setShowAnswer(false);
            setMode('review');
          }}
          disabled={reviewTerms.length === 0}
          className={`px-8 py-4 rounded-2xl font-black text-sm tracking-widest uppercase flex items-center justify-center gap-3 transition-all shadow-xl active:scale-[0.98] group
            ${reviewTerms.length > 0 
                ? 'bg-slate-900 text-white hover:bg-black' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}
          `}
        >
          <Layers size={18} className={reviewTerms.length > 0 ? "group-hover:rotate-12 transition-transform" : ""} />
          Start Daily Review
        </button>
      </header>

      {/* Filters */}
      <div className="px-8 lg:px-12 py-6 border-b border-slate-200 bg-white flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Search words..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>
        
        <div className="flex gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-48">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <select 
              value={filterLang}
              onChange={(e) => setFilterLang(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none appearance-none cursor-pointer"
            >
              <option value="all">All Languages</option>
              {languages.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 lg:p-12">
        {filteredTerms.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <Layers size={48} className="text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No terms found</h3>
            <p className="text-slate-500 font-medium">Adjust your search or add words while reading.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredTerms.map((term) => (
              <div 
                key={term.key} 
                className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-lg transition-all group relative overflow-hidden flex flex-col"
              >
                <div className={`absolute top-0 left-0 w-full h-1.5 ${
                  term.status === TermStatus.WellKnown ? 'bg-emerald-400' :
                  term.status === TermStatus.Ignored ? 'bg-slate-300' :
                  'bg-indigo-400'
                }`} />

                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold text-slate-900 serif-text tracking-tight">{term.text}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      {languages.find(l => l.id === term.languageId)?.name}
                    </span>
                  </div>
                  <button 
                    onClick={() => onDeleteTerm(term.key)}
                    className="p-2 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex-1 space-y-3">
                  <div className="text-sm font-bold text-indigo-700 bg-indigo-50/70 p-2.5 px-4 rounded-xl inline-block">
                    {term.translation}
                  </div>
                  
                  {term.image && (
                    <div className="w-full h-36 overflow-hidden rounded-2xl border border-slate-100 shadow-sm mt-2">
                      <img src={term.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" />
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 mt-auto border-t border-slate-50">
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(dot => (
                            <div 
                            key={dot}
                            className={`w-1.5 h-1.5 rounded-full ${dot <= (term.reps || 0) + 1 ? 'bg-indigo-500' : 'bg-slate-100'}`}
                            />
                        ))}
                        </div>
                        {term.nextReview && (
                            <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                                <CalendarDays size={10} /> 
                                {new Date(term.nextReview).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                        )}
                    </div>
                    {term.status === 99 && <span className="text-[9px] font-black text-slate-400 uppercase">Ignored</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const SRSButton: React.FC<{ label: string; time: string; color: string; onClick: () => void }> = ({ label, time, color, onClick }) => {
  const colorMap: Record<string, string> = {
    rose: 'hover:bg-rose-50 hover:border-rose-200 text-rose-600',
    orange: 'hover:bg-orange-50 hover:border-orange-200 text-orange-600',
    indigo: 'hover:bg-indigo-50 hover:border-indigo-200 text-indigo-600',
    emerald: 'hover:bg-emerald-50 hover:border-emerald-200 text-emerald-600',
  };

  return (
    <button 
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 border-slate-50 transition-all ${colorMap[color] || ''} group bg-white shadow-sm hover:shadow-md active:scale-95`}
    >
      <span className="text-[10px] font-black uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">{label}</span>
      <span className="text-sm font-bold">{time}</span>
    </button>
  );
};

export default VocabularyView;
