# Electricity Cost Calculator

A static web application for calculating electricity costs with complex billing models, power tariffs, and VAT handling.

## Features

- **CSV Upload**: Drag-and-drop or browse to upload hourly electricity usage data
- **Flexible Parsing**: Supports both comma and semicolon-separated CSV files
- **Price Models**: Predefined billing configurations for major electricity providers
- **Complex Tariffs**: Power tariff calculations with time and seasonal restrictions
- **VAT Handling**: Inclusive or exclusive VAT calculations
- **Interactive Charts**: Plotly.js visualizations with peak hour highlighting
- **Configuration Storage**: Browser localStorage for settings persistence

## Usage

1. Open `index.html` in a web browser
2. Configure billing parameters or select a predefined price model
3. Upload your CSV file with hourly electricity usage data
4. View the cost breakdown and usage visualization

## CSV Format

Your CSV file should contain:
- **DateTime column**: date, time, timestamp, datetime, dt, or ts
- **Usage column**: kwh, usage, consumption, energy, power, or load

Supported formats:
- Comma-separated (`,`) or semicolon-separated (`;`)
- Various date formats: ISO (2024-01-01 12:00:00), European (01/01/2024 12:00)
- European decimal separator (comma) or standard (dot)

## Price Models

Add JSON files to the `price-models/` directory to create custom billing configurations:

```json
{
    "name": "Provider Name",
    "currency": "SEK",
    "tax_rate": 0.25,
    "prices_include_tax": true,
    "fixed_fee_per_month": 350.00,
    "usage_fee_per_kwh": 0.065,
    "power_tariffs": [
        {
            "name": "Winter Peak",
            "fee_per_kw": 60.00,
            "number_of_top_peaks_to_average": 3,
            "months": [11, 12, 1, 2, 3],
            "start_time": "07:00",
            "end_time": "22:00"
        }
    ]
}
```

## Deployment

This is a static web application requiring no server-side processing:

1. **Local Development**: Use any web server (Python's `http.server`, Node's `live-server`, etc.)
2. **Production**: Deploy to any static hosting service (GitHub Pages, Netlify, Vercel, etc.)
3. **Requirements**: Only need to serve HTML, CSS, JavaScript, and JSON files

## Technical Details

- **Frontend**: Pure HTML5, CSS3, JavaScript (ES6+)
- **Visualization**: Plotly.js for interactive charts
- **Storage**: Browser localStorage for configuration persistence
- **Processing**: Client-side CSV parsing and calculations
- **Compatibility**: Modern browsers with File API support