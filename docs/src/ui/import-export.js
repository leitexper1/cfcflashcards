// =================================================================
// Import / Export avancé – Leitner Codex
// Supporte le chargement d’un CSV distant via ?csv=chemin/fichier.csv
// =================================================================

function escapeCsv(value) {
  if (value == null) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function newCard() {
  return {
    question_content: '',
    question_content_image: '',
    answer_content: '',
    answer_content_image: '',
    box_number: '1',
    last_reviewed: todayIso()
  };
}

// Récupère le paramètre ?csv=... dans l'URL
function getSelectedCsvPath() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('csv');
}

function normaliseLocalImagePath(rawValue = '', type = 'question') {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return '';
  }

  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed;
  }

  let cleaned = trimmed
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '');

  if (cleaned.startsWith('docs/')) {
    cleaned = cleaned.substring(5);
  }

  const isQuestion = type === 'question';
  if (!cleaned.startsWith('images_questions/') && !cleaned.startsWith('images_reponses/')) {
    cleaned = `${isQuestion ? 'images_questions' : 'images_reponses'}/${cleaned}`;
  }

  return cleaned;
}

function updateThumbnail(previewContainer, rawValue, type) {
  if (!previewContainer) {
    return;
  }

  const image = previewContainer.querySelector('img');
  const placeholder = previewContainer.querySelector('.image-thumbnail__placeholder');
  const value = normaliseLocalImagePath(rawValue, type);

  const showPlaceholder = (message = 'Aucune image') => {
    if (image) {
      image.removeAttribute('src');
      image.classList.add('hidden');
      image.onerror = null;
    }
    if (placeholder) {
      placeholder.textContent = message;
      placeholder.classList.remove('hidden');
    }
  };

  if (!value) {
    showPlaceholder();
    return;
  }

  if (image) {
    image.classList.remove('hidden');
    image.onerror = () => {
      showPlaceholder('Image introuvable');
    };
    image.onload = () => {
      if (placeholder) {
        placeholder.classList.add('hidden');
      }
    };
    image.src = value;
  }
}

function parseCsvRows(text) {
  const rows = [];
  let currentField = '';
  let currentRow = [];
  let inQuotes = false;

  // Détection statistique du séparateur sur les 10 premières lignes
  const linesSample = text.split(/\r\n|\n|\r/).slice(0, 10);
  let separator = ',';
  let maxScore = -1;
  
  [';', ','].forEach(sep => {
      // On compte combien de lignes ont une structure (plus d'une colonne) avec ce séparateur
      const score = linesSample.filter(l => l.split(sep).length > 1).length;
      // En cas d'égalité (ex: 0 vs 0 ou 10 vs 10), on privilégie le point-virgule pour le français
      if (score > maxScore || (score === maxScore && sep === ';')) {
          maxScore = score;
          separator = sep;
      }
  });

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === separator && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') {
        i++;
      }
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      continue;
    }

    currentField += char;
  }

  currentRow.push(currentField);
  rows.push(currentRow);

  return rows.filter(row => !(row.length === 1 && row[0].trim() === ''));
}

function parseCsvText(text) {
  const rows = parseCsvRows(text);
  if (!rows.length) {
    throw new Error('Fichier CSV vide.');
  }

  const expectedHeader = [
    'question_content',
    'question_content_image',
    'answer_content',
    'answer_content_image',
    'box_number',
    'last_reviewed'
  ];

  const header = rows[0].map(cell => cell.trim());
  if (header.join(',') !== expectedHeader.join(',') && header.join(';') !== expectedHeader.join(';')) {
    throw new Error('En-tête CSV invalide.');
  }

  const cards = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const values = expectedHeader.map((_, idx) => row[idx] ?? '');

    if (values.every(value => value.trim() === '')) {
      continue;
    }

    cards.push({
      question_content: values[0] || '',
      question_content_image: values[1] || '',
      answer_content: values[2] || '',
      answer_content_image: values[3] || '',
      box_number: values[4] || '1',
      last_reviewed: values[5] || todayIso()
    });
  }

  return cards;
}

// Rendu des cartes
function renderCard(card, index) {
  const section = document.createElement('div');
  section.className = 'card-section';

  const title = document.createElement('h3');
  title.textContent = `Flashcard ${index + 1}`;
  section.appendChild(title);

  const table = document.createElement('table');
  section.appendChild(table);

  const createRow = (label, node) => {
    const row = document.createElement('tr');
    const labelCell = document.createElement('td');
    labelCell.innerHTML = `<strong>${label}</strong>`;
    const fieldCell = document.createElement('td');
    fieldCell.appendChild(node);
    row.append(labelCell, fieldCell);
    table.appendChild(row);
  };

  const questionTextarea = document.createElement('textarea');
  questionTextarea.rows = 3;
  questionTextarea.dataset.field = 'question_content';
  questionTextarea.value = card.question_content;
  createRow('Question', questionTextarea);

  const questionImageField = document.createElement('div');
  questionImageField.className = 'image-field';

  const qInputGroup = document.createElement('div');
  qInputGroup.style.display = 'flex';
  qInputGroup.style.gap = '5px';

  const questionImageInput = document.createElement('input');
  questionImageInput.type = 'text';
  questionImageInput.dataset.field = 'question_content_image';
  questionImageInput.dataset.imageType = 'question';
  questionImageInput.placeholder = 'images_questions/mon-image.jpg';
  questionImageInput.value = card.question_content_image;

  const qBrowseBtn = document.createElement('button');
  qBrowseBtn.type = 'button';
  qBrowseBtn.className = 'browse-btn';
  qBrowseBtn.textContent = '📁';
  qBrowseBtn.title = 'Parcourir les fichiers...';

  const qFileHidden = document.createElement('input');
  qFileHidden.type = 'file';
  qFileHidden.accept = 'image/*';
  qFileHidden.className = 'hidden';

  qInputGroup.append(questionImageInput, qBrowseBtn, qFileHidden);
  questionImageField.appendChild(qInputGroup);

  const questionThumbnail = document.createElement('div');
  questionThumbnail.className = 'image-thumbnail';
  questionThumbnail.title = 'Ouvrir l’image de la question dans un nouveau bouton';
  questionThumbnail.tabIndex = 0;
  questionThumbnail.setAttribute('role', 'button');
  questionThumbnail.setAttribute('aria-label', 'Afficher l’image de la question dans un nouveau bouton');
  const questionImg = document.createElement('img');
  questionImg.alt = 'Miniature question';
  questionImg.loading = 'lazy';
  questionImg.classList.add('hidden');
  questionThumbnail.appendChild(questionImg);
  const questionPlaceholder = document.createElement('span');
  questionPlaceholder.className = 'image-thumbnail__placeholder';
  questionPlaceholder.textContent = 'Aucune image';
  questionThumbnail.appendChild(questionPlaceholder);
  questionImageField.appendChild(questionThumbnail);
  createRow('Image question', questionImageField);

  const answerTextarea = document.createElement('textarea');
  answerTextarea.rows = 3;
  answerTextarea.dataset.field = 'answer_content';
  answerTextarea.value = card.answer_content;
  createRow('Réponse', answerTextarea);

  const answerImageField = document.createElement('div');
  answerImageField.className = 'image-field';

  const aInputGroup = document.createElement('div');
  aInputGroup.style.display = 'flex';
  aInputGroup.style.gap = '5px';

  const answerImageInput = document.createElement('input');
  answerImageInput.type = 'text';
  answerImageInput.dataset.field = 'answer_content_image';
  answerImageInput.dataset.imageType = 'answer';
  answerImageInput.placeholder = 'images_reponses/mon-image.jpg';
  answerImageInput.value = card.answer_content_image;

  const aBrowseBtn = document.createElement('button');
  aBrowseBtn.type = 'button';
  aBrowseBtn.className = 'browse-btn';
  aBrowseBtn.textContent = '📁';
  aBrowseBtn.title = 'Parcourir les fichiers...';

  const aFileHidden = document.createElement('input');
  aFileHidden.type = 'file';
  aFileHidden.accept = 'image/*';
  aFileHidden.className = 'hidden';

  aInputGroup.append(answerImageInput, aBrowseBtn, aFileHidden);
  answerImageField.appendChild(aInputGroup);

  const answerThumbnail = document.createElement('div');
  answerThumbnail.className = 'image-thumbnail';
  answerThumbnail.title = 'Ouvrir l’image de la réponse dans un nouveau bouton';
  answerThumbnail.tabIndex = 0;
  answerThumbnail.setAttribute('role', 'button');
  answerThumbnail.setAttribute('aria-label', 'Afficher l’image de la réponse dans un nouveau bouton');
  const answerImg = document.createElement('img');
  answerImg.alt = 'Miniature réponse';
  answerImg.loading = 'lazy';
  answerImg.classList.add('hidden');
  answerThumbnail.appendChild(answerImg);
  const answerPlaceholder = document.createElement('span');
  answerPlaceholder.className = 'image-thumbnail__placeholder';
  answerPlaceholder.textContent = 'Aucune image';
  answerThumbnail.appendChild(answerPlaceholder);
  answerImageField.appendChild(answerThumbnail);
  createRow('Image réponse', answerImageField);

  const boxInput = document.createElement('input');
  boxInput.type = 'number';
  boxInput.min = '1';
  boxInput.step = '1';
  boxInput.dataset.field = 'box_number';
  boxInput.value = card.box_number;
  createRow('Boîte (box_number)', boxInput);

  const lastReviewedInput = document.createElement('input');
  lastReviewedInput.type = 'date';
  lastReviewedInput.dataset.field = 'last_reviewed';
  lastReviewedInput.value = card.last_reviewed;
  createRow('Dernière révision (last_reviewed)', lastReviewedInput);

  const persistCards = () => {
    localStorage.setItem('leitnerCards', JSON.stringify(cards));
  };

  // Gestionnaires pour les sélecteurs de fichiers
  qBrowseBtn.onclick = () => qFileHidden.click();
  qFileHidden.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      questionImageInput.value = `images_questions/${file.name}`;
      questionImageInput.dispatchEvent(new Event('input'));
    }
  };

  aBrowseBtn.onclick = () => aFileHidden.click();
  aFileHidden.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      answerImageInput.value = `images_reponses/${file.name}`;
      answerImageInput.dispatchEvent(new Event('input'));
    }
  };

  section.querySelectorAll('[data-field]').forEach(el => {
    const field = el.dataset.field;
    el.addEventListener('input', () => {
      cards[index][field] = el.value;
      if (el.dataset.imageType) {
        const preview = el.closest('.image-field')?.querySelector('.image-thumbnail');
        updateThumbnail(preview, el.value, el.dataset.imageType);
      }
      persistCards();
    });
  });

  updateThumbnail(questionThumbnail, card.question_content_image, 'question');
  updateThumbnail(answerThumbnail, card.answer_content_image, 'answer');

  [questionThumbnail, answerThumbnail].forEach((thumb) => {
    if (!thumb) {
      return;
    }
    const openPreview = () => {
      const img = thumb.querySelector('img');
      if (img?.src) {
        window.open(img.src, '_blank', 'noopener');
      }
    };
    thumb.addEventListener('click', openPreview);
    thumb.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPreview();
      }
    });
  });

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'delete card-section__delete';
  deleteButton.dataset.index = index;
  deleteButton.textContent = '🗑️ Supprimer cette carte';
  deleteButton.addEventListener('click', () => {
    cards.splice(index, 1);
    if (!cards.length) {
      cards.push(newCard());
    }
    renderAllCards();
  });

  section.appendChild(deleteButton);
  section.appendChild(document.createElement('hr'));

  return section;
}

function renderAllCards() {
  const container = document.getElementById('cardsContainer');
  container.innerHTML = '';
  cards.forEach((card, i) => container.appendChild(renderCard(card, i)));
  localStorage.setItem('leitnerCards', JSON.stringify(cards));
}

let cards = [];

// === Initialisation principale ===
  async function init() {
  const csvPath = getSelectedCsvPath();
  const sessionRaw = localStorage.getItem('leitner_session_cards');
  let sessionData = null;

  if (sessionRaw) {
    try {
      sessionData = JSON.parse(sessionRaw);
    } catch (e) {
      console.error("Erreur de lecture de la session locale", e);
    }
  }

  // Priorité absolue : Si une session locale existe et correspond au fichier (ou si aucun fichier n'est spécifié)
  if (sessionData && sessionData.cards && (!csvPath || csvPath.includes(sessionData.filename))) {
    cards = sessionData.cards;
    console.log("Données chargées depuis la session active (LocalStorage)");
  } else if (csvPath) {
    try {
        // Résoudre le chemin CSV en une URL absolue.
        // Ceci est crucial pour le protocole file:// où les requêtes fetch relatives peuvent être restreintes.
        const resolvedCsvPath = new URL(csvPath, window.location.href).href;
        const response = await fetch(resolvedCsvPath);
      if (!response.ok) throw new Error(`Fichier distant non trouvé : ${csvPath}`);
      const text = await response.text();
      const normalised = text.replace(/^\uFEFF/, '');
      cards = parseCsvText(normalised);
      if (!cards.length) {
        cards = [newCard()];
      }
    } catch (err) {
      console.error('Erreur chargement CSV distant :', err);
      alert('⚠️ Impossible de charger le fichier distant :\n' + err.message + '\n\nUtilisation du stockage local de secours.');
      cards = (sessionData && sessionData.cards) ? sessionData.cards : (JSON.parse(localStorage.getItem('leitnerCards')) || [newCard()]);
    }
  } else {
    // Aucun fichier spécifié et aucune session active -> fallback sur le stockage historique de l'éditeur
    cards = JSON.parse(localStorage.getItem('leitnerCards')) || [newCard()];
  }

  renderAllCards();
}

// === Écouteurs dynamiques ===
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('addCard')?.addEventListener('click', () => {
    cards.push(newCard());
    renderAllCards();
  });

  document.getElementById('exportBtn')?.addEventListener('click', () => {
    const header = [
      'question_content',
      'question_content_image',
      'answer_content',
      'answer_content_image',
      'box_number',
      'last_reviewed'
    ].join(',');
    // Note: Ici on garde la virgule pour l'export "legacy" de cette page spécifique, ou on peut changer pour ';'
    const rows = cards.map(c =>
      [
        escapeCsv(c.question_content),
        escapeCsv(c.question_content_image),
        escapeCsv(c.answer_content),
        escapeCsv(c.answer_content_image),
        escapeCsv(c.box_number),
        escapeCsv(c.last_reviewed)
      ].join(';') // Changement ici pour utiliser le point-virgule
    );

    const csvContent = [header.replace(/,/g, ';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flashcards_leitner.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  document.getElementById('importBtn')?.addEventListener('click', () => {
    const fileInput = document.getElementById('importCsv');
    const file = fileInput.files[0];
    if (!file) {
      alert('Veuillez sélectionner un fichier CSV.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = (e.target.result || '').toString().replace(/^\uFEFF/, '');
        cards = parseCsvText(text);
        if (!cards.length) {
          cards = [newCard()];
        }
        renderAllCards();
        alert(`✅ ${cards.length} carte(s) importée(s).`);
      } catch (err) {
        console.error(err);
        alert('❌ Erreur d’import CSV :\n' + err.message);
      }
    };
    reader.readAsText(file, 'utf-8');
  });

  // Lance l'initialisation
  init();
});