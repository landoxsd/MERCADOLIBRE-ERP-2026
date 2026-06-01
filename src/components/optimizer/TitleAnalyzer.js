import React, { useState, useEffect } from 'react';
import { Sparkles, Save, Check } from 'lucide-react';

export default function TitleAnalyzer({ initialTitle = "", missingKeywords = [], onSaveTitle }) {
    const [title, setTitle] = useState(initialTitle);
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setTitle(initialTitle);
    }, [initialTitle]);

    const titleLower = title.toLowerCase();
    
    const integratedKeywords = missingKeywords.filter(kw => titleLower.includes(kw));
    const stillMissing = missingKeywords.filter(kw => !titleLower.includes(kw));

    const handleSave = async () => {
        if (title === initialTitle || title.length < 5) return;
        setIsSaving(true);
        try {
            await onSaveTitle(title);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            alert(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h4 style={styles.title}>
                    <Sparkles size={16} color="#fbbf24" /> Optimizador de Título
                </h4>
                <div style={title.length > 60 ? styles.counterRed : styles.counter}>
                    {title.length} / 60 chars
                </div>
            </div>

            <div style={styles.inputRow}>
                <input 
                    type="text" 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    style={{...styles.input, ...(title.length > 60 ? styles.inputError : {})}}
                />
                <button 
                    onClick={handleSave}
                    disabled={isSaving || title === initialTitle || title.length < 5}
                    style={(isSaving || title === initialTitle || title.length < 5) ? styles.btnDisabled : styles.btnActive}
                >
                    {isSaving ? '⏳' : saved ? <Check size={16} /> : <Save size={16} />}
                    {saved ? 'Guardado' : 'Aplicar a ML'}
                </button>
            </div>

            {missingKeywords.length > 0 && (
                <div style={styles.keywordBox}>
                    <div style={styles.keywordBoxTitle}>KEYWORDS DEL LÍDER (HAZ CLIC PARA AÑADIR):</div>
                    <div style={styles.keywordList}>
                        {integratedKeywords.map(kw => (
                            <span key={kw} style={styles.kwIntegrated}>
                                <Check size={12} /> {kw}
                            </span>
                        ))}
                        {stillMissing.map(kw => (
                            <span key={kw} style={styles.kwMissing} onClick={() => setTitle(t => (t + ' ' + kw).trim())}>
                                + {kw}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    container: { backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
    title: { margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontSize: '1rem', fontWeight: 600 },
    counter: { fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', backgroundColor: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '4px' },
    counterRed: { fontSize: '0.75rem', fontWeight: 600, color: '#f87171', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '4px 8px', borderRadius: '4px' },
    
    inputRow: { display: 'flex', gap: '12px', marginBottom: '16px' },
    input: { 
        flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', 
        borderRadius: '8px', color: '#fff', padding: '10px 16px', fontSize: '0.9rem', outline: 'none', transition: 'border-color 0.2s'
    },
    inputError: { borderColor: '#ef4444' },
    
    btnActive: { 
        backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', 
        padding: '0 20px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
        transition: 'background-color 0.2s'
    },
    btnDisabled: { 
        backgroundColor: 'rgba(255,255,255,0.1)', color: '#64748b', border: 'none', borderRadius: '8px', 
        padding: '0 20px', fontSize: '0.9rem', fontWeight: 600, cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: '8px'
    },
    
    keywordBox: { backgroundColor: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' },
    keywordBoxTitle: { fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '8px' },
    keywordList: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    kwIntegrated: { display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 },
    kwMissing: { backgroundColor: 'rgba(255,255,255,0.1)', color: '#cbd5e1', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'background-color 0.2s' }
};
