# Electricity Cost Calculator

## Overview

This is a static web application for calculating electricity costs based on time-of-use data with comprehensive billing models and VAT handling. The application allows users to upload CSV files containing hourly electricity usage data and provides detailed cost breakdowns, visualizations, and interactive tariff configuration. The system is built using HTML, CSS, and JavaScript with Plotly for data visualization, making it completely browser-based without requiring server-side processing.

## Recent Changes (July 2025)

✓ Implemented dynamic power tariff system with add/remove functionality
✓ Added named power tariffs with user-customizable names
✓ Updated power tariff calculation to use mean of N top peak days
✓ Added proper VAT handling (inclusive/exclusive pricing options)
✓ Integrated locale-based currency detection (defaults to SEK)
✓ Enhanced UI with session state management for tariffs
✓ Fixed cost breakdown to show net amounts separately from VAT
✓ Added browser storage for user configuration persistence
✓ Implemented save/load/reset functionality for billing parameters
✓ Added individual tariff cost reporting by name in breakdown
✓ Replaced server-side locale detection with user-selectable currency
✓ Enhanced cost breakdown to show each tariff separately with details
✓ Implemented predefined price model system with dropdown selector
✓ Added price-models directory support for JSON configuration files
✓ Integrated price model loading with manual configuration override capability
✓ Converted Streamlit application to static HTML/JavaScript/CSS
✓ Implemented client-side CSV processing and data validation
✓ Added drag-and-drop file upload with browser-based processing
✓ Maintained all original functionality in pure JavaScript
✓ Enhanced automatic CSV separator detection (comma vs semicolon)
✓ Improved price model discovery system with validation
✓ Added models index file support for easy model management
✓ Created comprehensive model loading with fallback discovery

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: Pure HTML, CSS, and JavaScript - chosen for maximum compatibility and no server requirements
- **Visualization**: Plotly.js for interactive charts and graphs
- **Layout**: Responsive CSS Grid and Flexbox for optimal viewing on all devices
- **User Interface**: Single-page application with drag-and-drop file upload functionality
- **Storage**: Browser localStorage for configuration persistence

### Backend Architecture
- **Language**: JavaScript (client-side only)
- **Framework**: Vanilla JavaScript with no dependencies except Plotly.js
- **Data Processing**: Pure JavaScript for CSV parsing, data manipulation and validation
- **Architecture Pattern**: Client-side single-page application with no server requirements

### Data Processing
- **Data Format**: CSV files with datetime and kWh usage columns
- **Validation**: JavaScript-based CSV structure and content validation
- **Data Types**: JavaScript arrays and objects for in-memory data processing
- **File Handling**: Browser File API for client-side file reading and processing

## Key Components

### 1. Data Validation System
- **Purpose**: Ensures uploaded CSV files meet required format standards
- **Implementation**: `validateCSVData()` JavaScript function with comprehensive error checking
- **Features**: 
  - Empty file detection
  - Column count validation
  - Automatic datetime and usage column identification
  - Data type conversion and validation

### 2. File Upload Interface
- **Technology**: HTML5 File API with drag-and-drop support
- **Supported Format**: CSV files
- **Processing**: Client-side real-time validation and feedback
- **Features**: Drag-and-drop area, file size display, progress indication

### 3. Visualization Engine
- **Primary Tool**: Plotly.js for interactive charts
- **Chart Types**: Scatter plots for usage data with peak hour highlighting
- **Features**: Interactive plots with zoom, pan, hover, and responsive design

### 4. Cost Calculation Engine
- **Input**: Time-series electricity usage data processed in browser
- **Processing**: Complex time-of-use rate calculations with tariff restrictions
- **Output**: Detailed cost breakdowns with individual tariff reporting

## Data Flow

1. **Data Input**: User uploads CSV file through drag-and-drop or file browser
2. **Validation**: CSV structure and content validated using JavaScript
3. **Processing**: Data parsed and cleaned client-side using File API
4. **Calculation**: Electricity costs calculated in browser using complex tariff logic
5. **Visualization**: Results displayed through interactive Plotly.js charts
6. **Output**: Cost summaries and breakdowns presented in responsive tables
7. **Persistence**: Configuration saved to browser localStorage for future use

## External Dependencies

### Core Libraries
- **Plotly.js**: Interactive visualization library (loaded from CDN)
- **Browser APIs**: File API, localStorage, Intl for currency formatting
- **No server-side dependencies**: Pure client-side application

### Data Requirements
- CSV files with datetime and electricity usage columns
- Flexible column naming (supports various naming conventions)
- Time-series data format
- Client-side processing capabilities

## Deployment Strategy

### Development Environment
- **Platform**: Any web server capable of serving static files
- **Requirements**: No server-side dependencies
- **Configuration**: All settings stored in browser localStorage

### Production Considerations
- **Scalability**: Unlimited concurrent users, no server processing required
- **Performance**: Client-side processing suitable for moderate-sized datasets
- **Security**: File processing entirely in browser, no data transmitted to server
- **Deployment**: Can be hosted on any static hosting service (GitHub Pages, Netlify, etc.)

### Architecture Decisions

#### Why Streamlit?
- **Problem**: Need for rapid development of data visualization web app
- **Solution**: Streamlit provides integrated frontend/backend with minimal setup
- **Alternatives**: Flask/Django + separate frontend, Dash
- **Pros**: Fast development, built-in components, easy deployment
- **Cons**: Limited customization, single-threaded

#### Why Plotly?
- **Problem**: Need for interactive, professional-quality charts
- **Solution**: Plotly provides both simple (Express) and advanced (Graph Objects) APIs
- **Alternatives**: Matplotlib, Seaborn, Bokeh
- **Pros**: Interactive by default, web-native, integrates well with Streamlit
- **Cons**: Larger library size, learning curve for advanced features

#### Why Pandas?
- **Problem**: Need robust CSV processing and data validation
- **Solution**: Pandas provides comprehensive data manipulation capabilities
- **Alternatives**: Pure Python CSV module, NumPy
- **Pros**: Excellent CSV handling, powerful data validation, time-series support
- **Cons**: Memory overhead for large datasets, complexity for simple operations