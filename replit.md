# Electricity Cost Calculator

## Overview

This is a Streamlit-based web application for calculating electricity costs based on time-of-use data. The application allows users to upload CSV files containing electricity usage data and provides visualizations and cost calculations. The system is built as a single-file Python application using Streamlit for the web interface and Plotly for data visualization.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: Streamlit - chosen for rapid development of data-focused web applications
- **Visualization**: Plotly Express and Plotly Graph Objects for interactive charts and graphs
- **Layout**: Wide layout configuration for better data visualization space
- **User Interface**: Single-page application with file upload functionality

### Backend Architecture
- **Language**: Python
- **Framework**: Streamlit (handles both frontend and backend logic)
- **Data Processing**: Pandas for CSV data manipulation and validation
- **Architecture Pattern**: Monolithic single-file application

### Data Processing
- **Data Format**: CSV files with datetime and kWh usage columns
- **Validation**: Built-in CSV structure and content validation
- **Data Types**: Pandas DataFrames for in-memory data processing

## Key Components

### 1. Data Validation System
- **Purpose**: Ensures uploaded CSV files meet required format standards
- **Implementation**: `validate_csv_data()` function with comprehensive error checking
- **Features**: 
  - Empty file detection
  - Column count validation
  - Automatic datetime and usage column identification
  - Data type conversion and validation

### 2. File Upload Interface
- **Technology**: Streamlit's built-in file uploader
- **Supported Format**: CSV files
- **Processing**: Real-time validation and feedback

### 3. Visualization Engine
- **Primary Tool**: Plotly for interactive charts
- **Chart Types**: Express charts for quick visualization, Graph Objects for custom charts
- **Features**: Interactive plots with zoom, pan, and hover capabilities

### 4. Cost Calculation Engine
- **Input**: Time-series electricity usage data
- **Processing**: Time-of-use rate calculations
- **Output**: Cost breakdowns and summaries

## Data Flow

1. **Data Input**: User uploads CSV file through Streamlit interface
2. **Validation**: CSV structure and content validated using pandas
3. **Processing**: Data cleaned and prepared for analysis
4. **Calculation**: Electricity costs calculated based on usage patterns
5. **Visualization**: Results displayed through interactive Plotly charts
6. **Output**: Cost summaries and recommendations presented to user

## External Dependencies

### Core Libraries
- **streamlit**: Web application framework
- **pandas**: Data manipulation and analysis
- **plotly**: Interactive visualization library
- **numpy**: Numerical computing support
- **datetime**: Date and time handling

### Data Requirements
- CSV files with datetime and electricity usage columns
- Flexible column naming (supports various naming conventions)
- Time-series data format

## Deployment Strategy

### Development Environment
- **Platform**: Replit-compatible Python environment
- **Requirements**: All dependencies installable via pip
- **Configuration**: Streamlit app configuration in code

### Production Considerations
- **Scalability**: Single-user focused, runs on Streamlit's built-in server
- **Performance**: In-memory processing suitable for moderate-sized datasets
- **Security**: File upload validation prevents malformed data processing

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