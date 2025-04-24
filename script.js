// --- Variabili Globali ---
let loadedDrugData = [];
let currentlyDisplayedData = [];
let currentSortColumn = null;
let currentSortDirection = 'asc';
let lastFilterType = 'all';

// --- Definizioni delle Funzioni ---

function handleFileSelect(event) {
    const file = event.target.files[0];
    // Otteniamo riferimenti DOM necessari per il reset
    const statusMessage = document.getElementById('statusMessage');
    const interactionArea = document.getElementById('interactionArea');
    const notFoundMessageArea = document.getElementById('notFoundMessageArea');
    const resultsTableBody = document.getElementById('resultsTableBody');
    const fileInput = document.getElementById('csvFileInput');
    const exportCsvButton = document.getElementById('exportCsvButton');

    // Reset stato interfaccia e dati
    if (statusMessage) { statusMessage.textContent = 'Nessun file selezionato.'; statusMessage.className = ''; }
    if (interactionArea) interactionArea.style.display = 'none';
    if (notFoundMessageArea) notFoundMessageArea.style.display = 'none';
    if (resultsTableBody) resultsTableBody.innerHTML = '';
    loadedDrugData = []; currentlyDisplayedData = [];
    clearLocationFilter(); // Chiama la funzione definita sotto
    currentSortColumn = null; currentSortDirection = 'asc';
    updateSortIndicators(); // Chiama la funzione definita sotto
    if(exportCsvButton) exportCsvButton.style.display = 'none';

    if (!file) { return; } // Esce se non c'è file

    // Controllo tipo file
    if (file.type && !file.type.match('text/csv') && !file.name.toLowerCase().endsWith('.csv') ) {
         if (statusMessage) { statusMessage.textContent = 'Errore: Seleziona un file .csv!'; statusMessage.className = 'error'; }
         if(fileInput) fileInput.value = ''; return;
     }

    if (statusMessage) { statusMessage.textContent = 'Caricamento file...'; statusMessage.className = ''; }
    const reader = new FileReader();

    reader.onload = function(e) {
        const csvContent = e.target.result;
        try {
            // Chiamata diretta a parseCSV
            loadedDrugData = parseCSV(csvContent);

            // Controllo robusto: parseCSV ora DOVREBBE sempre tornare un array
            if (Array.isArray(loadedDrugData)) {
                 // Successo: aggiorna stato e interfaccia
                 if (statusMessage) { statusMessage.textContent = `File "${file.name}" caricato (${loadedDrugData.length} righe).`; statusMessage.className = 'success'; }
                 if (interactionArea) interactionArea.style.display = 'block'; // Mostra area interazione
                 if (resultsTableBody) resultsTableBody.innerHTML = ''; // Pulisce tabella
                 if (notFoundMessageArea) notFoundMessageArea.style.display = 'none'; // Nasconde area messaggi
                 const searchInput = document.getElementById('searchInput'); if (searchInput) searchInput.value = '';
                 currentSortColumn = null; currentSortDirection = 'asc'; // Resetta ordinamento
                 updateSortIndicators(); // Aggiorna indicatori
                 populateLocationFilter(loadedDrugData); // Popola filtro location
            } else {
                 // Questo non dovrebbe succedere se parseCSV è corretto
                 throw new Error("parseCSV non ha restituito un array.");
            }

        } catch (error) { // Cattura errori da parseCSV o dal throw sopra
             console.error("!!! Errore durante l'elaborazione del file:", error); // Log errore principale
             if (statusMessage) { statusMessage.textContent = `Errore durante la lettura: ${error.message}`; statusMessage.className = 'error'; }
             // Reset interfaccia e stato
             if (interactionArea) interactionArea.style.display = 'none';
             if (notFoundMessageArea) notFoundMessageArea.style.display = 'none';
             loadedDrugData = []; currentlyDisplayedData = []; clearLocationFilter(); currentSortColumn = null; currentSortDirection = 'asc'; updateSortIndicators();
             if (exportCsvButton) exportCsvButton.style.display = 'none';
             if (fileInput) fileInput.value = '';
        }
    }; // Chiusura reader.onload

    reader.onerror = function(e) {
         console.error("Errore FileReader:", e);
         if (statusMessage) { statusMessage.textContent = 'Errore imprevisto durante la lettura del file.'; statusMessage.className = 'error'; }
         if (interactionArea) interactionArea.style.display = 'none'; if (notFoundMessageArea) notFoundMessageArea.style.display = 'none';
         loadedDrugData = []; currentlyDisplayedData = []; clearLocationFilter(); currentSortColumn = null; currentSortDirection = 'asc'; updateSortIndicators();
         if (exportCsvButton) exportCsvButton.style.display = 'none'; if (fileInput) fileInput.value = '';
     }; // Chiusura reader.onerror

    // Legge il file (proviamo ancora con windows-1252, altrimenti cambiare in 'utf-8')
    reader.readAsText(file, 'windows-1252');
} // Chiusura handleFileSelect


// Elabora il testo CSV --- MODIFICATO: Rimosso try/catch interno, garantisce return [] ---
function parseCSV(csvText) {
    const data = []; // Inizializza SEMPRE come array vuoto
    if (!csvText) {
        console.warn("[parseCSV] Input CSV vuoto o nullo.");
        return data; // Restituisce array vuoto
    }

    const lines = csvText.split(/\r?\n/);
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') { lines.pop(); }

    if (lines.length < 2) {
        // Potremmo restituire [] o lanciare errore. Lanciamo errore.
        throw new Error("Il file CSV non contiene almeno una riga di intestazione e una di dati.");
    }

    const headerLine = lines[0];
    const headers = headerLine.split(';').map(h => h.trim().toLowerCase());

    if (!headers || !Array.isArray(headers) || headers.length === 0 || headers.every(h => h === '')) {
         throw new Error("Formato intestazione CSV non valido.");
    }

    const idx = { c: headers.indexOf("codice aic"), n: headers.indexOf("denominazione"), q: headers.indexOf("qta"), u: headers.indexOf("ubicazione"), s: headers.indexOf("scadenza") };
    let missingColumns = [];
    if (idx.c === -1) missingColumns.push('"codice aic"'); if (idx.n === -1) missingColumns.push('"denominazione"'); if (idx.q === -1) missingColumns.push('"qta"'); if (idx.u === -1) missingColumns.push('"ubicazione"'); if (idx.s === -1) missingColumns.push('"scadenza"');
    if (missingColumns.length > 0) {
        throw new Error(`Intestazioni CSV non trovate: ${missingColumns.join(', ')}.`);
    }

    for (let i = 1; i < lines.length; i++) {
        try { // Try per singola riga per maggiore robustezza? Opzionale.
            const line = lines[i];
            if (line === undefined || line === null || line.trim() === '') continue;

            const cols = line.split(';').map(col => col.trim());

            const codice = cols[idx.c] || ''; const nome = cols[idx.n] || '';
            const disponibilita = cols[idx.q] || ''; const posizione = cols[idx.u] || '';
            const scadenzaRaw = cols[idx.s] || ''; let scadenzaFormatted = '';

            if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(scadenzaRaw)) { const p=scadenzaRaw.split('/'); scadenzaFormatted = `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`; }
            else if (/^\d{4}-\d{2}-\d{2}$/.test(scadenzaRaw)) { scadenzaFormatted = scadenzaRaw; }
            else { scadenzaFormatted = scadenzaRaw; }

            data.push({ codice, nome, disponibilita, posizione, scadenza: scadenzaFormatted });
        } catch (lineError) {
            console.warn(`[parseCSV] Errore nell'elaborazione della riga ${i+1}: "${lines[i]}". Errore: ${lineError.message}. Riga saltata.`);
            // Continua con la riga successiva invece di bloccare tutto
            continue;
        }
    } // Chiusura for loop

    return data; // Restituisce l'array (che è stato inizializzato come [])
} // Chiusura parseCSV


function populateLocationFilter(data) {
     const locationFilterSelect = document.getElementById('locationFilter');
     if (!locationFilterSelect) return;
    while (locationFilterSelect.options.length > 1) { locationFilterSelect.remove(1); }
    const locations = [...new Set(data.map(item => item.posizione).filter(pos => pos))]
                      .sort((a, b) => a.localeCompare(b));
    locations.forEach(loc => { const opt = document.createElement('option'); opt.value = loc; opt.textContent = loc; locationFilterSelect.appendChild(opt); });
    locationFilterSelect.value = "";
} // Chiusura populateLocationFilter

function clearLocationFilter() {
     const locationFilterSelect = document.getElementById('locationFilter');
     if (!locationFilterSelect) return;
     while (locationFilterSelect.options.length > 1) { locationFilterSelect.remove(1); }
     locationFilterSelect.value = "";
} // Chiusura clearLocationFilter

function filterData() {
     const searchInput = document.getElementById('searchInput');
     const locationFilterSelect = document.getElementById('locationFilter');
     if (!loadedDrugData || loadedDrugData.length === 0) return [];
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const selectedLocation = locationFilterSelect ? locationFilterSelect.value : "";
    let filtered = loadedDrugData;
    if (selectedLocation) { filtered = filtered.filter(drug => drug.posizione === selectedLocation); }
    if (searchTerm) { filtered = filtered.filter(drug => (drug.codice && String(drug.codice).toLowerCase() === searchTerm) || (drug.nome && drug.nome.toLowerCase().includes(searchTerm))); }
    return filtered;
} // Chiusura filterData

function handleHeaderClick(event) {
    const targetHeader = event.target.closest('th');
    if (!targetHeader || !targetHeader.dataset.column) { return; }
    const column = targetHeader.dataset.column;
    if (currentSortColumn === column) { currentSortDirection = (currentSortDirection === 'asc') ? 'desc' : 'asc'; }
    else { currentSortColumn = column; currentSortDirection = 'asc'; }
    sortAndDisplayData();
} // Chiusura handleHeaderClick

function sortAndDisplayData() {
    const resultsTableBody = document.getElementById('resultsTableBody');
    if (!resultsTableBody) return;
    if (!currentlyDisplayedData || currentlyDisplayedData.length === 0) { resultsTableBody.innerHTML = ''; return; }
    sortData(currentlyDisplayedData, currentSortColumn, currentSortDirection);
    updateSortIndicators();
    displayResults(currentlyDisplayedData, "Nessun dato da visualizzare.", getCurrentHighlightOptions());
} // Chiusura sortAndDisplayData

function sortData(dataArray, column, direction) {
    if (!column) return;
    dataArray.sort((a, b) => {
        let valA = a[column]; let valB = b[column]; let comparison = 0;
        if (column === 'scadenza') { const dateA = parseDateForSort(valA); const dateB = parseDateForSort(valB); if (dateA === null && dateB === null) comparison = 0; else if (dateA === null) comparison = 1; else if (dateB === null) comparison = -1; else comparison = dateA - dateB; }
        else if (column === 'disponibilita') { const numA = parseInt(valA, 10); const numB = parseInt(valB, 10); if (isNaN(numA) && isNaN(numB)) comparison = 0; else if (isNaN(numA)) comparison = 1; else if (isNaN(numB)) comparison = -1; else comparison = numA - numB; }
        else { valA = String(valA || ''); valB = String(valB || ''); comparison = valA.localeCompare(valB, 'it', { sensitivity: 'base' }); }
        return (direction === 'asc') ? comparison : (comparison * -1);
    });
} // Chiusura sortData

function parseDateForSort(dateString) {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null;
    try { const parts = dateString.split('-'); const dateObj = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))); if (isNaN(dateObj.getTime()) || dateObj.getUTCFullYear() != parts[0] || dateObj.getUTCMonth() + 1 != parts[1] || dateObj.getUTCDate() != parts[2]) return null; return dateObj.getTime(); }
    catch (e) { return null; }
} // Chiusura parseDateForSort

function updateSortIndicators() {
     const tableHeader = document.querySelector('#resultsTable thead');
     if (!tableHeader) return;
    const headers = tableHeader.querySelectorAll('th[data-column]');
    headers.forEach(th => { const column = th.dataset.column; th.classList.remove('sort-asc', 'sort-desc'); if (column === currentSortColumn) { th.classList.add(currentSortDirection === 'asc' ? 'sort-asc' : 'sort-desc'); } });
} // Chiusura updateSortIndicators

function getCurrentHighlightOptions() { if (lastFilterType === 'expiry') return { highlight: 'expiry' }; if (lastFilterType === 'stock') return { highlight: 'stock' }; return {}; }

function handleTableActions(event) {
    const target = event.target; const row = target.closest('tr'); if (!row) return;
    const expiryCell = row.querySelector('td:nth-child(5)'); if (!expiryCell) return;
    const codice = row.dataset.codice; const exportCsvButton = document.getElementById('exportCsvButton');
    if (target.classList.contains('edit-btn')) { const currentExpiry = expiryCell.dataset.originalValue || ''; expiryCell.innerHTML = `<input type="date" class="edit-input-date" value="${currentExpiry}"><button class="save-btn" data-codice="${codice}">Salva</button><button class="cancel-btn">Annulla</button>`; const actionCell = row.querySelector('td:last-child'); const editButton = actionCell.querySelector('.edit-btn'); if (editButton) editButton.style.display = 'none'; }
    else if (target.classList.contains('save-btn')) { const inputDate = expiryCell.querySelector('.edit-input-date'); const newExpiry = inputDate.value; const dataIndex = loadedDrugData.findIndex(item => item.codice === codice); if (dataIndex !== -1 && newExpiry && /^\d{4}-\d{2}-\d{2}$/.test(newExpiry)) { loadedDrugData[dataIndex].scadenza = newExpiry; console.log(`Scadenza aggiornata per ${codice} a ${newExpiry}`); let refreshedData; if (lastFilterType === 'search') refreshedData = filterData(); else if (lastFilterType === 'all') refreshedData = filterData(); else if (lastFilterType === 'expiry') { const locFiltered = filterData(); const today=new Date();today.setUTCHours(0,0,0,0);const oneMonthLater=new Date(today);oneMonthLater.setUTCMonth(today.getUTCMonth()+1); refreshedData = locFiltered.filter(drug => { const expTs=parseDateForSort(drug.scadenza); return expTs !== null && expTs >= today.getTime() && expTs <= oneMonthLater.getTime(); }); } else if (lastFilterType === 'stock') { const locFiltered = filterData(); refreshedData = locFiltered.filter(drug => drug.disponibilita === "0"); } else { refreshedData = filterData(); } currentlyDisplayedData = refreshedData; sortAndDisplayData(); if (exportCsvButton) exportCsvButton.style.display = 'inline-block'; } else { console.error("Errore nel salvare: indice/formato data", {codice, dataIndex, newExpiry}); sortAndDisplayData(); } }
    else if (target.classList.contains('cancel-btn')) { sortAndDisplayData(); }
} // Chiusura handleTableActions

function handleExportCSV() {
    if (loadedDrugData.length === 0) { alert("Nessun dato da esportare."); return; }
    const headers = ["codice aic", "denominazione", "qta", "ubicazione", "scadenza"]; let csvString = headers.join(';') + '\r\n';
    loadedDrugData.forEach(item => { const scadenzaOutput = formatDate(item.scadenza); const codice = escapeCsvField(item.codice || ''); const nome = escapeCsvField(item.nome || ''); const disponibilita = escapeCsvField(item.disponibilita || ''); const posizione = escapeCsvField(item.posizione || ''); const scadenza = escapeCsvField(scadenzaOutput); csvString += `${codice};${nome};${disponibilita};${posizione};${scadenza}\r\n`; });
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a");
    if (link.download !== undefined) { const url = URL.createObjectURL(blob); link.setAttribute("href", url); link.setAttribute("download", "inventario_aggiornato.csv"); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); }
    else { alert("Esportazione CSV non supportata."); }
} // Chiusura handleExportCSV

function escapeCsvField(field) { if (/[";\n\r]/.test(field)) { return '"' + field.replace(/"/g, '""') + '"'; } return field; }

function displayResults(drugArray, notFoundMessage, options = {}) {
     const resultsTableBody = document.getElementById('resultsTableBody'); if (!resultsTableBody) return; resultsTableBody.innerHTML = '';
    if (drugArray && drugArray.length > 0) {
        drugArray.forEach((drug, index) => { const tr = document.createElement('tr'); tr.dataset.codice = drug.codice || `generated_${index}`; const tdNome=document.createElement('td'); tdNome.textContent=drug.nome||'N/D'; tr.appendChild(tdNome); const tdCodice=document.createElement('td'); tdCodice.textContent=drug.codice||'N/D'; tr.appendChild(tdCodice); const tdDisp=document.createElement('td'); const stockValue=drug.disponibilita||'N/D'; if(options.highlight==='stock'&&stockValue==="0"){const span=document.createElement('span'); span.className='zero-stock'; span.textContent=stockValue; tdDisp.appendChild(span);} else{tdDisp.textContent=stockValue;} tr.appendChild(tdDisp); const tdPos=document.createElement('td'); tdPos.textContent=drug.posizione||'N/D'; tr.appendChild(tdPos); const tdScad=document.createElement('td'); const formattedDate=formatDate(drug.scadenza); tdScad.dataset.originalValue = drug.scadenza || ''; if(options.highlight==='expiry'){const span=document.createElement('span'); span.className='expired-date'; span.textContent=formattedDate; tdScad.appendChild(span);} else{tdScad.textContent=formattedDate;} tr.appendChild(tdScad); const tdAzioni = document.createElement('td'); tdAzioni.innerHTML = `<button class="edit-btn" data-codice="${drug.codice || ''}">Modifica</button>`; tr.appendChild(tdAzioni); resultsTableBody.appendChild(tr); });
    }
} // Chiusura displayResults

function formatDate(dateString) {
    if (!dateString || dateString === '-' || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) { return dateString; }
    try { const parts = dateString.split('-'); const year = parseInt(parts[0], 10); const month = parseInt(parts[1], 10); const day = parseInt(parts[2], 10); if (month < 1 || month > 12 || day < 1 || day > 31) { return dateString; } const dateObj = new Date(year, month - 1, day); if (isNaN(dateObj.getTime()) || dateObj.getFullYear() !== year || (dateObj.getMonth() + 1) !== month || dateObj.getDate() !== day) { return dateString; } const formattedDay = String(day).padStart(2, '0'); const formattedMonth = String(month).padStart(2, '0'); return `${formattedDay}/${formattedMonth}/${year}`;
    } catch (e) { return dateString; }
} // Chiusura formatDate

// --- Funzioni Azioni Pulsanti (devono essere definite *prima* di DOMContentLoaded se non si usa const/let) ---
// Siccome usiamo const/let per i riferimenti DOM dentro DOMContentLoaded,
// le funzioni che li usano internamente DEVONO essere definite prima o passate come callback.
// Qui sono definite prima, e ottengono i riferimenti DOM al loro interno o usano variabili globali.
function searchDrug() {
    const resultsTableBody = document.getElementById('resultsTableBody'); const notFoundMessageArea = document.getElementById('notFoundMessageArea'); const searchInput = document.getElementById('searchInput'); const locationFilterSelect = document.getElementById('locationFilter');
    if (!resultsTableBody || !notFoundMessageArea) return;
    resultsTableBody.innerHTML = ''; notFoundMessageArea.style.display = 'none';
    if (loadedDrugData.length === 0) { notFoundMessageArea.textContent = 'Carica prima un file CSV.'; notFoundMessageArea.style.display = 'block'; return; }
    const searchTerm = searchInput ? searchInput.value.trim() : ""; if (!searchTerm) { notFoundMessageArea.textContent = 'Inserisci un termine di ricerca.'; notFoundMessageArea.style.display = 'block'; return; }
    currentlyDisplayedData = filterData(); lastFilterType = 'search';
    sortAndDisplayData();
    if (currentlyDisplayedData.length === 0) { const locationValue = locationFilterSelect ? locationFilterSelect.value : ""; const locationMsg = locationValue ? ` per "${locationValue}"` : ""; notFoundMessageArea.textContent = `Nessun farmaco trovato per "${searchTerm}"${locationMsg}.`; notFoundMessageArea.style.display = 'block'; }
}

function displayAllDrugs() {
    const resultsTableBody = document.getElementById('resultsTableBody'); const notFoundMessageArea = document.getElementById('notFoundMessageArea'); const searchInput = document.getElementById('searchInput'); const locationFilterSelect = document.getElementById('locationFilter');
    if (!resultsTableBody || !notFoundMessageArea) return;
    resultsTableBody.innerHTML = ''; notFoundMessageArea.style.display = 'none'; if(searchInput) searchInput.value = '';
    if (loadedDrugData.length === 0) { notFoundMessageArea.textContent = 'Carica prima un file CSV.'; notFoundMessageArea.style.display = 'block'; return; }
    currentlyDisplayedData = filterData(); lastFilterType = 'all';
    sortAndDisplayData();
    if (currentlyDisplayedData.length === 0) { const locationValue = locationFilterSelect ? locationFilterSelect.value : ""; const locationMsg = locationValue ? ` per "${locationValue}"` : ""; notFoundMessageArea.textContent = `Nessun dato caricato${locationMsg}.`; notFoundMessageArea.style.display = 'block'; }
}

function checkExpiringDrugs() {
    const resultsTableBody = document.getElementById('resultsTableBody'); const notFoundMessageArea = document.getElementById('notFoundMessageArea'); const searchInput = document.getElementById('searchInput'); const locationFilterSelect = document.getElementById('locationFilter');
    if (!resultsTableBody || !notFoundMessageArea) return;
    resultsTableBody.innerHTML = ''; notFoundMessageArea.style.display = 'none'; if(searchInput) searchInput.value = '';
    if (loadedDrugData.length === 0) { notFoundMessageArea.textContent = 'Carica prima un file CSV.'; notFoundMessageArea.style.display = 'block'; return; }
    const locationFilteredData = filterData(); const today = new Date(); today.setUTCHours(0, 0, 0, 0); const oneMonthLater = new Date(today); oneMonthLater.setUTCMonth(today.getUTCMonth() + 1);
    currentlyDisplayedData = locationFilteredData.filter(drug => { const expTs = parseDateForSort(drug.scadenza); return expTs !== null && expTs >= today.getTime() && expTs <= oneMonthLater.getTime(); });
    lastFilterType = 'expiry';
    sortAndDisplayData();
    if (currentlyDisplayedData.length === 0) { const locationValue = locationFilterSelect ? locationFilterSelect.value : ""; const locationMsg = locationValue ? ` per "${locationValue}"` : ""; notFoundMessageArea.textContent = `Nessun prodotto in scadenza entro un mese${locationMsg}.`; notFoundMessageArea.style.display = 'block'; }
}

function checkZeroStock() {
    const resultsTableBody = document.getElementById('resultsTableBody'); const notFoundMessageArea = document.getElementById('notFoundMessageArea'); const searchInput = document.getElementById('searchInput'); const locationFilterSelect = document.getElementById('locationFilter');
    if (!resultsTableBody || !notFoundMessageArea) return;
    resultsTableBody.innerHTML = ''; notFoundMessageArea.style.display = 'none'; if(searchInput) searchInput.value = '';
    if (loadedDrugData.length === 0) { notFoundMessageArea.textContent = 'Carica prima un file CSV.'; notFoundMessageArea.style.display = 'block'; return; }
    const locationFilteredData = filterData();
    currentlyDisplayedData = locationFilteredData.filter(drug => drug.disponibilita === "0");
    lastFilterType = 'stock';
    sortAndDisplayData();
    if (currentlyDisplayedData.length === 0) { const locationValue = locationFilterSelect ? locationFilterSelect.value : ""; const locationMsg = locationValue ? ` per "${locationValue}"` : ""; notFoundMessageArea.textContent = `Nessun prodotto con giacenza zero trovato${locationMsg}.`; notFoundMessageArea.style.display = 'block'; }
}


// --- Esecuzione Codice e Assegnazione Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded: Evento scattato."); // Log inizio DOMContentLoaded

    // Otteniamo i riferimenti agli elementi DOM
    const fileInputElem = document.getElementById('csvFileInput');
    const searchButtonElem = document.getElementById('searchButton');
    const showAllButtonElem = document.getElementById('showAllButton');
    const checkExpiryButtonElem = document.getElementById('checkExpiryButton'); // Definizione
    const checkStockButtonElem = document.getElementById('checkStockButton');
    const tableHeaderElem = document.querySelector('#resultsTable thead');
    const searchInputElem = document.getElementById('searchInput');
    const resultsTableBodyElem = document.getElementById('resultsTableBody');
    const exportCsvButtonElem = document.getElementById('exportCsvButton');

    // Verifica elementi e log se non trovati
    if (!fileInputElem) console.warn("Elemento #csvFileInput NON trovato!");
    if (!searchButtonElem) console.warn("Elemento #searchButton NON trovato!");
    if (!showAllButtonElem) console.warn("Elemento #showAllButton NON trovato!");
    if (!checkExpiryButtonElem) console.warn("Elemento #checkExpiryButton NON trovato!"); // Aggiunto Warning
    if (!checkStockButtonElem) console.warn("Elemento #checkStockButton NON trovato!");
    if (!tableHeaderElem) console.warn("Elemento thead NON trovato!");
    if (!searchInputElem) console.warn("Elemento #searchInput NON trovato!");
    if (!resultsTableBodyElem) console.warn("Elemento #resultsTableBody NON trovato!");
    if (!exportCsvButtonElem) console.warn("Elemento #exportCsvButton NON trovato!");


    // Aggiungiamo i listener solo se gli elementi esistono
    if (fileInputElem) { fileInputElem.addEventListener('change', handleFileSelect, false); }
    if (searchButtonElem) { searchButtonElem.addEventListener('click', searchDrug); }
    if (showAllButtonElem) { showAllButtonElem.addEventListener('click', displayAllDrugs); }
    if (checkExpiryButtonElem) { checkExpiryButtonElem.addEventListener('click', checkExpiringDrugs); } // Uso corretto
    if (checkStockButtonElem) { checkStockButtonElem.addEventListener('click', checkZeroStock); }
    if (tableHeaderElem) { tableHeaderElem.addEventListener('click', handleHeaderClick); }
    if (searchInputElem) { searchInputElem.addEventListener('keypress', function(event) { if (event.key === 'Enter') { event.preventDefault(); searchDrug(); } }); }
    if (resultsTableBodyElem) { resultsTableBodyElem.addEventListener('click', handleTableActions); }
    if (exportCsvButtonElem) { exportCsvButtonElem.addEventListener('click', handleExportCSV); }

    console.log("App inizializzata e listener aggiunti (o tentato di aggiungere).");

}); // Fine DOMContentLoaded listener