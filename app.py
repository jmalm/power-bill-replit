import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, time
import numpy as np
from io import StringIO
import locale
import json
import os
import glob

# Set page configuration
st.set_page_config(
    page_title="Electricity Cost Calculator",
    page_icon="⚡",
    layout="wide"
)

def validate_csv_data(df):
    """Validate the uploaded CSV data structure and content."""
    errors = []
    
    if df.empty:
        errors.append("CSV file is empty")
        return errors
    
    if len(df.columns) < 2:
        errors.append("CSV must have at least 2 columns (datetime and kWh)")
        return errors
    
    # Try to identify datetime and usage columns
    datetime_col = None
    usage_col = None
    
    for col in df.columns:
        col_lower = col.lower()
        if any(term in col_lower for term in ['datetime', 'date', 'time', 'timestamp']):
            datetime_col = col
        elif any(term in col_lower for term in ['kwh', 'usage', 'consumption', 'power']):
            usage_col = col
    
    if datetime_col is None:
        # Try first column as datetime
        datetime_col = df.columns[0]
    
    if usage_col is None:
        # Try second column as usage
        usage_col = df.columns[1] if len(df.columns) > 1 else df.columns[0]
    
    # Validate datetime column
    try:
        df[datetime_col] = pd.to_datetime(df[datetime_col])
    except Exception as e:
        errors.append(f"Could not parse datetime column '{datetime_col}': {str(e)}")
    
    # Validate usage column
    try:
        # Attempt to convert usage column to numeric, handling different decimal separators
        try:
            df[usage_col] = df[usage_col].str.replace(',', '.', regex=False).astype(float)
        except AttributeError:
            pass  # Column might already be numeric
        df[usage_col] = pd.to_numeric(df[usage_col], errors='coerce')
        if df[usage_col].isna().any():
            errors.append(f"Non-numeric values found in usage column '{usage_col}'")
        if (df[usage_col] < 0).any():
            errors.append(f"Negative values found in usage column '{usage_col}'")
    except Exception as e:
        errors.append(f"Could not parse usage column '{usage_col}': {str(e)}")
    
    return errors, datetime_col, usage_col

def calculate_power_tariffs(df, datetime_col, usage_col, tariffs):
    """Calculate power tariff costs based on mean of peak usage hours on separate days."""
    total_tariff_cost = 0
    peak_hours_info = []
    tariff_costs = []  # Individual tariff costs
    
    for tariff in tariffs:
        if not tariff['enabled']:
            # Add zero cost entry for disabled tariffs
            tariff_costs.append({
                'name': tariff['name'],
                'cost': 0,
                'mean_usage': 0,
                'top_n': tariff['top_n'],
                'rate': tariff['rate'],
                'enabled': False
            })
            continue
            
        # Filter data based on month and hour restrictions
        filtered_df = df.copy()
        
        # Month filtering
        if tariff['months']:
            filtered_df = filtered_df[filtered_df[datetime_col].dt.month.isin(tariff['months'])]
        
        # Hour filtering
        if tariff['hours']:
            filtered_df = filtered_df[filtered_df[datetime_col].dt.hour.isin(tariff['hours'])]
        
        if filtered_df.empty:
            tariff_costs.append({
                'name': tariff['name'],
                'cost': 0,
                'mean_usage': 0,
                'top_n': tariff['top_n'],
                'rate': tariff['rate'],
                'enabled': True
            })
            continue
        
        # Group by date and find the maximum usage for each day
        daily_peaks = filtered_df.groupby(filtered_df[datetime_col].dt.date)[usage_col].max().reset_index()
        daily_peaks.columns = ['date', 'peak_usage']
        
        # Sort by peak usage and take top N
        top_peaks = daily_peaks.nlargest(tariff['top_n'], 'peak_usage')
        
        # Calculate tariff cost using MEAN of top N peaks
        if not top_peaks.empty:
            mean_peak_usage = top_peaks['peak_usage'].mean()
            tariff_cost = mean_peak_usage * tariff['rate']
            total_tariff_cost += tariff_cost
        else:
            mean_peak_usage = 0
            tariff_cost = 0
        
        # Store individual tariff cost info
        tariff_costs.append({
            'name': tariff['name'],
            'cost': tariff_cost,
            'mean_usage': mean_peak_usage,
            'top_n': tariff['top_n'],
            'rate': tariff['rate'],
            'enabled': True
        })
        
        # Store peak hours information for highlighting
        for _, peak in top_peaks.iterrows():
            # Find the actual datetime for this peak
            peak_datetime = filtered_df[
                (filtered_df[datetime_col].dt.date == peak['date']) & 
                (filtered_df[usage_col] == peak['peak_usage'])
            ][datetime_col].iloc[0]
            
            peak_hours_info.append({
                'datetime': peak_datetime,
                'usage': peak['peak_usage'],
                'tariff_name': tariff['name'],
                'rate': tariff['rate'],
                'mean_usage': mean_peak_usage
            })
    
    return total_tariff_cost, peak_hours_info, tariff_costs

def calculate_vat(amount, vat_rate, prices_include_vat):
    """Calculate VAT amount and net amount."""
    if prices_include_vat:
        # Prices include VAT, so we need to extract the VAT
        vat_multiplier = 1 + (vat_rate / 100)
        net_amount = amount / vat_multiplier
        vat_amount = amount - net_amount
    else:
        # Prices exclude VAT, so we add VAT
        net_amount = amount
        vat_amount = amount * (vat_rate / 100)
    
    return net_amount, vat_amount

def get_available_currencies():
    """Get list of available currencies."""
    return {
        'SEK': 'kr',
        'EUR': '€',
        'USD': '$',
        'GBP': '£',
        'NOK': 'kr',
        'DKK': 'kr',
        'CHF': 'CHF',
        'CAD': '$',
        'AUD': '$'
    }

def load_price_models():
    """Load all available price models from the price-models directory."""
    price_models = {}
    
    try:
        # Get all JSON files in the price-models directory
        model_files = glob.glob('price-models/*.json')
        
        for file_path in model_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    model_data = json.load(f)
                    
                # Use filename (without extension) as key, but display name from JSON
                model_key = os.path.splitext(os.path.basename(file_path))[0]
                price_models[model_key] = model_data
                
            except Exception as e:
                st.warning(f"Error loading price model {file_path}: {str(e)}")
                continue
    
    except Exception as e:
        st.warning(f"Error accessing price-models directory: {str(e)}")
    
    return price_models

def convert_price_model_to_config(model_data):
    """Convert a price model JSON to our internal configuration format."""
    try:
        # Convert time string to hour number
        def time_to_hour(time_str):
            return int(time_str.split(':')[0])
        
        config = {
            'fixed_cost': float(model_data.get('fixed_fee_per_month', 100.0)),
            'usage_rate': float(model_data.get('usage_fee_per_kwh', 1.20)),
            'vat_rate': float(model_data.get('tax_rate', 0.25)) * 100.0,  # Convert from decimal to percentage
            'prices_include_vat': model_data.get('prices_include_tax', False),
            'currency': model_data.get('currency', 'SEK'),
            'tariffs': []
        }
        
        # Convert power tariffs
        for tariff in model_data.get('power_tariffs', []):
            tariff_config = {
                'name': tariff.get('name', 'Unnamed Tariff'),
                'enabled': True,
                'top_n': int(tariff.get('number_of_top_peaks_to_average', 3)),
                'rate': float(tariff.get('fee_per_kw', 50.0)),
                'months': tariff.get('months', []),
                'hours': []
            }
            
            # Convert time range to hour list if specified
            if 'start_time' in tariff and 'end_time' in tariff:
                start_hour = time_to_hour(tariff['start_time'])
                end_hour = time_to_hour(tariff['end_time'])
                
                # Handle time ranges that cross midnight
                if start_hour <= end_hour:
                    tariff_config['hours'] = list(range(start_hour, end_hour + 1))
                else:
                    # Crosses midnight: start_hour to 23, then 0 to end_hour
                    tariff_config['hours'] = list(range(start_hour, 24)) + list(range(0, end_hour + 1))
            
            config['tariffs'].append(tariff_config)
        
        return config
        
    except Exception as e:
        st.error(f"Error converting price model: {str(e)}")
        return None

def save_config_to_browser(config):
    """Save configuration to browser local storage using Streamlit's query params."""
    try:
        config_json = json.dumps(config)
        st.query_params.config = config_json
    except Exception as e:
        st.warning(f"Could not save configuration: {str(e)}")

def load_config_from_browser():
    """Load configuration from browser local storage."""
    try:
        config_json = st.query_params.get("config", None)
        if config_json:
            return json.loads(config_json)
        return None
    except Exception as e:
        return None

def get_default_config():
    """Get default configuration values."""
    return {
        'fixed_cost': 100.0,
        'usage_rate': 1.20,
        'vat_rate': 25.0,
        'prices_include_vat': False,
        'currency': 'SEK',
        'selected_price_model': 'custom',
        'tariffs': [
            {
                'name': 'Power Tariff 1',
                'enabled': True,
                'top_n': 3,
                'rate': 50.0,
                'months': [],
                'hours': []
            }
        ]
    }

def main():
    st.title("⚡ Electricity Cost Calculator")
    st.markdown("Upload your hourly electricity usage CSV file and configure billing parameters to calculate your total electricity cost.")
    
    # Show configuration storage info
    with st.expander("ℹ️ Configuration Storage", expanded=False):
        st.markdown("""
        Your billing configuration is automatically stored in your browser and will be restored when you return to this page.
        
        **Features:**
        - **Auto-restore**: Settings load automatically when you visit the page
        - **Manual save**: Use the 'Save Config' button to store current settings
        - **Load saved**: Use 'Load Config' to restore previously saved settings
        - **Reset**: Use 'Reset' to return to default values
        
        Settings are stored locally in your browser and are not shared with other users or devices.
        """)
    
    # Load configuration from browser or use defaults
    saved_config = load_config_from_browser()
    config_source = "saved" if saved_config is not None else "default"
    if saved_config is None:
        saved_config = get_default_config()
    
    # Load available price models
    available_models = load_price_models()
    
    # Initialize session state with saved config if not already initialized
    if 'config_loaded' not in st.session_state:
        st.session_state.fixed_cost = saved_config['fixed_cost']
        st.session_state.usage_rate = saved_config['usage_rate']
        st.session_state.vat_rate = saved_config['vat_rate']
        st.session_state.prices_include_vat = saved_config['prices_include_vat']
        st.session_state.currency = saved_config.get('currency', 'SEK')
        st.session_state.tariffs = saved_config['tariffs']
        st.session_state.selected_price_model = saved_config.get('selected_price_model', 'custom')
        st.session_state.config_loaded = True
        st.session_state.config_source = config_source
    
    # File upload section
    st.header("📁 Upload Usage Data")
    uploaded_file = st.file_uploader(
        "Choose a CSV file with hourly electricity usage data",
        #type=['csv'],
        help="CSV should contain columns for datetime and kWh usage"
    )
    
    if uploaded_file is not None:
        try:
            # Read CSV file
            stringio = StringIO(uploaded_file.getvalue().decode("utf-8"))
            df = pd.read_csv(stringio)
            # Attempt to read CSV with comma separator
            try:
                df = pd.read_csv(stringio, sep=',')
            except Exception:
                # If comma fails, attempt to read with semicolon separator
                stringio.seek(0)  # Reset file pointer
                try:
                    df = pd.read_csv(stringio, sep=';')
                except Exception as e:
                    raise Exception("Could not parse CSV file with comma or semicolon separators.") from e
            
            # Validate data
            validation_result = validate_csv_data(df)
            if len(validation_result) == 3:  # errors, datetime_col, usage_col
                errors, datetime_col, usage_col = validation_result
            else:
                errors = validation_result
                datetime_col = usage_col = None
            
            if errors:
                st.error("CSV Validation Errors:")
                for error in errors:
                    st.error(f"• {error}")
                return
            
            # Display data preview
            st.success(f"✅ CSV loaded successfully! Found {len(df)} hourly records.")
            st.subheader("Data Preview")
            st.dataframe(df.head(10), use_container_width=True)
            
            # Billing parameters section
            st.header("💰 Billing Parameters")
            
            # Price model selector
            st.subheader("🏢 Price Model Selection")
            
            # Create options for price model dropdown
            model_options = ["custom"] + list(available_models.keys())
            model_display_names = ["Custom Configuration"] + [available_models[key]['name'] for key in available_models.keys()]
            model_display_dict = dict(zip(model_options, model_display_names))
            
            selected_model = st.selectbox(
                "Select a predefined price model or use custom configuration",
                options=model_options,
                format_func=lambda x: model_display_dict[x],
                index=model_options.index(st.session_state.get('selected_price_model', 'custom')),
                key="price_model_selector",
                help="Choose a predefined electricity pricing model or configure manually"
            )
            
            # Handle price model selection
            if selected_model != st.session_state.get('selected_price_model', 'custom'):
                if selected_model != "custom" and selected_model in available_models:
                    # Load the selected price model
                    model_config = convert_price_model_to_config(available_models[selected_model])
                    if model_config:
                        st.session_state.fixed_cost = model_config['fixed_cost']
                        st.session_state.usage_rate = model_config['usage_rate']
                        st.session_state.vat_rate = model_config['vat_rate']
                        st.session_state.prices_include_vat = model_config['prices_include_vat']
                        st.session_state.currency = model_config['currency']
                        st.session_state.tariffs = model_config['tariffs']
                        st.success(f"Loaded price model: {available_models[selected_model]['name']}")
                        st.session_state.config_source = "price_model"
                
                st.session_state.selected_price_model = selected_model
                st.rerun()
            
            # Show current model info
            if selected_model != "custom":
                model_info = available_models.get(selected_model, {})
                st.info(f"📋 Using price model: **{model_info.get('name', 'Unknown')}**\n\nYou can still adjust the values below as needed.")
            else:
                st.info("📝 Using custom configuration. Set your pricing parameters below.")
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.subheader("Basic Costs")
                
                # Currency selector
                currencies = get_available_currencies()
                currency_options = list(currencies.keys())
                default_currency_index = currency_options.index(st.session_state.currency) if st.session_state.currency in currency_options else 0
                
                selected_currency = st.selectbox(
                    "Currency",
                    options=currency_options,
                    index=default_currency_index,
                    key="currency_input",
                    help="Select your local currency"
                )
                currency_symbol = currencies[selected_currency]
                
                fixed_cost = st.number_input(
                    f"Fixed Monthly Cost ({selected_currency})",
                    min_value=0.0,
                    value=st.session_state.fixed_cost,
                    step=1.0,
                    format="%.2f",
                    key="fixed_cost_input"
                )
                
                usage_rate = st.number_input(
                    f"Usage Cost per kWh ({selected_currency})",
                    min_value=0.0,
                    value=st.session_state.usage_rate,
                    step=0.01,
                    format="%.4f",
                    key="usage_rate_input"
                )
                
                vat_rate = st.number_input(
                    "VAT Percentage",
                    min_value=0.0,
                    max_value=100.0,
                    value=st.session_state.vat_rate,
                    step=0.1,
                    format="%.1f",
                    key="vat_rate_input"
                )
                
                prices_include_vat = st.checkbox(
                    "Entered prices include VAT",
                    value=st.session_state.prices_include_vat,
                    help="Check this if the prices you entered above already include VAT",
                    key="prices_include_vat_input"
                )
                
                # Update session state with current values
                st.session_state.fixed_cost = fixed_cost
                st.session_state.usage_rate = usage_rate
                st.session_state.vat_rate = vat_rate
                st.session_state.prices_include_vat = prices_include_vat
                st.session_state.currency = selected_currency
                
                # Save/Load configuration buttons
                col_save, col_load, col_reset = st.columns(3)
                with col_save:
                    if st.button("💾 Save Config", help="Save current settings to browser storage"):
                        config = {
                            'fixed_cost': fixed_cost,
                            'usage_rate': usage_rate,
                            'vat_rate': vat_rate,
                            'prices_include_vat': prices_include_vat,
                            'currency': selected_currency,
                            'selected_price_model': st.session_state.get('selected_price_model', 'custom'),
                            'tariffs': st.session_state.tariffs
                        }
                        save_config_to_browser(config)
                        st.session_state.config_source = "saved"
                        st.success("Configuration saved!")
                        st.rerun()
                
                with col_load:
                    if st.button("📂 Load Config", help="Load settings from browser storage"):
                        saved_config = load_config_from_browser()
                        if saved_config:
                            st.session_state.fixed_cost = saved_config['fixed_cost']
                            st.session_state.usage_rate = saved_config['usage_rate']
                            st.session_state.vat_rate = saved_config['vat_rate']
                            st.session_state.prices_include_vat = saved_config['prices_include_vat']
                            st.session_state.currency = saved_config.get('currency', 'SEK')
                            st.session_state.selected_price_model = saved_config.get('selected_price_model', 'custom')
                            st.session_state.tariffs = saved_config['tariffs']
                            st.session_state.config_source = "saved"
                            st.success("Configuration loaded!")
                            st.rerun()
                        else:
                            st.warning("No saved configuration found.")
                
                with col_reset:
                    if st.button("🔄 Reset", help="Reset to default values"):
                        default_config = get_default_config()
                        st.session_state.fixed_cost = default_config['fixed_cost']
                        st.session_state.usage_rate = default_config['usage_rate']
                        st.session_state.vat_rate = default_config['vat_rate']
                        st.session_state.prices_include_vat = default_config['prices_include_vat']
                        st.session_state.currency = default_config['currency']
                        st.session_state.selected_price_model = default_config['selected_price_model']
                        st.session_state.tariffs = default_config['tariffs']
                        st.session_state.config_source = "default"
                        st.success("Configuration reset to defaults!")
                        st.rerun()
                
                # Show current config status
                if hasattr(st.session_state, 'config_source'):
                    if st.session_state.config_source == "saved":
                        st.info("📁 Using saved configuration from browser storage")
                    elif st.session_state.config_source == "price_model":
                        current_model = st.session_state.get('selected_price_model', 'custom')
                        if current_model != 'custom' and current_model in available_models:
                            model_name = available_models[current_model]['name']
                            st.info(f"🏢 Using price model: {model_name}")
                        else:
                            st.info("⚙️ Using custom configuration")
                    else:
                        st.info("⚙️ Using default configuration")
            
            with col2:
                st.subheader("Power Tariffs")
                
                # Tariffs are already initialized from saved config
                
                # Add/Remove tariff buttons
                col_add, col_remove = st.columns(2)
                with col_add:
                    if st.button("Add Tariff", type="secondary"):
                        st.session_state.tariffs.append({
                            'name': f'Power Tariff {len(st.session_state.tariffs) + 1}',
                            'enabled': True,
                            'top_n': 3,
                            'rate': 50.0,
                            'months': [],
                            'hours': []
                        })
                        st.rerun()
                
                with col_remove:
                    if st.button("Remove Last Tariff", type="secondary", disabled=len(st.session_state.tariffs) <= 0):
                        if st.session_state.tariffs:
                            st.session_state.tariffs.pop()
                            st.rerun()
                
                # Display tariffs
                tariffs = []
                for i, tariff_data in enumerate(st.session_state.tariffs):
                    with st.expander(f"{tariff_data['name']}", expanded=True):
                        # Tariff name
                        name = st.text_input(
                            f"Tariff Name",
                            value=tariff_data['name'],
                            key=f"name_{i}"
                        )
                        
                        enabled = st.checkbox(f"Enable this tariff", value=tariff_data['enabled'], key=f"enable_{i}")
                        
                        top_n = st.number_input(
                            f"Top N peak days",
                            min_value=1,
                            max_value=31,
                            value=tariff_data['top_n'],
                            step=1,
                            key=f"top_n_{i}",
                            help="Number of highest usage days to include in the mean calculation"
                        )
                        
                        rate = st.number_input(
                            f"Tariff Rate per kWh ({selected_currency})",
                            min_value=0.0,
                            value=tariff_data['rate'],
                            step=1.0,
                            format="%.2f",
                            key=f"rate_{i}"
                        )
                        
                        # Month restrictions
                        month_options = {
                            "January": 1, "February": 2, "March": 3, "April": 4,
                            "May": 5, "June": 6, "July": 7, "August": 8,
                            "September": 9, "October": 10, "November": 11, "December": 12
                        }
                        
                        selected_months = st.multiselect(
                            f"Applicable Months (leave empty for all year)",
                            options=list(month_options.keys()),
                            default=[k for k, v in month_options.items() if v in tariff_data['months']],
                            key=f"months_{i}"
                        )
                        months = [month_options[month] for month in selected_months] if selected_months else []
                        
                        # Hour restrictions
                        apply_hour_restriction = st.checkbox(
                            f"Apply hour restriction",
                            value=bool(tariff_data['hours']),
                            key=f"apply_hours_{i}"
                        )
                        
                        if apply_hour_restriction:
                            if tariff_data['hours']:
                                default_range = (min(tariff_data['hours']), max(tariff_data['hours']))
                            else:
                                default_range = (0, 23)
                            
                            hour_range = st.slider(
                                f"Applicable Hours (24h format)",
                                min_value=0,
                                max_value=23,
                                value=default_range,
                                key=f"hours_{i}"
                            )
                            hours = list(range(hour_range[0], hour_range[1] + 1))
                        else:
                            hours = []
                        
                        tariffs.append({
                            'name': name,
                            'enabled': enabled,
                            'top_n': top_n,
                            'rate': rate,
                            'months': months,
                            'hours': hours
                        })
                        
                        # Update session state
                        st.session_state.tariffs[i] = {
                            'name': name,
                            'enabled': enabled,
                            'top_n': top_n,
                            'rate': rate,
                            'months': months,
                            'hours': hours
                        }
            
            # Calculate costs
            if st.button("Calculate Electricity Cost", type="primary"):
                with st.spinner("Calculating costs..."):
                    # Basic usage cost
                    total_usage = df[usage_col].sum()
                    usage_cost = total_usage * usage_rate
                    
                    # Power tariff costs
                    tariff_cost, peak_hours_info, individual_tariff_costs = calculate_power_tariffs(
                        df, datetime_col, usage_col, tariffs
                    )
                    
                    # Calculate VAT
                    subtotal_before_vat = fixed_cost + usage_cost + tariff_cost
                    net_amount, vat_amount = calculate_vat(subtotal_before_vat, vat_rate, prices_include_vat)
                    
                    if prices_include_vat:
                        # Prices included VAT, so we show the breakdown
                        fixed_net, fixed_vat = calculate_vat(fixed_cost, vat_rate, True)
                        usage_net, usage_vat = calculate_vat(usage_cost, vat_rate, True)
                        tariff_net, tariff_vat = calculate_vat(tariff_cost, vat_rate, True)
                        
                        total_cost = subtotal_before_vat
                        subtotal_net = fixed_net + usage_net + tariff_net
                        total_vat = fixed_vat + usage_vat + tariff_vat
                    else:
                        # Prices exclude VAT
                        fixed_net = fixed_cost
                        usage_net = usage_cost
                        tariff_net = tariff_cost
                        subtotal_net = net_amount
                        total_vat = vat_amount
                        total_cost = net_amount + vat_amount
                
                # Display results
                st.header("📊 Cost Breakdown")
                
                col1, col2 = st.columns(2)
                
                with col1:
                    st.subheader("Cost Components (Net)")
                    st.metric("Fixed Monthly Cost", f"{currency_symbol} {fixed_net:.2f}")
                    st.metric("Usage Cost", f"{currency_symbol} {usage_net:.2f}", 
                             help=f"Total usage: {total_usage:.2f} kWh")
                    
                    # Show individual tariff costs
                    for tariff_info in individual_tariff_costs:
                        if tariff_info['enabled'] and tariff_info['cost'] > 0:
                            if prices_include_vat:
                                tariff_display_cost, _ = calculate_vat(tariff_info['cost'], vat_rate, True)
                            else:
                                tariff_display_cost = tariff_info['cost']
                            
                            st.metric(
                                f"{tariff_info['name']}", 
                                f"{currency_symbol} {tariff_display_cost:.2f}",
                                help=f"Mean of top {tariff_info['top_n']} days: {tariff_info['mean_usage']:.3f} kWh × {currency_symbol} {tariff_info['rate']:.2f}"
                            )
                    
                    # Show total tariff cost
                    if tariff_net > 0:
                        st.metric("Total Power Tariffs", f"{currency_symbol} {tariff_net:.2f}")
                    
                    st.metric("Subtotal (Net)", f"{currency_symbol} {subtotal_net:.2f}")
                    st.metric("VAT ({:.1f}%)".format(vat_rate), f"{currency_symbol} {total_vat:.2f}")
                    st.metric("**Total Cost**", f"**{currency_symbol} {total_cost:.2f}**")
                
                with col2:
                    st.subheader("Usage Statistics")
                    st.metric("Total Usage", f"{total_usage:.2f} kWh")
                    st.metric("Average Hourly Usage", f"{total_usage/len(df):.3f} kWh")
                    st.metric("Peak Usage", f"{df[usage_col].max():.3f} kWh")
                    st.metric("Number of Records", f"{len(df)}")
                    
                    if peak_hours_info:
                        st.metric("Peak Hours for Tariffs", f"{len(peak_hours_info)}")
                
                # Create usage chart
                st.header("📈 Hourly Usage Chart")
                
                # Prepare data for plotting
                df_plot = df.copy()
                df_plot['is_peak'] = False
                df_plot['tariff_info'] = ''
                
                # Mark peak hours
                for peak in peak_hours_info:
                    mask = df_plot[datetime_col] == peak['datetime']
                    df_plot.loc[mask, 'is_peak'] = True
                    df_plot.loc[mask, 'tariff_info'] = f"{peak['tariff_name']}: €{peak['rate']:.2f}/kWh"
                
                # Create the plot
                fig = go.Figure()
                
                # Regular usage
                regular_usage = df_plot[~df_plot['is_peak']]
                fig.add_trace(go.Scatter(
                    x=regular_usage[datetime_col],
                    y=regular_usage[usage_col],
                    mode='lines',
                    name='Regular Usage',
                    line=dict(color='lightblue', width=1),
                    hovertemplate='<b>%{x}</b><br>Usage: %{y:.3f} kWh<extra></extra>'
                ))
                
                # Peak usage
                peak_usage = df_plot[df_plot['is_peak']]
                if not peak_usage.empty:
                    fig.add_trace(go.Scatter(
                        x=peak_usage[datetime_col],
                        y=peak_usage[usage_col],
                        mode='markers',
                        name='Peak Hours (Tariff)',
                        marker=dict(color='red', size=8, symbol='diamond'),
                        customdata=peak_usage['tariff_info'],
                        hovertemplate='<b>%{x}</b><br>Usage: %{y:.3f} kWh<br>%{customdata}<extra></extra>'
                    ))
                
                fig.update_layout(
                    title='Hourly Electricity Usage',
                    xaxis_title='Date & Time',
                    yaxis_title='Usage (kWh)',
                    hovermode='x unified',
                    showlegend=True,
                    height=500
                )
                
                st.plotly_chart(fig, use_container_width=True)
                
                # Peak hours details
                if peak_hours_info:
                    st.subheader("🔥 Peak Hours Used for Tariff Calculation")
                    peak_df = pd.DataFrame(peak_hours_info)
                    peak_df['cost'] = peak_df['usage'] * peak_df['rate']
                    peak_df = peak_df.sort_values('datetime')
                    
                    display_df = peak_df[['datetime', 'usage', 'tariff_name', 'rate', 'cost']].copy()
                    display_df.columns = [
                        'Date & Time',
                        'Usage (kWh)',
                        'Tariff',
                        f'Rate ({selected_currency}/kWh)',
                        f'Cost ({selected_currency})'
                    ]
                    st.dataframe(display_df, use_container_width=True)
        
        except Exception as e:
            st.error(f"Error processing file: {str(e)}")
            st.error("Please check that your CSV file has the correct format with datetime and kWh columns.")
    
    else:
        st.info("👆 Please upload a CSV file to get started.")
        st.markdown("""
        ### Expected CSV Format:
        Your CSV file should contain at least two columns:
        - **DateTime column**: Date and time in a recognizable format (e.g., '2024-01-01 00:00:00')
        - **Usage column**: Electricity usage in kWh (numeric values)
        
        Example:
        ```
        datetime,usage_kwh
        2024-01-01 00:00:00,1.234
        2024-01-01 01:00:00,1.156
        2024-01-01 02:00:00,0.987
        ...
        ```
        """)

if __name__ == "__main__":
    main()
