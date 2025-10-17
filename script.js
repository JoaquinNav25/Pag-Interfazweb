
const elements = {
    dataBody: document.getElementById('data-body'),
    stockLevelsContainer: document.getElementById('stock-levels-container'),
    categoryFilter: document.getElementById('category-filter'),
    refreshBtn: document.getElementById('refresh-btn'),
    updateTime: document.getElementById('update-time'),
    stockCoverageCat1: document.getElementById('stock-coverage-cat1'),
    stockBreakMonthCat1: document.getElementById('stock-break-month-cat1'),
    ropCat1: document.getElementById('rop-cat1'),
    priorityCat1: document.getElementById('priority-cat1'),
    stockCoverageCat2: document.getElementById('stock-coverage-cat2'),
    stockBreakMonthCat2: document.getElementById('stock-break-month-cat2'),
    ropCat2: document.getElementById('rop-cat2'),
    priorityCat2: document.getElementById('priority-cat2'),
    consumptionChartCat1: document.getElementById('consumption-chart'),
    consumptionChartCat2: document.getElementById('consumption-chart-cat2')
};

let consumptionChartCat1;
let consumptionChartCat2;

function cleanValue(value) {
    if (typeof value === 'string') {
        return value.replace(/^"|"$/g, '').trim();
    }
    return value;
}

const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/16NSBCGMg1gi6_p-EjCflaELG8y2LtouKenWINRaXQuY/gviz/tq?tqx=out:csv&sheet=DataForWebPage';

async function initDashboard() {
    try {
        const csvData = await fetchData(GOOGLE_SHEET_CSV_URL);
        
        const rfidData = parseRfidCsv(csvData);
        const stockData = parseStockCsv(csvData);
        const consumptionData = parseConsumptionCsv(csvData);
        
        updateStockLevels(stockData);
        updateTransactionsTable(rfidData);
        updateConsumptionChartCat1(consumptionData.cat1);
        updateConsumptionChartCat2(consumptionData.cat2);
        updateSummaryStatsCat1(rfidData, consumptionData.cat1, stockData);
        updateSummaryStatsCat2(rfidData, consumptionData.cat2, stockData);
        updateLastUpdated();
        
        setupEventListeners();
    } catch (error) {
        console.error('Dashboard initialization failed:', error);
    }
}

async function fetchData(url) {
    const response = await fetch(url);
    return response.text();
}

function parseRfidCsv(csv) {
    const lines = csv.split('\n');
    let headers = lines[0].split(',').map(h => cleanValue(h));
    
    return lines.slice(1).map(line => {
        if (!line.trim()) return null;

        const values = line.split(',');
        const timestamp = cleanValue(values[headers.indexOf('RFIDDatestamp')]);
        const uid = cleanValue(values[headers.indexOf('UID')]);
        const category = parseInt(cleanValue(values[headers.indexOf('category')]));
        const mode = parseInt(cleanValue(values[headers.indexOf('Mode')]));

        if (!timestamp || !uid || isNaN(category) || isNaN(mode)) {
            return null; 
        }

        return {
            timestamp: timestamp,
            uid: uid,
            category: category,
            mode: mode
        };
    }).filter(Boolean); 
}

function parseStockCsv(csv) {
    const lines = csv.split('\n');
    let headers = lines[0].split(',').map(h => cleanValue(h)); 
    
    const dataRow = lines[1].split(',');

    console.log("CSV Headers:", headers);
    console.log("Data row (row 2):", dataRow);

    return Array.from({ length: 10 }, (_, i) => {
        const category = i + 1;
        const header = `StockLevel_Cat${category}`;
        const headerIndex = headers.indexOf(header);
        const levelValue = cleanValue(dataRow[headerIndex]);

        console.log(`Category ${category}: Header "${header}", Index ${headerIndex}, Value "${levelValue}"`);

        return {
            category: category,
            level: parseInt(levelValue)
        };
    });
}

function parseConsumptionCsv(csv) {
    const lines = csv.split('\n');
    let headers = lines[0].split(',').map(h => cleanValue(h)); 
    
    const cat1 = { historical: [], forecast: [] };
    const cat2 = { historical: [], forecast: [] };
    
    lines.slice(1).forEach(line => {
        if (!line.trim()) return;
        
        const values = line.split(',');
        const histDate = cleanValue(values[headers.indexOf('HistorialDates')]);
        const fcDate = cleanValue(values[headers.indexOf('ForecastDates')]);

        const histValueCat1 = cleanValue(values[headers.indexOf('HistoricalDataCat1')]);
        const histValueCat2 = cleanValue(values[headers.indexOf('HistoricalDataCat2')]);
        const fcValueCat1 = cleanValue(values[headers.indexOf('ForecastDataCat1')]);
        const fcValueCat2 = cleanValue(values[headers.indexOf('ForecastDataCat2')]);

        if (histDate) {
            const parts = histDate.match(/(\d{1,2})\/(\d{2})\/(\d{4})/);
            const formattedHistDate = parts ? `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}` : histDate;

            if (histValueCat1) {
                cat1.historical.push({
                    date: formattedHistDate,
                    value: parseFloat(histValueCat1)
                });
            }
            if (histValueCat2) {
                 cat2.historical.push({
                    date: formattedHistDate,
                    value: parseFloat(histValueCat2)
                });
            }
        }

        if (fcDate) {
            const parts = fcDate.match(/(\d{1,2})\/(\d{2})\/(\d{4})/);
            const formattedFcDate = parts ? `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}` : fcDate;

            if (fcValueCat1) {
                cat1.forecast.push({
                    date: formattedFcDate,
                    value: parseFloat(fcValueCat1)
                });
            }
            if (fcValueCat2) {
                cat2.forecast.push({
                    date: formattedFcDate,
                    value: parseFloat(fcValueCat2)
                });
            }
        }
    });
    
    return { cat1, cat2 };
}

function updateStockLevels(stockData) {
    elements.stockLevelsContainer.innerHTML = '';
    
    stockData.forEach(category => {
        const barContainer = document.createElement('div');
        barContainer.className = 'bar-container';
        
        barContainer.innerHTML = `
            <div class="bar-label">Category ${category.category}</div>
            <div class="bar">
                <div class="bar-fill" style="width: ${category.level}%"></div>
                <div class="bar-value">${category.level}</div>
            </div>
        `;
        
        elements.stockLevelsContainer.appendChild(barContainer);
    });
}

function updateTransactionsTable(data) {
    elements.dataBody.innerHTML = '';
    
    const allCategories = Array.from({ length: 10 }, (_, i) => i + 1); 
    elements.categoryFilter.innerHTML = `
        <option value="all">Todas las categorías</option>
        ${allCategories.map(cat => `<option value="${cat}">Categoría ${cat}</option>`).join('')}
    `;
    
    elements.dataBody.innerHTML = ''; 

    const reversedData = [...data].reverse();

    reversedData.slice(0, 50).forEach(item => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${formatDateTime(item.timestamp)}</td>
            <td>${item.uid}</td>
            <td>Category ${item.category}</td>
            <td><span class="${item.mode === 1 ? 'action-in' : 'action-out'}">
                ${item.mode === 1 ? 'Ingreso' : 'Salida'}
            </span></td>
        `;
        
        elements.dataBody.appendChild(row);
    });
}

function updateConsumptionChartCat1(data) {
    const ctx = elements.consumptionChartCat1.getContext('2d');
    
    const labels = [
        ...data.historical.map(d => d.date),
        ...data.forecast.map(d => d.date)
    ];
    
    const historicalData = [
        ...data.historical.map(d => d.value),
        ...Array(data.forecast.length).fill(null)
    ];
    
    const forecastData = [
        ...Array(data.historical.length).fill(null),
        ...data.forecast.map(d => d.value)
    ];
    
    if (consumptionChartCat1) {
        consumptionChartCat1.data.labels = labels;
        consumptionChartCat1.data.datasets[0].data = historicalData;
        consumptionChartCat1.data.datasets[1].data = forecastData;
        consumptionChartCat1.update();
    } else {
        consumptionChartCat1 = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Datos historicos',
                        data: historicalData,
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Pronóstico',
                        data: forecastData,
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        borderDash: [5, 5],
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'month',
                            tooltipFormat: 'MMM yyyy',
                            displayFormats: {
                                month: 'MMM yyyy'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Período de tiempo'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Unidades(miles)'
                        }
                    }
                }
            }
        });
    }
}

function updateConsumptionChartCat2(data) {
    const ctx = elements.consumptionChartCat2.getContext('2d');
    
    const labels = [
        ...data.historical.map(d => d.date),
        ...data.forecast.map(d => d.date)
    ];
    
    const historicalData = [
        ...data.historical.map(d => d.value),
        ...Array(data.forecast.length).fill(null)
    ];
    
    const forecastData = [
        ...Array(data.historical.length).fill(null),
        ...data.forecast.map(d => d.value)
    ];
    
    if (consumptionChartCat2) {
        consumptionChartCat2.data.labels = labels;
        consumptionChartCat2.data.datasets[0].data = historicalData;
        consumptionChartCat2.data.datasets[1].data = forecastData;
        consumptionChartCat2.update();
    } else {
        consumptionChartCat2 = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Datos historicos',
                        data: historicalData,
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Pronóstico',
                        data: forecastData,
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        borderDash: [5, 5],
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'month',
                            tooltipFormat: 'MMM yyyy',
                            displayFormats: {
                                month: 'MMM yyyy'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Período de tiempo'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Unidades(miles)'
                        }
                    }
                }
            }
        });
    }
}

function updateSummaryStatsCat1(rfidData, consumptionData, stockData) {
    const stockCat1 = stockData.find(item => item.category === 1);
    const stockActual = stockCat1 ? stockCat1.level : 0;

    const todayForROP = new Date();
    const currentYear = todayForROP.getFullYear();
    const currentMonth = todayForROP.getMonth() + 1; 

    const forecastFromNow = consumptionData.forecast.filter(f => {
        const [year, month] = f.date.split('-').map(Number);
        return year > currentYear || (year === currentYear && month >= currentMonth);
    });
    const forecastValuesInUnits = forecastFromNow.map(f => f.value);

    let stockParaCobertura = stockActual;
    let coberturaValue = 0;
    for (let i = 0; i< forecastValuesInUnits.length; i++) {
        const monthlyForecast = forecastValuesInUnits[i];
        if(monthlyForecast<=0){
            coberturaValue+=1;
            continue;
        }
        if(stockParaCobertura <=0){
            break;
        }
        if(stockParaCobertura>=monthlyForecast){
            coberturaValue += 1;
            stockParaCobertura -= monthlyForecast;
        }else{
            coberturaValue+=stockParaCobertura/monthlyForecast;
            stockParaCobertura=0;
            break;
        }
    }
    const cobertura = coberturaValue.toFixed(2);
    
    const nextMonthDate = new Date(todayForROP.getFullYear(), todayForROP.getMonth() + 1, 1);
    const nextMonthYear = nextMonthDate.getFullYear();
    const nextMonthMonthStr = (nextMonthDate.getMonth() + 1).toString().padStart(2, '0');
    const nextMonthString = `${nextMonthYear}-${nextMonthMonthStr}`;

    const nextMonthForecast = consumptionData.forecast.find(f => f.date.startsWith(nextMonthString));

    const demandaProxMes = (nextMonthForecast ? nextMonthForecast.value : 0);
    const stockSeguridad = 1000; 
    const leadTime = 0.5; 
    const rop = (demandaProxMes * leadTime) + stockSeguridad;

    let prioridad = "Baja";
    let color = "#2ecc71"; 
    if (stockActual < rop) {
        prioridad = "Crítica";
        color = "#e74c3c"; 
    } else if (demandaProxMes > 0 && (stockActual / demandaProxMes) < 3) {
        prioridad = "Media";
        color = "#f39c12"; 
    }

    let stockRestante = stockActual;
    let mesQuiebre = "No estimado";
    for (let i = 0; i < forecastValuesInUnits.length; i++) {
        stockRestante -= forecastValuesInUnits[i];
        if (stockRestante < 0) {
            mesQuiebre = i + 1; 
            break;
        }
    }

    elements.stockCoverageCat1.textContent = cobertura;
    elements.stockBreakMonthCat1.textContent = mesQuiebre;
    elements.ropCat1.textContent = rop.toFixed(0); 
    elements.priorityCat1.textContent = prioridad;
    elements.priorityCat1.style.color = color;
}

function updateSummaryStatsCat2(rfidData, consumptionData, stockData) {
    const stockCat2 = stockData.find(item => item.category === 2);
    const stockActual = stockCat2 ? stockCat2.level : 0;

    const todayForROP = new Date();
    const currentYear = todayForROP.getFullYear();
    const currentMonth = todayForROP.getMonth() + 1; 

    const forecastFromNow = consumptionData.forecast.filter(f => {
        const [year, month] = f.date.split('-').map(Number);
        return year > currentYear || (year === currentYear && month >= currentMonth);
    });
    const forecastValuesInUnits = forecastFromNow.map(f => f.value);

    let stockParaCobertura = stockActual;
    let coberturaValue = 0;
    for (let i = 0; i< forecastValuesInUnits.length; i++) {
        const monthlyForecast = forecastValuesInUnits[i];
        if(monthlyForecast<=0){
            coberturaValue+=1;
            continue;
        }
        if(stockParaCobertura <=0){
            break;
        }
        if(stockParaCobertura>=monthlyForecast){
            coberturaValue += 1;
            stockParaCobertura -= monthlyForecast;
        }else{
            coberturaValue+=stockParaCobertura/monthlyForecast;
            stockParaCobertura=0;
            break;
        }
    }
    const cobertura = coberturaValue.toFixed(2);

    const nextMonthDate = new Date(todayForROP.getFullYear(), todayForROP.getMonth() + 1, 1);
    const nextMonthYear = nextMonthDate.getFullYear();
    const nextMonthMonthStr = (nextMonthDate.getMonth() + 1).toString().padStart(2, '0');
    const nextMonthString = `${nextMonthYear}-${nextMonthMonthStr}`;

    const nextMonthForecast = consumptionData.forecast.find(f => f.date.startsWith(nextMonthString));

    const demandaProxMes = (nextMonthForecast ? nextMonthForecast.value : 0);
    const stockSeguridad = 1000; 
    const leadTime = 0.5; 
    const rop = (demandaProxMes * leadTime) + stockSeguridad;

    let prioridad = "Baja";
    let color = "#2ecc71"; 
    if (stockActual < rop) {
        prioridad = "Crítica";
        color = "#e74c3c"; 
    } else if (demandaProxMes > 0 && (stockActual / demandaProxMes) < 3) {
        prioridad = "Media";
        color = "#f39c12"; 
    }

    let stockRestante = stockActual;
    let mesQuiebre = "No estimado";
    for (let i = 0; i < forecastValuesInUnits.length; i++) {
        stockRestante -= forecastValuesInUnits[i];
        if (stockRestante < 0) {
            mesQuiebre = i + 1; 
            break;
        }
    }

    elements.stockCoverageCat2.textContent = cobertura;
    elements.stockBreakMonthCat2.textContent = mesQuiebre;
    elements.ropCat2.textContent = rop.toFixed(0); 
    elements.priorityCat2.textContent = prioridad;
    elements.priorityCat2.style.color = color;
}


function updateLastUpdated() {
    const now = new Date();
    elements.updateTime.textContent = now.toLocaleString();
}

function formatDateTime(timestamp) {
    const parts = timestamp.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
    if (parts) {
        const year = parseInt(parts[3], 10);
        const month = parseInt(parts[2], 10) - 1;
        const day = parseInt(parts[1], 10);
        const hours = parseInt(parts[4], 10);
        const minutes = parseInt(parts[5], 10);
        const seconds = parseInt(parts[6], 10);
        
        const date = new Date(year, month, day, hours, minutes, seconds);
        return date.toLocaleString();
    }
    return "Invalid Date"; 
}

function setupEventListeners() {
    elements.refreshBtn.addEventListener('click', () => {
        location.reload(); 
    });
    
    elements.categoryFilter.addEventListener('change', () => {
        const selectedCategory = elements.categoryFilter.value;
        const rows = elements.dataBody.querySelectorAll('tr');
        
        rows.forEach(row => {
            const categoryCell = row.children[1];
            const categoryText = categoryCell.textContent;
            const rowCategoryMatch = categoryText.match(/Category (\d+)/);
            const rowCategory = rowCategoryMatch ? rowCategoryMatch[1] : null;
            
            if (selectedCategory === 'all' || rowCategory === selectedCategory) {
                row.style.display = ''; 
            } else {
                row.style.display = 'none'; 
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    setInterval(initDashboard, 20000);
});
