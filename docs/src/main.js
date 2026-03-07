/**
 * LEITNER SYSTEM - MAIN LOGIC
 * Version: 4.1 (Cycle Infini 5->1 & Cache Buster)
 */

// --- CONSTANTES ---
const STORAGE_KEYS = {
    ALL_SESSIONS: 'leitner_sessions_list', 
    CONFIG: 'leitner_config',
    CARD_STATE: 'leitner_card_state',
    DECK_STATS: 'leitner_deck_stats',
    BOX_INTERVALS: 'leitner_box_intervals' // Nouvelle clé pour les intervalles personnalisés
};

const APP_STATE = {
    currentDeck: [],
    session: null,
    isResuming: false,
    config: { owner: 'leitexper1', repo: 'testleitnercodex', branch: 'main', path: 'docs/' }
};

// --- GESTIONNAIRE D'INTERVALLES (Temps entre les révisions) ---
const IntervalManager = {
    defaults: {
        1: { val: 1, unit: 'days' },
        2: { val: 3, unit: 'days' },
        3: { val: 7, unit: 'days' },
        4: { val: 14, unit: 'days' },
        5: { val: 30, unit: 'days' }
    },
    getAll: () => {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.BOX_INTERVALS) || 'null') || IntervalManager.defaults;
    },
    get: (boxNum) => {
        return IntervalManager.getAll()[boxNum] || { val: 1, unit: 'days' };
    },
    set: (boxNum, val, unit) => {
        const current = IntervalManager.getAll();
        current[boxNum] = { val: parseInt(val), unit };
        localStorage.setItem(STORAGE_KEYS.BOX_INTERVALS, JSON.stringify(current));
    },
    // Recalcule toutes les boîtes en gardant les proportions (1, 3, 7, 14, 30)
    updateAllBasedOn: (sourceBox, val, unit) => {
        const ratios = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
        const sourceRatio = ratios[sourceBox] || 1;
        // On calcule la valeur de base (équivalent Boîte 1)
        const baseVal = val / sourceRatio;
        
        const current = IntervalManager.getAll();
        Object.keys(ratios).forEach(boxNum => {
            let newVal = Math.round(baseVal * ratios[boxNum]);
            if (newVal < 1) newVal = 1;
            current[boxNum] = { val: newVal, unit: unit };
        });
        localStorage.setItem(STORAGE_KEYS.BOX_INTERVALS, JSON.stringify(current));
    }
};

// --- 1. PERSISTANCE & STATS GLOBALES ---

const CardPersistence = {
    getStoredState: (filename) => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.CARD_STATE) || '{}')[filename] || {};
        } catch (e) { return {}; }
    },

    updateCard: (filename, cardId, box, lastReview, difficulty) => {
        const allStates = JSON.parse(localStorage.getItem(STORAGE_KEYS.CARD_STATE) || '{}');
        if (!allStates[filename]) allStates[filename] = {};
        allStates[filename][cardId] = { box, lastReview, difficulty };
        localStorage.setItem(STORAGE_KEYS.CARD_STATE, JSON.stringify(allStates));
    },

    applyState: (filename, csvData) => {
        const stored = CardPersistence.getStoredState(filename);
        csvData.forEach(card => {
            const state = stored[card.id];
            if (state) {
                if (typeof state === 'number') card.box = state;
                else {
                    if (state.box) card.box = state.box;
                    if (state.lastReview !== undefined) card.lastReview = state.lastReview;
                    if (state.difficulty !== undefined) card.difficulty = state.difficulty;
                }
            }
        });
        return csvData;
    },

    resetDeckState: (filename, cards) => {
        const allStates = JSON.parse(localStorage.getItem(STORAGE_KEYS.CARD_STATE) || '{}');
        if (!allStates[filename]) allStates[filename] = {};
        
        cards.forEach(card => {
            card.box = 1;
            card.lastReview = '';
            card.difficulty = '';
            
            allStates[filename][card.id] = { box: 1, lastReview: '', difficulty: '' };
        });
        localStorage.setItem(STORAGE_KEYS.CARD_STATE, JSON.stringify(allStates));
    }
};

// NOUVEAU : Gestion des compteurs de réussite par paquet
const DeckStats = {
    getAll: () => {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.DECK_STATS) || '{}');
    },
    
    get: (filename) => {
        const stats = DeckStats.getAll();
        return stats[filename] || { cycles: 0 };
    },

    incrementCycle: (filename) => {
        const stats = DeckStats.getAll();
        if (!stats[filename]) stats[filename] = { cycles: 0 };
        stats[filename].cycles++;
        localStorage.setItem(STORAGE_KEYS.DECK_STATS, JSON.stringify(stats));
        return stats[filename].cycles;
    }
};

// --- 2. UI & ADMIN ---

const UI = {
    init: () => {
        UI.loadConfig();
        UI.setupAdminListeners();
        UI.setupTabListeners();
        UI.setupImageZoom();
        UI.setupMenu();
        UI.setupMathJax();
    },

    loadConfig: () => {
        const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
        if (saved) APP_STATE.config = { ...APP_STATE.config, ...JSON.parse(saved) };
        const safeVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
        safeVal('repo-owner', APP_STATE.config.owner);
        safeVal('repo-name', APP_STATE.config.repo);
        safeVal('repo-branch', APP_STATE.config.branch);
        safeVal('repo-path', APP_STATE.config.path);
    },

    saveConfig: () => {
        const val = (id) => document.getElementById(id).value.trim();
        const newConfig = {
            owner: val('repo-owner'),
            repo: val('repo-name'),
            branch: val('repo-branch') || 'main',
            path: val('repo-path') || ''
        };
        APP_STATE.config = newConfig;
        localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(newConfig));
        alert('Configuration sauvegardée !');
        document.getElementById('admin-panel').classList.add('hidden');
        document.getElementById('admin-panel').setAttribute('aria-hidden', 'true');
    },

    setupAdminListeners: () => {
        const toggleModal = (id, show) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (show) {
                el.classList.remove('hidden');
                el.setAttribute('aria-hidden', 'false');
            } else {
                el.classList.add('hidden');
                el.setAttribute('aria-hidden', 'true');
            }
        };

        document.getElementById('admin-button').addEventListener('click', () => toggleModal('admin-panel', true));
        document.getElementById('close-admin').addEventListener('click', () => toggleModal('admin-panel', false));
        document.getElementById('load-github-csv').addEventListener('click', () => { UI.saveConfig(); location.reload(); });

        const openGuide = () => toggleModal('github-guide-modal', true);
        const closeGuide = () => toggleModal('github-guide-modal', false);
        document.getElementById('beginner-guide-btn')?.addEventListener('click', openGuide);
        document.getElementById('open-github-guide')?.addEventListener('click', openGuide);
        document.getElementById('close-github-guide')?.addEventListener('click', closeGuide);

        document.getElementById('open-import-export')?.addEventListener('click', () => {
            if (window.openImportExport) window.openImportExport();
        });
    },

    setupTabListeners: () => {
        document.querySelectorAll('.tab-button').forEach(btn => {
            if(btn.dataset.action === 'open-import-export') return;
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
                document.querySelectorAll('.tab-button').forEach(b => {
                    b.classList.remove('tab-button-active', 'bg-blue-600', 'text-white', 'shadow-sm');
                    b.classList.add('text-gray-600', 'hover:bg-gray-100');
                });
                const targetId = btn.dataset.tabTarget;
                const panel = document.querySelector(`[data-tab-panel="${targetId}"]`);
                if(panel) panel.classList.remove('hidden');
                btn.classList.add('tab-button-active', 'bg-blue-600', 'text-white', 'shadow-sm');
                btn.classList.remove('text-gray-600', 'hover:bg-gray-100');
                if (targetId === 'stats') StatsUI.init();
            });
        });
        const defaultTab = document.getElementById('tab-review-trigger');
        if(defaultTab) defaultTab.click();
    },

    setupMenu: () => {
        const trigger = document.getElementById('main-menu-trigger');
        const content = document.getElementById('main-menu-content');
        
        if (!trigger || !content) return;

        const toggleMenu = (forceClose = false) => {
            const isHidden = content.classList.contains('hidden');
            if (forceClose || !isHidden) {
                content.classList.add('hidden');
                trigger.innerHTML = '<span class="text-2xl leading-none">☰</span>';
                trigger.setAttribute('aria-expanded', 'false');
            } else {
                content.classList.remove('hidden');
                trigger.innerHTML = '<span class="text-2xl leading-none">✕</span>';
                trigger.setAttribute('aria-expanded', 'true');
            }
        };

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu();
        });

        document.addEventListener('click', (e) => {
            if (!content.contains(e.target) && !trigger.contains(e.target)) {
                toggleMenu(true);
            }
        });

        content.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => toggleMenu(true));
        });
    },

    setupMathJax: () => {
        if (document.getElementById('mathjax-script')) return;
        window.MathJax = {
            tex: { inlineMath: [['$', '$'], ['\\(', '\\)']] },
            svg: { fontCache: 'none' },
            startup: { typeset: false }
        };
        const script = document.createElement('script');
        script.id = 'mathjax-script';
        script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
        script.async = true;
        document.head.appendChild(script);
    },

    setupImageZoom: () => {
        if (document.getElementById('image-zoom-modal')) return;
        const modal = document.createElement('div');
        modal.id = 'image-zoom-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-90 z-[9999] hidden flex items-center justify-center cursor-zoom-out p-4';
        modal.onclick = () => modal.classList.add('hidden');
        
        const img = document.createElement('img');
        img.className = 'max-w-full max-h-full object-contain rounded shadow-2xl';
        modal.appendChild(img);
        document.body.appendChild(modal);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
            }
        });
    },

    openZoom: (src) => {
        const modal = document.getElementById('image-zoom-modal');
        const img = modal.querySelector('img');
        if (modal && img) {
            img.src = src;
            modal.classList.remove('hidden');
        }
    },

    getDomainFromFilename: (filename) => {
        if (!filename) return 'Divers';
        let cleanName = filename.replace('.csv', '');
        if (cleanName.startsWith('csv/')) cleanName = cleanName.substring(4);
        
        if (cleanName.includes('_')) {
            const parts = cleanName.split('_');
            return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        }
        return 'Divers';
    },

    getDomainColor: (str) => {
        // 1. Hash initial (DJB2) pour transformer la chaîne en entier
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
        }

        // 2. Mélangeur de bits (Bit-Mixer) pour garantir l'effet d'avalanche
        // Cela assure que des noms proches (ex: "Math" et "Maths") produisent des teintes opposées.
        let hMix = hash ^ (hash >>> 16);
        hMix = Math.imul(hMix, 0x85ebca6b);
        hMix ^= hMix >>> 13;
        hMix = Math.imul(hMix, 0xc2b2ae35);
        hMix ^= hMix >>> 16;

        // 3. Projection via l'Angle d'Or (~137.508°)
        // Cette constante irrationnelle permet une distribution optimale sur le cercle chromatique.
        const h = Math.abs((hMix * 137.508) % 360);
        
        // 4. Variation dynamique de saturation et luminosité pour une distinction accrue
        const s = 75 + (Math.abs(hash % 15)); // Saturation entre 75% et 90%
        const l = 93 + (Math.abs((hash >> 4) % 4)); // Luminosité entre 93% et 97%

        return {
            bg: `hsl(${h}, ${s}%, ${l}%)`,
            text: `hsl(${h}, ${s + 5}%, 25%)`, // Texte plus sombre pour un contraste parfait
            border: `hsl(${h}, ${s - 10}%, ${l - 10}%)`
        };
    },

    populateCSVSelector: function(files, options = {}) {
        const select = document.getElementById('csv-selector');
        if (!select) return;
        
        // --- STRATÉGIE ANALYSTE : Remplacement du Select par un Data Explorer ---
        // 1. On cache le selecteur natif mais on le garde pour la compatibilité avec CoreApp
        select.style.display = 'none';
        select.innerHTML = '<option value="">-- Choisir un paquet --</option>';
        
        // 2. Conteneur du nouvel explorateur
        let explorerContainer = document.getElementById('csv-explorer-container');
        if (!explorerContainer) {
            explorerContainer = document.createElement('div');
            explorerContainer.id = 'csv-explorer-container';
            explorerContainer.className = 'mt-2';
            select.parentNode.insertBefore(explorerContainer, select.nextSibling);
        }
        explorerContainer.innerHTML = '';

        const isLocal = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' || 
                       window.location.protocol === 'file:' ||
                       window.location.hostname.endsWith('github.io');

        // Filtrer pour ne garder que les fichiers du dossier csv/
        const filteredFiles = files.filter(f => {
            const p = f.publicPath || f.download_url || '';
            const normalizedPath = p.replace(/\\/g, '/');
            
            if (isLocal) {
                return normalizedPath.includes('csv/') && normalizedPath.toLowerCase().endsWith('.csv');
            }
            
            return /(?:^|\/)csv\/[^/]+\.csv$/i.test(normalizedPath);
        });

        // Déduplication stricte
        const uniqueFiles = [];
        const seen = new Set();
        filteredFiles.forEach(f => {
            const normalizedName = f.name ? f.name.toLowerCase().trim() : '';
            if (normalizedName && !seen.has(normalizedName)) {
                seen.add(normalizedName);
                uniqueFiles.push(f);
            }
        });

        uniqueFiles.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

        // 3. Peupler le select caché (pour la logique interne) et préparer les données du tableau
        const tableData = uniqueFiles.map(f => {
            // Ajout au select caché
            const option = document.createElement('option');
            option.value = f.download_url || f.publicPath;
            option.textContent = f.name;
            option.dataset.name = f.name;
            if(options.selectedName === f.name) option.selected = true;
            select.appendChild(option);

            // Préparation métadonnées pour le tableau
            let cleanName = f.name.replace('.csv', '');
            if (cleanName.startsWith('csv/')) cleanName = cleanName.substring(4);
            
            let domain = 'Divers';
            // Heuristique : Si le nom contient un underscore, la première partie est le domaine
            if (cleanName.includes('_')) {
                const parts = cleanName.split('_');
                domain = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
            }

            return {
                raw: f,
                name: cleanName,
                domain: domain,
                value: f.download_url || f.publicPath
            };
        });

        // 4. Construction de l'interface Data Explorer
        const domains = [...new Set(tableData.map(i => i.domain))].sort();

        // Zone de contrôles (Recherche + Filtre)
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'flex flex-col md:flex-row gap-3 mb-4';
        
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = '🔍 Rechercher un sujet...';
        searchInput.className = 'flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none';
        
        const domainFilter = document.createElement('select');
        domainFilter.className = 'p-2 border border-gray-300 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none';
        domainFilter.innerHTML = '<option value="">Tous les domaines</option>';
        domains.forEach(d => {
            domainFilter.innerHTML += `<option value="${d}">${d}</option>`;
        });

        controlsDiv.appendChild(searchInput);
        controlsDiv.appendChild(domainFilter);
        explorerContainer.appendChild(controlsDiv);

        // Grille compacte (remplace le tableau)
        const gridWrapper = document.createElement('div');
        gridWrapper.className = 'max-h-[400px] overflow-y-auto border rounded p-2 bg-gray-50';
        
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2';
        gridWrapper.appendChild(grid);
        explorerContainer.appendChild(gridWrapper);

        // Fonction de rendu dynamique
        const renderRows = () => {
            const term = searchInput.value.toLowerCase();
            const domain = domainFilter.value;

            const filtered = tableData.filter(item => {
                const matchText = item.name.toLowerCase().includes(term) || item.domain.toLowerCase().includes(term);
                const matchDomain = domain === '' || item.domain === domain;
                return matchText && matchDomain;
            });

            grid.innerHTML = '';
            if (filtered.length === 0) {
                grid.innerHTML = '<div class="col-span-full text-center text-gray-500 italic py-8">Aucun paquet trouvé</div>';
                return;
            }

            filtered.forEach(item => {
                const card = document.createElement('div');
                card.className = 'bg-white border border-gray-200 rounded p-2 cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-all shadow-sm flex flex-col justify-between group relative';
                
                if(select.value === item.value) {
                    card.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50');
                }

                const colors = UI.getDomainColor(item.domain);

                card.innerHTML = `
                    <div class="font-medium text-gray-800 text-xs leading-tight group-hover:text-blue-700 break-words mb-1" title="${item.name}">
                        ${item.name}
                    </div>
                    <div class="flex justify-end">
                        <span class="inline-block text-[9px] px-1.5 rounded border" style="background-color: ${colors.bg}; color: ${colors.text}; border-color: ${colors.border}">${item.domain}</span>
                    </div>
                `;
                
                const loadPackage = (e) => {
                    e.stopPropagation();
                    select.value = item.value;
                    // Déclenche l'événement change pour que CoreApp réagisse
                    select.dispatchEvent(new Event('change'));
                    
                    // Feedback visuel
                    Array.from(grid.children).forEach(c => c.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50'));
                    card.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50');
                };

                card.addEventListener('click', loadPackage);
                grid.appendChild(card);
            });
        };

        searchInput.addEventListener('input', renderRows);
        domainFilter.addEventListener('change', renderRows);
        
        // Rendu initial
        renderRows();
    }
};

window.leitnerApp = window.leitnerApp || {};
window.leitnerApp.ui = window.leitnerApp.ui || {};
window.leitnerApp.ui.populateCSVSelector = UI.populateCSVSelector;

// --- 3. GESTION DE SESSIONS ---

const SessionManager = {
    getAll: () => {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.ALL_SESSIONS) || '[]');
    },

    start: (deckName, cards) => {
        const newSession = {
            id: Date.now(),
            deckName: deckName,
            originalDeckIds: cards.map(c => c.id), 
            cardsQueue: cards.map((c) => c.id),
            totalCards: cards.length,
            currentIndex: 0,
            stats: { correct: 0, wrong: 0 },
            startTime: new Date().toISOString(),
            lastUpdate: new Date().toISOString(),
            status: 'active'
        };

        const sessions = SessionManager.getAll();
        sessions.unshift(newSession);
        localStorage.setItem(STORAGE_KEYS.ALL_SESSIONS, JSON.stringify(sessions));
        
        APP_STATE.session = newSession;
        APP_STATE.isResuming = false;
        return newSession;
    },

    updateCurrent: () => {
        if (!APP_STATE.session) return;
        
        const s = APP_STATE.session;
        s.lastUpdate = new Date().toISOString();
        
        // --- LOGIQUE CYCLE CONTINU ---
        // Une session est "Terminée" pour l'historique quand la file d'attente est vide
        // Mais le but est l'apprentissage continu.
        
        if (APP_STATE.session.currentIndex >= APP_STATE.session.totalCards) {
            APP_STATE.session.status = 'completed';
        } else {
            APP_STATE.session.status = 'active'; 
        }

        const sessions = SessionManager.getAll();
        const index = sessions.findIndex(item => item.id === s.id);
        
        if (index !== -1) {
            sessions[index] = s;
            localStorage.setItem(STORAGE_KEYS.ALL_SESSIONS, JSON.stringify(sessions));
        }
        
        StatsUI.renderHistory();
    },

    recordResult: (isCorrect) => {
        if (!APP_STATE.session) return;
        if (isCorrect) APP_STATE.session.stats.correct++;
        else APP_STATE.session.stats.wrong++;
        APP_STATE.session.currentIndex++;
        
        SessionManager.updateCurrent();
    },

    resumeById: (sessionId) => {
        const sessions = SessionManager.getAll();
        const sessionToResume = sessions.find(s => s.id === parseInt(sessionId));
        
        if (sessionToResume) {
            APP_STATE.session = sessionToResume;
            APP_STATE.isResuming = true;

            if (CoreApp.csvData.length > 0 && CoreApp.csvData.filename === sessionToResume.deckName) {
                // Si la session était finie, on propose de relancer les cartes "non maîtrisées" ou tout le paquet
                if (sessionToResume.currentIndex >= sessionToResume.totalCards) {
                    alert("Relance de la session pour un nouveau tour !");
                    // On remet tout à zéro pour un nouveau tour sur ce paquet
                    // Note: Pour un vrai Leitner continu, on devrait prendre les cartes < Box 5.
                    // Ici on recharge simplement la session avec les cartes actuelles du paquet
                    const currentCards = CoreApp.csvData.map(c => c.id);
                    sessionToResume.cardsQueue = currentCards;
                    sessionToResume.totalCards = currentCards.length;
                    sessionToResume.currentIndex = 0;
                    sessionToResume.status = 'active';
                    SessionManager.updateCurrent();
                }

                document.getElementById('tab-review-trigger').click();
                CoreApp.startReview();
            } else {
                if(confirm(`Fichier "${sessionToResume.deckName}" requis. Aller à le bouton Révision ?`)) {
                    document.getElementById('tab-review-trigger').click();
                    const selector = document.getElementById('csv-selector');
                    if(selector) selector.focus();
                }
            }
        } else {
            alert("Session introuvable.");
        }
    },

    deleteSession: (sessionId) => {
        let sessions = SessionManager.getAll();
        sessions = sessions.filter(s => s.id !== parseInt(sessionId));
        localStorage.setItem(STORAGE_KEYS.ALL_SESSIONS, JSON.stringify(sessions));
        StatsUI.renderHistory();
    },
    
    deleteAll: () => {
        localStorage.removeItem(STORAGE_KEYS.ALL_SESSIONS);
        localStorage.removeItem(STORAGE_KEYS.CARD_STATE);
        localStorage.removeItem(STORAGE_KEYS.DECK_STATS);
        alert("Tout effacé. Redémarrage...");
        location.reload();
    }
};

// --- 4. STATISTIQUES ---

const StatsUI = {
    init: () => {
        StatsUI.renderHistory();
        StatsUI.renderDifficultyStats();
        
        document.getElementById('btn-clear-history')?.addEventListener('click', () => {
            if(confirm('Tout effacer (Historique + État des boîtes) ?')) SessionManager.deleteAll();
        });
        
        const historyList = document.getElementById('stats-history-list');
        if (historyList) {
            historyList.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-session-btn')) {
                    e.stopPropagation();
                    const id = e.target.dataset.id;
                    if(confirm("Supprimer cette session ?")) SessionManager.deleteSession(id);
                    return;
                }

                const li = e.target.closest('li');
                if (!li) return;

                const id = li.dataset.id;
                SessionManager.resumeById(id);
            });
        }
        
        const oldResume = document.getElementById('resume-area');
        if(oldResume) oldResume.classList.add('hidden');
    },

    renderDifficultyStats: () => {
        if (!CoreApp.csvData || CoreApp.csvData.length === 0) {
            ['easy', 'normal', 'hard'].forEach(diff => document.getElementById(`stat-count-${diff}`).textContent = '0');
            return;
        }
        let counts = { easy: 0, normal: 0, hard: 0 };
        CoreApp.csvData.forEach(card => {
            const diff = card.difficulty || 'normal';
            if (counts[diff] !== undefined) counts[diff]++; else counts['normal']++;
        });
        document.getElementById('stat-count-easy').textContent = counts.easy;
        document.getElementById('stat-count-normal').textContent = counts.normal;
        document.getElementById('stat-count-hard').textContent = counts.hard;
    },

    renderHistory: () => {
        const list = document.getElementById('stats-history-list');
        if(!list) return;

        const sessions = SessionManager.getAll();
        
        if (sessions.length === 0) {
            list.innerHTML = '<li class="p-4 text-center text-gray-500 italic">Historique vide.</li>';
            document.getElementById('stat-total-reviewed').textContent = '0';
            document.getElementById('stat-success-rate').textContent = '0%';
            document.getElementById('stat-streak').textContent = '0';
            return;
        }

        let html = '';
        let totalCards = 0;
        let totalCorrect = 0;
        let finishedCount = 0;

        sessions.forEach((s) => {
            const dateObj = new Date(s.lastUpdate);
            const dateStr = dateObj.toLocaleDateString('fr-FR', {day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit'});
            
            // Récupération des stats de cycles réussis pour ce fichier
            const deckStats = DeckStats.get(s.deckName);
            const cyclesCount = deckStats.cycles || 0;

            if (s.status === 'completed') {
                totalCards += s.totalCards;
                totalCorrect += s.stats.correct;
                finishedCount++;
            }

            let statusBadge = '';
            let borderColor = 'border-blue-500';
            let bgClass = 'bg-white';
            
            // On affiche le nombre de cycles réussis (Box 5 -> 1)
            let cycleBadge = cyclesCount > 0 
                ? `<span class="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded ml-2">🏆 ${cyclesCount} Cycles</span>`
                : '';

            if (s.status === 'completed') {
                statusBadge = '<span class="text-xs font-bold text-gray-600 bg-gray-200 px-2 py-1 rounded">TERMINÉ</span>';
                borderColor = 'border-gray-400';
                bgClass = 'bg-gray-50';
            } else {
                statusBadge = '<span class="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">EN COURS</span>';
            }

            const remaining = s.totalCards - s.currentIndex;
            const progressInfo = remaining <= 0 ? "Revoir (cliquer)" : `${remaining} cartes`;

            html += `
            <li data-id="${s.id}" data-status="${s.status}" class="cursor-pointer hover:bg-gray-50 transition p-3 ${bgClass} rounded border-l-4 ${borderColor} mb-2 shadow-sm group relative" title="Cliquer pour gérer">
                <button class="delete-session-btn absolute top-2 right-2 text-gray-400 hover:text-red-500 hidden group-hover:block px-2 text-lg" data-id="${s.id}" title="Supprimer">✕</button>
                <div class="flex justify-between items-center pr-8">
                    <div>
                        <div class="flex flex-wrap items-center gap-2 mb-1">
                            <strong class="text-gray-800 text-sm">${s.deckName}</strong>
                            ${statusBadge}
                            ${cycleBadge}
                        </div>
                        <span class="text-xs text-gray-500 block">Activité : ${dateStr}</span>
                    </div>
                    <div class="text-right">
                        <span class="block font-bold text-gray-700 text-sm">${progressInfo}</span>
                        <span class="text-xs text-gray-400">Session: ${s.stats.correct}/${s.totalCards}</span>
                    </div>
                </div>
            </li>`;
        });

        list.innerHTML = html;

        document.getElementById('stat-total-reviewed').textContent = totalCards;
        const globalRate = totalCards > 0 ? Math.round((totalCorrect / totalCards) * 100) : 0;
        document.getElementById('stat-success-rate').textContent = globalRate + '%';
        document.getElementById('stat-streak').textContent = finishedCount;
    }
};

// --- 5. COEUR DE L'APPLICATION ---

const CoreApp = {
    csvData: [],

    init: () => {
        UI.init();
        
        const selector = document.getElementById('csv-selector');
        selector.addEventListener('change', async (e) => {
            const url = e.target.value;
            if(!url) return;
            const selectedOption = e.target.options[e.target.selectedIndex];
            const filename = selectedOption.dataset.name || selectedOption.value || "unknown.csv";

            try {
                const status = document.getElementById('csv-load-status');
                status.classList.remove('hidden');
                status.textContent = "Chargement...";
                status.className = "mt-2 w-full text-sm text-blue-600";
                
                // Ajout d'un cache buster pour être sûr de ne pas taper dans un cache 404 ou périmé
                const fetchUrl = new URL(url, window.location.href);
                fetchUrl.searchParams.set('_t', Date.now());
                const response = await fetch(fetchUrl.toString());
                if(!response.ok) throw new Error("Fichier introuvable");
                
                const text = await response.text();
                let data = CoreApp.parseCSV(text);
                data = CardPersistence.applyState(filename, data);
                
                CoreApp.csvData = data;
                CoreApp.csvData.filename = filename;
                CoreApp.persistSessionDeck();
                try {
                    CoreApp.validateImageStructure(filename);
                } catch (e) {
                    console.warn("Validation images ignorée:", e);
                }

                document.getElementById('reset-deck-btn')?.classList.remove('hidden');
                document.getElementById('export-deck-btn')?.classList.remove('hidden'); // Afficher export pour les fichiers normaux aussi
                CoreApp.renderBoxes();
                CoreApp.renderDeckOverview();
                StatsUI.renderDifficultyStats();

                status.textContent = `${CoreApp.csvData.length} cartes chargées.`;
                status.className = "mt-2 w-full text-sm text-green-600";
                
                if (CoreApp.csvData.length === 0) {
                    alert("Attention : Aucune carte n'a été trouvée dans ce fichier CSV.\nVérifiez le format du fichier.");
                }
                
                StatsUI.renderHistory();

                if (APP_STATE.isResuming && APP_STATE.session && APP_STATE.session.deckName === filename) {
                    APP_STATE.isResuming = false;
                    if (APP_STATE.session.currentIndex >= APP_STATE.session.totalCards && APP_STATE.session.status === 'active') {
                         SessionManager.resumeById(APP_STATE.session.id);
                    } else {
                         CoreApp.startReview();
                    }
                }

            } catch (err) {
                console.error(err);
                const status = document.getElementById('csv-load-status');
                status.textContent = "Erreur de chargement.";
                status.className = "mt-2 w-full text-sm text-red-600";

                // Si le fichier est introuvable (ex: renommé), on force le rafraîchissement de la liste
                const app = window.leitnerAppInstance || (window.leitnerApp && window.leitnerApp.instance);
                if (app && typeof app.loadCSVFromGitHub === 'function') {
                    console.log("Fichier introuvable, tentative d'actualisation de la liste CSV...");
                    await app.loadCSVFromGitHub();
                    status.textContent = "Erreur de chargement. La liste a été actualisée, veuillez réessayer.";
                }
            }
        });

        document.getElementById('show-answer-btn').addEventListener('click', () => {
            document.getElementById('answer-section').classList.remove('hidden');
            document.getElementById('show-answer-btn').classList.add('hidden');
        });
        document.getElementById('right-answer').addEventListener('click', () => CoreApp.handleAnswer(true));
        document.getElementById('wrong-answer').addEventListener('click', () => CoreApp.handleAnswer(false));
        
        document.getElementById('edit-card-btn')?.addEventListener('click', () => CoreApp.openEditor());
        document.getElementById('delete-card-btn')?.addEventListener('click', () => CoreApp.deleteCard());
        document.getElementById('cancel-edit')?.addEventListener('click', () => CoreApp.closeEditor());
        document.getElementById('card-form')?.addEventListener('submit', (e) => CoreApp.saveCard(e));
        document.getElementById('reset-deck-btn')?.addEventListener('click', () => CoreApp.resetCurrentDeck());
        
        // Nouveaux écouteurs pour le Mix et l'Export
        document.getElementById('export-deck-btn')?.addEventListener('click', () => CoreApp.exportCurrentDeck());
        document.getElementById('global-mix-btn')?.addEventListener('click', () => CoreApp.openMixModal());
        document.getElementById('btn-launch-mix')?.addEventListener('click', () => CoreApp.generateMixFromSelection());
        document.getElementById('mix-select-all')?.addEventListener('click', () => CoreApp.toggleMixCheckboxes(true));
        document.getElementById('mix-select-none')?.addEventListener('click', () => CoreApp.toggleMixCheckboxes(false));
        document.querySelectorAll('.close-mix-modal').forEach(btn => btn.addEventListener('click', () => document.getElementById('mix-selection-modal').classList.add('hidden')));
        
        // Écouteurs pour la configuration des intervalles
        document.getElementById('interval-form')?.addEventListener('submit', (e) => CoreApp.saveIntervalConfig(e));
        document.querySelectorAll('.close-interval-modal').forEach(btn => btn.addEventListener('click', () => document.getElementById('interval-config-modal').classList.add('hidden')));
        // Prévisualisation en direct de l'intervalle
        document.getElementById('interval-value')?.addEventListener('input', CoreApp.updateIntervalPreview);
        document.getElementById('interval-unit')?.addEventListener('change', CoreApp.updateIntervalPreview);

        document.querySelectorAll('.modal .close, .flashcard-container, #admin-panel, #github-guide-modal').forEach(el => {
            el.addEventListener('click', (e) => {
                if(e.target === el || e.target.classList.contains('close')) {
                    if(el.id === 'flashcard-container' || el.classList.contains('flashcard-container')) {
                        CoreApp.closeFlashcard();
                    } else {
                        el.classList.add('hidden');
                        el.setAttribute('aria-hidden', 'true');
                    }
                }
            });
        });
    },

    // --- FONCTIONNALITÉS MIX & EXPORT ---

    openMixModal: () => {
        const selector = document.getElementById('csv-selector');
        // On récupère les options valides (ignorer le placeholder vide)
        const options = Array.from(selector.options).filter(opt => opt.value); 
        
        if (options.length === 0) {
            alert("Aucun fichier CSV détecté pour le moment.");
            return;
        }

        const container = document.getElementById('mix-checkbox-list');
        container.innerHTML = '';

        options.forEach((opt, idx) => {
            const div = document.createElement('div');
            div.className = 'flex items-center gap-2 p-2 hover:bg-white rounded border border-transparent hover:border-gray-200 transition-colors';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `mix-check-${idx}`;
            checkbox.value = opt.value;
            checkbox.dataset.name = opt.dataset.name || opt.text;
            checkbox.checked = true; // Coché par défaut
            checkbox.className = 'w-4 h-4 text-purple-600 rounded focus:ring-purple-500 mix-checkbox';

            const label = document.createElement('label');
            label.htmlFor = `mix-check-${idx}`;
            label.className = 'text-sm text-gray-700 cursor-pointer flex-1 select-none';
            label.textContent = opt.dataset.name || opt.text;

            div.appendChild(checkbox);
            div.appendChild(label);
            container.appendChild(div);
        });

        document.getElementById('mix-selection-modal').classList.remove('hidden');
    },

    toggleMixCheckboxes: (state) => {
        document.querySelectorAll('.mix-checkbox').forEach(cb => cb.checked = state);
    },

    generateMixFromSelection: async () => {
        const checkboxes = document.querySelectorAll('.mix-checkbox:checked');
        if (checkboxes.length === 0) {
            alert("Veuillez sélectionner au moins un paquet.");
            return;
        }

        const cardCountInput = document.getElementById('mix-card-count');
        const cardsPerDeck = parseInt(cardCountInput.value, 10) || 5;
        if (cardsPerDeck < 1) {
            alert("Le nombre de cartes par paquet doit être d'au moins 1.");
            cardCountInput.value = '1';
            return;
        }
        const shuffleGlobally = document.getElementById('mix-shuffle-globally').checked;


        document.getElementById('mix-selection-modal').classList.add('hidden');

        const status = document.getElementById('csv-load-status');
        status.classList.remove('hidden');
        status.textContent = "Préparation de la salade de connaissances... 🥗";
        status.className = "mt-2 w-full text-sm text-purple-600 animate-pulse";

        let mixedDeck = [];
        let loadedCount = 0;

        try {
            for (const cb of checkboxes) {
                const url = cb.value;
                const filename = cb.dataset.name;

                try {
                    const fetchUrl = new URL(url, window.location.href);
                    fetchUrl.searchParams.set('_t', Date.now());
                    const response = await fetch(fetchUrl.toString());
                    if (!response.ok) continue;

                    const text = await response.text();
                    let data = CoreApp.parseCSV(text);
                    
                    // IMPORTANT : On applique l'état sauvegardé (boîtes, dates)
                    data = CardPersistence.applyState(filename, data);

                    // Mélange Fisher-Yates
                    for (let i = data.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [data[i], data[j]] = [data[j], data[i]];
                    }
                    
                    // On prend le nombre de cartes défini (ou moins si le paquet est petit)
                    const selection = data.slice(0, cardsPerDeck).map(card => ({
                        ...card,
                        sourceFilename: filename, // On garde la trace du fichier source
                        originalId: card.id       // On garde l'ID original pour la sauvegarde
                    }));

                    mixedDeck = mixedDeck.concat(selection);
                    loadedCount++;
                } catch (e) {
                    console.warn(`Impossible de charger ${filename}`, e);
                }
            }

            // Si l'option est cochée, on mélange le paquet final
            if (shuffleGlobally) {
                for (let i = mixedDeck.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [mixedDeck[i], mixedDeck[j]] = [mixedDeck[j], mixedDeck[i]];
                }
            }

            // Réassignation des IDs pour la session courante (0, 1, 2...)
            mixedDeck = mixedDeck.map((card, index) => ({ ...card, id: index }));

            CoreApp.csvData = mixedDeck;
            CoreApp.csvData.filename = `MIX_ALEATOIRE_${new Date().toISOString().slice(0,10)}.csv`;
            
            document.getElementById('reset-deck-btn').classList.add('hidden');
            document.getElementById('export-deck-btn').classList.remove('hidden'); // Afficher le bouton export
            
            CoreApp.renderBoxes();
            CoreApp.renderDeckOverview();
            StatsUI.renderDifficultyStats();
            
            status.textContent = `Mix prêt ! ${mixedDeck.length} cartes tirées de ${loadedCount} fichiers.`;
            status.className = "mt-2 w-full text-sm text-green-600";

            SessionManager.start("SESSION_MIX", mixedDeck);
            CoreApp.startReview();

        } catch (err) {
            console.error(err);
            status.textContent = "Erreur lors de la création du mix.";
            status.className = "mt-2 w-full text-sm text-red-600";
        }
    },

    // --- GESTION INTERVALLES UI ---
    openIntervalConfig: (boxNum) => {
        const config = IntervalManager.get(boxNum);
        document.getElementById('interval-box-num').textContent = boxNum;
        document.getElementById('config-box-id').value = boxNum;
        document.getElementById('interval-value').value = config.val;
        document.getElementById('interval-unit').value = config.unit;
        document.getElementById('interval-config-modal').classList.remove('hidden');
        // Mettre à jour la prévisualisation à l'ouverture
        CoreApp.updateIntervalPreview();
    },

    saveIntervalConfig: (e) => {
        e.preventDefault();
        const boxNum = document.getElementById('config-box-id').value;
        const val = document.getElementById('interval-value').value;
        const unit = document.getElementById('interval-unit').value;
        const applyToAll = document.getElementById('interval-apply-all').checked;

        if (applyToAll) {
            IntervalManager.updateAllBasedOn(boxNum, val, unit);
        } else {
            IntervalManager.set(boxNum, val, unit);
        }
        
        document.getElementById('interval-config-modal').classList.add('hidden');
        CoreApp.renderBoxes(); // Rafraîchir l'affichage
    },

    // Calcule la prochaine date de révision pour une boîte avec un intervalle temporaire
    calculateNextReviewForBox: (boxNum, cards, intervalConfig) => {
        const now = new Date();
        let earliestDate = null;
        let pendingCount = 0;

        cards.forEach(card => {
            if (!card.lastReview) {
                pendingCount++;
            } else {
                const last = new Date(card.lastReview);
                if (!isNaN(last.getTime())) {
                    const next = new Date(last);
                    if (intervalConfig.unit === 'minutes') next.setMinutes(next.getMinutes() + intervalConfig.val);
                    else if (intervalConfig.unit === 'hours') next.setHours(next.getHours() + intervalConfig.val);
                    else next.setDate(next.getDate() + intervalConfig.val);

                    if (next <= now) {
                        pendingCount++;
                    } else {
                        if (!earliestDate || next < earliestDate) {
                            earliestDate = next;
                        }
                    }
                } else {
                    pendingCount++;
                }
            }
        });

        if (pendingCount > 0) return "Maintenant";
        if (earliestDate) {
            const dateStr = earliestDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
            const timeStr = earliestDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            return `${dateStr} à ${timeStr}`;
        }
        return "Aucune";
    },

    // Met à jour le texte de prévisualisation dans la modale d'intervalle
    updateIntervalPreview: () => {
        const boxNum = document.getElementById('config-box-id').value;
        const val = parseInt(document.getElementById('interval-value').value, 10);
        const unit = document.getElementById('interval-unit').value;
        const previewEl = document.getElementById('interval-preview-date');

        if (!boxNum || isNaN(val) || val < 1) {
            previewEl.textContent = '-';
            return;
        }

        const cards = CoreApp.csvData.filter(c => c.box == boxNum);
        const tempIntervalConfig = { val, unit };
        const previewText = CoreApp.calculateNextReviewForBox(boxNum, cards, tempIntervalConfig);
        previewEl.textContent = cards.length > 0 ? previewText : 'Boîte vide';
    },

    exportCurrentDeck: () => {
        if (!CoreApp.csvData || CoreApp.csvData.length === 0) {
            alert("Rien à exporter.");
            return;
        }

        // Utilisation du point-virgule comme séparateur pour être cohérent avec l'import/export avancé
        let csvContent = "question_content;question_content_image;answer_content;answer_content_image;box_number;last_reviewed\n";
        
        // Fonction pour forcer les guillemets sur tous les champs (format strict demandé)
        const escapeCsv = (str) => {
            const stringified = (str === undefined || str === null) ? "" : String(str);
            return `"${stringified.replace(/"/g, '""')}"`;
        };

        CoreApp.csvData.forEach(card => {
            let dateStr = card.lastReview || '';
            if (dateStr.includes('T')) dateStr = dateStr.replace('T', ' ').split('.')[0];

            const row = [
                escapeCsv(card.question),
                escapeCsv(card.qImage),
                escapeCsv(card.answer),
                escapeCsv(card.aImage),
                escapeCsv(card.box || 1),
                escapeCsv(dateStr)
            ].join(';');
            csvContent += row + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        let exportName = CoreApp.csvData.filename || "export_leitner.csv";
        if (!exportName.toLowerCase().endsWith('.csv')) exportName += '.csv';
        
        link.setAttribute("href", url);
        link.setAttribute("download", exportName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    closeFlashcard: () => {
        const el = document.getElementById('flashcard-container');
        // Correction accessibilité : s'assurer qu'aucun élément dans le conteneur n'a le focus avant de le cacher.
        if (document.activeElement && el.contains(document.activeElement)) {
            // Retirer le focus déplace le focus vers le corps du document, évitant l'erreur.
            document.activeElement.blur();
        }

        el.classList.add('hidden');
        el.setAttribute('aria-hidden', 'true');
        CoreApp.renderBoxes();
        CoreApp.renderDeckOverview();
        StatsUI.renderDifficultyStats();
        StatsUI.renderHistory();
    },

    parseCSV: (text) => {
        const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim());
        if (lines.length === 0) return [];

        // Algorithme de détection robuste du séparateur (analyse statistique sur 10 lignes)
        // Permet de gérer les fichiers mixtes (Header avec virgules, Data avec points-virgules)
        const detectSeparator = (sampleLines) => {
            const candidates = [';', ','];
            let bestSep = ',';
            let maxConsistency = -1;

            candidates.forEach(sep => {
                // On compte les colonnes > 1 pour chaque ligne
                const counts = sampleLines.map(l => l.split(sep).length).filter(c => c > 1);
                // On cherche la fréquence max (le mode)
                if (counts.length > maxConsistency) {
                    maxConsistency = counts.length;
                    bestSep = sep;
                }
            });
            return bestSep;
        };

        const separator = detectSeparator(lines.slice(0, 10));

        return lines.slice(1).map((line, index) => {
            const matches = [];
            // Regex dynamique basée sur le séparateur détecté
            const regex = new RegExp(`(?:^|${separator})(?:"([^"]*)"|([^"${separator}]*))`, 'g');
            let match;
            let safety = 0;
            while ((match = regex.exec(line)) !== null) {
                let val = match[1] !== undefined ? match[1] : match[2];
                val = val ? val.trim() : '';
                matches.push(val);
                if (safety++ > 100) break; // Sécurité : évite une boucle infinie sur une ligne corrompue
            }
            
            // Logique robuste pour gérer les CSV mal formés (virgules dans les réponses)
            // et les numéros de boîte hors limites (ex: 200 -> 1)
            let questionContent = matches[0] || '';
            let questionImage = matches[1] || '';
            let answer = '';
            let aImage = '';
            let box = 1;
            let lastReview = '';

            if (matches.length >= 6) {
                // On part de la fin pour récupérer les champs fixes (Date et Boîte sont toujours à la fin)
                lastReview = matches[matches.length - 1];
                
                const rawBox = parseInt(matches[matches.length - 2]);
                // Force la boîte entre 1 et 5, sinon 1 (corrige le problème des boîtes 200+)
                box = (!isNaN(rawBox) && rawBox >= 1 && rawBox <= 5) ? rawBox : 1;
                
                aImage = matches[matches.length - 3];
                
                // Tout ce qui est entre l'image question et l'image réponse est la réponse
                // (permet de gérer les virgules qui auraient scindé la réponse en plusieurs colonnes)
                const answerParts = matches.slice(2, matches.length - 3);
                answer = answerParts.join(', ') || '';
                aImage = matches[matches.length - 3] || '';
            } else {
                // Fallback standard si moins de colonnes que prévu
                answer = matches[2] || '';
                aImage = matches[3] || '';
                const rawBox = parseInt(matches[4]);
                box = (!isNaN(rawBox) && rawBox >= 1 && rawBox <= 5) ? rawBox : 1;
                lastReview = matches[5] || '';
            }

            // Appliquer le texte par défaut uniquement si le contenu et l'image sont tous deux absents
            if (!questionContent && !questionImage) {
                questionContent = 'Question vide';
            }
            if (!answer && !aImage) {
                answer = 'Réponse vide';
            }

            return { id: index, question: questionContent, qImage: questionImage, answer, aImage, box, lastReview };
        });
    },

    getNextReviewDateForBox: (boxNum, cards) => {
        const now = new Date();
        let earliestDate = null;
        let pendingCount = 0; // Nombre de cartes à réviser maintenant
        const intervalConfig = IntervalManager.get(boxNum);

        cards.forEach(card => {
            if (!card.lastReview) {
                pendingCount++;
            } else {
                const last = new Date(card.lastReview);
                if (!isNaN(last.getTime())) {
                    const next = new Date(last);
                    
                    // Calcul dynamique selon l'unité choisie
                    if (intervalConfig.unit === 'minutes') next.setMinutes(next.getMinutes() + intervalConfig.val);
                    else if (intervalConfig.unit === 'hours') next.setHours(next.getHours() + intervalConfig.val);
                    else next.setDate(next.getDate() + intervalConfig.val); // Jours par défaut

                    if (next <= now) pendingCount++;
                    else {
                        if (!earliestDate || next < earliestDate) earliestDate = next;
                    }
                } else pendingCount++;
            }
        });

        if (pendingCount > 0) return { text: "Maintenant", count: pendingCount, urgent: true };
        if (earliestDate) {
            const dateStr = earliestDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' });
            const timeStr = earliestDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            return { text: `${dateStr} à ${timeStr}`, count: 0, urgent: false };
        }
        return { text: "Aucune", count: 0, urgent: false };
    },

    renderBoxes: () => {
        const container = document.getElementById('leitner-boxes');
        if(!container) return;
        container.innerHTML = '';
        
        [1, 2, 3, 4, 5].forEach(num => {
            const cards = CoreApp.csvData.filter(c => c.box === num);
            const count = cards.length;
            const reviewInfo = CoreApp.getNextReviewDateForBox(num, cards);
            
            // Récupération de la config pour l'affichage
            const conf = IntervalManager.get(num);
            const unitLabels = { minutes: 'min', hours: 'h', days: 'j' };
            const intervalLabel = `${conf.val}${unitLabels[conf.unit]}`;

            const textColor = reviewInfo.urgent ? 'text-orange-600 font-bold' : 'text-gray-500';
            // MODIFICATION : Le texte est simplifié pour ne plus afficher le compte redondant.
            const dateText = reviewInfo.urgent ? `Maintenant` : `Prochaine : ${reviewInfo.text}`;

            const div = document.createElement('div');
            // MODIFICATION : Le curseur n'est plus sur toute la boîte pour éviter la confusion.
            div.className = `bg-white p-4 rounded shadow border-t-4 box-border-${num} hover:shadow-lg transition flex flex-col justify-between`;
            
            // MODIFICATION : La structure est divisée en deux zones distinctes pour des clics séparés.
            div.innerHTML = `
                <div class="review-trigger-area cursor-pointer flex-grow">
                    <h3 class="font-bold text-gray-700 text-box${num}">Boîte ${num}</h3>
                    <p class="text-3xl font-bold mt-2 text-gray-800 transition-all duration-300" id="box-count-${num}">${count}</p>
                    <p class="text-xs text-gray-500 uppercase tracking-wide mb-3">cartes</p>
                </div>
                <div class="interval-config-area mt-2 border-t pt-2 hover:bg-gray-50 transition-colors rounded -mx-2 px-2 py-1 cursor-pointer" title="Double-cliquer pour changer l'intervalle (${intervalLabel})">
                    <div class="flex justify-between items-center">
                        <span class="text-xs ${textColor}">${dateText}</span>
                        <span class="text-[10px] text-gray-400 bg-gray-100 px-1 rounded border">⏱️ ${intervalLabel}</span>
                    </div>
                </div>
            `;

            // MODIFICATION : L'écouteur de clic est uniquement sur la partie haute.
            const topPart = div.querySelector('.review-trigger-area');
            topPart.addEventListener('click', () => {
                if(cards.length) {
                    SessionManager.start(CoreApp.csvData.filename, cards);
                    CoreApp.startReview();
                } else alert('Boîte vide.');
            });

            // MODIFICATION : L'écouteur de double-clic est uniquement sur la partie basse.
            const bottomPart = div.querySelector('.interval-config-area');
            bottomPart.addEventListener('dblclick', () => {
                CoreApp.openIntervalConfig(num);
            });

            container.appendChild(div);
        });
    },

    renderDeckOverview: () => {
        const container = document.getElementById('deck-overview-container');
        if(!container) return;
        
        container.innerHTML = ''; 
        
        const domain = UI.getDomainFromFilename(CoreApp.csvData.filename);
        const colors = UI.getDomainColor(domain);
        
        [1, 2, 3, 4, 5].forEach(boxNum => {
            const cards = CoreApp.csvData.filter(c => c.box === boxNum);
            
            if (cards.length > 0) {
                const section = document.createElement('div');
                section.className = 'bg-white rounded-lg shadow-md p-5';
                
                const title = document.createElement('h3');
                title.className = `text-xl font-bold mb-4 text-box${boxNum} border-b pb-2`;
                title.textContent = `Boîte ${boxNum} (${cards.length} cartes)`;
                section.appendChild(title);
                
                const grid = document.createElement('div');
                grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3';
                
                cards.forEach(card => {
                    const cardEl = document.createElement('div');
                    cardEl.className = 'border rounded p-3 hover:bg-blue-50 text-sm flex gap-3 cursor-pointer transition transform hover:-translate-y-1 hover:shadow-md';
                    cardEl.className = 'border rounded p-3 text-sm flex gap-3 cursor-pointer transition transform hover:-translate-y-1 hover:shadow-md';
                    cardEl.style.backgroundColor = colors.bg;
                    cardEl.style.borderColor = colors.border;
                    
                    cardEl.onclick = () => {
                        const boxCards = CoreApp.csvData.filter(c => c.box === boxNum);
                        const otherCards = boxCards.filter(c => c.id !== card.id);
                        const sessionCards = [card, ...otherCards];
                        SessionManager.start(CoreApp.csvData.filename, sessionCards);
                        CoreApp.startReview();
                    };
                    
                    let imgHtml = '';
                    const imgUrl = CoreApp.buildImageUrl(card.qImage, 'q');
                    if (imgUrl) {
                        imgHtml = `<div class="w-12 h-12 flex-shrink-0 bg-gray-200 rounded overflow-hidden"><img src="${imgUrl}" class="w-full h-full object-cover" onerror="this.style.display='none'"></div>`;
                    }
                    
                    let dateInfo = '';
                    if(card.lastReview) {
                        const d = new Date(card.lastReview);
                        if (!isNaN(d.getTime())) {
                            dateInfo = `<span class="text-xs text-gray-400 block mt-1">Vu : ${d.toLocaleDateString()} ${d.toLocaleTimeString()}</span>`;
                        }
                    }

                    let diffBadge = '';
                    if (card.difficulty) {
                        const colors = { easy: 'text-green-600', normal: 'text-blue-600', hard: 'text-red-600' };
                        const labels = { easy: 'Facile', normal: 'Normal', hard: 'Difficile' };
                        diffBadge = `<span class="text-xs ${colors[card.difficulty] || 'text-gray-500'} font-bold ml-2">(${labels[card.difficulty] || ''})</span>`;
                    }

                    cardEl.innerHTML = `${imgHtml}<div class="flex-1 min-w-0"><p class="font-semibold text-gray-800 break-words whitespace-pre-wrap" title="${card.question}">${card.question}</p><p class="text-gray-500 break-words whitespace-pre-wrap" title="${card.answer}">${card.answer}</p>${dateInfo} ${diffBadge}</div>`;
                    grid.appendChild(cardEl);
                });
                
                section.appendChild(grid);
                container.appendChild(section);
            }
        });

        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([container]).catch(() => {});
        }
    },

    buildImageUrl: (filename, type) => {
        if (!filename) return null;
        if (filename.startsWith('http') || filename.startsWith('data:')) return filename;
        
        const isLocal = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' || 
                       window.location.protocol === 'file:' ||
                       window.location.hostname.endsWith('github.io');
        
        const c = APP_STATE.config;
        const folder = type === 'q' ? 'images_questions' : 'images_reponses';
        
        let cleanPath = filename.trim().replace(/\\/g, '/').replace(/^(\.\/|\/)/, '');
        
        // Si le chemin ne contient pas déjà le dossier parent, on l'ajoute
        if (!cleanPath.startsWith('images_questions/') && !cleanPath.startsWith('images_reponses/')) {
            cleanPath = `${folder}/${cleanPath}`;
        }
        
        // Encodage des segments pour l'URL (garde les slashes)
        const encodedPath = cleanPath.split('/').map(encodeURIComponent).join('/');
        
        let finalUrl = '';
        if (isLocal) {
            finalUrl = encodedPath;
        } else {
            let basePath = c.path.endsWith('/') ? c.path.slice(0, -1) : c.path;
            if (basePath.endsWith('/csv')) basePath = basePath.slice(0, -4);
            else if (basePath === 'csv') basePath = '';
            const repoPath = basePath ? `${basePath}/` : '';
            finalUrl = `https://raw.githubusercontent.com/${c.owner}/${c.repo}/${c.branch}/${repoPath}${encodedPath}`;
        }

        // Ajout du cache buster pour forcer le navigateur à recharger l'image si elle a changé
        return `${finalUrl}?v=${APP_STATE.cacheBuster}`;
    },

    validateImageStructure: (filename) => {
        const baseName = filename.replace(/\.csv$/i, '');
        // Règle : le dossier peut être le nom complet ou le préfixe avant le premier underscore
        const prefix = baseName.split('_')[0];
        const warnings = [];

        CoreApp.csvData.forEach((card, index) => {
            const check = (path, type) => {
                if (!path || path.startsWith('http') || path.startsWith('data:')) return;
                
                const parts = path.replace(/\\/g, '/').replace(/^(\.\/|\/)/, '').split('/');
                let subDir = '';

                // Format attendu : images_questions/NOM_FICHIER/image.jpg
                if ((parts[0] === 'images_questions' || parts[0] === 'images_reponses') && parts.length >= 3) {
                    subDir = parts[1];
                } 
                // Format alternatif : NOM_FICHIER/image.jpg
                else if (parts.length >= 2 && parts[0] !== 'images_questions' && parts[0] !== 'images_reponses') {
                    subDir = parts[0];
                }

                if (subDir) {
                    const lowerSub = subDir.toLowerCase();
                    const lowerBase = baseName.toLowerCase();
                    const lowerPrefix = prefix.toLowerCase();
                    
                    // On accepte si le fichier commence par le dossier (ex: dossier "art" pour fichier "art_test.csv")
                    // OU si le dossier commence par le préfixe (ex: dossier "art_visuel" pour fichier "art_test.csv")
                    if (!lowerBase.startsWith(lowerSub) && !lowerSub.startsWith(lowerPrefix)) {
                        warnings.push(`Ligne ${index + 1} (${type}): Le dossier "${subDir}" ne correspond pas au fichier "${baseName}" (Attendu: "${prefix}..." ou "${baseName}").`);
                    }
                }
            };

            check(card.qImage, 'Question');
            check(card.aImage, 'Réponse');
        });

        if (warnings.length > 0) {
            console.warn('Validation Structure Images:', warnings);
            alert(`⚠️ Structure des dossiers d'images incorrecte.\n\nPour le fichier "${filename}", les images doivent être dans un sous-répertoire correspondant au nom du fichier ou à son préfixe (ex: images_questions/${prefix}/...).\n\n${warnings.length} incohérence(s) détectée(s).`);
        }
    },

    startReview: () => {
        if (!APP_STATE.session) return;
        const s = APP_STATE.session;
        
        // Remplacement de la récursion par une boucle while pour éviter le crash "Maximum call stack size exceeded"
        // et les boucles infinies si les cartes ne sont pas trouvées.
        while (s.currentIndex < s.totalCards) {
            const cardId = s.cardsQueue[s.currentIndex];
            const card = CoreApp.csvData.find(c => c.id === cardId);
            
            if (card) {
                CoreApp.showCardUI(card);
                return;
            }
            // Carte introuvable (supprimée ou ID obsolète), on passe à la suivante
            s.currentIndex++;
        }
        
        // Fin de session
        SessionManager.updateCurrent(); 
        alert(`Tour terminé !\nScore : ${s.stats.correct}/${s.totalCards}\n\nVoir le bouton Statistiques pour les détails.`);
        CoreApp.closeFlashcard();
    },

    showCardUI: (card) => {
        const container = document.getElementById('flashcard-container');
        container.classList.remove('hidden');
        container.setAttribute('aria-hidden', 'false'); 
        
        const domain = UI.getDomainFromFilename(CoreApp.csvData.filename);
        const colors = UI.getDomainColor(domain);
        const flashcardEl = container.querySelector('.flashcard');
        if (flashcardEl) {
            flashcardEl.style.backgroundColor = colors.bg;
        }

        document.getElementById('answer-section').classList.add('hidden');
        document.getElementById('show-answer-btn').classList.remove('hidden');

        const normalRadio = document.getElementById('difficulty-normal');
        if(normalRadio) normalRadio.checked = true;

        const qSection = document.querySelector('.question-section');
        const oldQuit = document.getElementById('temp-quit-btn');
        if(oldQuit) oldQuit.remove();

        const quitBtn = document.createElement('button');
        quitBtn.id = 'temp-quit-btn';
        quitBtn.textContent = "⏹ Quitter & Sauvegarder";
        quitBtn.className = "mb-4 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded w-full md:w-auto";
        quitBtn.onclick = () => {
            CoreApp.closeFlashcard();
            const toast = document.createElement('div');
            toast.className = 'fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded shadow-lg z-50';
            toast.textContent = "Session sauvegardée dans le bouton Statistiques";
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        };
        qSection.parentNode.insertBefore(quitBtn, qSection);

        let qHtml = '';
        const qImgUrl = CoreApp.buildImageUrl(card.qImage, 'q');

        if (card.question) {
            qHtml += `<p class="text-xl break-words whitespace-pre-wrap">${card.question}</p>`;
        } else if (!qImgUrl) { // Afficher "..." uniquement si ni texte ni image
            qHtml += `<p class="text-xl break-words whitespace-pre-wrap">...</p>`;
        }
        if (qImgUrl) qHtml += `<img src="${qImgUrl}" class="max-w-full h-auto mt-4 rounded shadow-sm mx-auto max-h-60 object-contain" onerror="this.style.display='none'">`;
        document.getElementById('question-content').innerHTML = qHtml;

        let aHtml = '';
        const aImgUrl = CoreApp.buildImageUrl(card.aImage, 'a');

        if (card.answer) {
            aHtml += `<p class="text-xl break-words whitespace-pre-wrap">${card.answer}</p>`;
        } else if (!aImgUrl) { // Afficher "..." uniquement si ni texte ni image
            aHtml += `<p class="text-xl break-words whitespace-pre-wrap">...</p>`;
        }
        if (aImgUrl) aHtml += `<img src="${aImgUrl}" class="max-w-full h-auto mt-4 rounded shadow-sm mx-auto max-h-60 object-contain" onerror="this.style.display='none'">`;
        document.getElementById('answer-content').innerHTML = aHtml;
        
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([
                document.getElementById('question-content'),
                document.getElementById('answer-content')
            ]).catch(() => {});
        }

        // Ajout des écouteurs pour le zoom
        ['question-content', 'answer-content'].forEach(id => {
            const img = document.getElementById(id).querySelector('img');
            if(img) {
                img.classList.add('cursor-zoom-in', 'hover:opacity-90', 'transition-opacity');
                img.title = "Cliquer pour agrandir";
                img.addEventListener('click', (e) => {
                    e.stopPropagation();
                    UI.openZoom(img.src);
                });
            }
        });

        setTimeout(() => document.getElementById('show-answer-btn').focus(), 50);
    },

    handleAnswer: (isCorrect) => {
        const s = APP_STATE.session;
        const cardId = s.cardsQueue[s.currentIndex];
        const card = CoreApp.csvData.find(c => c.id === cardId);
        
        if(card) {
            const oldBox = parseInt(card.box) || 1;
            let newBox = oldBox;
            let cycleComplete = false;

            if(isCorrect) {
                if(newBox < 5) {
                    newBox++;
                } else {
                    // --- CYCLE COMPLET : 5 -> 1 ---
                    newBox = 1;
                    cycleComplete = true;
                    // Incrémenter les stats globales du deck
                    DeckStats.incrementCycle(CoreApp.csvData.filename);
                }
            } else {
                newBox = 1;
            }

            const difficultyInput = document.querySelector('input[name="difficulty"]:checked');
            const difficulty = difficultyInput ? difficultyInput.value : 'normal';

            card.box = newBox;
            card.lastReview = new Date().toISOString(); 
            card.difficulty = difficulty;

            // SAUVEGARDE INTELLIGENTE : Si c'est un mix, on sauvegarde dans le fichier d'origine
            const targetFilename = card.sourceFilename || CoreApp.csvData.filename;
            const targetId = (card.originalId !== undefined) ? card.originalId : cardId;

            CardPersistence.updateCard(targetFilename, targetId, newBox, card.lastReview, difficulty);
            
            const feedback = document.createElement('div');
            feedback.className = `fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-6 py-4 rounded-xl font-bold text-white shadow-2xl z-[100] text-xl flex flex-col items-center gap-2 animate-bounce ${isCorrect ? 'bg-green-600' : 'bg-red-500'}`;
            
            let message = '';
            if (!isCorrect) message = "👎 Retour Boîte 1";
            else if (cycleComplete) message = "🏆 CYCLE VALIDÉ ! (+1)"; // Feedback spécial
            else message = `👍 Boîte ${oldBox} ➔ Boîte ${newBox}`;
            
            feedback.innerHTML = `<span>${message}</span>`;
            
            if (card.sourceFilename) {
                const sourceBadge = document.createElement('div');
                sourceBadge.className = "text-xs font-normal opacity-80 mt-1";
                sourceBadge.textContent = `Source : ${UI.getDomainFromFilename(card.sourceFilename)}`;
                feedback.appendChild(sourceBadge);
            }

            document.body.appendChild(feedback);
            
            setTimeout(() => {
                feedback.style.opacity = '0';
                setTimeout(() => feedback.remove(), 300);
            }, 800);

            CoreApp.renderBoxes();
            CoreApp.persistSessionDeck();
        }
        
        SessionManager.recordResult(isCorrect);
        CoreApp.startReview();
    },

    openEditor: () => {
        if (!APP_STATE.session) return;
        const s = APP_STATE.session;
        const cardId = s.cardsQueue[s.currentIndex];
        const card = CoreApp.csvData.find(c => c.id === cardId);
        if (!card) return;

        const editor = document.getElementById('card-editor');
        if (editor) {
            const title = document.getElementById('editor-title');
            if (title) title.textContent = 'Modifier la carte actuelle';

            document.getElementById('card-id').value = card.id;
            document.getElementById('card-question').value = card.question;
            document.getElementById('card-answer').value = card.answer;
            const qImg = document.getElementById('card-question-image');
            if(qImg) qImg.value = card.qImage || '';
            const aImg = document.getElementById('card-answer-image');
            if(aImg) aImg.value = card.aImage || '';
            
            editor.classList.remove('hidden');
            editor.setAttribute('aria-hidden', 'false');
            document.getElementById('flashcard-container').classList.add('hidden');
        }
    },

    closeEditor: () => {
        document.getElementById('card-editor').classList.add('hidden');
        document.getElementById('card-editor').setAttribute('aria-hidden', 'true');
        document.getElementById('flashcard-container').classList.remove('hidden');
    },

    saveCard: (e) => {
        e.preventDefault();
        const id = parseInt(document.getElementById('card-id').value);
        const card = CoreApp.csvData.find(c => c.id === id);
        if (card) {
            card.question = document.getElementById('card-question').value;
            card.answer = document.getElementById('card-answer').value;
            const qImg = document.getElementById('card-question-image');
            if(qImg) card.qImage = qImg.value;
            const aImg = document.getElementById('card-answer-image');
            if(aImg) card.aImage = aImg.value;
            
            CoreApp.showCardUI(card);
            CoreApp.renderDeckOverview();
            CoreApp.persistSessionDeck();
        }
        CoreApp.closeEditor();
    },

    deleteCard: () => {
        if (!APP_STATE.session) return;
        const s = APP_STATE.session;
        const cardId = s.cardsQueue[s.currentIndex];
        
        if (confirm('Supprimer cette carte ? (Action locale pour la session)')) {
            CoreApp.csvData = CoreApp.csvData.filter(c => c.id !== cardId);
            s.cardsQueue = s.cardsQueue.filter(id => id !== cardId);
            s.totalCards = s.cardsQueue.length;
            
            if (s.currentIndex >= s.totalCards) s.currentIndex = 0;
            
            SessionManager.updateCurrent();
            CoreApp.renderBoxes();
            CoreApp.renderDeckOverview();
            CoreApp.persistSessionDeck();
            
            if (s.totalCards > 0) CoreApp.startReview();
            else {
                CoreApp.closeFlashcard();
                alert('Session vide.');
            }
        }
    },

    resetCurrentDeck: () => {
        if (!CoreApp.csvData || !CoreApp.csvData.filename) return;
        if (!confirm("Réinitialiser ce paquet ?\nToutes les cartes retourneront en Boîte 1.")) return;
        
        CardPersistence.resetDeckState(CoreApp.csvData.filename, CoreApp.csvData);
        CoreApp.renderBoxes();
        CoreApp.renderDeckOverview();
        CoreApp.persistSessionDeck();
        alert("Paquet réinitialisé en Boîte 1.");
    },

    persistSessionDeck: () => {
        if (!CoreApp.csvData || CoreApp.csvData.length === 0) return;
        const cards = CoreApp.csvData.map(c => ({
            question_content: c.question || '',
            question_content_image: c.qImage || '',
            answer_content: c.answer || '',
            answer_content_image: c.aImage || '',
            box_number: String(c.box || 1),
            last_reviewed: (c.lastReview ? c.lastReview.split('T')[0] : new Date().toISOString().split('T')[0])
        }));
        localStorage.setItem('leitner_session_cards', JSON.stringify({
            filename: CoreApp.csvData.filename,
            cards: cards
        }));
    }
};

document.addEventListener('DOMContentLoaded', CoreApp.init);