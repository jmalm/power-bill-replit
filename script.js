// Global variables
let csvData = null;
let availableModels = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    loadPriceModels();
    setupEventListeners();
    loadSavedConfiguration();
});

// Initialize application state
function initializeApp() {
    // Initialize with default tariff
    addTariff();
    updateConfigStatus();
}

// Load available price models
async function loadPriceModels() {
    try {
        // Try to load the Jönköping Energi model
        const response = await fetch('price-models/jönköping-energi-20a.json');
        if (response.ok) {
            const modelData = await response.json();
            availableModels['jonkoping-energi-20a'] = modelData;
            
            // Update the price model dropdown
            const priceModelSelect = document.getElementById('priceModel');
            const option = document.createElement('option');
            option.value = 'jonkoping-energi-20a';
            option.textContent = modelData.name;
            priceModelSelect.appendChild(option);
        }
    } catch (error) {
        console.log('No price models available');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Price model selection
    document.getElementById('priceModel').addEventListener('change', handlePriceModelChange);
    
    // File upload
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('csvFile');
    
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('drop', handleDrop);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    
    fileInput.addEventListener('change', handleFileSelect);
    
    // Configuration actions
    document.getElementById('addTariff').addEventListener('click', addTariff);
    document.getElementById('saveConfig').addEventListener('click', saveConfiguration);
    document.getElementById('loadConfig').addEventListener('click', loadSavedConfiguration);
    document.getElementById('resetConfig').addEventListener('click', resetConfiguration);
    
    // Form changes
    document.querySelectorAll('input, select').forEach(element => {
        element.addEventListener('change', updateConfigStatus);
    });
}

// Handle price model selection
function handlePriceModelChange() {
    const selectedModel = document.getElementById('priceModel').value;
    
    if (selectedModel === 'custom') {
        updateConfigStatus('custom');
        return;
    }
    
    if (availableModels[selectedModel]) {
        loadPriceModel(availableModels[selectedModel]);
        updateConfigStatus('price_model', availableModels[selectedModel].name);
    }
}

// Load price model configuration
function loadPriceModel(modelData) {
    // Basic settings
    document.getElementById('currency').value = modelData.currency || 'SEK';
    document.getElementById('fixedCost').value = parseFloat(modelData.fixed_fee_per_month || 100);
    document.getElementById('usageRate').value = parseFloat(modelData.usage_fee_per_kwh || 1.2);
    document.getElementById('vatRate').value = (parseFloat(modelData.tax_rate || 0.25) * 100);
    document.getElementById('pricesIncludeVat').checked = modelData.prices_include_tax || false;
    
    // Clear existing tariffs
    const container = document.getElementById('tariffsContainer');
    container.innerHTML = '';
    
    // Add tariffs from model
    if (modelData.power_tariffs) {
        modelData.power_tariffs.forEach(tariff => {
            addTariff(tariff);
        });
    }
    
    // If no tariffs in model, add default one
    if (!modelData.power_tariffs || modelData.power_tariffs.length === 0) {
        addTariff();
    }
}

// Convert time string to hour number
function timeToHour(timeStr) {
    return parseInt(timeStr.split(':')[0]);
}

// Add tariff to the interface
function addTariff(tariffData = null) {
    const container = document.getElementById('tariffsContainer');
    const tariffId = 'tariff_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const tariffHtml = `
        <div class="tariff-item" id="${tariffId}">
            <div class="tariff-header">
                <div class="form-group" style="margin-bottom: 0; flex: 1;">
                    <label>Tariff Name:</label>
                    <input type="text" class="tariff-name" value="${tariffData?.name || 'Power Tariff'}" style="max-width: 200px;">
                </div>
                <div class="tariff-controls">
                    <label>
                        <input type="checkbox" class="tariff-enabled" ${tariffData ? 'checked' : 'checked'}>
                        Enabled
                    </label>
                    <button type="button" class="btn btn-danger btn-small" onclick="removeTariff('${tariffId}')">Remove</button>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label>Top N Peak Hours:</label>
                    <input type="number" class="tariff-topn" min="1" max="100" value="${tariffData?.number_of_top_peaks_to_average || 3}">
                </div>
                <div class="form-group">
                    <label>Rate (per kW):</label>
                    <input type="number" class="tariff-rate" step="0.01" min="0" value="${tariffData?.fee_per_kw || 50.0}">
                </div>
            </div>
            
            <div class="restrictions-section">
                <h4>Time and Month Restrictions (optional)</h4>
                
                <div class="restrictions-row">
                    <div class="form-group">
                        <label>Start Time (24h format):</label>
                        <input type="time" class="tariff-start-time" value="${tariffData?.start_time || ''}">
                    </div>
                    <div class="form-group">
                        <label>End Time (24h format):</label>
                        <input type="time" class="tariff-end-time" value="${tariffData?.end_time || ''}">
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Active Months:</label>
                    <div class="checkbox-group">
                        ${generateMonthCheckboxes(tariffId, tariffData?.months || [])}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', tariffHtml);
}

// Generate month checkboxes
function generateMonthCheckboxes(tariffId, activeMonths = []) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    return months.map((month, index) => {
        const monthNum = index + 1;
        const checked = activeMonths.includes(monthNum) ? 'checked' : '';
        return `
            <div class="checkbox-item">
                <input type="checkbox" id="${tariffId}_month_${monthNum}" value="${monthNum}" ${checked}>
                <label for="${tariffId}_month_${monthNum}">${month.substr(0, 3)}</label>
            </div>
        `;
    }).join('');
}

// Remove tariff
function removeTariff(tariffId) {
    const tariff = document.getElementById(tariffId);
    if (tariff) {
        tariff.remove();
    }
}

// Update configuration status
function updateConfigStatus(source = 'custom', modelName = '') {
    const statusDiv = document.getElementById('configStatus');
    
    switch (source) {
        case 'saved':
            statusDiv.innerHTML = '<div class="status-info info">📁 Using saved configuration from browser storage</div>';
            break;
        case 'price_model':
            statusDiv.innerHTML = `<div class="status-info info">🏢 Using price model: ${modelName}</div>`;
            break;
        case 'default':
            statusDiv.innerHTML = '<div class="status-info info">⚙️ Using default configuration</div>';
            break;
        default:
            statusDiv.innerHTML = '<div class="status-info info">⚙️ Using custom configuration</div>';
    }
}

// Save configuration to localStorage
function saveConfiguration() {
    const config = getCurrentConfiguration();
    localStorage.setItem('electricityCalculatorConfig', JSON.stringify(config));
    
    const statusDiv = document.getElementById('configStatus');
    statusDiv.innerHTML = '<div class="status-info success">✅ Configuration saved successfully!</div>';
    setTimeout(() => updateConfigStatus('saved'), 2000);
}

// Load saved configuration
function loadSavedConfiguration() {
    const saved = localStorage.getItem('electricityCalculatorConfig');
    if (saved) {
        try {
            const config = JSON.parse(saved);
            loadConfiguration(config);
            updateConfigStatus('saved');
        } catch (error) {
            console.error('Error loading saved configuration:', error);
        }
    }
}

// Reset to default configuration
function resetConfiguration() {
    if (confirm('Are you sure you want to reset to default configuration? This will clear all current settings.')) {
        // Reset basic settings
        document.getElementById('currency').value = 'SEK';
        document.getElementById('fixedCost').value = 100.00;
        document.getElementById('usageRate').value = 1.2000;
        document.getElementById('vatRate').value = 25.0;
        document.getElementById('pricesIncludeVat').checked = true;
        document.getElementById('priceModel').value = 'custom';
        
        // Clear and add default tariff
        document.getElementById('tariffsContainer').innerHTML = '';
        addTariff();
        
        updateConfigStatus('default');
        
        const statusDiv = document.getElementById('configStatus');
        statusDiv.innerHTML = '<div class="status-info success">✅ Configuration reset to defaults!</div>';
        setTimeout(() => updateConfigStatus('default'), 2000);
    }
}

// Get current configuration
function getCurrentConfiguration() {
    const tariffs = [];
    document.querySelectorAll('.tariff-item').forEach(tariffDiv => {
        const enabled = tariffDiv.querySelector('.tariff-enabled').checked;
        const name = tariffDiv.querySelector('.tariff-name').value;
        const topN = parseInt(tariffDiv.querySelector('.tariff-topn').value);
        const rate = parseFloat(tariffDiv.querySelector('.tariff-rate').value);
        const startTime = tariffDiv.querySelector('.tariff-start-time').value;
        const endTime = tariffDiv.querySelector('.tariff-end-time').value;
        
        const months = [];
        tariffDiv.querySelectorAll('input[type="checkbox"][value]').forEach(checkbox => {
            if (checkbox.checked) {
                months.push(parseInt(checkbox.value));
            }
        });
        
        const hours = [];
        if (startTime && endTime) {
            const start = timeToHour(startTime);
            const end = timeToHour(endTime);
            for (let h = start; h <= end; h++) {
                hours.push(h);
            }
        }
        
        tariffs.push({
            enabled,
            name,
            top_n: topN,
            rate,
            months,
            hours
        });
    });
    
    return {
        currency: document.getElementById('currency').value,
        fixed_cost: parseFloat(document.getElementById('fixedCost').value),
        usage_rate: parseFloat(document.getElementById('usageRate').value),
        vat_rate: parseFloat(document.getElementById('vatRate').value),
        prices_include_vat: document.getElementById('pricesIncludeVat').checked,
        selected_price_model: document.getElementById('priceModel').value,
        tariffs
    };
}

// Load configuration
function loadConfiguration(config) {
    document.getElementById('currency').value = config.currency || 'SEK';
    document.getElementById('fixedCost').value = config.fixed_cost || 100.00;
    document.getElementById('usageRate').value = config.usage_rate || 1.2000;
    document.getElementById('vatRate').value = config.vat_rate || 25.0;
    document.getElementById('pricesIncludeVat').checked = config.prices_include_vat !== false;
    document.getElementById('priceModel').value = config.selected_price_model || 'custom';
    
    // Clear and load tariffs
    document.getElementById('tariffsContainer').innerHTML = '';
    if (config.tariffs && config.tariffs.length > 0) {
        config.tariffs.forEach(tariff => {
            addTariffFromConfig(tariff);
        });
    } else {
        addTariff();
    }
}

// Add tariff from configuration
function addTariffFromConfig(tariffConfig) {
    const container = document.getElementById('tariffsContainer');
    const tariffId = 'tariff_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const tariffHtml = `
        <div class="tariff-item" id="${tariffId}">
            <div class="tariff-header">
                <div class="form-group" style="margin-bottom: 0; flex: 1;">
                    <label>Tariff Name:</label>
                    <input type="text" class="tariff-name" value="${tariffConfig.name || 'Power Tariff'}" style="max-width: 200px;">
                </div>
                <div class="tariff-controls">
                    <label>
                        <input type="checkbox" class="tariff-enabled" ${tariffConfig.enabled ? 'checked' : ''}>
                        Enabled
                    </label>
                    <button type="button" class="btn btn-danger btn-small" onclick="removeTariff('${tariffId}')">Remove</button>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label>Top N Peak Hours:</label>
                    <input type="number" class="tariff-topn" min="1" max="100" value="${tariffConfig.top_n || 3}">
                </div>
                <div class="form-group">
                    <label>Rate (per kW):</label>
                    <input type="number" class="tariff-rate" step="0.01" min="0" value="${tariffConfig.rate || 50.0}">
                </div>
            </div>
            
            <div class="restrictions-section">
                <h4>Time and Month Restrictions (optional)</h4>
                
                <div class="restrictions-row">
                    <div class="form-group">
                        <label>Start Time (24h format):</label>
                        <input type="time" class="tariff-start-time" value="${getTimeFromHours(tariffConfig.hours, 'start')}">
                    </div>
                    <div class="form-group">
                        <label>End Time (24h format):</label>
                        <input type="time" class="tariff-end-time" value="${getTimeFromHours(tariffConfig.hours, 'end')}">
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Active Months:</label>
                    <div class="checkbox-group">
                        ${generateMonthCheckboxes(tariffId, tariffConfig.months || [])}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', tariffHtml);
}

// Get time string from hours array
function getTimeFromHours(hours, type) {
    if (!hours || hours.length === 0) return '';
    
    if (type === 'start') {
        return String(Math.min(...hours)).padStart(2, '0') + ':00';
    } else {
        return String(Math.max(...hours)).padStart(2, '0') + ':00';
    }
}

// File handling functions
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

// Handle file processing
function handleFile(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showValidationError('Please select a CSV file.');
        return;
    }
    
    const fileInfo = document.getElementById('fileInfo');
    fileInfo.style.display = 'block';
    fileInfo.innerHTML = `
        <strong>File:</strong> ${file.name}<br>
        <strong>Size:</strong> ${(file.size / 1024).toFixed(1)} KB<br>
        <strong>Status:</strong> Reading file...
    `;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const csvText = e.target.result;
            csvData = parseCSV(csvText);
            
            if (validateCSVData(csvData)) {
                fileInfo.innerHTML = `
                    <strong>File:</strong> ${file.name}<br>
                    <strong>Size:</strong> ${(file.size / 1024).toFixed(1)} KB<br>
                    <strong>Status:</strong> ✅ Valid CSV with ${csvData.length} rows<br>
                    <strong>Date Range:</strong> ${getDateRange(csvData)}
                `;
                
                processData();
            }
        } catch (error) {
            showValidationError(`Error reading file: ${error.message}`);
        }
    };
    
    reader.readAsText(file);
}

// Parse CSV text
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
        throw new Error('CSV file must have at least a header row and one data row');
    }
    
    // Detect separator (comma or semicolon)
    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const separator = semicolonCount > commaCount ? ';' : ',';
    
    console.log('Detected CSV separator:', separator);
    
    // Parse CSV with proper handling of quoted fields
    const headers = parseCSVLine(lines[0], separator);
    console.log('Parsed headers:', headers);
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) { // Skip empty lines
            const values = parseCSVLine(lines[i], separator);
            if (values.length === headers.length) {
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index];
                });
                data.push(row);
            }
        }
    }
    
    return data;
}

// Parse a single CSV line handling quoted fields
function parseCSVLine(line, separator = ',') {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === separator && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

// Validate CSV data
function validateCSVData(data) {
    if (!data || data.length === 0) {
        showValidationError('CSV file is empty.');
        return false;
    }
    
    const headers = Object.keys(data[0]);
    console.log('CSV Headers found:', headers);
    
    // Find datetime column with more flexible matching
    const datetimeColumn = headers.find(h => {
        const lower = h.toLowerCase();
        return lower.includes('date') || 
               lower.includes('time') ||
               lower.includes('timestamp') ||
               lower.includes('datetime') ||
               lower === 'dt' ||
               lower === 'ts';
    });
    
    // Find usage column with more flexible matching
    let usageColumn = headers.find(h => {
        const lower = h.toLowerCase();
        return lower.includes('kwh') || 
               lower.includes('usage') ||
               lower.includes('consumption') ||
               lower.includes('energy') ||
               lower.includes('power') ||
               lower.includes('load') ||
               lower.includes('wh') ||
               lower === 'usage' ||
               lower === 'energy' ||
               lower === 'power' ||
               lower === 'load';
    });
    
    // If no clear usage column found, try to find numeric columns
    if (!usageColumn) {
        usageColumn = headers.find(h => {
            if (h === datetimeColumn) return false; // Skip datetime column
            // Check if most values in this column are numeric
            let numericCount = 0;
            const sampleSize = Math.min(10, data.length);
            for (let i = 0; i < sampleSize; i++) {
                if (!isNaN(parseFloat(data[i][h])) && data[i][h] !== '') {
                    numericCount++;
                }
            }
            return numericCount >= sampleSize * 0.7; // 70% numeric values
        });
    }
    
    console.log('Detected datetime column:', datetimeColumn);
    console.log('Detected usage column:', usageColumn);
    
    if (!datetimeColumn) {
        showValidationError(`Could not find datetime column. Available columns: ${headers.join(', ')}. Please ensure your CSV has a column with "date", "time", or "timestamp" in the name.`);
        return false;
    }
    
    if (!usageColumn) {
        showValidationError(`Could not find usage column. Available columns: ${headers.join(', ')}. Please ensure your CSV has a column with "kWh", "usage", "consumption", or "energy" in the name.`);
        return false;
    }
    
    // Show sample data for debugging
    console.log('Sample data rows:', data.slice(0, 3));
    
    // Validate data types
    let validRows = 0;
    let sampleErrors = [];
    
    data.forEach((row, index) => {
        const dateStr = row[datetimeColumn];
        const usageStr = row[usageColumn];
        
        if (dateStr && usageStr) {
            // Try multiple date parsing approaches
            let date = new Date(dateStr);
            
            // If direct parsing fails, try different formats
            if (isNaN(date.getTime())) {
                // Try ISO format
                date = new Date(dateStr.replace(' ', 'T'));
                
                // Try reversing date format (DD/MM/YYYY to MM/DD/YYYY)
                if (isNaN(date.getTime()) && dateStr.includes('/')) {
                    const parts = dateStr.split(/[\/\s]/);
                    if (parts.length >= 3) {
                        // Try MM/DD/YYYY format
                        date = new Date(`${parts[1]}/${parts[0]}/${parts[2]}${parts.length > 3 ? ' ' + parts.slice(3).join(' ') : ''}`);
                    }
                }
                
                // Try with explicit parsing for European format
                if (isNaN(date.getTime()) && dateStr.match(/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}/)) {
                    const match = dateStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(.*)$/);
                    if (match) {
                        date = new Date(`${match[2]}/${match[1]}/${match[3]}${match[4] || ''}`);
                    }
                }
            }
            
            const usage = parseFloat(usageStr.replace(',', '.')); // Handle European decimal separator
            
            if (!isNaN(date.getTime()) && !isNaN(usage) && usage >= 0) {
                row.datetime = date;
                row.usage = usage;
                validRows++;
            } else if (sampleErrors.length < 3) {
                sampleErrors.push(`Row ${index + 1}: date="${dateStr}" (parsed: ${date}), usage="${usageStr}" (parsed: ${usage})`);
            }
        }
    });
    
    console.log('Valid rows:', validRows, 'out of', data.length);
    if (sampleErrors.length > 0) {
        console.log('Sample parsing errors:', sampleErrors);
    }
    
    if (validRows === 0) {
        showValidationError(`No valid data rows found. Sample parsing issues: ${sampleErrors.join('; ')}. Please check your datetime and usage column formats.`);
        return false;
    }
    
    if (validRows < data.length * 0.5) {
        showValidationError(`Only ${validRows} out of ${data.length} rows are valid (${Math.round(validRows/data.length*100)}%). Sample issues: ${sampleErrors.slice(0,2).join('; ')}. Please check your data format.`);
        return false;
    }
    
    // Filter data to keep only valid rows
    csvData = data.filter(row => row.datetime && !isNaN(row.usage));
    
    clearValidationError();
    return true;
}

// Get date range from data
function getDateRange(data) {
    const dates = data.map(row => row.datetime).filter(d => d).sort();
    if (dates.length === 0) return 'Unknown';
    
    const start = dates[0].toLocaleDateString();
    const end = dates[dates.length - 1].toLocaleDateString();
    
    return start === end ? start : `${start} - ${end}`;
}

// Show validation error
function showValidationError(message) {
    const validationDiv = document.getElementById('validationResults');
    validationDiv.innerHTML = `<div class="status-info error">❌ ${message}</div>`;
    document.getElementById('resultsSection').style.display = 'none';
}

// Clear validation error
function clearValidationError() {
    const validationDiv = document.getElementById('validationResults');
    validationDiv.innerHTML = '<div class="status-info success">✅ CSV file validated successfully!</div>';
}

// Process data and show results
function processData() {
    if (!csvData) return;
    
    const config = getCurrentConfiguration();
    const results = calculateCosts(csvData, config);
    
    displayResults(results, config);
    document.getElementById('resultsSection').style.display = 'block';
}

// Calculate costs
function calculateCosts(data, config) {
    // Filter valid data
    const validData = data.filter(row => row.datetime && !isNaN(row.usage));
    
    // Calculate basic costs
    const totalUsage = validData.reduce((sum, row) => sum + row.usage, 0);
    const totalDays = getDaysInDataset(validData);
    const monthlyFixedCost = config.fixed_cost;
    const usageCost = totalUsage * config.usage_rate;
    
    // Calculate power tariff costs
    const tariffCosts = [];
    let totalTariffCost = 0;
    
    config.tariffs.forEach(tariff => {
        if (tariff.enabled) {
            const cost = calculatePowerTariffCost(validData, tariff);
            tariffCosts.push({
                name: tariff.name,
                cost: cost,
                rate: tariff.rate,
                topN: tariff.top_n
            });
            totalTariffCost += cost;
        }
    });
    
    // Calculate subtotal and VAT
    const subtotal = monthlyFixedCost + usageCost + totalTariffCost;
    const vatAmount = config.prices_include_vat ? 
        subtotal * (config.vat_rate / 100) / (1 + config.vat_rate / 100) :
        subtotal * (config.vat_rate / 100);
    const netAmount = config.prices_include_vat ? subtotal - vatAmount : subtotal;
    const total = config.prices_include_vat ? subtotal : subtotal + vatAmount;
    
    return {
        totalUsage,
        totalDays,
        monthlyFixedCost,
        usageCost,
        tariffCosts,
        totalTariffCost,
        netAmount,
        vatAmount,
        total,
        validData
    };
}

// Calculate power tariff cost
function calculatePowerTariffCost(data, tariff) {
    // Filter data by month and hour restrictions
    let filteredData = data;
    
    if (tariff.months && tariff.months.length > 0) {
        filteredData = filteredData.filter(row => 
            tariff.months.includes(row.datetime.getMonth() + 1)
        );
    }
    
    if (tariff.hours && tariff.hours.length > 0) {
        filteredData = filteredData.filter(row => 
            tariff.hours.includes(row.datetime.getHours())
        );
    }
    
    if (filteredData.length === 0) return 0;
    
    // Group by date and find daily peaks
    const dailyPeaks = {};
    filteredData.forEach(row => {
        const dateKey = row.datetime.toDateString();
        if (!dailyPeaks[dateKey] || row.usage > dailyPeaks[dateKey]) {
            dailyPeaks[dateKey] = row.usage;
        }
    });
    
    // Get top N peaks from different days
    const peaks = Object.values(dailyPeaks).sort((a, b) => b - a).slice(0, tariff.top_n);
    
    if (peaks.length === 0) return 0;
    
    const averagePeak = peaks.reduce((sum, peak) => sum + peak, 0) / peaks.length;
    return averagePeak * tariff.rate;
}

// Get days in dataset
function getDaysInDataset(data) {
    const dates = new Set();
    data.forEach(row => {
        dates.add(row.datetime.toDateString());
    });
    return dates.size;
}

// Display results
function displayResults(results, config) {
    // Create usage chart
    createUsageChart(results.validData, config);
    
    // Display cost breakdown
    displayCostBreakdown(results, config);
    
    // Display summary stats
    displaySummaryStats(results);
}

// Create usage chart
function createUsageChart(data, config) {
    const x = data.map(row => row.datetime);
    const y = data.map(row => row.usage);
    
    // Find peak hours for highlighting
    const peaks = findPeakHours(data, config.tariffs);
    
    const trace1 = {
        x: x,
        y: y,
        type: 'scatter',
        mode: 'lines',
        name: 'Usage (kWh)',
        line: { color: '#3498db' }
    };
    
    const traces = [trace1];
    
    // Add peak markers
    if (peaks.length > 0) {
        const peakTrace = {
            x: peaks.map(p => p.datetime),
            y: peaks.map(p => p.usage),
            type: 'scatter',
            mode: 'markers',
            name: 'Peak Hours',
            marker: { color: '#e74c3c', size: 8 }
        };
        traces.push(peakTrace);
    }
    
    const layout = {
        title: 'Hourly Electricity Usage',
        xaxis: { title: 'Date/Time' },
        yaxis: { title: 'Usage (kWh)' },
        showlegend: true,
        responsive: true
    };
    
    Plotly.newPlot('usageChart', traces, layout);
}

// Find peak hours
function findPeakHours(data, tariffs) {
    const allPeaks = [];
    
    tariffs.forEach(tariff => {
        if (!tariff.enabled) return;
        
        // Filter data by restrictions
        let filteredData = data;
        
        if (tariff.months && tariff.months.length > 0) {
            filteredData = filteredData.filter(row => 
                tariff.months.includes(row.datetime.getMonth() + 1)
            );
        }
        
        if (tariff.hours && tariff.hours.length > 0) {
            filteredData = filteredData.filter(row => 
                tariff.hours.includes(row.datetime.getHours())
            );
        }
        
        // Group by date and find daily peaks
        const dailyPeaks = {};
        filteredData.forEach(row => {
            const dateKey = row.datetime.toDateString();
            if (!dailyPeaks[dateKey] || row.usage > dailyPeaks[dateKey].usage) {
                dailyPeaks[dateKey] = row;
            }
        });
        
        // Get top N peaks
        const peaks = Object.values(dailyPeaks)
            .sort((a, b) => b.usage - a.usage)
            .slice(0, tariff.top_n);
        
        allPeaks.push(...peaks);
    });
    
    // Remove duplicates
    const uniquePeaks = [];
    const seen = new Set();
    
    allPeaks.forEach(peak => {
        const key = peak.datetime.getTime();
        if (!seen.has(key)) {
            seen.add(key);
            uniquePeaks.push(peak);
        }
    });
    
    return uniquePeaks;
}

// Display cost breakdown
function displayCostBreakdown(results, config) {
    const currency = config.currency;
    
    let html = '<table class="cost-table">';
    html += '<thead><tr><th>Cost Component</th><th>Details</th><th>Amount</th></tr></thead>';
    html += '<tbody>';
    
    // Fixed cost
    html += `<tr><td>Monthly Fixed Cost</td><td>Base service fee</td><td>${formatCurrency(results.monthlyFixedCost, currency)}</td></tr>`;
    
    // Usage cost
    html += `<tr><td>Usage Cost</td><td>${results.totalUsage.toFixed(2)} kWh × ${formatCurrency(config.usage_rate, currency)}/kWh</td><td>${formatCurrency(results.usageCost, currency)}</td></tr>`;
    
    // Tariff costs
    results.tariffCosts.forEach(tariff => {
        html += `<tr><td>Power Tariff: ${tariff.name}</td><td>Top ${tariff.topN} peaks × ${formatCurrency(tariff.rate, currency)}/kW</td><td>${formatCurrency(tariff.cost, currency)}</td></tr>`;
    });
    
    // Subtotals
    html += `<tr style="border-top: 1px solid #ccc;"><td><strong>Net Amount</strong></td><td></td><td><strong>${formatCurrency(results.netAmount, currency)}</strong></td></tr>`;
    html += `<tr><td>VAT (${config.vat_rate.toFixed(1)}%)</td><td></td><td>${formatCurrency(results.vatAmount, currency)}</td></tr>`;
    html += `<tr class="cost-total"><td><strong>Total Cost</strong></td><td></td><td><strong>${formatCurrency(results.total, currency)}</strong></td></tr>`;
    
    html += '</tbody></table>';
    
    document.getElementById('costBreakdown').innerHTML = html;
}

// Display summary stats
function displaySummaryStats(results) {
    const html = `
        <div class="stat-card">
            <div class="stat-value">${results.totalUsage.toFixed(1)}</div>
            <div class="stat-label">Total kWh</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${results.totalDays}</div>
            <div class="stat-label">Days of Data</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${(results.totalUsage / results.totalDays).toFixed(2)}</div>
            <div class="stat-label">Avg kWh/Day</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${(results.total / results.totalUsage).toFixed(3)}</div>
            <div class="stat-label">Cost per kWh</div>
        </div>
    `;
    
    document.getElementById('summaryStats').innerHTML = html;
}

// Format currency
function formatCurrency(amount, currency) {
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    return formatter.format(amount);
}