// Global variables
let csvData = null;
let availableModels = {};
let currentLoadedModel = null; // Track the currently loaded price model
let originalModelConfig = null; // Store the original configuration when a model is loaded

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
    // Don't show any status initially
    updateConfigStatus('default');
}

// Load available price models
async function loadPriceModels() {
    const priceModelSelect = document.getElementById('priceModel');
    let modelsLoaded = 0;
    let modelFiles = [];
    
    // First try to load models index file
    try {
        const indexResponse = await fetch('price-models/models-index.json');
        if (indexResponse.ok) {
            const indexData = await indexResponse.json();
            modelFiles = indexData.models || [];
            console.log('Using models index file, found:', modelFiles.length, 'models');
        }
    } catch (error) {
        console.log('No models index file found, using discovery approach');
    }
    
    // If no index file, fall back to discovery approach
    if (modelFiles.length === 0) {
        // List of known model files to try loading
        const knownModels = [
            'jönköping-energi-20a.json',
            'jonkoping-energi-20a.json', // Alternative spelling
            'vattenfall-standard.json',
            'e-on-basic.json',
            'fortum-fixed.json',
            'ellevio-standard.json',
            'goteborg-energi.json',
            'stockholm-exergi.json',
            'helsinkienergia-basic.json',
            'oslo-energi.json',
            'copenhagen-electricity.json'
        ];
        modelFiles = knownModels;
    }
    
    // Load each model file
    for (const filename of modelFiles) {
        try {
            const response = await fetch(`price-models/${filename}`);
            if (response.ok) {
                const modelData = await response.json();
                
                // Validate model structure
                if (validatePriceModel(modelData)) {
                    const modelKey = filename.replace('.json', '').toLowerCase().replace(/[^a-z0-9-]/g, '-');
                    availableModels[modelKey] = modelData;
                    
                    // Add option to dropdown
                    const option = document.createElement('option');
                    option.value = modelKey;
                    option.textContent = modelData.name || filename.replace('.json', '');
                    priceModelSelect.appendChild(option);
                    
                    modelsLoaded++;
                    console.log(`Loaded price model: ${modelData.name || filename}`);
                } else {
                    console.warn(`Invalid price model structure in ${filename}`);
                }
            }
        } catch (error) {
            console.log(`Model ${filename} not found or invalid:`, error.message);
        }
    }
    

    
    if (modelsLoaded > 0) {
        console.log(`Successfully loaded ${modelsLoaded} price models`);
        
        // Sort dropdown options alphabetically (except "Custom Configuration")
        const options = Array.from(priceModelSelect.options).slice(1); // Skip first "Custom" option
        options.sort((a, b) => a.textContent.localeCompare(b.textContent));
        
        // Clear and re-add sorted options
        while (priceModelSelect.children.length > 1) {
            priceModelSelect.removeChild(priceModelSelect.lastChild);
        }
        options.forEach(option => priceModelSelect.appendChild(option));
        
    } else {
        console.log('No price models found in price-models directory');
        console.log('To add models: Create JSON files in the price-models/ directory or update models-index.json');
    }
}

// Validate price model structure
function validatePriceModel(modelData) {
    // Check required fields
    const requiredFields = ['currency', 'fixed_fee_per_month', 'usage_fee_per_kwh'];
    for (const field of requiredFields) {
        if (!(field in modelData)) {
            console.warn(`Missing required field: ${field}`);
            return false;
        }
    }
    
    // Validate data types
    if (typeof modelData.currency !== 'string' || modelData.currency.length !== 3) {
        console.warn('Invalid currency format');
        return false;
    }
    
    if (typeof modelData.fixed_fee_per_month !== 'number' || modelData.fixed_fee_per_month < 0) {
        console.warn('Invalid fixed_fee_per_month');
        return false;
    }
    
    if (typeof modelData.usage_fee_per_kwh !== 'number' || modelData.usage_fee_per_kwh < 0) {
        console.warn('Invalid usage_fee_per_kwh');
        return false;
    }
    
    // Validate power tariffs if present
    if (modelData.power_tariffs && Array.isArray(modelData.power_tariffs)) {
        for (const tariff of modelData.power_tariffs) {
            if (!tariff.name || !tariff.fee_per_kw || !tariff.number_of_top_peaks_to_average) {
                console.warn('Invalid power tariff structure');
                return false;
            }
        }
    }
    
    return true;
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
    
    // Download model events
    document.getElementById('downloadModel').addEventListener('click', toggleDownloadSection);
    document.getElementById('previewModel').addEventListener('click', previewModel);
    document.getElementById('downloadJson').addEventListener('click', downloadModel);
    
    // Configuration toggle
    document.getElementById('toggleConfig').addEventListener('click', toggleConfigurationDetails);
    
    // Form changes
    document.querySelectorAll('input, select').forEach(element => {
        element.addEventListener('change', handleConfigurationChange);
    });
}

// Handle price model selection
function handlePriceModelChange() {
    const selectedModel = document.getElementById('priceModel').value;
    
    if (selectedModel === 'custom') {
        currentLoadedModel = null;
        originalModelConfig = null;
        updateConfigStatus('custom');
        // Re-run calculation and plotting if data is loaded
        if (csvData) {
            processData();
        }
        return;
    }
    
    if (availableModels[selectedModel]) {
        currentLoadedModel = selectedModel;
        loadPriceModel(availableModels[selectedModel]);
        // Store the original configuration for comparison
        originalModelConfig = getCurrentConfiguration();
        updateConfigStatus('price_model', availableModels[selectedModel].name);
        
        // Re-run calculation and plotting if data is loaded
        if (csvData) {
            processData();
        }
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
    
    // Store the original configuration after loading
    setTimeout(() => {
        originalModelConfig = getCurrentConfiguration();
    }, 100);
}

// Convert time string to hour number
function timeToHour(timeStr) {
    return parseInt(timeStr.split(':')[0]);
}

// Handle configuration changes
function handleConfigurationChange() {
    if (currentLoadedModel && originalModelConfig) {
        if (hasConfigurationChanged()) {
            // Switch back to custom configuration when modified
            document.getElementById('priceModel').value = 'custom';
            currentLoadedModel = null;
            updateConfigStatus('modified');
        } else {
            updateConfigStatus('custom');
        }
    } else {
        updateConfigStatus('custom');
    }
    
    // Re-run calculation and plotting if data is loaded
    if (csvData) {
        processData();
    }
}

// Check if current configuration differs from the originally loaded model
function hasConfigurationChanged() {
    if (!originalModelConfig) return false;
    
    const currentConfig = getCurrentConfiguration();
    
    // Compare basic settings
    if (currentConfig.currency !== originalModelConfig.currency ||
        currentConfig.fixed_cost !== originalModelConfig.fixed_cost ||
        currentConfig.usage_rate !== originalModelConfig.usage_rate ||
        currentConfig.vat_rate !== originalModelConfig.vat_rate ||
        currentConfig.prices_include_vat !== originalModelConfig.prices_include_vat) {
        return true;
    }
    
    // Compare tariffs
    if (currentConfig.tariffs.length !== originalModelConfig.tariffs.length) {
        return true;
    }
    
    // Compare each tariff
    for (let i = 0; i < currentConfig.tariffs.length; i++) {
        const current = currentConfig.tariffs[i];
        const original = originalModelConfig.tariffs[i];
        
        if (!original) return true;
        
        if (current.enabled !== original.enabled ||
            current.name !== original.name ||
            current.rate !== original.rate ||
            current.top_n !== original.top_n ||
            JSON.stringify(current.months) !== JSON.stringify(original.months) ||
            JSON.stringify(current.hours) !== JSON.stringify(original.hours)) {
            return true;
        }
    }
    
    return false;
}

// Add tariff to the interface
function addTariff(tariffData = null) {
    const container = document.getElementById('tariffsContainer');
    const tariffId = 'tariff_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Setup night time settings visibility
    setTimeout(() => setupTariffEventListeners(tariffId), 10);
    
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
            
            <div class="form-row">
                <div class="form-group">
                    <label>Calculation Method:</label>
                    <select class="tariff-method">
                        <option value="standard" ${(!tariffData?.peak_calculation_method || tariffData?.peak_calculation_method === 'standard') ? 'selected' : ''}>Standard</option>
                        <option value="night_reduced" ${tariffData?.peak_calculation_method === 'night_reduced' ? 'selected' : ''}>Night Reduced (Ellevio style)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Night Reduction Factor:</label>
                    <input type="number" class="tariff-night-factor" step="0.1" min="0" max="1" value="${tariffData?.night_reduction_factor || 0.5}" placeholder="0.5">
                </div>
            </div>
            
            <div class="form-row night-time-settings" style="display: ${tariffData?.peak_calculation_method === 'night_reduced' ? 'grid' : 'none'};">
                <div class="form-group">
                    <label>Night Start Time:</label>
                    <input type="time" class="tariff-night-start" value="${tariffData?.night_start_time || '22:00'}">
                </div>
                <div class="form-group">
                    <label>Night End Time:</label>
                    <input type="time" class="tariff-night-end" value="${tariffData?.night_end_time || '06:00'}">
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
    
    // Trigger configuration change detection after adding tariff
    setTimeout(() => handleConfigurationChange(), 50);
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

// Setup event listeners for tariff
function setupTariffEventListeners(tariffId) {
    const methodSelect = document.querySelector(`#${tariffId} .tariff-method`);
    const nightSettings = document.querySelector(`#${tariffId} .night-time-settings`);
    
    if (methodSelect && nightSettings) {
        methodSelect.addEventListener('change', function() {
            nightSettings.style.display = this.value === 'night_reduced' ? 'grid' : 'none';
            handleConfigurationChange();
        });
    }
    
    // Add change listeners to all tariff inputs
    const tariffElement = document.getElementById(tariffId);
    if (tariffElement) {
        const inputs = tariffElement.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('change', handleConfigurationChange);
        });
    }
}

// Remove tariff
function removeTariff(tariffId) {
    const tariff = document.getElementById(tariffId);
    if (tariff) {
        tariff.remove();
        handleConfigurationChange();
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
        case 'download':
            statusDiv.innerHTML = `<div class="status-info success">✅ Price model "${modelName}" downloaded successfully!</div>`;
            setTimeout(() => updateConfigStatus('custom'), 3000);
            break;
        case 'modified':
            statusDiv.innerHTML = '<div class="status-info warning">⚠️ Configuration modified from original model</div>';
            break;
        case 'custom':
            // Only show custom status if no model is currently loaded
            if (currentLoadedModel === null) {
                statusDiv.innerHTML = '<div class="status-info info">⚙️ Using custom configuration</div>';
            } else {
                // Check if configuration has been modified from the loaded model
                if (hasConfigurationChanged()) {
                    statusDiv.innerHTML = '<div class="status-info warning">⚠️ Configuration modified from original model</div>';
                } else {
                    statusDiv.innerHTML = `<div class="status-info info">🏢 Using price model: ${availableModels[currentLoadedModel]?.name || currentLoadedModel}</div>`;
                }
            }
            break;
        default:
            // Don't show any status by default
            statusDiv.innerHTML = '';
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
            // Reset model tracking when loading saved config
            currentLoadedModel = null;
            originalModelConfig = null;
            document.getElementById('priceModel').value = 'custom';
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
        
        // Reset model tracking
        currentLoadedModel = null;
        originalModelConfig = null;
        
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
        
        // Get advanced calculation settings
        const calculationMethod = tariffDiv.querySelector('.tariff-method').value;
        const nightFactor = parseFloat(tariffDiv.querySelector('.tariff-night-factor').value);
        const nightStart = tariffDiv.querySelector('.tariff-night-start').value;
        const nightEnd = tariffDiv.querySelector('.tariff-night-end').value;
        
        tariffs.push({
            enabled,
            name,
            top_n: topN,
            rate,
            months,
            hours,
            peak_calculation_method: calculationMethod,
            night_reduction_factor: nightFactor,
            night_start_time: nightStart,
            night_end_time: nightEnd
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
    
    // Reset model tracking when loading external configuration
    currentLoadedModel = null;
    originalModelConfig = null;
    
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
            
            <div class="form-row">
                <div class="form-group">
                    <label>Calculation Method:</label>
                    <select class="tariff-method">
                        <option value="standard" ${(!tariffConfig.peak_calculation_method || tariffConfig.peak_calculation_method === 'standard') ? 'selected' : ''}>Standard</option>
                        <option value="night_reduced" ${tariffConfig.peak_calculation_method === 'night_reduced' ? 'selected' : ''}>Night Reduced (Ellevio style)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Night Reduction Factor:</label>
                    <input type="number" class="tariff-night-factor" step="0.1" min="0" max="1" value="${tariffConfig.night_reduction_factor || 0.5}" placeholder="0.5">
                </div>
            </div>
            
            <div class="form-row night-time-settings" style="display: ${tariffConfig.peak_calculation_method === 'night_reduced' ? 'grid' : 'none'};">
                <div class="form-group">
                    <label>Night Start Time:</label>
                    <input type="time" class="tariff-night-start" value="${tariffConfig.night_start_time || '22:00'}">
                </div>
                <div class="form-group">
                    <label>Night End Time:</label>
                    <input type="time" class="tariff-night-end" value="${tariffConfig.night_end_time || '06:00'}">
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
    
    // Setup event listeners for this tariff
    setTimeout(() => setupTariffEventListeners(tariffId), 10);
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
            const parseResult = parseCSV(csvText);
            csvData = parseResult.data;
            
            if (validateCSVData(csvData)) {
                let statusInfo = `✅ Valid CSV with ${csvData.length} rows`;
                if (parseResult.skippedLines > 0) {
                    statusInfo += ` (skipped ${parseResult.skippedLines} header line${parseResult.skippedLines > 1 ? 's' : ''})`;
                }
                
                fileInfo.innerHTML = `
                    <strong>File:</strong> ${file.name}<br>
                    <strong>Size:</strong> ${(file.size / 1024).toFixed(1)} KB<br>
                    <strong>Status:</strong> ${statusInfo}<br>
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
    
    // Find the actual header row by scanning for expected column names
    let headerRowIndex = 0;
    let separator = ',';
    
    for (let i = 0; i < Math.min(lines.length, 10); i++) { // Check first 10 lines
        const line = lines[i].trim();
        if (!line) continue;
        
        // Detect separator for this line
        const commaCount = (line.match(/,/g) || []).length;
        const semicolonCount = (line.match(/;/g) || []).length;
        const lineSeparator = semicolonCount > commaCount ? ';' : ',';
        
        // Parse the line to get potential headers
        const potentialHeaders = parseCSVLine(line, lineSeparator);
        
        // Check if this line contains expected header keywords
        const hasDateColumn = potentialHeaders.some(h => {
            const lower = h.toLowerCase();
            return lower.includes('date') || 
                   lower.includes('time') ||
                   lower.includes('timestamp') ||
                   lower.includes('datetime') ||
                   lower === 'dt' ||
                   lower === 'ts';
        });
        
        const hasUsageColumn = potentialHeaders.some(h => {
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
        
        // If we find a line with both date and usage columns, it's likely the header
        if (hasDateColumn && hasUsageColumn) {
            headerRowIndex = i;
            separator = lineSeparator;
            break;
        }
        
        // If we find a line with just date column, it might be the header
        if (hasDateColumn && potentialHeaders.length >= 2) {
            headerRowIndex = i;
            separator = lineSeparator;
            break;
        }
    }
    
    // Fallback: if no proper header found, use the first non-empty line
    if (headerRowIndex === 0) {
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim()) {
                const commaCount = (lines[i].match(/,/g) || []).length;
                const semicolonCount = (lines[i].match(/;/g) || []).length;
                separator = semicolonCount > commaCount ? ';' : ',';
                headerRowIndex = i;
                console.log('Fallback: Using first non-empty line as header at line:', headerRowIndex + 1);
                break;
            }
        }
    }
    
    console.log('Detected CSV separator:', separator);
    console.log('Found header at line:', headerRowIndex + 1);
    
    // Parse CSV with proper handling of quoted fields
    const headers = parseCSVLine(lines[headerRowIndex], separator);
    console.log('Parsed headers:', headers);
    
    const data = [];
    for (let i = headerRowIndex + 1; i < lines.length; i++) {
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
    
    return {
        data: data,
        headerRowIndex: headerRowIndex,
        skippedLines: headerRowIndex
    };
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
    
    // Handle special calculation methods
    if (tariff.peak_calculation_method === 'night_reduced') {
        return calculateNightReducedPeaks(filteredData, tariff);
    }
    
    // Standard calculation: Group by date and find daily peaks
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

// Calculate peaks with night reduction (e.g., Ellevio model)
function calculateNightReducedPeaks(data, tariff) {
    const nightStart = tariff.night_start_time ? timeToHour(tariff.night_start_time) : 22;
    const nightEnd = tariff.night_end_time ? timeToHour(tariff.night_end_time) : 6;
    const reductionFactor = tariff.night_reduction_factor || 0.5;
    
    // Group by date and find daily peaks with night reduction
    const dailyPeaks = {};
    
    data.forEach(row => {
        const dateKey = row.datetime.toDateString();
        const hour = row.datetime.getHours();
        
        // Determine if this is night time (considering it might wrap around midnight)
        let isNightTime;
        if (nightStart > nightEnd) {
            // Night period wraps around midnight (e.g., 22:00 to 06:00)
            isNightTime = hour >= nightStart || hour < nightEnd;
        } else {
            // Night period within same day
            isNightTime = hour >= nightStart && hour < nightEnd;
        }
        
        // Apply night reduction if applicable
        const effectiveUsage = isNightTime ? row.usage * reductionFactor : row.usage;
        
        if (!dailyPeaks[dateKey] || effectiveUsage > dailyPeaks[dateKey].effectiveUsage) {
            dailyPeaks[dateKey] = {
                effectiveUsage: effectiveUsage,
                originalUsage: row.usage,
                isNightPeak: isNightTime,
                hour: hour
            };
        }
    });
    
    // Get top N effective peaks from different days
    const peakValues = Object.values(dailyPeaks)
        .sort((a, b) => b.effectiveUsage - a.effectiveUsage)
        .slice(0, tariff.top_n || 3);
    
    if (peakValues.length === 0) return 0;
    
    const averageEffectivePeak = peakValues.reduce((sum, peak) => sum + peak.effectiveUsage, 0) / peakValues.length;
    return averageEffectivePeak * tariff.rate;
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

// Download Model Functions
function toggleDownloadSection() {
    const downloadSection = document.getElementById('downloadSection');
    const isVisible = downloadSection.style.display !== 'none';
    
    if (isVisible) {
        downloadSection.style.display = 'none';
        document.getElementById('jsonPreview').style.display = 'none';
    } else {
        downloadSection.style.display = 'block';
    }
}

// Configuration Toggle Functions
function toggleConfigurationDetails() {
    const configDetails = document.getElementById('configDetails');
    const toggleButton = document.getElementById('toggleConfig');
    const toggleIcon = document.getElementById('toggleIcon');
    const isVisible = configDetails.style.display !== 'none';
    
    if (isVisible) {
        configDetails.style.display = 'none';
        toggleIcon.textContent = '▼';
        toggleButton.innerHTML = '<span id="toggleIcon">▼</span> Show Configuration Details';
    } else {
        configDetails.style.display = 'block';
        toggleIcon.textContent = '▲';
        toggleButton.innerHTML = '<span id="toggleIcon">▲</span> Hide Configuration Details';
    }
}

function convertConfigToPriceModel(config, modelName) {
    // Convert hour list to time range if possible
    function hoursToTimeRange(hours) {
        if (!hours || hours.length === 0) {
            return null;
        }
        
        const minHour = Math.min(...hours);
        const maxHour = Math.max(...hours);
        
        // Check if hours form a continuous range
        const expectedHours = new Set();
        for (let i = minHour; i <= maxHour; i++) {
            expectedHours.add(i);
        }
        
        const actualHours = new Set(hours);
        if (actualHours.size === expectedHours.size && 
            [...actualHours].every(h => expectedHours.has(h))) {
            return {
                start_time: `${minHour.toString().padStart(2, '0')}:00`,
                end_time: `${maxHour.toString().padStart(2, '0')}:00`
            };
        }
        
        return null;
    }
    
    const priceModel = {
        name: modelName,
        currency: config.currency,
        tax_rate: config.vat_rate / 100, // Convert from percentage to decimal
        prices_include_tax: config.prices_include_vat,
        fixed_fee_per_month: config.fixed_cost,
        usage_fee_per_kwh: config.usage_rate,
        power_tariffs: []
    };
    
    // Convert tariffs
    config.tariffs.forEach(tariff => {
        if (!tariff.enabled) {
            return; // Skip disabled tariffs
        }
        
        const timeRange = hoursToTimeRange(tariff.hours);
        
        const tariffModel = {
            name: tariff.name,
            fee_per_kw: tariff.rate,
            number_of_top_peaks_to_average: tariff.top_n,
            months: tariff.months || []
        };
        
        // Add time range if we could convert hours to a continuous range
        if (timeRange) {
            tariffModel.start_time = timeRange.start_time;
            tariffModel.end_time = timeRange.end_time;
        }
        
        priceModel.power_tariffs.push(tariffModel);
    });
    
    return priceModel;
}

function previewModel() {
    const modelName = document.getElementById('modelName').value || 'Custom Configuration';
    const config = getCurrentConfiguration();
    const priceModel = convertConfigToPriceModel(config, modelName);
    
    const jsonPreview = document.getElementById('jsonPreview');
    const jsonContent = document.getElementById('jsonContent');
    
    jsonContent.textContent = JSON.stringify(priceModel, null, 2);
    jsonPreview.style.display = 'block';
}

function downloadModel() {
    const modelName = document.getElementById('modelName').value || 'Custom Configuration';
    const config = getCurrentConfiguration();
    const priceModel = convertConfigToPriceModel(config, modelName);
    
    // Create a safe filename
    const safeName = modelName
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase();
    
    const filename = `${safeName}.json`;
    const jsonString = JSON.stringify(priceModel, null, 2);
    
    // Create and trigger download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Show success message
    updateConfigStatus('download', modelName);
}