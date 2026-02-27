const fs = require('fs');
const path = require('path');

// Configuration : le dossier docs est relatif à la racine du projet
const docsDir = __dirname;
const csvSubDir = path.join(docsDir, 'csv');
const outputFile = path.join(docsDir, 'csv-files.json');

console.log(`🔍 Scan des fichiers CSV...`);

let csvFiles = [];

// 2. Scan sous-dossier docs/csv/ (recommandé)
try {
    if (fs.existsSync(csvSubDir)) {
        const subFiles = fs.readdirSync(csvSubDir)
            .filter(f => path.extname(f).toLowerCase() === '.csv')
            .map(f => `csv/${f}`); // Ajoute le préfixe pour que le lien soit correct
        csvFiles = [...csvFiles, ...subFiles];
    }
} catch (e) { console.error("Erreur scan dossier csv/:", e); }

// Écriture du fichier JSON
const jsonContent = JSON.stringify(csvFiles, null, 2);
fs.writeFileSync(outputFile, jsonContent);

console.log(`✅ Succès ! ${csvFiles.length} fichiers CSV indexés dans csv-files.json`);